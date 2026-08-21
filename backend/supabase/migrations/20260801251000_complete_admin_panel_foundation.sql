-- Complemento final da fundação dos painéis administrativos.

alter table public.invoices
  add column if not exists invoice_number text,
  add column if not exists description text,
  add column if not exists billing_period_start date,
  add column if not exists billing_period_end date,
  add column if not exists currency_code text not null default 'BRL';
create unique index if not exists uq_invoices_tenant_invoice_number
  on public.invoices (tenant_id, invoice_number) where invoice_number is not null;

alter table public.payments
  add column if not exists paid_by_name text,
  add column if not exists receipt_url text,
  add column if not exists failure_reason text;

create table if not exists public.platform_security_settings (
  id boolean primary key default true check (id = true),
  password_expiration_days integer not null default 90 check (password_expiration_days between 1 and 365),
  warning_days integer not null default 15 check (warning_days between 1 and 90),
  max_failed_attempts integer not null default 5 check (max_failed_attempts between 1 and 20),
  updated_at timestamptz not null default now()
);
insert into public.platform_security_settings (id) values (true) on conflict do nothing;
alter table public.platform_security_settings enable row level security;
grant select on public.platform_security_settings to authenticated;
create policy "security_settings_global_admin" on public.platform_security_settings for all to authenticated
using ((select public.is_netsecbr_admin())) with check ((select public.is_netsecbr_admin()));

create policy "audit_insert_own_event" on public.audit_logs for insert to authenticated
with check (actor_id = (select auth.uid()) and ((select public.is_netsecbr_admin()) or public.is_tenant_member(tenant_id)));

update public.profiles
set password_changed_at = coalesce(password_changed_at, created_at), must_change_password = coalesce(password_changed_at, created_at) < now() - interval '90 days'
where password_changed_at is null;
