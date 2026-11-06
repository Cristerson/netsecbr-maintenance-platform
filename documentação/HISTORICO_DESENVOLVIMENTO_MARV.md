# Histórico de desenvolvimento do MARV

Atualizado em 23/10/2026. Referência para continuidade; não substitui PRD, roadmap nem roteiro de aceite. Consulte também [Matriz de aderência](MATRIZ_ADERENCIA_MVP_MARV.md) e [Revisão do roadmap](REVISAO_ROADMAP_MARV_2026-10-23.md).

## Legenda de evidência

- **CONFIRMADO NO REPOSITÓRIO:** arquivo, migration ou código encontrado na branch de trabalho. Isso não comprova aplicação no banco nem aceite funcional.
- **INFORMADO PELO HISTÓRICO:** relato de execução ou validação registrado em documento ou na conversa; não reexecutado nesta revisão.
- **PENDENTE DE VALIDAÇÃO:** falta evidência de teste ou estado remoto verificável. Usar **NÃO COMPROVADO** para homologação sem registro.

## Produto e arquitetura

**CONFIRMADO NO REPOSITÓRIO.** O MARV é o SaaS multiempresa de manutenção industrial da NetSecBR. O frontend atual é React, TypeScript e Vite (`Frontend/package.json`); o backend atual usa Supabase PostgreSQL, Auth, RLS, Edge Functions e migrations em `backend/supabase/`. O PRD cobre ativos industriais além de robôs; robótica continua a principal vitrine comercial. A documentação de arquitetura menciona .NET/Next.js como direção futura, não como stack operacional atual.

**CONFIRMADO NO REPOSITÓRIO.** Existem duas experiências: Command Center global da NetSecBR (`Frontend/src/command-center.tsx`) e operação do tenant (`Frontend/src/main.tsx` e módulos administrativos/operacionais). Governança e Performance é uma camada analítica planejada sobre os mesmos dados. Compras possui código histórico, mas está expressamente fora do aceite do MVP V1 (`14_Roteiro_Aceite_MVP_V1.md`).

## Linha do tempo por marcos verificáveis

| Marco | Evidência | Situação |
|---|---|---|
| Fundação multi-tenant, perfis, unidades, ativos, contratos e RLS | migrations `202608*`, `Frontend/src/auth-gate.tsx` | CONFIRMADO NO REPOSITÓRIO; aplicação atual em cada banco não verificada nesta revisão |
| Solicitações, OS, governança, custos e auditoria | migrations `20260902000000`, `20260914130000`, `20260914131000`, `20260914120000`; `service-request-admin.tsx`, `work-order-admin.tsx` | CONFIRMADO NO REPOSITÓRIO |
| Preventivas e geração de OS | migrations `20260921100000`, `20260921102000`; `preventive-plan-admin.tsx` | CONFIRMADO NO REPOSITÓRIO |
| Command Center: clientes, planos, contratos, franquias, equipe e suporte | `command-center.tsx`, `use-command-center-data.ts`, componentes associados e migrations `20260926*`/`20260927*` | CONFIRMADO NO REPOSITÓRIO; cobrança automatizada não comprovada |
| Demo Dedini e leituras operacionais manuais | `backend/supabase/bootstrap/create-dedini-demo.sql.template`; migrations `20260927210957` e `20260927211828` | Código confirmado; massa em ambiente remoto informada pelo histórico |
| Melhoria Solicitação → aprovação → OS | commit `290bc22`, branch `agent/mvp-operational-and-purchases` | CONFIRMADO NO REPOSITÓRIO; aceite ponta a ponta NÃO COMPROVADO |
| Demo Saint-Gobain em staging | `DEMO_SAINT_GOBAIN_PLANO.md` §§10–12 | INFORMADO PELO HISTÓRICO: 5 ativos, 24 solicitações, 10 OS, 5 planos; não é aceite do MVP |
| Visibilidade por unidade | migration local não rastreada `20260928100000_add_unit_visibility_authorization.sql`, alterações locais de `user-admin.tsx` e `create-tenant-user` | CONFIRMADO NO WORKTREE; aplicação remota e testes negativos NÃO COMPROVADOS nesta revisão |
| Consolidação Saint-Gobain/Dedini no projeto principal em 23/10/2026 | `RELATORIO_CONSOLIDACAO_MARV.md` §11 | INFORMADO PELO HISTÓRICO; esta revisão não consultou nem alterou o banco |

As datas dos marcos sem data documental específica não foram inferidas.

## Ambientes e controle de versão

**INFORMADO PELO HISTÓRICO.** O projeto principal pretendido é `netsecbr-maintenance` (`zhsutxrvjocamdyyrquy`, us-east-2); o antigo staging é `projeto antigo desativado` (`PROJETO_ANTIGO_DESATIVADO_NAO_UTILIZAR`, us-east-1). O relatório de 23/10 afirma consolidação de Saint-Gobain e uma solicitação Dedini no principal, preservando registros existentes. Numerações de algumas solicitações e OS foram regeneradas por unicidade global. Usuários temporários Saint-Gobain foram criados; validação de login, troca de senha e isolamento negativo permanece pendente. Nenhuma credencial é reproduzida aqui.

**CONFIRMADO NO REPOSITÓRIO.** Branch atual `agent/mvp-operational-and-purchases`, commit `290bc22`, rastreando `origin/feature/marv-fluxo-solicitacoes-os`. `origin/main` aponta para `6d0e5d0`; a branch atual está um commit à frente desse remoto. A branch local `main` permanece em `dbeb9d8` e não representa a versão atual de `origin/main`. Há alterações rastreadas e arquivos não rastreados do usuário; nenhum deles foi descartado ou incorporado nesta revisão.

## Situação do MVP

**CONFIRMADO NO REPOSITÓRIO.** Há código para cadastro de ativos, estrutura, solicitações, triagem, aprovação por RPC, OS, execução/conclusão, auditoria, preventivas, usuários/permissões, painel e administração SaaS. O Dashboard ainda mostra disponibilidade como indicador futuro; checklist estruturado e anexos operacionais do PRD não têm implementação comprovada pela evidência inspecionada. `Cobrança` aparece como módulo planejado no Command Center; consulta de faturas/pagamentos no cliente não equivale a processamento de cobrança.

**PENDENTE DE VALIDAÇÃO.** O roteiro oficial de 12 cenários (`14_Roteiro_Aceite_MVP_V1.md`) está sem resultados preenchidos. Há relatos de build e validações de dados de demonstração, mas eles não substituem aceite funcional por AN/AC/UN. Testes negativos de RLS entre tenants e unidades com sessões reais, login/troca de senha dos usuários demo e fluxo integral solicitação → OS → encerramento → indicadores estão **NÃO COMPROVADOS**. A matriz anexa discrimina cada item.

## Decisões de escopo e próximos passos

- Compras permanece preservado no código e nos dados, fora dos bloqueios de homologação do MVP atual.
- App móvel nativo, IIoT, IA e indicadores avançados continuam fases futuras; não declarar essas capacidades ativas.
- O documento `DIAGNOSTICO_RAPIDO_MARV.md` é fotografia anterior: a afirmação de ausência de controle por unidade conflita com a migration e alterações locais posteriores; a afirmação de produção intocada conflita com o relatório de consolidação de 23/10.
- Próxima entrega recomendada: registrar e executar o aceite funcional do núcleo operacional com os perfis demo já existentes, incluindo testes negativos de isolamento, preservando evidências por cenário. Só depois corrigir falhas comprovadas e escolher a menor lacuna comercial do Command Center.

Nenhum banco, migration, deploy, commit ou push foi executado nesta sincronização.
