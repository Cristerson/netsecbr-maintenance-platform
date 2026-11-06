# Matriz de aderência — MARV MVP V1

Revisão em 23/10/2026. **Prevista** refere-se ao PRD, backlog, roadmap e roteiro de aceite. **Implementada** significa evidência no código local; **Homologada** exige resultado funcional documentado. Os 12 campos de resultado do roteiro oficial estão vazios, portanto o aceite formal é **NÃO COMPROVADO**. A carga e a integridade da demo Saint-Gobain são relatadas em `DEMO_SAINT_GOBAIN_PLANO.md` e `RELATORIO_CONSOLIDACAO_MARV.md`; não substituem testes de interface e RLS autenticados.

| Funcionalidade | Prevista | Implementada | Homologada | Evidência principal | Pendência objetiva |
|---|---|---|---|---|---|
| Login, senha temporária e recuperação | Sim, aceite 1 | Sim, fluxo em `Frontend/src/auth-gate.tsx` e funções de gestão de senha | NÃO COMPROVADO | roteiro 1 vazio; relatório de consolidação registra usuários demo | Testar login, troca obrigatória e recuperação em sessão real |
| Usuários, permissões e bloqueios | Sim, aceite 2 | Sim, `user-admin.tsx`, `create-tenant-user` e migrations de memberships | NÃO COMPROVADO | código e roteiro 2 vazio | Testar criação, domínio, permissões, último admin, bloqueio e senha |
| Unidades, centros de custo e fornecedores | Sim, aceite 3 | Sim, `organization-admin.tsx`, `supplier-admin.tsx` e migrations | NÃO COMPROVADO | código; dados demo relatados | Executar CRUD e desativação por AC |
| Ativos e categorias | Sim, aceite 4 | Sim, `asset-admin.tsx`, `asset-category-admin.tsx` | NÃO COMPROVADO | código; 5 ativos Saint-Gobain relatados | Validar cadastro, mudança de status e leitura restrita por UN |
| Abertura de solicitação | Sim, aceite 5 | Sim, `service-request-admin.tsx`, migration `20260902000000` | NÃO COMPROVADO | 24 solicitações da demo relatadas; roteiro vazio | Abrir nova solicitação com UN e verificar autor, escopo e lista |
| Triagem e estimativa | Sim, aceite 6 | Sim, `service-request-admin.tsx`, migration `20260914130000` | NÃO COMPROVADO | código; 7 solicitações triadas relatadas | Testar triagem obrigatória, valores, autoria e bloqueio de UN |
| Aprovação e conversão em OS | Sim, aceite 7 | Sim, RPC `approve_service_request_and_create_work_order` e botão na UI | NÃO COMPROVADO | migrations `20260914130000`/`20260914131000`, commit `290bc22` | Aprovar uma solicitação em sessão AC; verificar OS única e vínculo bilateral |
| Execução, custos, parada e conclusão | Sim, aceite 8 | Sim, `work-order-admin.tsx` e migrations de governança/custos | NÃO COMPROVADO | 10 OS com estados distintos relatadas; roteiro vazio | Executar transições e conferir classificações, custos e fechamento |
| Bloqueios de cancelamento/reabertura | Sim, aceite 9 | Regras em migrations `20260914113000` a `20260914115000` | NÃO COMPROVADO | triggers e UI encontrados | Testar alteração recusada após cancelamento/conclusão |
| Preventivas e geração de OS | Sim, aceite 10 | Sim, `preventive-plan-admin.tsx` e RPC `create_preventive_work_order_from_plan` | NÃO COMPROVADO | 5 planos da demo relatados; roteiro vazio | Criar/ativar plano, gerar OS e verificar avanço da próxima data |
| Dashboard operacional básico | Sim, aceite 11 | Parcial: OS, preventivas, ativos e aprovações; disponibilidade é placeholder | NÃO COMPROVADO | `main.tsx` | Conferir contagens reais e atualização sem F5; delimitar indicador indisponível |
| Perfis AN, AC e UN | Sim, aceite 12 | Menu e ações condicionados em `main.tsx`; RLS nas migrations | NÃO COMPROVADO | código e 4 vínculos Saint-Gobain relatados | Testar três sessões e tentativas proibidas por API |
| Visibilidade por unidade | Diretriz multiunidade posterior | Código local: migration `20260928100000` e UI em `user-admin.tsx` | NÃO COMPROVADO | migration não rastreada e alterações locais | Confirmar aplicação no projeto principal; testes positivos/negativos por unidade e tenant |
| Checklist estruturado e anexos operacionais | PRD RF-03/04/06 e roadmap F1 | NÃO COMPROVADO como fluxo completo | `DEMO_SAINT_GOBAIN_PLANO.md` usa checklist em `maintenance_plans.notes`; sem evidência de resposta estruturada | Decidir tratamento explícito no aceite: implementação mínima ou ajuste aprovado do escopo |
| Histórico e auditoria | PRD RF-08 | Sim, `service_request_audit_log`, `work_order_audit_log`, `audit_logs` | NÃO COMPROVADO | migrations `20260914120000`/`20260914130000`; relatos de contagem | Conferir eventos após o ciclo executado e isolamento da leitura |
| Command Center: clientes, planos, contratos e franquias | PRD RF-10 e arquitetura de navegação | Sim, componentes `command-center*`, `use-command-center-data.ts`, RPCs | NÃO COMPROVADO | criação relatada na conversa; roteiro V1 não cobre o módulo global | Teste administrativo de cadastro, contrato e limites no projeto principal |
| Command Center: suporte | Arquitetura de navegação | Sim, `command-center-support-admin.tsx`, `support-ticket-admin.tsx` | NÃO COMPROVADO | código e migrations de tickets | Testar cliente abre → NetSecBR trata → cliente vê resposta |
| Cobrança e pagamentos efetivos | PRD RF-10/11; arquitetura Command Center | Parcial: schema e leitura em `finance-admin.tsx`; `Cobrança` planejada na UI | NÃO COMPROVADO | `command-center.tsx` e `finance-admin.tsx` | Definir recorte comercial do MVP; não afirmar gateway/PIX/cartão operantes |
| Compras | Fora do aceite V1 por decisão posterior | Código e dados históricos existem | Fora do escopo de homologação atual | roteiro oficial, seção “Fora do aceite” | Não bloquear o MVP nem remover dados |

