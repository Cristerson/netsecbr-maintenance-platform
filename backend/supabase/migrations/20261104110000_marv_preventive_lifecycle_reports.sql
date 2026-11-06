-- MARV Pacote 1: checklist revisável, OS preventiva ativa única e relatório aprovado.
-- Migration aditiva. NÃO foi aplicada a nenhum banco.
-- Dependências, em ordem cronológica: 20260928100000 (unidades), 20261031214019
-- (ciclos), 20261101120000 (checklists), 20261102120000/20261102140000 (governança
-- preventiva) e 20261102183608 (medições), já aplicadas e validadas.
-- Esta migration não reconcilia nem atualiza OS históricas; ciclos nulos continuam bloqueados.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
begin
  if to_regclass('public.maintenance_plans') is null
     or to_regclass('public.service_requests') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.tenants') is null
     or to_regclass('public.units') is null
     or to_regclass('public.cost_centers') is null
     or to_regclass('public.preventive_plan_activities') is null
     or to_regclass('public.preventive_work_order_plan_snapshots') is null
     or to_regclass('public.preventive_work_order_checklist_items') is null
     or to_regclass('public.preventive_checklist_photos') is null
     or to_regclass('public.work_order_audit_log') is null
     or to_regclass('storage.objects') is null
     or to_regprocedure('public.create_preventive_cycle_work_order(uuid,date)') is null
     or to_regprocedure('public.can_access_preventive_order(uuid,boolean)') is null
     or to_regprocedure('public.user_can_access_unit(uuid)') is null
     or to_regprocedure('public.open_preventive_nonconformity_request(uuid)') is null then
    raise exception 'Pré-condição MARV falhou. Aplicar e validar as migrations-base preventivas e de autorização por unidade antes desta migration.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='preventive_plan_activities' and column_name='measurement_parameter')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='preventive_plan_activities' and column_name='measurement_unit')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='preventive_plan_activities' and column_name='measurement_point')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='preventive_work_order_checklist_items' and column_name='configured_measurement_unit')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='preventive_work_order_checklist_items' and column_name='configured_measurement_point') then
    raise exception 'A migration pendente de configuração de medições precisa ser aplicada primeiro; esta migration não substitui nem modifica o arquivo local dela.';
  end if;
  if to_regclass('public.work_order_report_revisions') is not null
     or to_regclass('public.work_order_report_signatures') is not null
     or to_regclass('public.work_order_report_audit_log') is not null then
    raise exception 'Objetos do relatório já existem. Interrompido para revisão manual; não reaplicar.';
  end if;
  if exists (
    select 1 from public.work_orders
    where type='preventive' and asset_id is not null
      and preventive_cycle_key is not null
      and (status is null or status in ('open','in_progress','waiting_material'))
    group by tenant_id, asset_id having count(*) > 1
  ) then
    raise exception 'Existem ativos com mais de uma OS preventiva ativa com ciclo definido. Migration abortada sem alterar dados; reconciliar por OS e ativo antes de ativar o índice.';
  end if;
end;
$$;

-- A cópia do checklist fica versionada. Revisões antigas continuam referenciadas pelas OS.
alter table public.maintenance_plans
  add column if not exists checklist_revision integer not null default 1;
alter table public.preventive_plan_activities
  add column if not exists revision_number integer not null default 1;
alter table public.preventive_work_order_plan_snapshots
  add column if not exists checklist_revision integer not null default 1;

alter table public.preventive_plan_activities
  drop constraint if exists preventive_plan_activities_plan_id_position_key;
create unique index if not exists preventive_plan_activities_plan_revision_position_uidx
  on public.preventive_plan_activities(plan_id, revision_number, position);

alter table public.maintenance_plans
  drop constraint if exists maintenance_plans_checklist_revision_positive;
alter table public.maintenance_plans
  add constraint maintenance_plans_checklist_revision_positive check (checklist_revision >= 1);
alter table public.preventive_plan_activities
  drop constraint if exists preventive_plan_activities_revision_positive;
alter table public.preventive_plan_activities
  add constraint preventive_plan_activities_revision_positive check (revision_number >= 1);
alter table public.preventive_work_order_plan_snapshots
  drop constraint if exists preventive_snapshot_checklist_revision_positive;
alter table public.preventive_work_order_plan_snapshots
  add constraint preventive_snapshot_checklist_revision_positive check (checklist_revision >= 1);

-- Uma preventiva ativa com ciclo definido por ativo; OS legadas sem ciclo permanecem intactas.
create unique index if not exists work_orders_one_active_preventive_per_asset
  on public.work_orders(tenant_id, asset_id)
  where type='preventive' and asset_id is not null and preventive_cycle_key is not null
    and (status is null or status in ('open','in_progress','waiting_material'));

create or replace function public.capture_preventive_snapshot_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare current_revision integer;
begin
  select plan.checklist_revision into current_revision
  from public.maintenance_plans plan
  where plan.id = new.maintenance_plan_id
    and plan.tenant_id = new.tenant_id;
  if current_revision is null then
    raise exception 'Não foi possível fixar a revisão do plano no snapshot da OS.';
  end if;
  new.checklist_revision := current_revision;
  return new;
end;
$$;
revoke all on function public.capture_preventive_snapshot_revision() from public, anon, authenticated;
drop trigger if exists preventive_snapshot_capture_revision on public.preventive_work_order_plan_snapshots;
create trigger preventive_snapshot_capture_revision
before insert on public.preventive_work_order_plan_snapshots
for each row execute function public.capture_preventive_snapshot_revision();

-- Corrige leitura de atividades, snapshots e fotos para respeitar tenant E unidade.
drop policy if exists preventive_plan_activities_read on public.preventive_plan_activities;
create policy preventive_plan_activities_read on public.preventive_plan_activities
for select to authenticated using (
  exists (
    select 1
    from public.maintenance_plans plan
    join public.assets asset on asset.id = plan.asset_id
    where plan.id = preventive_plan_activities.plan_id
      and plan.tenant_id = preventive_plan_activities.tenant_id
      and (public.is_netsecbr_admin() or (
        public.is_tenant_member(plan.tenant_id)
        and public.tenant_allows_operation(plan.tenant_id)
        and public.user_can_access_unit(asset.unit_id)
      ))
  )
);

drop policy if exists preventive_snapshots_select_visible_order on public.preventive_work_order_plan_snapshots;
create policy preventive_snapshots_select_visible_order
on public.preventive_work_order_plan_snapshots for select to authenticated using (
  exists (
    select 1 from public.work_orders work_order
    where work_order.id = preventive_work_order_plan_snapshots.work_order_id
      and work_order.tenant_id = preventive_work_order_plan_snapshots.tenant_id
      and public.can_access_preventive_order(work_order.id, false)
  )
);

drop policy if exists preventive_photos_read on public.preventive_checklist_photos;
create policy preventive_photos_read on public.preventive_checklist_photos
for select to authenticated using (
  exists (
    select 1 from public.preventive_work_order_checklist_items item
    where item.id = preventive_checklist_photos.checklist_item_id
      and item.tenant_id = preventive_checklist_photos.tenant_id
      and public.can_access_preventive_order(item.work_order_id, false)
  )
);

-- A regra de assinatura é explícita por OS. O default false evita impor aceite em toda preventiva.
alter table public.work_orders
  add column if not exists preventive_acceptance_required boolean not null default false;
alter table public.work_orders
  drop constraint if exists work_orders_preventive_acceptance_type_check;
alter table public.work_orders
  add constraint work_orders_preventive_acceptance_type_check
  check (not preventive_acceptance_required or type = 'preventive');

create table public.work_order_report_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  revision_number integer not null check (revision_number >= 1),
  state text not null default 'draft' check (state in ('draft','submitted','returned','approved')),
  is_current boolean not null default true,
  acceptance_required boolean not null default false,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_reason text,
  pdf_storage_path text,
  pdf_sha256 text check (pdf_sha256 is null or pdf_sha256 ~ '^[0-9a-f]{64}$'),
  pdf_byte_count bigint check (pdf_byte_count is null or pdf_byte_count between 1 and 20971520),
  pdf_generated_by uuid references public.profiles(id) on delete set null,
  pdf_generated_at timestamptz,
  unique (work_order_id, revision_number),
  check ((state = 'draft' and submitted_at is null) or state <> 'draft'),
  check ((state in ('approved','returned') and reviewed_at is not null and reviewed_by is not null) or state not in ('approved','returned')),
  check ((pdf_storage_path is null and pdf_sha256 is null and pdf_generated_at is null)
      or (pdf_storage_path is not null and pdf_sha256 is not null and pdf_generated_at is not null))
);
create unique index work_order_report_one_current_revision_uidx
  on public.work_order_report_revisions(work_order_id) where is_current;
