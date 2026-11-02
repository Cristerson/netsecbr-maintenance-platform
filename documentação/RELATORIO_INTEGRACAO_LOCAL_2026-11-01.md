# MARV — Integração local da execução preventiva (01/11/2026)

## Escopo e resultado

Foi integrado à tela de detalhes de OS preventiva um protótipo **local e não operacional** de execução, checklist estruturado, medições, observações, fotografias por atividade, relatório, revisão visual do supervisor, devolução, aceite com assinatura e impressão/salvamento como PDF pelo navegador. A ordem de estados é: execução → relatório → revisão → aceite → final. A devolução retorna à execução. Nenhum dado desse fluxo é enviado ao Supabase.

As atividades do checklist são exemplos fixos, **não extraídos do plano real**. Texto e resultados podem ser guardados temporariamente em `sessionStorage` nesta aba; fotos e assinatura permanecem apenas em memória. Recarregar/fechar a aba pode perdê-los. A aprovação usa nomes digitados e não substitui autorização por perfil, trilha de auditoria ou assinatura juridicamente validada. O PDF é uma impressão local, não um documento armazenado ou enviado por e-mail.

## Arquivos desta integração

- `Frontend/src/preventive-local-workflow.ts`: transições e validação do checklist.
- `Frontend/src/preventive-execution-local.tsx`: fluxo de interface, prévia e impressão.
- `Frontend/src/work-order-admin.tsx` e `Frontend/src/main.tsx`: entrada na OS preventiva existente e contexto exibido.
- `Frontend/src/report-photo-picker.tsx`: fotos controladas pelo estado do fluxo.
- `Frontend/src/styles.css`: formato de impressão do relatório.
- `Frontend/tests/e2e/preventive-demo.html`, `.tsx`, `preventive-local.spec.ts`, `preventive-ui.spec.ts`: fixture inteiramente fictícia e testes sem Supabase.
- `backend/supabase/migrations/20261031214019_preventive_cycle_foundation.sql`: revisão local de compatibilidade; **não aplicada**.

Os componentes `industrial-checklist-editor.tsx` e `report-signature-pad.tsx` já estavam preparados e foram reutilizados. Há outras alterações preexistentes no working tree, não relacionadas a esta integração; não devem ser incluídas em um commit sem revisão específica.

## Evidências e testes

- `npm --prefix Frontend run build:staging`: passou; TypeScript e Vite concluídos. Aviso não bloqueante de bundle acima de 500 kB.
- `npm --prefix Frontend run test:e2e -- tests/e2e/preventive-local.spec.ts tests/e2e/preventive-ui.spec.ts`: **6/6 passaram** em Chromium local. Inclui rascunho temporário, checklist incompleto, não conformidade, devolução, bloqueio visual de autoaprovação, assinatura exigida e PDF de QA com cabeçalho `%PDF`.
- O teste visual usou a fixture local em `127.0.0.1:5183`, com dados fictícios; o relatório para impressão foi inspecionado em captura de tela. Não houve homologação autenticada, teste de persistência, teste de e-mail, assinatura legal ou teste de desempenho do PDF.

## Plano de migração compatível

Fase A (proposta local, **sem aprovação de aplicação**): a migration revisada é aditiva e deixa intacta a RPC antiga `create_preventive_work_order_from_plan(uuid)` e o caminho legado de inserção. Registros sem ciclo continuam possíveis durante a transição; novos registros com ciclo usam a RPC nova e índice único. O trigger protege a chave de ciclo, mas a unicidade universal ainda **não** está garantida para entradas legadas sem ciclo.

Fase B (futura, dependente de decisão): reconciliar as OS antigas, implantar frontend que use a nova RPC, verificar clientes publicados e somente então endurecer o caminho legado e eventualmente retirar a RPC antiga. Antes da Fase A: confirmar backup restaurável, comparar schema real, revisar locks do índice/trigger, testar rollback em cópia ou janela controlada e solicitar aprovação explícita. Nenhuma fase foi executada no banco.

## Reconciliação e segurança

- As sete OS preventivas antigas estão individualizadas em `RECONCILIACAO_PREVENTIVAS_LEGADAS_2026-10-31.md`; não houve correção automática de ciclo ou vínculo. Duas OS da NETSECBR Demo compartilham ativo/plano/ano provável e exigem decisão humana antes de atribuir ciclos.
- A proposta de RLS para prestador e a avaliação individual das funções privilegiadas estão em `PROPOSTA_ACESSO_PRESTADOR_E_FUNCOES_PRIVILEGIADAS_2026-11-01.md`. Nenhuma policy foi alterada. `get_command_center_overview()` merece revisão prioritária: parece validar perfil ativo, mas não a linha ativa em `platform_access_roles`, diferentemente de `is_netsecbr_admin()`.

## Pendências e riscos

Persistência transacional de checklist, medições, fotos, revisão, assinatura e PDF; Storage privado e regras de acesso; aprovação vinculada ao ator autenticado e trilha imutável; definição de checklist real por plano; geração e entrega confiável de PDF; política de retenção e consentimento de assinatura; teste de concorrência e regressão em banco controlado. A migration não foi aplicada nem validada por execução SQL. Sem deploy, merge ou push.