## Ciclo operacional a comprovar

`Solicitação aberta → triagem registrada → aprovação/RPC → OS vinculada → execução → conclusão com regras de governança → auditoria/histórico → atualização do Dashboard`.

Executar esse percurso primeiro com AC e UN no tenant de demonstração, depois repetir as tentativas negativas entre tenants e unidades. Registrar resultado, responsável, data, evidência de tela e, quando pertinente, consulta de auditoria em cada cenário do roteiro original. Uma falha deve ser classificada como bug reproduzido; uma etapa sem execução permanece **NÃO COMPROVADA**.

## Reconciliação com código atual e diretriz de 02/11/2026

A matriz de 23/10 acima é um retrato histórico e não foi substituída. O commit `5a144d9f50c0fc9628530918c39f016c8a96b429` acrescentou integração local. **Implementado no código** não significa **aplicado em todos os ambientes**, nem **homologado com usuário autenticado**. A documentação de integração local de 01/11 descreve apenas o protótipo daquela data; o código posterior já possui chamadas de persistência de checklist, mas não conclui relatório/aceite remotos.

| Frente | Evidência atual no código | Estado de comprovação / lacuna |
| --- | --- | --- |
| Planos no ativo e histórico básico | `Frontend/src/asset-admin.tsx` lista planos e OS do equipamento e abre os módulos existentes. | Implementado localmente; testes A1, A2 e A10 pendentes. |
| Modelos e atividades do plano | `preventive-plan-admin.tsx` chama `configure_preventive_plan_checklist` e relê `preventive_plan_activities` para confirmar conteúdo. | Implementado localmente; gravação real das 16 atividades e revisão histórica ainda precisam de prova. O salvamento do plano e do checklist são chamadas separadas. |
| Solicitação preventiva e OS | `service-request-admin.tsx` seleciona plano, chama `create_preventive_cycle_work_order` e tenta inicializar checklist; `work-order-admin.tsx` separa Corretivas/Preventivas. | Implementado localmente; testes A3–A5 e regra universal de uma OS ativa por equipamento não homologados. |
| Checklist, medições, fotos e não conformidade | `preventive-checklist-execution.tsx` chama RPCs de inicialização, salvamento e solicitação corretiva; usa bucket `preventive-evidence`. | Caminho de persistência no código; falta teste autenticado de campos pertinentes por atividade, fotos privadas, retomada, idempotência e acesso móvel (A5–A8, A12). |
| Relatório, supervisor, assinatura e PDF | `preventive-execution-local.tsx` informa explicitamente que aprovação/aceite são locais e não enviados ao Supabase. | **Não atende ainda** ao aceite real A9. PDF final recuperável, decisão autenticada, assinatura persistida e auditoria permanecem pendentes. |
| Modo Prestador leve | Diretriz funcional consolidada; não há fluxo avulso homologado. | Não prometer como pronto. Implementar e homologar A11 sem duplicar produto ou contornar RLS. |
| Aceite V1 e segurança | Os 12 resultados do roteiro original continuam vazios; relatório de homologação registra testes públicos parciais. | **0/12 cenários completos formalmente aprovados**; A1–A12 também não executados. Auditoria integral pré-publicação pendente. |

Prioridade imediata: confirmar plano/checklist da OS #50 como caso de homologação, depois fotos/medições reais, PDF/aceite e testes de isolamento. Não criar regras específicas para a Saint-Gobain ou Dedini.
