-- CC-CLIENTE-01: cadastro de cliente pelo Command Center com contato principal
-- e domínios autorizados. Não cria contrato, plano, usuário e não mexe em Auth.

-- 1. Tabela de contatos do cliente (contato principal, com suporte a múltiplos
-- contatos no futuro via is_primary/is_active).
create table public.tenant_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  is_primary boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenant_contacts_tenant_id_idx
  on public.tenant_contacts (tenant_id);

-- No máximo um contato primário ativo por tenant.
create unique index tenant_contacts_one_primary_active_idx
  on public.tenant_contacts (tenant_id)
  where is_primary = true and is_active = true;

alter table public.tenant_contacts enable row level security;

-- Grants mínimos: anon não acessa; authenticated só precisa de leitura e da
-- escrita feita pela RPC SECURITY INVOKER do Command Center.
revoke all on table public.tenant_contacts from public;
revoke all on table public.tenant_contacts from anon;
revoke all on table public.tenant_contacts from authenticated;
grant select, insert on table public.tenant_contacts to authenticated;

create policy "tenant_contacts_all_global_admin"
on public.tenant_contacts for all to authenticated
using ((select public.is_netsecbr_admin()))
with check ((select public.is_netsecbr_admin()));

create policy "tenant_contacts_select_tenant_admin"
on public.tenant_contacts for select to authenticated
using (public.is_tenant_admin(tenant_id));

-- 2. tenant_email_domains tem RLS desde 20260802160000 sem nenhuma policy.
-- A nova RPC é SECURITY INVOKER, então o admin NETSECBR precisa desta policy
-- para gravar os domínios autorizados do novo cliente.
drop policy if exists "tenant_email_domains_all_global_admin" on public.tenant_email_domains;

create policy "tenant_email_domains_all_global_admin"
on public.tenant_email_domains for all to authenticated
using ((select public.is_netsecbr_admin()))
with check ((select public.is_netsecbr_admin()));

grant select, insert, update, delete on table public.tenant_email_domains to authenticated;


