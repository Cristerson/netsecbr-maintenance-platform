-- V1 MARV: visibilidade de unidades por usuario (autorizacao no banco).
-- Preserva o isolamento por tenant e restringe operacao as unidades autorizadas.

alter table public.tenant_memberships
  add column if not exists units_access_all boolean not null default false;

update public.tenant_memberships
set units_access_all = true
where units_access_all = false;

create table if not exists public.membership_unit_access (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.tenant_memberships(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (membership_id, unit_id)
);

create index if not exists idx_membership_unit_access_membership_id
  on public.membership_unit_access (membership_id);
create index if not exists idx_membership_unit_access_unit_id
  on public.membership_unit_access (unit_id);
create index if not exists idx_membership_unit_access_tenant_id
  on public.membership_unit_access (tenant_id);

alter table public.membership_unit_access enable row level security;

grant select, insert, update, delete on public.membership_unit_access to authenticated;

drop policy if exists "membership_unit_access_select_own_or_tenant_admin" on public.membership_unit_access;
create policy "membership_unit_access_select_own_or_tenant_admin"
on public.membership_unit_access for select to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships membership
    where membership.id = membership_unit_access.membership_id
      and (
        membership.user_id = auth.uid()
        or public.is_tenant_admin(membership.tenant_id)
        or public.is_netsecbr_admin()
      )
  )
);

drop policy if exists "membership_unit_access_manage_tenant_admin" on public.membership_unit_access;
create policy "membership_unit_access_manage_tenant_admin"
on public.membership_unit_access for all to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships membership
    where membership.id = membership_unit_access.membership_id
      and (public.is_tenant_admin(membership.tenant_id) or public.is_netsecbr_admin())
  )
)
with check (
  exists (
    select 1
    from public.tenant_memberships membership
    where membership.id = membership_unit_access.membership_id
      and (public.is_tenant_admin(membership.tenant_id) or public.is_netsecbr_admin())
  )
);
-- Funcao de autorizacao por unidade.
create or replace function public.user_can_access_unit(target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.units unit_row
    where unit_row.id = target_unit_id
      and (
        public.is_netsecbr_admin()
        or (
          exists (
            select 1
            from public.tenant_memberships membership
            where membership.user_id = auth.uid()
              and membership.tenant_id = unit_row.tenant_id
              and membership.is_active = true
              and (
                membership.role = 'tenant_admin'
                or membership.units_access_all = true
                or exists (
                  select 1
                  from public.membership_unit_access access_row
                  where access_row.membership_id = membership.id
                    and access_row.unit_id = unit_row.id
                )
              )
          )
          and public.tenant_allows_operation(unit_row.tenant_id)
        )
      )
  );
$$;

grant execute on function public.user_can_access_unit(uuid) to authenticated;

-- Unidades: restringe leitura as unidades autorizadas.
drop policy if exists "units_select_own_operational_tenant" on public.units;
create policy "units_select_own_operational_tenant"
on public.units for select to authenticated
using (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_member(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(id)
  )
);

-- Ativos.
drop policy if exists "assets_select_own_operational_tenant" on public.assets;
create policy "assets_select_own_operational_tenant"
on public.assets for select to authenticated
using (
  deleted_at is null
  and (
    public.is_netsecbr_admin()
    or (
      public.is_tenant_member(tenant_id)
      and public.tenant_allows_operation(tenant_id)
      and public.user_can_access_unit(unit_id)
    )
  )
);

drop policy if exists "assets_insert_tenant_admin" on public.assets;
create policy "assets_insert_tenant_admin"
on public.assets for insert to authenticated
with check (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_admin(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(unit_id)
  )
);

drop policy if exists "assets_update_tenant_admin" on public.assets;
create policy "assets_update_tenant_admin"
on public.assets for update to authenticated
using (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_admin(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(unit_id)
  )
)
with check (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_admin(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(unit_id)
  )
);
-- Ordens de servico.
drop policy if exists "work_orders_select_own_operational_tenant" on public.work_orders;
create policy "work_orders_select_own_operational_tenant"
on public.work_orders for select to authenticated
using (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_member(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(unit_id)
  )
);

