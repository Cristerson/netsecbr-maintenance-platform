-- Entrega 4: categorias, ativos e robôs.
-- Robôs cadastrados contam para a licença mesmo inativos; exclusão é lógica para preservar histórico.

create table public.asset_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  code text not null,
  name text not null,
  is_robot boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  cost_center_id uuid not null references public.cost_centers(id) on delete restrict,
  category_id uuid not null references public.asset_categories(id) on delete restrict,
  code text not null,
  name text not null,
  manufacturer text,
  model text,
  serial_number text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'maintenance', 'stopped', 'retired')),
  criticality text not null default 'medium'
    check (criticality in ('low', 'medium', 'high', 'critical')),
  installed_at date,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create index idx_asset_categories_tenant_id on public.asset_categories (tenant_id);
create index idx_assets_tenant_id on public.assets (tenant_id);
create index idx_assets_unit_id on public.assets (unit_id);
create index idx_assets_category_id on public.assets (category_id);
create index idx_assets_active_robots on public.assets (tenant_id, category_id)
  where deleted_at is null;

-- Impede vínculos entre tenant, unidade, centro de custo e categoria de clientes diferentes.
create or replace function public.validate_asset_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  unit_tenant_id uuid;
  unit_cost_center_id uuid;
  category_tenant_id uuid;
begin
  select tenant_id, cost_center_id
    into unit_tenant_id, unit_cost_center_id
  from public.units
  where id = new.unit_id;

  select tenant_id
    into category_tenant_id
  from public.asset_categories
  where id = new.category_id;

  if unit_tenant_id is null or category_tenant_id is null then
    raise exception 'Unidade ou categoria inválida.';
  end if;

  if new.tenant_id <> unit_tenant_id
     or new.tenant_id <> category_tenant_id
     or new.cost_center_id <> unit_cost_center_id then
    raise exception 'Ativo precisa pertencer ao mesmo tenant e centro de custo de sua unidade.';
  end if;

  return new;
end;
$$;

create trigger assets_validate_scope
  before insert or update on public.assets
  for each row execute procedure public.validate_asset_scope();

alter table public.asset_categories enable row level security;
alter table public.assets enable row level security;

create policy "asset_categories_select_own_operational_tenant"
on public.asset_categories for select to authenticated
using (
  public.is_netsecbr_admin()
  or (public.is_tenant_member(tenant_id) and public.tenant_allows_operation(tenant_id))
);

create policy "asset_categories_insert_tenant_admin"
on public.asset_categories for insert to authenticated
with check (
  public.is_netsecbr_admin()
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
);

create policy "asset_categories_update_tenant_admin"
on public.asset_categories for update to authenticated
using (public.is_netsecbr_admin() or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id)))
with check (public.is_netsecbr_admin() or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id)));

create policy "assets_select_own_operational_tenant"
on public.assets for select to authenticated
using (
  deleted_at is null
  and (public.is_netsecbr_admin() or (public.is_tenant_member(tenant_id) and public.tenant_allows_operation(tenant_id)))
);

create policy "assets_insert_tenant_admin"
on public.assets for insert to authenticated
with check (
  public.is_netsecbr_admin()
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
);

create policy "assets_update_tenant_admin"
on public.assets for update to authenticated
using (public.is_netsecbr_admin() or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id)))
with check (public.is_netsecbr_admin() or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id)));

-- Não há delete físico: o backend deve preencher deleted_at.
