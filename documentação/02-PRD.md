# PRD — Requisitos do Produto

## Objetivo do MVP

Entregar uma aplicação web multiempresa para controlar ativos, solicitações e ordens de serviço, com planejamento preventivo, checklists, anexos e indicadores operacionais básicos.

## Perfis de usuário

| Perfil | Capacidades principais |
| --- | --- |
| Administrador da organização | Configura organização, usuários e permissões. |
| Gestor/Supervisor | Planeja, prioriza, acompanha indicadores e aprova encerramentos. |
| Manutentor | Recebe, executa e registra atividades de OS. |
| Solicitante de produção | Abre e acompanha solicitações do seu escopo. |
| Diretoria/Cliente | Consulta painéis e relatórios permitidos. |

## Modelo SaaS e acesso

- A NETSECBR opera a plataforma globalmente; cada **cliente** é um tenant isolado.
- Um cliente pode possuir uma ou mais unidades. Cada unidade possui um centro de custo próprio para acompanhamento operacional e comercial.
- A licença será calculada pela quantidade de robôs ativos e licenciáveis; outros ativos podem ser cadastrados conforme a regra comercial contratada.
- Deve existir uma área global exclusiva da NETSECBR para administrar clientes, contratos, cobrança, suporte, licenças e bloqueios.
- O administrador do cliente gerencia apenas o seu tenant, suas unidades e seus usuários.

## Requisitos funcionais do MVP

### RF-01 — Organizações e acesso

- Criar organizações, usuários, perfis e permissões.
- Garantir que usuários visualizem apenas os dados autorizados de sua organização.

### RF-02 — Estrutura e ativos

- Cadastrar clientes, unidades, áreas, linhas, ativos, componentes e fornecedores.
- Registrar código patrimonial, fabricante, modelo, número de série, criticidade, localização e estado do ativo.
- Manter documentos e histórico do ativo.

### RF-03 — Solicitações

- Permitir abertura de solicitação com ativo, categoria, prioridade, descrição e anexos.
- Permitir triagem: classificar, atribuir e converter uma solicitação em OS.

### RF-04 — Ordens de serviço

- Criar OS preventivas, corretivas, emergenciais, preditivas e de melhoria.
- Controlar status, prioridade, responsáveis, datas previstas e efetivas, tempos, causa e solução.
- Permitir anexos, checklist e apontamento de peças utilizadas.

### RF-05 — Planos preventivos

- Criar planos por ativo ou grupo de ativos, por calendário ou horímetro futuramente.
- Gerar OS programadas e alertar sobre atrasos.

### RF-06 — Checklists

- Criar modelos com itens OK, NOK, não aplicável, observação e evidência obrigatória quando necessário.
- Vincular modelo à OS ou ao plano preventivo.

### RF-07 — Painel e relatórios básicos

- Exibir OS por status e prioridade, preventivas atrasadas, horas de manutenção e ocorrências por categoria.
- Filtrar por período, unidade, ativo, área e responsável.

### RF-08 — Auditoria

- Registrar criação, alterações relevantes, atribuições, mudanças de status e encerramento de OS.

### RF-09 — Usuários e permissões configuráveis

- Disponibilizar perfis-base: administrador do cliente, suporte e navegação/operação.
- O administrador do cliente poderá criar usuários e habilitar permissões específicas dentro do conjunto permitido ao seu tenant.
- Usuário de navegação/operação poderá receber permissões como abrir chamados, criar OS, consultar ativos e executar OS, conforme a configuração do administrador.
- O suporte NETSECBR só acessa clientes por meio do painel global e com trilha de auditoria.

### RF-10 — Assinatura, licença e cobrança

- Cadastrar contrato com prazo mínimo de 12 meses, quantidade de robôs licenciados, unidades e centro(s) de custo.
- Configurar data de início de cobrança e período de degustação individual por cliente, em dias ou meses.
- Permitir cobrança por cartão de crédito e PIX por meio de provedor de pagamentos a ser definido.
- Disponibilizar ao administrador do cliente uma área de pagamentos, faturas, comprovantes e dados de cobrança.

