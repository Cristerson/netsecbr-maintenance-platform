# MARV — Progresso da evolução operacional (31/10/2026)

Status: **implementação local parcial, não integrada nem homologada**. Nenhum comando de banco remoto, deploy, merge, commit, push, envio de e-mail ou alteração de dados de negócio foi executado.

## Fase 0 — preparação

- Branch confirmada: `agent/mvp-operational-and-purchases`; HEAD `290bc22`.
- Working tree já continha alterações rastreadas e numerosos arquivos não rastreados. Tudo foi preservado. Em especial, a migration não rastreada `20260928100000_add_unit_visibility_authorization.sql` não foi editada nem aplicada.
- Worktree separado foi avaliado, mas não adotado: não incorporaria automaticamente as alterações locais necessárias para inspecionar o estado real do projeto. As alterações desta tarefa ficaram restritas a quatro caminhos.
- Modelo existente: `maintenance_plans` contém `periodicity_days`, `next_due_date` e `notes` livre; a RPC antiga cria uma OS por plano e avança o vencimento, sem chave de ciclo nem unicidade. `work_orders` tem `source_maintenance_plan_id`; `assets.ownership_type='third_party'` representa posse externa, mas não identifica o cliente atendido dentro do tenant de um prestador.
- Consulta SELECT no projeto principal: os cinco planos Saint-Gobain estão hoje em 30 dias e identificados como SIMULAÇÃO. Há OS preventivas antigas sem chave de ciclo, inclusive no tenant Saint-Gobain. Nenhum dado foi convertido.

## Fase 1 — fundação local de ciclo e unicidade

Migration criada pela CLI, mas **não aplicada**: `backend/supabase/migrations/20261031214019_preventive_cycle_foundation.sql`.

- `maintenance_plans.cycle_policy`: `interval` (padrão compatível com dados atuais) ou `annual_calendar` com 365/366 dias. `annual_anchor_date` preserva o dia original inclusive para 29/02: a função de calendário volta a 29/02 no próximo ano bissexto, sem deriva de somas fixas de dias.
- `work_orders`: chave de ciclo, política e data original; índice único parcial por tenant + ativo + ciclo para preventivas novas. Status não integra a chave: cancelar/reabrir não libera outra OS.
- Snapshots dos planos de origem com nome, notas, periodicidade e data programada, vinculados à OS. Ainda **não** são checklist estruturado.
- Nova RPC recebe plano e data original do ciclo, bloqueia o ativo para serializar chamadas concorrentes, reúne planos anuais ativos do mesmo ativo/ano, retorna a OS existente em repetição e avança somente uma ocorrência. Histórico sem chave coincidente exige reconciliação explícita.
- Policy restritiva impede inserção direta de OS preventiva por `authenticated`; trigger protege identidade e formato da chave. A RPC antiga passará a exigir atualização do cliente em vez de gerar OS sem data original.
- Frontend: escolha da política de ciclo, chamada da nova RPC, mensagem de OS existente e botão para abrir a OS; criação manual de preventiva na tela de OS bloqueada.

Validação local atual: `npm --prefix Frontend run build:staging` **passou** (TypeScript + Vite; aviso informativo de chunk >500 kB). O teste SQL puro do cálculo anual foi preparado em `backend/supabase/tests/preventive_annual_calendar.sql`, mas **não executado**. `git diff --check` do repositório **falhou por uma linha vazia final em `.gitignore`**, alteração preexistente e fora do escopo, que foi preservada; os arquivos criados nesta etapa são não rastreados e não entram nesse comando. A migration **não foi executada**: não há PostgreSQL/Docker local disponível nesta sessão. Concorrência, RLS e rollback ainda precisam de teste em banco isolado antes de qualquer aplicação remota.

## Fases 2–6 — pendentes

Checklist estruturado, medições, fotos, salvamento parcial, mobile, PDF versionado, assinatura, aprovação, histórico, envio, dashboard e alertas **não foram implementados nem testados** neste checkpoint. `notes` permanece texto livre e não deve ser tratado como atividade estruturada sem revisão de origem. Nenhum documento histórico de 2025 foi fabricado.

Bloqueio de segurança identificado para a próxima implementação: `is_tenant_member()` aceita qualquer membership ativo, e a migration de unidade pendente mantém `work_orders` visível/alterável por membro da unidade. Um técnico externo cadastrado como `navigation` veria mais do que suas OS atribuídas. Não foi concedido acesso externo nem criada tela que aparentasse isolamento sem a correspondente RLS. A solução precisa distinguir esse perfil no backend e testar negações explícitas de leitura/escrita em banco isolado.

## Decisões do comando consolidado e pontos ainda pendentes

1. Saint-Gobain: os cinco planos mensais de SIMULAÇÃO **permanecem inalterados**. Planos anuais reais serão cadastrados somente após validação dos dados técnicos de origem; nenhuma conversão automática.
2. MARV Serviços: fluxo **independente**, sem exigir ativo, plano ou OS industrial. Cliente atendido não deve ser confundido com tenant assinante; vínculo entre prestador e indústria será proposta futura, sem sincronização nesta sprint.
3. Supervisor: permissão delegável sem `tenant_admin`; aprovação precede termo de aceite, e assinatura do cliente é obrigatória antes da conclusão definitiva. Ainda não implementado.
4. Histórico 2025 e fotos: aguardar documentos originais e política de retenção/acesso; não criar registros fictícios.
5. A migration de visibilidade por unidade `20260928100000` atualmente autoriza leitura/edição por qualquer membro da unidade. Antes de convidar técnico externo é indispensável criar um escopo restrito por atribuição de OS/ativo no backend e RLS. Não usar a interface como único controle.

## Plano para a futura modificação remota — ainda não autorizada

1. Revisar a migration e a função linha a linha, incluindo trigger, policy, grants e compatibilidade com a migration de visibilidade por unidade.
2. Levantar duplicidades/OS históricas sem chave por tenant, ativo e período; reconciliar manualmente antes de habilitar geração no ativo afetado.
3. Fazer backup recuperável dos esquemas/tabelas afetados e registrar ponto de restauração, com credenciais sob controle do proprietário.
4. Aplicar primeiro em ambiente PostgreSQL isolado com cópia sanitizada, testar concorrência, repetição, cancelamento, reabertura, RLS AN/AC/UN e regressão de OS corretivas.
5. Para rollback, preparar migration compensatória que restaure a RPC e retire a policy/trigger/índice/colunas **somente após** exportar qualquer dado novo; não usar reset destrutivo nem apagar snapshots sem preservação.
6. Só então solicitar autorização expressa para aplicar no projeto principal, coordenando migração, frontend e janela de reversão. Não publicar frontend novo antes da migration compatível.
