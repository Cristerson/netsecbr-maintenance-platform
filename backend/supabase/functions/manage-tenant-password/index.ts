import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0]

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  }
}

function response(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers })
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*'
  const values = crypto.getRandomValues(new Uint32Array(18))
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('')
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get('origin'))

  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return response({ error: 'Método não permitido.' }, 405, headers)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return response({ error: 'Usuário não autenticado.' }, 401, headers)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: { user: caller }, error: callerError } = await supabaseUser.auth.getUser()
    if (callerError || !caller) return response({ error: 'Sessão inválida.' }, 401, headers)

    const body = await request.json()
    const action = String(body.action ?? '')
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    if (action === 'complete') {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ must_change_password: false, password_changed_at: new Date().toISOString() })
        .eq('id', caller.id)

      if (error) return response({ error: 'Não foi possível concluir a troca de senha.' }, 500, headers)
      return response({ success: true }, 200, headers)
    }

    const tenantId = String(body.tenantId ?? '')
    const userId = String(body.userId ?? '')
    if (!tenantId || !userId) return response({ error: 'Cliente e usuário são obrigatórios.' }, 400, headers)

    const [{ data: callerProfile, error: callerProfileError }, { data: callerMembership, error: callerMembershipError }, { data: targetMembership, error: targetMembershipError }] = await Promise.all([
      supabaseAdmin.from('profiles').select('platform_role, is_active').eq('id', caller.id).maybeSingle(),
      supabaseAdmin.from('tenant_memberships').select('id').eq('tenant_id', tenantId).eq('user_id', caller.id).eq('role', 'tenant_admin').eq('is_active', true).maybeSingle(),
      supabaseAdmin.from('tenant_memberships').select('id').eq('tenant_id', tenantId).eq('user_id', userId).eq('is_active', true).maybeSingle(),
    ])

    if (callerProfileError || callerMembershipError || targetMembershipError) {
      return response({ error: 'Não foi possível validar a permissão para redefinir a senha.' }, 500, headers)
    }

    const isNetsecbrAdmin = callerProfile?.platform_role === 'netsecbr_admin' && callerProfile.is_active
    if (!isNetsecbrAdmin && !callerMembership) return response({ error: 'Você não tem permissão para redefinir senhas neste cliente.' }, 403, headers)
    if (!targetMembership) return response({ error: 'Usuário ativo não encontrado neste cliente.' }, 404, headers)

    if (action === 'request') {
      const { data: targetUser, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (targetUserError || !targetUser.user?.email) return response({ error: 'Não foi possível localizar o e-mail do usuário.' }, 404, headers)

      const redirectTo = String(body.redirectTo ?? '')
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(targetUser.user.email, redirectTo ? { redirectTo } : undefined)
      if (error) return response({ error: 'Não foi possível enviar o e-mail de recuperação.' }, 500, headers)
      return response({ success: true }, 200, headers)
    }

    if (action !== 'set_temporary') return response({ error: 'Ação de senha inválida.' }, 400, headers)

    const mode = String(body.mode ?? 'generated')
    const password = mode === 'generated' ? generateTemporaryPassword() : String(body.password ?? '')
    if (!['generated', 'manual'].includes(mode)) return response({ error: 'Modo de senha temporária inválido.' }, 400, headers)
    if (password.length < 12) return response({ error: 'A senha temporária deve ter pelo menos 12 caracteres.' }, 400, headers)

    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
    if (passwordError) return response({ error: 'Não foi possível redefinir a senha temporária.' }, 500, headers)

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ must_change_password: true, password_changed_at: null })
      .eq('id', userId)
    if (profileError) return response({ error: 'Senha redefinida, mas não foi possível exigir a troca no próximo acesso.' }, 500, headers)

    const { error: auditError } = await supabaseAdmin.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: caller.id,
      action: 'temporary_password_reset',
      resource_type: 'profile',
      resource_id: userId,
      metadata: { mode },
    })
    if (auditError) console.error('Password reset audit could not be recorded', auditError.message)

    return response({ success: true, temporaryPassword: mode === 'generated' ? password : undefined }, 200, headers)
  } catch {
    return response({ error: 'Ocorreu um erro inesperado ao redefinir a senha.' }, 500, headers)
  }
})
