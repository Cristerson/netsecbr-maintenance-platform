import { createClient } from 'npm:@supabase/supabase-js@2'

const origins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://localhost:5174').split(',').map((value) => value.trim())
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && origins.includes(origin) ? origin : origins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', Vary: 'Origin',
})
const respond = (body: Record<string, unknown>, status: number, headers: Record<string, string>) => new Response(JSON.stringify(body), { status, headers })
const password = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*'
  return Array.from(crypto.getRandomValues(new Uint32Array(18)), (value) => alphabet[value % alphabet.length]).join('')
}

Deno.serve(async (request) => {
  const headers = cors(request.headers.get('origin'))
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405, headers)
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return respond({ error: 'Usuário não autenticado.' }, 401, headers)
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } })
    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) return respond({ error: 'Sessão inválida.' }, 401, headers)
    const admin = createClient(url, service)
    const { data: owner } = await admin.from('platform_access_roles').select('user_id, profiles!inner(platform_role, is_active)').eq('user_id', caller.id).eq('role', 'owner').eq('is_active', true).maybeSingle()
    const ownerProfile = owner?.profiles as { platform_role: string; is_active: boolean } | undefined
    if (!ownerProfile || ownerProfile.platform_role !== 'netsecbr_admin' || !ownerProfile.is_active) return respond({ error: 'Acesso restrito ao Proprietário da plataforma.' }, 403, headers)
    const body = await request.json(), action = String(body.action ?? '')
    const audit = (event: string, id: string, metadata: Record<string, unknown>) => admin.from('audit_logs').insert({ tenant_id: null, actor_id: caller.id, action: event, resource_type: 'platform_user', resource_id: id, metadata })

    if (action === 'list') {
      const [{ data: roles, error: rolesError }, { data: authData, error: authError }] = await Promise.all([admin.from('platform_access_roles').select('user_id, role, is_active, profiles!inner(full_name, is_active)').order('created_at'), admin.auth.admin.listUsers({ page: 1, perPage: 1000 })])
      if (rolesError || authError) return respond({ error: 'Não foi possível carregar a equipe da plataforma.' }, 500, headers)
      const emails = new Map((authData.users ?? []).map((user) => [user.id, user.email ?? '']))
      return respond({ users: (roles ?? []).map((row: any) => ({ id: row.user_id, role: row.role, isActive: row.is_active && row.profiles.is_active, fullName: row.profiles.full_name ?? 'Nome não informado', email: emails.get(row.user_id) ?? '' })) }, 200, headers)
    }

    if (action === 'create') {
      const fullName = String(body.fullName ?? '').trim(), email = String(body.email ?? '').trim().toLowerCase(), role = String(body.role ?? 'operator'), initialPassword = String(body.password ?? '')
      if (!fullName || !email.includes('@') || initialPassword.length < 12 || !['owner', 'operator'].includes(role)) return respond({ error: 'Informe nome, e-mail, senha de 12 caracteres e perfil válido.' }, 400, headers)
      const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password: initialPassword, email_confirm: true, user_metadata: { full_name: fullName } })
      if (createError || !created.user) return respond({ error: createError?.message ?? 'Não foi possível criar o usuário.' }, 400, headers)
      const id = created.user.id
      const { error: profileError } = await admin.from('profiles').upsert({ id, full_name: fullName, platform_role: 'netsecbr_admin', is_active: true, must_change_password: true, password_changed_at: null }, { onConflict: 'id' })
      const { error: roleError } = profileError ? { error: profileError } : await admin.from('platform_access_roles').insert({ user_id: id, role, is_active: true })
      if (roleError) { await admin.auth.admin.deleteUser(id); return respond({ error: 'Não foi possível concluir o cadastro da equipe.' }, 500, headers) }
      await audit('platform_user_created', id, { full_name: fullName, email, role })
      return respond({ success: true, user: { id, fullName, email, role } }, 201, headers)
    }

    const userId = String(body.userId ?? '')
    if (!userId || userId === caller.id) return respond({ error: 'Você não pode alterar o próprio acesso neste painel.' }, 400, headers)
    if (action === 'update_access') {
      const role = String(body.role ?? ''), isActive = body.isActive === true
      if (!['owner', 'operator'].includes(role)) return respond({ error: 'Perfil inválido.' }, 400, headers)
      const { error } = await admin.from('platform_access_roles').update({ role, is_active: isActive }).eq('user_id', userId)
      if (error) return respond({ error: error.message }, 400, headers)
      await audit('platform_user_access_updated', userId, { role, is_active: isActive }); return respond({ success: true }, 200, headers)
    }
    if (action === 'set_temporary_password') {
      const nextPassword = body.mode === 'manual' ? String(body.password ?? '') : password()
      if (nextPassword.length < 12) return respond({ error: 'A senha temporária deve ter pelo menos 12 caracteres.' }, 400, headers)
      const { error } = await admin.auth.admin.updateUserById(userId, { password: nextPassword })
      if (error) return respond({ error: 'Não foi possível redefinir a senha.' }, 400, headers)
      await admin.from('profiles').update({ must_change_password: true, password_changed_at: null }).eq('id', userId)
      await audit('platform_user_temporary_password_reset', userId, { mode: body.mode === 'manual' ? 'manual' : 'generated' })
      return respond({ success: true, temporaryPassword: body.mode === 'manual' ? undefined : nextPassword }, 200, headers)
    }
    return respond({ error: 'Ação inválida.' }, 400, headers)
  } catch { return respond({ error: 'Ocorreu um erro inesperado ao administrar a equipe.' }, 500, headers) }
})
