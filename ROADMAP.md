# Roadmap Resumido

O roadmap detalhado está em `documentação/13-Roadmap.md`.

## Princípio de experiência do usuário

Toda funcionalidade deve ser pensada para usuários com pouca familiaridade digital: linguagem simples, passos guiados, poucas decisões por tela, ações com efeito claro e retorno visual imediato. O MARV deve ser operacional e lúdico na medida certa, sem esconder regras importantes de manutenção e governança.

## Agora — Fundação

- Documentação, identidade visual e protótipo web.
- Modelo SaaS, tenants, perfis, isolamento de dados, contratos e franquias personalizadas estruturados no Supabase.

## Próxima entrega — Consolidação do MVP operacional

- Validar ponta a ponta ativos, solicitações, OS, preventivas, usuários e permissões
  (roteiro de aceite em `documentação/14_Roteiro_Aceite_MVP_V1.md`).
- Consolidar o design system e a navegação de Operações de Manutenção.
- Revisar o NETSECBR Command Center como ambiente global distinto.
- Produzir o Manual de Operação do MVP V1, com passos, telas, dependências,
  permissões, impactos e validações de cada rotina operacional.
- Publicar somente entregas concluídas, mantendo módulos em construção fora dos commits.
- Antes de qualquer publicação ou produção, executar auditoria de segurança e privacidade:
  revisão de chamadas externas, credenciais, dependências, scripts, RLS, grants, RPCs,
  Edge Functions, CORS e diffs do Git. Nenhuma entrega segue sem essa validação.

- Atualizar automaticamente os dados exibidos após ações relevantes, sem exigir F5,
  priorizando a usabilidade de técnicos em campo.

## Em seguida — Operação de manutenção

- Contratos e responsabilidade externa de equipamentos.
- Custos, indisponibilidade, SLA e evidências na OS.
- Painel operacional e início da Governança e Performance.

## Evolução

- Pagamentos, notificações, app Android Flutter, estoque e peças.
- Ditado de campo com transcrição temporária e aprovação humana.
- Integrações IIoT, IA e migração planejada para VPS.
