-- Keep-alive técnico para desenvolvimento e piloto.
-- Não lê nem altera dados de clientes.

create or replace function public.keep_alive()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  select now();
$$;

grant execute on function public.keep_alive() to anon, authenticated;
