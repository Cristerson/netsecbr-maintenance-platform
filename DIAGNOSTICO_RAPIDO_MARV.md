# DIAGNOSTICO RAPIDO - MARV (Maintenance & Automation Robotic Verification)

Gerado em 23/10/2026. Branch agent/mvp-operational-and-purchases. Commit 290bc22.

> Gerado em: 23/10/2026 (sessao de retomada)
> Branch: agent/mvp-operational-and-purchases (rastreia origin/feature/marv-fluxo-solicitacoes-os)
> Ultimo commit: 290bc22 - feat: melhora fluxo de solicitacoes aprovacoes e ordens de servico (07/10/2026)
> Ambiente de homologacao: Supabase PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR (projeto antigo desativado) - producao (zhsutxrvjocamdyyrquy) intocada
> Build: tsc -b OK ; vite build --mode staging OK (598 kB, sem erro)
> Testes automatizados: nenhum (0 *.test.* / *.spec.*)

---

## 1. Resumo executivo

O MARV esta em estagio MVP operacional avancado em homologacao: o nucleo de manutencao
(solicitacoes -> triagem -> OS -> execucao -> custos -> preventivas -> compras) esta
implementado no frontend (React/Vite/TS) e no banco (Supabase/PostgreSQL com RLS multi-tenant),
e foi validado ponta a ponta com o cenario demonstrativo Saint-Gobain (Caieiras). Ainda sao
pendentes a camada de Governanca/Performance, indicadores avancados (disponibilidade,
MTBF/MTTR, Pareto, custo por ativo), cobranca/pagamentos, app mobile, IIoT e IA - todos
explicitamente fora do escopo do MVP V1.

Risco principal: a autorizacao e apenas por tenant (RLS tenant_id), sem controle por unidade;
usuarios de um tenant enxergam todas as unidades. Aceitavel para MVP single-unit, mas precisa
ser enderecado antes de clientes multiunidade reais.

---

## 2. Matriz de funcionalidades

Legenda: OK Implementado ; PARCIAL Parcial ; PENDENTE Pendente/nao implementado

### 2.1 Operacoes de Manutencao (cliente)

| Modulo | Status | Evidencia |
|---|---|---|
| Ativos/robos (CRUD, categorias, unidade/CC) | OK | asset-admin.tsx, asset-category-admin.tsx |
| Solicitacoes (abertura, triagem, aprovacao, conversao em OS) | OK | service-request-admin.tsx, migration 20260902000000, RPC approve_service_request_and_create_work_order |
| Ordens de servico (CRUD, status, custos, governanca, compras) | OK | work-order-admin.tsx, migrations 20260914* |
| Manutencao preventiva (planos, checklists em notes, RPC) | OK | preventive-plan-admin.tsx, migrations 20260921* |
| Compras (requisicoes por OS, aprovacao, envio, recebimento, sync material) | OK | purchase-request-admin.tsx, purchase-management.tsx, migration 20260902100000 |
| Historico tecnico de ativos (asset_operational_readings) | OK | migration 20260927210957 |
| Fornecedores e SLA | OK | migration 20260801220000 |
| Contratos de propriedade de ativos (responsabilidade externa) | OK | migration 20260818194827 |
| Dashboard (visao geral) | PARCIAL | main.tsx Dashboard: OS abertas, preventivas atrasadas, aprovacoes, ativos em parada; Disponibilidade = "—" (em breve); sem MTBF/MTTR/Pareto/custo |
| Governanca e Performance (modulo separado) | PENDENTE | Fora do MVP V1; apenas documentado |


### 2.2 Administracao do cliente (tenant)

