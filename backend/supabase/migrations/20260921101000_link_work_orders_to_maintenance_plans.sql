-- V1 MARV: rastreia qual plano preventivo originou a OS.
-- Uma OS por ciclo: o mesmo plano gera várias OS ao longo do tempo, sem índice único.

alter table public.work_orders
  add column if not exists source_maintenance_plan_id uuid
    references public.maintenance_plans(id) on delete restrict;

create index if not exists idx_work_orders_source_maintenance_plan
  on public.work_orders (source_maintenance_plan_id)
  where source_maintenance_plan_id is not null;

-- Mantém o mesmo padrão de proteção de escopo das demais colunas de OS.
create or replace function public.validate_work_order_maintenance_plan_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  plan_tenant_id uuid;
begin
  if new.source_maintenance_plan_id is null then
    return new;
  end if;

  select tenant_id
    into plan_tenant_id
  from public.maintenance_plans
  where id = new.source_maintenance_plan_id;

  if plan_tenant_id is null or plan_tenant_id <> new.tenant_id then
    raise exception 'A OS precisa usar o plano preventivo do mesmo cliente.';
  end if;

  return new;
end;
$$;

drop trigger if exists work_orders_validate_maintenance_plan_scope on public.work_orders;
create trigger work_orders_validate_maintenance_plan_scope
  before insert or update of source_maintenance_plan_id, tenant_id on public.work_orders
  for each row execute procedure public.validate_work_order_maintenance_plan_scope();
