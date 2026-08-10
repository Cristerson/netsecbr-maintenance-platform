# Checklist — Ordens de serviço

Após executar `20260801210000_create_work_orders.sql`:

1. Confirme que a tabela `work_orders` aparece no Table Editor.
2. Insira uma OS usando tenant, unidade, centro de custo e ativo do mesmo cliente.
3. Tente associar uma unidade, centro de custo ou ativo de outro tenant: o banco deve recusar.
4. Entre com um usuário de outro tenant quando ele existir: ele não pode consultar nem criar OS da demonstração.
5. Confirme que uma unidade com tenant em `payment_only` não pode criar nem consultar OS.
