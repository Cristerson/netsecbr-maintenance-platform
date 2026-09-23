# Roteiro de Aceite — MVP V1 (MARV)

Este documento define **como validar o MVP V1 do MARV** antes de considerá-lo concluído.
Ele cobre somente o escopo congelado do V1. **Compras, estoque, catálogo de peças, part numbers, ERP operacional e IA não fazem parte deste aceite.**

## Como usar este roteiro

- Ambiente de teste: `http://localhost:5173` (frontend local conectado ao Supabase do projeto).
- Execute os cenários na ordem apresentada: os dados criados em um cenário alimentam os seguintes.
- Para cada cenário, marque **Aprovado** ou **Reprovado** e registre observações (o que aconteceu, em qual passo).
- A **captura de tela** indicada em cada cenário será usada no futuro **Manual de Operação do MVP V1**.
- Critério final: o MVP V1 é considerado validado quando **todos os cenários estiverem Aprovados** (reprovações devem ser registradas, corrigidas e revalidadas).

## Perfis utilizados nos testes

| Sigla | Perfil | Como obter |
|---|---|---|
| **AN** | Administrador NETSECBR | papel de plataforma `netsecbr_admin` ativo |
| **AC** | Administrador do cliente | vínculo `tenant_admin` ativo no tenant |
| **UN** | Usuário de navegação | vínculo `navigation` com permissões escolhidas no teste |

---

## 1. Login, troca obrigatória e recuperação de senha

- **Objetivo:** garantir acesso seguro, com troca obrigatória de senha temporária e recuperação por e-mail.
- **Perfil necessário:** todos (AN, AC, UN).
- **Pré-requisitos:** usuário ativo com credenciais válidas; para a troca obrigatória, um usuário criado com senha temporária (Cenário 2).
- **Passos de teste:**
  1. Acessar o sistema com e-mail e senha corretos.
  2. Tentar entrar com senha incorreta (deve falhar com mensagem genérica).
  3. Entrar com o usuário criado com senha temporária: o sistema deve exigir a criação de uma nova senha (mínimo de 10 caracteres, com confirmação) antes de qualquer uso.
  4. Após trocar a senha, entrar novamente com a nova senha.
  5. Usar "Esqueci minha senha", informar o e-mail, receber o link, definir a nova senha e entrar.
- **Resultado esperado:** acesso válido abre a Visão geral com o nome do cliente no menu lateral; senha inválida não entra; usuário com senha temporária não navega antes de trocá-la; após trocar, é pedido login novamente; recuperação por e-mail funciona até o novo login.
- **Impacto/rastreabilidade esperada:** perfil do usuário atualizado (troca obrigatória concluída e data da última troca de senha); nenhum dado operacional é alterado.
- **Aceite:** ☐ Aprovado ☐ Reprovado — Observações: ______________________
- **Captura de tela:** tela de login; tela "Crie uma nova senha"; Visão geral carregada.

## 2. Criação de usuário, permissões e senha temporária

- **Objetivo:** validar o cadastro de usuários do cliente, a atribuição de permissões e a redefinição por senha temporária.
- **Perfil necessário:** AC (e AN, para criar usuário em qualquer tenant — exige a Edge Function publicada).
- **Pré-requisitos:** domínio de e-mail autorizado para o tenant; login como administrador.
- **Passos de teste:**
  1. Configurações › Usuários e permissões › **Novo usuário**: nome, e-mail do domínio autorizado, senha inicial com 12+ caracteres, perfil "Navegação".
  2. Tentar cadastrar com e-mail de domínio não autorizado e com senha curta (deve ser recusado com mensagem).
  3. Abrir o usuário criado: marcar e desmarcar permissões (ex.: "Consultar ativos", "Abrir chamados") e confirmar a gravação.
  4. Usar **Redefinir senha**: gerar senha forte pelo MARV e copiar a senha exibida (ela não aparece novamente).
  5. Bloqueios: tentar desativar a própria conta; tentar redefinir a própria senha; desativar o último administrador ativo do cliente (todos devem ser bloqueados com mensagem clara).
  6. Ativar/desativar um usuário de teste e conferir o status na lista.
- **Resultado esperado:** usuário criado com troca obrigatória no primeiro acesso; permissões persistem; senha temporária exibida uma única vez; bloqueios funcionam; domínio não autorizado e senha curta são recusados.
- **Impacto/rastreabilidade esperada:** novo usuário no perfil e no vínculo do tenant; permissões vinculadas ao usuário; redefinição registra auditoria de senha temporária e volta a exigir troca no próximo acesso.
- **Aceite:** ☐ Aprovado ☐ Reprovado — Observações: ______________________
- **Captura de tela:** formulário de novo usuário; detalhe do usuário com permissões; tela da senha temporária.

