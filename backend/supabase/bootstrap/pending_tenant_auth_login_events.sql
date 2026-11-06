-- PROPOSTA PARA REVISÃO. NÃO EXECUTAR SEM AUTORIZAÇÃO ESPECÍFICA.
-- Registra somente sessões autenticadas novas, sem token, senha, IP ou user agent.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $$
begin
  if to_regclass('public.tenant_auth_login_events') is not null
     or to_regprocedure('public.record_tenant_auth_login(uuid)') is not null then
    raise exception 'Objetos de monitoramento já existem; revisar antes de aplicar.';
  end if;
end;
$$;

create table public.tenant_auth_login_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null,
  auth_session_id uuid not null unique,
  authenticated_at timestamptz not null,
  recorded_at timestamptz not null default now()
);

create index tenant_auth_login_events_tenant_at_idx
  on public.tenant_auth_login_events (tenant_id, authenticated_at desc);
create index tenant_auth_login_events_tenant_user_at_idx
  on public.tenant_auth_login_events (tenant_id, user_id, authenticated_at desc);

alter table public.tenant_auth_login_events enable row level security;
revoke all on table public.tenant_auth_login_events from public, anon, authenticated;
grant select on table public.tenant_auth_login_events to service_role;
-- Nenhuma policy: usuários comuns não consultam nem escrevem esta tabela.

create function public.record_tenant_auth_login(target_tenant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  session_text text := (select auth.jwt() ->> 'session_id');
  session_uuid uuid;
  session_started_at timestamptz;
  inserted_count integer;
begin
  if actor_id is null or session_text is null
     or session_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Sessão autenticada inválida.' using errcode = '42501';
  end if;
  session_uuid := session_text::uuid;

  select s.created_at into session_started_at
  from auth.sessions s
  where s.id = session_uuid and s.user_id = actor_id;
  if session_started_at is null or session_started_at > now() + interval '1 minute'
     or session_started_at < now() - interval '1 hour' then
    raise exception 'Sessão não elegível para registro de login.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = target_tenant_id and m.user_id = actor_id and m.is_active = true
  ) then
    raise exception 'Usuário sem vínculo ativo com o cliente.' using errcode = '42501';
  end if;

  insert into public.tenant_auth_login_events
    (tenant_id, user_id, auth_session_id, authenticated_at)
  values (target_tenant_id, actor_id, session_uuid, session_started_at)
  on conflict (auth_session_id) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

revoke all on function public.record_tenant_auth_login(uuid) from public, anon;
grant execute on function public.record_tenant_auth_login(uuid) to authenticated;
commit;
