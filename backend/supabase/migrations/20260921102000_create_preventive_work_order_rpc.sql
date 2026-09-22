-- V1 MARV: geração manual de OS preventiva a partir do plano.
-- Não existe agendador nesta entrega: a geração é uma ação explícita do supervisor no detalhe do plano.
-- A auditoria é registrada automaticamente pelo trigger public.record_work_order_audit_event.

create or replace function public.create_preventive_work_order_from_plan(target_plan_id uuid)
returns table (work_order_id uuid, order_number bigint, next_due_date date)
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row public.maintenance_plans%rowtype;
  asset_row public.assets%rowtype;
  created_work_order_id uuid;
  created_order_number bigint;
  advanced_due_date date;
begin
  select * into plan_row
  from public.maintenance_plans
  where id = target_plan_id
  for update;

  if plan_row.id is null then
    raise exception 'Plano preventivo nao encontrado.';
  end if;

  if not (
    (select public.is_netsecbr_admin())
    or public.is_tenant_admin(plan_row.tenant_id)
  ) then
    raise exception 'Somente o supervisor pode gerar uma OS preventiva.';
  end if;

  if not public.tenant_allows_operation(plan_row.tenant_id) then
    raise exception 'O cliente nao esta liberado para operar manutencao.';
  end if;

  if not plan_row.is_active then
    raise exception 'Somente planos ativos podem gerar uma OS preventiva.';
  end if;

  select * into asset_row
  from public.assets
  where id = plan_row.asset_id
    and deleted_at is null;

  if asset_row.id is null or asset_row.tenant_id <> plan_row.tenant_id then
    raise exception 'O ativo do plano preventivo nao esta disponivel.';
  end if;

  insert into public.work_orders as created_order (
    tenant_id, unit_id, cost_center_id, asset_id, source_maintenance_plan_id,
    title, description, type, priority, status, opened_by, assigned_to, scheduled_for
  ) values (
    plan_row.tenant_id, asset_row.unit_id, asset_row.cost_center_id, asset_row.id,
    plan_row.id,
    plan_row.name,
    'OS preventiva gerada pelo plano ' || plan_row.name || '.',
    'preventive', 'medium', 'open', auth.uid(),
    plan_row.assigned_to, plan_row.next_due_date::timestamptz
  )
  returning created_order.id, created_order.order_number
    into created_work_order_id, created_order_number;

  -- Avança o vencimento a partir da data anterior, sem acumular atraso artificial,
  -- e segue avançando enquanto a data calculada ainda estiver vencida.
  advanced_due_date := plan_row.next_due_date + plan_row.periodicity_days;

  while advanced_due_date <= current_date loop
    advanced_due_date := advanced_due_date + plan_row.periodicity_days;
  end loop;

  update public.maintenance_plans
  set next_due_date = advanced_due_date,
      updated_at = now()
  where id = plan_row.id;

  work_order_id := created_work_order_id;
  order_number := created_order_number;
  next_due_date := advanced_due_date;
  return next;
end;
$$;

revoke all on function public.create_preventive_work_order_from_plan(uuid) from public;
revoke all on function public.create_preventive_work_order_from_plan(uuid) from anon;
grant execute on function public.create_preventive_work_order_from_plan(uuid) to authenticated;
