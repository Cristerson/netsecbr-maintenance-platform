-- Migration separada: fecha apenas as três sobreposições permissivas confirmadas.
-- Gerar o nome versionado com `supabase migration new` antes de integrar ao repo.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
do $$
begin
  if (select count(*) from pg_policies
      where schemaname = 'public' and (
        (tablename = 'work_orders' and policyname in (
          'work_orders_insert_own_operational_tenant',
          'work_orders_insert_tenant_admin_or_global_admin'))
        or (tablename = 'purchase_requests' and policyname in (
          'purchase_requests_select_operational_tenant',
          'purchase_requests_select_own_operational_tenant',
          'purchase_requests_insert_tenant_admin',
          'purchase_requests_insert_own_operational_tenant'))
    )) <> 6 then
    raise exception 'Policies de origem divergentes; não aplicar automaticamente.';
  end if;
end;
$$;

-- Uma única policy INSERT para OS: ator e unidade são obrigatórios.
drop policy if exists work_orders_insert_own_operational_tenant on public.work_orders;
drop policy if exists work_orders_insert_tenant_admin_or_global_admin on public.work_orders;
create policy work_orders_insert_tenant_admin_or_global_admin
on public.work_orders for insert to authenticated
with check (
  auth.uid() = opened_by
  -- A geração preventiva passa exclusivamente pelas RPCs com chave de ciclo.
  and type <> 'preventive'
  and (
    public.is_netsecbr_admin()
    or (
      public.is_tenant_member(tenant_id)
      and public.tenant_allows_operation(tenant_id)
      and public.user_can_access_unit(unit_id)
    )
  )
);

-- A policy antiga de SELECT de compras não exigia unidade.
drop policy if exists purchase_requests_select_operational_tenant on public.purchase_requests;

-- Uma única policy INSERT para compras: requisitante e unidade obrigatórios.
drop policy if exists purchase_requests_insert_tenant_admin on public.purchase_requests;
drop policy if exists purchase_requests_insert_own_operational_tenant on public.purchase_requests;
create policy purchase_requests_insert_own_operational_tenant
on public.purchase_requests for insert to authenticated
with check (
  auth.uid() = requested_by
  and (
    public.is_netsecbr_admin()
    or (
      public.is_tenant_admin(tenant_id)
      and public.tenant_allows_operation(tenant_id)
      and public.user_can_access_unit(unit_id)
    )
  )
);

commit;