## 3. Unidades, centros de custo e fornecedores

- **Objetivo:** validar a estrutura operacional básica usada por solicitações, OS e preventivas.
- **Perfil necessário:** AC.
- **Pré-requisitos:** login como administrador do cliente.
- **Passos de teste:**
  1. Configurações › Cadastros › **Unidades e centros de custo**: criar uma unidade com centro de custo; editar; inativar.
  2. **Fornecedores**: criar, editar e inativar um fornecedor.
  3. Abrir a tela de OS/solicitações e conferir as seleções de unidade e centro de custo.
- **Resultado esperado:** registros criados, editados e inativados com sucesso; unidade/fornecedor inativos deixam de aparecer nas novas seleções; não existe exclusão física.
- **Impacto/rastreabilidade esperada:** unidades, centros de custo e fornecedores do tenant; dados imediatamente disponíveis nas telas operacionais.
- **Aceite:** ☐ Aprovado ☐ Reprovado — Observações: ______________________
- **Captura de tela:** lista de unidades e centros de custo; formulário de fornecedor.

## 4. Ativos: cadastro, edição, ativação/desativação

- **Objetivo:** validar o ciclo completo do cadastro de ativos (robôs/equipamentos).
- **Perfil necessário:** AC (gerenciar); UN com permissão de consulta (somente leitura).
- **Pré-requisitos:** unidade e centro de custo cadastrados (Cenário 3); categoria de ativo quando aplicável.
- **Passos de teste:**
  1. Ativos › **Novo ativo**: preencher os dados, vincular unidade/centro de custo e salvar.
  2. Editar o ativo (ex.: nome, criticidade, status) e salvar.
  3. Desativar o ativo e verificar que ele sai das novas seleções; reativar.
  4. Entrar como UN com permissão apenas de consulta: a lista deve abrir sem botões de criação/edição.
- **Resultado esperado:** ativo criado, editado, ativado e desativado com sucesso; aparece no Dashboard, nas OS, nas solicitações e nas preventivas; perfil sem permissão de gerenciar vê a lista em modo de consulta.
- **Impacto/rastreabilidade esperada:** ativos do tenant (sem exclusão física); OS históricas mantêm o vínculo com o ativo.
- **Aceite:** ☐ Aprovado ☐ Reprovado — Observações: ______________________
- **Captura de tela:** lista de ativos; formulário do ativo.

## 5. Abertura de solicitação

- **Objetivo:** validar o registro de solicitações de manutenção pelo usuário de campo.
- **Perfil necessário:** UN com permissão "Abrir chamados" (e AC).
- **Pré-requisitos:** ativo, unidade e centro de custo cadastrados (Cenários 3 e 4).
- **Passos de teste:**
  1. Solicitações › **Nova solicitação**: título, categoria, prioridade, unidade, centro de custo, ativo (opcional) e descrição.
  2. Salvar e localizar a solicitação na lista.
  3. Conferir o detalhe (número, autor, data).
  4. Entrar com um usuário sem a permissão "Abrir chamados": o botão de nova solicitação não deve existir.
- **Resultado esperado:** solicitação criada com status "Aberta", número gerado, autor e data; sem a permissão, não há botão de abertura.
- **Impacto/rastreabilidade esperada:** solicitação registrada com solicitante e data; visível na lista como "Solicitada por …".
- **Aceite:** ☐ Aprovado ☐ Reprovado — Observações: ______________________
- **Captura de tela:** formulário de nova solicitação; lista com a solicitação aberta.

## 6. Triagem, estimativa e aprovação

- **Objetivo:** validar a análise do supervisor antes da geração de OS.
- **Perfil necessário:** AC.
- **Pré-requisitos:** solicitação "Aberta" (Cenário 5).
- **Passos de teste:**
  1. Abrir a solicitação como AC: conferir a seção **Triagem do supervisor** (invisível para UN).
  2. Tentar encaminhar sem preencher a triagem (deve ser bloqueado com mensagem).
  3. Preencher a triagem, as estimativas de serviços e materiais e salvar com status **Encaminhar para aprovação**.
  4. Conferir o total estimado exibido.
- **Resultado esperado:** solicitação fica "Em triagem" com notas e estimativas registradas; a triagem é obrigatória; UN não vê a seção e não consegue alterar a solicitação (detalhe somente leitura).
- **Impacto/rastreabilidade esperada:** solicitação com status de triagem, notas, valores estimados, autor e data da triagem.
- **Aceite:** ☐ Aprovado ☐ Reprovado — Observações: ______________________
- **Captura de tela:** seção de triagem preenchida; badge "Em triagem" na lista.

