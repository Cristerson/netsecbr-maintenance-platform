# Relatório de Homologação — MVP V1 (MARV)

## Execução real com Playwright — 23/10/2026

### Preparação dos perfis autenticados e nova execução

Consulta `SELECT` no projeto principal `zhsutxrvjocamdyyrquy` confirmou os vínculos ativos: `adm@saint-gobain.com`, `castelanno@saint-gobain.com` e `matheus.serafim@saint-gobain.com` são `tenant_admin` (AC); `tecnico@saint-gobain.com` é `navigation` (UN), com `assets.read` e `service_requests.create` entre as permissões. Nenhum dos quatro é AN. `cristerson.castelanno@netsecbr.com.br` é um AN ativo (`netsecbr_admin`, owner). Todos esses perfis consultados têm `must_change_password = false` nesta data. Isso substitui, para o estado atual, a informação histórica sobre troca obrigatória nos usuários Saint-Gobain.

As variáveis exigidas são `MARV_AN_EMAIL`, `MARV_AN_PASSWORD`, `MARV_AC_EMAIL`, `MARV_AC_PASSWORD`, `MARV_UN_EMAIL`, `MARV_UN_PASSWORD`. O script `Frontend/scripts/run-e2e-readonly.ps1` solicita as credenciais no terminal, oculta as senhas, executa a suíte e remove as variáveis do processo. Nenhuma senha foi incluída no script, neste relatório ou nos logs.

**Nova execução:** sintaxe do script aprovada (`0` erros); as seis variáveis estavam ausentes neste processo. `npm --prefix Frontend run test:e2e` executou novamente: **2 passaram, 0 falharam, 3 skipped**. Os 3 testes autenticados **não foram executados** e não constituem evidência de login/permissões. O resultado estruturado e as capturas públicas em `.artifacts/` foram atualizados. A menor ação para liberar os testes AN/AC/UN é executar o script no terminal do VS Code e preencher as senhas válidas nos prompts, sem encaminhá-las por chat. Nenhum dado operacional foi modificado nesta rodada.

### Primeira execução autenticada informada pelo usuário

Saída do Playwright fornecida pelo usuário: **3 passaram, 2 falharam, 0 skipped**. O teste AN passou no login e na navegação até o cabeçalho do Command Center; as capturas `an-dashboard.png` e `an-command-center.png` confirmam isso. A captura do Command Center foi feita antes de seu conteúdo carregar, portanto **não comprova os dados do painel**. O teste AN foi reforçado para aguardar o card “Clientes” na próxima rodada.

AC falhou antes do Dashboard: o contexto exibiu mensagem de e-mail/senha inválidos, e a senha informada tinha apenas um caractere. UN falhou antes do Dashboard porque o campo de e-mail recebeu texto de um comando PowerShell, não um endereço. Essas falhas **não comprovam defeito de autenticação ou autorização do MARV**. Os erros PowerShell posteriores vieram de colar a transcrição de saída como se fosse comando.

Correção preventiva da suíte: o script agora rejeita e-mail malformado antes do teste; o teste limpa o campo de senha após enviar o login para que futuros contextos de falha não registrem seu valor. Dois `error-context.md` gerados com valores dos campos foram removidos da pasta de artefatos; as capturas aprovadas foram preservadas. O comando `--list` usado para validar a descoberta dos 5 testes sobrescreveu o `results.json` com uma listagem de 5 skipped; **esse JSON não representa a execução autenticada**. A evidência de resultado desta rodada é a saída fornecida pelo usuário e as capturas AN. Nenhum cenário oficial completo foi aprovado.

Foi instalada a dependência de desenvolvimento `@playwright/test` 1.64.1 e o Chromium correspondente. O comando reproduzível é `npm --prefix Frontend run test:e2e`, com o Vite já ativo em `http://localhost:5173`. A suíte está em `Frontend/tests/e2e/` e exclui compras. Não foram executados deploy, migration, SQL, commit ou push.

**Resultado efetivo:** 5 testes descobertos; **2 passaram, 0 falharam, 3 foram pulados** por ausência das variáveis locais de credenciais AN/AC/UN. O resultado estruturado está em `Frontend/tests/e2e/.artifacts/results.json` (pasta ignorada pelo Git). Evidências visuais dos testes aprovados:

- `Frontend/tests/e2e/.artifacts/run/public-01-·-login-público-carrega-sem-sessão/login-publico.png` — tela de login carregada com e-mail, senha e botão Entrar; resposta HTTP 200.
- `Frontend/tests/e2e/.artifacts/run/public-01-·-formulário-de-recuperação-abre-sem-enviar-e-mail/recuperacao-formulario.png` — formulário de recuperação aberto; retorno ao login verificado, sem envio de e-mail.

