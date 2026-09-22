-- Entrega: posse, contratos e responsabilidade externa de equipamentos.

alter table public.assets
  add column ownership_type text not null default 'owned'
    check (ownership_type in ('owned', 'rented', 'loaned', 'leasing', 'third_party')),
  add column estimated_production_value_per_hour_cents bigint
    check (estimated_production_value_per_hour_cents >= 0);

comment on column public.assets.ownership_type is
  'owned=Próprio, rented=Alugado/Locado, loaned=Comodato, leasing=Leasing, third_party=Terceiro';

comment on column public.assets.estimated_production_value_per_hour_cents is
  'Estimativa gerencial de impacto produtivo por hora. Não é custo contábil.';

create table public.asset_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  asset_id uuid not null references public.assets(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  sla_policy_id uuid references public.supplier_sla_policies(id) on delete restrict,

  contract_number text not null,
  started_on date not null,
  ended_on date,

  monthly_value_cents bigint check (monthly_value_cents >= 0),
  billing_frequency text not null default 'monthly'
    check (billing_frequency in ('monthly', 'quarterly', 'semiannual', 'annual', 'custom')),

  minimum_availability_percent numeric(5,2)
    check (
      minimum_availability_percent is null
      or minimum_availability_percent between 0 and 100
    ),
  response_minutes integer check (response_minutes is null or response_minutes > 0),
  resolution_minutes integer check (resolution_minutes is null or resolution_minutes > 0),

  technical_contact_name text,
  technical_contact_email text,
  technical_contact_phone text,
  technical_contact_whatsapp text,

  rental_downtime_rule text not null default 'none'
    check (rental_downtime_rule in ('none', 'calendar_hours', 'business_hours', 'custom')),
  rental_month_reference_hours integer
    check (
      rental_month_reference_hours is null
      or rental_month_reference_hours > 0
    ),

  is_primary boolean not null default true,
  is_active boolean not null default true,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (ended_on is null or ended_on >= started_on)
);

create index idx_asset_contracts_asset_period
  on public.asset_contracts (asset_id, started_on desc);

create index idx_asset_contracts_supplier
  on public.asset_contracts (supplier_id);

create index idx_asset_contracts_active_primary
  on public.asset_contracts (asset_id, started_on desc)
  where is_active = true and is_primary = true;

-- Confere se ativo, fornecedor e SLA pertencem ao mesmo tenant.
create or replace function public.validate_asset_contract_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  asset_tenant_id uuid;
  supplier_tenant_id uuid;
  sla_tenant_id uuid;
  sla_supplier_id uuid;
begin
  select tenant_id
    into asset_tenant_id
  from public.assets
  where id = new.asset_id
    and deleted_at is null;

  select tenant_id
    into supplier_tenant_id
  from public.suppliers
  where id = new.supplier_id;

  if asset_tenant_id is null or supplier_tenant_id is null then
    raise exception 'Ativo ou fornecedor inválido.';
  end if;

  if new.tenant_id <> asset_tenant_id
     or new.tenant_id <> supplier_tenant_id then
    raise exception 'Contrato precisa usar ativo e fornecedor do mesmo cliente.';
  end if;

  if new.sla_policy_id is not null then
    select tenant_id, supplier_id
      into sla_tenant_id, sla_supplier_id
    from public.supplier_sla_policies
    where id = new.sla_policy_id;

    if sla_tenant_id is null
       or sla_tenant_id <> new.tenant_id
       or sla_supplier_id <> new.supplier_id then
      raise exception 'A política de SLA deve pertencer ao mesmo fornecedor e cliente.';
    end if;
  end if;

  return new;
end;
$$;

create trigger asset_contracts_validate_scope
  before insert or update on public.asset_contracts
  for each row execute procedure public.validate_asset_contract_scope();

-- Impede dois contratos principais ativos no mesmo período para o mesmo ativo.
create or replace function public.validate_asset_contract_primary_period()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_primary and new.is_active and exists (
    select 1
    from public.asset_contracts existing_contract
    where existing_contract.asset_id = new.asset_id
      and existing_contract.id <> new.id
      and existing_contract.is_primary = true
      and existing_contract.is_active = true
      and daterange(
        existing_contract.started_on,
        coalesce(existing_contract.ended_on + 1, 'infinity'::date),
        '[)'
      ) && daterange(
        new.started_on,
        coalesce(new.ended_on + 1, 'infinity'::date),
        '[)'
      )
  ) then
    raise exception 'Já existe um contrato principal ativo para este equipamento no período informado.';
  end if;

  return new;
end;
$$;

create trigger asset_contracts_validate_primary_period
  before insert or update on public.asset_contracts
  for each row execute procedure public.validate_asset_contract_primary_period();

alter table public.asset_contracts enable row level security;

grant select, insert, update on public.asset_contracts to authenticated;

create policy "asset_contracts_select_own_operational_tenant"
on public.asset_contracts for select to authenticated
using (
  (select public.is_netsecbr_admin())
  or (
    public.is_tenant_member(tenant_id)
    and public.tenant_allows_operation(tenant_id)
  )
);

create policy "asset_contracts_manage_tenant_admin"
on public.asset_contracts for all to authenticated
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