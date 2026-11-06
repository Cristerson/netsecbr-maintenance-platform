# Revisão rastreável do roadmap — 23/10/2026

Esta revisão não altera `13-Roadmap.md`. Ela compara o plano original com a branch atual e o histórico recente. Status de código, dados e aceite são distintos.

| Frente do roadmap | Estado observado | Evidência e decisão |
|---|---|---|
| Fundação SaaS e núcleo operacional F1 | Implementado em grande parte, aceite formal pendente | Frontend, migrations e RPCs; matriz de aderência anexa |
| Manual/Ajuda F1 | Área de ajuda presente; publicação/aceite do manual completo NÃO COMPROVADOS | `Frontend/src/help-center.tsx`, `15_Manual_Operacao_MVP_V1.md`, roteiro 14 |
| Segurança antes de publicar | Revisão integral da versão consolidada NÃO COMPROVADA | `13-Roadmap.md` exige auditoria de diff, dependências, RLS, grants, Edge/CORS |
| Multiunidade por usuário | Implementação local posterior ao diagnóstico rápido; homologação pendente | migration não rastreada `20260928100000`, `user-admin.tsx` e Edge Function alterados |
| Demo Dedini e Saint-Gobain | Dados e consolidação informados; teste dos usuários pendente | `DEMO_SAINT_GOBAIN_PLANO.md`, `RELATORIO_CONSOLIDACAO_MARV.md` |
| Command Center comercial | Cadastro de clientes, planos, contratos e suporte presente; cobrança real ainda não demonstrada | componentes Command Center; módulo “Cobrança” planejado |
| Compras | Implementação histórica preservada; retirada do aceite V1 | decisão explícita em `14_Roteiro_Aceite_MVP_V1.md` |
| Campo Android, IIoT, IA, indicadores avançados | Fases futuras | `13-Roadmap.md`; não contam como bloqueios do núcleo atual |

## O que falta para declarar o MVP comercial

1. Executar e preencher os 12 cenários de `14_Roteiro_Aceite_MVP_V1.md` com AN, AC e UN no projeto principal, incluindo recuperação de senha e bloqueios de governança. Priorizar o ciclo solicitação → OS → conclusão → indicador.
2. Provar isolamento negativo por tenant e unidade com sessões autenticadas, inclusive a migration de visibilidade por unidade. Confirmar seu estado aplicado antes de atribuir resultado de teste.
3. Registrar claramente o recorte de checklist/anexos: o PRD exige os dois; o cenário demo usa texto em `notes`. Isso requer decisão de escopo ou a menor correção comprovadamente necessária, sem presumir aceite.
4. Revisar a versão candidata à publicação conforme o critério de segurança do roadmap. O relatório de consolidação declara backup lógico e limitações de restauração física; não tratar a consolidação como prova de recuperabilidade.
5. No Command Center, validar o fluxo comercial já existente. Só então escolher uma lacuna para entrega curta, começando pela visibilidade financeira de contratos/degustação/vencimento caso ainda falte no uso real. Gateway de pagamento e cobrança automática são trabalho separado.

## Próxima entrega prioritária

**Homologação guiada do núcleo operacional no projeto principal.** Preparar evidências dos cenários 5–12 com os quatro usuários Saint-Gobain já relatados, sem criar nova massa nem alterar banco nesta fase de planejamento. Registrar comportamentos reais de cada perfil e testes negativos de isolamento. O produto resultante é uma lista curta de falhas reproduzidas, ordenadas por impacto na venda; a próxima implementação corrige apenas a primeira falha bloqueante confirmada.

Esta prioridade evita reabrir trabalho já escrito e não depende de construir o Command Center do zero. Nenhuma alteração de roadmap original, migration, banco, deploy, commit ou push foi executada nesta revisão.
