-- CC-ATENDIMENTO-02: tratamento interno de chamados NETSECBR no Command Center.
-- Evolui public.support_tickets com resolução, cria RPCs de agentes e de
-- atualização via SECURITY DEFINER e remove UPDATE direto do frontend.

-- 1. Colunas de resolução (somente se ainda não existirem, sem apagar dados).
alter table public.support_tickets
  add column if not exists resolution_note text;

alter table public.support_tickets
  add column if not exists resolved_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'support_tickets'
      and column_name = 'resolved_by'
  ) then
    alter table public.support_tickets
      add column resolved_by uuid references public.profiles(id);
  end if;
end;
$$;

-- 2. Segurança de escrita: o frontend não pode fazer .update() direto.
-- Preserva SELECT e INSERT necessários ao fluxo do cliente; atualizações
-- internas ocorrem exclusivamente pela RPC nova abaixo.
revoke all on public.support_tickets from authenticated;
grant select, insert on public.support_tickets to authenticated;

-- 3. RPC de agentes elegíveis (usuários ativos da equipe da plataforma).
create or replace function public.get_command_center_support_agents()
returns table (
  user_id uuid,
  full_name text,
  role text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    role_row.user_id,
    profile_row.full_name,
    role_row.role
  from public.platform_access_roles role_row
  join public.profiles profile_row on profile_row.id = role_row.user_id
  where (
    select public.is_netsecbr_admin()
  )
    and auth.uid() is not null
    and role_row.is_active = true
    and profile_row.is_active = true
    and profile_row.platform_role = 'netsecbr_admin'
  order by profile_row.full_name nulls last, role_row.user_id;
$$;

revoke all on function public.get_command_center_support_agents() from public;
revoke all on function public.get_command_center_support_agents() from anon;
grant execute on function public.get_command_center_support_agents() to authenticated;

-- 4. RPC de tratamento interno do chamado.
create or replace function public.update_command_center_support_ticket(
  target_ticket_id uuid,
  target_status text,
  target_priority text,
  target_assigned_to uuid,
  target_resolution_note text
)
returns table (ticket_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  current_row public.support_tickets%rowtype;
  normalized_status text := nullif(btrim(target_status), '');
  normalized_priority text := nullif(btrim(target_priority), '');
  normalized_note text := nullif(btrim(target_resolution_note), '');
  agent_exists boolean := false;
  response_changed boolean := false;
begin
  if actor_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.is_netsecbr_admin() then
    raise exception 'Acesso restrito à equipe NETSECBR.';
  end if;

  if target_ticket_id is null then
    raise exception 'Chamado não informado.';
  end if;

  if normalized_status is null
     or normalized_status not in ('open', 'in_progress', 'resolved', 'closed') then
    raise exception 'Situação inválida.';
  end if;

  if normalized_priority is null
     or normalized_priority not in ('low', 'medium', 'high', 'critical') then
    raise exception 'Prioridade inválida.';
  end if;

  if normalized_status in ('resolved', 'closed')
     and (normalized_note is null or char_length(normalized_note) < 10) then
    raise exception 'Informe a resposta/orientação ao cliente com pelo menos 10 caracteres para concluir o chamado.';
  end if;

  select *
    into current_row
    from public.support_tickets
    where id = target_ticket_id
    for update;

  if not found then
    raise exception 'Chamado não encontrado.';
  end if;

  if target_assigned_to is not null then
    select exists (
      select 1
      from public.platform_access_roles role_row
      join public.profiles profile_row on profile_row.id = role_row.user_id
      where role_row.user_id = target_assigned_to
        and role_row.is_active = true
        and profile_row.is_active = true
        and profile_row.platform_role = 'netsecbr_admin'
    ) into agent_exists;

    if not agent_exists then
      raise exception 'Responsável deve ser um usuário ativo da equipe da plataforma.';
    end if;
  end if;

  response_changed := coalesce(current_row.resolution_note, '') <> coalesce(normalized_note, '');

  update public.support_tickets
  set
    status = normalized_status,
    priority = normalized_priority,
    assigned_to = target_assigned_to,
    resolution_note = normalized_note,
    resolved_at = case
      when normalized_status in ('resolved', 'closed') then now()
      else null
    end,
    resolved_by = case
      when normalized_status in ('resolved', 'closed') then actor_id
      else null
    end,
    updated_at = now()
  where id = target_ticket_id;

  insert into public.audit_logs (tenant_id, actor_id, action, resource_type, resource_id, metadata)
  values (
    current_row.tenant_id,
    actor_id,
    'support_ticket_updated',
    'support_ticket',
    target_ticket_id::text,
    jsonb_build_object(
      'status_before', current_row.status,
      'status_after', normalized_status,
      'priority_before', current_row.priority,
      'priority_after', normalized_priority,
      'assigned_to_before', current_row.assigned_to,
      'assigned_to_after', target_assigned_to,
      'response_changed', response_changed
    )
  );

  return query select target_ticket_id;
end;
$$;

revoke all on function public.update_command_center_support_ticket(uuid, text, text, uuid, text) from public;
revoke all on function public.update_command_center_support_ticket(uuid, text, text, uuid, text) from anon;
grant execute on function public.update_command_center_support_ticket(uuid, text, text, uuid, text) to authenticated;
