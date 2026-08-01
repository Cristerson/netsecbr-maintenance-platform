-- Entrega 3: políticas de isolamento entre tenants.
-- Execute após as migrations de fundação e de usuários/permissões.

create or replace function public.is_netsecbr_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and platform_role = 'netsecbr_admin'
      and is_active = true
  );
$$;

create or replace function public.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships
    where tenant_id = target_tenant_id
      and user_id = auth.uid()
      and is_active = true
  );
$$;

create or replace function public.is_tenant_admin(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships
    where tenant_id = target_tenant_id
      and user_id = auth.uid()
      and role = 'tenant_admin'
      and is_active = true
  );
$$;

create or replace function public.tenant_allows_operation(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenants
    where id = target_tenant_id
      and status in ('active', 'grace_period')
  );
$$;

-- Perfil: usuário vê o próprio perfil; administrador global pode administrar todos.
create policy "profiles_select_own_or_global_admin"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_netsecbr_admin());

create policy "profiles_update_own_or_global_admin"
on public.profiles for update to authenticated
using (id = auth.uid() or public.is_netsecbr_admin())
with check (id = auth.uid() or public.is_netsecbr_admin());

-- Tenant: membros consultam somente seu cliente. Somente NETSECBR administra dados globais.
create policy "tenants_select_member_or_global_admin"
on public.tenants for select to authenticated
using (public.is_tenant_member(id) or public.is_netsecbr_admin());

create policy "tenants_all_global_admin"
on public.tenants for all to authenticated
using (public.is_netsecbr_admin())
with check (public.is_netsecbr_admin());

-- Unidades e centros de custo só podem ser acessados no tenant do usuário e enquanto operacional.
create policy "cost_centers_select_own_operational_tenant"
on public.cost_centers for select to authenticated
using (
  public.is_netsecbr_admin()
  or (public.is_tenant_member(tenant_id) and public.tenant_allows_operation(tenant_id))
);

create policy "cost_centers_insert_tenant_admin"
on public.cost_centers for insert to authenticated
with check (
  public.is_netsecbr_admin()
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
);

create policy "cost_centers_update_tenant_admin"
on public.cost_centers for update to authenticated
using (
  public.is_netsecbr_admin()
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
)
with check (
  public.is_netsecbr_admin()
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
);

create policy "cost_centers_delete_tenant_admin"
on public.cost_centers for delete to authenticated
using (
  public.is_netsecbr_admin()
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
);

create policy "units_select_own_operational_tenant"
on public.units for select to authenticated
using (
  public.is_netsecbr_admin()
  or (public.is_tenant_member(tenant_id) and public.tenant_allows_operation(tenant_id))
);

create policy "units_insert_tenant_admin"
on public.units for insert to authenticated
with check (
  public.is_netsecbr_admin()
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
);

create policy "units_update_tenant_admin"
on public.units for update to authenticated
using (
  public.is_netsecbr_admin()
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
)
with check (
  public.is_netsecbr_admin()
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
);

create policy "units_delete_tenant_admin"
on public.units for delete to authenticated
using (
  public.is_netsecbr_admin()
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
);

-- Usuários do tenant: navegação consulta o próprio vínculo; administrador consulta e gerencia o tenant.
create policy "memberships_select_own_or_tenant_admin"
on public.tenant_memberships for select to authenticated
using (
  user_id = auth.uid()
  or public.is_tenant_admin(tenant_id)
  or public.is_netsecbr_admin()
);

create policy "memberships_manage_tenant_admin"
on public.tenant_memberships for all to authenticated
using (public.is_tenant_admin(tenant_id) or public.is_netsecbr_admin())
with check (public.is_tenant_admin(tenant_id) or public.is_netsecbr_admin());

create policy "permission_catalog_select_authenticated"
on public.permission_catalog for select to authenticated
using (true);

create policy "membership_permissions_select_own_or_tenant_admin"
on public.membership_permissions for select to authenticated
using (
  exists (
    select 1 from public.tenant_memberships membership
    where membership.id = membership_permissions.membership_id
      and (
        membership.user_id = auth.uid()
        or public.is_tenant_admin(membership.tenant_id)
        or public.is_netsecbr_admin()
      )
  )
);

create policy "membership_permissions_manage_tenant_admin"
on public.membership_permissions for all to authenticated
using (
  exists (
    select 1 from public.tenant_memberships membership
    where membership.id = membership_permissions.membership_id
      and (public.is_tenant_admin(membership.tenant_id) or public.is_netsecbr_admin())
  )
)
with check (
  exists (
    select 1 from public.tenant_memberships membership
    where membership.id = membership_permissions.membership_id
      and (public.is_tenant_admin(membership.tenant_id) or public.is_netsecbr_admin())
  )
);
