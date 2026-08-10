-- Entrega 6: franquias e limites específicos por contrato.
-- O catálogo é administrado pela NETSECBR; cada valor preserva seu histórico.

create table public.entitlement_definitions (
  code text primary key,
  name text not null,
  unit text not null check (unit in ('count', 'bytes', 'boolean')),
  default_period text not null check (default_period in ('contract', 'monthly')),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.entitlement_definitions (code, name, unit, default_period, description)
values
  ('robots.registered', 'Robôs cadastrados', 'count', 'contract', 'Robôs ativos ou inativos licenciados no tenant.'),
  ('storage.bytes', 'Armazenamento de arquivos', 'bytes', 'contract', 'Franquia para anexos e arquivos do tenant.'),
  ('work_orders.monthly', 'Ordens de serviço mensais', 'count', 'monthly', 'Quantidade de ordens que podem ser criadas a cada mês.'),
  ('users.active', 'Usuários ativos', 'count', 'contract', 'Pessoas com acesso ativo à plataforma.'),
  ('units.active', 'Unidades ativas', 'count', 'contract', 'Unidades operacionais disponíveis no contrato.')
on conflict (code) do nothing;

create table public.subscription_entitlements (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  entitlement_code text not null references public.entitlement_definitions(code) on delete restrict,
  limit_value bigint,
  is_unlimited boolean not null default false,
  effective_from date not null default current_date,
  effective_to date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (is_unlimited = true and limit_value is null)
    or (is_unlimited = false and limit_value is not null and limit_value >= 0)
  ),
  check (effective_to is null or effective_to >= effective_from)
);

-- Só pode existir uma franquia vigente para cada tipo de limite no contrato.
create unique index uq_subscription_entitlements_current_limit
  on public.subscription_entitlements (subscription_id, entitlement_code)
  where effective_to is null;

create index idx_subscription_entitlements_subscription_id
  on public.subscription_entitlements (subscription_id);

alter table public.entitlement_definitions enable row level security;
alter table public.subscription_entitlements enable row level security;

-- O catálogo pode ser consultado por usuários autenticados para exibir rótulos e unidades.
create policy "entitlement_definitions_select_authenticated"
on public.entitlement_definitions for select to authenticated
using (true);

create policy "entitlement_definitions_manage_global_admin"
on public.entitlement_definitions for all to authenticated
using ((select public.is_netsecbr_admin()))
with check ((select public.is_netsecbr_admin()));

-- Cliente consulta apenas as franquias do próprio contrato. Alterações são exclusivas da NETSECBR.
create policy "subscription_entitlements_select_own_tenant_or_global_admin"
on public.subscription_entitlements for select to authenticated
using (
  (select public.is_netsecbr_admin())
  or exists (
    select 1
    from public.subscriptions subscription
    where subscription.id = subscription_entitlements.subscription_id
      and public.is_tenant_member(subscription.tenant_id)
  )
);

create policy "subscription_entitlements_manage_global_admin"
on public.subscription_entitlements for all to authenticated
using ((select public.is_netsecbr_admin()))
with check ((select public.is_netsecbr_admin()));
