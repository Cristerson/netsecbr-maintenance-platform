# MARV — Manual de Operação MVP V1

**Maintenance & Automation Robotic Verification**

- **Público-alvo:** técnicos de fábrica, operadores, supervisores de manutenção e administradores.
- **Versão:** 1.0 — conteúdo-base do MVP V1 (cobrirá somente os fluxos já validados no Roteiro de Aceite).
- **Linguagem:** simples e direta, pensada para quem tem pouca familiaridade com sistemas.

---

## 1. Como usar este manual

### 1.1 Perfis de acesso

| Perfil | Quem é | O que vê no menu |
|---|---|---|
| **Administrador NETSECBR** | Equipe da NETSECBR que administra a plataforma | Todos os menus, inclusive **Control Center NETSECBR** e **Configurações** |
| **Administrador do cliente** | Supervisor ou gestor de manutenção do cliente | Todos os menus do dia a dia + **Configurações** (sem Control Center) |
| **Usuário de navegação** | Técnicos e operadores | Somente os menus liberados pelo administrador (ex.: Visão geral, Solicitações) |

O administrador do cliente decide o que cada pessoa pode ver e fazer. Se algo que você precisa não aparece no menu, fale com ele.

### 1.2 Legenda de botões e status

- **Botão azul (principal):** a ação principal da tela (ex.: Nova OS, Nova solicitação).
- **Botão cinza (secundário):** ações de apoio (ex.: Atualizar lista, Cancelar).
- **Link azul em listas:** clicar no nome ou número abre o detalhe.
- **Badges (etiquetas coloridas):** mostram a situação de cada item.

Status mais usados:

| Onde | Status |
|---|---|
| Solicitação | Aberta · Em triagem · Convertida em OS · Cancelada |
| Ordem de serviço | Aberta · Em execução · Aguardando material · Concluída · Cancelada |
| Prioridade | Baixa · Média · Alta · Crítica |
| Ativo | Status atual (ex.: operando, em manutenção, parado) e Ativo/Inativo |
| Plano preventivo | Ativo · Inativo · Atrasada |
| Próxima execução | Atrasada · Hoje · Amanhã · Em X dias |

### 1.3 Palavras que você vai ver

- **OS (Ordem de Serviço):** o registro do trabalho de manutenção, do início ao fim.
- **Chamado (solicitação):** o pedido de manutenção, antes de virar OS.
- **Triagem:** a análise do supervisor para decidir se o chamado vira OS.
- **Causa raiz:** a origem do problema (não só o sintoma).
- **Parada (downtime):** o tempo em que o equipamento ficou fora de produção.
- **Plano preventivo:** a tarefa que se repete a cada X dias para evitar quebras.
- **Cliente (tenant):** a empresa que usa o MARV. Cada cliente só vê seus próprios dados.

### 1.4 Regras de segurança

- **Sua senha é sua e só sua.** Nunca compartilhe com colegas, nem por mensagem.
- A primeira senha vem como **senha temporária**: o MARV exige que você crie uma senha nova no primeiro acesso.
- Se esquecer a senha, use **"Esqueci minha senha"** na tela de entrada.
- Ao sair do computador ou tablet compartilhado, clique em **Sair / trocar usuário**.

### 1.5 Como pedir ajuda

1. Fale primeiro com o **Administrador do cliente** (ele resolve permissões, cadastros e dúvidas do dia a dia).
2. Se o problema continuar, o administrador aciona o **suporte NETSECBR**.
3. Ao pedir ajuda, informe: em qual tela estava, o que clicou e a mensagem que apareceu.

[CAPTURA 1 — Tela de entrada do MARV com os campos de e-mail e senha e o botão "Entrar".]
[CAPTURA 2 — Menu lateral completo do Administrador do cliente, com todos os itens visíveis.]

---

## 2. Acessar o MARV: senha temporária, troca obrigatória e recuperação

### Para que serve
Entrar no MARV com segurança e proteger sua conta com uma senha que só você conhece.

### Quem pode usar
Todas as pessoas com conta criada pelo administrador.

### Antes de começar
- Ter em mãos o e-mail cadastrado.
- Se for o primeiro acesso, receber do administrador a **senha temporária** (12 ou mais caracteres).

### Caminho no menu
Tela de entrada do MARV (aparece antes do menu).

### Passo a passo — primeiro acesso
1. Abra o MARV no navegador.
2. Digite seu **e-mail** e a **senha temporária** recebida do administrador.
3. Clique em **Entrar**.
4. O MARV vai mostrar a tela **"Crie uma nova senha"**. Isso é obrigatório: enquanto você não trocar, não dá para usar o sistema.
5. Crie uma senha nova com **pelo menos 10 caracteres** e confirme.
6. Clique em **Salvar nova senha**. O MARV pede para entrar novamente com a senha nova.