### RF-11 — Inadimplência

- Após o vencimento, o cliente permanece com acesso completo por 3 dias corridos de tolerância.
- Após a tolerância, usuários do tenant acessam exclusivamente a área de pagamentos até a regularização.
- O bloqueio não apaga, altera nem interrompe a retenção dos dados do cliente.
- Administradores globais NETSECBR podem configurar exceções e registrar o motivo.

## Requisitos não funcionais

- Interface responsiva, com prioridade para uso em tablets.
- Datas, fuso e idioma adequados ao Brasil.
- API documentada e controle de acesso por função.
- Operações críticas registradas em auditoria.
- Arquivos armazenados fora do banco, com vínculo seguro e acesso autorizado.

## Diretriz consolidada de produto — 02/11/2026

Esta seção complementa os requisitos históricos acima; não declara implementação nem homologação.

O MARV é **um produto multiempresa e uma base funcional**, com duas jornadas configuráveis por tenant, perfil e permissão. O **MARV Industrial** mantém solicitação, triagem, OS corretiva/preventiva, plano, execução, revisão, aceite e prontuário do ativo. O **MARV Prestador de Serviços** permite atendimento avulso com identificação básica de cliente/equipamento, serviço, peças e tempo quando aplicáveis, fotos, aceite, assinatura, PDF e histórico, sem exigir plano ou inventário industrial completo. Um prestador designado a uma OS industrial usa a jornada industrial com acesso restrito; isso não se confunde com o modo leve. Ocultar menus não substitui autorização no banco e no Storage.

### Requisitos funcionais complementares e mensuráveis

- **Planos por ativo:** consultar, criar, editar, ativar/desativar e copiar planos no detalhe do ativo; admitir planos anual e trimestral independentes. Para robôs, sugerir o Modelo MARV com 16 atividades; o Modelo Personalizado começa vazio por escolha explícita. Confirmar leitura após gravar. Revisões posteriores não podem alterar snapshots de OS anteriores.
- **OS preventiva:** selecionar plano ativo na aprovação de solicitação preventiva, criar por RPC idempotente e inicializar checklist por snapshot sem duplicação. Uma OS preventiva ativa por equipamento; concluídas/canceladas não bloqueiam nova intervenção. Conflitos devem identificar a OS e oferecer caminho para abri-la. Conclusão depende de execução, revisão e aceite exigidos.
- **Execução móvel:** cada atividade exibe somente resultado, observação e campos de medição configurados para ela. Fotos aparecem no próprio card, são vinculadas ao item e persistidas em Storage privado. Foto obrigatória impede o encerramento, mas não o rascunho. Não conformidade abre, de modo idempotente, uma solicitação corretiva vinculada, sem gerar OS corretiva automaticamente.
- **Relatório e aceite:** consolidar dados persistidos em PDF recuperável; supervisor autorizado aprova ou devolve com autoria; assinatura do representante fica vinculada à versão final, com trilha de auditoria e acesso autorizado. Uma simulação local não satisfaz este requisito.
- **Prontuário do ativo:** apresentar OS preventivas/corretivas, responsáveis, datas, medições, horímetro, fotos, custos e relatórios quando registrados. Indicadores V1 usam somente dados reais; histórico fictício não pode aparecer como fato.
- **Bloqueios úteis:** informar em linguagem clara motivo, registro envolvido e próximo passo permitido. Salvar progresso deve permitir retomada confiável, sem depender de F5.

Itens de fases posteriores — BI avançado, cobrança automatizada, IA, IIoT, ERP, compras completas e importação de históricos com proveniência — permanecem no planejamento. A necessidade de cobrança efetiva deve ser decidida antes do lançamento público pago.
