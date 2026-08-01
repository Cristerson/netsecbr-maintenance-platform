-- Entrega 5: planos comerciais configuráveis e contratos anuais.
-- Nenhum dado de cartão é armazenado neste banco.

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  robot_limit integer not null check (robot_limit >= 0),
  annual_price_cents integer not null check (annual_price_cents >= 0),
  included_storage_bytes bigint not null default 52428800 check (included_storage_bytes >= 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  plan_id uuid references public.subscription_plans(id) on delete restrict,
  plan_name_snapshot text not null,
  robot_limit_snapshot integer not null check (robot_limit_snapshot >= 0),
  annual_price_cents_snapshot integer not null check (annual_price_cents_snapshot >= 0),
  included_storage_bytes_snapshot bigint not null check (included_storage_bytes_snapshot >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'trial', 'active', 'cancelled', 'expired')),
  contract_start_date date not null,
  billing_start_date date not null,
  contract_end_date date not null,
  trial_ends_at timestamptz,
  payment_provider text,
  payment_customer_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contract_end_date > contract_start_date),
  check (billing_start_date >= contract_start_date)
);

create unique index uq_subscriptions_one_current_contract_per_tenant
  on public.subscriptions (tenant_id)
  where status in ('draft', 'trial', 'active');

create index idx_subscriptions_tenant_id on public.subscriptions (tenant_id);
create index idx_subscriptions_status on public.subscriptions (status);

alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;

-- Catálogo comercial é controlado somente pela NETSECBR.
create policy "subscription_plans_select_global_admin"
on public.subscription_plans for select to authenticated
using (public.is_netsecbr_admin());

create policy "subscription_plans_manage_global_admin"
on public.subscription_plans for all to authenticated
using (public.is_netsecbr_admin())
with check (public.is_netsecbr_admin());

-- O cliente pode consultar o contrato próprio, inclusive em modo somente pagamentos.
create policy "subscriptions_select_own_tenant_or_global_admin"
on public.subscriptions for select to authenticated
using (public.is_tenant_member(tenant_id) or public.is_netsecbr_admin());

create policy "subscriptions_manage_global_admin"
on public.subscriptions for all to authenticated
using (public.is_netsecbr_admin())
with check (public.is_netsecbr_admin());
