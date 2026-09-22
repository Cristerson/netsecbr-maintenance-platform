-- V1 MARV: planos de manutenção preventiva por ativo.
-- O plano não executa nada sozinho: a OS preventiva é gerada manualmente pelo supervisor.

create table public.maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  asset_id uuid not null references public.assets(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 3 and 180),
  periodicity_days integer not null
    check (periodicity_days between 1 and 3650),
  next_due_date date not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_maintenance_plans_tenant_id
  on public.maintenance_plans (tenant_id);

create index idx_maintenance_plans_asset_id
  on public.maintenance_plans (asset_id);

create index idx_maintenance_plans_tenant_active_due
  on public.maintenance_plans (tenant_id, next_due_date)
  where is_active;

-- Impede vincular ativo de outro cliente ou ativo já removido.
create or replace function public.validate_maintenance_plan_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  asset_tenant_id uuid;
begin
  select tenant_id
    into asset_tenant_id
  from public.assets
  where id = new.asset_id
    and deleted_at is null;

  if asset_tenant_id is null or new.tenant_id <> asset_tenant_id then
    raise exception 'O plano preventivo precisa usar um ativo disponivel do mesmo cliente.';
  end if;

  -- Mantém updated_at coerente em toda alteração do plano (o projeto não tem trigger global).
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists maintenance_plans_validate_scope on public.maintenance_plans;
create trigger maintenance_plans_validate_scope
  before insert or update on public.maintenance_plans
  for each row execute procedure public.validate_maintenance_plan_scope();

alter table public.maintenance_plans enable row level security;

-- Garante acesso pela Data API mesmo em novos projetos Supabase com exposição restrita.
grant select, insert, update on public.maintenance_plans to authenticated;

create policy "maintenance_plans_select_own_operational_tenant"
on public.maintenance_plans for select to authenticated
using (
  public.is_netsecbr_admin()
  or (public.is_tenant_member(tenant_id) and public.tenant_allows_operation(tenant_id))
);

create policy "maintenance_plans_insert_tenant_admin"
on public.maintenance_plans for insert to authenticated
with check (
  public.is_netsecbr_admin()
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
);

create policy "maintenance_plans_update_tenant_admin"
on public.maintenance_plans for update to authenticated
using (
  public.is_netsecbr_admin()
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
)
with check (
  public.is_netsecbr_admin()
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
);
