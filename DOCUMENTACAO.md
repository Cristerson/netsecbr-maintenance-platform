# Documentação do Projeto

Este arquivo explica como a NETSECBR Maintenance Platform será construída e documentada.

## Papel da IA

A IA atua como desenvolvedor principal e mentor técnico. Não deve apenas gerar código: explica a decisão técnica, a estrutura criada, dependências, como executar e boas práticas relevantes. A explicação será objetiva e apropriada para quem está aprendendo desenvolvimento.

## Método de entrega

Cada funcionalidade será feita em uma pequena entrega:

1. Objetivo e escopo.
2. Plano de implementação.
3. Confirmação do dono do produto quando houver impacto material.
4. Implementação limitada ao necessário.
5. Testes e validação.
6. Explicação do resultado e próximos passos.

Para mudanças de banco, a entrega também inclui uma migration versionada em `backend/supabase/migrations/` e um checklist de execução/validação quando necessário.

Configurações locais de integração, como URLs e chaves públicas de desenvolvimento, ficam em arquivos `.env.local` ignorados pelo Git. Chaves administrativas nunca são utilizadas no frontend.

Recuperação de senha é feita exclusivamente pelo Supabase Auth, por e-mail e com link temporário. A plataforma nunca consulta, armazena ou altera senhas diretamente no banco de dados.

Administradores podem iniciar uma redefinição para usuários ativos do próprio tenant pela Edge Function `manage-tenant-password`. A função valida identidade, escopo do tenant e registra auditoria. Após o usuário criar a nova senha, o campo `must_change_password` é removido e `password_changed_at` é atualizado. As origens CORS são explícitas; antes do deploy deve-se adicionar o domínio oficial da aplicação e nunca usar `*`.

O cadastro de novos usuários é executado pela Edge Function `create-tenant-user`. Ela valida a sessão do solicitante, confirma que ele é administrador ativo do tenant e cria a conta no Supabase Auth sem expor chaves administrativas ao navegador.

Cada tenant possui uma lista de domínios corporativos autorizados. O frontend não controla essa regra: a Edge Function consulta `tenant_email_domains` antes de criar a conta. A administração desses domínios é exclusiva do Control Center NETSECBR.

Unidades e centros de custo são administrados pelo tenant e não devem ser excluídos quando houver possibilidade de histórico operacional, financeiro ou de ativos. O padrão é desativação lógica por `is_active`.

O Painel Financeiro do Cliente é somente leitura. Ele consulta contrato, snapshots comerciais, franquias, faturas e pagamentos do próprio tenant. A emissão, alteração de preço, conciliação e baixa de pagamento serão executadas somente pelo Control Center e por integrações seguras de backend.

Consultas operacionais no frontend devem filtrar explicitamente pelo `tenant_id`, mesmo com RLS habilitado. Isso reforça o isolamento e melhora o desempenho das consultas.

Requisições de compra são sempre vinculadas a uma OS. A base replica tenant, unidade, centro de custo e ativo da ordem e um gatilho impede associações inconsistentes. O fornecedor é inicialmente apenas sugerido; aprovação, envio, recebimento e futuras integrações com ERP serão rastreados por status, sem envio automático ao fornecedor.

## Padrões

- Produto modular e SaaS, sem personalizações que alterem o núcleo.
- Estrutura de pastas e nomes claros.
- Clean Code, DRY e SOLID quando aplicável.
- Validação, tratamento de erros, segurança e desempenho desde o início.
- Mudanças relevantes documentadas em `CHANGELOG.md`.
- Evolução de produto acompanhada em `ROADMAP.md`.
- Commits pequenos e descritivos, por exemplo: `feat(clientes): cadastro inicial`.

## Documentos de referência

- `README.md`: visão geral e como iniciar o projeto.
- `PROJECT_RULES.md`: regras obrigatórias de produto e desenvolvimento.
- `ROADMAP.md`: fases e direção do produto.
- `documentação/`: requisitos, negócio, arquitetura, dados, comercial e infraestrutura.
