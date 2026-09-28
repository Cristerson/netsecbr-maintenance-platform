-- CC-ATENDIMENTO-01: portal do cliente para abertura guiada de chamados NETSECBR.
-- Evolui public.support_tickets sem apagar dados, restringe o acesso amplo da policy
-- tickets_tenant e cria a RPC public.create_tenant_support_ticket com auditoria.

alter table public.support_tickets
  add column if not exists service_area text,
  add column if not exists service_category text,
  add column if not exists service_topic text;

-- Remove apenas a policy ampla original (qualquer membro podia ALL).
drop policy if exists "tickets_tenant" on public.support_tickets;

-- Reconcede apenas o necessário: leitura geral para authenticated (policies decidem),
-- insert/update/delete passam a depender das policies restritivas abaixo.
revoke all on public.support_tickets from authenticated;
grant select, insert, update on public.support_tickets to authenticated;

-- NETSECBR mantém gerenciamento total (futuro painel interno do Command Center).
create policy "tickets_netsecbr_manage"
on public.support_tickets for all to authenticated
using ((select public.is_netsecbr_admin()))
with check ((select public.is_netsecbr_admin()));

-- tenant_admin lê somente tickets do próprio tenant.
create policy "tickets_tenant_admin_read"
on public.support_tickets for select to authenticated
using (public.is_tenant_admin(tenant_id));

-- Sem update/delete pelo cliente: a ausência de policies de update/delete para
-- tenant bloqueia essas operações (apenas a NETSECBR gerencia pelo painel interno).

-- RPC de abertura guiada: valida tenant_admin, gera título, insere e audita.
create or replace function public.create_tenant_support_ticket(
  target_tenant_id uuid,
  target_service_area text,
  target_service_category text,
  target_service_topic text,
  target_description text
)
returns table (ticket_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_area text := nullif(btrim(target_service_area), '');
  normalized_category text := nullif(btrim(target_service_category), '');
  normalized_topic text := nullif(btrim(target_service_topic), '');
  normalized_description text := nullif(btrim(target_description), '');
  generated_title text;
  new_ticket_id uuid;
begin
  if actor_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if target_tenant_id is null then
    raise exception 'Cliente não informado.';
  end if;

  if not public.is_tenant_admin(target_tenant_id) then
    raise exception 'Somente o administrador do cliente pode abrir chamados para a NETSECBR.';
  end if;

  if normalized_area is null or normalized_category is null or normalized_topic is null then
    raise exception 'Selecione o assunto, a categoria e o detalhe do caso.';
  end if;

  if normalized_description is null
     or char_length(normalized_description) < 10
     or char_length(normalized_description) > 3000 then
    raise exception 'Descreva o que aconteceu com 10 a 3000 caracteres.';
  end if;

  generated_title := normalized_area || ' · ' || normalized_category || ' · ' || normalized_topic;

  insert into public.support_tickets (
    tenant_id, title, description, status, priority,
    service_area, service_category, service_topic, opened_by
  )
  values (
    target_tenant_id, generated_title, normalized_description, 'open', 'medium',
    normalized_area, normalized_category, normalized_topic, actor_id
  )
  returning id into new_ticket_id;

  insert into public.audit_logs (tenant_id, actor_id, action, resource_type, resource_id, metadata)
  values (
    target_tenant_id,
    actor_id,
    'support_ticket_opened',
    'support_ticket',
    new_ticket_id::text,
    jsonb_build_object(
      'service_area', normalized_area,
      'service_category', normalized_category,
      'service_topic', normalized_topic
    )
  );

  return query select new_ticket_id;
end;
$$;

revoke all on function public.create_tenant_support_ticket(uuid, text, text, text, text) from public;
revoke all on function public.create_tenant_support_ticket(uuid, text, text, text, text) from anon;
grant execute on function public.create_tenant_support_ticket(uuid, text, text, text, text) to authenticated;
