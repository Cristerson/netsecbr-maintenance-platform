# Administração SaaS e Cobrança

## Dois ambientes, uma plataforma

```text
NETSECBR Control Center (global)
├── Clientes / tenants
├── Contratos e licenças por robô
├── Unidades e centros de custo
├── Cobranças, PIX e cartão
├── Inadimplência, exceções e suporte
└── Consumo de banco, anexos e telemetria

Portal do Cliente (tenant isolado)
├── Suas unidades e centros de custo
├── Usuários, permissões e operação
├── Ativos, solicitações, OS e relatórios
└── Faturas e pagamentos
```

## Estado de acesso do tenant

| Estado | Acesso |
| --- | --- |
| Ativo | Acesso normal conforme permissões. |
| Tolerância | Acesso normal por até 3 dias corridos após vencimento não pago. |
| Somente pagamentos | No quarto dia, apenas pagamento e dados de cobrança. |
| Suspenso manualmente | Regra excepcional definida e auditada pela NETSECBR. |

## Dados necessários no contrato

- Tenant e responsável financeiro.
- Vigência mínima de 12 meses.
- Início de contratação e início de cobrança.
- Degustação em dias ou meses, quando concedida.
- Plano configurável e quantidade de robôs cadastrados contratada, incluindo robôs ativos e inativos.
- Valor, cobrança anual antecipada, forma de pagamento e condição comercial.
- Franquia inicial de 50 MB para arquivos do tenant.
- Centro(s) de custo associado(s) para visualização do cliente.

## Diretrizes para pagamento

Cartão e PIX devem ser processados por provedor especializado. A plataforma guarda apenas referências e status de pagamento, jamais dados completos de cartão. Webhooks do provedor atualizam as faturas e restauram ou restringem acessos de forma auditável.

## Pontos a decidir antes da implementação

1. Uma unidade terá apenas um centro de custo obrigatório ou poderá dividir custos entre vários?
2. Qual valor adicional e qual política aplicar quando o tenant ultrapassar 50 MB?
3. Como tratar cliente que reduz ou amplia a quantidade de robôs durante um contrato anual?