### Passo a passo — esqueci minha senha
1. Na tela de entrada, clique em **Esqueci minha senha**.
2. Digite seu e-mail e clique em **Enviar link de recuperação**.
3. Abra o e-mail recebido e clique no link.
4. Crie a senha nova e entre com ela.

### Campos importantes e regras
- **Senha temporária:** tem no mínimo 12 caracteres. É provisória.
- **Nova senha:** mínimo de 10 caracteres. Use letras, números e símbolos.
- As senhas informadas nos dois campos precisam ser iguais.

### O que acontece depois
- Sua senha fica registrada com a data da troca.
- A senha temporária deixa de funcionar.

### Erros comuns e como agir
- **"E-mail ou senha inválidos"** → confira o e-mail e digite a senha novamente; senhas temporárias antigas não funcionam mais.
- **"Não foi possível enviar o link agora"** → aguarde um minuto e tente de novo.
- **Link expirado** → peça um novo link ou peça ao administrador uma nova senha temporária.

### Impacto no histórico e auditoria
- A troca de senha é registrada no seu perfil (data e hora).
- Redefinições feitas pelo administrador também ficam registradas.

[CAPTURA 3 — Tela "Crie uma nova senha" com os campos de nova senha e confirmação.]
[CAPTURA 4 — Tela "Recupere sua senha" com o campo de e-mail.]

---

## 3. Perfis e permissões: o que cada pessoa pode fazer

### Para que serve
Explicar as diferenças entre os três perfis e como o administrador libera o acesso de cada pessoa.

### Quem pode usar
A leitura é para todos; a configuração de permissões é do **Administrador do cliente**.

### Antes de começar
Saiba qual é o seu perfil: ele aparece no menu lateral, abaixo do nome do cliente.

### Caminho no menu
Configurações › Usuários e permissões (apenas administradores).

### O que cada perfil pode fazer

| Ação | Admin NETSECBR | Admin do cliente | Usuário de navegação |
|---|---|---|---|
| Ver Dashboard (Visão geral) | Sim | Sim | Sim |
| Ver Ativos | Sim | Sim | Se tiver permissão |
| Abrir solicitações | Sim | Sim | Se tiver permissão |
| Consultar OS | Sim | Sim | Se tiver permissão |
| Triagem e aprovação | Sim | Sim | Não |
| Editar e concluir OS | Sim | Sim | Não (só consulta) |
| Criar/editar planos preventivos | Sim | Sim | Não (só consulta) |
| Configurações (usuários, cadastros) | Sim | Sim | Não |
| Control Center NETSECBR | Sim | Não | Não |

### Passo a passo — liberar acesso para um colega (administrador)
1. Entre em **Configurações › Usuários e permissões**.
2. Clique no nome do usuário.
3. Marque as permissões que ele precisa (ex.: "Consultar ativos", "Abrir chamados").
4. As mudanças valem na próxima vez que ele abrir ou atualizar o MARV.

### O que acontece depois
O menu do usuário passa a mostrar exatamente o que foi liberado. Menus bloqueados não aparecem.

### Erros comuns e como agir
- **"Meu menu sumiu"** → o administrador pode ter ajustado as permissões. Fale com ele.
- **"Não consigo salvar"** → provavelmente a tela está em modo de consulta para o seu perfil. É intencional.

### Impacto no histórico e auditoria
Permissões concedidas e retiradas ficam registradas nos dados do vínculo do usuário.

[CAPTURA 5 — Menu lateral do Administrador NETSECBR, mostrando o item Control Center NETSECBR.]
[CAPTURA 6 — Menu lateral do Usuário de navegação, mostrando apenas os itens liberados.]

---

## 4. Cadastrar usuários e definir senha temporária

### Para que serve
Criar o acesso de novas pessoas da empresa e entregar uma senha segura quando alguém esquecer a atual.

### Quem pode usar
Administrador do cliente (e Administrador NETSECBR).

### Antes de começar
- Ter o **e-mail corporativo** da pessoa. O domínio do e-mail precisa estar autorizado para o cliente (ex.: @suaempresa.com.br).
- Decidir o perfil inicial: **Navegação** (acesso básico) ou **Administrador do cliente**.

### Caminho no menu
Configurações › Usuários e permissões › **Novo usuário**.

### Passo a passo — cadastrar usuário
1. Clique em **Novo usuário**.
2. Preencha **Nome completo**, **E-mail** e **Senha inicial** (mínimo de 12 caracteres).
3. Escolha o **Perfil inicial**.
4. Clique em **Cadastrar usuário**.
5. Avise a pessoa: no primeiro acesso ela deverá criar uma senha nova.

### Passo a passo — redefinir senha de alguém
1. Na lista, clique no nome do usuário.
2. Clique em **Redefinir senha**.
3. Escolha: **"MARV gera uma senha forte"** (recomendado) ou **"Definir uma senha temporária"** (mínimo de 12 caracteres).
4. Clique em **Definir senha temporária**.
5. **Copie a senha que aparecer e entregue à pessoa agora.** Ela não será exibida de novo.
6. Clique em **Concluído**. No próximo acesso, a pessoa cria uma senha nova.

