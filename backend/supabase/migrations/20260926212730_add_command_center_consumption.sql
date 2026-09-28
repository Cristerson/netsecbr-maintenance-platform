-- Leitura consolidada de franquias e consumo real por tenant.
-- Armazenamento mede somente objetos existentes no bucket tenant-branding.

create or replace function public.get_command_center_consumption()
returns table (
  tenant_id uuid,
  legal_name text,
  trade_name text,
  tenant_status text,
  subscription_id uuid,
  subscription_status text,
  entitlement_code text,
  entitlement_name text,
  entitlement_unit text,
  limit_value bigint,
  is_unlimited boolean,
  is_configured boolean,
  consumed_value bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_netsecbr_admin() then
    raise exception 'Acesso negado ao Command Center.';
  end if;

  return query
  with current_subscriptions as (
    select distinct on (subscription.tenant_id)
      subscription.id,
      subscription.tenant_id,
      subscription.status,
      subscription.robot_limit_snapshot,
      subscription.included_storage_bytes_snapshot
    from public.subscriptions as subscription
    where subscription.status in ('trial', 'active')
    order by subscription.tenant_id, subscription.created_at desc
  ),
  current_entitlements as (
    select
      entitlement.subscription_id,
      entitlement.entitlement_code,
      entitlement.limit_value,
      entitlement.is_unlimited
    from public.subscription_entitlements as entitlement
    where entitlement.effective_to is null
  )
  select
    tenant.id,
    tenant.legal_name,
    tenant.trade_name,
    tenant.status,
    subscription.id,
    subscription.status,
    definition.code,
    definition.name,
    definition.unit,
    case
      when entitlement.entitlement_code is not null then entitlement.limit_value
      when definition.code = 'robots.registered' then subscription.robot_limit_snapshot
      when definition.code = 'storage.bytes' then subscription.included_storage_bytes_snapshot
      else null
    end,
    coalesce(entitlement.is_unlimited, false),
    (
      entitlement.entitlement_code is not null
      or (subscription.id is not null and definition.code in ('robots.registered', 'storage.bytes'))
    ),
    case definition.code
      when 'robots.registered' then (
        select count(*)::bigint
        from public.assets as asset
        join public.asset_categories as category on category.id = asset.category_id
        where asset.tenant_id = tenant.id
          and asset.deleted_at is null
          and category.is_robot = true
      )
      when 'users.active' then (
        select count(*)::bigint
        from public.tenant_memberships as membership
        join public.profiles as profile on profile.id = membership.user_id
        where membership.tenant_id = tenant.id
          and membership.is_active = true
          and profile.is_active = true
      )
      when 'units.active' then (
        select count(*)::bigint
        from public.units as unit
        where unit.tenant_id = tenant.id
          and unit.is_active = true
      )
      when 'work_orders.monthly' then (
        select count(*)::bigint
        from public.work_orders as work_order
        where work_order.tenant_id = tenant.id
          and work_order.created_at >= date_trunc('month', now())
          and work_order.created_at < date_trunc('month', now()) + interval '1 month'
      )
      when 'storage.bytes' then (
        select coalesce(sum(
          case
            when coalesce(storage_object.metadata->>'size', '') ~ '^[0-9]+$'
              then (storage_object.metadata->>'size')::bigint
            else 0
          end
        ), 0)::bigint
        from storage.objects as storage_object
        where storage_object.bucket_id = 'tenant-branding'
          and split_part(storage_object.name, '/', 1) = tenant.id::text
      )
      else 0::bigint
    end
  from public.tenants as tenant
  cross join public.entitlement_definitions as definition
  left join current_subscriptions as subscription on subscription.tenant_id = tenant.id
  left join current_entitlements as entitlement
    on entitlement.subscription_id = subscription.id
   and entitlement.entitlement_code = definition.code
  where definition.code in (
    'robots.registered',
    'users.active',
    'units.active',
    'work_orders.monthly',
    'storage.bytes'
  )
  order by tenant.trade_name, tenant.legal_name, definition.code;
end;
$$;

revoke all on function public.get_command_center_consumption() from public;
revoke all on function public.get_command_center_consumption() from anon;
grant execute on function public.get_command_center_consumption() to authenticated;
