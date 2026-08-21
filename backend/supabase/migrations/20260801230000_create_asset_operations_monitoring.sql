-- Entrega 9: ficha técnica, custos, peças e preparação para monitoramento.

create table public.asset_technical_profiles (
  asset_id uuid primary key references public.assets(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  technical_specs jsonb not null default '{}'::jsonb,
  ip_address inet,
  mac_address text,
  connection_protocol text check (connection_protocol in ('ping', 'snmp', 'modbus_tcp', 'opc_ua', 'api')),
  connection_port integer check (connection_port between 1 and 65535),
  monitoring_enabled boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.work_order_costs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete restrict,
  cost_type text not null check (cost_type in ('labor', 'service', 'material', 'other')),
  description text not null, quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_cost_cents bigint not null check (unit_cost_cents >= 0), occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.work_order_parts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete restrict,
  part_code text, part_name text not null, quantity numeric(12,2) not null check (quantity > 0),
  unit_cost_cents bigint not null check (unit_cost_cents >= 0), created_at timestamptz not null default now()
);

create table public.monitoring_rules (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
  asset_id uuid not null references public.assets(id) on delete restrict,
  name text not null, metric_key text not null, operator text not null check (operator in ('gt','gte','lt','lte','eq','offline')),
  threshold numeric, severity text not null default 'warning' check (severity in ('warning','critical')),
  is_active boolean not null default true, created_at timestamptz not null default now()
);

create table public.monitoring_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
  asset_id uuid not null references public.assets(id) on delete restrict,
  rule_id uuid references public.monitoring_rules(id) on delete set null,
  metric_key text not null, metric_value numeric, severity text not null check (severity in ('warning','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  occurred_at timestamptz not null default now(), resolved_at timestamptz, notes text
);

create index idx_work_order_costs_order on public.work_order_costs(work_order_id);
create index idx_work_order_parts_order on public.work_order_parts(work_order_id);
create index idx_monitoring_events_open on public.monitoring_events(tenant_id, status, occurred_at desc);

alter table public.asset_technical_profiles enable row level security;
alter table public.work_order_costs enable row level security;
alter table public.work_order_parts enable row level security;
alter table public.monitoring_rules enable row level security;
alter table public.monitoring_events enable row level security;

grant select, insert, update on public.asset_technical_profiles, public.work_order_costs, public.work_order_parts, public.monitoring_rules, public.monitoring_events to authenticated;

create policy "technical_profile_admin" on public.asset_technical_profiles for all to authenticated using ((select public.is_netsecbr_admin()) or public.is_tenant_admin(tenant_id)) with check ((select public.is_netsecbr_admin()) or public.is_tenant_admin(tenant_id));
create policy "costs_read_tenant" on public.work_order_costs for select to authenticated using ((select public.is_netsecbr_admin()) or public.is_tenant_member(tenant_id));
create policy "costs_admin" on public.work_order_costs for all to authenticated using ((select public.is_netsecbr_admin()) or public.is_tenant_admin(tenant_id)) with check ((select public.is_netsecbr_admin()) or public.is_tenant_admin(tenant_id));
create policy "parts_read_tenant" on public.work_order_parts for select to authenticated using ((select public.is_netsecbr_admin()) or public.is_tenant_member(tenant_id));
create policy "parts_admin" on public.work_order_parts for all to authenticated using ((select public.is_netsecbr_admin()) or public.is_tenant_admin(tenant_id)) with check ((select public.is_netsecbr_admin()) or public.is_tenant_admin(tenant_id));
create policy "rules_admin" on public.monitoring_rules for all to authenticated using ((select public.is_netsecbr_admin()) or public.is_tenant_admin(tenant_id)) with check ((select public.is_netsecbr_admin()) or public.is_tenant_admin(tenant_id));
create policy "events_read_tenant" on public.monitoring_events for select to authenticated using ((select public.is_netsecbr_admin()) or public.is_tenant_member(tenant_id));
create policy "events_admin" on public.monitoring_events for all to authenticated using ((select public.is_netsecbr_admin()) or public.is_tenant_admin(tenant_id)) with check ((select public.is_netsecbr_admin()) or public.is_tenant_admin(tenant_id));
