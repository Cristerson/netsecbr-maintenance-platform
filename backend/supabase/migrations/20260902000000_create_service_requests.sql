-- Entrega: solicitações de manutenção com triagem e conversão em ordem de serviço.

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  cost_center_id uuid not null references public.cost_centers(id) on delete restrict,
  asset_id uuid references public.assets(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 3 and 180),
  description text,
  category text not null default 'geral',
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'triaged', 'converted_to_wo', 'cancelled')),
  requested_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  requested_at timestamptz not null default now(),
  converted_to_work_order_id uuid references public.work_orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (converted_to_work_order_id is null or status = 'converted_to_wo')
);

create index idx_service_requests_tenant_requested_at
  on public.service_requests (tenant_id, requested_at desc);
create index idx_service_requests_tenant_status
  on public.service_requests (tenant_id, status);
create index idx_service_requests_asset_id
  on public.service_requests (asset_id)
  where asset_id is not null;

create or replace function public.validate_service_request_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  unit_tenant_id uuid;
  unit_cost_center_id uuid;
  asset_tenant_id uuid;
  asset_unit_id uuid;
  asset_cost_center_id uuid;
begin
  select tenant_id, cost_center_id
    into unit_tenant_id, unit_cost_center_id
  from public.units
  where id = new.unit_id;

  if unit_tenant_id is null
     or new.tenant_id <> unit_tenant_id
     or new.cost_center_id <> unit_cost_center_id then
    raise exception 'Solicitação precisa usar a unidade e o centro de custo do mesmo tenant.';
  end if;

  if new.asset_id is not null then
    select tenant_id, unit_id, cost_center_id
      into asset_tenant_id, asset_unit_id, asset_cost_center_id
    from public.assets
    where id = new.asset_id
      and deleted_at is null;

    if asset_tenant_id is null
       or new.tenant_id <> asset_tenant_id
       or new.unit_id <> asset_unit_id
       or new.cost_center_id <> asset_cost_center_id then
      raise exception 'Ativo da solicitação precisa pertencer à mesma unidade e centro de custo.';
    end if;
  end if;

  return new;
end;
$$;

create trigger service_requests_validate_scope
  before insert or update on public.service_requests
  for each row execute procedure public.validate_service_request_scope();

alter table public.service_requests enable row level security;

grant select, insert, update on public.service_requests to authenticated;

create policy "service_requests_select_own_operational_tenant"
on public.service_requests for select to authenticated
using (
  (select public.is_netsecbr_admin())
  or (public.is_tenant_member(tenant_id) and public.tenant_allows_operation(tenant_id))
);

-- Qualquer usuário do tenant operacional pode abrir uma solicitação em seu nome.
create policy "service_requests_insert_own_operational_tenant"
on public.service_requests for insert to authenticated
with check (
  ((select auth.uid()) = requested_by)
  and (
    (select public.is_netsecbr_admin())
    or (public.is_tenant_member(tenant_id) and public.tenant_allows_operation(tenant_id))
  )
);

-- Triagem (alterar status, categoria, prioridade, converter em OS) é do administrador do tenant.
create policy "service_requests_update_tenant_admin_or_global_admin"
on public.service_requests for update to authenticated
using (
  (select public.is_netsecbr_admin())
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
)
with check (
  (select public.is_netsecbr_admin())
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
);