| Modulo | Status | Evidencia |
|---|---|---|
| Usuarios e permissoes (CRUD, ativacao/desativacao) | OK | user-admin.tsx, Edge Function create-tenant-user |
| Unidades e centros de custo (CRUD) | OK | migrations 20260801180000, CHANGELOG |
| Identidade visual (logo, cores) | OK | branding-admin.tsx, migrations 20260801240000/241000 |
| Painel financeiro (consulta: contrato, plano, franquias, faturas, pagamentos) | OK | finance-admin.tsx (somente leitura) |
| Suporte NETSECBR (tickets) | OK | support-ticket-admin.tsx, migrations 20260926231739/20260927022331 |
| Integracoes e importacoes CSV | PARCIAL | UI placeholder ("serao configuradas") |
| Multiunidade com autorizacao por unidade | PENDENTE | Sem tabela user_units/unit_memberships; acesso apenas por tenant_id |

### 2.3 NETSECBR Command Center (global)

| Modulo | Status | Evidencia |
|---|---|---|
| Clientes (tenant create/update, status, CNPJ) | OK | command-center.tsx, createCommandCenterTenant |
| Planos de assinatura (CRUD, ativar/desativar) | OK | saveSubscriptionPlan, setSubscriptionPlanActive |
| Contratos de assinatura (criacao) | OK | createSubscriptionContract |
| Franquias/consumo (storage, robos) | OK | tenant-franchise-panel.tsx, useCommandCenterConsumption |
| Usuarios da plataforma (netsecbr_admin) | OK | platform-team-admin.tsx, Edge Function manage-platform-users |
| Equipe do tenant (provisionamento) | OK | command-center-tenant-user-provisioning.tsx |
| Suporte global | OK | command-center-support-admin.tsx |
| Contatos do tenant | OK | migration 20260927160508 |
| Cobranca/pagamentos (processamento) | PENDENTE | plannedModules lista "Cobranca" como planejado; schema invoices/payments existe mas sem gateway |
| Indicadores financeiros globais (MRR, receita) | PENDENTE | Sem implementacao |
| Governanca e performance (camada) | PENDENTE | Planejado |

### 2.4 Infraestrutura e plataforma

| Item | Status | Evidencia |
|---|---|---|
| Autenticacao Supabase + RLS multi-tenant | OK | migrations 20260801190000, 191000 |
| Multi-tenant por tenant_id | OK | Todas as tabelas de negocio |
| Dominios corporativos autorizados por tenant | OK | migration 20260802160000 |
| Tenant branding + storage privado | OK | migrations 20260801240000/241000 |
| Edge Functions (3) | OK | create-tenant-user, manage-platform-users, manage-tenant-password |
| Keep-alive Supabase | OK | migration 20260801200000, backend/keepalive |
| App mobile (Flutter) | PENDENTE | Documentado, nao implementado |
| IIoT / telemetria de maquinas | PENDENTE | Documentado, nao implementado |
| IA | PENDENTE | Documentado, nao implementado |
| Notificacoes/e-mail | PENDENTE | create-tenant-user cria sem convite; sem envio de e-mail |
| Checklist como entidade propria | PENDENTE | Acomodado em notes (limitacao conhecida, sec 11.6 do plano demo) |


## 3. Backend / banco de dados

- Migrations: 41 arquivos (de 20260801180000 a 20260927211828), cobrindo SaaS foundation,
  usuarios/permissoes, ativos, assinaturas, OS, fornecedores, monitoramento, branding, financeiro,
  suporte, dominios de e-mail, governanca, custos, solicitacoes, compras, planos preventivos,
  RPCs do Command Center, contatos, leituras operacionais.
- Roles: netsecbr_admin (plataforma), tenant_admin, navigation (tenant). Nao existe papel
  intermediario "gestor/supervisor" - aprovacao de solicitacao exige tenant_admin.
- RLS: todas as tabelas de negocio filtram por tenant_id via is_tenant_member /
  is_tenant_admin / tenant_allows_operation. NetSecBR admin tem acesso global.
- Soft delete: ativos e usuarios usam exclusao logica (conforme padrao do projeto).
- Auditoria: audit_logs com insercao por ator; trilha de governanca de OS.

