-- Fundação local: ciclos explícitos e geração idempotente de OS preventiva.
-- Executar como arquivo único. BEGIN/COMMIT tornam a RPC nova e a antiga atômicas.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
do $$
begin
  if to_regclass('public.preventive_work_order_plan_snapshots') is not null
     or to_regprocedure('public.create_preventive_cycle_work_order(uuid,date)') is not null
     or to_regprocedure('public.create_preventive_work_order_from_plan(uuid)') is null then
    raise exception 'Pré-condição da fundação preventiva falhou; não reaplicar.';
  end if;
end;
$$;
-- Não reconcilia automaticamente OS históricas sem chave de ciclo.

alter table public.maintenance_plans
  add column if not exists cycle_policy text not null default 'interval',
  add column if not exists annual_anchor_date date;

-- A data-âncora conserva 29/02 em ciclos bissextos; 2024 -> 2025 -> 2028
-- deve voltar a 29/02, em vez de fixar permanentemente 28/02.
update public.maintenance_plans
set annual_anchor_date = next_due_date
where cycle_policy = 'annual_calendar' and annual_anchor_date is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.maintenance_plans'::regclass
      and conname = 'maintenance_plans_cycle_policy_check'
  ) then
    alter table public.maintenance_plans
      add constraint maintenance_plans_cycle_policy_check
      check (
        cycle_policy = 'interval'
        or (cycle_policy = 'annual_calendar' and periodicity_days in (365, 366)
            and annual_anchor_date is not null)
      );
  end if;
end;
$$;

create or replace function public.set_maintenance_plan_annual_anchor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.cycle_policy = 'annual_calendar' then
    if tg_op = 'INSERT' then
      new.annual_anchor_date := new.next_due_date;
    elsif old.cycle_policy is distinct from 'annual_calendar' then
      new.annual_anchor_date := new.next_due_date;
    elsif new.annual_anchor_date is distinct from old.annual_anchor_date then
      raise exception 'A âncora anual não pode ser alterada sem reconciliação auditável.';
    end if;
  else
    new.annual_anchor_date := null;
  end if;
  return new;
end;
$$;

create trigger maintenance_plans_set_annual_anchor
  before insert or update on public.maintenance_plans
  for each row execute function public.set_maintenance_plan_annual_anchor();

create or replace function public.next_annual_calendar_due_date(
  current_due date,
  anchor_date date
)
returns date
language sql
immutable
strict
set search_path = ''
as $$
  select make_date(
    extract(year from current_due)::integer + 1,
    extract(month from anchor_date)::integer,
    1
  ) + least(
    extract(day from anchor_date)::integer,
    extract(day from (
      make_date(
        extract(year from current_due)::integer + 1,
        extract(month from anchor_date)::integer,
        1
      ) + interval '1 month' - interval '1 day'
    ))::integer
  ) - 1;
$$;

revoke all on function public.next_annual_calendar_due_date(date,date) from public;
revoke all on function public.next_annual_calendar_due_date(date,date) from anon;
grant execute on function public.next_annual_calendar_due_date(date,date) to authenticated;

alter table public.work_orders
  add column if not exists preventive_cycle_key text,
  add column if not exists preventive_cycle_policy text,
  add column if not exists preventive_original_due_date date;

-- Cancelamento e reabertura preservam a identidade: status não participa da chave.
-- OS antigas com chave nula ficam fora até reconciliação explícita, sem apagar histórico.
create unique index work_orders_one_primary_preventive_cycle
  on public.work_orders (tenant_id, asset_id, preventive_cycle_key)
  where type = 'preventive' and preventive_cycle_key is not null;