### Passo a passo — ativar ou desativar usuário
1. Clique no nome do usuário na lista.
2. Clique em **Desativar usuário** (ou **Ativar usuário**).
3. Usuário desativado não entra mais no MARV, mas o histórico dele é mantido.

### Campos importantes e regras
- **Perfil inicial:** "Navegação" para técnicos e operadores; "Administrador do cliente" só para quem vai administrar.
- Você **não pode** desativar a sua própria conta nem redefinir a sua própria senha por aqui (o sistema bloqueia e explica).
- O **último administrador ativo** do cliente não pode ser desativado — isso protege o acesso da empresa.

### O que acontece depois
- O usuário novo recebe troca obrigatória de senha no primeiro acesso.
- A redefinição fica registrada na auditoria (ação "temporary password reset"), com autor e data.

### Erros comuns e como agir
- **"O domínio @... não está autorizado"** → o e-mail não é desse cliente. Confira o endereço ou peça ao suporte NETSECBR o cadastro do domínio.
- **"A senha inicial deve ter pelo menos 12 caracteres"** → crie uma senha maior.
- **"Perfil de usuário inválido"** → escolha entre Navegação e Administrador do cliente.

[CAPTURA 7 — Lista de usuários com o botão "Novo usuário" e o formulário de cadastro.]
[CAPTURA 8 — Detalhe do usuário com as permissões e o formulário de senha temporária.]

---

## 5. Unidades e centros de custo

### Para que serve
Organizar **onde** o trabalho acontece (unidades, como uma fábrica ou filial) e **para qual setor** o custo será lançado (centro de custo).

### Quem pode usar
Administrador do cliente.

### Antes de começar
Defina com a gestão os códigos e nomes oficiais das unidades e dos setores.

### Caminho no menu
Configurações › Cadastros › **Unidades e centros de custo**.

### Passo a passo — centro de custo
1. Clique em **Novo centro de custo**.
2. Preencha **Código** (curto, virá em maiúsculas, ex.: CC-PROD) e **Nome** (ex.: Produção – Linha 2).
3. Salve. Para editar, clique no lápis na linha do centro de custo.
4. Use o botão de energia para **ativar/desativar** um centro de custo (com confirmação). Inativo não aparece nas novas OS e chamados.

### Passo a passo — unidade
1. Clique em **Nova unidade**.
2. Vincule ao **centro de custo**, preencha **Código**, **Nome** (ex.: Fábrica Guarulhos), **Cidade**, **Estado** e **País** (padrão: Brasil).
3. Salve. Para editar, clique no lápis; para ativar/desativar, use o botão de energia.

### Campos importantes e regras
- Código e nome são obrigatórios; o código fica em letras maiúsculas.
- A unidade precisa de um centro de custo vinculado.

### O que acontece depois
Unidades e centros de custo ativos passam a aparecer nas solicitações, OS, ativos e preventivas.

### Erros comuns e como agir
- **Não consigo desativar** → confirme a mensagem de confirmação; se ainda falhar, anote a mensagem e fale com o suporte.
- **Centro de custo não aparece na OS** → ele pode estar inativo. Reative no cadastro.

[CAPTURA 9 — Tela de unidades e centros de custo com os formulários de cadastro.]

---

## 6. Fornecedores

### Para que serve
Guardar e manter atualizado o cadastro das empresas que fornecem peças ou serviços de manutenção.

### Quem pode usar
Administrador do cliente.

### Antes de começar
Tenha em mãos a razão social, o CNPJ (se houver) e um contato.

### Caminho no menu
Configurações › Cadastros › **Fornecedores**.

### Passo a passo — cadastrar fornecedor
1. Clique em **Novo fornecedor**. O formulário abre vazio, pronto para um cadastro novo.
2. Preencha **Razão social ou nome completo** (obrigatório), **Nome fantasia**, **CNPJ** (opcional), **E-mail**, **Telefone**, **Tipo de fornecimento** (Peças, Serviços ou Peças e serviços) e **Observações**.
3. Clique em **Cadastrar fornecedor**.

### Passo a passo — abrir e editar um fornecedor
1. Na lista, clique no **nome do fornecedor**. O detalhe abre com todos os dados preenchidos: razão social, nome fantasia, CNPJ, e-mail, telefone, tipo de fornecimento e observações.
2. Edite o que for preciso.
3. Clique em **Salvar alterações**. A lista volta exibindo os dados atualizados.
4. Use **Voltar para fornecedores** (ou **Cancelar**) para sair do detalhe sem salvar mudanças.

### Passo a passo — ativar ou desativar fornecedor
1. Clique no **nome do fornecedor** para abrir o detalhe.
2. Clique em **Desativar fornecedor** (ou **Ativar fornecedor**).
3. Essa ação existe **somente dentro do detalhe** — a lista fica limpa, sem botões soltos.

