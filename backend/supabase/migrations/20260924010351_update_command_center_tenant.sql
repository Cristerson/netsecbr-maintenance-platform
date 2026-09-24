-- Command Center: edição controlada do cadastro e da situação de acesso do cliente.
-- SECURITY INVOKER preserva RLS; a autorização é validada novamente no banco.

create or replace function public.update_command_center_tenant(
  target_tenant_id uuid,
  target_legal_name text,
  target_trade_name text,
  target_document_number text,
  target_status text,
  change_reason text default null
)
returns table (
  tenant_id uuid,
  legal_name text,
  trade_name text,
  document_number text,
  tenant_status text,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  previous_tenant public.tenants%rowtype;
  saved_tenant public.tenants%rowtype;
  normalized_legal_name text := btrim(target_legal_name);
  normalized_trade_name text := btrim(target_trade_name);
  normalized_document_number text := nullif(btrim(target_document_number), '');
  normalized_reason text := nullif(btrim(change_reason), '');
  document_digits text;
  first_document_digit integer;
  second_document_digit integer;
  status_changed boolean := false;
begin
  if actor_id is null or not public.is_netsecbr_admin() then
    raise exception 'Acesso negado ao Command Center.';
  end if;

  if normalized_legal_name is null or normalized_legal_name = '' then
    raise exception 'Informe a razão social do cliente.';
  end if;

  if normalized_trade_name is null or normalized_trade_name = '' then
    raise exception 'Informe o nome comercial do cliente.';
  end if;

  if target_status not in ('active', 'grace_period', 'payment_only', 'suspended') then
    raise exception 'Situação de acesso inválida.';
  end if;

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
  end if;

  select * into previous_tenant
  from public.tenants
  where id = target_tenant_id
  for update;

  if not found then
    raise exception 'Cliente não encontrado.';
  end if;

  status_changed := previous_tenant.status is distinct from target_status;

  if status_changed
     and target_status in ('payment_only', 'suspended')
     and normalized_reason is null then
    raise exception 'Informe o motivo para restringir o acesso do cliente.';
  end if;

  update public.tenants
  set legal_name = normalized_legal_name,
      trade_name = normalized_trade_name,
      document_number = normalized_document_number,
      status = target_status,
      updated_at = now()
  where id = target_tenant_id
  returning * into saved_tenant;

  insert into public.audit_logs (tenant_id, actor_id, action, resource_type, resource_id, metadata)
  values (
    saved_tenant.id,
    actor_id,
    case when status_changed then 'tenant_access_status_changed' else 'tenant_profile_updated' end,
    'tenant',
    saved_tenant.id::text,
    jsonb_build_object(
      'previous', jsonb_build_object(
        'legal_name', previous_tenant.legal_name,
        'trade_name', previous_tenant.trade_name,
        'document_number', previous_tenant.document_number,
        'status', previous_tenant.status
      ),
      'current', jsonb_build_object(
        'legal_name', saved_tenant.legal_name,
        'trade_name', saved_tenant.trade_name,
        'document_number', saved_tenant.document_number,
        'status', saved_tenant.status
      ),
      'reason', normalized_reason
    )
  );

  return query
  select saved_tenant.id, saved_tenant.legal_name, saved_tenant.trade_name,
         saved_tenant.document_number, saved_tenant.status, saved_tenant.updated_at;
end;
$$;

revoke all on function public.update_command_center_tenant(uuid, text, text, text, text, text) from public;
revoke all on function public.update_command_center_tenant(uuid, text, text, text, text, text) from anon;
grant execute on function public.update_command_center_tenant(uuid, text, text, text, text, text) to authenticated;
