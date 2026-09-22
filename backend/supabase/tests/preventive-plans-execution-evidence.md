# Evidências — Planos Preventivos

## Resultado geral

- **Execução remota: NÃO realizada.** Nenhuma das três migrations foi aplicada no banco.
- **Motivo do bloqueio:** este ambiente não possui credencial de banco (sem senha, sem token de acesso, sem projeto linkado). A única chave disponível é a chave publicável do frontend, que não executa DDL.
- **A RPC de geração de OS NÃO foi executada com dados reais** (nada foi executado no banco).
- Nada foi corrigido automaticamente e nenhuma outra migration foi tocada.

## Data/hora da execução

- Tentativa registrada em: 2026-09-21 22:01 (America/Sao_Paulo, UTC-03:00).
- Execução efetiva das migrations: **não houve** (nenhum horário de aplicação a registrar).

## Ambiente / projeto

- Projeto Supabase do MARV (identificação omitida intencionalmente: sem URL, sem ref, sem chave e sem e-mail).
- Conexão utilizada: **nenhuma**.
- Ferramentas verificadas no ambiente: Node/npx presentes; `supabase` CLI disponível via `npx supabase@latest` (v2.117.0); `psql` ausente; `docker` ausente.
- Credenciais verificadas (todas ausentes): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`, `DATABASE_URL`, `PGPASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`; arquivo `~/.supabase/access-token` inexistente; `supabase/.temp` sem `project-ref`; projeto não linkado.
- `Frontend/.env.local`: contém apenas chave publicável (`VITE_*`), insuficiente para DDL. Nenhum valor foi registrado neste relatório.

## Migrations do escopo

| # | Migration | Resultado |
|---|---|---|
| 1 | `20260921100000_create_maintenance_plans.sql` | **não executada (bloqueada por ausência de credencial)** |
| 2 | `20260921101000_link_work_orders_to_maintenance_plans.sql` | **não executada (não iniciada)** |
| 3 | `20260921102000_create_preventive_work_order_rpc.sql` | **não executada (não iniciada)** |

## Verificações SQL preparadas (todas com resultado pendente)

### Após M1 — `maintenance_plans`

```sql
-- existência da tabela
select to_regclass('public.maintenance_plans') is not null as tabela_existe;

-- colunas, tipos e nulabilidade
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'maintenance_plans'
order by ordinal_position;

-- policies RLS
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'maintenance_plans'
order by policyname;

-- trigger de validação de escopo
select t.tgname, pg_get_triggerdef(t.oid) as definicao
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'maintenance_plans'
  and not t.tgisinternal
order by t.tgname;
```

### Após M2 — vínculo com a ordem de serviço

```sql
-- coluna de vínculo
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'work_orders'
  and column_name = 'source_maintenance_plan_id';

-- índice do vínculo
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'work_orders'
  and indexname = 'idx_work_orders_source_maintenance_plan';

-- trigger de validação de escopo do plano
select t.tgname, pg_get_triggerdef(t.oid) as definicao
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'work_orders'
  and t.tgname = 'work_orders_validate_maintenance_plan_scope';
```

### Após M3 — RPC de geração de OS preventiva

```sql
-- assinatura, security definer e search_path
select p.oid::regprocedure::text as assinatura,
       p.prosecdef as security_definer,
       coalesce(array_to_string(p.proconfig, ', '), '(sem proconfig)') as proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_preventive_work_order_from_plan';

-- ACL da função (entrada iniciada por "=" indica EXECUTE para PUBLIC)
select coalesce(array_to_string(p.proacl, ', '), '(ACL padrao: PUBLIC com EXECUTE)') as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_preventive_work_order_from_plan';

-- EXECUTE por papel
select has_function_privilege('anon', 'public.create_preventive_work_order_from_plan(uuid)', 'EXECUTE') as anon_pode_executar,
       has_function_privilege('authenticated', 'public.create_preventive_work_order_from_plan(uuid)', 'EXECUTE') as authenticated_pode_executar;
```

Todas as verificações acima estão **pendentes de execução**.

## Comandos preparados para execução (um por vez, na ordem)

```powershell
npx supabase db query --db-url "$env:SUPABASE_DB_URL" --file "backend/supabase/migrations/20260921100000_create_maintenance_plans.sql"
npx supabase db query --db-url "$env:SUPABASE_DB_URL" --file "backend/supabase/migrations/20260921101000_link_work_orders_to_maintenance_plans.sql"
npx supabase db query --db-url "$env:SUPABASE_DB_URL" --file "backend/supabase/migrations/20260921102000_create_preventive_work_order_rpc.sql"
```

Observação: `npx supabase db push` **não** deve ser usado agora, porque existem migrations anteriores ainda não rastreadas no histórico do projeto remoto; o `db query --file` aplica somente o arquivo indicado.

## git diff --check

- Comando: `git --no-pager diff --check`
- Código de saída: 0
- Saída: vazia (nenhum problema de whitespace e nenhum marcador de conflito)

## Arquivos alterados nesta tarefa

- Criado: `backend/supabase/tests/preventive-plans-execution-evidence.md` (este arquivo).
- Nenhuma migration foi alterada nesta tarefa; as três migrations do escopo seguem como arquivos locais não rastreados, criados na tarefa anterior.
- Nenhum arquivo de frontend alterado. Nenhum commit e nenhum push realizados.
- Resumo do `git status --short`: 13 arquivos modificados preexistentes no frontend, não tocados nesta tarefa, e 20 itens não rastreados (este arquivo de evidências + 3 migrations novas + 16 itens preexistentes: 11 migrations anteriores, `backup/`, `imagens/`, `supabase/`, um .docx de documentação e um PNG de marca).

## Observação final sobre a RPC

A função `public.create_preventive_work_order_from_plan(uuid)` **não foi executada** nesta tarefa. Nenhuma OS preventiva foi gerada e nenhum plano preventivo foi inserido com dados reais.

## Pré-requisito para concluir a tarefa

Para aplicar as migrations é necessário um destes caminhos:

1. Executar os três arquivos no SQL Editor do Supabase, rodando as verificações logo após cada um; ou
2. Disponibilizar uma connection string do banco (Session pooler, com senha) ou token de acesso + ref do projeto + senha, para execução via CLI com `db query --file`.