### Campos importantes e regras
- **Razão social ou nome completo:** obrigatório.
- **CNPJ:** opcional. Se informado, o MARV valida o número: só salva com CNPJ **vazio ou válido** — um CNPJ inválido **impede o salvamento**.
- **Tipo de fornecimento:** Peças, Serviços ou Peças e serviços.
- **Fornecedor inativo** aparece **acinzentado** na lista e deixa de ser sugerido nos fluxos.
- Para corrigir dados, **basta editar no detalhe**: não é preciso desativar e recadastrar o fornecedor.

### O que acontece depois
O fornecedor atualizado aparece na lista com nome, tipo de fornecimento e contato, já pronto para os próximos fluxos.

### Erros comuns e como agir
- **"Informe um CNPJ válido ou deixe o campo em branco."** → confira os 14 dígitos do CNPJ ou apague o campo para salvar sem CNPJ.
- **"Informe a razão social ou nome do fornecedor."** → o campo é obrigatório; preencha antes de salvar.
- **"Não foi possível salvar as alterações."** → anote a mensagem e fale com o suporte NETSECBR.

### Impacto no histórico e auditoria
O vínculo de fornecedor com compras/OS é uma evolução futura; hoje o cadastro serve de agenda oficial do cliente. A edição atualiza o registro do fornecedor no próprio cadastro — sem necessidade de recadastrar nada.

[CAPTURA 10 — Tela de fornecedores: lista com nomes clicáveis e o detalhe do fornecedor aberto para edição.]

---

## 7. Ativos: cadastrar, editar, ativar e desativar

### Para que serve
Manter o cadastro de cada robô e equipamento que o MARV acompanha. Toda solicitação, OS e preventiva precisa de um ativo (ou é vinculada a um).

### Quem pode usar
- **Administrador do cliente:** cadastrar, editar, ativar/desativar e excluir.
- **Usuário de navegação** com permissão "Consultar ativos": apenas ver a lista.

### Antes de começar
Tenha unidade, centro de custo e categoria prontos (Cenários de configuração acima).

### Caminho no menu
Menu **Ativos**.

### Passo a passo — cadastrar
1. Clique em **Novo ativo**.
2. Preencha os campos (veja abaixo) e clique em **Salvar ativo**.
3. O ativo aparece na lista e já pode ser usado em chamados, OS e preventivas.

### Passo a passo — editar, ativar/desativar e excluir
1. Clique no **nome do ativo** na lista.
2. Faça as alterações e salve.
3. **Desativar ativo / Ativar ativo:** define se o ativo está em uso no MARV. Ativo desativado não aparece nas novas seleções.
4. **Excluir ativo:** remove o ativo do uso (nada é apagado do histórico; as OS antigas continuam com o vínculo).

### Campos importantes e regras
- **Código** (obrigatório): identificação curta, ex.: ROB-001.
- **Nome do ativo** (obrigatório): ex.: Robô de solda ABB IRB 6700.
- **Categoria** (obrigatória): tipo do equipamento; categorias marcadas como "Robô" identificam robôs industriais.
- **Unidade** e **Centro de custo** (obrigatórios): onde o ativo opera e quem paga a manutenção.
- **Fabricante**, **Modelo**, **Número de série**: ajudam a identificar o equipamento.
- **Criticidade**: o quão grave é a parada desse ativo para a produção.
- **Status**: situação atual (ex.: operando, em manutenção, parado).
- **Data de instalação** e **Observações**: complementos úteis.

### O que acontece depois
- O ativo entra nas contagens do Dashboard (ex.: "Ativos em parada", "Saúde dos ativos").
- Ativos em parada ou em manutenção alimentam o card **"Ativos em parada"**.

### Erros comuns e como agir
- **Ativo não aparece na OS/chamado** → pode estar inativo ou de outra unidade. Reative ou confira o vínculo.
- **"Não foi possível salvar o ativo"** → confira os campos obrigatórios (com *) e a mensagem do sistema.

### Impacto no histórico e auditoria
- Exclusão é lógica: o histórico de OS do ativo é preservado.
- Mudanças de status refletem nos indicadores da Visão geral.

[CAPTURA 11 — Lista de ativos com busca e colunas de categoria, unidade, centro de custo, criticidade e status.]
[CAPTURA 12 — Formulário "Cadastro de ativo" com todos os campos preenchidos.]

---

## 8. Solicitações: abrir um chamado de manutenção

### Para que serve
Registrar um problema observado no equipamento **antes** de existir uma OS. É o pedido formal de manutenção.

### Quem pode usar
Usuário com permissão **"Abrir chamados"** (técnicos e operadores) e administradores.

### Antes de começar
Saiba qual ativo está com problema e em qual unidade/centro de custo ele está.

