# Plano de Demonstração Saint-Gobain — Caieiras (Etapas 3, 4A, 4B, 5A e 5B)

> **Status:** Etapas 3, 4A e 4B **executadas e validadas** (08/10/2026, staging `PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR`).
> Etapa 5A (preventivas/checklists/histórico) **executada e validada** (08/10/2026) — ver **§11**.
> Etapa 5B (cenário operacional) **executada e validada** (09/10/2026) — ver **§12**.
>
> - **Parâmetros preenchidos (§8.1):** `p_cnpj = '61.064.838/0111-78'`; `p_cost_center_code = 'CC-MANUT-CAIEIRAS'`; `p_unit_code = 'CAIEIRAS-SP-01'`; `p_plan_name = 'Demonstração Saint-Gobain — sem cobrança'`; `p_plan_robot_limit = 25`; `p_trial_days = 90`.
> - **Execução:** `npx supabase db query --linked --project-ref PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR` (pipe stdin), dentro do bloco `do $$ ... end $$` que roda em **transação atômica única** — não há `commit`/`rollback` explícito; o bloco é uma transação. Se qualquer `raise exception` ocorrer, o rollback é automático. Nenhuma migration, deploy, acesso a `auth.users`, ativos, OS ou notificações foi criado.
> - **Validação pós-carga:** executa consultas de leitura para cada regra da Etapa 3 (§8.7). Resultado: `tenant`, `unit`, `cost_center`, `tenant_contact`, `plan`, `subscription`, e 3 domínios de e-mail do Saint-Gobain presentes; **zeradas** duplicidades nas chaves `tenant_id+code`, `tenant_id+domain`, `tenant_id+full_name` e `tenant_id+code` secundárias; **preservados** os 3 tenants de produtor (Dedini Matriz, Dedini s/a, TESTE CC-CLIENTE-02C).
> - **Pare aqui:** seguir para Etapa 4 exige autorização explícita do comando; sem ela, não criar `auth.users`, ativos, OS ou notificações.
>
> ### Situação atual (08/10/2026)
>
> - **Etapa 4A (usuários/permissões):** executada no staging. Três usuários criados via Command Center (`create-tenant-user`): `adm@saintgobain.com` (Administrador do cliente / `tenant_admin`), `matheus.serafim@saint-gobain.com` (`tenant_admin` — necessário para aprovar solicitações via `approve_service_request_and_create_work_order`, que exige `is_tenant_admin()`; não há papel "gestor" intermediário no modelo) e `tecnico@saintgobain.com` (Navegação / `navigation`, sem poderes administrativos). Domínio `saintbobain.com` removido do tenant; mantidos `saintgobain.com` e `saint-gobain.com`. Sem convites/notificações automáticas e sem alterar Dedini/outros tenants.
> - **Etapa 4B (ativos/robôs):** executada e validada no staging — ver **§10**. Categoria `ROBOT` (`is_robot = true`) semeada no tenant (não existia) e **5 robôs** KUKA/ABB vinculados à unidade `CAIEIRAS-SP-01` e ao centro de custo `CC-MANUT-CAIEIRAS`. Idempotência confirmada; Dedini e demais tenants intactos. Sem migration/deploy/commit.
> - **Etapa 5A (preventivas/checklists/histórico):** executada e validada no staging — ver **§11**. **5 planos** preventivos (um por robô, checklist técnico de 16 itens adaptado a KUKA/ABB no campo `notes`), **3 vencidos** e **2 futuros**, mais **15 leituras operacionais** de histórico fictício dos últimos 90 dias (todas marcadas `SIMULAÇÃO`). Sem OS, solicitações, migrations ou alteração na Dedini.
> - **Etapa 5B (cenário operacional):** ✅ **executada e validada** (09/10/2026) — ver **§12**. A auditoria inicial detectou **24 SR e 10 OS pré-existentes** (execução concorrente); a parada temporária foi submetida ao comando, que autorizou a **opção (b): completar o existente**. Resultado: distribuição **3 `completed` / 3 `in_progress` / 2 `open` / 2 `waiting_material`**, **2 requisições de compra** vinculadas às OS e **R$ 80.000 exatos** (28k realizado + 22k andamento + 12k planejado + 18k compras), sem dupla contagem; **7 SRs** elegíveis para aprovação ao vivo (Matheus). Idempotência, isolamento (Dedini intacta) e preservação da 5A confirmados por leituras. Nenhuma migration/deploy/commit; produção intocada.

---

## 1. Arquitetura encontrada

### 1.1 Visão geral

O MARV é uma aplicação SaaS multi-tenant sobre **Supabase** (PostgreSQL + Auth + Storage +
Edge Functions) com **frontend React/Vite/TypeScript**:

- **Frontend:** `Frontend/` (React + Vite + TypeScript + `@supabase/supabase-js`).
  Consultas sempre filtradas por `.eq('tenant_id', ...)`, mesmo com RLS ativa
  (regra documentada em `DOCUMENTACAO.md`).
- **Backend:** `backend/supabase/` — migrations SQL, Edge Functions e checklists de teste.
  Não existe API intermediária própria nesta fase; o frontend fala com a Data API do Supabase
  e com 3 Edge Functions (`create-tenant-user`, `manage-tenant-password`,
  `manage-platform-users`).
- **Banco:** PostgreSQL único, compartilhado entre todos os clientes (modelo de múltiplos
  tenants em uma única instância, decidido em `documentação/04-Arquitetura-da-Solucao.md`).

### 1.2 Tenants, unidades, usuários e permissões

Hierarquia de dados (conforme `documentação/05-Modelo-de-Dados.md`):

```text
Tenant → Unit → CostCenter → Area/ProductionLine → Asset → AssetComponent
Tenant → TenantMembership → Profile → Supabase Auth user
TenantMembership → MembershipPermission → PermissionCatalog
Tenant → TenantEmailDomain (domínios de e-mail autorizados)
Tenant → TenantBranding (identidade visual)
Tenant → SubscriptionPlan → Subscription → franquias/faturas
```

Camadas de identidade e acesso:

| Conceito | Tabela/objeto | Observação |
| --- | --- | --- |
| Conta autenticada | `auth.users` (Supabase Auth) | Criada apenas por Edge Function ou painel Supabase. |
| Perfil global | `profiles` | `platform_role`: `netsecbr_admin` / `netsecbr_support` / `tenant_user`; `must_change_password` bloqueia o uso até troca de senha. |
| Papel de plataforma | `platform_access_roles` | `owner` / `operator` (Command Center NETSECBR). |
| Vínculo ao cliente | `tenant_memberships` | Papéis: `tenant_admin` e `navigation`. |
| Permissões finas | `permission_catalog` + `membership_permissions` | Ex.: `purchase_requests.read/create/approve`. |
| Domínios autorizados | `tenant_email_domains` | Validação feita pela Edge Function antes de criar conta. |

Funções auxiliares de autorização (SECURITY DEFINER) em
`backend/supabase/migrations/20260801190000_create_rls_access_policies.sql`:

- `is_netsecbr_admin()` — administrador global.
- `is_tenant_member(tenant_id)` / `is_tenant_admin(tenant_id)` — vínculo ativo no tenant.
- `tenant_allows_operation(tenant_id)` — tenant em `active` ou `grace_period`
  (estados `payment_only` e `suspended` bloqueiam operação).

### 1.3 Isolamento entre tenants (estrutura atual)

Três barreiras, todas presentes:

1. **RLS (PostgreSQL):** policies por tabela no padrão
   `is_netsecbr_admin() or (is_tenant_member(tenant_id) and tenant_allows_operation(tenant_id))`
   para leitura operacional; escrita restrita a `tenant_admin`/global.
