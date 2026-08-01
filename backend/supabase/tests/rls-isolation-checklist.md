# Checklist de Isolamento entre Clientes

Execute após cadastrar dois usuários e dois tenants de teste.

1. Usuário do Cliente A consulta `tenants`: deve retornar somente Cliente A.
2. Usuário do Cliente A consulta `units` e `cost_centers`: não pode receber registros do Cliente B.
3. Usuário de navegação do Cliente A não cria nem altera unidade/centro de custo.
4. Administrador do Cliente A pode administrar apenas os vínculos, unidades e centros de custo do Cliente A.
5. Administrador global NETSECBR consulta todos os tenants.
6. Ao alterar o status do Cliente A para `payment_only`, usuário A continua vendo o tenant, mas não consulta unidades nem centros de custo.
7. Após retornar o status para `active`, os acessos operacionais são restaurados.

As verificações serão automatizadas quando conectarmos o frontend e a API ao Supabase.
