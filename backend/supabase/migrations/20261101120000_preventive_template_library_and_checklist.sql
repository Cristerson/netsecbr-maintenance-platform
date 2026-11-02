-- Biblioteca e execução preventiva. NÃO aplicada ao banco principal.
-- Depende de 20261031214019_preventive_cycle_foundation já presente materialmente.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
do $$
begin
  if to_regprocedure('public.create_preventive_cycle_work_order(uuid,date)') is null
     or to_regclass('public.preventive_work_order_plan_snapshots') is null
     or to_regprocedure('public.user_can_access_unit(uuid)') is null then
    raise exception 'As fundações de ciclo preventivo e visibilidade por unidade precisam existir antes desta migration.';
  end if;
  if to_regclass('public.preventive_templates') is not null
     or to_regclass('public.preventive_template_activities') is not null
     or to_regclass('public.preventive_plan_activities') is not null
     or to_regclass('public.preventive_work_order_checklist_items') is not null
     or to_regclass('public.preventive_checklist_photos') is not null
     or exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'maintenance_plans'
                  and column_name = 'preventive_template_id') then
    raise exception 'Objeto preventivo já existente; revisar antes de aplicar.';
  end if;
end;
$$;

CREATE TABLE public.preventive_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.preventive_template_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.preventive_templates(id) ON DELETE RESTRICT,
  position integer NOT NULL,
  title text NOT NULL,
  instruction text,
  is_optional boolean NOT NULL DEFAULT false,
  requires_photo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  unique (template_id, position)
);

CREATE TABLE public.preventive_plan_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES public.maintenance_plans(id) ON DELETE RESTRICT,
  position integer NOT NULL,
  title text NOT NULL,
  instruction text,
  is_optional boolean NOT NULL DEFAULT false,
  requires_photo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  unique (plan_id, position)
);

CREATE TABLE public.preventive_work_order_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE RESTRICT,
  plan_activity_id uuid NOT NULL REFERENCES public.preventive_plan_activities(id) ON DELETE RESTRICT,
  position integer NOT NULL,
  title text NOT NULL,
  instruction text,
  is_optional boolean NOT NULL DEFAULT false,
  requires_photo boolean NOT NULL DEFAULT false,
  result text NOT NULL DEFAULT 'pending' CHECK (result IN ('pending','ok','not_ok','not_executed','not_applicable')),
  notes text,
  nonconformity text,
  measurement_value numeric,
  measurement_unit text,
  measurement_point text,
  responsible_user_id uuid REFERENCES auth.users(id),
  executed_at timestamptz,
  nonconformity_request_id uuid REFERENCES public.service_requests(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  unique (work_order_id, plan_activity_id),
  check (result <> 'not_ok' or length(btrim(coalesce(nonconformity, ''))) >= 5)
);

CREATE TABLE public.preventive_checklist_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  checklist_item_id uuid NOT NULL REFERENCES public.preventive_work_order_checklist_items(id) ON DELETE RESTRICT,
  storage_path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  unique (checklist_item_id, storage_path)
);

alter table public.maintenance_plans
  add column preventive_template_id uuid references public.preventive_templates(id) on delete restrict;

create index preventive_plan_activities_tenant_plan_idx
  on public.preventive_plan_activities (tenant_id, plan_id, position);
create index preventive_checklist_tenant_order_idx
  on public.preventive_work_order_checklist_items (tenant_id, work_order_id, position);
create index preventive_photos_tenant_item_idx
  on public.preventive_checklist_photos (tenant_id, checklist_item_id);

alter table public.preventive_templates enable row level security;
alter table public.preventive_template_activities enable row level security;
alter table public.preventive_plan_activities enable row level security;
alter table public.preventive_work_order_checklist_items enable row level security;
alter table public.preventive_checklist_photos enable row level security;

revoke all on public.preventive_templates, public.preventive_template_activities,
  public.preventive_plan_activities, public.preventive_work_order_checklist_items,
  public.preventive_checklist_photos from anon, authenticated;
grant select on public.preventive_templates to authenticated;
grant select on public.preventive_template_activities to authenticated;
grant select on public.preventive_plan_activities to authenticated;
grant select on public.preventive_work_order_checklist_items to authenticated;
grant select, insert on public.preventive_checklist_photos to authenticated;

create policy preventive_templates_read on public.preventive_templates
  for select to authenticated using (auth.uid() is not null);
create policy preventive_template_activities_read on public.preventive_template_activities
  for select to authenticated using (auth.uid() is not null);

create or replace function public.can_access_preventive_order(target_order_id uuid, writing boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.work_orders work_order
    where work_order.id = target_order_id and work_order.type = 'preventive'
      and (
        public.is_netsecbr_admin()
        or (
          public.is_tenant_member(work_order.tenant_id)
          and public.tenant_allows_operation(work_order.tenant_id)
          and public.user_can_access_unit(work_order.unit_id)
        )
      )
      and (not writing or (
        work_order.status not in ('completed', 'cancelled')
        and (public.is_netsecbr_admin() or public.is_tenant_admin(work_order.tenant_id)
             or work_order.assigned_to = auth.uid())
      ))
  );