2. **Triggers de escopo (gatilhos):** validam consistência cruzada antes de gravar.
   Ex.: `validate_work_order_scope`, `validate_service_request_scope`,
   `validate_maintenance_plan_scope` recusam qualquer linha cujo tenant/unidade/centro de
   custo/ativo não pertençam ao mesmo cliente.
3. **Filtro explícito no frontend:** toda consulta usa `.eq('tenant_id', tenantId)`.

Referência de validação: `backend/supabase/tests/rls-isolation-checklist.md`
e `backend/supabase/tests/work-orders-checklist.md`.

### 1.4 Relação entre os módulos operacionais

```text
Asset (ativo)
  ├── ServiceRequest  (solicitação: open → triaged → converted_to_wo | cancelled)
  │        └── converted_to_work_order_id → WorkOrder
  ├── WorkOrder       (OS: open → in_progress → waiting_material → completed | cancelled)
  │        └── PurchaseRequest → PurchaseRequestItem  (sempre vinculado a uma OS)
  ├── MaintenancePlan → WorkOrder (preventiva; geração manual/RPC, plano não executa sozinho)
  ├── AssetOperationalReadings (leituras operacionais manuais)
  └── AssetDowntime / Attachment / AuditLog
```

Migrações de referência:

| Módulo | Migration |
| --- | --- |
| Ativos e robôs | `20260801193000_create_assets_and_robots.sql` |
| Ordens de serviço | `20260801210000_create_work_orders.sql` |
| Solicitações | `20260902000000_create_service_requests.sql` |
| Requisições de compra | `20260902100000_create_purchase_requests.sql` |
| Planos preventivos | `20260921100000_create_maintenance_plans.sql` + `20260921102000_create_preventive_work_order_rpc.sql` |
| Leituras operacionais | `20260927210957_add_asset_operational_readings.sql` |

Frontend correspondente (`Frontend/src/`): `asset-admin.tsx`, `service-request-admin.tsx`,
`work-order-admin.tsx`, `preventive-plan-admin.tsx`, `purchase-request-admin.tsx`,
`organization-admin.tsx` (unidades/centros de custo), `user-admin.tsx`, `branding-admin.tsx`.

### 1.5 Ambientes configurados e como são selecionados

Dois ambientes Supabase distintos, selecionados pelo **modo do Vite**:

| Ambiente | Modo | Projeto Supabase (ref) | Saída do build |
| --- | --- | --- | --- |
| Homologação/staging | `staging` (padrão de `dev` e `build`) | `PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR` | `Frontend/dist/staging` |
| Produção | `production` (sempre explícito) | `zhsutxrvjocamdyyrquy` | `Frontend/dist/production` → `marv.zip` |

- `Frontend/vite.config.ts` **bloqueia o build** se `VITE_SUPABASE_URL` não corresponder ao
  modo, ou se a chave publishable estiver ausente.
- Arquivos de ambiente: `Frontend/.env.staging` (homologação) e `Frontend/.env.local`
  (produção, não versionado). Documentação: `Frontend/ENVIRONMENTS.md`.
- Edge Functions devem ser publicadas com `--project-ref` explícito (nunca pelo projeto
  linkado). Migrations: primeiro em homologação; `supabase db push` **não** deve ser usado
  enquanto o histórico remoto não for saneado
  (ver `backend/supabase/tests/preventive-plans-execution-evidence.md`).
- O CLI está linkado ao projeto de staging (`backend/supabase/.temp/linked-project.json`
  → `projeto antigo desativado`).

**Relevante para a demo:** a demo Dedini e a nova demo devem existir no ambiente em que a
apresentação será feita (recomendado: **staging/homologação**). Criar dados em produção
está fora do escopo autorizado.

## 2. Referência técnica da demo Dedini

### 2.1 Como a demo foi criada e populada

Tudo está versionado em `backend/supabase/bootstrap/` (modelos SQL idempotentes, executados
via SQL Editor ou CLI administrativo — **não** são migrations):

| Arquivo | Função |
| --- | --- |
| `promote-netsecbr-admin.sql.template` | Promove um usuário Auth a `netsecbr_admin`. |
| `create-demo-tenant.sql.template` | Cria tenant genérico + centro de custo + unidade + membership `tenant_admin`. |
| `create-demo-plan-and-subscription.sql.template` | Cria plano/contrato de demonstração sem cobrança. |
| **`create-dedini-demo.sql.template`** | **Carga demonstrativa completa da Dedini (referência).** |

O script `create-dedini-demo.sql.template` é o modelo a seguir. Ele é **idempotente**
(todos os `insert` têm `where not exists` ou `on conflict ... do nothing`), **não cria
usuário em `auth.users`** e **não contém senha**. Passos executados, em ordem:

1. Localiza o `actor_id` = Proprietário ativo da plataforma (`profiles.platform_role =
   'netsecbr_admin'` + `platform_access_roles.role = 'owner'`) para auditar a carga.
   Falha com exceção se não existir.
2. Localiza/cria o tenant por **CNPJ** (`document_number = '50.109.271/0001-58'`).
3. Cria `tenant_contacts` (contato principal) e `tenant_email_domains` (`dedini.com.br`).
4. Cria `subscription_plans` ("Demonstração Dedini — sem cobrança": 10 robôs, valor zero,
   50 MB) e `subscriptions` com status `trial` (30 dias) se não houver contrato vigente.
5. Cria `cost_centers` (`CC-ENG-4.0`) e `units` (`PIR-MATRIZ-01`, Piracicaba/SP).
6. Cria `asset_categories` (`HYDRAULIC_PRESS`, `WELDING_ROBOT`).
7. Cria 2 `assets` (`PRN-MTRZ-1500T`, `RB-MTRZ-WELD-02`).
8. Cria `asset_operational_readings` (2 leituras manuais: crítica e normal).
9. Cria 2 `work_orders` (uma `in_progress`, uma `completed`).
10. Cria 2 `maintenance_plans` (mensal e trimestral).
11. Cria 1 `service_request` (status `triaged`).
12. Grava `audit_logs` com ação `dedini_demo_seeded` (guarda de idempotência adicional).
13. Encerra com uma `SELECT` somente leitura de conferência (tenant, contato, contrato,
    contagens de ativos/OS/planos/leituras).

O **usuário demo** é criado separadamente, pela Edge Function `create-tenant-user`
(preserva Auth e auditoria), conforme o cabeçalho do próprio script.



### 2.2 Usuários de demonstração sem e-mails automáticos

Mecanismo verificado no código:

- `backend/supabase/functions/create-tenant-user/index.ts` cria a conta com
  `auth.admin.createUser({ ..., email_confirm: true, ... })` — **confirmação automática de
  e-mail**, portanto **sem envio do e-mail de confirmação/convite**.
- A função também exige que o domínio do e-mail esteja em `tenant_email_domains`
  (erro: `O domínio @... não está autorizado`), grava `profiles.must_change_password = true`
  e cria o `tenant_memberships`; em falha, faz rollback removendo o usuário criado.
- `backend/supabase/functions/manage-platform-users/index.ts` usa o mesmo padrão
  (`email_confirm: true`) para a equipe da plataforma.
- **Atenção:** `manage-tenant-password` (redefinição administrativa) dispara o e-mail de
  **recuperação de senha** do Supabase Auth. Para a demo, definir a senha já no cadastro
  (`create-tenant-user` recebe `password`) e evitar a ação de redefinição.

Conclusão: **cadastrar usuários demo pela Edge Function `create-tenant-user` (ou pela UI do
Command Center, que a invoca) não dispara e-mails**; usar a ação de redefinição de senha
sim.

---

## 3. Componentes reutilizáveis

