-- PROPOSTA PARA REVISÃO. NÃO EXECUTAR SEM APROVAÇÃO ESPECÍFICA.
-- Protege exclusivamente a conta principal confirmada em auth.users.
-- Não modifica outras contas, papéis ou dados de negócio.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if not exists (
    select 1
    from auth.users auth_user
    join public.profiles profile_row on profile_row.id = auth_user.id
    join public.platform_access_roles role_row on role_row.user_id = auth_user.id
    where auth_user.id = 'e00995cb-bc07-4ccb-9834-7798ed7f9af9'::uuid
      and lower(auth_user.email) = 'cristerson.castelanno@netsecbr.com.br'
      and auth_user.deleted_at is null
      and profile_row.platform_role = 'netsecbr_admin'
      and profile_row.is_active = true
      and role_row.role = 'owner'
      and role_row.is_active = true
  ) then
    raise exception 'A conta proprietária principal não corresponde ao estado validado; interrompendo.';
  end if;
end;
$$;

create or replace function public.protect_primary_platform_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  protected_id constant uuid := 'e00995cb-bc07-4ccb-9834-7798ed7f9af9'::uuid;
begin
  if tg_table_name = 'profiles' then
    if old.id <> protected_id then
      if tg_op = 'DELETE' then return old; end if;
      return new;
    end if;
    if tg_op = 'DELETE' then
      raise exception 'A conta proprietária principal não pode ser excluída.';
    end if;
    if new.id is distinct from old.id
       or new.platform_role is distinct from 'netsecbr_admin'::public.platform_role
       or new.is_active is distinct from true then
      raise exception 'O acesso da conta proprietária principal não pode ser removido.';
    end if;
    return new;
  end if;

  if tg_table_name = 'platform_access_roles' then
    if old.user_id <> protected_id then
      if tg_op = 'DELETE' then return old; end if;
      return new;
    end if;
    if tg_op = 'DELETE' then
      raise exception 'O papel da conta proprietária principal não pode ser excluído.';
    end if;
    if new.user_id is distinct from old.user_id
       or new.role is distinct from 'owner'
       or new.is_active is distinct from true then
      raise exception 'O papel da conta proprietária principal não pode ser rebaixado ou desativado.';
    end if;
    return new;
  end if;

  raise exception 'Tabela não permitida para a proteção da conta proprietária.';
end;
$$;

revoke all on function public.protect_primary_platform_owner() from public, anon, authenticated;

create trigger profiles_protect_primary_platform_owner
before update or delete on public.profiles
for each row execute function public.protect_primary_platform_owner();

create trigger platform_roles_protect_primary_platform_owner
before update or delete on public.platform_access_roles
for each row execute function public.protect_primary_platform_owner();

commit;

-- Reversão lógica, somente se aprovada separadamente:
-- drop trigger platform_roles_protect_primary_platform_owner on public.platform_access_roles;
-- drop trigger profiles_protect_primary_platform_owner on public.profiles;
-- drop function public.protect_primary_platform_owner();
