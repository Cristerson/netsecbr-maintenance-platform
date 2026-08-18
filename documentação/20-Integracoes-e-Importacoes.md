# Integrações, Importações e Fornecedores

## Objetivo

O painel de administração do cliente terá os módulos **Integrações e importações** e **Fornecedores**. Eles permitem manter os dados operacionais atualizados, tanto para clientes integrados a um ERP quanto para clientes que trabalham sem integração.

## Integrações ERP

As integrações futuras deverão suportar SAP e TOTVS, além de conectores extensíveis para outros ERPs. O escopo inicial inclui:

- Receber e conciliar cadastro de ativos, categorias e centros de custo.
- Receber cadastro de fornecedores, peças e serviços.
- Consultar situação de solicitações, pedidos de compra e entrega de peças relacionadas a uma OS.
- Enviar eventos autorizados de manutenção, como abertura, atualização e conclusão de ordens de serviço.

Nenhuma integração pode alterar dados automaticamente sem mapeamento de campos, identificação do tenant, registro de auditoria e aprovação da regra de sincronização.

## Consulta a catálogos de fabricantes

Na primeira versão, a requisição de compra permite consultar os portais oficiais de ABB, KUKA, FANUC e Yaskawa em uma janela independente. Esta é uma consulta assistida: o usuário confirma fabricante, modelo, part number, prazo e preço antes de registrar o item.

Não há integração automática de catálogos, scraping, credenciais de fabricante ou sugestão automática de part number. Uma integração futura só será criada quando o fabricante disponibilizar API ou canal comercial autorizado, com validação contratual, auditoria e isolamento por tenant.

## Importações

Quando o cliente não possuir integração ERP, a plataforma oferecerá importação por CSV UTF-8 e cadastro manual. A primeira etapa prioriza fornecedores e ativos.

- O CSV terá modelo baixável e validação antes da confirmação.
- Erros serão apresentados por linha, sem gravar registros parcialmente inválidos.
- A importação sempre respeitará tenant, unidade e centro de custo quando aplicável.

## Fornecedores

O cliente pode manter seus fornecedores de peças e serviços no próprio tenant, contendo ao menos razão social, nome comercial, documento, contatos, tipos de fornecimento, SLA e situação de ativo/inativo.

Os fornecedores podem vir do ERP, de CSV ou de cadastro manual. A origem do dado deve ser registrada para evitar duplicidade e facilitar conciliação futura.

## Permissões e segurança

- O administrador do cliente controla fornecedores, importações e solicitações de integração conforme as permissões liberadas pela NETSECBR.
- Credenciais de ERP nunca ficam no frontend; serão armazenadas em cofre de segredos e usadas somente por serviços de backend.
- Dados sincronizados permanecem isolados por tenant e auditáveis.

## Entrega incremental

1. Exibir os módulos no painel de administração do cliente.
2. CRUD manual de fornecedores.
3. Importação CSV de fornecedores.
4. Modelos de importação de ativos e validação.
5. Conectores ERP com SAP e TOTVS, mediante projeto de mapeamento por cliente.
