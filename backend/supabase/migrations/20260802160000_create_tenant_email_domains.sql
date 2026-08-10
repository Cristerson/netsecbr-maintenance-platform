create table if not exists public.tenant_email_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  domain text not null check (domain = lower(domain)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, domain)
);

create index if not exists idx_tenant_email_domains_active
  on public.tenant_email_domains (tenant_id, domain)
  where is_active = true;

alter table public.tenant_email_domains enable row level security;

insert into public.tenant_email_domains (tenant_id, domain)
select id, 'netsecbr.com.br'
from public.tenants
where trade_name = 'NETSECBR Demonstração'
on conflict (tenant_id, domain) do nothing;
