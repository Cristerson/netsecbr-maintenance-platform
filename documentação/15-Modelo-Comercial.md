# Modelo Comercial — Hipótese Inicial

## Posicionamento

SaaS de gestão de manutenção e ativos industriais, simples para o técnico e completo para a gestão. A comercialização deve enfatizar resultado operacional, não apenas recursos técnicos.

## Planos configuráveis

| Exemplo de plano | Público | Escopo |
| --- | --- | --- |
| 5 robôs | Operações iniciando digitalização | Até 5 robôs cadastrados, ativos ou inativos; ativos, solicitações, OS e preventivas. |
| 10 robôs | Manutenção estruturada | Até 10 robôs cadastrados; painéis, checklists, relatórios, anexos e operação de campo. |
| 15 robôs | Operações ampliadas | Até 15 robôs cadastrados; recursos do plano anterior e operação multiunidade conforme contrato. |

Os exemplos acima não são limites fixos do sistema. O painel NETSECBR permitirá criar, editar, ativar ou desativar planos com qualquer quantidade de robôs, por exemplo 20, 40, 60 ou uma quantidade personalizada.

Cada contrato registra uma cópia da quantidade licenciada e das condições comerciais vigentes na contratação. Assim, alterar o catálogo de planos amanhã não muda contratos já assinados.

## Limites por contrato

O plano comercial define valores iniciais, mas cada contrato pode receber limites próprios. A plataforma não deve presumir que todos os clientes com a mesma quantidade de robôs têm o mesmo consumo operacional.

Exemplos de limites configuráveis por cliente:

- Robôs cadastrados.
- Armazenamento de arquivos.
- Ordens de serviço por mês, quando houver cobrança por volume.
- Usuários, unidades ou módulos contratados, se aplicável.

Um cliente com poucos robôs e muitas ordens de serviço poderá ter franquia maior de histórico/arquivos ou um limite de OS diferente, sem criar um novo produto ou alterar código.

## Variáveis de precificação a validar

- Quantidade de robôs cadastrados por tenant, independentemente de estarem ativos ou inativos (base da licença).
- Usuários ativos, unidades e centros de custo.
- Volume de armazenamento de arquivos e retenção de histórico.
- Módulos adicionais e integrações.
- Serviços de implantação, migração e treinamento.

## Estratégia inicial

Usar um ou poucos clientes-piloto para validar fluxos, implantação e disposição a pagar. Todo contrato terá prazo mínimo de 12 meses e cobrança anual antecipada. A oferta poderá incluir degustação ou início de cobrança postergado, configurados individualmente no contrato.

## Proteção de custo de infraestrutura

- Cada tenant inicia com franquia de 50 MB de armazenamento de arquivos. O uso de banco e telemetria é medido separadamente para controle interno de custo.
- Medir mensalmente anexos, banco e telemetria por tenant/unidade.
- Definir política comercial e técnica de retenção para fotos, vídeos, documentos e dados IIoT brutos.
- Manter no banco transacional apenas dados necessários à operação; arquivos ficam em armazenamento próprio e telemetria histórica em camada adequada para séries temporais.
- Criar alertas internos quando o consumo superar o contratado, antes que o custo da hospedagem comprometa a margem.

## Hospedagem inicial

A HostGator, no plano M atualmente contratado pela NETSECBR, será avaliada como opção inicial de hospedagem. Antes da definição, é obrigatório validar suporte a execução contínua do backend, PostgreSQL, armazenamento de arquivos, backups, HTTPS, domínios e integrações de pagamento. Se o plano não suportar esses requisitos, o site institucional pode permanecer na HostGator e a aplicação SaaS usar infraestrutura própria.