drop policy if exists "work_orders_insert_own_operational_tenant" on public.work_orders;
create policy "work_orders_insert_own_operational_tenant"
on public.work_orders for insert to authenticated
with check (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_member(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(unit_id)
  )
);

drop policy if exists "work_orders_update_tenant_admin_or_global_admin" on public.work_orders;
create policy "work_orders_update_tenant_admin_or_global_admin"
on public.work_orders for update to authenticated
using (
  public.is_netsecbr_admin()
  or (
    (public.is_tenant_admin(tenant_id) or public.is_tenant_member(tenant_id))
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(unit_id)
  )
)
with check (
  public.is_netsecbr_admin()
  or (
    (public.is_tenant_admin(tenant_id) or public.is_tenant_member(tenant_id))
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(unit_id)
  )
);

-- Solicitacoes de servico.
drop policy if exists "service_requests_select_own_operational_tenant" on public.service_requests;
create policy "service_requests_select_own_operational_tenant"
on public.service_requests for select to authenticated
using (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_member(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(unit_id)
  )
);

drop policy if exists "service_requests_insert_own_operational_tenant" on public.service_requests;
create policy "service_requests_insert_own_operational_tenant"
on public.service_requests for insert to authenticated
with check (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_member(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(unit_id)
  )
);

drop policy if exists "service_requests_update_tenant_admin_or_global_admin" on public.service_requests;
create policy "service_requests_update_tenant_admin_or_global_admin"
on public.service_requests for update to authenticated
using (
  public.is_netsecbr_admin()
  or (
    (public.is_tenant_admin(tenant_id) or public.is_tenant_member(tenant_id))
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(unit_id)
  )
)
with check (
  public.is_netsecbr_admin()
  or (
    (public.is_tenant_admin(tenant_id) or public.is_tenant_member(tenant_id))
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(unit_id)
  )
);

-- Requisicoes de compra.
drop policy if exists "purchase_requests_select_operational_tenant" on public.purchase_requests;
create policy "purchase_requests_select_operational_tenant"
on public.purchase_requests for select to authenticated
using (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_member(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(unit_id)
  )
);

drop policy if exists "purchase_requests_insert_tenant_admin" on public.purchase_requests;
create policy "purchase_requests_insert_tenant_admin"
on public.purchase_requests for insert to authenticated
with check (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_admin(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(unit_id)
  )
);

drop policy if exists "purchase_requests_update_tenant_admin" on public.purchase_requests;
create policy "purchase_requests_update_tenant_admin"
on public.purchase_requests for update to authenticated
using (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_admin(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(unit_id)
  )
)
with check (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_admin(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and public.user_can_access_unit(unit_id)
  )
);
-- Planos preventivos (restricao via ativo).
drop policy if exists "maintenance_plans_select_own_operational_tenant" on public.maintenance_plans;
create policy "maintenance_plans_select_own_operational_tenant"
on public.maintenance_plans for select to authenticated
using (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_member(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and exists (
      select 1
      from public.assets asset_row
      where asset_row.id = maintenance_plans.asset_id
        and public.user_can_access_unit(asset_row.unit_id)
    )
  )
);

drop policy if exists "maintenance_plans_insert_tenant_admin" on public.maintenance_plans;
create policy "maintenance_plans_insert_tenant_admin"
on public.maintenance_plans for insert to authenticated
with check (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_admin(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and exists (
      select 1
      from public.assets asset_row
      where asset_row.id = asset_id
        and public.user_can_access_unit(asset_row.unit_id)
    )
  )
);

