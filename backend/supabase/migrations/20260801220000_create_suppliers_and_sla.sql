-- Entrega 8: fornecedores e SLA vinculados às ordens de serviço.

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  legal_name text not null,
  trade_name text,
  document_number text,
  email text,
  phone text,
  service_category text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, document_number)
);

create table public.supplier_sla_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  name text not null,
  response_minutes integer not null check (response_minutes > 0),
  resolution_minutes integer not null check (resolution_minutes > 0),
  priority text check (priority in ('low', 'medium', 'high', 'critical')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_order_supplier_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  sla_policy_id uuid references public.supplier_sla_policies(id) on delete restrict,
  status text not null default 'opened' check (status in ('opened', 'acknowledged', 'in_service', 'resolved', 'cancelled')),
  opened_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  response_due_at timestamptz not null,
  resolution_due_at timestamptz not null,
  paused_minutes integer not null default 0 check (paused_minutes >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (resolution_due_at >= response_due_at)
);

create index idx_suppliers_tenant_id on public.suppliers (tenant_id);
create index idx_supplier_sla_policies_supplier_id on public.supplier_sla_policies (supplier_id);
create index idx_work_order_supplier_calls_due on public.work_order_supplier_calls (tenant_id, status, resolution_due_at);

alter table public.suppliers enable row level security;
alter table public.supplier_sla_policies enable row level security;
alter table public.work_order_supplier_calls enable row level security;

grant select, insert, update on public.suppliers, public.supplier_sla_policies, public.work_order_supplier_calls to authenticated;

create policy "suppliers_operational_tenant" on public.suppliers for all to authenticated
using ((select public.is_netsecbr_admin()) or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id)))
with check ((select public.is_netsecbr_admin()) or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id)));

create policy "supplier_sla_operational_tenant" on public.supplier_sla_policies for all to authenticated
using ((select public.is_netsecbr_admin()) or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id)))
with check ((select public.is_netsecbr_admin()) or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id)));

create policy "supplier_calls_select_operational_tenant" on public.work_order_supplier_calls for select to authenticated
using ((select public.is_netsecbr_admin()) or (public.is_tenant_member(tenant_id) and public.tenant_allows_operation(tenant_id)));

create policy "supplier_calls_manage_tenant_admin" on public.work_order_supplier_calls for all to authenticated
using ((select public.is_netsecbr_admin()) or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id)))
with check ((select public.is_netsecbr_admin()) or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id)));
