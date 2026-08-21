-- Entrega 7: ordens de serviço do MVP.
-- Dados operacionais sempre pertencem a um tenant, unidade e centro de custo.

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  cost_center_id uuid not null references public.cost_centers(id) on delete restrict,
  asset_id uuid references public.assets(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 3 and 180),
  description text,
  type text not null default 'corrective'
    check (type in ('corrective', 'preventive', 'predictive', 'emergency', 'improvement')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_material', 'completed', 'cancelled')),
  opened_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  assigned_to uuid references public.profiles(id) on delete restrict,
  opened_at timestamptz not null default now(),
  scheduled_for timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or completed_at >= opened_at)
);

create index idx_work_orders_tenant_opened_at
  on public.work_orders (tenant_id, opened_at desc);
create index idx_work_orders_tenant_status
  on public.work_orders (tenant_id, status);
create index idx_work_orders_asset_id
  on public.work_orders (asset_id)
  where asset_id is not null;

create or replace function public.validate_work_order_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  unit_tenant_id uuid;
  unit_cost_center_id uuid;
  asset_tenant_id uuid;
  asset_unit_id uuid;
  asset_cost_center_id uuid;
begin
  select tenant_id, cost_center_id
    into unit_tenant_id, unit_cost_center_id
  from public.units
  where id = new.unit_id;

  if unit_tenant_id is null
     or new.tenant_id <> unit_tenant_id
     or new.cost_center_id <> unit_cost_center_id then
    raise exception 'Ordem de serviço precisa usar a unidade e o centro de custo do mesmo tenant.';
  end if;

  if new.asset_id is not null then
    select tenant_id, unit_id, cost_center_id
      into asset_tenant_id, asset_unit_id, asset_cost_center_id
    from public.assets
    where id = new.asset_id
      and deleted_at is null;

    if asset_tenant_id is null
       or new.tenant_id <> asset_tenant_id
       or new.unit_id <> asset_unit_id
       or new.cost_center_id <> asset_cost_center_id then
      raise exception 'Ativo da ordem precisa pertencer à mesma unidade e centro de custo.';
    end if;
  end if;

  return new;
end;
$$;

create trigger work_orders_validate_scope
  before insert or update on public.work_orders
  for each row execute procedure public.validate_work_order_scope();

alter table public.work_orders enable row level security;

-- Garante acesso pela Data API mesmo em novos projetos Supabase com exposição restrita.
grant select, insert, update on public.assets to authenticated;
grant select, insert, update on public.work_orders to authenticated;

create policy "work_orders_select_own_operational_tenant"
on public.work_orders for select to authenticated
using (
  (select public.is_netsecbr_admin())
  or (public.is_tenant_member(tenant_id) and public.tenant_allows_operation(tenant_id))
);

-- Usuários de navegação podem abrir OS; a edição ampla continua com o administrador do tenant.
create policy "work_orders_insert_own_operational_tenant"
on public.work_orders for insert to authenticated
with check (
  ((select auth.uid()) = opened_by)
  and (
    (select public.is_netsecbr_admin())
    or (public.is_tenant_member(tenant_id) and public.tenant_allows_operation(tenant_id))
  )
);

create policy "work_orders_update_tenant_admin_or_global_admin"
on public.work_orders for update to authenticated
using (
  (select public.is_netsecbr_admin())
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
)
with check (
  (select public.is_netsecbr_admin())
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
);
