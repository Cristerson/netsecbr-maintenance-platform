# MARV — Conteúdo técnico e comercial para site institucional

> **Uso deste documento:** base para a página institucional da NetSecBR. Não contém preços.
> **Legenda:** **[Confirmado]** existe no projeto atual; **[Em desenvolvimento]** possui direção definida, mas não deve ser vendido como disponível; **[Futuro/Sugestão]** é hipótese de evolução ou de oferta e depende de validação do responsável pelo produto.

---

## 1. Definição do MARV em uma frase

**MARV — Maintenance & Automation Robotic Verification** é a solução NetSecBR para governar a manutenção de ativos robotizados, organizando solicitações, ordens de serviço, preventivas, custos, histórico técnico e acessos em um único ambiente.

> **Precisão comercial:** no estágio atual, “orquestração” significa orquestração de processos de manutenção e governança — **não** comando automático ou remoto do controlador do robô.

## 2. Resumo curto para a página inicial (até 40 palavras)

O MARV centraliza a gestão da manutenção de ativos robotizados: solicitações, ordens de serviço, preventivas, custos, histórico técnico, indicadores e governança de acesso para operações industriais que precisam de rastreabilidade e decisão organizada.

## 3. Texto institucional para a página do MARV (até 120 palavras)

O MARV é a plataforma da NetSecBR para estruturar a gestão de manutenção em ambientes com robôs e equipamentos industriais. A solução organiza o ciclo completo entre solicitação, triagem, ordem de serviço, execução, custos, conclusão e manutenção preventiva. Com cadastro de ativos, unidades, centros de custo, fornecedores, usuários e permissões, o MARV transforma registros dispersos em histórico operacional rastreável. Seus painéis mostram pendências, preventivas atrasadas, ativos parados e prioridades de atendimento. O foco é dar visibilidade para supervisores, equipes de manutenção e gestores, mantendo regras de acesso e preservando a cadeia de auditoria. O MARV não substitui o controlador do robô: ele governa os processos de manutenção ao redor da operação.

## 4. Problema de negócio que resolve

**[Confirmado]** Em muitas operações, a manutenção de robôs e equipamentos depende de mensagens, planilhas, anotações isoladas e conhecimento individual. Isso dificulta priorizar paradas, comprovar o que foi feito, estimar custos, manter preventivas em dia e preservar o histórico de um ativo.

O MARV organiza esse fluxo para que a empresa consiga:

- registrar a falha antes de ela virar trabalho informal;
- classificar, priorizar e direcionar atendimentos;
- manter diagnóstico, causa, ação e recomendação vinculados ao ativo;
- acompanhar preventivas e pendências operacionais;
- registrar custos finais de serviço e materiais;
- aplicar permissões, bloqueios e histórico de mudanças.

## 5. Tipos de robôs e ambientes atendidos

**[Confirmado]** O MARV cadastra ativos industriais genéricos e categorias identificadas como robô, com fabricante, modelo, número de série, criticidade, unidade, centro de custo e situação operacional. Isso o torna aplicável a robôs industriais, células robotizadas e equipamentos periféricos cadastrados como ativos.

**Ambientes aderentes:** linhas de manufatura, células robotizadas, áreas de solda, montagem, movimentação/manipulação, processos automatizados, utilidades industriais e operações com equipamentos críticos.

**Limite atual:** o sistema não possui conectores nativos confirmados para marcas específicas nem leitura direta de controlador. Marcas como ABB, FANUC, KUKA ou outras podem ser registradas no cadastro do ativo, mas isso não representa integração técnica com seus controladores.

## 6. Público-alvo e segmentos mais adequados

**Público principal:** supervisores de manutenção, engenharia de manutenção, líderes de produção, gestores de operações, equipes de automação/robótica e administradores de planta.

**Segmentos mais aderentes:**

- indústrias com células robotizadas ou ativos de automação críticos;
- fabricantes seriados e fornecedores automotivos;
- metalmecânica, solda, montagem, embalagem e intralogística industrial;
- operações que precisam separar unidades, centros de custo e responsáveis;
- empresas que desejam implantar disciplina de manutenção antes de conectar telemetria industrial.

## 7. Funcionalidades disponíveis atualmente

### Gestão operacional de manutenção — **[Confirmado]**

