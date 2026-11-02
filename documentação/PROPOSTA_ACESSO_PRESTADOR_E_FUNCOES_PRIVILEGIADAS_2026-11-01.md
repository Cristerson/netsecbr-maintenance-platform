# Proposta local de segurança — prestador externo e funções privilegiadas

**Não aplicada.** Baseada em catálogo, policies e definições de função consultados somente em leitura no projeto `zhsutxrvjocamdyyrquy`. Não contém autorização para alterar RLS remoto.

## Prestador externo: não reutilizar membership comum

Hoje `is_tenant_member(tenant_id)` retorna verdadeiro para qualquer membership ativo. `user_can_access_unit(unit_id)` aceita `units_access_all=true`; todos os 13 vínculos observados no inventário têm esse valor. Um usuário `navigation` criado para um prestador poderia ler/editar OS da unidade e alcançar outras tabelas com policy por tenant. Esconder menus não corrige isso.

Proposta para uma etapa futura:

1. Usuário externo individual no Supabase Auth, perfil próprio, **sem** `tenant_memberships` padrão. Convite por Edge Function específica, autorizada pelo admin do tenant; não compartilhar senha, não exigir domínio corporativo do cliente industrial para prestador externo. Expiração/revogação explícitas.
2. Tabela `external_work_order_assignments` com `tenant_id`, `work_order_id`, `user_id`, `granted_by`, `granted_at`, `expires_at`, `is_active`; FK/validação de que a OS pertence ao tenant. RLS: usuário vê somente suas atribuições ativas; admin do tenant administra por RPC auditada. `anon` sem grants.
3. Policy adicional **somente de SELECT** em `work_orders` para OS atribuída, usando `auth.uid()` e atribuição ativa. Policies correspondentes em `assets` e `units` expõem apenas ativo/unidade da OS atribuída. Não dar policy geral de `UPDATE` no registro da OS: checklist/relatório seriam escritos por RPCs estreitas que validam atribuição, estado e versão. Não expor todo o plano; entregar snapshot das atividades vinculadas à OS.
4. Ajustar `auth-gate`/navegação para perfil externo e consultar apenas atribuições próprias. Bloquear Command Center, administração, solicitações, contratos, cobrança e relatórios de outros ativos. Revisar **todas** as policies que usam `is_tenant_member`, `user_can_access_unit` ou comparação direta com `tenant_memberships` antes de convidar alguém.
5. Storage privado de evidências (bucket novo somente com aprovação): caminho com tenant/OS/atividade e objeto imutável; policies de upload/leitura vinculadas à atribuição, MIME/tamanho validados no servidor e sem URL pública permanente. Documento final e assinatura com regras próprias e registro de integridade.
6. Testes com dois JWTs reais de técnicos e dois tenants: atribuído permitido; outra OS, outro ativo, outra unidade e outro tenant negados em Data API e Storage. Testar revogação e token ainda válido. Não usar `service_role` para simular técnico.

Essa proposta evita enfraquecer as policies de membros internos; exige nova migration, mudanças de Auth/Edge Function e homologação antes de uso real.

## Advisories `SECURITY DEFINER`: avaliação individual

O linter sinaliza **10 funções executáveis por `anon`** e **17 por `authenticated`**. `EXECUTE` concedido não significa, por si só, vazamento explorável; a assinatura, o corpo e os checks foram inspecionados. Nenhuma permissão foi modificada.

