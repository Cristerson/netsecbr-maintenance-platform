-- V1 MARV: leitura global agregada do MARV Command Center.
-- Somente leitura: nenhuma política global de SELECT é aberta nas tabelas operacionais.
-- O acesso é concedido apenas a profile ativo com platform_role = 'netsecbr_admin'.
-- Execute este arquivo pelo SQL Editor do Supabase.

create or replace function public.get_command_center_overview()
returns table (
  tenant_id uuid,
  legal_name text,
  trade_name text,
  document_number text,
  tenant_status text,
  tenant_created_at timestamptz,
  active_users bigint,
  asset_count bigint,
  open_work_orders bigint,
  overdue_preventive_plans bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Acesso negado ao Command Center.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and platform_role = 'netsecbr_admin'
      and is_active = true
  ) then
    raise exception 'Acesso negado ao Command Center.';
  end if;

  return query
  select
    tenant_row.id,
    tenant_row.legal_name,
    tenant_row.trade_name,
    tenant_row.document_number,
    tenant_row.status,
    tenant_row.created_at,
    coalesce(member_totals.total, 0),
    coalesce(asset_totals.total, 0),
    coalesce(order_totals.total, 0),
    coalesce(plan_totals.total, 0)
  from public.tenants as tenant_row
  left join lateral (
    select count(*) as total
    from public.tenant_memberships as membership
    join public.profiles as member_profile
      on member_profile.id = membership.user_id
    where membership.tenant_id = tenant_row.id
      and membership.is_active = true
      and member_profile.is_active = true
  ) as member_totals on true
  left join lateral (
    select count(*) as total
    from public.assets as asset
    where asset.tenant_id = tenant_row.id
      and asset.deleted_at is null
  ) as asset_totals on true
  left join lateral (
    select count(*) as total
    from public.work_orders as work_order
    where work_order.tenant_id = tenant_row.id
      and work_order.status in ('open', 'in_progress', 'waiting_material')
  ) as order_totals on true
  left join lateral (
    select count(*) as total
    from public.maintenance_plans as plan
    where plan.tenant_id = tenant_row.id
      and plan.is_active = true
      and plan.next_due_date < current_date
  ) as plan_totals on true
  order by tenant_row.trade_name, tenant_row.legal_name;
end;
$$;

revoke all on function public.get_command_center_overview() from public;
revoke all on function public.get_command_center_overview() from anon;
grant execute on function public.get_command_center_overview() to authenticated;
