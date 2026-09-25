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
      const [{ data: roles, error: rolesError }, { data: authData, error: authError }] = await Promise.all([
        admin.from('platform_access_roles').select('user_id, role, is_active, created_at, profiles!inner(full_name, is_active)').order('created_at'),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ])
      if (rolesError || authError) return respond({ error: 'Não foi possível carregar a equipe da plataforma.' }, 500, headers)
      const emails = new Map((authData.users ?? []).map((user) => [user.id, user.email ?? '']))
      return respond({
        users: (roles ?? []).map((row: any) => ({
          id: row.user_id,
          role: row.role,
          isActive: row.is_active && row.profiles.is_active,
          fullName: row.profiles.full_name ?? 'Nome não informado',
          email: emails.get(row.user_id) ?? '',
          createdAt: row.created_at ?? null,
        })),
      }, 200, headers)
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

    if (action === 'link_existing') {
      const email = String(body.email ?? '').trim().toLowerCase(), role = String(body.role ?? 'operator')
      if (!email.includes('@') || !['owner', 'operator'].includes(role)) return respond({ error: 'Informe um e-mail existente e um perfil válido.' }, 400, headers)
      const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (authError) return respond({ error: 'Não foi possível localizar o usuário informado.' }, 500, headers)
      const existingUser = (authData.users ?? []).find((user) => user.email?.toLowerCase() === email)
      if (!existingUser) return respond({ error: 'Não existe uma conta cadastrada com este e-mail. Use “Novo usuário da plataforma”.' }, 404, headers)
      const { data: profile, error: profileLookupError } = await admin.from('profiles').select('id, full_name, is_active').eq('id', existingUser.id).maybeSingle()
      if (profileLookupError || !profile) return respond({ error: 'A conta encontrada não possui um perfil válido no MARV.' }, 400, headers)
      if (!profile.is_active) return respond({ error: 'A conta encontrada está inativa e não pode receber acesso à plataforma.' }, 400, headers)
      const { error: profileError } = await admin.from('profiles').update({ platform_role: 'netsecbr_admin' }).eq('id', existingUser.id)
      const { error: roleError } = profileError ? { error: profileError } : await admin.from('platform_access_roles').upsert({ user_id: existingUser.id, role, is_active: true }, { onConflict: 'user_id' })
      if (roleError) return respond({ error: 'Não foi possível vincular o usuário à equipe da plataforma.' }, 500, headers)
      await audit('platform_user_linked', existingUser.id, { email, role })
      return respond({ success: true, user: { id: existingUser.id, fullName: profile.full_name ?? 'Nome não informado', email, role } }, 200, headers)
    }

    const userId = String(body.userId ?? '')
    if (!userId || userId === caller.id) return respond({ error: 'Você não pode alterar o próprio acesso neste painel.' }, 400, headers)

    if (action === 'update_identity') {
      const fullName = String(body.fullName ?? '').trim()
      const email = String(body.email ?? '').trim().toLowerCase()
      const role = String(body.role ?? '')
      const isActive = body.isActive === true

      if (!fullName) return respond({ error: 'O nome completo é obrigatório.' }, 400, headers)
      if (!email.includes('@')) return respond({ error: 'Informe um e-mail válido.' }, 400, headers)
      if (!['owner', 'operator'].includes(role)) return respond({ error: 'Perfil inválido.' }, 400, headers)

      // 1. Obter estado atual do usuário alvo
      const [{ data: targetRole, error: targetRoleError }, { data: targetAuthUser, error: targetAuthError }] = await Promise.all([
        admin.from('platform_access_roles').select('role, is_active, profiles!inner(full_name, is_active, platform_role)').eq('user_id', userId).maybeSingle(),
        admin.auth.admin.getUserById(userId),
      ])

      if (targetRoleError || !targetRole) return respond({ error: 'Usuário da plataforma não encontrado.' }, 404, headers)
      if (targetAuthError || !targetAuthUser.user) return respond({ error: 'Conta de autenticação não encontrada.' }, 404, headers)

      const targetProfile = targetRole.profiles as unknown as { full_name: string | null; is_active: boolean; platform_role: string | null }
      const currentRole = targetRole.role
      const currentActive = targetRole.is_active && targetProfile.is_active
      const currentFullName = targetProfile.full_name ?? ''
      const currentEmail = targetAuthUser.user.email?.toLowerCase() ?? ''

      // 2. Proteger último Proprietário ativo se houver rebaixamento ou desativação
      const isTargetActiveOwner = currentRole === 'owner' && currentActive
      const willBeActiveOwner = role === 'owner' && isActive
      if (isTargetActiveOwner && !willBeActiveOwner) {
        const { data: activeOwners, error: countError } = await admin
          .from('platform_access_roles')
          .select('user_id, profiles!inner(platform_role, is_active)')
          .eq('role', 'owner')
          .eq('is_active', true)

        if (countError) return respond({ error: 'Não foi possível validar as permissões de Proprietário.' }, 500, headers)
        const validActiveOwners = (activeOwners ?? []).filter((row: any) => row.profiles?.platform_role === 'netsecbr_admin' && row.profiles?.is_active)
        if (validActiveOwners.length <= 1) {
          return respond({ error: 'A plataforma precisa de pelo menos um Proprietário ativo. Promova ou ative outro Proprietário antes de alterar este.' }, 400, headers)
        }
      }

      // 3. Atualizar e-mail via Auth Admin API caso tenha mudado
      const emailChanged = email !== currentEmail
      if (emailChanged) {
        const { error: emailUpdateError } = await admin.auth.admin.updateUserById(userId, {
          email,
          email_confirm: true,
        })
        if (emailUpdateError) {
          return respond({ error: `Não foi possível atualizar o e-mail: ${emailUpdateError.message}` }, 400, headers)
        }
      }

      // 4. Atualizar profile (full_name, is_active, platform_role)
      const { error: profileUpdateError } = await admin
        .from('profiles')
        .update({
          full_name: fullName,
          is_active: isActive,
          platform_role: 'netsecbr_admin',
        })
        .eq('id', userId)

      if (profileUpdateError) {
        if (emailChanged) {
          const { error: rollbackEmailError } = await admin.auth.admin.updateUserById(userId, {
            email: currentEmail,
            email_confirm: true,
          })
          if (rollbackEmailError) return respond({ error: 'Não foi possível atualizar o perfil e a reversão do e-mail falhou. Contate o suporte da plataforma.' }, 500, headers)
        }
        return respond({ error: `Não foi possível atualizar os dados do perfil: ${profileUpdateError.message}` }, 400, headers)
      }

      // 5. Atualizar platform_access_roles (role, is_active)
      const { error: roleUpdateError } = await admin
        .from('platform_access_roles')
        .update({
          role,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (roleUpdateError) {
        const { error: rollbackProfileError } = await admin
          .from('profiles')
          .update({
            full_name: currentFullName,
            is_active: targetProfile.is_active,
            platform_role: targetProfile.platform_role,
          })
          .eq('id', userId)
        const { error: rollbackEmailError } = emailChanged
          ? await admin.auth.admin.updateUserById(userId, { email: currentEmail, email_confirm: true })
          : { error: null }
        if (rollbackProfileError || rollbackEmailError) return respond({ error: 'Não foi possível concluir a alteração e a reversão parcial falhou. Contate o suporte da plataforma.' }, 500, headers)
        return respond({ error: `Não foi possível atualizar o papel do usuário: ${roleUpdateError.message}` }, 400, headers)
      }

      // 6. Auditoria com autor, alvo, ação e valores anterior/novo
      await audit('platform_user_identity_updated', userId, {
        previous: {
          fullName: currentFullName,
          emailChanged: false,
          role: currentRole,
          isActive: currentActive,
        },
        next: {
          fullName,
          emailChanged,
          role,
          isActive,
        },
      })

      return respond({ success: true, emailChanged }, 200, headers)
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