| Componente | Onde está | Reutilização para Saint-Gobain |
| --- | --- | --- |
| Script de carga idempotente de tenant | `backend/supabase/bootstrap/create-dedini-demo.sql.template` | Clonar como base (ver §5). |
| Criação de tenant via UI/RPC | RPC `create_command_center_tenant` (`20260927160508` + correção `20260927175650`), chamada por `Frontend/src/use-command-center-data.ts` | Cria cliente + contato principal + domínios + auditoria em uma transação, sem tocar em Auth. |
| Plano/contrato demo sem cobrança | `create-demo-plan-and-subscription.sql.template` | Novo nome de plano específico (único por `name`). |
| Provisionamento de usuário | Edge Function `create-tenant-user` + UI `command-center-tenant-user-provisioning.tsx` (gera senha temporária) | Sem e-mails; exige domínio autorizado. |
| Branding por tenant | `tenant_branding` + bucket `tenant-branding` + `branding-admin.tsx` | Logo/cores Saint-Gobain (opcional). |
| Módulos operacionais prontos | ativos, solicitações, OS, preventivas, compras | Nenhum código novo necessário. |
| Checklists de validação | `backend/supabase/tests/rls-isolation-checklist.md`, `work-orders-checklist.md` | Executar após o seed para provar isolamento. |

---


## 4. Dependências e riscos

### 4.1 Dependências

1. **Proprietário ativo da plataforma** (`owner` + `netsecbr_admin`) — sem ele o script
   Dedini falha por design ao buscar o `actor_id` de auditoria.
2. **Migrations aplicadas** no ambiente alvo, em especial
   `20260927210957_add_asset_operational_readings.sql` (dependência declarada do script
   Dedini) e as de Command Center/tenant contacts.
3. **Edge Function `create-tenant-user` publicada** no projeto alvo com `--project-ref`
   explícito e `ALLOWED_ORIGINS` adequado.
4. **CNPJ Saint-Gobain Caieiras válido** — a RPC `create_command_center_tenant` valida os
   dígitos verificadores quando o campo é informado (CNPJ também pode ficar vazio, conforme
   a própria função).
5. **Domínio de e-mail Saint-Gobain** cadastrado em `tenant_email_domains` antes de
   qualquer cadastro de usuário.
6. **Ambiente correto escolhido** (staging vs produção) — o build do frontend é travado
   por modo.

### 4.2 Riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Alterações locais não commitadas (`Frontend/package.json`, `Frontend/vite.config.ts` modificados; vários arquivos não rastreados) | Podem ser sobrescritas por checkout/commit inadvertido | Não usar `git checkout`/`reset`; preservar alterações; commit somente com autorização. |
| Criar dados em **produção** por engano | Viola restrição explícita | Trabalhar somente no projeto de staging; conferir `VITE_SUPABASE_URL` e modo antes de qualquer execução. |
| Colisão de CNPJ/plano/domínio | Seed parcial ou rejeitado | Script idempotente com chaves próprias; validar com as SELECTs de conferência. |
| Contrato único por tenant (`uq_subscriptions_one_current_contract_per_tenant`) | Erro ao criar segunda assinatura vigente | Só inserir assinatura se não existir `draft`/`trial`/`active`. |
| Tenant demo sem `tenant_email_domains` | Impossível criar usuários pelo fluxo padrão | Criar o domínio junto com o tenant (a RPC aceita `extra_domains`). |
| Fallback do `auth-gate` para administrador global sem membership (`limit(1)` ordenado por `created_at`) | Admin NETSECBR sem vínculo sempre cai no **primeiro** tenant criado (Dedini) | Vincular o usuário demo Saint-Gobain como `tenant_admin` do novo tenant. |
| E-mails automáticos indesejados | Experiência da demo comprometida | Usar `create-tenant-user` (auto-confirm) e evitar `manage-tenant-password`. |
| Alterar dados da Dedini | Viola requisito de preservação | Novo tenant com chaves próprias; nenhum `update`/`delete` em linhas da Dedini; conferência final por `tenant_id`. |
| `supabase db push` | Pode aplicar migrations não rastreadas/indesejadas | Não usar `db push`; o plano não prevê migration nova. |
| Trial com expiração de 30 dias (padrão do script Dedini) | Demo pode "vencer" antes da apresentação | Definir `trial_ends_at`/`contract_end_date` adequados no seed Saint-Gobain. |

---

## 5. Plano recomendado para criação do novo tenant

Sequência proposta para a **Etapa 2+** (execução somente após autorização explícita):

### Fase A — Preparação (sem efeitos colaterais)

1. Confirmar com o responsável: **ambiente alvo** (recomendado: staging), **CNPJ**,
   **razão social/nome fantasia**, **domínio de e-mail** e **contato principal**.
2. Conferir, com SELECTs somente leitura, que o projeto alvo tem as migrations necessárias
   aplicadas e que a Dedini continua com os dados esperados (baseline de preservação).

### Fase B — Cadastro estrutural do tenant

3. Criar o cliente pelo **Command Center** (RPC `create_command_center_tenant`) com:
   razão social, nome fantasia, CNPJ, status `active` e `extra_domains` = domínio
   Saint-Gobain. Alternativa: SQL direto, se a UI não for usável no ambiente.
4. Criar **centro de custo** e **unidade Caieiras/SP** (padrão do
   `create-demo-tenant.sql.template`: códigos próprios, ex. `CC-CAIEIRAS-01` e
   `CAIEIRAS-01`).

### Fase C — Contrato de demonstração

5. Criar plano "Demonstração Saint-Gobain — sem cobrança" e assinatura `trial`
   (mesma lógica do script Dedini; nome único, `robot_limit` e armazenamento definidos,
   vigência adequada à data da apresentação).

### Fase D — Carga demonstrativa (clonar o script Dedini)

6. Criar `backend/supabase/bootstrap/create-saint-gobain-demo.sql.template`
   a partir do script Dedini, mantendo:
   - idempotência (`where not exists` / `on conflict do nothing`);
   - lookup do tenant **por CNPJ novo** (nunca reutilizar o ID da Dedini);
   - auditoria com `action = 'saint_gobain_demo_seeded'` (evita colisão de guarda);
   - nenhuma escrita em linhas de outros tenants.
7. Conteúdo sugerido (a validar na Etapa 2): ativos típicos de operação em Caieiras
   (ex.: linha de produção, esteira/conveyor, robô de paletização), 1–2 leituras
   operacionais, 2 OS (uma em andamento, uma concluída), 2 planos preventivos e
   1 solicitação em triagem.

### Fase E — Usuários demo (sem e-mails)

8. Criar usuários pela Edge Function `create-tenant-user` (ou pela UI do Command Center),
   com senha temporária definida no cadastro e domínio já autorizado.
   **Não** usar `manage-tenant-password` durante a demo.
9. Vincular pelo menos um `tenant_admin` ao novo tenant.

### Fase F — Validação

10. Conferência final com SELECTs por `tenant_id` do Saint-Gobain + revalidação de que a
    Dedini permaneceu intacta (contagens e registros originais).
11. Executar `backend/supabase/tests/rls-isolation-checklist.md` com um usuário de cada
    tenant.
12. Checklist de conteúdo da demo: fluxo Solicitação → OS → Preventiva → Compra.

---

## 6. Arquivos que precisarão ser modificados

Na **Etapa 1** (esta): apenas `documentação/DEMO_SAINT_GOBAIN_PLANO.md` (criado).

Na **Etapa 2+** (previsto, mediante autorização):

