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
- Migration de catálogo de franquias e limites personalizados por contrato, com vigência e RLS.
- Login inicial do frontend com Supabase Auth, perfil e tenant do usuário autenticado.
- Controle para mostrar ou ocultar a senha na tela de login.
- Fluxo de recuperação de senha por e-mail, com definição segura de nova senha.
- Migration inicial de ordens de serviço, com validação de escopo multi-tenant, índices e RLS.
- Painel passou a consultar ativos e ordens de serviço reais do tenant autenticado; dados fictícios foram removidos.
- Migration de fornecedores, políticas de SLA e acionamentos vinculados às ordens de serviço.
- Migration de ficha técnica, custos, peças, regras e eventos de monitoramento.
- Complemento de fundação financeira, auditoria e política configurável de expiração de senha.
- Migration de identidade visual por tenant, preparada para logo, cores e cabeçalho de relatórios.
- Bucket privado e políticas de Storage para logos personalizados por tenant.
- CRUD inicial de usuários e permissões no painel do cliente, com ativação e desativação de acesso.
- Edge Function segura para criação de usuários sem expor chaves administrativas ao frontend.
- Domínios corporativos autorizados por tenant para impedir cadastros com e-mails não contratados.
- Padrão visual de ações com ícones, dicas de contexto e botões compactos no módulo administrativo.
- Redefinição administrativa de senha com confirmação, e-mail de recuperação, obrigatoriedade de troca no próximo acesso e auditoria.
- Controle de acesso do menu lateral baseado no perfil global, perfil do tenant e permissões concedidas.
- CRUD de Unidades e Centros de Custo no painel do cliente, com edição, validação, isolamento por tenant e desativação sem exclusão de histórico.
- Painel Financeiro do Cliente em modo consulta, exibindo contrato, plano, franquias, faturas e pagamentos reais do tenant.
- CRUD completo de ativos e robôs no painel do cliente, com cadastro, edição, ativação/desativação, exclusão lógica, busca e vínculo com categoria, unidade e centro de custo.
- CRUD completo de ordens de serviço no painel do cliente, com cadastro, edição, filtro por status, fluxo de mudança de status (fluxo de trabalho), vínculo com ativo, unidade, centro de custo e responsável, e data programada.
- Migration de solicitações de manutenção com validação de escopo multi-tenant, RLS e conversão em ordem de serviço.
- CRUD completo de solicitações de manutenção no painel do cliente, com abertura, triagem, cancelamento, conversão em ordem de serviço e filtro por status.
- Migration de requisições de compra e itens, vinculadas à OS, com validação de escopo multi-tenant, RLS e fornecedor sugerido opcional.
- Tela de requisições dentro da OS, com inclusão de materiais ou serviços, quantidades, valor estimado e consulta do andamento inicial.
- Painel central de Compras para acompanhar as requisições do tenant e registrar aprovação, envio ao fornecedor e recebimento.
- Sincronização automática entre requisições de compra e OS: materiais pendentes deixam a OS em aguardando material; o recebimento libera a execução novamente.
- Consulta ao catálogo oficial de ABB, KUKA, FANUC e Yaskawa a partir da requisição, aberta em janela separada para preservar o contexto da OS.
