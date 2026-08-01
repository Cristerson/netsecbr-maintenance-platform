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

## Privacidade

Dados de pessoas, como nomes e desempenho de técnicos, serão tratados somente para finalidades operacionais legítimas e com políticas de retenção. A adequação à LGPD será validada antes da comercialização.

## Incidentes

Definir processo para revogar sessões, investigar logs, restaurar backup e comunicar clientes afetados conforme a gravidade e obrigações aplicáveis.
