# MARV — Validação somente leitura do banco principal

> Nota de 01/11/2026: a descrição da migration abaixo registra o estado **de 31/10**. A migration local foi posteriormente revista para manter a RPC antiga e adiar a policy restritiva. Consulte `RELATORIO_INTEGRACAO_LOCAL_2026-11-01.md` antes de usar este documento como plano de implantação.

Projeto confirmado pela API Supabase: `netsecbr-maintenance`, ref `zhsutxrvjocamdyyrquy`, PostgreSQL 17.6, `ACTIVE_HEALTHY`. Consultas executadas somente com `SELECT` e ferramentas de catálogo/advisories. **Nenhum SQL de escrita, migration, repair, deploy ou alteração de dados foi executado.**

## Evidência material

- `public.tenants`: 3; `maintenance_plans`: 9; `work_orders`: 20. O catálogo do conector exibiu contagens estimadas diferentes; as contagens acima vêm de `count(*)` direto e são a referência desta verificação.
- Por tenant: Dedini 2 planos/2 OS/2 ativos; NETSECBR Demonstração 2/8/4; Saint-Gobain 5/10/5.
- `maintenance_plans`, `work_orders`, `assets`, `tenant_memberships` e `membership_unit_access` têm RLS ativo.
- As colunas `cycle_policy`, `annual_anchor_date` e `preventive_cycle_*` ainda não existem. Tampouco existem a tabela de snapshots e a RPC `create_preventive_cycle_work_order(uuid,date)`. A RPC antiga `create_preventive_work_order_from_plan(uuid)` permanece ativa como `SECURITY DEFINER`.
- Uma consulta **SELECT puro** executou a expressão de avanço anual proposta no PostgreSQL 17.6: 29/02/2024→28/02/2025, 28/02/2027 com âncora 29/02→29/02/2028, 31/12→31/12 e 15/03→15/03 (4/4 resultados esperados). Isso valida a expressão, **não** a migration ou a RPC completa.
- O histórico `supabase_migrations.schema_migrations` existe, mas contém **só uma linha**: versão `20261023220826`, nome `20260928100000_add_unit_visibility_authorization`. Isso não representa as demais estruturas materialmente presentes. O nome da migration de unidade corresponde ao arquivo local, mas a versão registrada não corresponde ao prefixo local `20260928100000`. **Não usar `db push` ou `repair` sem reconciliação própria.**
- Policies efetivas de `work_orders`: duas permissivas de `INSERT`, uma de `SELECT` e uma de `UPDATE`; a de `UPDATE` aceita qualquer membro ativo com acesso à unidade. `is_tenant_member()` verifica membership ativo, sem restringir perfil por OS atribuída. Os 13 vínculos observados (3+1 Dedini, 2+3 NETSECBR, 3+1 Saint-Gobain) têm `units_access_all=true`. Isso **não** implementa isolamento de prestador por OS/ativo.
- `anon` tem grants diretos amplos nas três tabelas centrais, mas nenhuma policy de RLS `public` para `anon` foi encontrada: o acesso efetivo a linhas está negado pelo RLS, porém os grants merecem higiene específica.
- Storage: apenas bucket privado `tenant-branding`, limite 2 MB e MIME de imagem. Não serve como bucket de evidências/relatórios; nenhum bucket foi criado.

## Preventivas existentes e impacto por cliente

