# Arquitetura da Solução

## Direção

Começar com um monólito modular, bem separado por domínio, em vez de microserviços. Isso reduz complexidade, custo e risco no MVP; integrações futuras podem ser extraídas quando justificadas.

```text
React / Next.js (web)
        │ HTTPS
.NET API + aplicação de domínio
        ├── PostgreSQL
        ├── Armazenamento S3 (anexos)
        └── Serviço de e-mail/notificações
```

## Componentes previstos

- **Web:** React, Next.js e TypeScript.
- **Backend inicial:** Supabase Auth, Storage e Edge Functions para operações seguras de menor complexidade.
- **Backend alvo:** .NET, C#, API REST; SignalR somente para atualizações que realmente precisem de tempo real. Será adotado ao migrar para VPS, sem alteração no modelo de dados.
- **Banco:** PostgreSQL gratuito, com migrations versionadas e um único banco compartilhado no início.
- **Arquivos:** serviço compatível com S3; banco guarda metadados e referências.
- **Execução:** Docker Compose no desenvolvimento e containers em ambiente de produção.

## Hospedagem por fase

Na fase inicial, o frontend compilado será publicado como site estático no plano M da HostGator; Supabase hospeda PostgreSQL, autenticação, arquivos e funções de servidor. O plano M não hospeda o backend .NET. A evolução para VPS está detalhada em `17-Plano-de-Migracao-para-VPS.md`.

## Domínios iniciais

Identidade e acesso; organizações; estrutura de ativos; solicitações; ordens de serviço; manutenção preventiva; checklists; documentos; relatórios; auditoria.

## Estratégia multiempresa de dados

O MVP usará uma única instância e um único banco PostgreSQL. As tabelas de negócio carregam `tenant_id`; registros relacionados à operação carregam também `unit_id` e, quando aplicável, `cost_center_id`. A API sempre obtém o tenant do usuário autenticado, e o PostgreSQL aplicará políticas de segurança por linha como segunda barreira contra acesso entre clientes.

Essa opção mantém o custo inicial baixo e permite separar um cliente em banco próprio no futuro, caso porte, contrato ou requisitos de segurança justifiquem.

## Decisões abertas

- Provedor de hospedagem e e-mail.
- Estratégia de autenticação gerenciada versus implementação própria.
- Política de retenção de arquivos e auditoria.
- Necessidades reais de operação offline antes de construir o aplicativo.
