# MARV — SQL aplicado manualmente no banco principal

Projeto: `netsecbr-maintenance` (`zhsutxrvjocamdyyrquy`). Data: 01/11/2026.

## Estado material confirmado

1. `../migrations/20261031214019_preventive_cycle_foundation.sql` foi executado por `psql -f` como transação única (`COMMIT`, exit 0). O arquivo neste repositório é byte a byte igual ao aplicado: SHA-256 `22B6CE5E06DEA97C63FAD1912B44D866F4657B969297CE775B498CEB86CCDAC7`.
2. `2026-11-01_policy_unit_scope_hardening.sql` foi executado depois, em transação separada (`COMMIT`, exit 0). Este arquivo é byte a byte igual ao aplicado: SHA-256 `A9E12EF374C796FF1668FEFC8ACC3697B7119E3066AD21EF2CD4A177B4C43904`.
3. A migration antiga `../migrations/20260928100000_add_unit_visibility_authorization.sql` já estava materialmente presente antes dessas aplicações e **não foi reexecutada**.

**Não reaplicar nenhum desses SQLs no projeto principal. Não usar `db push` nesse projeto enquanto o histórico de migrations do CLI estiver desalinhado.** A execução direta por `psql` não registra versões em `supabase_migrations.schema_migrations`. O saneamento desse histórico exige tarefa e autorização separadas, com verificação material por versão. O SQL de policies fica nesta pasta de registro, não na fila de migrations pendentes.

## Evidência pós-aplicação

- RPC nova `create_preventive_cycle_work_order(uuid,date)` e RPC antiga `create_preventive_work_order_from_plan(uuid)` presentes; a antiga preserva retorno de três colunas.
- Índice `work_orders_one_primary_preventive_cycle` único e válido; RLS ativo em `work_orders`, `purchase_requests` e snapshots.
- `anon` sem EXECUTE nas duas RPCs; `authenticated` com EXECUTE.
- Uma policy INSERT de OS, uma SELECT de compras e uma INSERT de compras; as condições de autor e unidade foram preservadas/consolidadas.
- As sete OS preventivas históricas permanecem com `preventive_cycle_key` nula. Nenhuma foi alterada.
- Smoke tests com transação revertida: RPC nova idempotente, RPC antiga compatível, um snapshot e um avanço por ciclo. Zero tenants/OS de teste persistidos. Duas chamadas consumiram dois valores da sequência `work_orders_order_number_seq`, que não são revertidos; a sequência não foi reiniciada.
- Leitura RLS como usuário `navigation` do tenant de demonstração retornou zero OS e zero ativos de Saint-Gobain/Dedini.
- Teste de concorrência com duas transações confirmadas **não executado**; o proprietário não autorizou fixture persistente. Homologação funcional pela interface é o próximo passo.

Backup prévio: `C:\Users\caste\Documents\MARV-Backups\netsecbr-maintenance_2026-11-01_134108\netsecbr-maintenance-postgres.dump`, SHA-256 `CC662C7CB8E6BCED6F430F04187955066FA4679B194A6CEA5CF025B5452F3710`. É um dump lógico validado, sem restore de ensaio e sem bytes físicos do Storage.

Não houve deploy, merge, commit ou push nesta etapa de incorporação local.
