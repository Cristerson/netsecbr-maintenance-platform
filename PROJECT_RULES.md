# Regras do Projeto

Este arquivo orienta todas as decisões de produto e desenvolvimento da NETSECBR Maintenance Platform.

## Forma de desenvolvimento

1. Atuar como engenheiro de software sênior e mentor técnico: explicar decisões de forma breve e clara, sem esconder lógica relevante.
2. Construir em pequenas entregas. Cada entrega deve ter objetivo, planejamento, implementação, testes, validação e próximos passos.
3. Antes de uma mudança de impacto material, apresentar o plano e aguardar confirmação do dono do produto.
4. Nunca reescrever o projeto inteiro, remover arquivos importantes ou alterar funcionalidades existentes sem comunicar.
5. Manter Clean Code, evitar duplicidade, aplicar SOLID quando fizer sentido, validar entradas, tratar erros e considerar segurança e desempenho.
6. Manter `README.md`, `CHANGELOG.md`, `ROADMAP.md` e `DOCUMENTACAO.md` atualizados em cada entrega relevante.
7. Sugerir commits pequenos e descritivos, no formato `tipo(escopo): descrição`.

## Produto

1. A plataforma é um SaaS de gestão de ativos e manutenção industrial; robótica é um segmento prioritário, não uma limitação.
2. A simplicidade operacional tem prioridade sobre recursos sofisticados sem validação de cliente.
3. O MVP deve entregar valor antes de IIoT, IA, compras avançadas ou integrações complexas.
4. Interface, mensagens e documentação de usuário devem estar em português do Brasil.
5. A visão original deve ser preservada: controlar ativos e manutenção programada/emergencial, inventário, peças, equipe, relatórios e, futuramente, dados automáticos de máquinas.
6. Cada cliente poderá configurar campos, checklists, categorias, fluxos autorizados e visões, sem comprometer a integridade do produto SaaS.
7. A NETSECBR administra a plataforma em um painel global; cada cliente opera somente seu tenant isolado.
8. Cobrança, vigência, período de degustação, bloqueio por inadimplência e acesso a pagamentos são regras de servidor, auditáveis e nunca apenas regras visuais.
9. O custo de dados faz parte do produto: anexos, histórico e telemetria devem ter medição e políticas de retenção por tenant.
10. O início usará um banco PostgreSQL compartilhado. Toda consulta e alteração deve ser limitada pelo `tenant_id`; `unit_id` e `cost_center_id` devem estar presentes quando a natureza do registro exigir.
11. Planos comerciais e limites de robôs são dados configuráveis do painel NETSECBR, nunca valores fixos no código. Contratos guardam uma cópia das condições contratadas.
12. Limites comerciais devem ser independentes por dimensão (robôs, arquivos, ordens de serviço, usuários e módulos). Um contrato pode sobrescrever o plano padrão sem alterar código.

## Tecnologia prevista

- Backend: .NET (C#), API REST e SignalR quando tempo real for necessário.
- Web: React com Next.js e TypeScript.
- Dados: PostgreSQL; nomes técnicos e tabelas em inglês.
- Aplicativo: Flutter, após validação do fluxo web/mobile de campo.
- Infraestrutura: containers Docker; armazenamento de arquivos compatível com S3.

## Qualidade e segurança

1. Todo dado de negócio deve pertencer a uma organização (tenant) e ser filtrado por ela.
2. Usar autenticação segura com tokens de curta duração e renovação; senhas nunca são armazenadas em texto puro.
3. Manter trilha de auditoria para ações relevantes e adotar exclusão lógica quando aplicável.
4. Validar autorização no servidor, mesmo que a tela já esconda uma ação.
5. Alterações de banco devem ser versionadas por migration e reversíveis quando possível.
6. APIs devem ser documentadas e testadas. Novas regras relevantes exigem testes automatizados.
7. Não introduzir dependências, serviços pagos ou integrações externas sem decisão explícita do dono do produto.

## Forma de trabalhar

1. Antes de desenvolver uma funcionalidade, localizar seu requisito no PRD e suas regras no documento de negócio.
2. Em caso de conflito entre documentos, a Visão do Produto define direção; registrar a decisão antes de implementar.
3. Alterações que ampliem materialmente o escopo devem ser adicionadas ao backlog, não incorporadas silenciosamente ao MVP.
4. Nenhum arquivo dentro de `sources/` pode ser alterado.