| Arquivo | Tipo | Motivo |
| --- | --- | --- |
| `backend/supabase/bootstrap/create-saint-gobain-demo.sql.template` | **Criado na Etapa 2** | Carga idempotente do novo tenant (clonada da Dedini), ainda não executada. |
| `CHANGELOG.md` | Edição (pendente) | Registrar a nova carga demonstrativa (regra do projeto); previsto após execução/aprovação. |
| `documentação/DEMO_SAINT_GOBAIN_PLANO.md` | Edição | Atualizado com o progresso das Etapas 1 e 2 (seção 8). |
| *(opcional)* `backend/supabase/tests/rls-isolation-checklist.md` | Edição (pendente) | Acrescentar o par Dedini × Saint-Gobain nos casos de verificação. |


**Arquivos que NÃO devem ser alterados neste fluxo:**

- Migrations existentes (nenhuma migration nova é necessária).
- `Frontend/vite.config.ts` e `Frontend/package.json` (contêm alterações locais pendentes —
  preservar).
- Scripts da demo Dedini (preservar integralmente como referência).
- Arquivos de ambiente (`.env*`) — sem credenciais no repositório nem neste relatório.

---

## 7. Checklist resumido das 7 tarefas da Etapa 1

1. **Arquitetura de tenants/unidades/usuários/permissões:** seções 1.1–1.2. ✔
2. **Como a demo Dedini foi criada:** `backend/supabase/bootstrap/create-dedini-demo.sql.template`
   + Edge Function `create-tenant-user` — seção 2. ✔
3. **Tabelas, serviços, APIs e scripts:** seções 1.3–1.4 e 2.1. ✔
4. **Ambientes e seleção:** seção 1.5 (`staging` é padrão, `production` é explícito,
   travas do Vite). ✔
5. **Usuários demo sem e-mails:** seção 2.2 (`email_confirm: true`; evitar redefinição de
   senha). ✔
6. **Relação entre módulos:** seção 1.4. ✔
7. **Isolamento entre tenants:** seção 1.3 (RLS + triggers + filtro no frontend). ✔


---

## 8. Progresso — Etapa 3/6 (bootstrap executado e validado)

**Status:** template revisado na **Etapa 2B** e **executado na Etapa 3**
(08/10/2026, staging `PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR`). Nenhuma migration, deploy, commit ou push;

### 8.1 Parâmetros de carga (verificados 08/10/2026)

| Variável | Valor | Fonte |
| --- | --- | --- |
| `p_legal_name` | `'Saint-Gobain do Brasil Produtos Industriais e para Construção Ltda.'` | Etapa 3 |
| `p_cnpj` | `'61.064.838/0111-78'` | Etapa 3 (validado contra `tenants.document_number`) |
| `p_contact_name` | `'Matheus Serafim'` | Etapa 3 |
| `p_contact_email` | `'matheus.serafim@saint-gobain.com'` | Etapa 3 |
| `p_contact_phone` | `'(11) 0000-0000'` | Demonstrativo |
| `p_cost_center_code` | `'CC-MANUT-CAIEIRAS'` | Etapa 3 |
| `p_cost_center_name` | `'Manutenção Industrial — Caieiras'` | Etapa 3 |
| `p_unit_code` | `'CAIEIRAS-SP-01'` | Etapa 3 |
| `p_unit_name` | `'Saint-Gobain — Caieiras'` | Etapa 3 |
| `p_plan_name` | `'Demonstração Saint-Gobain — sem cobrança'` | Etapa 3 (valor executado; `plan_name_snapshot` confirma) |
| `p_plan_robot_limit` | `25` | Etapa 3 |
| `p_trial_days` | `90` | Etapa 3 |

### 8.2 Identidade e execução

- **Identificador estável:** UUID fixo `beda618a-e7f0-4481-9cc9-d5aacab673cf` (PK de `tenants`). Recriação do zero exige remoção da linha ou mudança do UUID antes de reexecutar.
- **Valor de `p_cnpj`:** o CNPJ `61.064.838/0111-78` foi informado na Etapa 3 e gravado em `tenants.document_number`. Como esse campo é `unique` mas **nullable**, a reexecução não depende de `trade_name`; a chave de reexecução é o UUID fixo.
- **Execução:** bloco `do $$ ... end $$`, via CLI de admin do **staging** (`npx supabase db query --linked --project-ref PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR`), em **transação atômica** (bloco PL/pgSQL único). Não há migration, `db push`, deploy, `auth.users`, ativos, OS ou notificações.
- **Canal usado:** pipe de stdin (`Get-Content template | npx --yes supabase db query --linked ...`) — o CLI rejeita `--file` e `--db-url` com `08P01 invalid message format` e apenas esse formato retorna tabelas legíveis. Qualquer operação futura deve usar o canal do pipe ou um cliente PostgreSQL real.

> **Fixo técnico 08P01:** o CLI `supabase` lança `08P01 invalid message format` quando o SQL é lido de `--file` ou quando o endpoint gerencia o body como mensagem binária. O canal estável é **pipe de stdin** (`Get-Content arquivo | npx --yes supabase db query --linked ...`), que retorna tabelas `psql`-style. Qualquer operação futura deve usar esse formato ou um cliente PostgreSQL real.


### 8.3 Garantias de idempotência

1. Lookup do tenant pelo **UUID fixo** antes de inserir; reexecução reutiliza o mesmo registro.
2. Verificação de conflito **antes** de qualquer operação: UUID já ocupado por outro tenant,
   CNPJ duplicado ou mais de um homônimo → `raise exception` e aborte sem alterações.
3. Todos os inserts secundários com `on conflict ... do nothing` ou `where not exists`.
4. Contrato vigente protegido pelo índice único parcial
   `uq_subscriptions_one_current_contract_per_tenant` + guarda explícita.
5. Auditoria com `action` única por tenant.
6. Reexecução com `p_cnpj` preenchido não duplica: o `update` só ocorre quando
   `document_number is null` e apenas no tenant localizado.

### 8.4 Garantias de isolamento

- Todos os `INSERT` referenciam exclusivamente `sg_tenant_id`, resolvido pelo UUID fixo do
  Saint-Gobain (com salvaguardas de conflito) — nunca reutiliza o ID da Dedini.
- Nenhum `UPDATE`/`DELETE` atinge outros tenants; o único `update` é condicional ao próprio
  tenant Saint-Gobain e ao próprio campo `document_number`.
- Domínios autorizados: unicidade `unique (tenant_id, domain)` e a Edge Function
  `create-tenant-user` filtra sempre `.eq('tenant_id', tenantId)` — **nenhuma permissão de
  outro cliente é alterada**; não existe unicidade global de domínio.
- `SELECT`s de conferência filtram por `trade_name = 'Saint-Gobain'` e listam tenants em
  ordem de criação apenas como verificação de preservação da Dedini.
- A carga roda como papel administrador (SQL Editor), mas não depende de quebrar RLS:
  não há escrita fora do tenant alvo.

### 8.5 Validação executada

- Bloco `do $$ ... end; $$` balanceado (1/1); parênteses balanceados (90/90).
- **Sem ambiguidade PL/pgSQL:** todos os parâmetros usam prefixo `p_` e as referências a
  colunas em consultas qualificam a tabela (`tenant_row.trade_name`, `plan_row.name`,
  `cc_row.code`, `unit_row.code`) — evita o problema da migration
  `20260927175650_fix_create_command_center_tenant_ambiguity.sql`.
- Constraints conferidas contra as migrations: `tenants.document_number` (unique, nullable),
  `tenants.id` (PK — UUID fixo explícito no insert), `cost_centers (tenant_id, code)`,
  `units (tenant_id, code)`, `tenant_contacts` índice único de contato primário ativo,
  `tenant_email_domains (tenant_id, domain)` com `check (domain = lower(domain))`
  (domínios já inseridos em minúsculas), `subscription_plans.name` unique,
  `subscriptions` checks (`contract_end > start`, `billing_start >= start`) — atendidos
  (início = `current_date`, fim +12 meses) e `check (robot_limit >= 0)` — 25 atende.
