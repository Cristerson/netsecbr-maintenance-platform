# NETSECBR Maintenance Platform

Plataforma SaaS brasileira para gestão de manutenção e ativos industriais (CMMS/EAM), criada pela NETSECBR.

## Objetivo

Oferecer às indústrias uma solução simples de operar e robusta para controlar ativos, solicitações, ordens de serviço, planos preventivos, equipes, peças, custos e indicadores. A evolução prevista inclui aplicativo móvel, integração IIoT e inteligência artificial.

## Local oficial do projeto

O repositório de trabalho da NETSECBR deverá ficar em:

`D:\NetsecBR\Sistema de Gestão Robos`

O diretório atual é um ambiente temporário de desenvolvimento. No momento apropriado, o código e a documentação serão transferidos para o local oficial e publicados em um repositório privado no GitHub, sem a pasta de referências `sources/`.

## Princípios do produto

- Interface em português, adequada à realidade da manutenção industrial brasileira.
- Multiempresa e segregação rigorosa dos dados por cliente.
- Rastreabilidade completa de ativos, intervenções, peças, custos e evidências.
- Mobile-first para o time de campo.
- Evolução modular: validar o núcleo antes de adicionar IIoT e IA.

## Documentação

| Documento | Propósito |
| --- | --- |
| [Visão do Produto](documentação/01-Visao-do-Produto.md) | Problema, público, proposta de valor e escopo. |
| [PRD](documentação/02-PRD.md) | Requisitos do produto e definição do MVP. |
| [Regras de Negócio](documentação/03-Regras-de-Negocio.md) | Regras e fluxos operacionais. |
| [Arquitetura](documentação/04-Arquitetura-da-Solucao.md) | Diretrizes técnicas e decisões iniciais. |
| [Modelo de Dados](documentação/05-Modelo-de-Dados.md) | Entidades, relações e convenções. |
| [APIs](documentação/06-APIs.md) | Padrões de API e recursos iniciais. |
| [Frontend](documentação/07-Frontend.md) | Experiência web e perfis de acesso. |
| [Mobile](documentação/08-Mobile.md) | Escopo do aplicativo de campo. |
| [IIoT](documentação/09-IIoT.md) | Estratégia de integração industrial. |
| [Inteligência Artificial](documentação/10-Inteligencia-Artificial.md) | Casos de uso e limites. |
| [Segurança](documentação/11-Seguranca.md) | Controles de segurança e privacidade. |
| [Backlog](documentação/12-Backlog.md) | Épicos e histórias iniciais. |
| [Roadmap](documentação/13-Roadmap.md) | Fases de evolução. |
| [Padrões de Código](documentação/14-Padroes-de-Codigo.md) | Convenções de desenvolvimento. |
| [Modelo Comercial](documentação/15-Modelo-Comercial.md) | Hipótese inicial de planos SaaS. |
| [Administração SaaS e Cobrança](documentação/16-Administracao-SaaS-e-Cobranca.md) | Tenants, licenças, pagamentos e inadimplência. |
| [Migração para VPS](documentação/17-Plano-de-Migracao-para-VPS.md) | Arquitetura inicial, gatilhos e checklist de evolução. |
| [LGPD e Privacidade](documentação/18-LGPD-e-Privacidade.md) | Princípios, dados tratados e controles de privacidade. |
| [Keep-Alive Supabase](documentação/19-Keep-Alive-Supabase.md) | Atividade diária temporária para desenvolvimento e piloto. |

Leia também [PROJECT_RULES.md](PROJECT_RULES.md) antes de propor ou alterar código.

## Como desenvolvemos

O projeto é construído em pequenas entregas, com plano, implementação, testes, validação e explicação técnica. Consulte [DOCUMENTACAO.md](DOCUMENTACAO.md), [ROADMAP.md](ROADMAP.md) e [CHANGELOG.md](CHANGELOG.md).
