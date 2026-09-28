-- Leituras operacionais são imutáveis: nenhum acesso anônimo e, para usuários
-- autenticados, somente consulta e inclusão passam pelas policies de RLS.

revoke all on table public.asset_operational_readings from anon;

revoke update, delete, truncate, references, trigger
on table public.asset_operational_readings
from authenticated;

grant select, insert
on table public.asset_operational_readings
to authenticated;
