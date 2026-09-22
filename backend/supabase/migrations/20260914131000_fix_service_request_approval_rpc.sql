-- Corrige ambiguidade entre a coluna work_orders.order_number e o retorno da RPC.

create or replace function public.approve_service_request_and_create_work_order(target_request_id uuid)
returns table (work_order_id uuid, order_number bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.service_requests%rowtype;
  created_work_order_id uuid;
  created_order_number bigint;
begin
  select * into request_row
  from public.service_requests
  where id = target_request_id
  for update;

  if request_row.id is null then
    raise exception 'Solicitacao nao encontrada.';
  end if;

  if not (
    (select public.is_netsecbr_admin())
    or public.is_tenant_admin(request_row.tenant_id)
  ) then
    raise exception 'Somente o supervisor pode aprovar uma solicitacao.';
  end if;

  if request_row.status <> 'triaged' then
    raise exception 'A solicitacao precisa estar em triagem antes da aprovacao.';
  end if;

  if coalesce(trim(request_row.triage_notes), '') = '' then
    raise exception 'Informe a triagem antes da aprovacao.';
  end if;

  insert into public.work_orders as created_order (
    tenant_id, unit_id, cost_center_id, asset_id, source_service_request_id,
    title, description, type, priority, status, opened_by,
    estimated_service_cost_cents, estimated_material_cost_cents
  ) values (
    request_row.tenant_id, request_row.unit_id, request_row.cost_center_id,
    request_row.asset_id, request_row.id, request_row.title, request_row.description,
    'corrective', request_row.priority, 'open', auth.uid(),
    request_row.estimated_service_cost_cents, request_row.estimated_material_cost_cents
  )
  returning created_order.id, created_order.order_number
    into created_work_order_id, created_order_number;

  update public.service_requests
  set status = 'converted_to_wo',
      converted_to_work_order_id = created_work_order_id,
      approved_at = now(),
      approved_by = auth.uid()
  where id = request_row.id;

  work_order_id := created_work_order_id;
  order_number := created_order_number;
  return next;
end;
$$;

revoke all on function public.approve_service_request_and_create_work_order(uuid) from public;
revoke all on function public.approve_service_request_and_create_work_order(uuid) from anon;
grant execute on function public.approve_service_request_and_create_work_order(uuid) to authenticated;
