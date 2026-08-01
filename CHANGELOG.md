# Changelog

Todas as mudanças relevantes do projeto serão registradas aqui.

## Não publicado

### Adicionado

- Estrutura documental do produto SaaS NETSECBR Maintenance Platform.
- Painel web inicial para ativos e ordens de serviço.
- Identidade visual inicial da NETSECBR e logotipo oficial local.
- Definição de tenants, unidades, centros de custo, pacotes de licença, cobrança e inadimplência.
- Estratégia Supabase + HostGator e plano de migração para VPS.
- Migration inicial do Supabase para tenants, unidades e centros de custo, com RLS habilitado.
- Migration de perfis, papéis, vínculos por tenant e permissões configuráveis.
- Políticas RLS para isolamento entre tenants e checklist de validação de acesso.
- Correção preventiva que impede usuário comum de alterar o próprio papel global.
- Migration de categorias, ativos e robôs com validação de tenant/unidade/centro de custo e exclusão lógica.
- Migration de planos configuráveis e contratos anuais, sem dados de cartão.
- Diretrizes iniciais de LGPD e privacidade.
- Keep-alive diário preparado para Supabase em ambiente de desenvolvimento/piloto.
- Modelo de plano e contrato de demonstração com 10 robôs e 50 MB.
- Modelo reutilizável para promover o primeiro administrador global NETSECBR.
- Modelo transacional para criar um tenant de demonstração com centro de custo, unidade e administrador.