1. Cadastro e organização de ativos, categorias, unidades, centros de custo e fornecedores.
2. Abertura de solicitações de manutenção com prioridade, categoria, unidade, ativo e descrição.
3. Triagem de supervisor, estimativa de serviços e materiais e conversão de solicitação em ordem de serviço.
4. Ordens de serviço com responsável, prioridade, diagnóstico, causa raiz, ação executada, recomendação e registro de parada.
5. Regras de conclusão e cancelamento: motivo obrigatório quando aplicável, data/hora de fechamento e bloqueio de reabertura indevida.
6. Registro de custos reais finais de serviços e materiais na OS concluída.
7. Planos preventivos por ativo, periodicidade, próxima execução, responsável e geração de OS preventiva.
8. Dashboard com OS abertas, preventivas atrasadas, ativos em parada, ordens prioritárias, próximas preventivas e saúde dos ativos.
9. Usuários, permissões, senha temporária, troca obrigatória de senha e recuperação de acesso.
10. Ajuda e manual de operação dentro da plataforma.

### Governança SaaS e administração global — **[Confirmado, uso interno NetSecBR]**

- MARV Command Center para visão de clientes, contratos, planos, franquias e equipe da plataforma;
- gestão de Proprietários e Administradores da plataforma;
- registro de alterações relevantes em auditoria;
- controle de tenants/empresas isoladas.

## 8. Recursos para destaque em cards do site

| Recurso | Descrição curta | Situação |
| --- | --- | --- |
| Ativos e células organizados | Centraliza robôs e equipamentos por unidade, centro de custo, criticidade e situação. | Confirmado |
| Solicitação à OS | Estrutura o caminho entre problema reportado, triagem, aprovação e execução. | Confirmado |
| Histórico técnico | Mantém diagnóstico, causa raiz, ação, recomendações, responsável e parada associados à OS. | Confirmado |
| Preventivas programadas | Agenda atividades por periodicidade e gera a OS preventiva quando necessário. | Confirmado |
| Custos de manutenção | Registra serviços, materiais e total consolidado da OS. | Confirmado |
| Dashboard operacional | Dá visibilidade para OS prioritárias, ativos em parada e preventivas atrasadas. | Confirmado |
| Acesso por perfil | Diferencia consulta, administração do cliente e administração global da plataforma. | Confirmado |
| Auditoria e bloqueios | Protege conclusão, cancelamento, contas e alterações administrativas relevantes. | Confirmado |
| Conectividade industrial | Coleta de alarmes, ciclos e dados de controlador. | Futuro/Sugestão |

## 9. Fluxo operacional

| Etapa | Como o MARV atua hoje | Situação |
| --- | --- | --- |
| Cadastro | Cadastra unidades, centros de custo, ativos, categorias, fornecedores e usuários. | Confirmado |
| Conexão com robô/controlador | Não há conexão direta implementada. | Futuro/Sugestão |
| Monitoramento | Consolida situação cadastrada do ativo, OS abertas, paradas e preventivas; não coleta sinal contínuo do robô. | Confirmado, baseado em registros operacionais |
| Comando | Orquestra solicitações, responsáveis, OS e preventivas; não envia comando para robôs. | Confirmado para processo; não disponível para controlador |
| Alertas | Evidencia preventivas atrasadas, OS prioritárias e ativos em parada no dashboard. Não há alerta industrial automático/push confirmado. | Confirmado para indicadores visuais |
| Histórico | Preserva solicitações, OS, classificações técnicas, custos, fechamento, cancelamento e auditoria. | Confirmado |

## 10. Arquitetura simplificada da solução

**[Confirmado]** O projeto atual é uma aplicação web multiempresa, com frontend React/TypeScript e serviços Supabase para autenticação, banco de dados, regras de acesso, funções de servidor e armazenamento estruturado de dados.

```text
Usuários autorizados (navegador)
             │ HTTPS
             ▼
Frontend MARV — React + TypeScript + Vite
             │
             ├── Supabase Auth: login, sessão, recuperação e senha temporária
             ├── Supabase Database/Postgres: ativos, solicitações, OS, preventivas e custos
             ├── RLS e funções/RPC: isolamento por cliente e regras de governança
             └── Edge Functions: operações administrativas protegidas de usuários/senhas

Painéis MARV ──► dados operacionais e históricos por tenant/cliente
```

### Sugestão de topologia visual para o site

```text
                 ┌──────────────────────────────┐
                 │        MARV Cloud             │
                 │  Gestão, histórico, regras    │
                 └──────────────┬───────────────┘
                                │ HTTPS
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
  Supervisor/gestor      Manutenção/produção     NetSecBR Command Center
  Dashboard e decisão    Solicitações e OS       Governança SaaS

  [Futuro] Coletor/edge industrial ── OPC UA/Modbus/MQTT ── Robôs e controladores
```