## 7. Conversão de solicitação em OS

- **Objetivo:** validar a aprovação da solicitação e a geração automática da OS.
- **Perfil necessário:** AC.
- **Pré-requisitos:** solicitação "Em triagem" (Cenário 6).
- **Passos de teste:**
  1. Abrir a solicitação em triagem e clicar em **Aprovar e criar OS**.
  2. Confirmar a operação.
  3. Localizar a solicitação na lista e a OS gerada em **Ordens de serviço**.
- **Resultado esperado:** OS criada e vinculada à solicitação; solicitação passa a "Convertida em OS" exibindo o número da OS; a OS herda os dados e aparece aberta na lista de OS.
- **Impacto/rastreabilidade esperada:** criação da OS pelo fluxo de aprovação; solicitação vinculada à OS gerada (rastreável nos dois lados).
- **Aceite:** ☐ Aprovado ☐ Reprovado — Observações: ______________________
- **Captura de tela:** solicitação convertida com "OS #número"; OS na lista de ordens de serviço.

## 8. Execução, classificação técnica, parada, custos e conclusão da OS

- **Objetivo:** validar o ciclo executivo da OS com diagnóstico, causa raiz, ação, recomendação, parada de equipamento e custos.
- **Perfil necessário:** AC.
- **Pré-requisitos:** OS aberta (Cenário 7).
- **Passos de teste:**
  1. Abrir a OS e alterar o status para **Em execução**.
  2. Preencher tipo de falha, diagnóstico técnico, causa principal, ação realizada/executada, recomendação e conclusão.
  3. Marcar **"Esta OS causou parada do equipamento"**: informar o início (obrigatório) e o fim da parada.
  4. Alterar para **Concluída** e confirmar.
  5. Reabrir a OS concluída como AC: preencher os **custos de serviços e materiais** (seção Validação do supervisor) e salvar.
- **Resultado esperado:** a conclusão exige as quatro classificações técnicas e o fim da parada (ou classificação "Condenado / perda total"); data e hora do fechamento são registradas; custos são salvos e o total da OS é exibido.
- **Impacto/rastreabilidade esperada:** OS com diagnóstico/causa/ação/recomendação e categorias, período de parada, custos e total — base para os relatórios da próxima etapa.
- **Aceite:** ☐ Aprovado ☐ Reprovado — Observações: ______________________
- **Captura de tela:** formulário da OS preenchido; resumo com custos e total.

## 9. Bloqueios de cancelamento, conclusão e reabertura

- **Objetivo:** garantir que OS concluídas ou canceladas não possam ser alteradas silenciosamente.
- **Perfil necessário:** AC.
- **Pré-requisitos:** uma OS concluída e uma OS aberta (Cenários 7 e 8).
- **Passos de teste:**
  1. Cancelar a OS aberta: o sistema deve exigir o **motivo** do cancelamento.
  2. Tentar alterar a OS cancelada depois (status e campos).
  3. Tentar alterar o status da OS concluída e tentar reabri-la.
- **Resultado esperado:** cancelamento sem motivo é impedido; OS concluída/cancelada tem o seletor de status desabilitado e o banco recusa tentativas de alteração com mensagem de erro, sem modificar os dados.
- **Impacto/rastreabilidade esperada:** motivo, autor e data do cancelamento registrados; integridade garantida pelas regras de governança da OS; nenhuma alteração silenciosa de histórico.
- **Aceite:** ☐ Aprovado ☐ Reprovado — Observações: ______________________
- **Captura de tela:** pedido de motivo do cancelamento; mensagem de erro ao tentar alterar OS concluída.

## 10. Plano preventivo: cadastro, ativação/desativação e geração de OS

- **Objetivo:** validar planos preventivos e a geração de OS preventiva.
- **Perfil necessário:** AC.
- **Pré-requisitos:** ativo cadastrado (Cenário 4).
- **Passos de teste:**
  1. Preventivas › **Nova preventiva**: ativo, atividade, periodicidade (1 a 3650 dias), próxima execução, responsável, situação e observações.
  2. Desativar o plano pelo detalhe e reativar.
  3. Em um plano ativo (pode usar data de próxima execução no passado para o cenário atrasado), clicar em **Gerar OS preventiva** e confirmar.
  4. Conferir a OS gerada em Ordens de serviço e a nova data de próxima execução do plano.
  5. Entrar como UN com permissão de consulta: a lista de planos deve abrir, o nome do plano não deve abrir edição e a lista não deve desaparecer.
