# Roadmap

## Fase 0 — Descoberta e base (atual)

Validar visão, fluxos de manutenção, perfis, protótipos e documentação. Escolher um cliente ou operação-piloto.

## Fase 1 — MVP CMMS e experiência operacional

Organizações, usuários, ativos, solicitações, OS, checklist, preventivas básicas, anexos, auditoria e painel operacional. Consolidar design system NETSECBR, navegação por papel, linguagem de campo e uso responsivo em celular/tablet.

### Princípio de simplicidade operacional

O MARV deve atender também usuários com pouca ou nenhuma familiaridade com sistemas computacionais. Cada rotina deve usar termos diretos, orientações curtas, poucos campos por etapa, feedback visual claro e caminhos previsíveis. A interface pode ser amigável e guiada, mas nunca deve simplificar a ponto de comprometer regras, rastreabilidade ou governança.

### Critério de encerramento do MVP V1 — Manual de Operação

Antes de considerar o MVP concluído, publicar um Manual de Operação com linguagem simples e capturas de tela atualizadas. O manual deve explicar, para cada rotina:

- objetivo e perfil responsável;
- pré-requisitos e dependências;
- passo a passo de execução;
- campos obrigatórios e regras de validação;
- impacto da ação nos ativos, solicitações, OS, custos, indicadores e histórico;
- permissões necessárias, aprovações e pontos de auditoria;
- resultado esperado e orientação de tratamento para erros comuns.

O escopo inicial do manual cobre: configuração da empresa, usuários e permissões, unidades e centros de custo, fornecedores, ativos, solicitações, triagem, ordens de serviço, custos, planos preventivos, geração de OS preventiva e dashboard operacional.

O MARV disponibilizará esse conteúdo por dois canais: uma área de **Ajuda** na plataforma, com orientação contextual por módulo, e o **download do Manual de Operação** completo em formato distribuível. A publicação da interface de ajuda ocorre junto da versão aprovada do manual, para evitar conteúdo desatualizado ou incompleto.

### Critério obrigatório de segurança antes de publicar

Antes de publicar qualquer versão ou liberar o MARV em produção, realizar uma auditoria de segurança e privacidade. A revisão deve verificar chamadas externas, URLs e envio de dados, credenciais e arquivos de ambiente, dependências e scripts de instalação/build, RLS e grants do Supabase, RPCs com privilégio elevado, Edge Functions, CORS e o diff completo do Git. Uma entrega só pode ser publicada após essa validação.

### Usabilidade operacional sem recarga manual

Após ações que alterem dados operacionais — por exemplo, salvar ou ativar um plano preventivo, gerar uma OS preventiva, atualizar uma solicitação ou concluir uma OS — a interface deve atualizar os dados relacionados automaticamente. O usuário não deve depender de F5 para ver o resultado da operação, priorizando a rotina de técnicos de fábrica e campo.

## Fase 2 — Operação ampliada e campo Android

QR Code, relatórios mais completos, estoque e peças, notificações configuráveis, Operações de Manutenção, aplicativo Android em Flutter, captura offline, foto, QR Code e ditado com transcrição aprovada.

Também evoluir a ficha do robô e da célula: braço mecânico, controlador, teach pendant, EOAT/ferramenta, dress pack, payload, alcance, aplicação, horas de operação e manutenção por eixo/redutor. Incluir alertas técnicos de bateria de encoder/memória e classificação de falhas de ferramenta e cabeamento.

## Fase 3 — Integrações

ERP, e-mail corporativo, APIs públicas controladas e conectores industriais selecionados.

## Fase 4 — IIoT e IA

Telemetria, alarmes automatizados, indicadores de disponibilidade avançados, busca inteligente e recomendações assistidas.

Evoluir para o MARV Collector, serviço local na rede industrial capaz de receber dados de OPC UA, Modbus, MQTT ou conectores homologados dos fabricantes. Alarmes podem pré-preencher uma solicitação com o código original, mas a abertura, priorização e execução permanecem sob validação humana. Adicionar MTBF, MTTR, disponibilidade por robô/célula, histórico de lubrificante/graxa de redutores e recomendação baseada em evidências. Backups e programas de controladores devem ter versionamento, vínculo com OS e controle de acesso.

## Fase transversal — Governança e Performance

Evoluir os dados operacionais para indicadores auditáveis de disponibilidade, SLA, custos, contratos, riscos e planos de ação. Esta camada reutiliza os registros operacionais e não cria uma segunda base de dados.

Cada fase só avança após uso real, feedback de clientes e confirmação do valor entregue pela fase anterior.
