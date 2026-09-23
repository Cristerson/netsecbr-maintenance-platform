# Evidência de teste — RPC do MARV Command Center

Objetivo: confirmar que `public.get_command_center_overview()` só responde a
`netsecbr_admin` ativo e nega qualquer outro perfil.

Aplicar antes o arquivo `migrations/20260922100000_create_command_center_overview_rpc.sql`.

## Como executar

No SQL Editor do Supabase, rode cada bloco em uma sessão com o usuário autenticado
correto (ou use `set local role authenticated;` + `set local request.jwt.claims`).
Registre o resultado da coluna `resultado` de cada caso.

```sql
-- Modelo de preparação de sessão para simular um usuário
-- set local role authenticated;
-- set local request.jwt.claims = '{"sub": "<uuid-do-usuario>", "role": "authenticated"}';
```

## Caso 1 — netsecbr_admin ativo consegue consultar

Pré-requisito: profile do chamador com `platform_role = 'netsecbr_admin'` e `is_active = true`.

```sql
select count(*) as clientes_retornados
from public.get_command_center_overview();
```

- Esperado: sem erro; retorna uma linha por cliente com os campos
  `tenant_id, legal_name, trade_name, document_number, tenant_status,
  tenant_created_at, active_users, asset_count, open_work_orders,
  overdue_preventive_plans`.
- Resultado observado: _(preencher)_
- Situação: ☐ Aprovado ☐ Reprovado

```sql
-- Conferência dos números agregados de um cliente específico
select *
from public.get_command_center_overview()
where document_number = '<cnpj-do-cliente>';
```

- Esperado: `asset_count` igual à quantidade de ativos ativos não excluídos,
  `open_work_orders` igual às OS em `open`, `in_progress` ou `waiting_material`
  e `overdue_preventive_plans` igual aos planos `is_active = true` com
  `next_due_date < current_date`.
- Resultado observado: _(preencher)_
- Situação: ☐ Aprovado ☐ Reprovado

## Caso 2 — administrador do cliente recebe negação

Pré-requisito: perfil com membership `tenant_admin` ativa (platform_role `tenant_user`).

```sql
select * from public.get_command_center_overview();
```

- Esperado: erro `Acesso negado ao Command Center.`
- Resultado observado: _(preencher)_
- Situação: ☐ Aprovado ☐ Reprovado

## Caso 3 — usuário de navegação recebe negação

Pré-requisito: perfil com membership `navigation` ativa.

```sql
select * from public.get_command_center_overview();
```

- Esperado: erro `Acesso negado ao Command Center.`
- Resultado observado: _(preencher)_
- Situação: ☐ Aprovado ☐ Reprovado

## Caso 4 — netsecbr_admin inativo recebe negação

Pré-requisito: profile com `platform_role = 'netsecbr_admin'` e `is_active = false`.

```sql
select * from public.get_command_center_overview();
```

- Esperado: erro `Acesso negado ao Command Center.`
- Resultado observado: _(preencher)_
- Situação: ☐ Aprovado ☐ Reprovado

## Caso 5 — sessão anônima é bloqueada

```sql
-- set local role anon;
select * from public.get_command_center_overview();
```

- Esperado: erro de permissão de execução (EXECUTE revogado de `public` e `anon`).
- Resultado observado: _(preencher)_
- Situação: ☐ Aprovado ☐ Reprovado
