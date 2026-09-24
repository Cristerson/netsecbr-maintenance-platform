-- Command Center: criação e substituição transacional de contratos por cliente.
-- SECURITY INVOKER preserva as RLS existentes; a autorização é validada no banco.
-- Os snapshots do plano são copiados na criação e não voltam a ser editáveis.

create or replace function public.create_command_center_subscription(
  target_tenant_id uuid,
  target_plan_id uuid,
  target_status text,
  target_contract_start_date date,
  target_billing_start_date date,
  target_contract_end_date date,
  target_trial_ends_at timestamptz default null,
  target_payment_provider text default null,
  target_payment_customer_reference text default null,
  target_notes text default null,
  replacement_reason text default null
)
returns table (subscription_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_plan public.subscription_plans%rowtype;
  previous_contract public.subscriptions%rowtype;
  has_previous boolean := false;
  new_contract_id uuid;
  normalized_reason text := nullif(btrim(replacement_reason), '');
begin
  if actor_id is null or not public.is_netsecbr_admin() then
    raise exception 'Acesso negado ao Command Center.';
  end if;

  if target_status not in ('draft', 'trial', 'active') then
    raise exception 'Situação de contrato inválida.';
  end if;

  if target_contract_start_date is null
     or target_billing_start_date is null
     or target_contract_end_date is null then
    raise exception 'Informe o início, o início de cobrança e o fim da vigência.';
  end if;

  if target_contract_end_date <= target_contract_start_date then
    raise exception 'A data final da vigência deve ser posterior à data de início.';
  end if;

  if target_billing_start_date < target_contract_start_date then
    raise exception 'A cobrança não pode começar antes do início do contrato.';
  end if;

  if target_contract_end_date < (target_contract_start_date + interval '12 months')::date then
    raise exception 'A vigência mínima do contrato é de 12 meses.';
  end if;

  if target_status = 'trial' then
    if target_trial_ends_at is null then
      raise exception 'Informe a data final da degustação.';
    end if;
    if target_trial_ends_at::date < target_contract_start_date
       or target_trial_ends_at::date > target_contract_end_date then
      raise exception 'A degustação deve terminar dentro da vigência do contrato.';
    end if;
  elsif target_trial_ends_at is not null then
    raise exception 'A data de degustação só se aplica a contratos em degustação.';
  end if;

  if not exists (select 1 from public.tenants where id = target_tenant_id) then
    raise exception 'Cliente não encontrado.';
  end if;

  select * into selected_plan
  from public.subscription_plans
  where id = target_plan_id;

  if not found then
    raise exception 'Plano comercial não encontrado.';
  end if;

  if not selected_plan.is_active then
    raise exception 'Selecione um plano comercial ativo.';
  end if;

  select * into previous_contract
  from public.subscriptions
  where tenant_id = target_tenant_id
    and status in ('draft', 'trial', 'active')
  for update;

  has_previous := found;

  if has_previous and normalized_reason is null then
    raise exception 'Informe o motivo da substituição do contrato vigente.';
  end if;

  if has_previous then
    update public.subscriptions
    set status = 'cancelled',
        updated_at = now()
    where id = previous_contract.id;
  end if;

  insert into public.subscriptions (
    tenant_id, plan_id, plan_name_snapshot, robot_limit_snapshot,
    annual_price_cents_snapshot, included_storage_bytes_snapshot,
    status, contract_start_date, billing_start_date, contract_end_date,
    trial_ends_at, payment_provider, payment_customer_reference, notes
  )
  values (
    target_tenant_id, selected_plan.id, selected_plan.name, selected_plan.robot_limit,
    selected_plan.annual_price_cents, selected_plan.included_storage_bytes,
    target_status, target_contract_start_date, target_billing_start_date,
    target_contract_end_date, target_trial_ends_at,
    nullif(btrim(target_payment_provider), ''),
    nullif(btrim(target_payment_customer_reference), ''),
    nullif(btrim(target_notes), '')
  )
  returning id into new_contract_id;

  -- Auditoria na mesma transação: autor, horário, contratos e motivo.
  insert into public.audit_logs (tenant_id, actor_id, action, resource_type, resource_id, metadata)
  values (
    target_tenant_id,
    actor_id,
    case when has_previous then 'subscription_replaced' else 'subscription_created' end,
    'subscription',
    new_contract_id::text,
    jsonb_build_object(
      'previous_contract_id', case when has_previous then previous_contract.id::text else null end,
      'previous_contract_status', case when has_previous then previous_contract.status else null end,
      'new_contract_id', new_contract_id::text,
      'new_status', target_status,
      'plan_id', selected_plan.id::text,
      'plan_name', selected_plan.name,
      'reason', normalized_reason
    )
  );

  return query select new_contract_id;
end;
$$;

revoke all on function public.create_command_center_subscription(uuid, uuid, text, date, date, date, timestamptz, text, text, text, text) from public;
revoke all on function public.create_command_center_subscription(uuid, uuid, text, date, date, date, timestamptz, text, text, text, text) from anon;
grant execute on function public.create_command_center_subscription(uuid, uuid, text, date, date, date, timestamptz, text, text, text, text) to authenticated;

-- Auditoria de planos comerciais: toda criação, edição ou mudança de situação
-- passa por esta RPC e registra autor, antes/depois e horário no audit_logs.
create or replace function public.save_command_center_subscription_plan(
  target_plan_id uuid,
  target_name text,
  target_robot_limit integer,
  target_annual_price_cents integer,
  target_included_storage_bytes bigint,
  target_description text default null,
  target_is_active boolean default true
)
returns table (subscription_plan_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  previous_plan public.subscription_plans%rowtype;
  saved_plan public.subscription_plans%rowtype;
  has_previous boolean := false;
  status_only_change boolean := false;
  normalized_name text := nullif(btrim(target_name), '');
  normalized_description text := nullif(btrim(target_description), '');
  audit_action text;
begin
  if actor_id is null or not public.is_netsecbr_admin() then
    raise exception 'Acesso negado ao Command Center.';
  end if;

  if normalized_name is null then
    raise exception 'Informe o nome do plano comercial.';
  end if;

  if target_robot_limit is null or target_robot_limit < 0 then
    raise exception 'O limite de robôs deve ser igual ou maior que zero.';
  end if;

  if target_annual_price_cents is null or target_annual_price_cents < 0 then
    raise exception 'O valor anual deve ser igual ou maior que zero.';
  end if;

  if target_included_storage_bytes is null or target_included_storage_bytes < 0 then
    raise exception 'O armazenamento incluído deve ser igual ou maior que zero.';
  end if;

  if target_is_active is null then
    raise exception 'Informe a situação do plano comercial.';
  end if;

  if exists (
    select 1
    from public.subscription_plans
    where name = normalized_name
      and (target_plan_id is null or id <> target_plan_id)
  ) then
    raise exception 'Já existe um plano comercial com este nome.';
  end if;

  if target_plan_id is not null then
    select * into previous_plan
    from public.subscription_plans
    where id = target_plan_id
    for update;

    if not found then
      raise exception 'Plano comercial não encontrado.';
    end if;

    has_previous := true;
    status_only_change :=
      previous_plan.is_active is distinct from target_is_active
      and previous_plan.name is not distinct from normalized_name
      and previous_plan.robot_limit is not distinct from target_robot_limit
      and previous_plan.annual_price_cents is not distinct from target_annual_price_cents
      and previous_plan.included_storage_bytes is not distinct from target_included_storage_bytes
      and previous_plan.description is not distinct from normalized_description;
  end if;

  if has_previous then
    update public.subscription_plans
    set name = normalized_name,
        robot_limit = target_robot_limit,
        annual_price_cents = target_annual_price_cents,
        included_storage_bytes = target_included_storage_bytes,
        description = normalized_description,
        is_active = target_is_active,
        updated_at = now()
    where id = target_plan_id
    returning * into saved_plan;
  else
    insert into public.subscription_plans (
      name, robot_limit, annual_price_cents, included_storage_bytes, description, is_active
    )
    values (
      normalized_name, target_robot_limit, target_annual_price_cents,
      target_included_storage_bytes, normalized_description, target_is_active
    )
    returning * into saved_plan;
  end if;

  audit_action := case
    when not has_previous then 'subscription_plan_created'
    when status_only_change then 'subscription_plan_status_changed'
    else 'subscription_plan_updated'
  end;

  -- tenant_id é NULL por ser um catálogo global; a policy de insert do audit_logs
  -- aceita o administrador NETSECBR autenticado (actor_id = auth.uid()).
  insert into public.audit_logs (tenant_id, actor_id, action, resource_type, resource_id, metadata)
  values (
    null,
    actor_id,
    audit_action,
    'subscription_plan',
    saved_plan.id::text,
    jsonb_build_object(
      'previous', case when has_previous then jsonb_build_object(
        'name', previous_plan.name,
        'robot_limit', previous_plan.robot_limit,
        'annual_price_cents', previous_plan.annual_price_cents,
        'included_storage_bytes', previous_plan.included_storage_bytes,
        'description', previous_plan.description,
        'is_active', previous_plan.is_active
      ) else null end,
      'current', jsonb_build_object(
        'name', saved_plan.name,
        'robot_limit', saved_plan.robot_limit,
        'annual_price_cents', saved_plan.annual_price_cents,
        'included_storage_bytes', saved_plan.included_storage_bytes,
        'description', saved_plan.description,
        'is_active', saved_plan.is_active
      )
    )
  );

  return query select saved_plan.id;
end;
$$;

revoke all on function public.save_command_center_subscription_plan(uuid, text, integer, integer, bigint, text, boolean) from public;
revoke all on function public.save_command_center_subscription_plan(uuid, text, integer, integer, bigint, text, boolean) from anon;
grant execute on function public.save_command_center_subscription_plan(uuid, text, integer, integer, bigint, text, boolean) to authenticated;