create table public.preventive_work_order_plan_snapshots (
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  maintenance_plan_id uuid not null references public.maintenance_plans(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  plan_name text not null,
  plan_notes text,
  periodicity_days integer not null,
  original_due_date date not null,
  captured_at timestamptz not null default now(),
  primary key (work_order_id, maintenance_plan_id)
);

create index preventive_snapshots_tenant_order_idx
  on public.preventive_work_order_plan_snapshots (tenant_id, work_order_id);

alter table public.preventive_work_order_plan_snapshots enable row level security;
grant select on public.preventive_work_order_plan_snapshots to authenticated;

create policy preventive_snapshots_select_visible_order
on public.preventive_work_order_plan_snapshots for select to authenticated
using (
  exists (
    select 1 from public.work_orders work_order
    where work_order.id = public.preventive_work_order_plan_snapshots.work_order_id
      and work_order.tenant_id = public.preventive_work_order_plan_snapshots.tenant_id
  )
);

-- Fase de compatibilidade: a RPC antiga e os INSERTs sem chave permanecem
-- operacionais até o frontend novo estar publicado e monitorado. A unicidade
-- universal será ativada numa migration posterior de endurecimento.

create or replace function public.validate_preventive_cycle_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.type = 'preventive' and current_user = 'authenticated'
       and new.preventive_cycle_key is null then
      raise exception 'OS preventiva deve ser gerada pela rotina autorizada.';
    end if;
    if new.preventive_cycle_key is not null and current_user = 'authenticated' then
      raise exception 'Chaves de ciclo preventivo só podem ser criadas pela rotina autorizada.';
    end if;
    if new.type = 'preventive' and new.preventive_cycle_key is not null and (
      new.preventive_cycle_policy is null
      or new.preventive_original_due_date is null
      or new.asset_id is null
    ) then
      raise exception 'OS preventiva com chave de ciclo incompleta.';
    end if;
  elsif tg_op = 'UPDATE' then
    if old.preventive_cycle_key is null and new.preventive_cycle_key is not null then
      raise exception 'Reconciliação de ciclo histórico exige migration auditável.';
    end if;
    if old.preventive_cycle_key is not null and (
      new.preventive_cycle_key is distinct from old.preventive_cycle_key
      or new.preventive_original_due_date is distinct from old.preventive_original_due_date
      or new.preventive_cycle_policy is distinct from old.preventive_cycle_policy
      or new.source_maintenance_plan_id is distinct from old.source_maintenance_plan_id
      or new.asset_id is distinct from old.asset_id
      or new.tenant_id is distinct from old.tenant_id
      or new.type is distinct from old.type
    ) then
      raise exception 'A identidade do ciclo preventivo não pode ser alterada.';
    end if;
  end if;

  if new.type = 'preventive' and new.preventive_cycle_key is not null then
    if new.preventive_cycle_policy = 'annual_calendar' then
      if new.preventive_cycle_key is distinct from
        'annual:' || extract(year from new.preventive_original_due_date)::integer::text then
        raise exception 'Chave anual do ciclo preventivo inválida.';
      end if;
    elsif new.preventive_cycle_policy = 'interval' then
      if new.source_maintenance_plan_id is null
         or new.preventive_cycle_key is distinct from
           'interval:' || new.source_maintenance_plan_id::text || ':' || new.preventive_original_due_date::text then
        raise exception 'Chave de intervalo do ciclo preventivo inválida.';
      end if;
    else
      raise exception 'Política do ciclo preventivo inválida.';
    end if;
  end if;

  return new;
end;
$$;

create trigger work_orders_validate_preventive_cycle_identity
  before insert or update on public.work_orders
  for each row execute function public.validate_preventive_cycle_identity();

-- A assinatura nova informa se uma chamada repetida encontrou a OS existente.
create function public.create_preventive_cycle_work_order(
  target_plan_id uuid,
  target_original_due_date date
)
returns table (
  work_order_id uuid,
  order_number bigint,
  next_due_date date,
  was_existing boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  initial_plan public.maintenance_plans%rowtype;
  plan_row public.maintenance_plans%rowtype;
  asset_row public.assets%rowtype;
  plan_ids uuid[];
  cycle_key text;
  cycle_year integer;
  plan_titles text;
  cycle_original_due_date date;
  existing_order_id uuid;
  existing_order_number bigint;
  created_order_id uuid;
  created_order_number bigint;
begin
  if auth.uid() is null then
    raise exception 'Sessão autenticada é obrigatória.';
  end if;
  if target_original_due_date is null then
    raise exception 'A data original do ciclo é obrigatória.';
  end if;

  select * into initial_plan
  from public.maintenance_plans plan
  where plan.id = target_plan_id;
  if initial_plan.id is null then
    raise exception 'Plano preventivo não encontrado.';
  end if;

  -- Serializa todas as tentativas do mesmo ativo, mesmo quando partem de planos diferentes.
  select * into asset_row
  from public.assets asset
  where asset.id = initial_plan.asset_id
  for update;

  select * into plan_row
  from public.maintenance_plans plan
  where plan.id = target_plan_id
  for update;
  if plan_row.asset_id is distinct from asset_row.id
     or plan_row.tenant_id is distinct from asset_row.tenant_id
     or asset_row.deleted_at is not null then
    raise exception 'O plano ou ativo mudou durante a geração. Atualize e tente novamente.';
  end if;

  if not (public.is_netsecbr_admin() or public.is_tenant_admin(plan_row.tenant_id)) then
    raise exception 'Somente administrador autorizado pode gerar OS preventiva.';
  end if;
  if not public.tenant_allows_operation(plan_row.tenant_id) or not plan_row.is_active then
    raise exception 'O cliente ou plano não está liberado para gerar OS preventiva.';
  end if;

  if plan_row.cycle_policy = 'annual_calendar' then
    cycle_year := extract(year from target_original_due_date)::integer;
    cycle_key := 'annual:' || cycle_year::text;
  else
    cycle_key := 'interval:' || plan_row.id::text || ':' || target_original_due_date::text;
  end if;

  select work_order.id, work_order.order_number
    into existing_order_id, existing_order_number
  from public.work_orders work_order
  where work_order.tenant_id = plan_row.tenant_id
    and work_order.asset_id = plan_row.asset_id
    and work_order.type = 'preventive'
    and work_order.preventive_cycle_key = cycle_key
  limit 1;

  if existing_order_id is not null then
    work_order_id := existing_order_id;
    order_number := existing_order_number;
    next_due_date := plan_row.next_due_date;
    was_existing := true;
    return next;
    return;
  end if;

  if plan_row.next_due_date is distinct from target_original_due_date then
    raise exception 'O vencimento do plano mudou. Atualize a lista antes de gerar a OS.';
  end if;

  if plan_row.cycle_policy = 'annual_calendar' then
    select array_agg(plan.id order by plan.id) into plan_ids
    from public.maintenance_plans plan
    where plan.tenant_id = plan_row.tenant_id
      and plan.asset_id = plan_row.asset_id
      and plan.is_active
      and plan.cycle_policy = 'annual_calendar'
      and extract(year from plan.next_due_date)::integer = cycle_year;
  else
    plan_ids := array[plan_row.id];
  end if;

  perform 1 from public.maintenance_plans plan
  where plan.id = any(plan_ids)
  order by plan.id
  for update;

  -- Histórico sem chave não pode ser classificado automaticamente: falha fechada.
  if exists (
    select 1 from public.work_orders work_order
    where work_order.tenant_id = plan_row.tenant_id
      and work_order.asset_id = plan_row.asset_id
      and work_order.type = 'preventive'
      and work_order.preventive_cycle_key is null
      and (
        -- Legado sem data ou com data coincidente com o ciclo exige
        -- reconciliação antes de gerar outra OS para o mesmo ativo.
        work_order.scheduled_for is null
        -- O vínculo ao plano, isoladamente, não prova que a OS é deste ciclo.
        -- Datas anteriores não bloqueiam indefinidamente novas ocorrências.
        or (plan_row.cycle_policy = 'annual_calendar'
          and extract(year from work_order.scheduled_for)::integer = cycle_year)
        or (plan_row.cycle_policy = 'interval'
          and work_order.scheduled_for::date = plan_row.next_due_date)
      )
  ) then
    raise exception 'Existe OS preventiva histórica sem ciclo original comprovado para este ativo ou plano. Reconciliação manual necessária.';
  end if;

  select string_agg(plan.name, '; ' order by plan.id), min(plan.next_due_date)
    into plan_titles, cycle_original_due_date
  from public.maintenance_plans plan
  where plan.id = any(plan_ids);

  insert into public.work_orders as created_order (
    tenant_id, unit_id, cost_center_id, asset_id, source_maintenance_plan_id,
    title, description, type, priority, status, opened_by, assigned_to,
    scheduled_for, preventive_cycle_key, preventive_cycle_policy,
    preventive_original_due_date
  ) values (
    plan_row.tenant_id, asset_row.unit_id, asset_row.cost_center_id, asset_row.id,
    plan_row.id, left('Preventiva ' || cycle_key || ' - ' || asset_row.name, 180),
    'Planos de origem: ' || plan_titles,
    'preventive', 'medium', 'open', auth.uid(), plan_row.assigned_to,
    cycle_original_due_date::timestamptz, cycle_key, plan_row.cycle_policy,
    cycle_original_due_date
  )
  returning created_order.id, created_order.order_number
    into created_order_id, created_order_number;

  insert into public.preventive_work_order_plan_snapshots (
    work_order_id, maintenance_plan_id, tenant_id, plan_name, plan_notes,
    periodicity_days, original_due_date
  )
  select created_order_id, plan.id, plan.tenant_id, plan.name, plan.notes,
         plan.periodicity_days, plan.next_due_date
  from public.maintenance_plans plan
  where plan.id = any(plan_ids);

  -- Avança uma ocorrência por chamada; ciclos atrasados não são pulados.
  update public.maintenance_plans plan
  set next_due_date = case
        when plan.cycle_policy = 'annual_calendar'
          then public.next_annual_calendar_due_date(
            plan.next_due_date, plan.annual_anchor_date
          )
        else plan.next_due_date + plan.periodicity_days
      end
  where plan.id = any(plan_ids);

  select plan.next_due_date into next_due_date
  from public.maintenance_plans plan
  where plan.id = target_plan_id;

  work_order_id := created_order_id;
  order_number := created_order_number;
  was_existing := false;
  return next;
end;
$$;

revoke all on function public.create_preventive_cycle_work_order(uuid,date) from public;
revoke all on function public.create_preventive_cycle_work_order(uuid,date) from anon;
grant execute on function public.create_preventive_cycle_work_order(uuid,date) to authenticated;

-- Preserva a assinatura de três colunas usada pelo frontend publicado.
-- Não bloqueia o plano antes do ativo: a rotina nova usa sempre ativo -> planos.
create or replace function public.create_preventive_work_order_from_plan(
  target_plan_id uuid
)
returns table (work_order_id uuid, order_number bigint, next_due_date date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  original_due_date date;
begin
  if auth.uid() is null then
    raise exception 'Sessão autenticada é obrigatória.';
  end if;

  select plan.next_due_date into original_due_date
  from public.maintenance_plans plan
  where plan.id = target_plan_id;

  if not found then
    raise exception 'Plano preventivo não encontrado.';
  end if;

  return query
  select cycle.work_order_id, cycle.order_number, cycle.next_due_date
  from public.create_preventive_cycle_work_order(
    target_plan_id, original_due_date
  ) cycle;
end;
$$;

revoke all on function public.create_preventive_work_order_from_plan(uuid) from public;
revoke all on function public.create_preventive_work_order_from_plan(uuid) from anon;
grant execute on function public.create_preventive_work_order_from_plan(uuid) to authenticated;

commit;