$$;
revoke all on function public.can_access_preventive_order(uuid,boolean) from public, anon;
grant execute on function public.can_access_preventive_order(uuid,boolean) to authenticated;

create policy preventive_plan_activities_read on public.preventive_plan_activities
  for select to authenticated using (
    exists (select 1 from public.maintenance_plans plan
            where plan.id = preventive_plan_activities.plan_id
              and plan.tenant_id = preventive_plan_activities.tenant_id)
  );
create policy preventive_checklist_read on public.preventive_work_order_checklist_items
  for select to authenticated using (public.can_access_preventive_order(work_order_id, false));
create policy preventive_photos_read on public.preventive_checklist_photos
  for select to authenticated using (
    exists (select 1 from public.preventive_work_order_checklist_items item
            where item.id = preventive_checklist_photos.checklist_item_id
              and item.tenant_id = preventive_checklist_photos.tenant_id)
  );

-- Referência única, baseada nos 16 itens dos planos de simulação Saint-Gobain.
-- A aplicação copia as atividades para o plano; nunca edita este modelo global.
insert into public.preventive_templates
  (id, name, description)
values
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 'Modelo MARV',
   'Checklist sugerido para robôs industriais. Ajuste cada atividade à documentação do fabricante e ao equipamento.');
insert into public.preventive_template_activities
  (template_id, position, title, instruction, requires_photo)
values
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 1, 'Verificar folga nos eixos', 'Registrar condição e eixo avaliado.', false),
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 2, 'Verificar zero dos eixos (mastering)', 'Seguir o procedimento do fabricante.', false),
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 3, 'Conferir backup de software e sistema', 'Registrar versão, data e local seguro do backup.', false),
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 4, 'Inspecionar bateria do painel elétrico', 'Verificar condição e necessidade de troca programada.', false),
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 5, 'Verificar tensão de carga', 'Registrar medição e unidade conforme especificação técnica.', false),
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 6, 'Inspecionar bateria do controlador ou PC industrial', 'Confirmar aplicabilidade ao modelo do equipamento.', false),
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 7, 'Testar freios', 'Seguir procedimento seguro do fabricante.', false),
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 8, 'Inspecionar óleo lubrificante de redutores e eixos', 'Registrar condição e troca programada quando aplicável.', false),
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 9, 'Verificar compensação do eixo 2', 'Marcar não aplicável quando o equipamento não possuir este sistema.', false),
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 10, 'Inspecionar painel elétrico', 'Registrar condição e anomalias visuais.', true),
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 11, 'Inspecionar conexões elétricas', 'Registrar condição e anomalias visuais.', true),
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 12, 'Limpar manipulador', 'Confirmar execução conforme procedimento aplicável.', false),
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 13, 'Inspecionar cabos e alimentação de energia', 'Verificar desgaste, fixação e proteção.', true),
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 14, 'Limpar sistema de ventilação', 'Confirmar fluxo livre e condição dos filtros.', false),
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 15, 'Inspecionar componentes com desgaste prematuro', 'Descrever achados e registrar evidência quando necessário.', true),
  ('eb7a15e6-411d-43d9-8a14-ffed237a97e9', 16, 'Registrar relatório técnico de manutenção', 'Consolidar medições, observações e ações recomendadas.', false);
-- O plano guarda uma cópia própria do checklist, independentemente do modelo MARV.
-- Reconfiguração é permitida somente antes de existir uma OS vinculada ao plano.
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
  if exists (select 1 from public.work_orders where source_maintenance_plan_id = target_plan_id)
     or exists (select 1 from public.preventive_work_order_plan_snapshots
                where maintenance_plan_id = target_plan_id) then
    raise exception 'Este plano já originou OS. Crie outro plano para modificar o checklist sem alterar o histórico.';
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
  -- OS históricas sem ciclo não recebem atividades criadas depois do atendimento.
  if order_row.preventive_cycle_key is null then return 0; end if;
  insert into public.preventive_work_order_checklist_items
    (tenant_id, work_order_id, plan_activity_id, position, title, instruction,
     is_optional, requires_photo)
  select order_row.tenant_id, order_row.id, activity.id,
         row_number() over (order by activity.plan_id, activity.position)::integer,
         activity.title, activity.instruction, activity.is_optional, activity.requires_photo
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

