import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedOrigins = ['http://localhost:5173']

function corsHeaders(origin: string | null) {
  const allowedOrigin = allowedOrigins.includes(origin ?? '')
    ? origin!
    : allowedOrigins[0]

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
}

function response(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers })
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
    const tenantId = String(body.tenantId ?? '')
    const fullName = String(body.fullName ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const role = String(body.role ?? 'navigation')
    const emailDomain = email.split('@').pop() ?? ''

    if (!tenantId || !fullName || !email || !password) {
      return response({ error: 'Nome, e-mail, senha e cliente são obrigatórios.' }, 400, headers)
    }
    if (!email.includes('@') || !emailDomain) return response({ error: 'Informe um e-mail válido.' }, 400, headers)
    if (password.length < 12) return response({ error: 'A senha inicial deve ter pelo menos 12 caracteres.' }, 400, headers)
    if (!['tenant_admin', 'navigation'].includes(role)) return response({ error: 'Perfil de usuário inválido.' }, 400, headers)

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const { data: allowedEmailDomain, error: allowedDomainError } = await supabaseAdmin
      .from('tenant_email_domains')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('domain', emailDomain)
      .eq('is_active', true)
      .maybeSingle()

    if (allowedDomainError) return response({ error: 'Não foi possível validar o domínio de e-mail.' }, 500, headers)
    if (!allowedEmailDomain) return response({ error: `O domínio @${emailDomain} não está autorizado para este cliente.` }, 400, headers)

    const { data: callerMembership, error: membershipError } = await supabaseAdmin
      .from('tenant_memberships')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', caller.id)
      .eq('role', 'tenant_admin')
      .eq('is_active', true)
      .maybeSingle()

    if (membershipError || !callerMembership) {
      return response({ error: 'Você não tem permissão para cadastrar usuários neste cliente.' }, 403, headers)
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (createError || !created.user) return response({ error: createError?.message ?? 'Não foi possível criar o usuário.' }, 400, headers)

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: created.user.id,
      full_name: fullName,
      must_change_password: true,
      password_changed_at: null,
    }, { onConflict: 'id' })
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id)
      return response({ error: 'Não foi possível criar o perfil interno do usuário.' }, 500, headers)
    }

    const { error: newMembershipError } = await supabaseAdmin.from('tenant_memberships').insert({
      tenant_id: tenantId,
      user_id: created.user.id,
      role,
      is_active: true,
    })
    if (newMembershipError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id)
      return response({ error: 'Não foi possível vincular o usuário ao cliente.' }, 500, headers)
    }

    return response({ success: true, user: { id: created.user.id, fullName, email, role } }, 201, headers)
  } catch {
    return response({ error: 'Ocorreu um erro inesperado ao cadastrar o usuário.' }, 500, headers)
  }
})