### Caminho no menu
Menu **Solicitações** › botão **Nova solicitação**.

### Passo a passo
1. Clique em **Nova solicitação**.
2. Escreva um **título** claro (ex.: "Vazamento de ar na garra do ROB-001").
3. Escolha a **categoria** (Mecânica, Elétrica, Software/Controlador etc.) e a **prioridade**.
4. Selecione a **unidade** — o centro de custo aparece junto — e o **ativo** (opcional).
5. Escreva a **descrição**: o que aconteceu, quando, com que frequência.
6. Clique em **Abrir solicitação**.
7. Para conferir depois, clique no número da solicitação na lista.

### Campos importantes e regras
- **Título**: mínimo de 3 caracteres; seja específico.
- **Prioridade**: Baixa, Média, Alta ou Crítica. Seja honesto: o supervisor usa isso na triagem.
- **Descrição**: quanto mais informação, mais rápida a triagem.

### O que acontece depois
- A solicitação fica com status **"Aberta"** e entra na fila do supervisor.
- Ela aparece na lista com "Solicitada por [seu nome]" e a data.

### Erros comuns e como agir
- **"Selecione uma unidade"** → a unidade é obrigatória; escolha na lista.
- **"O título precisa ter pelo menos 3 caracteres"** → escreva um título um pouco mais longo.
- **Botão "Nova solicitação" não aparece** → seu perfil não tem a permissão "Abrir chamados". Fale com o administrador.

### Impacto no histórico e auditoria
Toda solicitação guarda autor e data — o chamado nunca é anônimo.

[CAPTURA 13 — Lista de solicitações com o botão "Nova solicitação".]
[CAPTURA 14 — Formulário de nova solicitação preenchido.]

---

## 9. Triagem: analisar, estimar e aprovar o chamado

### Para que serve
O supervisor analisa o chamado, estima o custo e decide se ele vira uma OS. É o filtro que evita trabalhos sem prioridade.

### Quem pode usar
Administrador do cliente (a seção de triagem não aparece para usuários de navegação).

### Antes de começar
Tenha uma solicitação "Aberta" e, se possível, converse com quem abriu o chamado.

### Caminho no menu
Menu **Solicitações** › clique no número da solicitação.

### Passo a passo
1. Abra a solicitação. Role até a seção **Triagem do supervisor**.
2. Escreva a **Triagem do supervisor** (obrigatória): sua avaliação inicial, impacto e justificativa.
3. Preencha as **estimativas**: serviços (R$) e materiais (R$). O total estimado aparece na tela.
4. Em **Status da solicitação**, escolha **Encaminhar para aprovação**.
5. Clique em **Salvar alterações**.
6. A solicitação passa a **"Em triagem"**, pronta para a aprovação.

### Campos importantes e regras
- A triagem é **obrigatória** para encaminhar — é ela que documenta a decisão.
- Estimativas são números positivos; deixe em branco se ainda não houver valor.
- Cancelar a solicitação também é possível aqui (status **Cancelar solicitação**).

### O que acontece depois
A solicitação "Em triagem" pode ser convertida em OS (próximo capítulo).

### Erros comuns e como agir
- **"Informe a triagem do supervisor"** → preencha o campo de triagem antes de salvar.
- **"Não foi possível atualizar a solicitação"** → seu perfil não permite edição de triagem (somente administradores).

### Impacto no histórico e auditoria
A solicitação guarda quem fez a triagem, quando, as notas e os valores estimados — a decisão fica documentada.

[CAPTURA 15 — Seção "Triagem do supervisor" com notas e estimativas preenchidas.]

---

## 10. Aprovar: converter a solicitação em OS

### Para que serve
Transformar o chamado aprovado em uma **Ordem de Serviço** para executar o trabalho.

### Quem pode usar
Administrador do cliente.

### Antes de começar
Solicitação com status **"Em triagem"** e estimativas preenchidas.

### Caminho no menu
Menu **Solicitações** › abrir a solicitação em triagem.

### Passo a passo
1. Abra a solicitação em triagem.
2. Clique em **Aprovar e criar OS**.
3. Confirme a operação.
4. O MARV mostra o número da OS criada e a solicitação passa a **"Convertida em OS"**.
5. A OS aparece no menu **Ordens de serviço**, com os dados do chamado.

### O que acontece depois
- A solicitação não aceita mais alterações de status — ela virou histórico do chamado.
- A OS segue o fluxo do próximo capítulo.

### Erros comuns e como agir
- **Botão não aparece** → a solicitação precisa estar "Em triagem" (não "Aberta", nem já convertida).
- **"Não foi possível criar a ordem de serviço"** → anote a mensagem e fale com o suporte.

### Impacto no histórico e auditoria
A solicitação guarda o número da OS em que foi convertida — rastreio completo do chamado ao serviço.

[CAPTURA 16 — Solicitação em triagem com o botão "Aprovar e criar OS" em destaque.]