> A última linha é **futura**. Não deve aparecer como arquitetura entregue sem um conector industrial efetivamente implantado.

## 11. Tecnologias, protocolos e integrações

### Tecnologias confirmadas

- React, TypeScript e Vite no frontend;
- Supabase JavaScript Client;
- Supabase Auth;
- PostgreSQL/Supabase Database;
- Row Level Security (RLS), funções PostgreSQL/RPC e Edge Functions;
- Lucide React para iconografia de interface;
- comunicação web via HTTPS entre navegador e serviços da plataforma.

### Protocolos e integrações industriais

**Não disponíveis atualmente:** OPC UA, Modbus, MQTT, EtherNet/IP, Profinet, DeviceNet, integração com controlador, leitura de alarmes, coleta de ciclos ou comandos remotos.

**[Futuro/Sugestão]** Um coletor/edge industrial pode ser avaliado para esse cenário, desde que haja requisitos de rede, modelo de dados, segurança, evidências e aprovação humana para decisões operacionais.

## 12. Requisitos de infraestrutura, rede e segurança

### Para o uso atual — **[Confirmado]**

- navegador moderno em computador ou tablet;
- conectividade HTTPS com o ambiente hospedado do MARV/Supabase;
- contas individuais de usuário; não compartilhar credenciais;
- cadastro inicial de unidades, centros de custo, ativos e equipe responsável;
- definição de perfis e permissões antes da operação.

### Para futura integração industrial — **[Futuro/Sugestão]**

- avaliação conjunta de rede OT/IT, segmentação, firewall e rotas;
- acesso somente leitura quando possível;
- nenhum comando ao controlador sem aprovação explícita de engenharia, segurança e operação;
- inventário dos controladores, protocolos e dados autorizados;
- política de retenção, suporte e atualização do componente edge.

## 13. Controle de acesso, auditoria e rastreabilidade

**[Confirmado]**

- isolamento lógico dos dados por cliente/tenant;
- perfis de navegação, administração do cliente e administração NetSecBR;
- permissões por ação, com telas e ações ocultadas ou bloqueadas conforme o acesso;
- senha temporária e troca obrigatória no primeiro acesso quando administrada pelo sistema;
- recuperação de senha;
- bloqueio para impedir que uma pessoa desative a própria conta ou deixe o cliente sem administrador ativo;
- bloqueios para evitar reabertura indevida de OS concluída ou cancelada;
- registro de quem cancelou, quando e por quê;
- histórico técnico preservado por ativo/OS e ações administrativas relevantes registradas em auditoria.

## 14. Monitoramento, indicadores, dashboards e alertas disponíveis

**[Confirmado]** O dashboard operacional apresenta:

- quantidade de OS abertas e destaque para prioridades;
- preventivas atrasadas;
- ativos em parada ou manutenção;
- próximas preventivas, incluindo rótulos como hoje, amanhã ou atrasada;
- saúde dos ativos por situação;
- atualização dos dados ao retornar à Visão geral, sem exigir F5.

**Limite importante:** esses indicadores são derivados dos registros do MARV. Eles não equivalem a monitoramento de telemetria em tempo real, alarmes de controlador ou disponibilidade calculada automaticamente por sensor.

## 15. Diferenciais em relação ao gerenciamento individual de cada robô

- visão única de ativos, unidades, centros de custo, solicitações e OS;
- processo padronizado entre operação, supervisor e manutenção;
- histórico técnico e de custos ligado ao ativo, não a uma pessoa ou planilha;
- preventivas com periodicidade e evidência de execução;
- visibilidade de pendências e paradas em dashboard;
- governança de acesso e preservação de histórico;
- estrutura multiempresa para separar dados de clientes.

## 16. Benefícios operacionais

1. **Mais organização:** reduz dispersão entre mensagens, arquivos e controles informais.
2. **Decisão mais contextualizada:** reúne prioridade, criticidade, parada, diagnóstico, causa e custo na mesma rotina.
3. **Rastreabilidade:** facilita consultar o que ocorreu, quem atuou e qual decisão foi tomada.
4. **Disciplina preventiva:** destaca atividades vencidas e transforma planos em OS rastreáveis.
5. **Governança:** aplica perfis, regras de fechamento e preservação de histórico.
6. **Escalabilidade operacional:** permite organizar diferentes unidades, ativos e centros de custo dentro do mesmo ambiente do cliente.