- Todos os `on conflict` usam alvos de conflito que existem de fato (constraints/índices).


### 8.6 Incompatibilidades com a arquitetura existente

**Nenhuma incompatibilidade bloqueante.** Ressalvas documentadas (sem alteração nesta etapa):

1. **CNPJ nullable:** a RPC `create_command_center_tenant` aceita CNPJ vazio, então a
   ausência de CNPJ não quebra a arquitetura; mas o Command Center exibirá o cliente sem
   documento e o `auth-gate` não usa CNPJ — impacto zero funcional.
2. **Fallback de tenant inalterado:** administrador global sem `tenant_memberships` continua
   caindo no primeiro tenant por `created_at` (Dedini). Risco documentado na Etapa 1 —
   resolver criando vínculo `tenant_admin` no Saint-Gobain na Etapa de usuários
   (fora do escopo desta etapa, que proíbe alterar autenticação/fallback).
3. **`tenant_branding` não populado:** a UI de branding não exige registro (usa padrão
   NETSECBR quando ausente) — opcional em etapa futura.
4. **Carga por SQL Editor vs RPC do Command Center:** a RPC criaria tenant+contato+domínios
   com auditoria automática, mas exige sessão `netsecbr_admin` autenticada; o script
   bootstrap mantém o padrão da Dedini (SQL direto idempotente) — escolha deliberada para
   manter simetria com a referência.
5. **Inserção com `id` explícito:** o insert do tenant fornece o PK (`demo_tenant_id`);
   permitido pela tabela (`default gen_random_uuid()` é apenas default) e necessário para o
   identificador estável — **não requer migration**.

### 8.7 Próxima etapa (Etapa 4, aguardando autorização)

Etapa 3 executada no staging `PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR` com os
parâmetros do §8.1 (confirmados), e validada com os `SELECT`s de conferência do próprio script +
`rls-isolation-checklist.md`.

---

## 9. Ajustes da Etapa 2B (revisão pré-execução)

### 9.1 Identificação do tenant e da unidade (ajuste 1)

- Tenant: `trade_name = 'Saint-Gobain'` (antes `Saint-Gobain — Caieiras`).
- Unidade: nome `Saint-Gobain — Caieiras`, **código preservado** `CAIEIRAS-SP-01`.
- SELECT de conferência final agora filtra `trade_name = 'Saint-Gobain'`.

### 9.2 Identificador estável e verificação de conflito (ajuste 2)

O CNPJ continua nulo e `trade_name` **não** é único no schema — depender só dele para
reexecução seria inseguro. Solução adotada **sem migration**:

- **UUID fixo** `demo_tenant_id = beda618a-e7f0-4481-9cc9-d5aacab673cf` como identificador
  demonstrativo estável (`tenants.id` é PK e aceita valor explícito).
- **Verificação de conflito antes de qualquer operação:**
  1. UUID já existe → confere se o `trade_name` é `Saint-Gobain`; se divergir, **aborta**;
  2. UUID livre + CNPJ informado → conta duplicatas (> 1 → aborta);
  3. UUID livre + homônimos de `trade_name` (> 1 → aborta);
  4. Só insere se nenhuma candidatura existir.
- Em caso de ambiguidade: `raise exception ... Abortando sem alterações` — nunca atualiza
  registros de forma ambígua. **Nenhuma incompatibilidade: não exige migration.**

### 9.3 Limite de ativos: 10 → 25 (ajuste 3)

Verificado no backend: `robot_limit` **não é imposto** por trigger nem por Edge Function na
criação de ativos — nenhuma função de bloqueio existe nas migrations (a única validação é
`>= 0` na RPC de plano). Ele alimenta apenas:

- relatório de consumo (`20260926212730` — conta ativos com categoria `is_robot = true`);
- exibição "ROBÔS LICENCIADOS" em `finance-admin.tsx`.

Conclusão: é **capacidade declarativa/relatória**, não bloqueio. Plano atualizado para
**`robot_limit = 25`** (robôs, compressores, HVAC etc.), sem efeito colateral — ativos não
robotizados nem sequer contam nesse indicador.

### 9.4 Trial de 90 dias × regra global (ajuste 4)

Confirmado **sem alterar regra global**:

- Acesso é regido por `tenant_allows_operation` → `tenants.status in ('active','grace_period')`;
  o tenant é criado `active`, então 90 dias de trial não mudam nada na porta de entrada.
- Não existe job/cron de expiração automática de `trial_ends_at` no projeto (busca concluída);
  a expiração é operação manual do Command Center.
- `trial_ends_at` (+90 dias) está **dentro da vigência** de 12 meses, atendendo à regra da RPC
  `create_command_center_subscription` (exigiria isso se a criação fosse pela RPC).
- Nenhuma tabela, constraint ou função global foi tocada.

### 9.5 Domínios autorizados × outros tenants (ajuste 5)

Confirmado: os 3 domínios são gravados **apenas** com o `tenant_id` do Saint-Gobain.

- Unicidade é `unique (tenant_id, domain)` — não há unicidade global de domínio.
- `create-tenant-user` consulta `.eq('tenant_id', tenantId)` + `.eq('domain', ...)` — só o
  próprio tenant é afetado.
- RLS de `tenant_email_domains` é restrita a `netsecbr_admin` (escrita) — a carga grava via
  SQL administrativo, sem alterar policies.
- **Nenhuma permissão de outro cliente é alterada.**

### 9.6 Revisão de constraints, relacionamentos e idempotência (ajuste 6)

Reconferido sem executar nada:

| Item | Situação |
| --- | --- |
| `tenants.id` PK com UUID explícito | ✔ permitido (default é apenas default) |
| `tenants.document_number` unique nullable | ✔ `null` não colide |
| `cost_centers`/`units` `unique (tenant_id, code)` | ✔ `on conflict` corresponde |
| `tenant_contacts` índice único parcial (primário ativo) | ✔ guardado por `where not exists` |
| `tenant_email_domains (tenant_id, domain)` + `check lower` | ✔ domínios em minúsculas |
| `subscription_plans.name` unique | ✔ `on conflict (name)` |
| `subscriptions` índice único parcial de vigente + checks de data | ✔ 1 contrato, datas coerentes |
| `subscriptions.robot_limit_snapshot >= 0` | ✔ (25) |
| Relação unidade→centro de custo (mesmo tenant) | ✔ `cost_center_id` resolvido antes do insert da unidade |
| Ambiguidade PL/pgSQL (variável × coluna) | ✔ prefixo `p_` + aliases `tenant_row/plan_row/cc_row/unit_row` |
| Idempotência completa (2ª execução) | ✔ lookup UUID + guards + auditoria única |
| Digitações introduzidas na revisão | ✔ corrigida ("CNPPJ" → "CNPJ") |

---

## 10. Progresso — Etapa 4B (cadastro dos 5 robôs)

**Status:** executada e validada em **08/10/2026** no staging `PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR`
(project-ref confirmado via `linked-project.json`). Sem migration, deploy, commit ou push.
Nenhuma alteração em usuários, autenticação, permissões, Dedini ou outros tenants; nenhuma
preventiva, solicitação ou OS criada.

### 10.1 IDs confirmados no tenant Saint-Gobain (antes de escrever)

