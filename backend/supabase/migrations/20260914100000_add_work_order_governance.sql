-- V1 MARV: governança operacional das ordens de serviço.
-- Não inclui compras, estoque ou catálogo de peças.

alter table public.work_orders
  add column if not exists diagnosis text,
  add column if not exists root_cause text,
  add column if not exists action_taken text,
  add column if not exists resolution_notes text,
  add column if not exists causes_equipment_downtime boolean not null default false,
  add column if not exists downtime_started_at timestamptz,
  add column if not exists downtime_ended_at timestamptz,
  add column if not exists attendance_started_at timestamptz,
  add column if not exists repair_started_at timestamptz,
  add column if not exists supplier_wait_started_at timestamptz,
  add column if not exists material_wait_started_at timestamptz;

alter table public.work_orders
  add constraint work_orders_downtime_window
  check (
    downtime_ended_at is null
    or (
      downtime_started_at is not null
      and downtime_ended_at >= downtime_started_at
    )
  );

create table public.work_order_costs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  asset_id uuid not null references public.assets(id) on delete restrict,

  cost_type text not null check (
    cost_type in (
      'internal_labor',
      'external_labor',
      'parts',
      'materials',
      'travel',
      'third_party_service',
      'other'
    )
  ),

  description text,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  amount_cents bigint not null check (amount_cents > 0),
  occurred_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_work_order_costs_work_order
  on public.work_order_costs (work_order_id, occurred_at desc);

create index idx_work_order_costs_asset
  on public.work_order_costs (tenant_id, asset_id, occurred_at desc);

create or replace function public.validate_work_order_cost_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  expected_tenant_id uuid;
  expected_asset_id uuid;
begin
  select tenant_id, asset_id
    into expected_tenant_id, expected_asset_id
  from public.work_orders
  where id = new.work_order_id;

  if expected_tenant_id is null then
    raise exception 'Ordem de serviço inválida para lançamento de custo.';
  end if;

  if new.tenant_id <> expected_tenant_id then
    raise exception 'O custo deve pertencer ao mesmo cliente da ordem de serviço.';
  end if;

  if expected_asset_id is null or new.asset_id <> expected_asset_id then
    raise exception 'O custo deve ser vinculado ao mesmo ativo da ordem de serviço.';
  end if;

  return new;
end;
$$;

create trigger work_order_costs_validate_scope
  before insert or update of tenant_id, work_order_id, asset_id
  on public.work_order_costs
  for each row
  execute procedure public.validate_work_order_cost_scope();

alter table public.work_order_costs enable row level security;

grant select, insert, update on public.work_order_costs to authenticated;

create policy "work_order_costs_select_operational_tenant"
on public.work_order_costs
for select
to authenticated
using (
  (select public.is_netsecbr_admin())
  or (
    public.is_tenant_member(tenant_id)
    and public.tenant_allows_operation(tenant_id)
  )
);

create policy "work_order_costs_manage_tenant_admin"
on public.work_order_costs
for all
to authenticated
using (
  (select public.is_netsecbr_admin())
  or (
    public.is_tenant_admin(tenant_id)
    and public.tenant_allows_operation(tenant_id)
  )
)
with check (
  (select public.is_netsecbr_admin())
  or (
    public.is_tenant_admin(tenant_id)
    and public.tenant_allows_operation(tenant_id)
  )
);