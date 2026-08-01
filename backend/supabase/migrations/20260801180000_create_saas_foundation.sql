-- Entrega 1: base multiempresa da NETSECBR Maintenance Platform.
-- Execute este arquivo pelo SQL Editor do Supabase.

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text not null,
  document_number text unique,
  status text not null default 'active'
    check (status in ('active', 'grace_period', 'payment_only', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  cost_center_id uuid not null references public.cost_centers(id) on delete restrict,
  name text not null,
  code text not null,
  city text,
  state text,
  country text not null default 'Brasil',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create index idx_cost_centers_tenant_id on public.cost_centers (tenant_id);
create index idx_units_tenant_id on public.units (tenant_id);
create index idx_units_cost_center_id on public.units (cost_center_id);

-- Bloqueia acesso direto até criarmos usuários, perfis e políticas na próxima entrega.
alter table public.tenants enable row level security;
alter table public.cost_centers enable row level security;
alter table public.units enable row level security;
