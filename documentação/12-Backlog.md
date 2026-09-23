# Backlog Inicial

## Épico 1 — Fundação SaaS

- Como administrador, quero criar minha organização e usuários para operar isoladamente.
- Como administrador, quero definir perfis para limitar ações de cada pessoa.
- Como auditor, quero consultar eventos relevantes para rastrear mudanças.

## Épico 2 — Ativos

- Como gestor, quero cadastrar a estrutura de unidades e ativos para localizar cada equipamento.
- Como técnico, quero consultar histórico e documentos de um ativo antes de atuar.

## Épico 3 — Solicitações e OS

- Como produção, quero abrir uma solicitação rapidamente para comunicar uma falha.
- Como supervisor, quero classificar e atribuir solicitações para organizar a resposta.
- Como técnico, quero executar uma OS e registrar solução, tempo e evidências.

## Épico 4 — Preventivas e checklists

- Como gestor, quero criar planos preventivos para reduzir falhas.
- Como técnico, quero preencher um checklist para comprovar a execução.

## Épico 5 — Gestão visual

- Como gestor, quero visualizar pendências e atrasos para agir rapidamente.
- Como diretoria, quero acompanhar ocorrências e esforço de manutenção por filtro.

## Épico 6 — Manual de Operação do MVP V1

- Como usuário operacional, quero um manual com telas e passos para executar cada rotina sem depender de orientação informal.
- Como administrador, quero conhecer dependências, permissões e impactos de cada ação antes de executá-la.
- Como responsável pela implantação, quero validar o resultado esperado e os erros comuns de cada fluxo do MVP.

## Épico 7 — V2: Especialização em robótica industrial

- Como gestor, quero modelar a célula robotizada separando braço mecânico, controlador, teach pendant, ferramenta/EOAT e dress pack.
- Como técnico, quero registrar controlador, payload, alcance, aplicação, horas de operação e informações de manutenção por eixo/redutor.
- Como supervisor, quero identificar falhas de bateria de encoder/memória, dress pack e ferramenta para apoiar a causa raiz.
- Como responsável técnico, quero versionar backups autorizados de controladores e programas, vinculados às intervenções e com rastreabilidade.
- Como gestor, quero indicadores técnicos por robô/célula, incluindo MTBF, MTTR e disponibilidade.
- Como operação, quero receber alarmes e códigos de falha por conectores industriais, com solicitação pré-preenchida sujeita à validação humana.
- Como gestor, quero registrar análises de lubrificante/graxa para apoiar a prevenção de falhas em redutores.

### Diretriz de segurança da V2

Telemetria, alarmes, recomendações por IA e solicitações pré-preenchidas devem apresentar evidências, exigir aprovação humana antes de qualquer decisão operacional e manter registro de auditoria. Previsão de falha só pode ser apresentada como preditiva quando houver dados contínuos confiáveis de sensores, alarmes, ciclos, temperatura, vibração, corrente ou horas de operação.

## Critério de priorização

Priorizar primeiro o que permite operar uma OS ponta a ponta com rastreabilidade. Itens IIoT, IA, estoque, compras e integrações entram após validação do MVP com usuários reais.