## 17. Casos de uso e cenários demonstráveis

### Cenários demonstráveis hoje — **[Confirmado]**

1. **Falha em ativo robotizado:** operador abre solicitação; supervisor faz triagem; a solicitação vira OS; a equipe registra diagnóstico, causa, ação, parada e conclusão.
2. **Preventiva de rotina:** gestor cadastra atividade periódica para um ativo; o painel destaca vencimento; o responsável gera a OS preventiva e a próxima data é recalculada.
3. **Parada de produção:** supervisor registra início e fim de parada na OS, mantém recomendação e consulta o histórico posterior do ativo.
4. **Controle de custo:** após conclusão, o supervisor registra serviços e materiais e mantém o total associado à OS.
5. **Governança de usuários:** administrador cria usuário, define permissões, concede senha temporária e preserva restrições administrativas.
6. **Operação multiunidade:** empresa organiza ativos por unidade e centro de custo, usando filtros e listas para localizar atendimentos.

## 18. Limitações atuais e condições para implantação

### Limitações atuais — **[Confirmado]**

- não conecta diretamente a robôs, PLCs, controladores ou redes industriais;
- não envia comandos a robôs;
- não possui telemetria contínua, leitura automática de alarmes, ciclos, temperatura, vibração, corrente ou horas de operação;
- não oferece predição automática de falhas nem IA decisória no MVP;
- compras, estoque, catálogo de peças, part numbers e operação de ERP estão fora do escopo atual;
- o apontamento técnico/conclusão é, no MVP atual, um fluxo controlado pelo administrador/supervisor; execução móvel de campo é evolução futura.

### Condições mínimas de implantação

- definição de responsável pelo cadastro e pela triagem;
- base inicial de ativos, unidades e centros de custo;
- critérios de prioridade, criticidade e status;
- definição de usuários, administradores e permissões;
- plano inicial de preventivas;
- treinamento de operação e disciplina de atualização de registros.

## 19. Modelo de implantação

**[Confirmado no projeto]** O MARV opera como aplicação web SaaS/cloud, com dados segregados por cliente e acesso por navegador.

**[Não implementado]** Não há versão local on-premises, agente edge ou topologia híbrida comprovada no projeto atual.

**[Futuro/Sugestão]** Uma implantação híbrida com coletor edge pode ser considerada para integração OT, desde que seja desenhada por cliente e aprovada tecnicamente.

## 20. Serviços que a NetSecBR pode oferecer junto ao MARV

> **[Sugestão comercial — confirmar portfólio e escopo antes de publicar]**

- diagnóstico inicial do processo de manutenção e do cadastro de ativos;
- implantação da estrutura de unidades, centros de custo e perfis de acesso;
- importação inicial de ativos por modelo de planilha disponível no projeto;
- configuração de planos preventivos e critérios de prioridade;
- treinamento de supervisores, técnicos e administradores;
- apoio à definição de indicadores operacionais e rotina de análise;
- suporte à governança de acesso e organização de evidências;
- estudo de viabilidade para futura integração entre IT/OT, telemetria e edge.

## 21. Perguntas frequentes

### O MARV controla o robô diretamente?

Não. Atualmente o MARV governa processos de manutenção: registros, prioridades, OS, preventivas, custos, histórico e acesso. Comando remoto de robô não é uma funcionalidade entregue.

### O sistema funciona para diferentes fabricantes?

Sim, o cadastro permite registrar fabricante, modelo, série e categoria do ativo. Isso não significa integração nativa com controladores de cada fabricante.

### O MARV substitui nosso ERP?

Não. O escopo atual é gestão de manutenção e governança operacional. Compras, estoque, catálogo de peças e integração profunda com ERP são evoluções futuras.

### Posso separar unidades e centros de custo?

Sim. A estrutura organizacional faz parte do cadastro e é usada em ativos, solicitações e ordens de serviço.

### Há manutenção preventiva?

Sim. É possível criar planos por ativo, periodicidade, próxima execução e responsável, além de gerar uma OS preventiva a partir do plano.

### O sistema guarda histórico?

Sim. Solicitações, OS, apontamentos, custos, cancelamentos e informações do ativo ficam registrados. OS concluídas e canceladas têm regras de bloqueio para preservar o histórico.

### É possível dar acesso somente para consulta?

Sim. O modelo de permissões diferencia usuários de consulta e administradores, restringindo menus e ações conforme o perfil.