Os testes autenticados de navegação AN/AC/UN estão implementados, mas **não foram executados**; exigem credenciais de demonstração entregues por variáveis de ambiente locais. A suíte bloqueia requisições operacionais de escrita, inclusive a telemetria automática `record_tenant_access_activity`. O POST de login do Supabase é permitido e pode gerar sessão/log de Auth. Troca ou redefinição de senha, cadastro, triagem, aprovação, OS, preventiva e testes de escrita continuam fora desta execução.

**Aceite:** os 2 testes são verificações parciais do cenário 1. Nenhum dos 12 cenários oficiais está integralmente aprovado; a tabela de cenários abaixo permanece válida. A afirmação na seção histórica “Limitação desta execução” refere-se à análise documental anterior, não a esta rodada com Playwright.

Data: 23/10/2026. Escopo: núcleo operacional (compras excluídas). Ambiente confirmado: frontend local aponta para `https://zhsutxrvjocamdyyrquy.supabase.co` (projeto principal).

## Limitação desta execução

Esta sessão de agente não dispõe de navegador/interação com UI nem de sessões autenticadas reais de AN/AC/UN. Portanto, nenhum dos 12 cenários foi executado. Nenhum cenário foi marcado como APROVADO por leitura de código. Todos permanecem NÃO TESTADO.

## Resultado por cenário

| # | Cenário | Resultado | Evidência | Falha | Correção necessária | Pendente |
|---|---|---|---|---|---|---|
| 1 | Login, troca obrigatória e recuperação | NÃO TESTADO | `Frontend/src/auth-gate.tsx` | — | — | Sessão real AN/AC/UN |
| 2 | Criação de usuário, permissões e senha temporária | NÃO TESTADO | `user-admin.tsx`, `create-tenant-user` | — | — | Teste manual AC/AN |
| 3 | Unidades, centros de custo e fornecedores | NÃO TESTADO | `organization-admin.tsx`, `supplier-admin.tsx` | — | — | CRUD por AC |
| 4 | Ativos | NÃO TESTADO | `asset-admin.tsx` | — | — | Leitura restrita por UN |
| 5 | Abertura de solicitação | NÃO TESTADO | `service-request-admin.tsx` | — | — | Abrir com UN |
| 6 | Triagem e estimativa | NÃO TESTADO | `service-request-admin.tsx` + migration | — | — | Triagem obrigatória |
| 7 | Aprovação e conversão em OS | NÃO TESTADO | RPC `approve_service_request_and_create_work_order` | — | — | Aprovar em sessão AC |
| 8 | Execução, custos, parada e conclusão | NÃO TESTADO | `work-order-admin.tsx` | — | — | Transições |
| 9 | Bloqueios cancelamento/reabertura | NÃO TESTADO | migrations 20260914113000-115000 | — | — | Teste negativo |
| 10 | Preventivas e geração de OS | NÃO TESTADO | `preventive-plan-admin.tsx` + RPC | — | — | Criar/ativar plano |
| 11 | Dashboard | NÃO TESTADO | `main.tsx` | disponibilidade é placeholder | Delimitar indicador indisponível | Conferir contagens |
| 12 | Perfis e acessos | NÃO TESTADO | `main.tsx` + RLS | — | — | Três sessões + tentativas proibidas por API |

## Pendências que impedem liberação comercial

1. Execução dos 12 cenários com sessões reais AN/AC/UN no projeto principal.
2. Isolamento negativo por tenant e unidade (incluindo migration `20260928100000`).
3. Decisão de escopo sobre checklist/anexos.
4. Revisão de segurança da versão candidata.
5. Validação do fluxo comercial do Command Center.

## Conclusão

Ciclo operacional NÃO homologado. Nenhum cenário aprovado. Compras permanece preservado e fora do aceite. Nenhuma alteração de banco/commit/deploy realizada.

## Atualização de escopo documental — 02/11/2026

A diretriz consolidada de produto acrescentou os testes A1–A12 ao roteiro oficial, sem substituir seus 12 cenários originais. Esta atualização **não é uma nova execução de testes**: os resultados acima permanecem históricos, e nenhum cenário adicional foi marcado como aprovado. O código posterior ao relatório inclui plano no ativo, abas de OS e chamadas de persistência do checklist, mas isso não demonstra salvamento autenticado das atividades da Prensa 22 STW, inicialização da OS #50, fotos privadas, PDF final, aprovação ou assinatura persistidos.

Próxima coleta de evidências: registrar ambiente e perfil reais, salvar e recarregar o plano; inicializar a OS preventiva vazia; testar retomada, fotos/medições e isolamento; depois executar relatório, decisão do supervisor e aceite quando deixarem de ser simulações locais. Para cada cenário usar a situação Aprovado, Reprovado, Não executado ou Bloqueado e anexar resultado observado. O Vite chamado `staging` aponta atualmente ao Supabase principal, não a um banco isolado; qualquer teste de escrita requer dados controlados e autorização específica.
