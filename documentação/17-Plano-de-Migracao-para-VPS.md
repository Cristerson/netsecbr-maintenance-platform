# Plano de Migração para VPS

## Objetivo

Começar com custo baixo usando HostGator Plano M e Supabase, mas manter o sistema preparado para mover a camada de backend para uma VPS sem reescrever o produto ou migrar o banco às pressas.

## Arquitetura inicial

```text
Usuário
  │
  ├── Frontend estático (HostGator Plano M)
  │
  └── Supabase
      ├── PostgreSQL
      ├── Auth
      ├── Storage
      └── Edge Functions
```

## Arquitetura após a migração

```text
Usuário
  │
  ├── Frontend estático (HostGator ou VPS)
  │
  ├── API .NET em containers (VPS)
  │   ├── regras de negócio
  │   ├── webhooks de pagamento
  │   ├── notificações
  │   └── integrações industriais e futuras
  │
  └── Supabase
      ├── PostgreSQL
      ├── Auth
      └── Storage
```

O banco poderá continuar no Supabase após a migração. VPS não significa, necessariamente, migrar banco e arquivos ao mesmo tempo.

## Regras para evitar retrabalho

1. Todo esquema PostgreSQL será criado por migrations versionadas em repositório.
2. O frontend não acessará tabelas críticas diretamente; usará uma camada de serviços/contratos de API desde o início.
3. Edge Functions terão contratos de entrada e saída documentados para reprodução posterior na API .NET.
4. Segredos ficam em variáveis de ambiente, nunca no frontend ou no GitHub.
5. Regras de tenant, inadimplência, permissões e auditoria ficam no banco e/ou servidor; não apenas em telas.
6. Arquivos serão acessados por URLs controladas e metadados no banco, evitando dependência de caminho físico da HostGator.

## Gatilhos para migrar

A NETSECBR deve iniciar a migração quando ocorrer qualquer um destes cenários:

- Necessidade de integrações industriais, filas, processamento em segundo plano ou SignalR.
- Lógica de cobrança e notificações exceder o que é confortável manter em Edge Functions.
- Crescimento de clientes, usuários simultâneos ou necessidade de SLA próprio.
- Exigência contratual de IP fixo, VPN, integrações locais ou controle maior de logs.
- Receita recorrente suficiente para custear VPS e monitoramento sem comprometer a margem.

## Checklist da migração

1. Contratar VPS com Linux, Docker, HTTPS, backup e acesso administrativo seguro.
2. Criar ambiente de homologação separado do ambiente de produção.
3. Criar API .NET e reproduzir contratos já usados pelo frontend.
4. Migrar uma função de cada vez: pagamentos, inadimplência, notificações e demais processos.
5. Configurar variáveis de ambiente e chaves do Supabase na VPS; nunca copiar chaves para o repositório.
6. Executar testes de isolamento por tenant, permissões, pagamentos e recuperação de falha.
7. Trocar o endpoint do frontend usando variável de ambiente, sem precisar gerar nova lógica de tela.
8. Monitorar logs e erros; manter plano de retorno ao fluxo anterior durante a janela de mudança.
9. Documentar a data, versões e resultado da migração.

## Futuro: migração também do banco

Somente considerar mover PostgreSQL e Storage para a VPS (ou serviço gerenciado próprio) quando custo, residência de dados, volume ou contrato justificarem. A migração deve seguir backup restaurável, teste de consistência, janela controlada e plano de reversão.
