-- Entrega 12: fundação dos painéis administrativos e financeiros.

alter table public.profiles add column if not exists password_changed_at timestamptz;
alter table public.profiles add column if not exists must_change_password boolean not null default false;

create table public.invoices (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), subscription_id uuid references public.subscriptions(id),
  amount_cents bigint not null check (amount_cents >= 0), due_date date not null, status text not null default 'pending' check (status in ('draft','pending','paid','overdue','cancelled')),
  created_at timestamptz not null default now(), paid_at timestamptz
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id), tenant_id uuid not null references public.tenants(id),
  amount_cents bigint not null check (amount_cents >= 0), method text check (method in ('pix','card','bank_transfer')), status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  provider_reference text, paid_at timestamptz, created_at timestamptz not null default now()
);
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), title text not null, description text,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')), priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  opened_by uuid references public.profiles(id), assigned_to uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid references public.tenants(id), actor_id uuid references public.profiles(id),
  action text not null, resource_type text not null, resource_id text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index idx_invoices_tenant_status on public.invoices(tenant_id,status,due_date);
create index idx_support_tickets_tenant_status on public.support_tickets(tenant_id,status);
create index idx_audit_logs_tenant_created on public.audit_logs(tenant_id,created_at desc);
alter table public.invoices enable row level security; alter table public.payments enable row level security; alter table public.support_tickets enable row level security; alter table public.audit_logs enable row level security;
grant select, insert, update on public.invoices, public.payments, public.support_tickets, public.audit_logs to authenticated;
create policy "invoices_tenant_read" on public.invoices for select to authenticated using ((select public.is_netsecbr_admin()) or public.is_tenant_member(tenant_id));
create policy "invoices_global_manage" on public.invoices for all to authenticated using ((select public.is_netsecbr_admin())) with check ((select public.is_netsecbr_admin()));
create policy "payments_tenant_read" on public.payments for select to authenticated using ((select public.is_netsecbr_admin()) or public.is_tenant_member(tenant_id));
create policy "payments_global_manage" on public.payments for all to authenticated using ((select public.is_netsecbr_admin())) with check ((select public.is_netsecbr_admin()));
create policy "tickets_tenant" on public.support_tickets for all to authenticated using ((select public.is_netsecbr_admin()) or public.is_tenant_member(tenant_id)) with check ((select public.is_netsecbr_admin()) or public.is_tenant_member(tenant_id));
create policy "audit_global_read" on public.audit_logs for select to authenticated using ((select public.is_netsecbr_admin()));
