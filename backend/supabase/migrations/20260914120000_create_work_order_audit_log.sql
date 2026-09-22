-- V1 MARV: cadeia de custodia imutavel das ordens de servico.
-- A tabela nao recebe permissoes de escrita pelo frontend.

create table public.work_order_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  event_type text not null check (
    event_type in ('created', 'updated', 'status_changed', 'completed', 'cancelled')
  ),
  status_before text,
  status_after text,
  previous_values jsonb,
  new_values jsonb not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index idx_work_order_audit_log_order_changed_at
  on public.work_order_audit_log (work_order_id, changed_at desc);

create index idx_work_order_audit_log_tenant_changed_at
  on public.work_order_audit_log (tenant_id, changed_at desc);

alter table public.work_order_audit_log enable row level security;

grant select on public.work_order_audit_log to authenticated;

create policy "work_order_audit_log_select_operational_tenant"
on public.work_order_audit_log
for select
to authenticated
using (
  (select public.is_netsecbr_admin())
  or (
    public.is_tenant_member(tenant_id)
    and public.tenant_allows_operation(tenant_id)
  )
);

create or replace function public.record_work_order_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_event_type text;
begin
  if tg_op = 'INSERT' then
    insert into public.work_order_audit_log (
      tenant_id,
      work_order_id,
      event_type,
      status_after,
      new_values,
      changed_by
    ) values (
      new.tenant_id,
      new.id,
      'created',
      new.status,
      to_jsonb(new),
      auth.uid()
    );

    return new;
  end if;

  if to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;

  audit_event_type := case
    when old.status <> new.status and new.status = 'completed' then 'completed'
    when old.status <> new.status and new.status = 'cancelled' then 'cancelled'
    when old.status <> new.status then 'status_changed'
    else 'updated'
  end;

  insert into public.work_order_audit_log (
    tenant_id,
    work_order_id,
    event_type,
    status_before,
    status_after,
    previous_values,
    new_values,
    changed_by
  ) values (
    new.tenant_id,
    new.id,
    audit_event_type,
    old.status,
    new.status,
    to_jsonb(old),
    to_jsonb(new),
    auth.uid()
  );

  return new;
end;
$$;

revoke all on function public.record_work_order_audit_event() from public;
revoke all on function public.record_work_order_audit_event() from anon;
revoke all on function public.record_work_order_audit_event() from authenticated;

drop trigger if exists work_orders_audit_after_insert on public.work_orders;
create trigger work_orders_audit_after_insert
  after insert on public.work_orders
  for each row execute procedure public.record_work_order_audit_event();

drop trigger if exists work_orders_audit_after_update on public.work_orders;
create trigger work_orders_audit_after_update
  after update on public.work_orders
  for each row execute procedure public.record_work_order_audit_event();