## 4. Qualidade e testes

- TypeScript: tsc -b passa sem erros.
- Build staging/producao: passa (Vite 8.2, 1856 modulos).
- Testes automatizados: nenhum. Validacao e manual (roteiro de aceite MVP V1 -
  documentacao/14_Roteiro_Aceite_MVP_V1.md).
- Lint: nao configurado explicitamente (sem script lint em package.json).
- Chunk size: aviso de bundle > 500 kB (otimizacao futura, nao bloqueante).

## 5. Riscos e limitacoes conhecidas

1. Autorizacao apenas por tenant - sem controle por unidade; qualquer usuario do tenant ve
   todas as unidades. Bloqueante para clientes multiunidade reais.
2. Sem testes automatizados - regressoes dependem de validacao manual.
3. Cobranca nao implementada - schema existe (invoices/payments) mas sem gateway nem UI de
   gestao global; "Cobranca" aparece como modulo planejado no Command Center.
4. Indicadores avancados pendentes - disponibilidade/MTBF/MTTR/Pareto/custo por ativo ainda
   sao placeholders ("em breve").
5. Checklist acomodado em notes - nao e entidade propria; estruturacao futura exige migration.
6. Sem notificacoes/e-mail - provisionamento de usuario nao envia convite.
7. Modulo de Governanca e Performance separado e em construcao.
8. Producao intocada - deploy exige tarefa propria; migrations nao aplicadas em prod.


## 6. Evidencias de validacao (Saint-Gobain / Caieiras)

Cenario demonstrativo executado e validado em staging (ver documentacao/DEMO_SAINT_GOBAIN_PLANO.md):
- Tenant beda618a-e7f0-4481-9cc9-d5aacab673cf com 1 unidade (CAIEIRAS-SP-01) e 1 centro
  de custo (CC-MANUT-CAIEIRAS).
- 3 usuarios (tenant_admin x2, navigation x1) com permissoes finas do tecnico.
- 5 robos KUKA/ABB vinculados a unidade/CC.
- 5 planos preventivos (3 vencidos, 2 futuros) + 15 leituras operacionais (simulacao).
- 24 solicitacoes e 10 OS distribuidas (3 completed / 3 in_progress / 2 open /
  2 waiting_material), 2 requisicoes de compra, R$ 80.000 de orcamento sem dupla contagem.
- Isolamento confirmado: Dedini e demais tenants intactos; idempotencia validada.

## 7. Proximos passos recomendados (ordem sugerida)

1. Validar roteiro de aceite MVP V1 (documentacao/14_Roteiro_Aceite_MVP_V1.md) com o cenario
   Saint-Gobain ja carregado.
2. Enderecar autorizacao por unidade (tabela user_units + RLS) antes de clientes multiunidade
   reais.
3. Implementar indicadores avancados (disponibilidade, MTBF, MTTR, Pareto, custo por ativo) -
   base de dados ja existe (asset_operational_readings, custos de OS).
4. Estruturar checklist como entidade propria (migration) - hoje em notes.
5. Adicionar testes automatizados (ao menos para RPCs criticas e RLS).
6. Planejar cobranca/pagamentos (gateway + UI global) - fora do MVP V1, mas schema ja preparado.
7. App mobile (Flutter), IIoT e IA - fases posteriores (roadmap).

## 8. Fontes consultadas

- README.md, ROADMAP.md, PROJECT_RULES.md, CHANGELOG.md
- documentacao/DEMO_SAINT_GOBAIN_PLANO.md (Etapas 3, 4A, 4B, 5A, 5B)
- documentacao/18_Conteudo_Institucional_MARV.md
- documentacao/ENVIRONMENTS.md (Frontend)
- Codigo: Frontend/src/*.tsx, backend/supabase/migrations/*.sql,
  backend/supabase/functions/*, Frontend/src/use-command-center-data.ts
- Git: branch agent/mvp-operational-and-purchases, commit 290bc22