create or replace function public.save_preventive_checklist_item(
  target_item_id uuid, target_result text, target_notes text,
  target_measurement_value numeric, target_measurement_unit text,
  target_measurement_point text, target_nonconformity text
) returns void language plpgsql security definer set search_path = '' as $$
declare item_row public.preventive_work_order_checklist_items%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into item_row from public.preventive_work_order_checklist_items
  where id = target_item_id for update;
  if item_row.id is null or not public.can_access_preventive_order(item_row.work_order_id, true) then
    raise exception 'Atividade não encontrada ou sem permissão.';
  end if;
  if target_result not in ('pending','ok','not_ok','not_executed','not_applicable')
     or (target_result = 'not_ok' and length(btrim(coalesce(target_nonconformity, ''))) < 5)
     or length(coalesce(target_notes, '')) > 3000
     or length(coalesce(target_measurement_unit, '')) > 40
     or length(coalesce(target_measurement_point, '')) > 160 then
    raise exception 'Resultado, medição ou observação inválidos.';
  end if;
  if item_row.nonconformity_request_id is not null and target_result <> 'not_ok' then
    raise exception 'Solicitação corretiva já aberta; a não conformidade não pode ser descartada.';
  end if;
  update public.preventive_work_order_checklist_items
  set result = target_result, notes = nullif(btrim(target_notes), ''),
      measurement_value = target_measurement_value,
      measurement_unit = nullif(btrim(target_measurement_unit), ''),
      measurement_point = nullif(btrim(target_measurement_point), ''),
      nonconformity = case when target_result = 'not_ok'
        then btrim(target_nonconformity) else null end,
      responsible_user_id = auth.uid(),
      executed_at = case when target_result = 'pending' then null else now() end,
      updated_at = now()
  where id = target_item_id;
end;
$$;
revoke all on function public.save_preventive_checklist_item(uuid,text,text,numeric,text,text,text) from public, anon;
grant execute on function public.save_preventive_checklist_item(uuid,text,text,numeric,text,text,text) to authenticated;

create or replace function public.open_preventive_nonconformity_request(target_item_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare item_row public.preventive_work_order_checklist_items%rowtype;
        order_row public.work_orders%rowtype; request_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into item_row from public.preventive_work_order_checklist_items
  where id = target_item_id for update;
  if item_row.id is null or not public.can_access_preventive_order(item_row.work_order_id, true) then
    raise exception 'Atividade não encontrada ou sem permissão.';
  end if;
  if item_row.result <> 'not_ok' or length(btrim(coalesce(item_row.nonconformity, ''))) < 5 then
    raise exception 'Registre a não conformidade antes de abrir a solicitação.';
  end if;
  if item_row.nonconformity_request_id is not null then
    return item_row.nonconformity_request_id;
  end if;
  select * into order_row from public.work_orders where id = item_row.work_order_id;
  insert into public.service_requests
    (tenant_id, unit_id, cost_center_id, asset_id, title, description,
     category, priority, requested_by)
  values (order_row.tenant_id, order_row.unit_id, order_row.cost_center_id,
          order_row.asset_id, left('Não conformidade preventiva · OS #' ||
          order_row.order_number || ' · ' || item_row.title, 180),
          item_row.nonconformity, 'preventive_nonconformity', 'medium', auth.uid())
  returning id into request_id;
  update public.preventive_work_order_checklist_items
  set nonconformity_request_id = request_id, updated_at = now()
  where id = target_item_id;
  return request_id;
end;
$$;
revoke all on function public.open_preventive_nonconformity_request(uuid) from public, anon;
grant execute on function public.open_preventive_nonconformity_request(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('preventive-evidence', 'preventive-evidence', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
do $$
begin
  if not exists (select 1 from storage.buckets
                 where id = 'preventive-evidence' and public = false
                   and file_size_limit = 10485760
                   and allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]
                   and cardinality(allowed_mime_types) = 3) then
    raise exception 'Bucket de evidências precisa ser privado e limitado a imagens de até 10 MB.';
  end if;
end;
$$;

create or replace function public.can_access_preventive_photo_path(
  target_path text, writing boolean default false
) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare parts text[]; target_tenant uuid; target_order uuid; target_item uuid;
begin
  if auth.uid() is null then return false; end if;
  parts := string_to_array(target_path, '/');
  if array_length(parts, 1) <> 4
     or parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or parts[4] !~* '^[0-9a-f-]+\.(jpg|jpeg|png|webp)$' then
    return false;
  end if;
  target_tenant := parts[1]::uuid;
  target_order := parts[2]::uuid;
  target_item := parts[3]::uuid;
  return exists (
    select 1 from public.preventive_work_order_checklist_items item
    where item.id = target_item and item.work_order_id = target_order
      and item.tenant_id = target_tenant
      and public.can_access_preventive_order(target_order, writing)
  );
end;
$$;
revoke all on function public.can_access_preventive_photo_path(text,boolean) from public, anon;
grant execute on function public.can_access_preventive_photo_path(text,boolean) to authenticated;

create policy preventive_photos_insert on public.preventive_checklist_photos
  for insert to authenticated with check (
    split_part(storage_path, '/', 1) = tenant_id::text
    and split_part(storage_path, '/', 3) = checklist_item_id::text
    and public.can_access_preventive_photo_path(storage_path, true)
    and exists (select 1 from public.preventive_work_order_checklist_items item
                where item.id = preventive_checklist_photos.checklist_item_id
                  and item.tenant_id = preventive_checklist_photos.tenant_id
                  and public.can_access_preventive_order(item.work_order_id, true))
  );

create policy preventive_evidence_select on storage.objects
  for select to authenticated using (
    bucket_id = 'preventive-evidence'
    and public.can_access_preventive_photo_path(name, false)
  );
create policy preventive_evidence_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'preventive-evidence'
    and public.can_access_preventive_photo_path(name, true)
  );
create policy preventive_evidence_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'preventive-evidence'
    and public.can_access_preventive_photo_path(name, true)
  );

commit;