### O MARV prevê falhas automaticamente?

Não no MVP atual. Predição exige dados contínuos e confiáveis de operação/telemetria. Essa é uma evolução futura, com validação humana e auditoria.

## 22. Chamadas comerciais e CTA

### Chamadas sugeridas

- **Transforme manutenção de robôs em processo rastreável.**
- **Da solicitação à preventiva: uma visão organizada da manutenção industrial.**
- **Menos controles dispersos. Mais histórico, prioridade e governança.**
- **Organize os ativos robotizados antes que a próxima parada vire urgência.**
- **Manutenção industrial com disciplina operacional e acesso controlado.**

### CTAs sugeridos

- **Solicite uma demonstração do MARV**
- **Converse com a NetSecBR sobre sua operação**
- **Avalie a estrutura de manutenção dos seus ativos**
- **Conheça o fluxo de gestão de preventivas e ordens de serviço**

## 23. Identidade visual e telas para uso no site

### Nome e identidade

- **Nome:** MARV.
- **Significado:** *Maintenance & Automation Robotic Verification*.
- **Assinatura visual observada:** MARV PLATFORM, com identidade NetSecBR, predominância de azul escuro/azul, branco e destaques em azul claro e amarelo/laranja.

### Arquivos visuais disponíveis no projeto

| Uso sugerido | Caminho exato | Observação |
| --- | --- | --- |
| Logotipo NetSecBR usado na aplicação | `Frontend/public/brand/logo_netsecbr.png` | Recomendado para cabeçalho, sujeito à aprovação de marca. |
| Logotipo original NetSecBR | `Frontend/public/brand/logo_netsecbr_original.png` | Alternativa para materiais institucionais, sujeita à aprovação de marca. |
| Mascote/asset MARV | `Frontend/public/brand/marv-mascot-v1.png` | Pode compor login, ajuda ou peças institucionais leves. |
| Imagem solta não referenciada pela aplicação | `imagens/pngwing.com.png` | Não recomendado para publicação sem verificar licença, origem e pertinência. |

### Capturas de tela recomendadas para produzir

Não foram encontrados arquivos de captura de tela prontos no repositório. O manual identifica as telas que devem ser capturadas diretamente do ambiente de demonstração:

1. Dashboard/Visão geral completa;
2. lista e detalhe de Ativos;
3. lista e formulário de Solicitações;
4. triagem e conversão de solicitação em OS;
5. detalhe de OS com apontamentos técnicos e parada;
6. custos finais e confirmação de conclusão/cancelamento;
7. lista e detalhe de Planos preventivos;
8. Configurações: usuários e permissões;
9. Ajuda e Manual de Operação;
10. MARV Command Center (uso institucional interno, se aplicável).

> Antes de publicar capturas, usar dados fictícios ou autorizados e ocultar e-mails, nomes pessoais, CNPJ, custos, números de OS e qualquer informação de cliente que não tenha autorização.

## 24. Informações que ainda precisam ser confirmadas pelo responsável pelo produto

1. O MARV será apresentado publicamente como produto disponível, piloto controlado ou solução em implantação?
2. Qual ambiente de produção hospeda o frontend e qual URL oficial deve aparecer no site?
3. Quais marcas, tipos de robô e setores a NetSecBR deseja priorizar comercialmente?
4. Quais serviços de implantação, treinamento e suporte estão efetivamente no portfólio da NetSecBR?
5. Haverá SLA comercial, suporte em horário definido ou atendimento de campo? Quais limites?
6. A NetSecBR pretende oferecer integração OT/edge no roadmap comercial? Em qual estágio ela pode ser comunicada?
7. Quais evidências ou estudos de caso autorizados podem sustentar resultados, sem alegações não comprovadas?
8. Qual política de retenção, backup, LGPD e segurança deve ser comunicada externamente?
9. Quais capturas podem usar dados reais e quais devem usar ambiente demonstrativo?
10. O MARV Command Center será citado no site como recurso interno da NetSecBR ou omitido da comunicação ao cliente?

---

## Nota editorial final

Para a primeira publicação institucional, priorizar a narrativa de **gestão de manutenção de ativos robotizados com rastreabilidade**. Evitar os termos “monitoramento em tempo real”, “comando remoto”, “integração OPC UA”, “IA preditiva”, “IoT”, “ERP integrado” ou “alertas automáticos” como recursos atuais. Eles podem ser apresentados apenas em uma seção de visão futura, claramente identificada.