| Função | `anon` | Avaliação material | Ação proposta, não executada |
| --- | --- | --- | --- |
| `audit_membership_unit_access_change()` | Sim | Retorna `trigger`; chamada RPC direta não funciona como função comum, mas o grant é desnecessário. | Revogar `EXECUTE` de `PUBLIC`, `anon` e `authenticated`; manter trigger pelo dono. |
| `audit_membership_unit_scope_change()` | Sim | Mesmo caso; grava auditoria apenas como trigger. | Mesmo revoke, após teste de atualização legítima. |
| `handle_new_user()` | Sim | Retorna `trigger`; cria perfil quando Auth insere usuário, não deve ser RPC pública. | Revogar grants públicos sem remover trigger do Auth. |
| `is_netsecbr_admin()` | Sim | Helper booleano chama `is_platform_operator()`, que depende de `auth.uid()`; `anon` deve receber `false`. | Revogar `anon`/`PUBLIC` se nenhuma policy anônima depender dele; manter `authenticated`. |
| `is_platform_operator()` | Sim | Consulta papel ativo + perfil ativo para `auth.uid()`; com UID nulo deve retornar `false`. | Mesmo ajuste de grants, após teste de RLS. |
| `is_platform_owner()` | Sim | Mesmo padrão, limitado a owner ativo. | Mesmo ajuste de grants. |
| `is_tenant_admin(uuid)` | Sim | Helper por UID e tenant; não concede acesso ao anônimo sem UID. | Revogar `anon`/`PUBLIC`; preservar uso por `authenticated`. |
| `is_tenant_member(uuid)` | Sim | Helper por UID, mas **amplo** para qualquer membership ativo. O risco principal é a semântica aplicada a prestadores, não só o grant. | Revogar anônimo e não usar para escopo de prestador; revisar dependências. |
| `tenant_allows_operation(uuid)` | Sim | Não usa UID; revela se um UUID de tenant conhecido está ativo/em carência (oráculo de status). | Revogar `anon`/`PUBLIC` após mapear policies; considerar schema não exposto. |
| `user_can_access_unit(uuid)` | Sim | Consulta UID e escopo de unidade; `anon` tende a `false`, mas `units_access_all` amplia membros internos. | Revogar anônimo; redesign para prestador por OS. |

As **17 chamadas autenticadas** se dividem em:

- **3 triggers sem motivo para RPC direta:** os dois `audit_membership_*` e `handle_new_user()` — revogação proposta.
- **7 helpers de autorização/estado usados pelas policies:** `is_netsecbr_admin`, `is_platform_operator`, `is_platform_owner`, `is_tenant_admin`, `is_tenant_member`, `tenant_allows_operation`, `user_can_access_unit`. Manter execução para `authenticated` enquanto policies dependerem deles; mover a schema não exposto só com revisão de dependências.
- **7 RPCs de negócio/leitura:** `approve_service_request_and_create_work_order` (confere admin do tenant/plataforma e solicitação em triagem), `create_preventive_work_order_from_plan` (confere admin e plano ativo, mas não é idempotente), `create_tenant_support_ticket` (confere admin do tenant), `get_command_center_consumption` (usa `is_netsecbr_admin()`), `get_command_center_overview` (**exceção abaixo**), `get_command_center_support_agents` (usa `is_netsecbr_admin()`), `update_command_center_support_ticket` (usa `is_netsecbr_admin()` e valida estado/agente). Testes de negação por JWT ainda são necessários, especialmente parâmetros de tenant e objeto. Manter apenas grants necessários e `search_path=''` nas próximas revisões.

**Achado prioritário:** `get_command_center_overview()` exige `auth.uid()` e perfil ativo com `platform_role='netsecbr_admin'`, mas **não** exige papel ativo em `platform_access_roles`. Já `is_netsecbr_admin()` delega a `is_platform_operator()`, que verifica esse papel. Portanto, um perfil ainda marcado como admin, mas com acesso de plataforma revogado, pode continuar passando pela checagem da RPC de overview (inferência do código, não exploração executada). Corrigir localmente em migration própria para usar o predicado de papel ativo, validar JWT revogado e somente então pedir autorização remota. A função usa `search_path='public'`; endurecer para `''` numa revisão controlada.

As funções de auditoria de OS/solicitação `record_work_order_audit_event()` e `record_service_request_audit_event()` já não têm `EXECUTE` para `anon` nem `authenticated`; servirão como referência para higiene de triggers.

Outros advisories: proteção de senha vazada desativada; 23 ocorrências de policies permissivas múltiplas. Tratar em tarefas próprias, com testes, sem misturar com a migration preventiva. [Linter de funções anônimas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) e [linter de múltiplas policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).