drop policy if exists "maintenance_plans_update_tenant_admin" on public.maintenance_plans;
create policy "maintenance_plans_update_tenant_admin"
on public.maintenance_plans for update to authenticated
using (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_admin(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and exists (
      select 1
      from public.assets asset_row
      where asset_row.id = maintenance_plans.asset_id
        and public.user_can_access_unit(asset_row.unit_id)
    )
  )
)
with check (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_admin(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and exists (
      select 1
      from public.assets asset_row
      where asset_row.id = asset_id
        and public.user_can_access_unit(asset_row.unit_id)
    )
  )
);

-- Auditoria de alteracoes de autorizacao por unidade.
create or replace function public.audit_membership_unit_access_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  membership_tenant_id uuid;
  membership_user_id uuid;
begin
  if tg_op = 'INSERT' then
    select tenant_id, user_id into membership_tenant_id, membership_user_id
    from public.tenant_memberships where id = new.membership_id;
    insert into public.audit_logs (tenant_id, actor_id, action, resource_type, resource_id, metadata)
    values (
      membership_tenant_id,
      auth.uid(),
      'unit_access_granted',
      'membership_unit_access',
      new.id::text,
      jsonb_build_object('membership_id', new.membership_id, 'user_id', membership_user_id, 'unit_id', new.unit_id)
    );
    return new;
  elsif tg_op = 'DELETE' then
    select tenant_id, user_id into membership_tenant_id, membership_user_id
    from public.tenant_memberships where id = old.membership_id;
    insert into public.audit_logs (tenant_id, actor_id, action, resource_type, resource_id, metadata)
    values (
      membership_tenant_id,
      auth.uid(),
      'unit_access_revoked',
      'membership_unit_access',
      old.id::text,
      jsonb_build_object('membership_id', old.membership_id, 'user_id', membership_user_id, 'unit_id', old.unit_id)
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists audit_membership_unit_access_change on public.membership_unit_access;
create trigger audit_membership_unit_access_change
after insert or delete on public.membership_unit_access
for each row execute function public.audit_membership_unit_access_change();

create or replace function public.audit_membership_unit_scope_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.units_access_all is distinct from old.units_access_all then
    insert into public.audit_logs (tenant_id, actor_id, action, resource_type, resource_id, metadata)
    values (
      new.tenant_id,
      auth.uid(),
      'unit_access_scope_changed',
      'tenant_memberships',
      new.id::text,
      jsonb_build_object('user_id', new.user_id, 'from_all_units', old.units_access_all, 'to_all_units', new.units_access_all)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_membership_unit_scope_change on public.tenant_memberships;
create trigger audit_membership_unit_scope_change
after update of units_access_all on public.tenant_memberships
for each row execute function public.audit_membership_unit_scope_change();
-- Leituras operacionais (restricao via ativo).
drop policy if exists "asset_operational_readings_select_own_operational_tenant" on public.asset_operational_readings;
create policy "asset_operational_readings_select_own_operational_tenant"
on public.asset_operational_readings for select to authenticated
using (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_member(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and exists (
      select 1
      from public.assets asset_row
      where asset_row.id = asset_operational_readings.asset_id
        and public.user_can_access_unit(asset_row.unit_id)
    )
  )
);

-- Contratos de ativos (restricao via ativo).
drop policy if exists "asset_contracts_select_own_operational_tenant" on public.asset_contracts;
create policy "asset_contracts_select_own_operational_tenant"
on public.asset_contracts for select to authenticated
using (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_member(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and exists (
      select 1
      from public.assets asset_row
      where asset_row.id = asset_contracts.asset_id
        and public.user_can_access_unit(asset_row.unit_id)
    )
  )
);
drop policy if exists "asset_operational_readings_insert_tenant_admin" on public.asset_operational_readings;
create policy "asset_operational_readings_insert_tenant_admin"
on public.asset_operational_readings for insert to authenticated
with check (
  public.is_netsecbr_admin()
  or (
    public.is_tenant_admin(tenant_id)
    and public.tenant_allows_operation(tenant_id)
    and exists (
      select 1
      from public.assets asset_row
      where asset_row.id = asset_id
        and public.user_can_access_unit(asset_row.unit_id)
    )
  )
);
