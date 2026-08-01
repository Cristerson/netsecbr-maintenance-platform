# APIs

## Convenções

- Base: `/api/v1`.
- JSON, HTTPS e autenticação Bearer.
- Paginação, filtros e ordenação padronizados nas listas.
- Respostas de erro incluem código estável, mensagem amigável e identificador de correlação.
- A organização é determinada pelo contexto autenticado; nunca pelo valor informado livremente pelo cliente.

## Recursos iniciais

| Recurso | Operações principais |
| --- | --- |
| `/auth` | login, renovação e encerramento de sessão. |
| `/users` | usuários, perfis e permissões. |
| `/assets` | cadastro, consulta, documentos e histórico. |
| `/service-requests` | abrir, triar, cancelar e converter em OS. |
| `/work-orders` | criar, atribuir, iniciar, apontar, concluir e cancelar. |
| `/maintenance-plans` | criar plano e consultar programações. |
| `/checklist-templates` | criar e manter modelos. |
| `/dashboard` | indicadores agregados por filtro permitido. |

## Estado e concorrência

Endpoints de mudança de estado devem validar a transição no servidor. Recursos editáveis usarão controle de concorrência otimista para impedir que uma atualização silenciosamente sobrescreva outra.