| Recurso | ID | Código |
| --- | --- | --- |
| Tenant | `beda618a-e7f0-4481-9cc9-d5aacab673cf` | Saint-Gobain |
| Unidade | `0c9df045-660d-4e2d-b38e-fa0ae3e1cace` | `CAIEIRAS-SP-01` |
| Centro de custo | `88336893-3468-4311-a3e7-79de25e0a3f7` | `CC-MANUT-CAIEIRAS` |

O trigger `validate_asset_scope` exige que `unit_id`, `cost_center_id` e `category_id` sejam do
**mesmo tenant**, e que `cost_center_id` iguale o da unidade — condição verificada antes do insert.

### 10.2 Decisão de projeto — categoria de robótica semeada

O tenant Saint-Gobain **não possuía nenhuma `asset_category`** (contagem = 0) e a única categoria
`is_robot = true` do banco (`WELDING_ROBOT`) pertence a **outro tenant** (`13187185-…`), não
sendo reutilizável. Como `assets.category_id` é **NOT NULL** e restrito ao tenant, foi semeada uma
categoria `ROBOT` / "Robô Industrial" (`is_robot = true`) — nomenclatura alinhada ao checklist
oficial `assets-license-checklist.md`. É carga de dado de configuração (equivalente ao seed de
unidade/CC/plano da Etapa 3), **não** é migration nem nova funcionalidade.

### 10.3 Robôs cadastrados (idempotentes por `tenant_id + code`)

| Código | Nome | Fabricante | Modelo | Controlador | Criticidade |
| --- | --- | --- | --- | --- | --- |
| `RB-PRENSA-16` | Robô KUKA KR210 R2700 Extra — Prensa 16 | KUKA | KR210 R2700 Extra | KRC4 | high |
| `RB-PRENSA-21` | Robô KUKA KR210 R2700 — Prensa 21 | KUKA | KR210 R2700 | KRC4 | high |
| `RB-CEL-04-ACAB` | Robô KUKA KR20 R1810 — Célula 4 Acabamento | KUKA | KR20 R1810 | KRC4 | medium |
| `RB-PRENSA-22-STW` | Robô ABB IRB 4600 — Prensa 22 STW | ABB | IRB 4600 | IRC5 Single | high |
| `RB-PRENSA-22-STL` | Robô ABB IRB 1200-7 — Prensa 22 STL | ABB | IRB 1200-7 | IRC5 Single | medium |

- **`serial_number` = NULL** em todos (não inventar números de série reais).
- **Controlador registrado em `notes`**: o modelo `assets` atual **não possui campo de
  controlador** (consta apenas no roadmap). Nenhuma migration foi criada para adicioná-lo.
- **Criticidade e `installed_at`:** valores demonstrativos, sinalizados em `notes` como fictícios.
- Todos com `status = 'active'`, `category = ROBOT`, `is_robot = true`.

### 10.4 Validações pós-carga (consultas de leitura)

| Verificação | Resultado |
| --- | --- |
| Ativos do tenant Saint-Gobain | **5** ✔ |
| Ativos no banco inteiro | **7** (2 da Dedini preservados) ✔ |
| Categorias do tenant | **1** (`ROBOT`, `is_robot = true`) ✔ |
| Fabricante/modelo corretos | ✔ KUKA/ABB conferidos linha a linha |
| Unidade / centro de custo | ✔ todos em `CAIEIRAS-SP-01` / `CC-MANUT-CAIEIRAS` |
| Idempotência (2ª execução) | ✔ contagem permanece 5 (nenhuma duplicidade) |
| Alteração em outros tenants | ✔ nenhuma |

### 10.5 Impedimentos / observações

1. **Categoria de robótica inexistente** no tenant — resolvido semeando `ROBOT` (§10.2).
2. **Sem campo de controlador no schema** — controlador registrado em `notes`; adicionar campo é
   evolução futura (roadmap), fora do escopo (proíbe migrations).
3. Canal de execução: **pipe de stdin** para `npx supabase db query --linked` (o CLI rejeita
   `--file`/`--db-url` — ver §8.2). O `raise notice` do bloco não é exibido pelo CLI, por isso a
   validação foi feita por `SELECT`s de leitura dedicados.

### 10.6 Próxima etapa

Aguardando autorização do comando. Fora de escopo até lá: solicitações, ordens de serviço,
preventivas, leituras operacionais e qualquer escrita em produção.

---

## 11. Etapa 5A — Manutenção Preventiva (preventivas, checklists e histórico)

**Data:** 08/10/2026 · **Ambiente:** staging `PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR` · **Tenant:** `beda618a-e7f0-4481-9cc9-d5aacab673cf` · **Unidade:** `CAIEIRAS-SP-01` · **CC:** `CC-MANUT-CAIEIRAS`.
**Execução:** bloco `do $$ ... end $$` em **transação atômica única**, via pipe de stdin do `supabase db query --linked` (sem migration/deploy/commit).

### 11.1 Modelo reutilizado (sem refatorar)

| Necessidade da 5A | Estrutura existente usada | Observação |
|---|---|---|
| Plano preventivo por ativo | `public.maintenance_plans` | Campos: `name`, `periodicity_days`, `next_due_date`, `is_active`, `assigned_to`, `notes`. Trigger `validate_maintenance_plan_scope` garante tenant/ativo do mesmo cliente. |
| Checklist técnico | campo `notes` do plano (**não existe tabela de checklist** no schema) | O checklist de 16 itens é gravado como texto em `notes`. |
| Histórico técnico independente de OS | `public.asset_operational_readings` | Única tabela existente com registros por ativo, datados (`captured_at`) e com `notes`/`health_status`. Métricas numéricas deixadas **NULL** (não inventamos medições). |

### 11.2 IDs reais dos ativos (coletados por leitura)

| Código | Fabricante/Modelo | `asset_id` |
|---|---|---|
| `RB-PRENSA-16` | KUKA KR210 R2700 Extra | `210c55ca-4fea-490d-bfce-acdc2fff1722` |
| `RB-PRENSA-21` | KUKA KR210 R2700 | `9fbefda9-76f6-4751-83e4-b7ad8a925d68` |
| `RB-CEL-04-ACAB` | KUKA KR20 R1810 | `975835f5-8ba4-4e93-9a01-b26e71f03fac` |
| `RB-PRENSA-22-STW` | ABB IRB 4600 | `2eae43c7-6a7e-42dc-a101-d3bfeee5d8c5` |
| `RB-PRENSA-22-STL` | ABB IRB 1200-7 | `90f1bc04-22e3-41d4-a8bb-83f2145f96ae` |

### 11.3 Planos preventivos criados (5/5)

| Ativo | `plan_id` | Periodicidade | `next_due_date` | Situação |
|---|---|---|---|---|
| `RB-PRENSA-16` | `bf1e759c-ab68-455e-8427-0a62f031b494` | 30 d | 2026-09-03 | Vencida −35 d · **falha crítica** no histórico |
| `RB-PRENSA-21` | `f52ee028-d0b7-4a44-a996-bccd49c63135` | 30 d | 2026-09-18 | Vencida −20 d |
| `RB-CEL-04-ACAB` | `af8e089f-4a93-416d-b3ce-672e44157e53` | 30 d | 2026-09-26 | Vencida −12 d · **em andamento** |
| `RB-PRENSA-22-STW` | `422aa432-8020-43d2-8a76-bb9e5fd0daf2` | 30 d | 2026-10-13 | **Futura** (+5 d) · histórico de **falhas recorrentes** |
| `RB-PRENSA-22-STL` | `061e7b98-0ff7-402e-9e74-ec60d8991ec9` | 30 d | 2026-10-15 | **Futura** (+7 d) |

