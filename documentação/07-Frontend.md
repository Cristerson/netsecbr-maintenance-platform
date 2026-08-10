# Frontend Web

## Diretrizes

- Interface em português do Brasil e linguagem clara, sem jargão desnecessário.
- Layout responsivo, priorizando desktop para gestão e tablet para campo.
- Navegação por contexto: o técnico deve chegar a uma OS em poucos passos.
- Status e criticidade devem ser informados por texto e ícone, não apenas por cor.

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
# Importação inicial

No MVP, a importação de ativos será feita por CSV UTF-8 exportado do Excel. O frontend validará colunas, códigos duplicados, unidade, categoria, criticidade e status antes de pedir confirmação para gravar. A leitura direta de `.xlsx` será implementada futuramente no backend, onde o processamento de arquivos poderá ser mais controlado.
