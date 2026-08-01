# LGPD e Privacidade

## Compromisso

A plataforma tratará dados pessoais somente quando necessários para gestão de usuários, atendimento, execução do contrato, cobrança e segurança. Finalidade, adequação, necessidade, transparência, segurança e responsabilização orientam esse tratamento.

## Dados previstos

| Categoria | Exemplos | Regra |
| --- | --- | --- |
| Dados de conta | nome, e-mail e perfil de acesso | mínimo necessário para autenticação e operação. |
| Dados de negócio | ativos, OS, relatórios e unidades | pertencem ao tenant e são isolados por RLS. |
| Cobrança | referência do cliente no provedor, faturas e status | não armazenar cartão, CVV ou dados bancários completos. |
| Anexos | fotos, vídeos e documentos de manutenção | podem conter dados pessoais incidentalmente; acesso e retenção controlados. |

Dados pessoais sensíveis não são necessários para o objetivo normal do CMMS e não devem ser solicitados em formulários, checklists ou campos livres.

## Controles técnicos

- Isolamento de tenants com RLS no PostgreSQL.
- Menor privilégio para usuários e suporte NETSECBR.
- Auditoria de ações relevantes e acessos de suporte.
- Segredos fora do código e do GitHub.
- Arquivos em armazenamento protegido e URLs controladas.
- Exclusão lógica e política de retenção antes de eliminação definitiva.

## Franquia e controle de consumo

- A franquia comercial de 50 MB é aplicada de forma rígida aos arquivos enviados pelo tenant (fotos, vídeos e documentos).
- Antes de aceitar um upload, o servidor somará o tamanho já utilizado pelo tenant e recusará o arquivo que exceder o limite contratado.
- O banco PostgreSQL é compartilhado entre tenants; seu consumo será medido por tenant para relatórios e alertas, mas não terá bloqueio físico por megabytes. Essa abordagem preserva integridade e evita falhas no histórico operacional.
- A NETSECBR poderá aumentar a franquia por contrato e definir cobrança adicional de armazenamento.

## Controles de produto e operação

- Política de privacidade e termos antes do lançamento comercial.
- Definição contratual de papéis: controlador, operador e encarregado, com revisão jurídica.
- Canal para solicitações de titulares e processo de resposta.
- Processo de incidente, avaliação de impacto e comunicação quando aplicável.
- Avaliação de fornecedores, incluindo hospedagem, Supabase e provedor de pagamento.

## Observação

Este documento orienta a construção técnica e não substitui orientação jurídica. A LGPD exige finalidade específica e limitação ao mínimo necessário para cada tratamento. [Princípios da LGPD](https://www.gov.br/esporte/pt-br/acesso-a-informacao-2/lgpd/principios-da-lgpd)
