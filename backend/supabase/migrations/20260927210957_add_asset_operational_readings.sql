-- Leituras operacionais manuais no MVP, preparadas para futura captura por OCR ou IoT.
-- As leituras são imutáveis para preservar histórico e rastreabilidade.

create table public.asset_operational_readings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  asset_id uuid not null references public.assets(id) on delete restrict,
  hour_meter_hours numeric(14, 2),
  current_temperature_c numeric(6, 2),
  health_status text not null default 'normal'
    check (health_status in ('normal', 'attention', 'critical', 'unavailable')),
  source text not null default 'manual'
    check (source in ('manual', 'ocr', 'iot')),
  captured_at timestamptz not null default now(),
  evidence_storage_path text,
  ocr_payload jsonb,
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (hour_meter_hours is null or hour_meter_hours >= 0),
  check (current_temperature_c is null or current_temperature_c between -100 and 1000),
  check (hour_meter_hours is not null or current_temperature_c is not null or nullif(btrim(notes), '') is not null)
);

create index idx_asset_operational_readings_tenant_asset_captured
  on public.asset_operational_readings (tenant_id, asset_id, captured_at desc);

alter table public.asset_operational_readings enable row level security;

grant select, insert on table public.asset_operational_readings to authenticated;

create policy "asset_operational_readings_select_own_operational_tenant"
on public.asset_operational_readings for select to authenticated
using (
  public.is_netsecbr_admin()
  or (public.is_tenant_member(tenant_id) and public.tenant_allows_operation(tenant_id))
);

create policy "asset_operational_readings_insert_tenant_admin"
on public.asset_operational_readings for insert to authenticated
with check (
  public.is_netsecbr_admin()
  or (public.is_tenant_admin(tenant_id) and public.tenant_allows_operation(tenant_id))
);
