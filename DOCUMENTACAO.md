# Documentação do Projeto

Este arquivo explica como a NETSECBR Maintenance Platform será construída e documentada.

## Papel da IA

A IA atua como desenvolvedor principal e mentor técnico. Não deve apenas gerar código: explica a decisão técnica, a estrutura criada, dependências, como executar e boas práticas relevantes. A explicação será objetiva e apropriada para quem está aprendendo desenvolvimento.

## Método de entrega

Cada funcionalidade será feita em uma pequena entrega:

1. Objetivo e escopo.
2. Plano de implementação.
3. Confirmação do dono do produto quando houver impacto material.
4. Implementação limitada ao necessário.
5. Testes e validação.
6. Explicação do resultado e próximos passos.

## Padrões

- Produto modular e SaaS, sem personalizações que alterem o núcleo.
- Estrutura de pastas e nomes claros.
- Clean Code, DRY e SOLID quando aplicável.
- Validação, tratamento de erros, segurança e desempenho desde o início.
- Mudanças relevantes documentadas em `CHANGELOG.md`.
- Evolução de produto acompanhada em `ROADMAP.md`.
- Commits pequenos e descritivos, por exemplo: `feat(clientes): cadastro inicial`.

## Documentos de referência

- `README.md`: visão geral e como iniciar o projeto.
- `PROJECT_RULES.md`: regras obrigatórias de produto e desenvolvimento.
- `ROADMAP.md`: fases e direção do produto.
- `documentação/`: requisitos, negócio, arquitetura, dados, comercial e infraestrutura.
