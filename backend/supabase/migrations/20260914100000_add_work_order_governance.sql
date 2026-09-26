-- V1 MARV: governança operacional das ordens de serviço.
-- Não inclui compras, estoque ou catálogo de peças.

alter table public.work_orders
  add column if not exists diagnosis text,
  add column if not exists root_cause text,
  add column if not exists action_taken text,
  add column if not exists resolution_notes text,
  add column if not exists causes_equipment_downtime boolean not null default false,
  add column if not exists downtime_started_at timestamptz,
  add column if not exists downtime_ended_at timestamptz,
  add column if not exists attendance_started_at timestamptz,
  add column if not exists repair_started_at timestamptz,
  add column if not exists supplier_wait_started_at timestamptz,
  add column if not exists material_wait_started_at timestamptz;

alter table public.work_orders
  add constraint work_orders_downtime_window
  check (
    downtime_ended_at is null
    or (
      downtime_started_at is not null
      and downtime_ended_at >= downtime_started_at
    )
  );
