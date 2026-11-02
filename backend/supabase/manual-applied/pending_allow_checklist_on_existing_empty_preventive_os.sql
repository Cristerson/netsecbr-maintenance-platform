-- PENDENTE DE AUTORIZAÇÃO. Não aplicar automaticamente.
-- Permite configurar plano que já originou OS somente se nenhuma atividade desse
-- plano estiver referenciada por checklist de OS. Não altera registros existentes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

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
  ) then
    raise exception 'Revise o título e a instrução das atividades.';
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
    (tenant_id, plan_id, position, title, instruction, is_optional, requires_photo)
  select plan_row.tenant_id, target_plan_id, activity.ordinality::integer,
         btrim(activity.value->>'title'), nullif(btrim(activity.value->>'instruction'), ''),
         coalesce((activity.value->>'is_optional')::boolean, false),
         coalesce((activity.value->>'requires_photo')::boolean, false)
  from jsonb_array_elements(target_activities) with ordinality as activity(value, ordinality);
  get diagnostics activity_count = row_count;
  update public.maintenance_plans set preventive_template_id = target_template_id
  where id = target_plan_id;
  return activity_count;
end;
$$;

revoke all on function public.configure_preventive_plan_checklist(uuid,uuid,jsonb) from public, anon;
grant execute on function public.configure_preventive_plan_checklist(uuid,uuid,jsonb) to authenticated;
commit;