create index work_order_report_revisions_tenant_order_idx
  on public.work_order_report_revisions(tenant_id, work_order_id, revision_number desc);

create table public.work_order_report_signatures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  report_revision_id uuid not null unique references public.work_order_report_revisions(id) on delete restrict,
  representative_name text not null check (char_length(btrim(representative_name)) between 2 and 160),
  storage_path text not null unique,
  captured_by uuid not null references public.profiles(id) on delete restrict,
  collector_name text,
  captured_at timestamptz not null default now()
);
create index work_order_report_signatures_order_idx
  on public.work_order_report_signatures(tenant_id, work_order_id);

create table public.work_order_report_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  report_revision_id uuid not null references public.work_order_report_revisions(id) on delete restrict,
  event_type text not null check (event_type in ('draft_created','submitted','approved','returned','signature_collected','pdf_generated','work_order_completed')),
  state_before text,
  state_after text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_by_name text,
  details jsonb not null default '{}'::jsonb,
  changed_at timestamptz not null default now()
);
create index work_order_report_audit_order_changed_idx
  on public.work_order_report_audit_log(work_order_id, changed_at desc);

alter table public.work_order_report_revisions enable row level security;
alter table public.work_order_report_signatures enable row level security;
alter table public.work_order_report_audit_log enable row level security;
revoke all on public.work_order_report_revisions, public.work_order_report_signatures,
  public.work_order_report_audit_log from anon, authenticated;
grant select on public.work_order_report_revisions, public.work_order_report_signatures,
  public.work_order_report_audit_log to authenticated;

create policy work_order_report_revisions_read on public.work_order_report_revisions
for select to authenticated using (public.can_access_preventive_order(work_order_id, false));
create policy work_order_report_signatures_read on public.work_order_report_signatures
for select to authenticated using (public.can_access_preventive_order(work_order_id, false));
create policy work_order_report_audit_read on public.work_order_report_audit_log
for select to authenticated using (public.can_access_preventive_order(work_order_id, false));

-- Relatório privado. O arquivo só pode ser criado para uma revisão aprovada e autorizada.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('work-order-reports','work-order-reports',false,20971520,array['application/pdf','image/png'])
on conflict (id) do nothing;
do $$
begin
  if not exists (select 1 from storage.buckets
    where id='work-order-reports' and public=false and file_size_limit=20971520
      and allowed_mime_types @> array['application/pdf','image/png']::text[]
      and cardinality(allowed_mime_types)=2) then
    raise exception 'Bucket work-order-reports deve ser privado, aceitar PDF/PNG e limitar arquivos a 20 MB.';
  end if;
end;
$$;

create or replace function public.can_access_work_order_report_path(target_path text, writing boolean default false)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare parts text[]; tenant_uuid uuid; order_uuid uuid; revision_uuid uuid;
        revision_row public.work_order_report_revisions%rowtype;
begin
  if auth.uid() is null or target_path is null then return false; end if;
  parts := string_to_array(target_path, '/');
  if array_length(parts,1) <> 4
     or parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or parts[4] not in ('report.pdf','signature.png') then return false; end if;
  tenant_uuid := parts[1]::uuid;
  order_uuid := parts[2]::uuid;
  revision_uuid := parts[3]::uuid;
  select * into revision_row from public.work_order_report_revisions revision
  where revision.id=revision_uuid and revision.tenant_id=tenant_uuid
    and revision.work_order_id=order_uuid and revision.is_current;
  if revision_row.id is null or not public.can_access_preventive_order(order_uuid, writing) then
    return false;
  end if;
  if not writing then return true; end if;
  if revision_row.state <> 'approved' or revision_row.pdf_storage_path is not null then
    if parts[4] = 'report.pdf' then return false; end if;
  end if;
  if parts[4] = 'signature.png' then
    return revision_row.state='approved' and revision_row.acceptance_required
      and not exists (select 1 from public.work_order_report_signatures signature
                      where signature.report_revision_id=revision_row.id);
  end if;
  return revision_row.state='approved'
    and (not revision_row.acceptance_required or exists (
      select 1 from public.work_order_report_signatures signature
      where signature.report_revision_id=revision_row.id
    ))
    and revision_row.pdf_storage_path is null;
end;
$$;
revoke all on function public.can_access_work_order_report_path(text,boolean) from public, anon;
grant execute on function public.can_access_work_order_report_path(text,boolean) to authenticated;

drop policy if exists work_order_reports_read on storage.objects;
create policy work_order_reports_read on storage.objects for select to authenticated
using (bucket_id='work-order-reports' and public.can_access_work_order_report_path(name,false));
drop policy if exists work_order_reports_insert on storage.objects;
create policy work_order_reports_insert on storage.objects for insert to authenticated
with check (bucket_id='work-order-reports'
  and (string_to_array(name,'/'))[4]='signature.png'
  and public.can_access_work_order_report_path(name,true));
drop policy if exists work_order_reports_delete_unattached on storage.objects;
create policy work_order_reports_delete_unattached on storage.objects for delete to authenticated
using (bucket_id='work-order-reports' and public.can_access_work_order_report_path(name,true));

create or replace function public.configure_preventive_plan_checklist(
  target_plan_id uuid, target_template_id uuid, target_activities jsonb
) returns integer
language plpgsql security definer set search_path = '' as $$
declare plan_row public.maintenance_plans%rowtype; asset_unit uuid;
        activity_count integer; next_revision integer;
begin
  if auth.uid() is null then raise exception 'Sessão autenticada obrigatória.'; end if;
  select * into plan_row from public.maintenance_plans plan where plan.id=target_plan_id for update;
  if plan_row.id is null or not (public.is_netsecbr_admin() or public.is_tenant_admin(plan_row.tenant_id)) then
    raise exception 'Plano inexistente ou sem permissão.';
  end if;
  select asset.unit_id into asset_unit from public.assets asset
  where asset.id=plan_row.asset_id and asset.deleted_at is null;
  if asset_unit is null or not public.tenant_allows_operation(plan_row.tenant_id)
     or (not public.is_netsecbr_admin() and not public.user_can_access_unit(asset_unit)) then
    raise exception 'Ativo fora das unidades autorizadas ou operação indisponível.';
  end if;
  if target_template_id is not null and
     (target_template_id <> 'eb7a15e6-411d-43d9-8a14-ffed237a97e9'::uuid or
      not exists (select 1 from public.preventive_templates where id=target_template_id and is_active)) then
    raise exception 'Modelo preventivo indisponível.';
  end if;
  if jsonb_typeof(target_activities) is distinct from 'array' then
    raise exception 'O checklist deve ser enviado como uma lista.';
  end if;
  if jsonb_array_length(target_activities) not between 1 and 100 then
    raise exception 'O checklist deve conter de 1 a 100 atividades.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(target_activities) activity(value)
    where length(btrim(coalesce(activity.value->>'title',''))) not between 3 and 180
      or length(coalesce(activity.value->>'instruction','')) > 3000
      or length(coalesce(activity.value->>'measurement_parameter','')) > 120
      or length(coalesce(activity.value->>'measurement_unit','')) > 40
      or length(coalesce(activity.value->>'measurement_point','')) > 160
      or (nullif(btrim(activity.value->>'measurement_parameter'),'') is null and
          (nullif(btrim(activity.value->>'measurement_unit'),'') is not null or
           nullif(btrim(activity.value->>'measurement_point'),'') is not null))
      or (nullif(btrim(activity.value->>'measurement_parameter'),'') is not null and
          (nullif(btrim(activity.value->>'measurement_unit'),'') is null or
           nullif(btrim(activity.value->>'measurement_point'),'') is null))
  ) then raise exception 'Revise título, instrução e configure parâmetro, unidade e ponto de medição juntos.'; end if;

  select case when count(*)=0 then 1 else coalesce(max(activity.revision_number),0)+1 end
    into next_revision
  from public.preventive_plan_activities activity where activity.plan_id=target_plan_id;
  insert into public.preventive_plan_activities
    (tenant_id,plan_id,revision_number,position,title,instruction,is_optional,requires_photo,
     measurement_parameter,measurement_unit,measurement_point)
  select plan_row.tenant_id,target_plan_id,next_revision,activity.ordinality::integer,
    btrim(activity.value->>'title'),nullif(btrim(activity.value->>'instruction'),''),
    coalesce((activity.value->>'is_optional')::boolean,false),
    coalesce((activity.value->>'requires_photo')::boolean,false),
    nullif(btrim(activity.value->>'measurement_parameter'),''),
    nullif(btrim(activity.value->>'measurement_unit'),''),
    nullif(btrim(activity.value->>'measurement_point'),'')
  from jsonb_array_elements(target_activities) with ordinality activity(value,ordinality);
  get diagnostics activity_count = row_count;
  if activity_count <> jsonb_array_length(target_activities) then
    raise exception 'O checklist não foi persistido integralmente.';
  end if;
  update public.maintenance_plans plan
  set preventive_template_id=target_template_id, checklist_revision=next_revision, updated_at=now()
  where plan.id=target_plan_id;
  return activity_count;
