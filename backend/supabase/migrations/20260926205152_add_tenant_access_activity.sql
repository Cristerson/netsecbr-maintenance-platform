-- Atividade de acesso ao MARV por tenant.
-- Não armazena token, IP bruto, hostname físico nem user-agent completo.

create table public.tenant_access_activity (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  device_label text not null check (char_length(device_label) between 1 and 120),
  access_origin text not null check (char_length(access_origin) between 1 and 200),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index tenant_access_activity_tenant_last_seen_idx
  on public.tenant_access_activity (tenant_id, last_seen_at desc);

create index tenant_access_activity_user_last_seen_idx
  on public.tenant_access_activity (user_id, last_seen_at desc);

alter table public.tenant_access_activity enable row level security;

revoke all on table public.tenant_access_activity from public;
revoke all on table public.tenant_access_activity from anon;
revoke all on table public.tenant_access_activity from authenticated;
grant select, insert, update on table public.tenant_access_activity to authenticated;

create policy "tenant_access_activity_select_own_or_global_admin"
on public.tenant_access_activity
for select to authenticated
using (
  (select public.is_netsecbr_admin())
  or user_id = (select auth.uid())
);

create policy "tenant_access_activity_insert_own_membership"
on public.tenant_access_activity
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.is_tenant_member(tenant_id)
);

create policy "tenant_access_activity_update_own_membership"
on public.tenant_access_activity
for update to authenticated
using (
  user_id = (select auth.uid())
  and public.is_tenant_member(tenant_id)
)
with check (
  user_id = (select auth.uid())
  and public.is_tenant_member(tenant_id)
);

create or replace function public.record_tenant_access_activity(
  target_tenant_id uuid,
  target_session_id uuid,
  target_device_label text,
  target_access_origin text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  existing_activity public.tenant_access_activity%rowtype;
  normalized_device_label text := left(nullif(btrim(target_device_label), ''), 120);
  normalized_access_origin text := left(nullif(btrim(target_access_origin), ''), 200);
begin
  if actor_id is null then
    raise exception 'Acesso autenticado obrigatório.';
  end if;

  if target_tenant_id is null or target_session_id is null then
    raise exception 'Identificação de acesso inválida.';
  end if;

  if normalized_device_label is null or normalized_access_origin is null then
    raise exception 'Informe o dispositivo e a origem de acesso.';
  end if;

  if normalized_access_origin !~ '^https?://[^/]+$' then
    raise exception 'Origem de acesso inválida.';
  end if;

  if not public.is_tenant_member(target_tenant_id) then
    raise exception 'Você não possui acesso ativo a este cliente.';
  end if;

  select * into existing_activity
  from public.tenant_access_activity
  where id = target_session_id
  for update;

  if found then
    if existing_activity.user_id <> actor_id
       or existing_activity.tenant_id <> target_tenant_id then
      raise exception 'Identificação de sessão inválida.';
    end if;

    update public.tenant_access_activity
    set device_label = normalized_device_label,
        access_origin = normalized_access_origin,
        last_seen_at = now()
    where id = target_session_id;
  else
    insert into public.tenant_access_activity (
      id, tenant_id, user_id, device_label, access_origin
    )
    values (
      target_session_id, target_tenant_id, actor_id,
      normalized_device_label, normalized_access_origin
    );
  end if;
end;
$$;

revoke all on function public.record_tenant_access_activity(uuid, uuid, text, text) from public;
revoke all on function public.record_tenant_access_activity(uuid, uuid, text, text) from anon;
grant execute on function public.record_tenant_access_activity(uuid, uuid, text, text) to authenticated;