| Tenant | Situação material | Implicação para a migration |
| --- | --- | --- |
| Saint-Gobain | Cinco planos ativos de 30 dias identificados como `SIMULACAO`; três OS preventivas antigas (#11, #12, #13), sem chave de ciclo. | O default `interval` preserva os planos, sem converter para anual. Para os ativos com OS antiga, o bloqueio conservador da RPC pode exigir reconciliação antes de gerar nova OS. Não tocar nos cinco planos nem assumir histórico real. |
| Dedini | Dois planos (30 e 90 dias); uma OS preventiva concluída (#9) sem plano de origem **e sem `scheduled_for`**. | A checagem local foi reforçada nesta rodada: a RPC preparada agora **bloqueia** geração para esse ativo até reconciliação manual, sem alterar a OS antiga. |
| NETSECBR Demonstração | Dois planos, um inativo; três OS preventivas antigas. OS #6 e #7 são do mesmo ativo e ano 2026, em datas diferentes. | Não há duplicata exata por ativo+data, mas há duas por ativo+ano. O índice novo não corrige legado, porque só indexa chaves não nulas. Dados de demonstração exigem classificação antes de migração anual. |

Consulta por `(tenant, ativo, scheduled_for::date)` retornou **zero grupos duplicados**; por `(tenant, ativo, ano)` retornou **um grupo** (#6/#7, NETSECBR Demonstração). Há sete OS preventivas no total; nenhuma possui chave de ciclo, pois a coluna ainda não existe.

Uma consulta `SELECT` que reproduz a **nova guarda local de legado** indica bloqueio conservador em 6 dos 9 planos: Dedini robô de solda (#9), NETSECBR Robo Kuka (#5) e painel controlador inativo (#6/#7), Saint-Gobain Prensa 16 (#11), Prensa 21 (#12) e Prensa 22 STW (#13). Isso não altera nenhum plano nem impede as demais funções atuais; é uma previsão de comportamento **se** a migration e a nova RPC forem aplicadas. Os três planos restantes não apresentaram bloqueador por essa guarda específica.

## Revisão da migration local `20261031214019`

O arquivo local tem aproximadamente 395 linhas (a proteção de legado foi ajustada nesta rodada). Ele adiciona duas colunas em `maintenance_plans`, três em `work_orders`, uma constraint de política, índice único parcial, tabela de snapshots com RLS, policy restritiva de inserção preventiva, dois triggers e cinco funções (âncora, cálculo anual, validação da identidade, criação de OS e substituição da RPC antiga). Há `UPDATE maintenance_plans` condicional para inicializar âncora anual em linhas já marcadas como anuais; hoje não há tal coluna, portanto o default de instalação será `interval` e **os nove planos existentes não serão convertidos**.

Pontos que impedem aprovação imediata:

1. A proteção de legado foi endurecida localmente para falhar fechada quando a OS antiga não tem `scheduled_for` ou está ligada a um plano consolidado. Isso evita duplicação silenciosa, mas pode bloquear geração em ativos com histórico até que um procedimento auditável de reconciliação seja definido e testado. OS reagendadas sem vínculo confiável também não podem receber ciclo automaticamente.
2. A RPC antiga é substituída por erro explícito. O frontend atualmente publicado ainda pode chamá-la; aplicar a migration isoladamente interromperia a geração de preventivas até publicação coordenada do frontend novo.
3. A migration não restringe edição direta de `scheduled_for` pelos membros autorizados pela policy atual nem exige justificativa de reagendamento. Também não fornece reabertura excepcional: o trigger `enforce_work_order_governance` atual bloqueia reabertura de concluída/cancelada.
4. O índice novo protege somente OS com `preventive_cycle_key` não nula. Legado sem chave continua fora da unicidade; isso é deliberado para preservar dados, mas exige reconciliação explícita.
5. Não houve execução da migration, dos testes SQL preparados ou de teste de concorrência. Compatibilidade sintática e efeitos de triggers precisam de prova antes da aplicação.

Locks esperados: `ALTER TABLE` adquire lock forte/curto nas tabelas; `CREATE INDEX` sem `CONCURRENTLY` lê/bloqueia escrita em `work_orders`; a constraint pode varrer `maintenance_plans`. As tabelas são pequenas hoje (heaps de 16 kB cada; total aproximado 112 kB/248 kB), mas a janela precisa considerar sessões ativas, não apenas tamanho.

## Advisories observados

- Segurança: 10 funções `SECURITY DEFINER` executáveis por `anon`; 17 executáveis por `authenticated` (nem todas são falhas: revisar autorização individualmente); proteção contra senhas vazadas desativada. [Funções expostas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Desempenho: 50 FKs sem índice de cobertura (INFO), 5 policies com reavaliação de `auth.*` por linha (WARN), 35 índices não usados (INFO) e 23 ocorrências de policies permissivas múltiplas (WARN). [Índices de FK](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [policies permissivas](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies). Não alterar índices ou policies nesta tarefa.

## Plano de testes controlados no banco principal — ainda não autorizado

**Sem escrita, executável agora:** repetir inventário de schema/RLS/triggers/constraints; agrupar preventivas por ativo/data/ano; identificar legado sem plano/data; inspecionar dependências da RPC antiga; consultar advisories e logs; verificar que a migration nova ainda não consta materialmente; conferir controles de acesso por definição de policy. Isso comprova estrutura, **não** comprova RLS com usuário real nem concorrência.

**Com escrita, somente após aprovação específica e backup recuperável:** criar fixture `MARV-QA-CICLO-<data>` em área de demonstração NETSECBR, com ativo e plano exclusivos, usuários de teste identificados e UUIDs registrados antes da execução. Não usar ativos, planos ou OS da Saint-Gobain ou Dedini. Testar intervalo e anual, retry idempotente, cancelamento, reabertura excepcional, dois **administradores autorizados** em sessões independentes, RLS com JWTs próprios e negações de outros tenants. A RPC atual não permite que técnicos comuns gerem OS; o cenário “dois técnicos gerando OS” deve ser testado como **duas negações**, salvo mudança expressa da regra de negócio. Registrar todos os IDs criados e efeitos nas tabelas `work_orders`, snapshots, audit logs e `maintenance_plans`.

**Transacionalidade/limpeza:** o `ROLLBACK` desfaz linhas de OS, snapshots, alterações em planos e auditoria gravada por triggers na mesma transação. **Não** desfaz avanço da sequência `order_number`, nem e-mails, Storage ou chamadas externas. Concorrência real com um commit observado pela outra sessão não pode ser demonstrada e integralmente revertida por um único rollback. Para esse caso, o plano deve aceitar registros QA persistentes ou aprovar limpeza específica após avaliar FKs e preservação da auditoria; nunca apagar registros de produção por suposição. Após cada teste, comparar contagens e IDs contra baseline e verificar ausência de efeitos externos. Nenhum teste de escrita foi iniciado.

## Condições para pedir autorização da migration

1. A detecção local de legado sem data já foi endurecida; ainda faltam a estratégia de reconciliação, reagendamento/reabertura e coordenação com frontend publicado. Revisar também a migration de unidade já materializada sob outra versão.
2. Confirmar **backup recuperável e janela de retenção** no Supabase Dashboard/provedor. A API disponível nesta sessão não expõe confirmação de backup/PITR; portanto **não está confirmado**.
3. Preparar backup/exportação dos objetos afetados e plano de reversão não destrutivo. Se a migration falhar no meio e o executor usar transação única, verificar rollback da transação e conferir catálogo/contagens. Se for aplicada mas **nenhuma** OS nova tiver sido criada, uma migration compensatória pode retirar a policy restritiva e o trigger de identidade e restaurar a definição da RPC antiga do arquivo `20260921102000_create_preventive_work_order_rpc.sql`, após conferir dependências. **Não** remover colunas/índice/snapshots sem prova de ausência de dados. Se já houver OS com chave nova, desabilitar temporariamente a ação de geração no frontend e preservar esquema e dados; restaurar a RPC antiga nesse caso poderia voltar a criar duplicidades. Tratar por correção progressiva ou recuperação de backup aprovada, não por `reset`.
4. Agendar janela curta, com bloqueio de geração de preventivas e monitoramento de locks; aplicar migration e frontend em ordem coordenada; executar verificações pós-aplicação e ter critério de parada. **Solicitar aprovação expressa antes de qualquer passo remoto.**

## Desenvolvimento local independente nesta rodada

Foram preparados componentes não conectados a banco/rotas: `Frontend/src/industrial-checklist-editor.tsx` (atividades, resultado, medição e não conformidade), `Frontend/src/report-signature-pad.tsx` (captura PNG local por toque/caneta/mouse) e `Frontend/src/report-photo-picker.tsx` (câmera/galeria e prévia local). Eles **não** implementam salvamento, termo assinado, upload seguro, histórico, PDF ou aprovação e **não devem ser publicados como funcionalidade concluída**. O build de staging passou (TypeScript verifica os componentes, mas eles não entram no bundle por ainda não estarem ligados às rotas); não houve teste visual em Chrome Android.

`git diff --check` geral ainda retorna erro por uma linha vazia ao final de `.gitignore`, alteração preexistente preservada. Uma checagem específica dos arquivos criados/alterados nesta rodada não encontrou espaços finais. Nenhum commit/push foi feito.
