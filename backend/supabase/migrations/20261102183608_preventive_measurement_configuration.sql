-- PENDENTE DE AUTORIZAÇÃO. Não aplicar por db push no projeto principal.
-- Configuração opcional da medição no plano e cópia imutável para cada OS.
-- Não altera atividades, resultados, fotos nem históricos já gravados.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.preventive_plan_activities
  add column measurement_parameter text,
  add column measurement_unit text,
  add column measurement_point text;
alter table public.preventive_work_order_checklist_items
  add column measurement_parameter text,
  add column configured_measurement_unit text,
  add column configured_measurement_point text;

alter table public.preventive_plan_activities
  add constraint preventive_plan_measurement_config_valid check (
    (measurement_parameter is null and measurement_unit is null and measurement_point is null)
    or (length(btrim(coalesce(measurement_parameter, ''))) between 1 and 120
      and length(coalesce(measurement_unit, '')) <= 40
      and length(coalesce(measurement_point, '')) <= 160)
  );

create or replace function public.configure_preventive_plan_checklist(
  target_plan_id uuid, target_template_id uuid, target_activities jsonb
) returns integer language plpgsql security definer set search_path = '' as $$
declare plan_row public.maintenance_plans%rowtype; activity_count integer;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into plan_row from public.maintenance_plans where id = target_plan_id for update;
  if plan_row.id is null or not (public.is_netsecbr_admin()
      or public.is_tenant_admin(plan_row.tenant_id)) then
    raise exception 'Plano inexistente ou sem permissão.';
  end if;
  if target_template_id is not null and
     (target_template_id <> 'eb7a15e6-411d-43d9-8a14-ffed237a97e9'::uuid or
      not exists (select 1 from public.preventive_templates
                  where id = target_template_id and is_active)) then
    raise exception 'Modelo MARV indisponível.';
  end if;
  if jsonb_typeof(target_activities) is distinct from 'array' then
    raise exception 'Informe as atividades do checklist.';
  end if;
  if jsonb_array_length(target_activities) not between 1 and 100 then
    raise exception 'O checklist deve ter entre 1 e 100 atividades.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(target_activities) as activity(value)
    where length(btrim(coalesce(activity.value->>'title', ''))) not between 3 and 180
       or length(coalesce(activity.value->>'instruction', '')) > 3000
       or length(coalesce(activity.value->>'measurement_parameter', '')) > 120
       or length(coalesce(activity.value->>'measurement_unit', '')) > 40
       or length(coalesce(activity.value->>'measurement_point', '')) > 160
       or (nullif(btrim(activity.value->>'measurement_parameter'), '') is null
           and (nullif(btrim(activity.value->>'measurement_unit'), '') is not null
             or nullif(btrim(activity.value->>'measurement_point'), '') is not null))
  ) then
    raise exception 'Revise o título, a instrução e a medição das atividades.';
  end if;
  if exists (
    select 1 from public.preventive_work_order_checklist_items item
    join public.preventive_plan_activities activity on activity.id = item.plan_activity_id
    where activity.plan_id = target_plan_id
  ) then
    raise exception 'Já existem atividades executadas em OS deste plano. Crie outro plano para preservar os snapshots históricos.';
  end if;
  if exists (select 1 from public.preventive_plan_activities where plan_id = target_plan_id)
     and (exists (select 1 from public.work_orders where source_maintenance_plan_id = target_plan_id)
          or exists (select 1 from public.preventive_work_order_plan_snapshots
                     where maintenance_plan_id = target_plan_id)) then
    raise exception 'O plano já tem atividades e originou OS. Crie outro plano para preservar a configuração anterior.';
  end if;
  delete from public.preventive_plan_activities where plan_id = target_plan_id;
  insert into public.preventive_plan_activities
    (tenant_id, plan_id, position, title, instruction, is_optional, requires_photo,
     measurement_parameter, measurement_unit, measurement_point)
  select plan_row.tenant_id, target_plan_id, activity.ordinality::integer,
         btrim(activity.value->>'title'), nullif(btrim(activity.value->>'instruction'), ''),
         coalesce((activity.value->>'is_optional')::boolean, false),
         coalesce((activity.value->>'requires_photo')::boolean, false),
         nullif(btrim(activity.value->>'measurement_parameter'), ''),
         nullif(btrim(activity.value->>'measurement_unit'), ''),
         nullif(btrim(activity.value->>'measurement_point'), '')
  from jsonb_array_elements(target_activities) with ordinality as activity(value, ordinality);
  get diagnostics activity_count = row_count;
  update public.maintenance_plans set preventive_template_id = target_template_id
  where id = target_plan_id;
  return activity_count;
end;
$$;
revoke all on function public.configure_preventive_plan_checklist(uuid,uuid,jsonb) from public, anon;
grant execute on function public.configure_preventive_plan_checklist(uuid,uuid,jsonb) to authenticated;

create or replace function public.initialize_preventive_checklist(target_order_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare order_row public.work_orders%rowtype; activity_count integer;
begin
  if auth.uid() is null or not public.can_access_preventive_order(target_order_id, true) then
    raise exception 'Sem permissão para executar esta OS preventiva.';
  end if;
  select * into order_row from public.work_orders where id = target_order_id for update;
  if order_row.id is null or order_row.type <> 'preventive' then
    raise exception 'OS preventiva não encontrada.';
  end if;
  if order_row.preventive_cycle_key is null then return 0; end if;
  insert into public.preventive_work_order_checklist_items
    (tenant_id, work_order_id, plan_activity_id, position, title, instruction,
     is_optional, requires_photo, measurement_parameter,
     configured_measurement_unit, configured_measurement_point)
  select order_row.tenant_id, order_row.id, activity.id,
         row_number() over (order by activity.plan_id, activity.position)::integer,
         activity.title, activity.instruction, activity.is_optional, activity.requires_photo,
         activity.measurement_parameter, activity.measurement_unit, activity.measurement_point
  from public.preventive_plan_activities activity
  where activity.plan_id in (
    select snapshot.maintenance_plan_id
    from public.preventive_work_order_plan_snapshots snapshot
    where snapshot.work_order_id = target_order_id
    union
    select order_row.source_maintenance_plan_id
    where order_row.source_maintenance_plan_id is not null
  ) and activity.tenant_id = order_row.tenant_id
  on conflict (work_order_id, plan_activity_id) do nothing;
  select count(*) into activity_count from public.preventive_work_order_checklist_items
  where work_order_id = target_order_id;
  return activity_count;
end;
$$;
revoke all on function public.initialize_preventive_checklist(uuid) from public, anon;
grant execute on function public.initialize_preventive_checklist(uuid) to authenticated;
commit;
