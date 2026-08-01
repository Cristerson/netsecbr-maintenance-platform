# Regras de Negócio

## Multiempresa

- A NETSECBR é a operadora global da plataforma. Cada cliente contratante é um tenant.
- Todo registro operacional pertence a um tenant; usuários de cliente nunca podem consultar dados de outro tenant.
- Um tenant possui uma ou mais unidades. Toda unidade possui um centro de custo, obrigatório para relatórios comerciais e de consumo.
- Usuários globais da NETSECBR são separados dos usuários de tenants e todo acesso de suporte deve ser auditado.

## Licenças, cobrança e inadimplência

- A quantidade faturável é composta pelos robôs marcados como ativos e licenciáveis no período contratado.
- O contrato possui vigência mínima de 12 meses, data de início de cobrança e, opcionalmente, período de degustação configurável por cliente.
- A data de início da cobrança pode ser posterior à data de criação do tenant, conforme negociação comercial.
- Faturas podem ser quitadas por cartão ou PIX através do provedor de pagamentos integrado.
- No vencimento não pago, o tenant permanece ativo por 3 dias corridos. No quarto dia, entra em modo `payment_only`.
- Em `payment_only`, somente usuários autorizados a pagamentos podem entrar; todas as demais áreas, APIs e integrações do tenant são bloqueadas.
- Ao identificar pagamento confirmado, o acesso completo é restaurado automaticamente ou por ação auditada de um administrador NETSECBR.
- O bloqueio por inadimplência não remove dados, anexos, histórico nem configurações do cliente.

## Perfis e permissões

- Perfis-base: `tenant_admin`, `support` e `operator`.
- `tenant_admin` administra unidades, centro de custo, usuários e permissões do seu próprio tenant.
- `operator` começa com acesso mínimo e recebe permissões explícitas, por exemplo: abrir solicitação, criar OS, executar OS, consultar ativos e relatórios.
- `support` é perfil exclusivo da NETSECBR e não concede acesso automático aos dados de todos os clientes; o acesso deve ser concedido e registrado para cada atendimento.

## Ativos

- Um ativo pode ter localização, componentes, documentos, fotos e histórico.
- Um componente pode pertencer a um ativo; uma troca deve manter o histórico de instalação e remoção.
- Ativo inativado não pode receber novas OS sem reativação explícita.

## Solicitações

- Solicitação nasce como `Aberta` e pode ser cancelada, triada ou convertida em OS.
- A emergência exige ativo, descrição e prioridade; a categoria de especialidade deve ser informada quando conhecida.
- A solicitação não é encerrada automaticamente ao abrir uma OS: deve refletir o resultado da OS vinculada.

## Ordem de serviço

Estados: `Aberta`, `Planejada`, `Atribuída`, `Em execução`, `Aguardando material`, `Aguardando aprovação`, `Concluída`, `Cancelada`.

- Uma OS só pode iniciar com responsável definido, exceto quando uma política da organização permitir autoatendimento.
- Para concluir, é obrigatório registrar solução, tempo efetivo e resultado do checklist quando houver.
- Itens NOK devem exigir observação; se configurado, também foto ou anexo.
- Uma OS concluída não é apagada; correções relevantes são auditadas.

## Preventivas

- Planos ativos geram OS conforme periodicidade configurada.
- Preventiva atrasada permanece visível até ser concluída, cancelada com justificativa ou substituída por regra autorizada.

## Indicadores

- MTTR considera apenas OS elegíveis com tempo de reparo registrado.
- MTBF e disponibilidade exigem dados de parada/produção consistentes; no MVP serão exibidos apenas quando houver base confiável.
- Nenhum indicador deve misturar dados de organizações distintas.
