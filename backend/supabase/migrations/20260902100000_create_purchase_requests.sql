-- Entrega: requisições de compra vinculadas às ordens de serviço.

insert into public.permission_catalog (code, name, description) values
  ('purchase_requests.read', 'Consultar requisições de compra', 'Visualizar requisições de materiais vinculadas às ordens de serviço.'),
  ('purchase_requests.create', 'Criar requisições de compra', 'Registrar necessidades de compra para uma ordem de serviço.'),
  ('purchase_requests.approve', 'Aprovar requisições de compra', 'Aprovar, encaminhar e registrar o recebimento das requisições.')
on conflict (code) do nothing;

create table public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,

  tenant_id uuid not null references public.tenants(id) on delete restrict,
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  cost_center_id uuid not null references public.cost_centers(id) on delete restrict,
  asset_id uuid references public.assets(id) on delete restrict,
  suggested_supplier_id uuid references public.suppliers(id) on delete restrict,

  status text not null default 'pending_approval'
    check (status in (
      'pending_approval',
      'approved',
      'sent_to_supplier',
      'received',
      'cancelled'
    )),

  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),

  notes text,

  requested_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  requested_at timestamptz not null default now(),

  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,

  sent_to_supplier_at timestamptz,
  received_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    (approved_at is null and approved_by is null)
    or (approved_at is not null and approved_by is not null)
  )
);

create table public.purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null references public.purchase_requests(id) on delete cascade,

  description text not null check (char_length(trim(description)) between 3 and 300),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_of_measure text not null default 'un'
    check (char_length(trim(unit_of_measure)) between 1 and 20),

  estimated_unit_cost_cents bigint
    check (estimated_unit_cost_cents is null or estimated_unit_cost_cents >= 0),

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_purchase_requests_tenant_status
  on public.purchase_requests (tenant_id, status, requested_at desc);

create index idx_purchase_requests_work_order
  on public.purchase_requests (work_order_id);

create index idx_purchase_request_items_request
  on public.purchase_request_items (purchase_request_id);

create or replace function public.validate_purchase_request_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  order_tenant_id uuid;
  order_unit_id uuid;
  order_cost_center_id uuid;
  order_asset_id uuid;
  supplier_tenant_id uuid;
begin
  select tenant_id, unit_id, cost_center_id, asset_id
    into order_tenant_id, order_unit_id, order_cost_center_id, order_asset_id
  from public.work_orders
  where id = new.work_order_id;

  if order_tenant_id is null
     or new.tenant_id <> order_tenant_id
     or new.unit_id <> order_unit_id
     or new.cost_center_id <> order_cost_center_id
     or new.asset_id is distinct from order_asset_id then
    raise exception 'A requisição deve utilizar os mesmos tenant, unidade, centro de custo e ativo da OS.';
  end if;

  if new.suggested_supplier_id is not null then
    select tenant_id
      into supplier_tenant_id
    from public.suppliers
    where id = new.suggested_supplier_id
      and is_active = true;

    if supplier_tenant_id is null or supplier_tenant_id <> new.tenant_id then
      raise exception 'O fornecedor sugerido deve estar ativo e pertencer ao mesmo cliente.';
    end if;
  end if;

  return new;
end;
$$;

create trigger purchase_requests_validate_scope
  before insert or update on public.purchase_requests
  for each row execute procedure public.validate_purchase_request_scope();

alter table public.purchase_requests enable row level security;
alter table public.purchase_request_items enable row level security;

grant select, insert, update on public.purchase_requests to authenticated;
grant select, insert, update, delete on public.purchase_request_items to authenticated;

create policy "purchase_requests_select_operational_tenant"
on public.purchase_requests for select to authenticated
using (
  (select public.is_netsecbr_admin())
  or (
    public.is_tenant_member(tenant_id)
    and public.tenant_allows_operation(tenant_id)
  )
);

create policy "purchase_requests_insert_tenant_admin"
on public.purchase_requests for insert to authenticated
with check (
  ((select auth.uid()) = requested_by)
  and (
    (select public.is_netsecbr_admin())
    or (
      public.is_tenant_admin(tenant_id)
      and public.tenant_allows_operation(tenant_id)
    )
  )
);

create policy "purchase_requests_update_tenant_admin"
on public.purchase_requests for update to authenticated
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

create policy "purchase_request_items_select_operational_tenant"
on public.purchase_request_items for select to authenticated
using (
  exists (
    select 1
    from public.purchase_requests request
    where request.id = purchase_request_items.purchase_request_id
      and (
        (select public.is_netsecbr_admin())
        or (
          public.is_tenant_member(request.tenant_id)
          and public.tenant_allows_operation(request.tenant_id)
        )
      )
  )
);

create policy "purchase_request_items_manage_tenant_admin"
on public.purchase_request_items for all to authenticated
using (
  exists (
    select 1
    from public.purchase_requests request
    where request.id = purchase_request_items.purchase_request_id
      and (
        (select public.is_netsecbr_admin())
        or (
          public.is_tenant_admin(request.tenant_id)
          and public.tenant_allows_operation(request.tenant_id)
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.purchase_requests request
    where request.id = purchase_request_items.purchase_request_id
      and (
        (select public.is_netsecbr_admin())
        or (
          public.is_tenant_admin(request.tenant_id)
          and public.tenant_allows_operation(request.tenant_id)
        )
      )
  )
);