-- 3. RPC de criação: valida, grava cliente + contato principal + domínios e
-- audita na mesma transação. SECURITY INVOKER preserva RLS; autorização e
-- validações são refeitas no banco.
create or replace function public.create_command_center_tenant(
  target_legal_name text,
  target_trade_name text,
  target_document_number text,
  target_status text,
  target_contact_full_name text,
  target_contact_email text,
  target_contact_phone text,
  extra_domains text[] default array[]::text[],
  change_reason text default null
)
returns table (
  tenant_id uuid,
  legal_name text,
  trade_name text,
  document_number text,
  tenant_status text,
  contact_full_name text,
  contact_email text,
  contact_phone text,
  domains text[],
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_legal_name text := btrim(target_legal_name);
  normalized_trade_name text := btrim(target_trade_name);
  normalized_document_number text := nullif(btrim(target_document_number), '');
  normalized_contact_name text := btrim(target_contact_full_name);
  normalized_contact_email text := lower(btrim(target_contact_email));
  normalized_contact_phone text := nullif(btrim(target_contact_phone), '');
  normalized_reason text := nullif(btrim(change_reason), '');
  primary_domain text;
  normalized_domains text[] := array[]::text[];
  extra_domain text;
  document_digits text;
  first_document_digit integer;
  second_document_digit integer;
  saved_tenant public.tenants%rowtype;
begin
  if actor_id is null or not public.is_netsecbr_admin() then
    raise exception 'Acesso negado ao Command Center.';
  end if;

  if normalized_legal_name is null or normalized_legal_name = '' then
    raise exception 'Informe a razão social do cliente.';
  end if;

  if normalized_trade_name is null or normalized_trade_name = '' then
    raise exception 'Informe o nome fantasia do cliente.';
  end if;

  if target_status not in ('active', 'grace_period', 'payment_only', 'suspended') then
    raise exception 'Situação de acesso inválida.';
  end if;

  -- Mesma regra de update_command_center_tenant: CNPJ opcional, mas se vier precisa ser válido.
  if normalized_document_number is not null then
    document_digits := regexp_replace(normalized_document_number, '\D', '', 'g');

    if length(document_digits) <> 14 or document_digits ~ '^(\d)\1{13}$' then
      raise exception 'Informe um CNPJ válido ou deixe o campo em branco.';
    end if;

    first_document_digit := 11 - (
      (
        substring(document_digits from 1 for 1)::integer * 5 +
        substring(document_digits from 2 for 1)::integer * 4 +
        substring(document_digits from 3 for 1)::integer * 3 +
        substring(document_digits from 4 for 1)::integer * 2 +
        substring(document_digits from 5 for 1)::integer * 9 +
        substring(document_digits from 6 for 1)::integer * 8 +
        substring(document_digits from 7 for 1)::integer * 7 +
        substring(document_digits from 8 for 1)::integer * 6 +
        substring(document_digits from 9 for 1)::integer * 5 +
        substring(document_digits from 10 for 1)::integer * 4 +
        substring(document_digits from 11 for 1)::integer * 3 +
        substring(document_digits from 12 for 1)::integer * 2
      ) % 11
    );
    first_document_digit := case when first_document_digit >= 10 then 0 else first_document_digit end;

    second_document_digit := 11 - (
      (
        substring(document_digits from 1 for 1)::integer * 6 +
        substring(document_digits from 2 for 1)::integer * 5 +
        substring(document_digits from 3 for 1)::integer * 4 +
        substring(document_digits from 4 for 1)::integer * 3 +
        substring(document_digits from 5 for 1)::integer * 2 +
        substring(document_digits from 6 for 1)::integer * 9 +
        substring(document_digits from 7 for 1)::integer * 8 +
        substring(document_digits from 8 for 1)::integer * 7 +
        substring(document_digits from 9 for 1)::integer * 6 +
        substring(document_digits from 10 for 1)::integer * 5 +
        substring(document_digits from 11 for 1)::integer * 4 +
        substring(document_digits from 12 for 1)::integer * 3 +
        first_document_digit * 2
      ) % 11
    );
    second_document_digit := case when second_document_digit >= 10 then 0 else second_document_digit end;

    if substring(document_digits from 13 for 1)::integer <> first_document_digit
       or substring(document_digits from 14 for 1)::integer <> second_document_digit then
      raise exception 'Informe um CNPJ válido ou deixe o campo em branco.';
    end if;

    -- Duplicidade com mensagem amigável (compara só dígitos, ignora formatação).
    if exists (
      select 1
      from public.tenants existing_tenant
      where regexp_replace(coalesce(existing_tenant.document_number, ''), '\D', '', 'g') = document_digits
    ) then
      raise exception 'Já existe um cliente cadastrado com este CNPJ.';
    end if;
  end if;


  -- Contato principal.
  if normalized_contact_name is null or normalized_contact_name = '' then
    raise exception 'Informe o nome completo do contato principal.';
  end if;

  if normalized_contact_email is null or normalized_contact_email = '' then
    raise exception 'Informe o e-mail do contato principal.';
  end if;

  if normalized_contact_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe um e-mail válido para o contato principal.';
  end if;

  -- 11. Domínio principal extraído do e-mail do contato.
  primary_domain := substring(normalized_contact_email from position('@' in normalized_contact_email) + 1);

  if primary_domain !~ '\.' or primary_domain like '.%' or primary_domain like '%.' then
    raise exception 'Não foi possível extrair um domínio válido do e-mail do contato principal.';
  end if;

  -- 12. Normaliza domínios extras: minúsculo, trim, sem @, sem espaços,
  -- com ponto, sem ponta e sem duplicidade em relação aos já aceitos.
  normalized_domains := array[primary_domain];

  foreach extra_domain in array coalesce(extra_domains, array[]::text[])
  loop
    extra_domain := replace(lower(btrim(extra_domain)), ' ', '');
    extra_domain := replace(extra_domain, '@', '');

    if extra_domain = '' or extra_domain !~ '\.' then
      raise exception 'Domínio "%" é inválido: informe um domínio com ponto, como dedini.com.br.', extra_domain;
    end if;

    if extra_domain like '.%' or extra_domain like '%.' then
      raise exception 'Domínio "%" é inválido: não pode começar nem terminar com ponto.', extra_domain;
    end if;

    if not (extra_domain = any(normalized_domains)) then
      normalized_domains := array_append(normalized_domains, extra_domain);
    end if;
  end loop;

  -- 13. Cliente.
  insert into public.tenants (legal_name, trade_name, document_number, status)
  values (normalized_legal_name, normalized_trade_name, normalized_document_number, target_status)
  returning * into saved_tenant;

  -- 14. Contato principal.
  insert into public.tenant_contacts (tenant_id, full_name, email, phone, is_primary, is_active)
  values (saved_tenant.id, normalized_contact_name, normalized_contact_email, normalized_contact_phone, true, true);

  -- 15. Domínio principal + domínios extras (sem duplicar).
  insert into public.tenant_email_domains (tenant_id, domain)
  select saved_tenant.id, domain_value
  from unnest(normalized_domains) as domain_list(domain_value)
  on conflict (tenant_id, domain) do nothing;

  -- 16/17. Auditoria com cliente, contato e domínios.
  insert into public.audit_logs (tenant_id, actor_id, action, resource_type, resource_id, metadata)
  values (
    saved_tenant.id,
    actor_id,
    'tenant_created',
    'tenant',
    saved_tenant.id::text,
    jsonb_build_object(
      'client', jsonb_build_object(
        'legal_name', saved_tenant.legal_name,
        'trade_name', saved_tenant.trade_name,
        'document_number', saved_tenant.document_number,
        'status', saved_tenant.status
      ),
      'contact', jsonb_build_object(
        'full_name', normalized_contact_name,
        'email', normalized_contact_email,
        'phone', normalized_contact_phone
      ),
      'domains', to_jsonb(normalized_domains),
      'reason', normalized_reason
    )
  );

  -- 18. Resposta para o frontend.
  return query
  select
    saved_tenant.id,
    saved_tenant.legal_name,
    saved_tenant.trade_name,
    saved_tenant.document_number,
    saved_tenant.status,
    normalized_contact_name,
    normalized_contact_email,
    normalized_contact_phone,
    normalized_domains,
    saved_tenant.created_at;
end;
$$;

revoke all on function public.create_command_center_tenant(text, text, text, text, text, text, text, text[], text) from public;
revoke all on function public.create_command_center_tenant(text, text, text, text, text, text, text, text[], text) from anon;
grant execute on function public.create_command_center_tenant(text, text, text, text, text, text, text, text[], text) to authenticated;
