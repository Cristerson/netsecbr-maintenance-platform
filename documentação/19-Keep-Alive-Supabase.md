# Keep-Alive do Supabase

## Finalidade

No ambiente gratuito de desenvolvimento e piloto, uma chamada diária mínima mantém atividade técnica no banco. Ela não consulta, cria nem modifica dados de clientes.

## Componentes

- `backend/supabase/migrations/20260801200000_create_keep_alive_function.sql`: função RPC `keep_alive` no Supabase.
- `backend/keepalive/supabase-keepalive.php`: script executado pela HostGator.
- `backend/private/keepalive-config.php`: configuração local do servidor, criada a partir do arquivo `.example` e nunca enviada ao GitHub.

## Implantação na HostGator

1. Executar a migration da função no SQL Editor do Supabase.
2. Criar `backend/private/keepalive-config.php` fora de `public_html`, preenchendo URL e chave anônima pública do Supabase.
3. Criar um Cron Job diário no cPanel para executar o arquivo `supabase-keepalive.php`.
4. Registrar apenas sucesso/erro técnico; nunca registrar chaves ou dados de clientes.

## Limites

O keep-alive é uma medida temporária de desenvolvimento/piloto. Não substitui plano pago, backups, monitoramento, continuidade de negócio ou disponibilidade contratada.