---

## 11. Executar a OS: apontamentos técnicos

### Para que serve
Registrar o trabalho: o que foi feito, por quê, o que causou o problema e se houve parada do equipamento. Esses apontamentos são o patrimônio técnico da empresa.

### Quem pode usar
Administrador do cliente (neste MVP, os apontamentos e a conclusão são feitos pelo supervisor; execução direta pelo técnico é uma evolução futura).

### Antes de começar
Tenha a OS aberta e as informações do atendimento em mãos.

### Caminho no menu
Menu **Ordens de serviço** › clique no número da OS.

### Passo a passo
1. Abra a OS. Para criar uma OS direto (sem chamado), use **Nova OS**.
2. Altere o status para **Em execução** quando o trabalho começar.
3. Preencha os apontamentos técnicos:
   - **Tipo de falha** (diagnóstico): Mecânica, Elétrica, Comunicação/Rede, Trajetória/Calibração, Segurança/Periférico ou Outro;
   - **Diagnóstico técnico**: o que você identificou;
   - **Causa principal** (causa raiz): a origem do problema;
   - **Ação realizada** e **Ação executada**: o que foi feito;
   - **Recomendação** e **Conclusão e recomendações**: orientações para o futuro.
4. Se a OS **causou parada do equipamento**, marque a caixa **"Esta OS causou parada do equipamento"** e informe o **Início** (obrigatório) e o **Fim** da parada.
5. Clique em **Salvar alterações**.

### Campos importantes e regras
- Unidade e centro de custo são obrigatórios — é para onde o custo vai.
- O **responsável** pode ser atribuído na OS (lista de usuários do cliente).
- A parada só aparece quando o ativo está vinculado à OS.

### O que acontece depois
- Com os apontamentos completos, a OS pode ser concluída (próximo capítulo).
- AOS depois de concluída, ninguém consegue alterar o histórico.

### Erros comuns e como agir
- **"Não foi possível atualizar a ordem de serviço"** → confira os campos obrigatórios; se persistir, anote a mensagem para o suporte.
- **Campos cinza (não editáveis)** → a OS está em detalhe somente leitura para o seu perfil, ou já está concluída/cancelada.

### Impacto no histórico e auditoria
Os apontamentos ficam guardados na OS para sempre: diagnóstico, causa raiz, ação, recomendações e tempo de parada. Eles alimentam os relatórios e a Governança e Performance (fase futura).

[CAPTURA 17 — Formulário da OS com os apontamentos técnicos (diagnóstico, causa, ação, recomendação).]
[CAPTURA 18 — Bloco "Esta OS causou parada do equipamento" com início e fim da parada.]

---

## 12. Custos finais da OS

### Para que serve
Registrar o valor real do atendimento (serviços e materiais). É desse dado que saem os relatórios de custo por ativo, setor e cliente.

### Quem pode usar
Administrador do cliente. A seção só aparece quando a OS está **Concluída**.

### Antes de começar
Tenha os valores consolidados do atendimento (nota do fornecedor, horas internas etc.).

### Caminho no menu
Menu **Ordens de serviço** › abrir a OS concluída.

### Passo a passo
1. Abra a OS concluída.
2. Localize a seção **Validação do supervisor — Custos da OS**.
3. Preencha **Serviços (R$)** e **Materiais (R$)**. Somente valores consolidados.
4. Clique em **Salvar alterações**. O **Total da OS** aparece na tela.

### Campos importantes e regras
- Use números normais (ex.: 1500,50). O MARV converte para centavos internamente.
- Custos são do supervisor: usuários de navegação não veem nem digitam valores.

### O que acontece depois
O custo total fica registrado na OS e passa a fazer parte do histórico do ativo e do centro de custo.

### Erros comuns e como agir
- **"Informe valores válidos para serviços e materiais"** → digite apenas números (sem letras ou símbolos).
- **Seção de custos não aparece** → a OS precisa estar concluída e o acesso é de administrador.

### Impacto no histórico e auditoria
Custos finais ficam gravados na OS (serviços, materiais e total) e não podem ser alterados silenciosamente depois.

[CAPTURA 19 — Seção "Validação do supervisor: Custos da OS" com valores e total.]

---

## 13. Concluir, cancelar e entender os bloqueios

### Para que serve
Fechar o trabalho de forma segura. Uma OS concluída ou cancelada **não pode mais ser alterada** — isso protege o histórico e a confiança nos relatórios.

### Quem pode usar
Administrador do cliente.

### Antes de começar
Para concluir: apontamentos técnicos completos (Cenário 11).
Para cancelar: tenha claro o motivo — ele será registrado.

### Caminho no menu
Menu **Ordens de serviço** › abrir a OS.