end;
$$;
revoke all on function public.configure_preventive_plan_checklist(uuid,uuid,jsonb) from public, anon;
grant execute on function public.configure_preventive_plan_checklist(uuid,uuid,jsonb) to authenticated;

-- Renomeia a implementação antiga, mantendo-a somente como detalhe interno do wrapper validado.
alter function public.create_preventive_cycle_work_order(uuid,date)
  rename to create_preventive_cycle_work_order_unchecked;
revoke all on function public.create_preventive_cycle_work_order_unchecked(uuid,date) from public, anon, authenticated;
create function public.create_preventive_cycle_work_order(target_plan_id uuid,target_original_due_date date)
returns table(work_order_id uuid,order_number bigint,next_due_date date,was_existing boolean)
language plpgsql security definer set search_path = '' as $$
declare plan_row public.maintenance_plans%rowtype; asset_row public.assets%rowtype;
        plan_ids uuid[]; cycle_year integer; activity_count integer;
begin
  if auth.uid() is null or target_original_due_date is null then
    raise exception 'Sessão autenticada e vencimento original são obrigatórios.';
  end if;
  select plan.* into plan_row from public.maintenance_plans plan where plan.id=target_plan_id;
  if plan_row.id is null then raise exception 'Plano preventivo não encontrado.'; end if;
  select asset.* into asset_row from public.assets asset where asset.id=plan_row.asset_id for update;
  if asset_row.id is null or asset_row.deleted_at is not null then raise exception 'Ativo do plano indisponível.'; end if;
  select plan.* into plan_row from public.maintenance_plans plan where plan.id=target_plan_id for update;
  if not (public.is_netsecbr_admin() or public.is_tenant_admin(plan_row.tenant_id)) then
    raise exception 'Somente supervisor autorizado pode gerar OS preventiva.';
  end if;
  if not public.is_netsecbr_admin() and not public.user_can_access_unit(asset_row.unit_id) then
    raise exception 'O ativo está fora das unidades autorizadas.';
  end if;
  if not public.tenant_allows_operation(plan_row.tenant_id) or not plan_row.is_active then
    raise exception 'Cliente ou plano não está liberado para gerar OS preventiva.';
  end if;
  if plan_row.cycle_policy='annual_calendar' then
    cycle_year:=extract(year from target_original_due_date)::integer;
    select array_agg(plan.id order by plan.id) into plan_ids
    from public.maintenance_plans plan
    where plan.tenant_id=plan_row.tenant_id and plan.asset_id=plan_row.asset_id
      and plan.is_active and plan.cycle_policy='annual_calendar'
      and extract(year from plan.next_due_date)::integer=cycle_year;
    perform 1 from public.maintenance_plans plan where plan.id=any(plan_ids)
      order by plan.id for update;
  else
    plan_ids:=array[plan_row.id];
  end if;
  if exists (
    select 1 from public.maintenance_plans grouped_plan
    where grouped_plan.id=any(plan_ids)
      and not exists (select 1 from public.preventive_plan_activities activity
        where activity.plan_id=grouped_plan.id
          and activity.tenant_id=grouped_plan.tenant_id
          and activity.revision_number=grouped_plan.checklist_revision)
  ) then raise exception 'Todos os planos agrupados no ciclo anual precisam ter atividades configuradas.'; end if;
  select count(*) into activity_count
  from public.preventive_plan_activities activity
  join public.maintenance_plans plan on plan.id=activity.plan_id
  where activity.plan_id=any(plan_ids) and activity.tenant_id=plan_row.tenant_id
    and activity.revision_number=plan.checklist_revision;
  if activity_count=0 then raise exception 'Configure e confirme atividades no plano antes de gerar a OS.'; end if;
  return query select * from public.create_preventive_cycle_work_order_unchecked(
    target_plan_id,target_original_due_date);
end;
$$;
revoke all on function public.create_preventive_cycle_work_order(uuid,date) from public, anon;
grant execute on function public.create_preventive_cycle_work_order(uuid,date) to authenticated;

