-- Entrega 2: contas, perfis, vínculos com tenants e permissões configuráveis.
-- Execute este arquivo após a migration 20260801180000_create_saas_foundation.sql.

create type public.platform_role as enum (
  'netsecbr_admin',
  'netsecbr_support',
  'tenant_user'
);

create type public.membership_role as enum (
  'tenant_admin',
  'navigation'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  platform_role public.platform_role not null default 'tenant_user',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null default 'navigation',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table public.permission_catalog (
  code text primary key,
  name text not null,
  description text not null
);

create table public.membership_permissions (
  membership_id uuid not null references public.tenant_memberships(id) on delete cascade,
  permission_code text not null references public.permission_catalog(code) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (membership_id, permission_code)
);

insert into public.permission_catalog (code, name, description) values
  ('assets.read', 'Consultar ativos', 'Visualizar robôs, equipamentos e histórico.'),
  ('assets.manage', 'Gerenciar ativos', 'Cadastrar e alterar robôs e equipamentos.'),
  ('service_requests.create', 'Abrir chamados', 'Registrar solicitações de manutenção.'),
  ('work_orders.read', 'Consultar ordens de serviço', 'Visualizar ordens de serviço permitidas.'),
  ('work_orders.create', 'Criar ordens de serviço', 'Criar e planejar ordens de serviço.'),
  ('work_orders.execute', 'Executar ordens de serviço', 'Iniciar, apontar e concluir atividades.'),
  ('reports.read', 'Consultar relatórios', 'Visualizar painéis e relatórios.'),
  ('billing.manage', 'Gerenciar pagamentos', 'Consultar faturas e dados de cobrança.')
on conflict (code) do nothing;

create index idx_tenant_memberships_tenant_id on public.tenant_memberships (tenant_id);
create index idx_tenant_memberships_user_id on public.tenant_memberships (user_id);

-- Cria o perfil básico ao registrar uma nova conta no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.permission_catalog enable row level security;
alter table public.membership_permissions enable row level security;
