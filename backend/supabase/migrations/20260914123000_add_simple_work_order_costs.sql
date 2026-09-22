-- V1 MARV: custos simples consolidados na propria ordem de servico.
-- O total e calculado pelo banco para evitar divergencia de valores.

alter table public.work_orders
  add column if not exists service_cost_cents bigint
    check (service_cost_cents is null or service_cost_cents >= 0),
  add column if not exists material_cost_cents bigint
    check (material_cost_cents is null or material_cost_cents >= 0),
  add column if not exists total_cost_cents bigint
    generated always as (
      coalesce(service_cost_cents, 0) + coalesce(material_cost_cents, 0)
    ) stored;