### Passo a passo — concluir
1. Abra a OS em andamento.
2. No campo **Status**, escolha **Concluída**.
3. Clique em **Salvar alterações**.
4. O MARV pede confirmação: **"Confirmar a conclusão desta OS?"** — a data e hora atuais serão o fechamento.
5. Confirme. Se faltar alguma classificação técnica ou o fim da parada, o MARV avisa antes de concluir.

### Passo a passo — cancelar
1. Abra a OS.
2. No **Status**, escolha **Cancelada**.
3. Ao salvar, o MARV pergunta o **motivo do cancelamento**. Sem motivo, não cancela.
4. Informe o motivo e confirme.

### Regras de bloqueio (importante!)
- OS **concluída**: o seletor de status fica desabilitado. Ela não volta para "Em execução".
- OS **cancelada**: mesmo comportamento. Não é possível reabrir.
- Tentativas de alterar esses registros são recusadas pelo sistema — isso é proposital e protege a empresa.
- Se algo precisa ser corrigido depois da conclusão, registre uma **nova OS** referenciando o número antigo.

### O que acontece depois
- OS concluída recebe data/hora de fechamento e libera o preenchimento de custos (Cenário 12).
- OS cancelada mostra o motivo, quem cancelou e quando.

### Erros comuns e como agir
- **"Informe o tipo de falha, a causa principal..."** → complete as classificações antes de concluir.
- **"Informe o fim da parada antes de concluir"** → preencha o fim da parada (ou classifique como "Condenado / perda total").
- **"O cancelamento exige um motivo"** → escreva o motivo na janela que aparece.

### Impacto no histórico e auditoria
Fechamento, cancelamento e reabertura bloqueada são gravados na OS (quem, quando e por quê). O histórico nunca é apagado.

[CAPTURA 20 — Janela de confirmação de conclusão e o pedido de motivo do cancelamento.]

---

## 14. Planos preventivos e geração de OS preventiva

### Para que serve
Programar tarefas que se repetem (ex.: lubrificação a cada 30 dias) e gerar as OS na hora certa. Prevenir custa menos que quebrar.

### Quem pode usar
- **Administrador do cliente:** criar, editar, ativar/desativar e gerar OS preventiva.
- **Usuário de navegação:** apenas consultar a lista.

### Antes de começar
Tenha o ativo cadastrado e defina a periodicidade com a equipe.

### Caminho no menu
Menu **Preventivas**.

### Passo a passo — cadastrar plano
1. Clique em **Nova preventiva**.
2. Selecione o **Ativo**, escreva a **Atividade** (ex.: "Lubrificação dos redutores do eixo 3").
3. Informe a **Periodicidade em dias** (1 a 3650) e a **Próxima execução**.
4. Se quiser, defina o **Responsável** e as **Observações** (instruções, EPIs, itens de inspeção).
5. Confira a **Situação** (Ativo ou Inativo) e salve.

### Passo a passo — ativar/desativar
1. Clique no nome do plano na lista (somente administradores).
2. Use o botão **Desativar plano** ou **Ativar plano** e confirme.
3. Plano inativo não gera OS e aparece como "Inativo" na lista.

### Passo a passo — gerar a OS preventiva
1. Abra um plano **ativo**.
2. Clique em **Gerar OS preventiva** e confirme.
3. O MARV cria a OS, mostra o número dela e **avança automaticamente a próxima execução** do plano (com base na periodicidade).
4. A OS preventiva aparece em Ordens de serviço e segue o fluxo normal de execução.

### Campos importantes e regras
- **Periodicidade:** número inteiro de dias entre 1 e 3650.
- **Próxima execução:** data obrigatória no cadastro; depois, o MARV recalcula sozinho a cada geração.
- **Situação "Atrasada"** aparece na tela quando a data passou e o plano está ativo — o MARV nunca grava "atrasada" no banco; é um cálculo do dia.
- Só plano **ativo** gera OS. O botão não aparece em plano inativo.

### O que acontece depois
- O Dashboard mostra o plano nas **Próximas preventivas** e, se vencido, no card de **atrasadas**.
- Gerada a OS, a próxima execução muda e o plano sai da fila de atrasadas.

### Erros comuns e como agir
- **"Não foi possível gerar a OS preventiva"** → anote a mensagem e tente novamente; se persistir, fale com o suporte.
- **Botão "Nova preventiva" não aparece** → seu perfil é de consulta (usuário de navegação).
- **Plano com data no passado** → ele aparece como "Atrasada"; gere a OS para atualizar a data.

### Impacto no histórico e auditoria
Cada plano guarda criado em/atualizado em e o vínculo com as OS geradas. A data da próxima execução é sempre calculada pela regra do plano — sem edição manual escondida.

[CAPTURA 21 — Lista de preventivas com as situações Ativo, Inativo e Atrasada.]
[CAPTURA 22 — Detalhe do plano com os botões "Gerar OS preventiva" e "Ativar/Desativar plano".]

---

## 15. Dashboard (Visão geral): o resumo do dia

