-- Correção de segurança: usuário comum não pode alterar o próprio papel global.
-- Execute após a migration de políticas RLS.

drop policy if exists "profiles_update_own_or_global_admin" on public.profiles;

create policy "profiles_update_global_admin_only"
on public.profiles for update to authenticated
using (public.is_netsecbr_admin())
with check (public.is_netsecbr_admin());

-- Atualizações de nome e preferências pessoais serão feitas futuramente por uma função controlada.
-- Papel global, atividade e permissões só podem ser alterados pela NETSECBR.