> Data-base do banco: **2026-10-08**. Checklist de 16 itens adaptado por fabricante: KUKA (WorkVisual/KRC4, PC KPC, eixo 2 **aplicável**) e ABB (RobotStudio/IRC5, bateria SMB, item 9 "compensação do eixo 2" marcado **NÃO APLICÁVEL**). Todos os `notes` iniciam com `[SIMULACAO/DEMO]`.

### 11.4 Histórico técnico fictício — últimos 90 dias

**15 leituras** em `asset_operational_readings` (`source='manual'`, `created_by=NULL` para não inventar autor, métricas numéricas `NULL`), distribuídas:
- `RB-PRENSA-16`: 3 registros (normal −88d → atenção −55d → **crítica** −34d).
- `RB-PRENSA-21`: 3 registros (2 normais + atenção −21d por prevenção vencida).
- `RB-CEL-04-ACAB`: 3 registros (normal, atenção −40d desgaste de cabo, atenção −12d em andamento).
- `RB-PRENSA-22-STW`: 4 registros (**3 falhas recorrentes** no eixo 4/SMB + 1 normal).
- `RB-PRENSA-22-STL`: 2 registros (normais, saudável).

Todas as descrições começam com `SIMULAÇÃO`; **nenhuma OS** foi gerada (proibido nesta etapa).

### 11.5 Validações (consultas de leitura)

| Verificação | Resultado |
|---|---|
| Planos no tenant SG | **5** ✔ (3 vencidos, 2 futuros) |
| Checklist de 16 itens presente e adaptado | ✔ itens 1 e 16 em todos; item 9 diferenciado KUKA/ABB |
| Leituras no tenant SG | **15** (todas `SIMULAÇÃO%`, 0 com autor fictício) ✔ |
| Vinculação ao tenant SG | ✔ 5 planos e 15 leituras em `beda618a…` |
| OS criadas nesta etapa | **0** ✔ |
| Dedini / outros tenants | ✔ intactos (tenant `13187185…` preservado com seus 2 planos e 2 leituras) |
| Idempotência (2ª execução) | ✔ contagens permanecem 5 planos / 15 leituras |

### 11.6 Impedimentos / limitações

1. **Não existe tabela de checklist** no schema — o checklist foi acomodado em `notes`. Estruturá-lo como entidade própria é evolução futura (proibido criar migrations).
2. **Histórico independente de OS** usa `asset_operational_readings` (estrutura existente adequada); não há medições reais (horímetro/temperatura deixados `NULL`).
3. Cenários "falha crítica/em andamento" são apenas **descritivos** nas leituras — não há OS corretica/preventiva aberta (fora de escopo da 5A).
4. O `raise notice` do bloco não aparece no CLI; validação feita por `SELECT`s dedicados.

### 11.7 Próxima etapa

Aguardando autorização. **PARE — não avançar para a Etapa 5B.** Fora de escopo: OS preventivas/corretivas, solicitações, compras, custos e qualquer escrita em produção.



### 9.7 Prontidão

**Etapa 3 executada e validada** no staging `PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR` com os
parâmetros do §8.1 (`p_cnpj` e `p_contact_email` confirmados).
Nenhum ativo, usuário, solicitação ou OS foi criado
(escopo preservado).






---

## 10. Etapa 4A — Usuários e permissões demonstrativos

**Status (08/10/2026):** parcial — domínios corrigidos e estado validado; criação dos
3 usuários **pendente de execução pelo operador** (senha temporária não pode ser
registrada em comando/log/relatório).

### 10.1 Domínios autorizados (executado)
- Removido `saintbobain.com` (grafia incorreta) exclusivamente do tenant Saint-Gobain
  (`delete ... where tenant_id = 'beda618a-e7f0-4481-9cc9-d5aacab673cf' and domain = 'saintbobain.com'`).
- Mantidos e ativos: `saintgobain.com` e `saint-gobain.com`.
- Estado de partida confirmado: `tenant_memberships` do Saint-Gobain = **0**;
  `auth.users` com os 3 e-mails de demo = **0** (sem duplicidade).

### 10.2 Mecanismo e mapeamento RBAC (modelo existente)
- Edge Function `create-tenant-user` **publicada e ACTIVE (v1)** no staging; cria via
  `auth.admin.createUser({ email_confirm: true, password })` (sem convite/e-mail), marca
  `profiles.must_change_password = true` e insere `tenant_memberships` (papéis
  `tenant_admin` / `navigation`). Não cria permissões finas (feitas depois).
- **Não existe papel intermediário "gestor/supervisor".** A aprovação de solicitação
  (`approve_service_request_and_create_work_order`) valida `is_tenant_admin()`. Portanto
  Matheus (gestor: solicitações, aprovação e criação de OS) usa `tenant_admin`.

| Usuário | Papel | Permissões finas (`membership_permissions`) |
| --- | --- | --- |
| adm@saintgobain.com | tenant_admin | — (cobre tudo) |
| matheus.serafim@saint-gobain.com | tenant_admin | — (aprovação exige `tenant_admin`) |
| tecnico@saintgobain.com | navigation | `assets.read`, `service_requests.create`, `work_orders.read`, `work_orders.execute` |

- Unidade: `tenant_memberships` **não tem `unit_id`** (membresia é por tenant). O tenant
  possui uma única unidade `CAIEIRAS-SP-01` e o RLS isola por `tenant_id` — atendido sem
  criar mecanismo novo de autorização.

### 10.3 Execução (senha fora de log)
- Operador cria os 3 usuários pelo **Command Center** (UI
  `CommandCenterTenantUserProvisioning` → `create-tenant-user`), com senha temporária
  ≥ 12 caracteres gerada na própria UI.
- **Não** usar `manage-tenant-password` (dispara e-mail de recuperação).
- Após a criação, atribuir as permissões finas do técnico (10.4) e validar.

### 10.4 Validação (após a criação)
- 1 membresia por usuário no tenant Saint-Gobain, papel esperado, permissões finas do
  técnico, e técnico **sem** `tenant_admin`.
- Dedini/outros tenants intactos (sem novas linhas de membros).
- Autenticação: `POST /auth/v1/token?grant_type=password` por usuário (credenciais
  mantidas com o operador).

---

## 12. Etapa 5B — Cenário operacional (concluída — opção (b) autorizada)

**Data da auditoria:** 09/10/2026 · **Ambiente:** staging `PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR` (confirmado por
`linked-project.json`) · **Tenant:** `beda618a-e7f0-4481-9cc9-d5aacab673cf`.

### 12.1 O que foi encontrado (auditoria de leitura, sem qualquer escrita nesta sessão)

Antes de popular solicitações/OS/compras/custos, a consulta de estado retornou registros
**pré-existentes** de tentativas anteriores da própria 5B (execução interrompida antes da
compactação de contexto + pipe `stdin` corrompido que truncou SQL). Estado real do tenant:

| Recurso | Encontrado | Cenário-alvo da 5B |
|---|---:|---:|
| Fornecedores (`suppliers`) | 4 | (necessários p/ compras) |
| Solicitações (`service_requests`) | **24** | 12 |
| — `converted_to_wo` | 14 | — |
| — `triaged` | 7 | (≥2 p/ demonstração) |
| — `open` | 2 | — |
| — `cancelled` | 1 | — |
| Ordens de serviço (`work_orders`) | **10** | 10 |
| — `open` | 8 | 2 |
| — `waiting_material` | 2 | 2 |
| — `completed` / `in_progress` | **0 / 0** | 3 / 3 |
| — `corrective` / `preventive` | 7 / 3 | — |
| Requisições de compra (`purchase_requests`) | **0** | várias |
| Custo realizado somado (`total_cost_cents`) | **R$ 0,00** | ~R$ 80.000 |
| Planos preventivos (5A) | 5 ✅ | — |
| Leituras operacionais (5A) | 15 ✅ | — |

