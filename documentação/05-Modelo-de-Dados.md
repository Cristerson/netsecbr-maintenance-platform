# Modelo de Dados

## Convenções

- Tabelas e campos técnicos em inglês, no formato `snake_case`.
- Chaves primárias UUID.
- Todas as tabelas de negócio têm `tenant_id`, datas de criação/alteração e, quando aplicável, exclusão lógica.
- Registros ligados à operação devem usar `unit_id`; registros com visão financeira, contratação ou consumo devem usar `cost_center_id` quando aplicável.

## Entidades principais

| Entidade | Descrição | Relações principais |
| --- | --- | --- |
| Tenant | Cliente contratante e ambiente isolado. | unidades, usuários, contrato, ativos, OS. |
| Unit | Unidade operacional do tenant. | centro de custo, áreas, ativos. |
| CostCenter | Centro de custo da unidade. | unidade, relatórios e contrato. |
| Subscription | Contrato SaaS do tenant. | plano, vigência, cobrança, licença e status. |
| SubscriptionPlan | Catálogo configurável de pacotes comerciais. | limite de robôs, preço, situação e vigência comercial. |
| Subscription | Contrato anual que preserva uma cópia do plano e das condições contratadas. | tenant, plano, vigência e cobrança. |
| SubscriptionEntitlement | Limite configurável ou franquia adicional específica do contrato. | contrato, tipo de limite, quantidade e período. |
| LicenseAllocation | Quantidade licenciada por unidade/tipo de ativo. | assinatura, unidade, robôs ativos. |
| Invoice / Payment | Fatura e liquidação financeira. | assinatura, provedor de pagamento. |
| Profile | Perfil global de pessoa autenticada. | conta Supabase Auth, papel NETSECBR ou cliente. |
| TenantMembership | Vínculo de uma pessoa a um tenant. | tenant, perfil, papel administrador/navegação. |
| PermissionCatalog / MembershipPermission | Permissões configuráveis pelo administrador. | vínculo de usuário e ação permitida. |
| Client / Site / Area / ProductionLine | Hierarquia de localização. | ativos. |
| Asset | Máquina, robô ou elemento controlado. | localização, componentes, OS, planos. |
| AssetCategory | Categoria configurável por tenant; identifica se o ativo é robô. | tenant e ativos. |
| AssetComponent | Componente rastreável. | ativo, histórico de instalação. |
| ServiceRequest | Solicitação de manutenção. | ativo, solicitante, OS. |
| WorkOrder | Ordem de serviço. | ativo, solicitação, responsáveis, checklist. |
| MaintenancePlan | Plano de preventiva. | ativos, modelo de checklist, OS geradas. |
| ChecklistTemplate / ChecklistResponse | Modelo e execução de checklist. | plano ou OS. |
| Attachment | Metadados de arquivo. | ativo, solicitação, OS ou checklist. |
| AuditLog | Evento relevante e imutável. | usuário e recurso afetado. |
| DataUsageSnapshot | Medição periódica de dados e arquivos por tenant. | tenant, custos e retenção. |

## Relações de referência

```text
Tenant → SubscriptionPlan → Subscription → Invoice / Payment
Subscription → SubscriptionEntitlement
Tenant → Unit → CostCenter → Area → ProductionLine → Asset → AssetComponent
Tenant → AssetCategory → Asset
Tenant → TenantMembership → Profile → Auth User
TenantMembership → MembershipPermission → PermissionCatalog
Asset → ServiceRequest → WorkOrder → ChecklistResponse
Asset → MaintenancePlan → WorkOrder
WorkOrder → Attachment / AuditLog
```

## Futuro

Estoque, peças, compras, telemetria e alarmes serão modelados como módulos separados, ligados por `tenant_id`, `unit_id` quando aplicável e `asset_id` quando necessário. Anexos e telemetria terão políticas de retenção e métricas de consumo, para controlar o custo crescente de armazenamento.