create or replace function public.initialize_preventive_checklist(target_order_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare order_row public.work_orders%rowtype; activity_count integer;
begin
  if auth.uid() is null or not public.can_access_preventive_order(target_order_id,true) then
    raise exception 'Sem permissão para executar esta OS preventiva.';
  end if;
  select work_order.* into order_row from public.work_orders work_order
  where work_order.id=target_order_id for update;
  if order_row.id is null or order_row.type<>'preventive' then raise exception 'OS preventiva não encontrada.'; end if;
  -- Não retrofita nem inicializa OS históricas sem chave/snapshot de ciclo.
  if order_row.preventive_cycle_key is null then return 0; end if;
  insert into public.preventive_work_order_checklist_items
    (tenant_id,work_order_id,plan_activity_id,position,title,instruction,is_optional,requires_photo,
     measurement_parameter,configured_measurement_unit,configured_measurement_point)
  select order_row.tenant_id,order_row.id,activity.id,
    row_number() over (order by snapshot.maintenance_plan_id,activity.position)::integer,
    activity.title,activity.instruction,activity.is_optional,activity.requires_photo,
    activity.measurement_parameter,activity.measurement_unit,activity.measurement_point
  from public.preventive_work_order_plan_snapshots snapshot
  join public.preventive_plan_activities activity
    on activity.plan_id=snapshot.maintenance_plan_id
   and activity.revision_number=snapshot.checklist_revision
   and activity.tenant_id=snapshot.tenant_id
  where snapshot.work_order_id=order_row.id and snapshot.tenant_id=order_row.tenant_id
  on conflict(work_order_id,plan_activity_id) do nothing;
  select count(*) into activity_count from public.preventive_work_order_checklist_items item
  where item.work_order_id=target_order_id and item.tenant_id=order_row.tenant_id;
  return activity_count;
end;
$$;
revoke all on function public.initialize_preventive_checklist(uuid) from public, anon;
grant execute on function public.initialize_preventive_checklist(uuid) to authenticated;

create or replace function public.build_preventive_report_snapshot(target_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare snapshot_json jsonb;
begin
  if auth.uid() is null or not public.can_access_preventive_order(target_order_id,false) then
    raise exception 'Sem acesso à OS preventiva.';
  end if;
  select jsonb_build_object(
    'brand',jsonb_build_object('product','MARV','operator','NETSECBR'),
    'tenant_name',coalesce(nullif(tenant_row.trade_name,''),tenant_row.legal_name),
    'unit_name',unit_row.name,'cost_center_name',cost_center.name,
    'asset',case when asset_row.id is null then null else jsonb_build_object(
      'code',asset_row.code,'name',asset_row.name,'manufacturer',asset_row.manufacturer,
      'model',asset_row.model,'serial_number',asset_row.serial_number) end,
    'order',jsonb_build_object('number',work_order.order_number,'title',work_order.title,
      'description',work_order.description,'opened_at',work_order.opened_at,
      'scheduled_for',work_order.scheduled_for,'status',work_order.status,
      'action_taken',work_order.action_taken,'resolution_notes',work_order.resolution_notes,
      'technician_name',coalesce(nullif(assigned.full_name,''),nullif(opened.full_name,''),'Responsável não identificado')),
    'acceptance_required',work_order.preventive_acceptance_required,
    'activities',coalesce((select jsonb_agg(jsonb_build_object(
      'position',item.position,'title',item.title,'instruction',item.instruction,
      'optional',item.is_optional,'requires_photo',item.requires_photo,'result',item.result,
      'measurement_parameter',item.measurement_parameter,'measurement_value',item.measurement_value,
      'measurement_unit',coalesce(item.measurement_unit,item.configured_measurement_unit),
      'measurement_point',coalesce(item.measurement_point,item.configured_measurement_point),
      'notes',item.notes,'nonconformity',item.nonconformity,
      'responsible_name',responsible.full_name,'nonconformity_request_number',request.request_number,
      'photos',coalesce((select jsonb_agg(jsonb_build_object('storage_path',photo.storage_path,
        'captured_at',photo.created_at) order by photo.created_at)
        from public.preventive_checklist_photos photo where photo.checklist_item_id=item.id),'[]'::jsonb)
    ) order by item.position)
      from public.preventive_work_order_checklist_items item
      left join public.profiles responsible on responsible.id=item.responsible_user_id
      left join public.service_requests request on request.id=item.nonconformity_request_id
      where item.work_order_id=work_order.id and item.tenant_id=work_order.tenant_id),'[]'::jsonb),
    'captured_at',now()
  ) into snapshot_json
  from public.work_orders work_order
  join public.tenants tenant_row on tenant_row.id=work_order.tenant_id
  join public.units unit_row on unit_row.id=work_order.unit_id
  join public.cost_centers cost_center on cost_center.id=work_order.cost_center_id
  left join public.assets asset_row on asset_row.id=work_order.asset_id
  left join public.profiles assigned on assigned.id=work_order.assigned_to
  left join public.profiles opened on opened.id=work_order.opened_by
  where work_order.id=target_order_id and work_order.type='preventive'
    and work_order.preventive_cycle_key is not null;
  if snapshot_json is null then raise exception 'OS preventiva histórica ou indisponível para novo relatório.'; end if;
  return snapshot_json;
end;
$$;
revoke all on function public.build_preventive_report_snapshot(uuid) from public, anon, authenticated;

create or replace function public.record_work_order_report_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare event_name text; actor_name text;
begin
  select profile.full_name into actor_name from public.profiles profile where profile.id=auth.uid();
  if tg_op='INSERT' then
    event_name:='draft_created';
    insert into public.work_order_report_audit_log(tenant_id,work_order_id,report_revision_id,event_type,
      state_after,changed_by,changed_by_name,details)
    values(new.tenant_id,new.work_order_id,new.id,event_name,new.state,auth.uid(),actor_name,
      jsonb_build_object('revision_number',new.revision_number));
    return new;
  end if;
  if old.state is distinct from new.state then
    event_name:=case new.state when 'submitted' then 'submitted' when 'approved' then 'approved' when 'returned' then 'returned' else 'draft_created' end;
    insert into public.work_order_report_audit_log(tenant_id,work_order_id,report_revision_id,event_type,
      state_before,state_after,changed_by,changed_by_name,details)
    values(new.tenant_id,new.work_order_id,new.id,event_name,old.state,new.state,auth.uid(),actor_name,
      jsonb_build_object('revision_number',new.revision_number,'review_reason',new.review_reason));
  end if;
  if old.pdf_storage_path is distinct from new.pdf_storage_path and new.pdf_storage_path is not null then
    insert into public.work_order_report_audit_log(tenant_id,work_order_id,report_revision_id,event_type,
      state_before,state_after,changed_by,changed_by_name,details)
    values(new.tenant_id,new.work_order_id,new.id,'pdf_generated',new.state,new.state,auth.uid(),actor_name,
      jsonb_build_object('revision_number',new.revision_number,'sha256',new.pdf_sha256,'bytes',new.pdf_byte_count));
  end if;
  return new;
end;
$$;
revoke all on function public.record_work_order_report_audit() from public, anon, authenticated;
drop trigger if exists work_order_report_revision_audit on public.work_order_report_revisions;
create trigger work_order_report_revision_audit after insert or update on public.work_order_report_revisions
for each row execute function public.record_work_order_report_audit();

create or replace function public.protect_work_order_report_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id
     or new.work_order_id is distinct from old.work_order_id
     or new.revision_number is distinct from old.revision_number
     or new.acceptance_required is distinct from old.acceptance_required
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'Identidade da revisão do relatório é imutável.';
  end if;
  if new.snapshot is distinct from old.snapshot
     and not (old.state='draft' and new.state='submitted') then
    raise exception 'Snapshot submetido/aprovado é imutável; crie uma nova revisão.';
  end if;
  if old.is_current=false and new.is_current=true then raise exception 'Revisão antiga não pode voltar a ser a atual.'; end if;
  if old.state is distinct from new.state and not (
       (old.state='draft' and new.state='submitted')
       or (old.state='submitted' and new.state in ('approved','returned'))
  ) then raise exception 'Transição de estado do relatório inválida.'; end if;
  if old.pdf_storage_path is not null and (
       new.pdf_storage_path is distinct from old.pdf_storage_path
       or new.pdf_sha256 is distinct from old.pdf_sha256
       or new.pdf_byte_count is distinct from old.pdf_byte_count
       or new.pdf_generated_at is distinct from old.pdf_generated_at
       or new.pdf_generated_by is distinct from old.pdf_generated_by
  ) then raise exception 'PDF arquivado é imutável; crie uma nova revisão.'; end if;
  if old.pdf_storage_path is null and new.pdf_storage_path is not null and new.state<>'approved' then
    raise exception 'Somente relatório aprovado pode receber PDF final.';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_work_order_report_revision() from public, anon, authenticated;
drop trigger if exists work_order_report_revision_immutable on public.work_order_report_revisions;
create trigger work_order_report_revision_immutable before update on public.work_order_report_revisions
for each row execute function public.protect_work_order_report_revision();

create or replace function public.record_work_order_report_signature_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.work_order_report_audit_log(tenant_id,work_order_id,report_revision_id,event_type,
    state_before,state_after,changed_by,changed_by_name,details)
  values(new.tenant_id,new.work_order_id,new.report_revision_id,'signature_collected','approved','approved',
    new.captured_by,new.collector_name,jsonb_build_object('representative_name',new.representative_name,
      'captured_at',new.captured_at));
  return new;
end;
$$;
revoke all on function public.record_work_order_report_signature_audit() from public, anon, authenticated;
create trigger work_order_report_signature_audit after insert on public.work_order_report_signatures
for each row execute function public.record_work_order_report_signature_audit();

-- Só o supervisor pode definir a exigência de aceite, e somente antes de iniciar a trilha do relatório.
create or replace function public.guard_preventive_acceptance_requirement()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.preventive_acceptance_required is distinct from old.preventive_acceptance_required then
    if old.type<>'preventive' or old.preventive_cycle_key is null
       or old.status in ('completed','cancelled') then
      raise exception 'Aceite por representante só pode ser configurado em OS preventiva ativa com ciclo comprovado.';
    end if;
    if not (public.is_netsecbr_admin() or public.is_tenant_admin(old.tenant_id)) then
      raise exception 'Somente supervisor autenticado pode definir a exigência de assinatura.';
    end if;
    if not public.is_netsecbr_admin() and not public.user_can_access_unit(old.unit_id) then
      raise exception 'O supervisor não tem acesso à unidade desta OS.';
    end if;
    if exists (select 1 from public.work_order_report_revisions revision where revision.work_order_id=old.id) then
      raise exception 'A exigência de aceite fica bloqueada após iniciar o relatório; a decisão já está auditada.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_preventive_acceptance_requirement() from public, anon, authenticated;
drop trigger if exists work_orders_guard_preventive_acceptance_requirement on public.work_orders;
create trigger work_orders_guard_preventive_acceptance_requirement
before update on public.work_orders for each row execute function public.guard_preventive_acceptance_requirement();

create or replace function public.set_preventive_acceptance_required(target_order_id uuid,target_required boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare order_row public.work_orders%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão autenticada obrigatória.'; end if;
  select work_order.* into order_row from public.work_orders work_order
  where work_order.id=target_order_id for update;
  if order_row.id is null or order_row.type<>'preventive' or order_row.preventive_cycle_key is null
     or order_row.status in ('completed','cancelled') then
    raise exception 'OS preventiva ativa com ciclo comprovado não encontrada.';
  end if;
  if not (public.is_netsecbr_admin() or public.is_tenant_admin(order_row.tenant_id))
     or not public.user_can_access_unit(order_row.unit_id) then
    raise exception 'Somente supervisor da unidade pode definir o aceite.';
  end if;
  if exists (select 1 from public.work_order_report_revisions revision where revision.work_order_id=target_order_id) then
    raise exception 'A decisão de aceite já foi fixada para este relatório.';
  end if;
  update public.work_orders set preventive_acceptance_required=target_required where id=target_order_id;
  return true;
end;
$$;
revoke all on function public.set_preventive_acceptance_required(uuid,boolean) from public, anon;
grant execute on function public.set_preventive_acceptance_required(uuid,boolean) to authenticated;

create or replace function public.create_preventive_report_revision(target_order_id uuid)
returns table(report_revision_id uuid,revision_number integer,state text)
language plpgsql security definer set search_path = '' as $$
declare order_row public.work_orders%rowtype; current_row public.work_order_report_revisions%rowtype;
        next_revision integer; snapshot_json jsonb;
begin
  if auth.uid() is null or not public.can_access_preventive_order(target_order_id,true) then
    raise exception 'Sem permissão para preparar o relatório desta OS.';
  end if;
  select work_order.* into order_row from public.work_orders work_order
  where work_order.id=target_order_id for update;
  if order_row.id is null or order_row.type<>'preventive' or order_row.preventive_cycle_key is null
     or order_row.status in ('completed','cancelled') then
    raise exception 'OS preventiva histórica ou encerrada não pode iniciar nova revisão.';
  end if;
  select revision.* into current_row from public.work_order_report_revisions revision
  where revision.work_order_id=target_order_id and revision.is_current for update;
  if current_row.id is not null and current_row.state in ('draft','submitted','approved') then
    report_revision_id:=current_row.id; revision_number:=current_row.revision_number; state:=current_row.state;
    return next; return;
  end if;
  snapshot_json:=public.build_preventive_report_snapshot(target_order_id);
  select coalesce(max(revision.revision_number),0)+1 into next_revision
  from public.work_order_report_revisions revision where revision.work_order_id=target_order_id;
  if current_row.id is not null then
    update public.work_order_report_revisions set is_current=false where id=current_row.id;
  end if;
  insert into public.work_order_report_revisions(tenant_id,work_order_id,revision_number,state,is_current,
    acceptance_required,snapshot,created_by)
  values(order_row.tenant_id,target_order_id,next_revision,'draft',true,
    order_row.preventive_acceptance_required,snapshot_json,auth.uid())
  returning id,work_order_report_revisions.revision_number,work_order_report_revisions.state
    into report_revision_id,revision_number,state;
  return next;
end;
$$;
revoke all on function public.create_preventive_report_revision(uuid) from public, anon;
grant execute on function public.create_preventive_report_revision(uuid) to authenticated;

create or replace function public.submit_preventive_report_revision(target_revision_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare revision_row public.work_order_report_revisions%rowtype;
        order_row public.work_orders%rowtype; parent_order_id uuid; snapshot_json jsonb;
begin
  if auth.uid() is null then raise exception 'Sessão autenticada obrigatória.'; end if;
  select revision.work_order_id into parent_order_id
  from public.work_order_report_revisions revision where revision.id=target_revision_id;
  if parent_order_id is null then raise exception 'Rascunho atual não encontrado.'; end if;
  select work_order.* into order_row from public.work_orders work_order
  where work_order.id=parent_order_id for update;
  if order_row.id is null or order_row.status in ('completed','cancelled')
     or order_row.preventive_cycle_key is null
     or not public.can_access_preventive_order(order_row.id,true) then
    raise exception 'OS preventiva ativa não encontrada ou sem permissão.';
  end if;
  select revision.* into revision_row from public.work_order_report_revisions revision
  where revision.id=target_revision_id for update;
  if revision_row.id is null or not revision_row.is_current or revision_row.state<>'draft'
     or not public.can_access_preventive_order(revision_row.work_order_id,true) then
    raise exception 'Rascunho atual não encontrado ou sem permissão.';
  end if;
  snapshot_json:=public.build_preventive_report_snapshot(revision_row.work_order_id);
  if jsonb_array_length(coalesce(snapshot_json->'activities','[]'::jsonb))=0 then
    raise exception 'A OS precisa ter atividades persistidas antes de enviar o relatório.';
  end if;
  update public.work_order_report_revisions set state='submitted',snapshot=snapshot_json,
    submitted_by=auth.uid(),submitted_at=now() where id=target_revision_id;
  return true;
end;
$$;
revoke all on function public.submit_preventive_report_revision(uuid) from public, anon;
grant execute on function public.submit_preventive_report_revision(uuid) to authenticated;

create or replace function public.review_preventive_report_revision(
  target_revision_id uuid,decision text,reason text default null
) returns text language plpgsql security definer set search_path = '' as $$
declare revision_row public.work_order_report_revisions%rowtype; order_row public.work_orders%rowtype;
        reviewer_name text; parent_order_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessão autenticada obrigatória.'; end if;
  if decision not in ('approve','return') then raise exception 'Escolha aprovar ou devolver.'; end if;
  if decision='return' and length(btrim(coalesce(reason,'')))<5 then
    raise exception 'Informe o motivo da devolução (mínimo 5 caracteres).';
  end if;
  select revision.work_order_id into parent_order_id from public.work_order_report_revisions revision
  where revision.id=target_revision_id;
  if parent_order_id is null then raise exception 'O relatório atual não está aguardando revisão.'; end if;
  select work_order.* into order_row from public.work_orders work_order
  where work_order.id=parent_order_id for update;
  if order_row.id is null or order_row.type<>'preventive' or order_row.preventive_cycle_key is null
     or order_row.status in ('completed','cancelled')
     or not (public.is_netsecbr_admin() or public.is_tenant_admin(order_row.tenant_id))
     or not public.user_can_access_unit(order_row.unit_id) then
    raise exception 'Somente supervisor autenticado da unidade pode revisar o relatório.';
  end if;
  select revision.* into revision_row from public.work_order_report_revisions revision
  where revision.id=target_revision_id for update;
  if revision_row.id is null or revision_row.work_order_id<>order_row.id
     or not revision_row.is_current or revision_row.state<>'submitted' then
    raise exception 'O relatório atual não está aguardando revisão.';
  end if;
  if decision='approve' then
    if exists (select 1 from public.preventive_work_order_checklist_items item
      where item.work_order_id=order_row.id and item.is_optional=false
        and item.result in ('pending','not_executed')) then
      raise exception 'Há atividades obrigatórias pendentes ou não realizadas; devolva o relatório para correção.';
    end if;
    if exists (select 1 from public.preventive_work_order_checklist_items item
      where item.work_order_id=order_row.id and item.requires_photo and item.result in ('ok','not_ok')
        and not exists (select 1 from public.preventive_checklist_photos photo
          join storage.objects object_row on object_row.bucket_id='preventive-evidence'
            and object_row.name=photo.storage_path
          where photo.checklist_item_id=item.id)) then
      raise exception 'Há atividade com foto obrigatória sem evidência persistida.';
    end if;
    if exists (select 1 from public.preventive_work_order_checklist_items item
      where item.work_order_id=order_row.id and item.result='not_ok'
        and item.nonconformity_request_id is null) then
      raise exception 'Abra a solicitação corretiva vinculada a cada não conformidade antes de aprovar.';
    end if;
  end if;
  select profile.full_name into reviewer_name from public.profiles profile where profile.id=auth.uid();
  update public.work_order_report_revisions set
    state=case when decision='approve' then 'approved' else 'returned' end,
    reviewed_by=auth.uid(),reviewed_by_name=reviewer_name,reviewed_at=now(),
    review_reason=case when decision='return' then btrim(reason) else null end
  where id=target_revision_id;
  return case when decision='approve' then 'approved' else 'returned' end;
end;
$$;
revoke all on function public.review_preventive_report_revision(uuid,text,text) from public, anon;
grant execute on function public.review_preventive_report_revision(uuid,text,text) to authenticated;

create or replace function public.record_preventive_report_signature(
  target_revision_id uuid,representative text,target_storage_path text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare revision_row public.work_order_report_revisions%rowtype; order_row public.work_orders%rowtype;
        collector_name text; signature_id uuid; expected_path text; parent_order_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessão autenticada obrigatória.'; end if;
  select revision.work_order_id into parent_order_id from public.work_order_report_revisions revision
  where revision.id=target_revision_id;
  if parent_order_id is null then raise exception 'Esta revisão aprovada não exige nova assinatura.'; end if;
  select work_order.* into order_row from public.work_orders work_order
  where work_order.id=parent_order_id for update;
  if order_row.id is null or not public.can_access_preventive_order(order_row.id,true) then
    raise exception 'Sem permissão para registrar o aceite.';
  end if;
  select revision.* into revision_row from public.work_order_report_revisions revision
  where revision.id=target_revision_id for update;
  if revision_row.id is null or revision_row.work_order_id<>order_row.id
     or not revision_row.is_current or revision_row.state<>'approved'
     or not revision_row.acceptance_required then
    raise exception 'Esta revisão aprovada não exige nova assinatura.';
  end if;
  expected_path:=order_row.tenant_id::text||'/'||order_row.id::text||'/'||revision_row.id::text||'/signature.png';
  if target_storage_path is distinct from expected_path
     or length(btrim(coalesce(representative,''))) not between 2 and 160
     or not exists (select 1 from storage.objects object_row
       where object_row.bucket_id='work-order-reports' and object_row.name=expected_path) then
    raise exception 'Assinatura ou arquivo privado inválido.';
  end if;
  select profile.full_name into collector_name from public.profiles profile where profile.id=auth.uid();
  insert into public.work_order_report_signatures(tenant_id,work_order_id,report_revision_id,
    representative_name,storage_path,captured_by,collector_name)
  values(order_row.tenant_id,order_row.id,revision_row.id,btrim(representative),expected_path,auth.uid(),collector_name)
  on conflict(report_revision_id) do nothing
  returning id into signature_id;
  if signature_id is null then
    select signature.id into signature_id from public.work_order_report_signatures signature
    where signature.report_revision_id=target_revision_id;
  end if;
  return signature_id;
end;
$$;
revoke all on function public.record_preventive_report_signature(uuid,text,text) from public, anon;
grant execute on function public.record_preventive_report_signature(uuid,text,text) to authenticated;

create or replace function public.attach_preventive_report_pdf(
  target_revision_id uuid,target_storage_path text,target_sha256 text,target_byte_count bigint
) returns boolean language plpgsql security definer set search_path = '' as $$
declare revision_row public.work_order_report_revisions%rowtype; order_row public.work_orders%rowtype;
        expected_path text; parent_order_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessão autenticada obrigatória.'; end if;
  select revision.work_order_id into parent_order_id from public.work_order_report_revisions revision
  where revision.id=target_revision_id;
  if parent_order_id is null then raise exception 'Somente revisão aprovada pode receber PDF.'; end if;
  select work_order.* into order_row from public.work_orders work_order
  where work_order.id=parent_order_id for update;
  if order_row.id is null or not public.can_access_preventive_order(order_row.id,true) then
    raise exception 'Sem permissão para arquivar o PDF.';
  end if;
  select revision.* into revision_row from public.work_order_report_revisions revision
  where revision.id=target_revision_id for update;
  if revision_row.id is null or revision_row.work_order_id<>order_row.id
     or not revision_row.is_current or revision_row.state<>'approved' then
    raise exception 'Somente revisão aprovada pode receber PDF.';
  end if;
  if revision_row.acceptance_required and not exists (
    select 1 from public.work_order_report_signatures signature where signature.report_revision_id=revision_row.id
  ) then raise exception 'A assinatura do representante é exigida nesta OS.'; end if;
  expected_path:=order_row.tenant_id::text||'/'||order_row.id::text||'/'||revision_row.id::text||'/report.pdf';
  if target_storage_path is distinct from expected_path or target_sha256 !~ '^[0-9a-f]{64}$'
     or target_byte_count not between 1 and 20971520
     or not exists (select 1 from storage.objects object_row
       where object_row.bucket_id='work-order-reports' and object_row.name=expected_path) then
    raise exception 'Arquivo PDF inválido, fora do limite ou não localizado no Storage privado.';
  end if;
  if revision_row.pdf_storage_path is not null then
    return revision_row.pdf_storage_path=expected_path and revision_row.pdf_sha256=target_sha256;
  end if;
  update public.work_order_report_revisions set pdf_storage_path=expected_path,
    pdf_sha256=target_sha256,pdf_byte_count=target_byte_count,
    pdf_generated_by=auth.uid(),pdf_generated_at=now()
  where id=target_revision_id;
  return true;
end;
$$;
revoke all on function public.attach_preventive_report_pdf(uuid,text,text,bigint) from public, anon;
grant execute on function public.attach_preventive_report_pdf(uuid,text,text,bigint) to authenticated;

create or replace function public.authorize_preventive_report_pdf(target_revision_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare revision_row public.work_order_report_revisions%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão autenticada obrigatória.'; end if;
  select revision.* into revision_row from public.work_order_report_revisions revision
  where revision.id=target_revision_id;
  if revision_row.id is null or not revision_row.is_current or revision_row.state<>'approved'
     or revision_row.pdf_storage_path is not null
     or not public.can_access_preventive_order(revision_row.work_order_id,true) then
    raise exception 'Revisão aprovada indisponível ou sem permissão para gerar o PDF.';
  end if;
  if revision_row.acceptance_required and not exists (
    select 1 from public.work_order_report_signatures signature
    where signature.report_revision_id=revision_row.id
  ) then raise exception 'O aceite do representante é exigido nesta OS.'; end if;
  return true;
end;
$$;
revoke all on function public.authorize_preventive_report_pdf(uuid) from public, anon;
grant execute on function public.authorize_preventive_report_pdf(uuid) to authenticated;

-- O retorno de uma não conformidade cria somente uma solicitação, nunca uma OS automática.
create or replace function public.save_preventive_checklist_item(
  target_item_id uuid,target_result text,target_notes text,
  target_measurement_value numeric,target_measurement_unit text,
  target_measurement_point text,target_nonconformity text
) returns void language plpgsql security definer set search_path = '' as $$
declare item_row public.preventive_work_order_checklist_items%rowtype;
        order_row public.work_orders%rowtype; parent_order_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessão autenticada obrigatória.'; end if;
  select item.work_order_id into parent_order_id from public.preventive_work_order_checklist_items item
  where item.id=target_item_id;
  if parent_order_id is null then raise exception 'Atividade não encontrada ou sem permissão.'; end if;
  select work_order.* into order_row from public.work_orders work_order
  where work_order.id=parent_order_id for update;
  if order_row.id is null or order_row.type<>'preventive'
     or not public.can_access_preventive_order(order_row.id,true) then
    raise exception 'Atividade não encontrada ou sem permissão.';
  end if;
  select item.* into item_row from public.preventive_work_order_checklist_items item
  where item.id=target_item_id and item.work_order_id=order_row.id for update;
  if item_row.id is null then
    raise exception 'Atividade não encontrada ou sem permissão.';
  end if;
  if exists (select 1 from public.work_order_report_revisions revision
    where revision.work_order_id=item_row.work_order_id and revision.is_current
      and revision.state in ('submitted','approved')) then
    raise exception 'Checklist enviado para revisão; aguarde aprovação ou devolução do supervisor.';
  end if;
  if target_result not in ('pending','ok','not_ok','not_executed','not_applicable')
     or (target_result='not_ok' and length(btrim(coalesce(target_nonconformity,'')))<5)
     or length(coalesce(target_notes,''))>3000
     or length(coalesce(target_measurement_unit,''))>40
     or length(coalesce(target_measurement_point,''))>160
     or (target_measurement_value is not null and (
       item_row.measurement_parameter is null
       or nullif(btrim(item_row.configured_measurement_unit),'') is null
       or nullif(btrim(item_row.configured_measurement_point),'') is null))
     or (nullif(btrim(coalesce(target_measurement_unit,'')),'') is not null
       and target_measurement_unit<>item_row.configured_measurement_unit)
     or (nullif(btrim(coalesce(target_measurement_point,'')),'') is not null
       and target_measurement_point<>item_row.configured_measurement_point) then
    raise exception 'Resultado, observação ou medição inválidos; medição exige parâmetro, unidade e ponto configurados no plano.';
  end if;
  if item_row.nonconformity_request_id is not null and target_result<>'not_ok' then
    raise exception 'Solicitação corretiva já aberta; a não conformidade não pode ser descartada.';
  end if;
  update public.preventive_work_order_checklist_items set
    result=target_result,notes=nullif(btrim(target_notes),''),
    measurement_value=case when item_row.measurement_parameter is not null then target_measurement_value else null end,
    measurement_unit=case when item_row.measurement_parameter is not null then item_row.configured_measurement_unit else null end,
    measurement_point=case when item_row.measurement_parameter is not null then item_row.configured_measurement_point else null end,
    nonconformity=case when target_result='not_ok' then btrim(target_nonconformity) else null end,
    responsible_user_id=auth.uid(),executed_at=case when target_result='pending' then null else now() end,
    updated_at=now()
  where id=target_item_id;
  if target_result='not_ok' then perform public.open_preventive_nonconformity_request(target_item_id); end if;
end;
$$;
revoke all on function public.save_preventive_checklist_item(uuid,text,text,numeric,text,text,text) from public, anon;
grant execute on function public.save_preventive_checklist_item(uuid,text,text,numeric,text,text,text) to authenticated;

create or replace function public.open_preventive_nonconformity_request(target_item_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare item_row public.preventive_work_order_checklist_items%rowtype;
        order_row public.work_orders%rowtype; parent_order_id uuid; request_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessão autenticada obrigatória.'; end if;
  select item.work_order_id into parent_order_id from public.preventive_work_order_checklist_items item
  where item.id=target_item_id;
  if parent_order_id is null then raise exception 'Atividade não encontrada ou sem permissão.'; end if;
  select work_order.* into order_row from public.work_orders work_order
  where work_order.id=parent_order_id for update;
  if order_row.id is null or not public.can_access_preventive_order(order_row.id,true) then
    raise exception 'Atividade não encontrada ou sem permissão.';
  end if;
  select item.* into item_row from public.preventive_work_order_checklist_items item
  where item.id=target_item_id and item.work_order_id=order_row.id for update;
  if item_row.id is null then raise exception 'Atividade não encontrada ou sem permissão.'; end if;
  if exists (select 1 from public.work_order_report_revisions revision
    where revision.work_order_id=order_row.id and revision.is_current
      and revision.state in ('submitted','approved')) then
    raise exception 'Relatório enviado para revisão; aguarde devolução antes de alterar a não conformidade.';
  end if;
  if item_row.result<>'not_ok' or length(btrim(coalesce(item_row.nonconformity,'')))<5 then
    raise exception 'Registre a não conformidade antes de abrir a solicitação.';
  end if;
  if item_row.nonconformity_request_id is not null then return item_row.nonconformity_request_id; end if;
  insert into public.service_requests(tenant_id,unit_id,cost_center_id,asset_id,title,description,
    category,priority,requested_by)
  values(order_row.tenant_id,order_row.unit_id,order_row.cost_center_id,order_row.asset_id,
    left('Não conformidade preventiva · OS #'||order_row.order_number||' · '||item_row.title,180),
    item_row.nonconformity,'preventive_nonconformity','medium',auth.uid())
  returning id into request_id;
  update public.preventive_work_order_checklist_items set nonconformity_request_id=request_id,updated_at=now()
  where id=target_item_id;
  return request_id;
end;
$$;
revoke all on function public.open_preventive_nonconformity_request(uuid) from public, anon;
grant execute on function public.open_preventive_nonconformity_request(uuid) to authenticated;

create or replace function public.can_access_preventive_photo_path(target_path text,writing boolean default false)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare parts text[]; target_tenant uuid; target_order uuid; target_item uuid;
begin
  if auth.uid() is null then return false; end if;
  parts:=string_to_array(target_path,'/');
  if array_length(parts,1)<>4
    or parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or parts[4] !~* '^[0-9a-f-]+\.(jpg|jpeg|png|webp)$' then return false; end if;
  target_tenant:=parts[1]::uuid; target_order:=parts[2]::uuid; target_item:=parts[3]::uuid;
  return exists(select 1 from public.preventive_work_order_checklist_items item
    where item.id=target_item and item.work_order_id=target_order and item.tenant_id=target_tenant
      and public.can_access_preventive_order(target_order,writing)
      and (not writing or not exists(select 1 from public.work_order_report_revisions revision
        where revision.work_order_id=target_order and revision.is_current
          and revision.state in ('submitted','approved'))));
end;
$$;
revoke all on function public.can_access_preventive_photo_path(text,boolean) from public, anon;
grant execute on function public.can_access_preventive_photo_path(text,boolean) to authenticated;

create or replace function public.guard_preventive_photo_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare parent_order_id uuid; order_row public.work_orders%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão autenticada obrigatória.'; end if;
  select item.work_order_id into parent_order_id from public.preventive_work_order_checklist_items item
  where item.id=new.checklist_item_id and item.tenant_id=new.tenant_id;
  if parent_order_id is null then raise exception 'Atividade preventiva não encontrada.'; end if;
  select work_order.* into order_row from public.work_orders work_order
  where work_order.id=parent_order_id for update;
  if order_row.id is null or not public.can_access_preventive_order(order_row.id,true) then
    raise exception 'Sem permissão para registrar evidência nesta OS.';
  end if;
  if exists (select 1 from public.work_order_report_revisions revision
    where revision.work_order_id=order_row.id and revision.is_current
      and revision.state in ('submitted','approved')) then
    raise exception 'Relatório enviado para revisão; aguarde devolução antes de anexar evidências.';
  end if;
  if not exists (select 1 from storage.objects object_row
    where object_row.bucket_id='preventive-evidence' and object_row.name=new.storage_path) then
    raise exception 'Arquivo da evidência não foi persistido no Storage privado.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_preventive_photo_insert() from public, anon, authenticated;
drop trigger if exists preventive_photo_insert_guard on public.preventive_checklist_photos;
create trigger preventive_photo_insert_guard before insert on public.preventive_checklist_photos
for each row execute function public.guard_preventive_photo_insert();

create or replace function public.approve_preventive_service_request(
  target_request_id uuid,target_plan_id uuid
) returns table(work_order_id uuid,order_number bigint,next_due_date date,was_existing boolean)
language plpgsql security definer set search_path = '' as $$
declare request_row public.service_requests%rowtype; plan_row public.maintenance_plans%rowtype;
        cycle_row record; linked_order public.work_orders%rowtype; initialized_count integer;
begin
  if auth.uid() is null then raise exception 'Sessão autenticada obrigatória.'; end if;
  select request.* into request_row from public.service_requests request
  where request.id=target_request_id for update;
  if request_row.id is null then raise exception 'Solicitação não encontrada.'; end if;
  if not (public.is_netsecbr_admin() or public.is_tenant_admin(request_row.tenant_id))
     or not public.user_can_access_unit(request_row.unit_id) then
    raise exception 'Somente supervisor autenticado pode aprovar a solicitação.';
  end if;
  if request_row.maintenance_type is distinct from 'preventive' then
    raise exception 'Esta solicitação não é preventiva.';
  end if;
  if request_row.status='converted_to_wo' then
    select work_order.* into linked_order from public.work_orders work_order
    where work_order.id=request_row.converted_to_work_order_id;
    if linked_order.id is null or linked_order.tenant_id is distinct from request_row.tenant_id
       or linked_order.asset_id is distinct from request_row.asset_id
       or linked_order.type <> 'preventive' then
      raise exception 'Solicitação convertida sem OS preventiva válida no mesmo tenant e ativo; revisão manual necessária.';
    end if;
    work_order_id:=linked_order.id; order_number:=linked_order.order_number;
    next_due_date:=null; was_existing:=true; return next; return;
  end if;
  if request_row.status<>'triaged' or coalesce(trim(request_row.triage_notes),'')='' then
    raise exception 'A solicitação precisa estar em triagem antes da aprovação.';
  end if;
  if request_row.asset_id is null then
    raise exception 'Solicitação preventiva precisa ter ativo vinculado.';
  end if;
  select plan.* into plan_row from public.maintenance_plans plan
  where plan.id=target_plan_id and plan.tenant_id=request_row.tenant_id
    and plan.asset_id=request_row.asset_id and plan.is_active;
  if plan_row.id is null then raise exception 'Plano ativo não pertence ao ativo e tenant da solicitação.'; end if;
  select * into cycle_row from public.create_preventive_cycle_work_order(target_plan_id,plan_row.next_due_date);
  select work_order.* into linked_order from public.work_orders work_order
  where work_order.id=cycle_row.work_order_id for update;
  if linked_order.id is null or linked_order.tenant_id<>request_row.tenant_id
     or linked_order.asset_id is distinct from request_row.asset_id then
    raise exception 'OS gerada fora do escopo da solicitação.';
  end if;
  if linked_order.source_service_request_id is null then
    update public.work_orders set source_service_request_id=request_row.id where id=linked_order.id;
  end if;
  initialized_count:=public.initialize_preventive_checklist(linked_order.id);
  if initialized_count<1 then raise exception 'Checklist da OS não foi confirmado; transação revertida.'; end if;
  update public.service_requests set status='converted_to_wo',
    converted_to_work_order_id=linked_order.id,approved_at=now(),approved_by=auth.uid()
  where id=request_row.id;
  work_order_id:=linked_order.id; order_number:=linked_order.order_number;
  next_due_date:=cycle_row.next_due_date; was_existing:=cycle_row.was_existing;
  return next;
end;
$$;
revoke all on function public.approve_preventive_service_request(uuid,uuid) from public, anon;
grant execute on function public.approve_preventive_service_request(uuid,uuid) to authenticated;

create or replace function public.get_preventive_checklist_summary(target_work_order_ids uuid[])
returns table(work_order_id uuid,total_items bigint,completed_items bigint,nonconformities bigint,photos bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(cardinality(target_work_order_ids),0)>100 then
    raise exception 'Lista inválida ou longa demais.';
  end if;
  return query
  select work_order.id,
    coalesce(items.total_items,0),coalesce(items.completed_items,0),coalesce(items.nonconformities,0),
    coalesce(photo_counts.photos,0)
  from public.work_orders work_order
  left join lateral (
    select count(*)::bigint total_items,
      count(*) filter(where item.result not in ('pending','not_executed'))::bigint completed_items,
      count(*) filter(where item.result='not_ok')::bigint nonconformities
    from public.preventive_work_order_checklist_items item
    where item.work_order_id=work_order.id and item.tenant_id=work_order.tenant_id
  ) items on true
  left join lateral (
    select count(*)::bigint photos from public.preventive_checklist_photos photo
    join public.preventive_work_order_checklist_items item on item.id=photo.checklist_item_id
    where item.work_order_id=work_order.id and item.tenant_id=work_order.tenant_id
  ) photo_counts on true
  where work_order.id=any(target_work_order_ids) and work_order.type='preventive'
    and public.can_access_preventive_order(work_order.id,false);
end;
$$;
revoke all on function public.get_preventive_checklist_summary(uuid[]) from public, anon;
grant execute on function public.get_preventive_checklist_summary(uuid[]) to authenticated;

-- Conclusão de preventiva só ocorre após aprovação, PDF arquivado e assinatura se exigida.
create or replace function public.enforce_work_order_governance()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status in ('completed','cancelled') and new.status<>old.status then
    raise exception 'Uma OS concluída ou cancelada não pode retornar ao fluxo. Crie uma nova OS.';
  end if;
  if old.status<>'cancelled' and new.status='cancelled' then
    if coalesce(trim(new.cancellation_reason),'')='' then raise exception 'Informe o motivo para cancelar uma OS.'; end if;
    new.cancelled_at:=now(); new.cancelled_by:=auth.uid();
  end if;
  if old.status<>'completed' and new.status='completed' then
    if new.type='preventive' then
      if current_setting('marv.preventive_completion_order_id',true) is distinct from new.id::text then
        raise exception 'Preventiva só pode ser concluída pelo fluxo de relatório aprovado.';
      end if;
    else
      if new.diagnosis_category is null or new.root_cause_category is null
         or new.action_category is null or new.recommendation_category is null then
        raise exception 'Classifique diagnóstico, causa, ação e recomendação antes de concluir a OS.';
      end if;
      if new.causes_equipment_downtime and new.downtime_ended_at is null
         and coalesce(new.recommendation_category,'')<>'Condenado / perda total' then
        raise exception 'Informe o fim da parada antes de concluir a OS ou classifique como condenado/perda total.';
      end if;
    end if;
    new.completed_at:=now();
  end if;
  return new;
end;
$$;
drop trigger if exists work_orders_enforce_governance on public.work_orders;
create trigger work_orders_enforce_governance before update on public.work_orders
for each row execute function public.enforce_work_order_governance();

create or replace function public.complete_preventive_work_order(target_order_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare order_row public.work_orders%rowtype; revision_row public.work_order_report_revisions%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão autenticada obrigatória.'; end if;
  select work_order.* into order_row from public.work_orders work_order
  where work_order.id=target_order_id for update;
  if order_row.id is null or order_row.type<>'preventive' or order_row.preventive_cycle_key is null
     or order_row.status in ('completed','cancelled') then raise exception 'OS preventiva ativa não encontrada.'; end if;
  if not (public.is_netsecbr_admin() or public.is_tenant_admin(order_row.tenant_id))
     or not public.user_can_access_unit(order_row.unit_id) then
    raise exception 'Somente supervisor autenticado pode concluir a preventiva.';
  end if;
  select revision.* into revision_row from public.work_order_report_revisions revision
  where revision.work_order_id=target_order_id and revision.is_current for update;
  if revision_row.id is null or revision_row.state<>'approved' or revision_row.pdf_storage_path is null then
    raise exception 'A OS exige relatório aprovado e PDF final arquivado.';
  end if;
  if not exists (select 1 from storage.objects object_row
    where object_row.bucket_id='work-order-reports'
      and object_row.name=revision_row.pdf_storage_path) then
    raise exception 'O PDF final não está mais no Storage privado; gere e arquive o relatório novamente.';
  end if;
  if revision_row.acceptance_required and not exists (
    select 1 from public.work_order_report_signatures signature where signature.report_revision_id=revision_row.id
  ) then raise exception 'A assinatura do representante é obrigatória nesta OS.'; end if;
  if not exists (select 1 from public.preventive_work_order_checklist_items item
    where item.work_order_id=target_order_id) then raise exception 'Checklist desta OS não foi inicializado.'; end if;
  if exists (select 1 from public.preventive_work_order_checklist_items item
    where item.work_order_id=target_order_id and item.is_optional=false
      and item.result in ('pending','not_executed')) then
    raise exception 'Há atividades obrigatórias pendentes ou não realizadas.';
  end if;
  if exists (select 1 from public.preventive_work_order_checklist_items item
    where item.work_order_id=target_order_id and item.requires_photo and item.result in ('ok','not_ok')
      and not exists (select 1 from public.preventive_checklist_photos photo
        join storage.objects object_row on object_row.bucket_id='preventive-evidence'
          and object_row.name=photo.storage_path where photo.checklist_item_id=item.id)) then
    raise exception 'Há atividade com foto obrigatória sem arquivo persistido.';
  end if;
  if exists (select 1 from public.preventive_work_order_checklist_items item
    where item.work_order_id=target_order_id and item.result='not_ok'
      and item.nonconformity_request_id is null) then
    raise exception 'Cada não conformidade precisa de solicitação corretiva vinculada.';
  end if;
  perform set_config('marv.preventive_completion_order_id',target_order_id::text,true);
  update public.work_orders set status='completed',completed_at=now() where id=target_order_id;
  perform set_config('marv.preventive_completion_order_id','',true);
  insert into public.work_order_report_audit_log(tenant_id,work_order_id,report_revision_id,event_type,
    state_before,state_after,changed_by,changed_by_name,details)
  values(order_row.tenant_id,target_order_id,revision_row.id,'work_order_completed',
    revision_row.state,revision_row.state,auth.uid(),
    (select profile.full_name from public.profiles profile where profile.id=auth.uid()),
    jsonb_build_object('order_number',order_row.order_number,'revision_number',revision_row.revision_number));
  return true;
end;
$$;
revoke all on function public.complete_preventive_work_order(uuid) from public, anon;
grant execute on function public.complete_preventive_work_order(uuid) to authenticated;

-- Auditoria da OS também respeita o escopo de unidade ao consultar valores antes/depois.
drop policy if exists work_order_audit_log_select_operational_tenant on public.work_order_audit_log;
drop policy if exists "work_order_audit_log_select_operational_tenant" on public.work_order_audit_log;
create policy work_order_audit_log_select_operational_tenant on public.work_order_audit_log
for select to authenticated using (
  public.is_netsecbr_admin() or exists (
    select 1 from public.work_orders work_order
    where work_order.id=work_order_audit_log.work_order_id
      and work_order.tenant_id=work_order_audit_log.tenant_id
      and public.is_tenant_member(work_order.tenant_id)
      and public.tenant_allows_operation(work_order.tenant_id)
      and public.user_can_access_unit(work_order.unit_id)
  )
);

-- Verificações de pós-condição: nenhum dado operacional é reescrito nesta migration.
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='work_orders_one_active_preventive_per_asset') then
    raise exception 'Índice de uma preventiva ativa por ativo não foi criado.';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='work_order_report_revisions' and policyname='work_order_report_revisions_read')
     or not exists (select 1 from pg_policies where schemaname='public' and tablename='work_order_report_audit_log' and policyname='work_order_report_audit_read') then
    raise exception 'RLS do relatório não foi criada.';
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='work_order_reports_read') then
    raise exception 'Policy privada do Storage de relatórios não foi criada.';
  end if;
end;
$$;

-- Rollback lógico: reverter o frontend e deixar esta trilha e seus arquivos privados somente leitura.
-- Não apagar revisões, assinaturas, PDFs, ciclos ou OS históricos. Não executar DROP em produção.
-- A desativação material exige migração compensatória revisada após inventário de registros.

commit;
