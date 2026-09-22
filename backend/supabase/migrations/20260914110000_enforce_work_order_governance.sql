-- V1 MARV: regras de encerramento e reabertura de ordens de servico.

alter table public.work_orders
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references public.profiles(id) on delete set null,
  add column if not exists reopen_reason text;

create index if not exists idx_work_orders_tenant_reopened_at
  on public.work_orders (tenant_id, reopened_at desc)
  where reopened_at is not null;

create or replace function public.enforce_work_order_governance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'completed' and new.status <> 'completed' then
    if not (
      (select public.is_netsecbr_admin())
      or public.is_tenant_admin(new.tenant_id)
    ) then
      raise exception 'Somente um supervisor pode reabrir uma OS concluida.';
    end if;

    if coalesce(trim(new.reopen_reason), '') = '' then
      raise exception 'Informe o motivo para reabrir uma OS concluida.';
    end if;

    new.reopened_at := now();
    new.reopened_by := auth.uid();
  end if;

  if old.status <> 'completed' and new.status = 'completed' then
    if new.diagnosis_category is null
       or new.root_cause_category is null
       or new.action_category is null
       or new.recommendation_category is null then
      raise exception 'Classifique diagnostico, causa, acao e recomendacao antes de concluir a OS.';
    end if;

    if new.causes_equipment_downtime
       and new.downtime_ended_at is null
       and coalesce(new.recommendation_category, '') <> 'Condenado / perda total' then
      raise exception 'Informe o fim da parada antes de concluir a OS ou classifique como condenado/perda total.';
    end if;

    new.completed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists work_orders_enforce_governance on public.work_orders;

create trigger work_orders_enforce_governance
  before update on public.work_orders
  for each row
  execute procedure public.enforce_work_order_governance();
