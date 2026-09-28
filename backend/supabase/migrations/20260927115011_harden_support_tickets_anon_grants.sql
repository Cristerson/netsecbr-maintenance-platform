revoke all on table public.support_tickets from anon;

revoke update, delete, truncate, references, trigger
on table public.support_tickets
from authenticated;

grant select, insert
on table public.support_tickets
to authenticated;
