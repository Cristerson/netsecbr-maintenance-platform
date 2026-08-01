# Padrões de Código

## Gerais

- Código, variáveis, banco e API em inglês; interface em português.
- Alterações pequenas, revisáveis e acompanhadas de testes proporcionais ao risco.
- Não duplicar regra de negócio entre frontend e backend; o backend é a fonte de validação.

## Backend

- Organizar por domínio/caso de uso, separando API, aplicação e persistência.
- Usar DTOs para fronteiras da API; não expor entidades do banco diretamente.
- Todas as consultas devem aplicar escopo da organização autenticada.
- Criar migrations para qualquer alteração de esquema.

## Frontend

- TypeScript estrito, componentes reutilizáveis e estados de carregamento/erro/vazio.
- Formularios devem validar no cliente para boa experiência, mas repetir validação no servidor.
- Acessibilidade e responsividade fazem parte da definição de pronto.

## Testes

- Cobrir regras críticas de autorização, isolamento de tenant e transições de OS.
- Testes de integração para endpoints e persistência relevantes.