### Para que serve
Ver num só lugar o que precisa de atenção: OS abertas, preventivas atrasadas, ativos parados e as próximas preventivas.

### Quem pode usar
Todas as pessoas com acesso ao MARV. É a primeira tela após o login.

### Caminho no menu
Menu **Visão geral** (abre automaticamente ao entrar).

### O que cada parte mostra

- **OS abertas:** quantidade de OS em aberto, com destaque para as críticas.
- **Preventivas atrasadas:** planos ativos com a data vencida.
  - 0 → "Nenhuma preventiva atrasada";
  - 1 → "1 plano requer atenção";
  - mais de 1 → "X planos requerem atenção".
- **Ativos em parada:** quantos equipamentos estão parados ou em manutenção (de um total).
- **Ordens prioritárias:** as OS mais importantes no momento.
- **Próximas preventivas:** os 3 planos ativos mais próximos, com rótulo **Atrasada**, **Hoje**, **Amanhã** ou **Em X dias** e a data.
- **Saúde dos ativos:** quantos estão operando, em manutenção e parados.

### Passo a passo — usar o Dashboard no dia a dia
1. Abra a Visão geral ao começar o turno.
2. Olhe **Preventivas atrasadas** e **Ordens prioritárias** primeiro.
3. Use os botões **"Ver ordens de serviço"**, **"Ver todas"** e **"Ver preventivas"** para ir direto às listas (eles só aparecem se você tiver acesso àquele menu).
4. Após concluir ou gerar algo, volte à Visão geral: **os dados se atualizam sozinhos, sem apertar F5**.

### Regras importantes
- Plano **inativo** não entra na contagem de atrasadas.
- Os indicadores consideram apenas os dados do seu cliente — ninguém vê dados de outra empresa.

### O que acontece depois
As ações corretas (concluir OS, gerar preventiva) fazem os indicadores melhorarem com o tempo.

### Erros comuns e como agir
- **"Carregando dados do cliente…"** → aguarde alguns segundos; é a busca das informações.
- **Mensagem de erro ao carregar** → confira a internet; ao navegar de novo, os dados retornam.

### Impacto no histórico e auditoria
O Dashboard é somente leitura: ele mostra, mas não altera registros.

[CAPTURA 23 — Visão geral completa: cards "OS abertas" e "Preventivas atrasadas", painéis "Ordens prioritárias" e "Próximas preventivas", e "Saúde dos ativos".]

---

## 16. O que fica para as próximas versões

Os temas abaixo **não fazem parte do MVP V1** e por isso não têm instruções neste manual. São evoluções já previstas no roadmap:

- **Compras e requisições de materiais** ligadas às OS.
- **Estoque e catálogo de peças** (part numbers).
- **Integração com ERP** corporativo.
- **IA e predição automática** de falhas.
- **Integrações avançadas** (e-mail corporativo, APIs públicas, conectores industriais).
- Aplicativo de campo (Android), QR Code, fotos e ditado com transcrição.

Além disso, as áreas **Identidade visual**, **Painel Financeiro** e **Integrações e importações** (dentro de Configurações) existem no menu e serão detalhadas no manual quando entrarem no escopo validado.

---

## 17. Regras de ouro do MARV

1. **Tudo fica registrado:** quem abriu, quem aprovou, quem executou, quando e por quê.
2. **Aprovação antes da execução:** chamado → triagem → OS. Sem pular etapas.
3. **Histórico é sagrado:** OS concluída ou cancelada não muda. Correção se faz com nova OS.
4. **Cada um no seu papel:** o menu mostra só o que o seu perfil pode fazer — e o banco de dados confirma.
5. **Sem senha compartilhada:** conta é de pessoa, não de setor.

## 18. Lista de capturas de tela (para montar a versão final)

1. Tela de entrada do MARV
2. Menu lateral do Administrador do cliente
3. Tela "Crie uma nova senha"
4. Tela "Recupere sua senha"
5. Menu lateral do Administrador NETSECBR
6. Menu lateral do Usuário de navegação
7. Lista de usuários e formulário "Novo usuário"
8. Detalhe do usuário (permissões + senha temporária)
9. Unidades e centros de custo
10. Fornecedores (lista com nomes clicáveis e detalhe de edição)
11. Lista de ativos
12. Formulário "Cadastro de ativo"
13. Lista de solicitações
14. Formulário de nova solicitação
15. Seção "Triagem do supervisor"
16. Botão "Aprovar e criar OS"
17. Apontamentos técnicos da OS
18. Bloco de parada do equipamento
19. "Validação do supervisor: Custos da OS"
20. Confirmação de conclusão e motivo do cancelamento
21. Lista de preventivas (situações)
22. Detalhe do plano preventivo (geração de OS)
23. Visão geral completa (Dashboard)

---

*Fim do Manual de Operação — MARV MVP V1. Documento de conteúdo-base: as capturas serão inseridas na versão final, após o aceite do Roteiro de Aceite MVP V1.*