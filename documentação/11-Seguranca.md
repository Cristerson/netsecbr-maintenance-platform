# Segurança e Privacidade

## Controles mínimos

- Autenticação forte, sessões com expiração e rotação de tokens.
- Autorização por função e escopo de organização em todas as rotas.
- Um tenant em modo de inadimplência só pode acessar rotas estritamente necessárias para pagamento; isso deve ser validado no servidor, não só na interface.
- Acesso de suporte NETSECBR a um tenant deve exigir contexto de atendimento, ser limitado no tempo e gerar auditoria.
- Criptografia em trânsito (HTTPS) e proteção adequada de segredos.
- Auditoria para ações administrativas e mudanças em OS.
- Backups testados do banco e armazenamento de arquivos.
- Validação de uploads: tipo, tamanho, antivírus quando o ambiente de produção exigir.
- Redefinição administrativa de senha somente por Edge Function: ela valida o administrador, o tenant e o usuário alvo antes de solicitar o e-mail de recuperação.
- A plataforma não cria nem exibe senha temporária. A alteração é feita pelo próprio usuário por link temporário do Supabase Auth.
- O campo `must_change_password` bloqueia o acesso operacional até a definição de uma nova senha. A solicitação e a conclusão são registradas em `audit_logs`.
- CORS das Edge Functions deve permitir apenas origens explicitamente aprovadas. Em produção, incluir `https://app.netsecbr.com.br` e manter origens localhost somente para desenvolvimento.

## Privacidade

Dados de pessoas, como nomes e desempenho de técnicos, serão tratados somente para finalidades operacionais legítimas e com políticas de retenção. A adequação à LGPD será validada antes da comercialização.

## Incidentes

Definir processo para revogar sessões, investigar logs, restaurar backup e comunicar clientes afetados conforme a gravidade e obrigações aplicáveis.
