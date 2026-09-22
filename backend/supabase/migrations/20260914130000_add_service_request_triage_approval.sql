-- V1 MARV: cadeia Solicitação -> Triagem -> Aprovação -> OS.

alter table public.service_requests
  add column if not exists triage_notes text,
  add column if not exists estimated_service_cost_cents bigint
    check (estimated_service_cost_cents is null or estimated_service_cost_cents >= 0),
  add column if not exists estimated_material_cost_cents bigint
    check (estimated_material_cost_cents is null or estimated_material_cost_cents >= 0),
  add column if not exists estimated_total_cost_cents bigint
    generated always as (
      coalesce(estimated_service_cost_cents, 0) + coalesce(estimated_material_cost_cents, 0)
    ) stored,
  add column if not exists triaged_at timestamptz,
  add column if not exists triaged_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null;

alter table public.work_orders
  add column if not exists source_service_request_id uuid
    references public.service_requests(id) on delete restrict,
  add column if not exists estimated_service_cost_cents bigint
    check (estimated_service_cost_cents is null or estimated_service_cost_cents >= 0),
  add column if not exists estimated_material_cost_cents bigint
    check (estimated_material_cost_cents is null or estimated_material_cost_cents >= 0),
  add column if not exists estimated_total_cost_cents bigint
    generated always as (
      coalesce(estimated_service_cost_cents, 0) + coalesce(estimated_material_cost_cents, 0)
    ) stored;

create unique index if not exists idx_work_orders_source_service_request
  on public.work_orders (source_service_request_id)
  where source_service_request_id is not null;

create index if not exists idx_service_requests_tenant_triaged_at
  on public.service_requests (tenant_id, triaged_at desc)
  where triaged_at is not null;

create or replace function public.enforce_service_request_governance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'converted_to_wo' and new.status <> 'converted_to_wo' then
    raise exception 'Uma solicitacao convertida em OS nao pode retornar ao fluxo.';
  end if;

  if old.status <> 'triaged' and new.status = 'triaged' then
    if coalesce(trim(new.triage_notes), '') = '' then
      raise exception 'Informe a triagem do supervisor antes de encaminhar a solicitacao.';
    end if;
    new.triaged_at := now();
    new.triaged_by := auth.uid();
  end if;

  if old.status <> 'converted_to_wo' and new.status = 'converted_to_wo' then
    if new.converted_to_work_order_id is null or new.approved_at is null or new.approved_by is null then
      raise exception 'Uma solicitacao so pode ser convertida apos aprovacao e criacao da OS.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists service_requests_enforce_governance on public.service_requests;
create trigger service_requests_enforce_governance
  before update on public.service_requests
  for each row execute procedure public.enforce_service_request_governance();

create table public.service_request_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  service_request_id uuid not null references public.service_requests(id) on delete restrict,
  event_type text not null check (event_type in ('created', 'updated', 'triaged', 'approved_and_converted', 'cancelled')),
  status_before text,
  status_after text,
  previous_values jsonb,
  new_values jsonb not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index idx_service_request_audit_log_request_changed_at
  on public.service_request_audit_log (service_request_id, changed_at desc);

alter table public.service_request_audit_log enable row level security;
grant select on public.service_request_audit_log to authenticated;

create policy "service_request_audit_log_select_operational_tenant"
on public.service_request_audit_log
for select to authenticated
using (
  (select public.is_netsecbr_admin())
  or (public.is_tenant_member(tenant_id) and public.tenant_allows_operation(tenant_id))
);

create or replace function public.record_service_request_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_event_type text;
begin
  if tg_op = 'INSERT' then
    insert into public.service_request_audit_log (
      tenant_id, service_request_id, event_type, status_after, new_values, changed_by
    ) values (
      new.tenant_id, new.id, 'created', new.status, to_jsonb(new), auth.uid()
    );
    return new;
  end if;

  if to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;

  audit_event_type := case
    when old.status <> new.status and new.status = 'triaged' then 'triaged'
    when old.status <> new.status and new.status = 'converted_to_wo' then 'approved_and_converted'
    when old.status <> new.status and new.status = 'cancelled' then 'cancelled'
    else 'updated'
  end;

  insert into public.service_request_audit_log (
    tenant_id, service_request_id, event_type, status_before, status_after,
    previous_values, new_values, changed_by
  ) values (
    new.tenant_id, new.id, audit_event_type, old.status, new.status,
    to_jsonb(old), to_jsonb(new), auth.uid()
  );
  return new;
end;
$$;

revoke all on function public.record_service_request_audit_event() from public;
revoke all on function public.record_service_request_audit_event() from anon;
revoke all on function public.record_service_request_audit_event() from authenticated;

drop trigger if exists service_requests_audit_after_insert on public.service_requests;
create trigger service_requests_audit_after_insert
  after insert on public.service_requests
  for each row execute procedure public.record_service_request_audit_event();

drop trigger if exists service_requests_audit_after_update on public.service_requests;
create trigger service_requests_audit_after_update
  after update on public.service_requests
  for each row execute procedure public.record_service_request_audit_event();

create or replace function public.approve_service_request_and_create_work_order(target_request_id uuid)
returns table (work_order_id uuid, order_number bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.service_requests%rowtype;
  created_work_order_id uuid;
  created_order_number bigint;
begin
  select * into request_row
  from public.service_requests
  where id = target_request_id
  for update;

  if request_row.id is null then
    raise exception 'Solicitacao nao encontrada.';
  end if;

  if not (
    (select public.is_netsecbr_admin())
    or public.is_tenant_admin(request_row.tenant_id)
  ) then
    raise exception 'Somente o supervisor pode aprovar uma solicitacao.';
  end if;

  if request_row.status <> 'triaged' then
    raise exception 'A solicitacao precisa estar em triagem antes da aprovacao.';
  end if;

  if coalesce(trim(request_row.triage_notes), '') = '' then
    raise exception 'Informe a triagem antes da aprovacao.';
  end if;

  insert into public.work_orders as created_order (
    tenant_id, unit_id, cost_center_id, asset_id, source_service_request_id,
    title, description, type, priority, status, opened_by,
    estimated_service_cost_cents, estimated_material_cost_cents
  ) values (
    request_row.tenant_id, request_row.unit_id, request_row.cost_center_id,
    request_row.asset_id, request_row.id, request_row.title, request_row.description,
    'corrective', request_row.priority, 'open', auth.uid(),
    request_row.estimated_service_cost_cents, request_row.estimated_material_cost_cents
  )
  returning created_order.id, created_order.order_number
    into created_work_order_id, created_order_number;

  update public.service_requests
  set status = 'converted_to_wo',
      converted_to_work_order_id = created_work_order_id,
      approved_at = now(),
      approved_by = auth.uid()
  where id = request_row.id;

  work_order_id := created_work_order_id;
  order_number := created_order_number;
  return next;
end;
$$;

revoke all on function public.approve_service_request_and_create_work_order(uuid) from public;
revoke all on function public.approve_service_request_and_create_work_order(uuid) from anon;
grant execute on function public.approve_service_request_and_create_work_order(uuid) to authenticated;
