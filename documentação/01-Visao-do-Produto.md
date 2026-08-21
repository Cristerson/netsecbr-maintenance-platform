# Visão do Produto

## Declaração

A **NETSECBR Maintenance Platform** será uma plataforma SaaS para gestão de ativos e manutenção industrial. Ela permitirá que indústrias e prestadores de serviço controlem, em um único lugar, seus equipamentos, solicitações, ordens de serviço, preventivas, checklists, equipes, peças, evidências e indicadores.

## Problema

Muitas operações controlam manutenção em planilhas, mensagens e sistemas difíceis de adaptar. Isso reduz a rastreabilidade, atrasa a resposta a falhas e impede decisões baseadas em dados. Soluções corporativas existentes podem ser caras e complexas para empresas pequenas e médias.

## Público inicial

- Gestores de manutenção, supervisores e coordenadores industriais.
- Técnicos elétricos, mecânicos, programadores e preparadores.
- Produção, solicitando atendimentos emergenciais.
- Diretoria e clientes, acompanhando indicadores e relatórios.
- Empresas de manutenção que atendem múltiplos clientes e unidades.

O usuário recorrente é o técnico de campo ou de fábrica, frequentemente em ambiente ruidoso, com pouco tempo para digitação e conectividade variável. A experiência operacional deve ser adequada a esse contexto, sem esconder os recursos de gestão necessários a líderes e gestores.

## Proposta de valor

Uma ferramenta simples para o dia a dia do técnico, mas capaz de dar à gestão uma visão confiável de disponibilidade, falhas, custos, produtividade e riscos. O produto deve funcionar para robôs e para qualquer ativo industrial.

## Escopo de negócio

O núcleo gerencia a cadeia **organização → cliente → unidade → área/linha → ativo → componente**, preservando o histórico de cada intervenção. A manutenção será organizada por solicitações, planos preventivos e ordens de serviço (OS).

## Compromissos da ideia original

O produto não será limitado a robôs, nem apenas a uma tela de chamados. Ele precisa manter espaço para controlar qualquer ativo industrial e atender à realidade de cada cliente por meio de configurações, sem perder um núcleo simples e padronizado.

O escopo completo se organiza em dois pacotes:

1. **Software de gestão:** cadastros de clientes, equipamentos, profissionais e fornecedores; manutenção programada e emergencial; inventário; peças e aquisições; notificações; vistoria com assinatura e anexos; relatórios para supervisão, gerência e diretoria.
2. **Interface máquinas × software:** coleta automática de tempo parado, tempo produzindo, falhas, alarmes e horímetro.

O primeiro pacote será entregue em etapas no MVP e nas evoluções seguintes. O segundo é uma frente futura de IIoT, desenhada desde o início para não exigir reconstrução do núcleo.

### Tipos de manutenção

- Preventiva programada
- Corretiva programada
- Emergencial não programada
- Preditiva
- Melhoria

## Diferenciais desejados

- Checklists configuráveis e evidências por OS.
- Abertura simples de chamados pela produção.
- QR Code por ativo para acesso rápido ao histórico.
- Dashboards com disponibilidade, MTBF, MTTR, pendências e Pareto de falhas.
- Aplicativo de campo para executar OS, registrar fotos e coletar assinatura.
- Registro de execução por texto ou ditado, sempre com revisão e aprovação do técnico antes de gravar no histórico.
- Evolução futura para telemetria industrial e análises assistidas por IA.

## Fora do MVP

Integrações de PLC, robôs e sensores, análises preditivas, compras completas, integrações ERP e aplicativo nativo não fazem parte da primeira entrega. Serão preparados na arquitetura, mas só desenvolvidos após validação do núcleo.

O aplicativo Android é uma evolução planejada do produto, iniciada após a validação do fluxo responsivo de OS e dos contratos de API necessários para campo.

## Métricas de sucesso do MVP

- Uma equipe consegue cadastrar ativos e operar OS sem depender de planilhas.
- Técnicos registram execução, checklist e evidências no mesmo fluxo.
- Gestores identificam pendências e ativos mais críticos em poucos minutos.
- Todas as informações de uma OS e de um ativo são rastreáveis por organização.
