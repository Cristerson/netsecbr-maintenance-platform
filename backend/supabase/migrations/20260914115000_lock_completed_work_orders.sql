-- V1 MARV: OS concluidas e canceladas preservam o historico do ativo.
-- Campos descritivos podem ser corrigidos por quem ja possui permissao de edicao,
-- mas o status final nao retorna ao fluxo operacional.

create or replace function public.enforce_work_order_governance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status in ('completed', 'cancelled') and new.status <> old.status then
    raise exception 'Uma OS concluida ou cancelada nao pode ser reaberta. Crie uma nova OS.';
  end if;

  if old.status <> 'cancelled' and new.status = 'cancelled' then
    if coalesce(trim(new.cancellation_reason), '') = '' then
      raise exception 'Informe o motivo para cancelar uma OS.';
    end if;
    new.cancelled_at := now();
    new.cancelled_by := auth.uid();
  end if;

  if old.status <> 'completed' and new.status = 'completed' then
    if new.diagnosis_category is null or new.root_cause_category is null
       or new.action_category is null or new.recommendation_category is null then
      raise exception 'Classifique diagnostico, causa, acao e recomendacao antes de concluir a OS.';
    end if;
    if new.causes_equipment_downtime and new.downtime_ended_at is null
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
  for each row execute procedure public.enforce_work_order_governance();
