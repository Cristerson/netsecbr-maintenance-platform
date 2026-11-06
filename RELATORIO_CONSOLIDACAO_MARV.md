# RELATÓRIO DE CONSOLIDAÇÃO MARV — BACKUP E RESTAURAÇÃO

**Data do backup:** 2026-10-23 (UTC)
**Modo:** Somente leitura nos ambientes de origem; nenhum INSERT/UPDATE/DDL foi executado em produção.

## 1. Projetos envolvidos

| Ambiente | Projeto Supabase | Ref | Região |
|---|---|---|---|
| Origem (staging) | projeto antigo desativado | `PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR` | us-east-1 |
| Destino (produção) | netsecbr-maintenance | `zhsutxrvjocamdyyrquy` | us-east-2 |

## 2. Localização do backup

Diretório local (não commitado ao repositório, contém dados operacionais):

```
backups/marv-consolidation-20261023T2236Z/
├── manifest.json
├── production/
│   ├── public/*.json              (41 tabelas)
│   ├── auth_admin_users.json       (12 usuários)
│   ├── storage.json
│   └── edge_functions/*.ts        (3 funções com código disponível no repositório)
└── staging/
    ├── public/*.json              (40 tabelas; work_order_costs inexistente no staging)
    ├── auth_admin_users.json       (5 usuários)
    ├── storage.json
    └── edge_functions/            (metadados; código não exportado — ver limitações)
```

Total de arquivos gerados: **91** (incluindo `manifest.json`).

## 3. Mecanismos de backup disponíveis e utilizados

