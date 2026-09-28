import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean)

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

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get('origin'))

  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return response({ error: 'Método não permitido.' }, 405, headers)

  let action = ''

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
    action = String(body.action ?? '')

    // Ação somente de leitura: retorna apenas os e-mails dos membros do tenant
    // solicitado, para administradores autorizados. Nunca expõe senha, token,
    // metadados sensíveis ou usuários de outros tenants.
    if (action === 'list_tenant_user_emails') {
      const listTenantId = String(body.tenantId ?? '')
      if (!listTenantId) return response({ error: 'Cliente é obrigatório.' }, 400, headers)

      const admin = createClient(supabaseUrl, serviceRoleKey)
      const [
        { data: profileRow, error: profileError },
        { data: membershipRow, error: membershipError },
        { data: platformAccessRow, error: platformAccessError },
      ] = await Promise.all([
        admin
          .from('profiles')
          .select('platform_role, is_active')
          .eq('id', caller.id)
          .maybeSingle(),
        admin
          .from('tenant_memberships')
          .select('id')
          .eq('tenant_id', listTenantId)
          .eq('user_id', caller.id)
          .eq('role', 'tenant_admin')
          .eq('is_active', true)
          .maybeSingle(),
        admin
          .from('platform_access_roles')
          .select('user_id')
          .eq('user_id', caller.id)
          .in('role', ['owner', 'operator'])
          .eq('is_active', true)
          .maybeSingle(),
      ])

      if (profileError || membershipError || platformAccessError) {
        return response({ error: 'Não foi possível validar a sua permissão.' }, 500, headers)
      }

      const isNetsecbrAdmin = profileRow?.platform_role === 'netsecbr_admin' && profileRow.is_active && Boolean(platformAccessRow)
      if (!isNetsecbrAdmin && !membershipRow) {
        return response({ error: 'Você não tem permissão para ver os e-mails deste cliente.' }, 403, headers)
      }

      const { data: members, error: membersError } = await admin
        .from('tenant_memberships')
        .select('user_id')
        .eq('tenant_id', listTenantId)
      if (membersError) {
        return response({ error: 'Não foi possível carregar os usuários do cliente.' }, 500, headers)
      }

      const emails: Record<string, string> = {}
      await Promise.all(
        (members ?? []).map(async (member: { user_id: string }) => {
          const { data: authData, error: authError } = await admin.auth.admin.getUserById(member.user_id)
          const resolvedEmail = authData?.user?.email
          if (!authError && resolvedEmail) emails[member.user_id] = resolvedEmail
        }),
      )

      // Nomes dos membros pelo cliente server-side (service role): o administrador
      // do tenant não consegue ler profiles de outros membros pela RLS, então o
      // mapa de nomes é montado aqui. Retorna apenas userId -> full_name (ou null)
      // dos membros do tenant solicitado — nunca senha, token, metadados sensíveis
      // ou dados de outros tenants.
      const memberIds = (members ?? []).map((member) => member.user_id)
      const fullNames: Record<string, string | null> = {}
      for (const userId of memberIds) fullNames[userId] = null

      if (memberIds.length > 0) {
        const { data: profileRows, error: profileListError } = await admin
          .from('profiles')
          .select('id, full_name')
          .in('id', memberIds)

        if (profileListError) {
          return response({ error: 'Não foi possível carregar os nomes dos usuários.' }, 500, headers)
        }

        for (const profile of profileRows ?? []) {
          fullNames[profile.id] = profile.full_name ?? null
        }
      }

      return response({ emails, fullNames }, 200, headers)
    }

    // Atualização do nome de um membro do tenant. Altera SOMENTE
    // public.profiles.full_name pelo cliente server-side (a RLS impede o
    // tenant_admin de escrever diretamente em profiles de outros membros).
    // Não toca em e-mail, senha, platform_role, is_active global ou outros campos.
    if (action === 'update_tenant_user_name') {
      const targetTenantId = String(body.tenantId ?? '')
      const targetUserId = String(body.userId ?? '')
      const nextFullName = String(body.fullName ?? '').trim()

      if (!targetTenantId) return response({ error: 'Cliente é obrigatório.' }, 400, headers)
      if (!targetUserId) return response({ error: 'Usuário é obrigatório.' }, 400, headers)
      if (!nextFullName) return response({ error: 'Informe o nome do usuário.' }, 400, headers)
      if (nextFullName.length > 120) return response({ error: 'O nome deve ter no máximo 120 caracteres.' }, 400, headers)

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
      const [
        { data: callerProfile, error: callerProfileError },
        { data: callerMembership, error: membershipError },
        { data: callerPlatformAccess, error: platformAccessError },
      ] = await Promise.all([
        supabaseAdmin
          .from('profiles')
          .select('platform_role, is_active')
          .eq('id', caller.id)
          .maybeSingle(),
        supabaseAdmin
          .from('tenant_memberships')
          .select('id')
          .eq('tenant_id', targetTenantId)
          .eq('user_id', caller.id)
          .eq('role', 'tenant_admin')
          .eq('is_active', true)
          .maybeSingle(),
        supabaseAdmin
          .from('platform_access_roles')
          .select('user_id')
          .eq('user_id', caller.id)
          .in('role', ['owner', 'operator'])
          .eq('is_active', true)
          .maybeSingle(),
      ])

      if (callerProfileError || membershipError || platformAccessError) {
        return response({ error: 'Não foi possível validar o seu perfil.' }, 500, headers)
      }

      const isNetsecbrAdmin = callerProfile?.platform_role === 'netsecbr_admin' && callerProfile.is_active && Boolean(callerPlatformAccess)
      if (!isNetsecbrAdmin && !callerMembership) {
        return response({ error: 'Você não tem permissão para alterar nomes de usuários neste cliente.' }, 403, headers)
      }

      const { data: targetMembership, error: targetMembershipError } = await supabaseAdmin
        .from('tenant_memberships')
        .select('id')
        .eq('tenant_id', targetTenantId)
        .eq('user_id', targetUserId)
        .maybeSingle()

      if (targetMembershipError) {
        return response({ error: 'Não foi possível validar o usuário alvo.' }, 500, headers)
      }
      if (!targetMembership) {
        return response({ error: 'Este usuário não pertence a este cliente.' }, 404, headers)
      }

      const { data: currentProfile, error: currentProfileError } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', targetUserId)
        .maybeSingle()

      if (currentProfileError) {
        return response({ error: 'Não foi possível carregar o nome atual do usuário.' }, 500, headers)
      }
      if (!currentProfile) {
        return response({ error: 'Perfil do usuário não encontrado.' }, 404, headers)
      }

      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ full_name: nextFullName })
        .eq('id', targetUserId)
        .select('id')
        .maybeSingle()

      if (updateError || !updatedProfile) {
        return response({ error: 'Não foi possível salvar o nome do usuário.' }, 500, headers)
      }

      const { error: auditError } = await supabaseAdmin.from('audit_logs').insert({
        tenant_id: targetTenantId,
        actor_id: caller.id,
        action: 'tenant_user_name_updated',
        resource_type: 'profile',
        resource_id: targetUserId,
        metadata: { previousFullName: currentProfile.full_name, newFullName: nextFullName },
      })
      if (auditError) console.error('Tenant user name audit could not be recorded', auditError.message)

      return response({ success: true, fullName: nextFullName }, 200, headers)
    }

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

    const [
      { data: callerProfile, error: callerProfileError },
      { data: callerMembership, error: membershipError },
      { data: callerPlatformAccess, error: platformAccessError },
    ] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('platform_role, is_active')
        .eq('id', caller.id)
        .maybeSingle(),
      supabaseAdmin
        .from('tenant_memberships')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_id', caller.id)
        .eq('role', 'tenant_admin')
        .eq('is_active', true)
        .maybeSingle(),
      supabaseAdmin
        .from('platform_access_roles')
        .select('user_id')
        .eq('user_id', caller.id)
        .in('role', ['owner', 'operator'])
        .eq('is_active', true)
        .maybeSingle(),
    ])

    if (callerProfileError || membershipError || platformAccessError) {
      return response({ error: 'Não foi possível validar o seu perfil.' }, 500, headers)
    }

    const isNetsecbrAdmin = callerProfile?.platform_role === 'netsecbr_admin' && callerProfile.is_active && Boolean(callerPlatformAccess)
    if (!isNetsecbrAdmin && !callerMembership) {
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
    return response({
      error: action === 'list_tenant_user_emails'
        ? 'Ocorreu um erro inesperado ao carregar os e-mails.'
        : action === 'update_tenant_user_name'
          ? 'Ocorreu um erro inesperado ao atualizar o nome do usuário.'
          : 'Ocorreu um erro inesperado ao cadastrar o usuário.',
    }, 500, headers)
  }
})
