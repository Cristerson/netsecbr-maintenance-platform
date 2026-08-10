# Checklist — Franquias por contrato

Execute após aplicar a migration `20260801201000_create_subscription_entitlements.sql`.

1. No SQL Editor, confirme que `entitlement_definitions` possui os cinco limites iniciais.
2. Localize a assinatura ativa da `NETSECBR Demonstração` e inclua uma franquia vigente de `work_orders.monthly` com `limit_value = 500`.
3. Tente inserir outra franquia vigente com o mesmo `subscription_id` e `entitlement_code`; o banco deve recusar.
4. Encerre a franquia anterior preenchendo `effective_to` e crie uma nova. O histórico deve permanecer consultável.
5. Entre com um usuário de outro tenant quando ele existir: ele não pode consultar nem alterar a franquia da demonstração.

> Para os limites de robôs e armazenamento, quando não houver registro nesta tabela, a aplicação usa os valores salvos na própria assinatura.