### 12.2 Divergências que impedem prosseguir

1. **Duplicidade de "levas":** há dois conjuntos de dados convivendo — um com títulos **sem**
   prefixo (`requested_by = adm`, ex.: "Troca de bateria do painel elétrico - Prensa 16") e outro
   **com** prefixo `[SIMULACAO]` (`requested_by = tecnico`). Não é possível saber, com segurança,
   qual conjunto deve prevalecer sem escolha do comando.
2. **Fora do cenário:** nenhuma OS `completed`/`in_progress` (alvo: 3 e 3); `waiting_material`
   existe mas **sem nenhuma compra** que a justifique (relação inconsistente com o trigger
   `sync_work_order_material_status`).
3. **Custos zerados:** nenhum valor em `service_cost_cents`/`material_cost_cents`/`total_cost_cents`
   (alvo ~R$ 80.000) e nenhuma estimativa em `estimated_*`.
4. **Datas uniformes:** todas as SR/WO datadas de 2026-10-08, sem a distribuição temporal
   retroativa pretendida.
5. **Numeração de WO com lacunas** (1, 2 e 10 ausentes) — sintoma de inserts abortados/desfeitos.

### 12.3 Decisão de segurança

Conforme as restrições explícitas da etapa — *"PARAR se não identificar com segurança registros
existentes"*, *"idempotência sem duplicação na reexecução"* e *"não contornar triggers/RLS/RPCs"* —
**nenhuma operação de escrita foi executada nesta sessão.** Prosseguir "por cima" do estado atual
produziria duplicidade adicional e custaria a integridade do cenário.

**Opções para o comando (próxima ação depende de escolha explícita):**
- **(a) Saneamento + reexecução:** limpar de forma controlada e restrita ao tenant
  (`suppliers`, `service_requests` — respeitando FKs —, `work_orders`, `purchase_requests`,
  `purchase_request_items`, `work_order_supplier_calls`, `service_request_audit_log`,
  `work_order_audit_log`) e reexecutar a 5B do zero com script único via `--file`.
- **(b) Aproveitamento:** tratar as 10 OS e 24 SR existentes como base e apenas **completar**
  custos, compras e os status faltantes (3 `completed`, 3 `in_progress`), ajustando nomenclatura.

**Decisão do comando (09/10/2026): opção (b) — COMPLETAR o cenário existente.**
Executada conforme a §12.4 abaixo.

### 12.4 Execução — conclusão autorizada (opção b)

Em 09/10/2026 o comando autorizou **completar o cenário existente**. Dois blocos `do $$ ... end $$`
atômicos via pipe stdin (sem migrations, deploy, commit ou push), com marcadores de idempotência em
`audit_logs`: `saint_gobain_operational_demo_completed` e `saint_gobain_operational_demo_costs_normalized`.

**Governança:** o trigger `enforce_work_order_governance` exige as 4 classificações
(`diagnosis_category`, `root_cause_category`, `action_category`, `recommendation_category`, com os
domínios exatos do modelo) antes de qualquer `completed` — preenchidas para as 3 OS concluídas;
nenhum trigger, RLS ou RPC foi contornado. Na OS da bateria STW registrou-se downtime com início e
fim (`causes_equipment_downtime = true`, 05→06/10).

**Distribuição final das 10 OS:**

| Status | Qtd | OS (ids curtos) | Natureza do custo |
|---|---:|---|---|
| `completed` | 3 | `187c2fdd` (prev. P16), `f59ae601` (prev. STW), `86809512` (bateria STW, downtime) | **R$ 28.000 realizado** |
| `in_progress` | 3 | `aa9a35d2` (falha crítica P16), `56d27ad5` (desgaste P21), `a7c2b605` (Célula 4) | **R$ 22.000 realizado parcial** |
| `open` | 2 | `2ba892ad` (prev. P21 vencida), `150bcf3f` (STL — saiu de `waiting_material`) | **R$ 12.000 planejado** (`estimated_*`) |
| `waiting_material` | 2 | `8f8ea7ce` (Célula 4), `d9b3e52a` (STW falhas) | peças pelas compras abaixo |

**Requisições de compra (2, `pending_approval`; o disparador `sync_work_order_material_status`
manteve as OS em `waiting_material`):**

| `purchase_request_id` | OS | Fornecedor | Itens | Total |
|---|---|---|---|---:|
| `6b9ad9c1-b142-4f19-9272-a2561f33d0dd` | `8f8ea7ce` (Célula 4) | Sigma Eletro | 4 × cabo de energia/conectores p/ dresspack | R$ 6.000 |
| `5291fc65-6588-452f-b9d1-12d94caba773` | `d9b3e52a` (STW) | ABB | 2 × kit freio eixo 4 + 2 × cabos eixo 4 | R$ 12.000 |

**Orçamento — R$ 80.000 exatos, sem dupla contagem:** realizado 28.000 (completed) + realizado
parcial 22.000 (in_progress) + previsto 12.000 (`estimated` somente nas 2 abertas) + comprometido/
estimado 18.000 (itens de compra) = **80.000**. Os `estimated` pré-existentes de R$ 12.000 (resíduo
da execução concorrente, em `completed`/`waiting`) foram **zerados** por duplicarem conceito —
normalização auditada no marcador `..._costs_normalized`.

**Validações (consultas de leitura pós-execução):**

| Verificação | Resultado |
|---|---|
| Distribuição das OS | 3 `completed` / 3 `in_progress` / 2 `open` / 2 `waiting_material` ✔ |
| Orçamento por categoria | 28k + 22k + 12k + 18k = R$ 80.000 ✔ |
| SRs elegíveis para aprovação (Matheus) | **7** (`triaged` com `triage_notes`, sem OS) — exigido ≥2 ✔ |
| Compras vinculadas às OS | 2 PR + 3 itens, fornecedor ativo do mesmo tenant ✔ |
| 5A preservada | 5 planos + 15 leituras intactos ✔ |
| Totais inalterados | 24 SR e 10 OS (somente atualização; nada criado) ✔ |
| Isolamento | Dedini `13187185…` com 2 OS / 1 completed (inalterada); nenhum outro tenant ✔ |
| Idempotência | reexecução dos 2 blocos não alterou contagens (marcadores únicos) ✔ |
| Visibilidade nos módulos | SR/OS/planos/compras filtrados por `tenant_id` nos módulos existentes ✔ |

**Limitações:**
1. `completed_at` = data/hora da execução — o trigger força `now()`; não há backdate via SQL.
2. SRs = **24** (não 12) e datas de abertura concentradas em 08/10 — produto da execução
   concorrente; nada foi apagado para preservar dados de terceiros.
3. Cenário misto de títulos (com/sem `[SIMULACAO]`) mantido — duas levantes conflitantes pré-existentes.
4. Preventivas concluídas sem achado usaram `'Outro / em analise'` — o catálogo não possui opção
   "sem falha / preventiva concluída".
5. As 2 OS `waiting_material` justificam-se pelas compras `pending_approval` (relação exigida pelo
   disparador de sincronização de material).

### 12.5 Lições de processo (para as próximas etapas)

- O pipe `Get-Content | npx supabase db query` (stdin) corrompeu SQL em contexto PowerShell.
  **Padrão correto:** escrever o SQL em arquivo e usar `npx supabase db query --linked
  --project-ref PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR --file <arquivo>`.
- Toda etapa de população deve iniciar com **auditoria de estado + marcador de idempotência**
  (`audit_logs`/flag) antes do primeiro `insert`.

**Sem alteração na Dedini/outros tenants; produção intocada; nenhuma migration/deploy/commit/push.**