1. Exportação lógica via service role (Node + @supabase/supabase-js) para todas as tabelas do schema public (SELECT *).
2. Exportação de usuários Auth via auth.admin.listUsers() (metadados completos, exceto hash de senha — ver limitações).
3. Exportação de storage via listBuckets() + list() por bucket.
4. Código de Edge Functions copiado do repositório (backend/supabase/functions/*) e metadados via SUPABASE_LIST_FUNCTIONS.
5. Schema/DDL preservado nas 48 migrações versionadas em backend/supabase/migrations/.
6. Histórico de migrações consultado via SUPABASE_LIST_MIGRATION_HISTORY para ambos os projetos.

## 4. Verificação de integridade (contagens)

### 4.1 Produção (zhsutxrvjocamdyyrquy)

Principais tabelas com dados:

- asset_categories: 10
- asset_operational_readings: 2
- assets: 6
- audit_logs: 25
- cost_centers: 2
- entitlement_definitions: 5
- maintenance_plans: 4
- membership_permissions: 72
- permission_catalog: 11
- platform_access_roles: 5
- platform_security_settings: 1
- profiles: 12
- purchase_request_items: 3
- purchase_requests: 3
- service_request_audit_log: 11
- service_requests: 8
- subscription_plans: 3
- subscriptions: 3
- suppliers: 1
- support_tickets: 3
- tenant_branding: 1
- tenant_contacts: 1
- tenant_email_domains: 2
- tenant_memberships: 9
- tenants: 2
- units: 4
- work_order_audit_log: 13
- work_orders: 10
- work_order_costs: 0 (produção-only)

Demais tabelas públicas: 0 linhas. Usuários Auth: 12. Buckets Storage: 0 objetos.

### 4.2 Staging (PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR)

Principais tabelas com dados:

- asset_categories: 3
- asset_operational_readings: 17
- assets: 7
- audit_logs: 10
- cost_centers: 2
- entitlement_definitions: 5
- maintenance_plans: 7
- membership_permissions: 40
- permission_catalog: 11
- platform_access_roles: 1
- platform_security_settings: 1
- profiles: 5
- purchase_request_items: 3
- purchase_requests: 2
- service_request_audit_log: 35
- service_requests: 26
- subscription_plans: 3
- subscriptions: 3
- suppliers: 4
- tenant_contacts: 4
- tenant_email_domains: 6
- tenant_memberships: 5
- tenants: 4
- units: 2
- work_order_audit_log: 29
- work_orders: 12

Demais tabelas públicas: 0 linhas. work_order_costs não existe no staging. Usuários Auth: 5. Buckets Storage: 0 objetos.

### 4.3 Verificação de integridade

- Cada arquivo .json de tabela possui hash SHA-256 registrado em manifest.json.
- As contagens foram cruzadas com count(*) exato por tabela.
- Nenhum dado de senha, token ou chave privada foi incluído neste relatório ou no repositório.

## 5. Edge Functions (metadados)

### Produção
- create-tenant-user: verify_jwt=false, versão 13
- swift-handler: verify_jwt=true, versão 2
- manage-tenant-password: verify_jwt=false, versão 7
- manage-platform-users: verify_jwt=false, versão 3

Código disponível no backup para: create-tenant-user, manage-platform-users, manage-tenant-password.
swift-handler não pôde ser exportado via API (payload > limite).

### Staging
- create-tenant-user: verify_jwt=true, versão 3
## 6. Storage

Ambos os projetos reportam 0 buckets com objetos. Metadados de buckets salvos em storage.json (listas vazias).

## 7. Procedimento de restauração

### 7.1 Banco de dados (schema)
1. Aplicar as migrações em backend/supabase/migrations/ na ordem cronológica (48 arquivos).
2. Validar tabelas/views via SUPABASE_LIST_TABLES.

### 7.2 Dados públicos
1. Para cada tabela não vazia, executar INSERT com os JSONs em backups/.../public/<tabela>.json.
2. Respeitar ordem de dependência (tenants → units → profiles → tenant_memberships → service_requests/work_orders/assets/etc.).
3. Validar contagens com as tabelas da seção 4.

### 7.3 Auth
1. Recriar os 5 usuários staging-only em produção via auth.admin.createUser (ou importação de hash, se disponível).
2. Reconciliar Alberto Castelanno (staging) vs Cristerson (produção) manualmente (identidades distintas).
3. Restaurar raw_user_meta_data e raw_app_meta_data conforme auth_admin_users.json.

### 7.4 Edge Functions
1. Reimplantar via SUPABASE_DEPLOY_FUNCTION ou SUPABASE_UPDATE_A_FUNCTION usando os arquivos em edge_functions/.
2. Reconciliar verify_jwt do create-tenant-user (staging=true, produção=false) somente após análise de impacto.

### 7.5 Storage
1. Recriar buckets e reenviar objetos (atualmente nenhum objeto).

### 7.6 Verificação pós-restauração
- Contagens por tabela iguais às da seção 4.
- RLS: testar isolamento por tenant (Dedini vs Saint-Gobain).
- Demo Saint-Gobain: 24 service requests, 10 work orders, 5 assets acessíveis pelos 4 usuários.

## 8. Limitações e ações manuais necessárias

1. Backup físico (pg_dump / snapshot do projeto) não pôde ser gerado por esta ferramenta. Recomenda-se criar um backup físico via Supabase Dashboard → Database → Backups (ou via pg_dump com a senha do banco) para ambos os projetos, e confirmar restaurabilidade em um projeto temporário.
2. Hashes de senha do Auth não são expostos pela Admin API. O export SQL (auth.users) capturado durante a inventariação contém encrypted_password, mas não foi persistido em arquivo por limitação de acesso ao cache da ferramenta. Se necessário para migração de credenciais, executar manualmente:
   SELECT id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at FROM auth.users ORDER BY created_at;
   e armazenar o resultado em local seguro (não no repositório).
3. Tabelas de sistema do Auth (auth.identities, auth.refresh_tokens, auth.mfa_*) não foram exportadas em arquivo. Recomenda-se exportar via SQL se houver necessidade de migração de sessões/MFA.
4. Configurações de projeto (auth/postgres) foram consultadas, mas não persistidas em arquivo por volume; podem ser reobtidas via API.
5. swift-handler (produção) não pôde ser exportado por limite de payload da API. Recuperar via Supabase Dashboard ou reimplantar a partir do código-fonte se disponível.
6. work_order_costs é produção-only e foi preservado (0 linhas no momento do backup).
7. Staging não foi excluído nem desativado, conforme instrução.

## 9. Segurança

- Nenhuma senha, token, chave privada ou segredo foi incluído neste relatório ou no repositório.
- Os arquivos em backups/ contêm dados operacionais e devem permanecer fora do controle de versão.
- As chaves de service role utilizadas foram usadas apenas em memória e não foram persistidas.

## 10. Status final

- Backup lógico de dados públicos: concluído e verificado.
- Backup de Auth (metadados): concluído (hashes não persistidos — ver limitações).
- Backup de Storage: concluído (sem objetos).
- Backup de Edge Functions: parcial (swift-handler pendente).
- Schema/DDL: preservado nas migrações versionadas do repositório.
- Nenhuma gravação foi realizada em produção.

Aguardando autorização final do usuário para iniciar a consolidação em lotes.

## 11. Consolidação executada (2026-10-23)

### 11.1 Registros migrados por cliente

**Saint-Gobain (tenant `beda618a-e7f0-4481-9cc9-d5aacab673cf`)**
- tenants: 1
- units: 1
- cost_centers: 1
- asset_categories: 1
- assets: 5
- suppliers: 4
- service_requests: 24
- work_orders: 10
- maintenance_plans: 5
- purchase_requests: 2
- purchase_request_items: 3
- tenant_memberships: 4
- profiles: 4
- membership_permissions: 40
- service_request_audit_log: 31 (originais; +31 entradas geradas por trigger)
- work_order_audit_log: 27 (originais; +12 entradas geradas por trigger)
- audit_logs: 4

**Dedini (tenant produtivo `f965347b-b76d-4f19-8b09-44e683b76074`)**
- service_requests: 1 (registro novo `testre`)
- work_orders: 0 (duplicados preservados no principal)
- assets: 0 (duplicados preservados no principal)
- maintenance_plans: 0 (duplicados preservados no principal)
- purchase_requests: 0

### 11.2 Usuários criados e situação dos logins

Criados no projeto principal (Saint-Gobain):
- matheus.serafim@saint-gobain.com → `c49cc07e-d698-4b9e-ab28-6e6f3d43d350`
- adm@saint-gobain.com → `70d1bbe1-73bc-46ae-bce9-5d0dcf2896a3`
- tecnico@saint-gobain.com → `6d0db744-0dac-4135-8af8-ca900523b81b`
- castelanno@saint-gobain.com → `a8bcea27-576d-4c9c-bc5c-9184b064950e`

Situação: contas criadas com e-mail confirmado e senha temporária `MarvTemp2026!`. Perfis com `must_change_password = true`. Logins devem funcionar, mas a redefinição de senha é obrigatória no primeiro acesso.

Dedini: utilizados os usuários já existentes no principal (robinson.santiago@dedini.com.br, castelanno@dedini.com.br, manutencao@dedini.com.br, conrad@dedini.com.br). Nenhum usuário novo criado.

### 11.3 Testes aprovados e pendentes

Aprovados:
- Contagens de tabelas Saint-Gobain conferidas (assets 5, service_requests 24, work_orders 10, maintenance_plans 5, purchase_requests 2 + 3 itens, suppliers 4, memberships 4, permissions 40, profiles 4).
- Relacionamentos preservados (tenant → unit → cost_center → assets → service_requests/work_orders).
- Novo service request Dedini `testre` migrado e visível no tenant Dedini.
- Isolamento de tenant: dados Saint-Gobain vinculados exclusivamente ao tenant `beda618a-...`; dados Dedini preservados.

Pendentes:
- Testes negativos de RLS com sessões reais de usuários (não executados via aplicação).
- Teste manual de login e fluxo de redefinição de senha dos 4 usuários Saint-Gobain.
- Reconciliação dos duplicados Dedini (assets, service request "Avaliar tendência térmica...", work orders) — principal preservado.

### 11.4 Banco definitivo confirmado

Projeto principal `netsecbr-maintenance` (`zhsutxrvjocamdyyrquy`, us-east-2) é o banco definitivo. Dados consolidados (Saint-Gobain + Dedini) presentes.

### 11.5 Erros ou pendências que impeçam a utilização

Nenhum erro bloqueante. Observações:
- `order_number`/`request_number` de alguns registros Saint-Gobain foram regenerados pelo banco devido a constraint UNIQUE global (conflito com números já existentes no principal). IDs e demais dados preservados.
- Contagens de audit logs incluem entradas geradas por triggers durante a migração.
- Senhas temporárias dos usuários Saint-Gobain exigem redefinição antes do uso produtivo.
- Staging permanece ativo (não desativado nesta execução), conforme instrução.
