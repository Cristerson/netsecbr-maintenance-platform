# Frontend Web

## Diretrizes

- Interface em português do Brasil e linguagem clara, sem jargão desnecessário.
- Layout responsivo, priorizando desktop para gestão e tablet para campo.
- Navegação por contexto: o técnico deve chegar a uma OS em poucos passos.
- Status e criticidade devem ser informados por texto e ícone, não apenas por cor.
- O técnico deve conseguir concluir tarefas frequentes com poucos toques, sem depender de terminologia administrativa.
- A aplicação deve usar um design system NETSECBR único; não são permitidos padrões visuais diferentes por módulo.

## Ambientes da aplicação

- **NETSECBR Command Center:** ambiente global, exclusivo da NETSECBR, para tenants, planos, cobrança, suporte e segurança.
- **Operações de Manutenção:** ambiente de cada cliente para executar e administrar a manutenção cotidiana.
- **Governança e Performance:** camada executiva futura do cliente, baseada nos dados operacionais rastreáveis.

Os menus são agrupados por contexto e permissão. No ambiente do cliente: Visão geral, Operações, Cadastros, Gestão e Administração. O Command Center não deve aparecer para usuários comuns de tenant.

## Telas do MVP

1. Login e recuperação de acesso.
2. Painel inicial com pendências e indicadores.
3. Lista e detalhe de ativos.
4. Abertura e triagem de solicitações.
5. Lista, detalhe e execução de OS.
6. Planos preventivos e calendário.
7. Modelos de checklist.
8. Usuários e permissões (administrador).
9. Administração de fornecedores.
10. Integrações e importações de dados.

## Administração de usuários

O administrador do cliente pode cadastrar usuários, ativar ou desativar acessos e atribuir permissões. A interface usa ações principais com texto e ícone, enquanto ações por linha usam ícones com dica de contexto. A criação chama uma Edge Function segura e respeita o domínio corporativo configurado para o tenant.

## Experiência de execução de OS

A tela deve apresentar ativo, prioridade, descrição, checklist, responsáveis, anexos e apontamento de tempo. O botão de concluir só aparece quando os requisitos da OS estiverem atendidos.

Rótulos devem usar perguntas e ações diretas, por exemplo: “O que aconteceu?”, “O que foi feito?”, “Máquina voltou a operar?”, “Adicionar foto”, “Gravar áudio” e “Solicitar peça”. Campos avançados aparecem apenas quando forem pertinentes ao perfil e à etapa do fluxo.

## Ditado assistido

O técnico pode registrar um relato por texto ou áudio. O áudio é usado apenas durante a transcrição: a plataforma apresenta um rascunho estruturado para revisão, e somente o texto aprovado é associado à OS. O registro persistido inclui autor, data/hora e origem por ditado; o áudio original é descartado após o processamento.
# Importação inicial

No MVP, a importação de ativos será feita por CSV UTF-8 exportado do Excel. O frontend validará colunas, códigos duplicados, unidade, categoria, criticidade e status antes de pedir confirmação para gravar. A leitura direta de `.xlsx` será implementada futuramente no backend, onde o processamento de arquivos poderá ser mais controlado.
