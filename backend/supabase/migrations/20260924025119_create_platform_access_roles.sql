-- Fundação de governança do Command Center.
-- Mantém o papel técnico netsecbr_admin e acrescenta a responsabilidade real:
-- owner (Proprietário) ou operator (Administrador da plataforma).

create table public.platform_access_roles (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  role text not null check (role in ('owner', 'operator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_access_roles enable row level security;
grant select, insert, update on public.platform_access_roles to authenticated;

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_access_roles role_row
    join public.profiles profile_row on profile_row.id = role_row.user_id
    where role_row.user_id = auth.uid()
      and role_row.role = 'owner'
      and role_row.is_active = true
      and profile_row.platform_role = 'netsecbr_admin'
      and profile_row.is_active = true
  );
$$;

create or replace function public.is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_access_roles role_row
    join public.profiles profile_row on profile_row.id = role_row.user_id
    where role_row.user_id = auth.uid()
      and role_row.role in ('owner', 'operator')
      and role_row.is_active = true
      and profile_row.platform_role = 'netsecbr_admin'
      and profile_row.is_active = true
  );
$$;

-- Todas as policies antigas que dependem desta função passam a exigir
-- também um vínculo ativo da equipe da plataforma.
create or replace function public.is_netsecbr_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_operator();
$$;

create policy "platform_access_roles_select_own_or_owner"
on public.platform_access_roles for select to authenticated
using (user_id = auth.uid() or public.is_platform_owner());

create policy "platform_access_roles_manage_owner"
on public.platform_access_roles for all to authenticated
using (public.is_platform_owner())
with check (public.is_platform_owner());

create or replace function public.prevent_platform_owner_lockout()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.role = 'owner'
     and old.is_active = true
     and (new.role <> 'owner' or new.is_active = false) then
    if old.user_id = auth.uid() then
      raise exception 'Você não pode remover o seu próprio acesso de Proprietário.';
    end if;

    if not exists (
      select 1
      from public.platform_access_roles other_owner
      where other_owner.user_id <> old.user_id
        and other_owner.role = 'owner'
        and other_owner.is_active = true
    ) then
      raise exception 'A plataforma precisa manter pelo menos um Proprietário ativo.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger platform_access_roles_prevent_owner_lockout
before update on public.platform_access_roles
for each row execute procedure public.prevent_platform_owner_lockout();

-- Migração segura dos administradores globais já existentes. O proprietário
-- inicial é definido explicitamente; os demais seguem como Administradores.
insert into public.platform_access_roles (user_id, role)
select profile_row.id, 'operator'
from public.profiles profile_row
where profile_row.platform_role = 'netsecbr_admin'
  and profile_row.is_active = true
on conflict (user_id) do nothing;

do $$
declare
  initial_owner_id uuid;
begin
  select profile_row.id
    into initial_owner_id
  from public.profiles profile_row
  join auth.users auth_user on auth_user.id = profile_row.id
  where lower(auth_user.email) = 'cristerson.castelanno@netsecbr.com.br'
    and profile_row.platform_role = 'netsecbr_admin'
    and profile_row.is_active = true;

  if initial_owner_id is null then
    raise exception 'Não foi possível localizar o Proprietário inicial informado.';
  end if;

  update public.platform_access_roles
  set role = 'owner', is_active = true, updated_at = now()
  where user_id = initial_owner_id;
end;
$$;
