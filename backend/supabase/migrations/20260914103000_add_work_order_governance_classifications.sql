-- V1 MARV: classificacoes padronizadas para indicadores de governanca.
-- Os campos textuais da OS continuam livres para registrar o contexto tecnico.

alter table public.work_orders
  add column if not exists diagnosis_category text,
  add column if not exists root_cause_category text,
  add column if not exists action_category text,
  add column if not exists recommendation_category text;

create index if not exists idx_work_orders_tenant_diagnosis_category
  on public.work_orders (tenant_id, diagnosis_category)
  where diagnosis_category is not null;

create index if not exists idx_work_orders_tenant_root_cause_category
  on public.work_orders (tenant_id, root_cause_category)
  where root_cause_category is not null;

create index if not exists idx_work_orders_tenant_action_category
  on public.work_orders (tenant_id, action_category)
  where action_category is not null;

create index if not exists idx_work_orders_tenant_recommendation_category
  on public.work_orders (tenant_id, recommendation_category)
  where recommendation_category is not null;
