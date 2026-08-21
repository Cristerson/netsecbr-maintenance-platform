-- Sincroniza o status da OS conforme as requisições de compra.

create or replace function public.sync_work_order_material_status()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  has_open_material_request boolean;
begin
  if new.status in ('pending_approval', 'approved', 'sent_to_supplier') then
    update public.work_orders
    set
      status = 'waiting_material',
      completed_at = null,
      updated_at = now()
    where id = new.work_order_id
      and status not in ('completed', 'cancelled');

  elsif new.status in ('received', 'cancelled') then
    select exists (
      select 1
      from public.purchase_requests request
      where request.work_order_id = new.work_order_id
        and request.id <> new.id
        and request.status in (
          'pending_approval',
          'approved',
          'sent_to_supplier'
        )
    )
    into has_open_material_request;

    if not has_open_material_request then
      update public.work_orders
      set
        status = 'in_progress',
        updated_at = now()
      where id = new.work_order_id
        and status = 'waiting_material';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_work_order_material_status() from public;
revoke all on function public.sync_work_order_material_status() from anon;
revoke all on function public.sync_work_order_material_status() from authenticated;

create trigger purchase_requests_sync_work_order_material_status
  after insert or update of status
  on public.purchase_requests
  for each row
  execute function public.sync_work_order_material_status();