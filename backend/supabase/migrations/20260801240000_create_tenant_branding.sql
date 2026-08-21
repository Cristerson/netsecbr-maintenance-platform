-- Entrega 10: identidade visual personalizada por tenant.

create table public.tenant_branding (
  tenant_id uuid primary key references public.tenants(id) on delete restrict,
  display_name text,
  logo_path text,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  report_header_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenant_branding enable row level security;
grant select, insert, update on public.tenant_branding to authenticated;

create policy "tenant_branding_select_own_tenant_or_global_admin"
on public.tenant_branding for select to authenticated
using ((select public.is_netsecbr_admin()) or public.is_tenant_member(tenant_id));

create policy "tenant_branding_manage_tenant_admin_or_global_admin"
on public.tenant_branding for all to authenticated
using ((select public.is_netsecbr_admin()) or public.is_tenant_admin(tenant_id))
with check ((select public.is_netsecbr_admin()) or public.is_tenant_admin(tenant_id));

-- O bucket e as políticas de upload serão criados na entrega da tela de administração.
