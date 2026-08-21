# Experiência e Operação de Campo

## Princípio

A plataforma atende gestores e administradores, mas o usuário recorrente da operação é o técnico de fábrica. A interface precisa funcionar em ambiente ruidoso, com pouco tempo para digitação, uso de luvas, deslocamento e conectividade limitada.

## Ambientes

### NETSECBR Command Center

Ambiente global e exclusivo da NETSECBR para tenants, contratos SaaS, cobrança, suporte, segurança e operação da plataforma.

### Operações de Manutenção

Ambiente do cliente para ativos, solicitações, ordens de serviço, compras, fornecedores, contratos, cadastros e usuários do tenant.

### Governança e Performance

Camada executiva futura do cliente. Consolida dados rastreáveis de operação, contratos, custos, indisponibilidade, SLA, risco e planos de ação; não cria uma segunda base de dados.

## Linguagem

Usar português simples e orientado à ação. Exemplos: “O que aconteceu?”, “O que foi feito?”, “Máquina voltou a operar?”, “Adicionar foto”, “Gravar áudio”, “Solicitar peça” e “Acionar fornecedor”. Termos técnicos e administrativos só aparecem quando forem necessários para o perfil e contexto.

## Padrão visual

O produto terá um design system NETSECBR único. Ele define cores, tipografia, grade de espaçamento, ícones, botões, tabelas, formulários, badges, modais, estados vazios e hierarquia de páginas. A interface será composta por shell global, navegação agrupada por contexto, dashboards, listas e páginas de registro. Nenhum módulo cria um padrão isolado.

## Registro por voz

O técnico poderá optar por texto ou ditado. A gravação serve apenas à transcrição temporária e não é histórico operacional. A plataforma apresenta o texto em rascunho para revisão e aprovação humana. Somente o texto aprovado, a autoria, a data/hora e a origem por ditado são persistidos. O áudio é descartado após aprovação ou descarte.

## Android e conectividade

O aplicativo Android será implementado em Flutter após a estabilização do fluxo de OS e das APIs. Deve oferecer autenticação, agenda, execução de OS, checklist, foto, QR Code, ditado, notificações e sincronização posterior. O piloto industrial definirá o detalhe do modo offline, mas a arquitetura deve permitir enfileirar dados de campo localmente.
