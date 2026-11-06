# PLANO DE MIGRAÇÃO MARV — LOTES (SOMENTE PLANEJAMENTO, SEM EXECUÇÃO)

Destino definitivo: `netsecbr-maintenance` (`zhsutxrvjocamdyyrquy`)
Origem: `projeto antigo desativado` (`PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR`)
Regra: preservar dados e funções existentes no principal; proibido DROP/TRUNCATE/RESET; não alterar configuração de produção; não desativar staging.

## 1. Status do backup físico

- Supabase CLI: disponível via `npx supabase` (v2.122.0).
- `pg_dump`/`psql`: **não disponíveis** no ambiente.
- Autenticação Supabase CLI: **ausente** (sem `~/.supabase/access-token` e sem `SUPABASE_ACCESS_TOKEN`).
- Senha do banco: não disponível (connection strings retornam `[YOUR-PASSWORD]`).
- **Impedimento:** não foi possível gerar nem testar dump PostgreSQL completo. O backup lógico (`backups/marv-consolidation-20261023T2236Z/`, 91 arquivos, manifest com SHA-256) permanece válido e verificado (FKs, contagens, integridade), mas não substitui dump físico.

## 2. O que precisa ser fornecido para concluir o backup físico

Escolha uma das opções:
- **Opção A (recomendada):** fornecer `SUPABASE_ACCESS_TOKEN` com escopo `database_write` (ou rodar `npx supabase login` interativamente), sem rotacionar senha.
- **Opção B:** fornecer a senha do banco de cada projeto (Dashboard → Settings → Database → Reset database password), usada apenas em memória e não persistida.
- **Opção C:** gerar os dumps manualmente no Supabase Dashboard (Database → Backups) e disponibilizar os arquivos `.sql` para validação/restauração em projeto temporário.

Comandos a executar após obter credenciais (sem expor segredos nos logs):
```powershell
npx supabase link --project-ref zhsutxrvjocamdyyrquy
npx supabase db dump --linked -f marv-zhsutxrvjocamdyyrquy-full.sql
npx supabase db dump --linked --data-only -f marv-zhsutxrvjocamdyyrquy-data.sql
# repetir para PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR
```
Teste de restauração: criar projeto temporário e executar `psql <temp-db-url> -f marv-<ref>-full.sql`, comparando contagens com `RELATORIO_CONSOLIDACAO_MARV.md`.

## 3. Mapeamento de IDs de usuários (staging → principal)

| E-mail staging | ID staging | Perfil | Novo ID principal (a gerar) | Ação |
|---|---|---|---|---|
| alberto.castelanno@nexxtdigital.cloud | 6b557ceb-9873-4da9-8a70-c37f02acd461 | netsecbr_admin | UUID novo | Criar + forçar redefinição de senha |
| matheus.serafim@saint-gobain.com | ab5af1a5-ea41-4ffd-b0b0-268f24016677 | tenant_user | UUID novo | Criar + redefinição |
| adm@saint-gobain.com | 6c554164-bd26-44d3-aea7-a8b427e10856 | tenant_user (administração) | UUID novo | Criar + redefinição |
| tecnico@saint-gobain.com | 6104a5d8-494b-47ca-8fa1-d97c0e140e45 | tenant_user (tecnico) | UUID novo | Criar + redefinição |
| castelanno@saint-gobain.com | b80082b5-6972-4036-8724-ba57613f2b94 | tenant_user | UUID novo | Criar + redefinição |

Manter tabela de controle `marv_user_id_map(staging_user_id, production_user_id, email, status)` para retomada segura.
## 4. Ordem corrigida dos lotes (idempotente)

1. **Lote 0 — Preparação e dependências**
   - Validar backups (lógico + físico quando disponível).
   - Criar tabela de controle de migração (`marv_migration_state`) e `marv_user_id_map`.
   - Congelar mapeamento de IDs e chaves naturais (unit code, asset code, request number, order number).
2. **Lote 1 — Criar usuários Auth e perfis**
   - Recriar 5 usuários Auth (seção 3).
   - Inserir `profiles` e `tenant_memberships` vinculados.
   - Inserir `membership_permissions` / `membership_unit_access` (idempotente por `user_id`+`permission`).
3. **Lote 2 — Saint-Gobain (registros operacionais)**
   - Tenant staging `beda618a-...` → inserir tenant Saint-Gobain no principal (se não existir).
   - Ordem: `tenants` → `units` → `cost_centers`/`asset_categories` → `assets` → `service_requests` → `work_orders` → `purchase_requests`/`items` → memberships.
   - Contagens esperadas: 1 unidade, 5 ativos, 24 solicitações, 10 OS, 2 requisições, 4 memberships.
4. **Lote 3 — Deduplicação Dedini**
   - Tenant staging `13187185-...` → principal `f965347b-...`.
   - Deduplicar por chave natural:
     - `units`: `code`
     - `assets`: `code`
     - `service_requests`: (`tenant`, `title`, `unit`)
     - `work_orders`: (`tenant`, `title`, `unit`)
     - `tenant_memberships`: (`tenant_id`, `user_id`)
   - Inserir apenas o que não existir (ex.: "testre"; demais já existem).
5. **Lote 4 — Históricos e auditoria**
   - `audit_logs`, `service_request_audit_log`, `work_order_audit_log`, `work_order_parts`, etc. (idempotente por `id` ou chave natural).
6. **Lote 5 — Testes funcionais e de isolamento**
   - Contagens por tabela.
   - RLS: Saint-Gobain não acessa Dedini e vice-versa.
   - Autenticação dos usuários recriados após redefinição de senha.
   - Verificar `work_order_costs` (produção-only) intacto.
   - Confirmar Edge Functions inalteradas (`swift-handler`, `verify_jwt`).
7. **Lote 6 — Configuração da aplicação (sem desativar staging)**
   - Garantir `Frontend/.env.local` apontando para `zhsutxrvjocamdyyrquy`.
   - `vite.config.ts` já bloqueia build se URL não corresponder ao modo.
   - Atualizar `backend/supabase/.temp/project-ref` quando usar CLI em produção.
   - Publicar Edge Functions com `--project-ref zhsutxrvjocamdyyrquy` (sem alterar `swift-handler`).

## 5. Estratégia de idempotência e retomada segura

- Usar `insert ... select ... where not exists (...)` ou `upsert` por chave natural/ID.
- Registrar progresso em `marv_migration_state(lote, etapa, status, executado_em, detalhes)`.
- Cada lote deve ser transacional quando possível; em caso de falha, retomar a partir da última etapa concluída.
- Nunca executar DROP/TRUNCATE/RESET.
- Preservar todos os dados e funções existentes no principal.
- Não alterar configuração de produção nem desativar staging.

## 6. Confirmação de prontidão

- Backup lógico: **pronto e verificado**.
- Backup físico: **pendente** (impedimento na seção 1; necessário para liberação final).
- Plano de migração: **pronto**, com ordem corrigida e idempotência definida.
- **Não executar migração de dados até a conclusão e validação do backup físico e autorização final explícita.**