- **Resultado esperado:** plano criado, editado, ativado/desativado; somente plano ativo gera OS; a geração cria uma OS preventiva vinculada, avança a próxima execução e exibe o número da OS; UN vê a lista em modo de consulta.
- **Impacto/rastreabilidade esperada:** planos preventivos do tenant; geração cria a OS e recalcula a próxima execução automaticamente (sem digitação manual de datas).
- **Aceite:** ☐ Aprovado ☐ Reprovado — Observações: ______________________
- **Captura de tela:** lista de planos com situações; detalhe do plano com os botões; OS preventiva gerada.

## 11. Dashboard: OS abertas, preventivas atrasadas e próximas preventivas

- **Objetivo:** validar os indicadores mínimos e a atualização automática ao retornar à Visão geral.
- **Perfil necessário:** qualquer usuário autenticado.
- **Pré-requisitos:** dados dos cenários anteriores (OS e planos ativos, inativos e atrasados).
- **Passos de teste:**
  1. Comparar o card **OS abertas** com a quantidade real de OS abertas (e o texto de críticas).
  2. Conferir **Preventivas atrasadas**: 0 → "Nenhuma preventiva atrasada"; 1 → "1 plano requer atenção"; mais de 1 → "X planos requerem atenção".
  3. Conferir **Próximas preventivas**: até 3 planos ativos por data, com rótulos Atrasada / Hoje / Amanhã / Em X dias; plano inativo não aparece.
  4. Gerar OS preventiva ou ajustar um plano em Preventivas e **voltar à Visão geral sem F5**: os cards devem refletir os dados atuais.
- **Resultado esperado:** números coerentes com as listas; plano inativo não entra na contagem de atrasadas; atualização automática ao retornar, sem recarregar a página.
- **Impacto/rastreabilidade esperada:** leitura dos dados do tenant (OS e planos); nenhuma escrita pelo Dashboard.
- **Aceite:** ☐ Aprovado ☐ Reprovado — Observações: ______________________
- **Captura de tela:** Visão geral completa (cards + painéis).

## 12. Perfis: administrador NETSECBR, administrador do cliente e usuário de navegação

- **Objetivo:** garantir que cada perfil vê e executa somente o que deve.
- **Perfil necessário:** AN, AC e UN.
- **Pré-requisitos:** os três usuários criados e ativos; UN com permissões parciais (ex.: apenas "Consultar ativos" e "Abrir chamados").
- **Passos de teste:**
  1. **AN**: conferir todos os menus (Visão geral, Ativos, Solicitações, OS, Preventivas, Configurações e **Control Center NETSECBR**) e o cadastro de usuário em um tenant.
  2. **AC**: conferir **Configurações**; o Command Center não pode aparecer.
  3. **UN**: conferir que só aparecem os menus liberados pelas permissões; abrir OS e solicitações (detalhe somente leitura); Preventivas em modo de consulta; **sem** Configurações e **sem** Command Center; Dashboard sem atalhos para módulos bloqueados.
  4. Conferir que nenhum perfil consegue acionar ações administrativas de outro perfil.
- **Resultado esperado:** menu e ações exatamente compatíveis com o perfil; tentativas fora do perfil são bloqueadas pela interface e, em último caso, pelo banco.
- **Impacto/rastreabilidade esperada:** papel da plataforma, vínculos do tenant e permissões por usuário; navegação sempre calculada por perfil, permissões e tenant.
- **Aceite:** ☐ Aprovado ☐ Reprovado — Observações: ______________________
- **Captura de tela:** menu lateral de cada um dos três perfis.

---

## Fora do aceite do MVP V1

Compras, estoque, catálogo de peças, part numbers, ERP operacional e IA/predição automática **não** fazem parte deste roteiro. Ideias sobre esses temas permanecem na V2 e não bloqueiam a conclusão do MVP.

## Resultado final do aceite

| Cenário | Situação (Aprovado/Reprovado) | Responsável | Data |
|---|---|---|---|
| 1. Login, troca obrigatória e recuperação de senha | | | |
| 2. Criação de usuário, permissões e senha temporária | | | |
| 3. Unidades, centros de custo e fornecedores | | | |
| 4. Ativos: cadastro, edição, ativação/desativação | | | |
| 5. Abertura de solicitação | | | |
| 6. Triagem, estimativa e aprovação | | | |
| 7. Conversão de solicitação em OS | | | |
| 8. Execução, classificação, parada, custos e conclusão | | | |
| 9. Bloqueios de cancelamento, conclusão e reabertura | | | |
| 10. Plano preventivo e geração de OS preventiva | | | |
| 11. Dashboard: OS abertas, atrasadas e próximas | | | |
| 12. Perfis e acessos | | | |

**MVP V1 validado quando todos os cenários estiverem marcados como Aprovado.**