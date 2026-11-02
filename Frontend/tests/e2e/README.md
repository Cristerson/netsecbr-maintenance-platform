# Homologação E2E do MARV — somente leitura

Com o Vite já ativo em `http://localhost:5173`, execute na raiz do repositório:

```powershell
npm --prefix Frontend run test:e2e
```

Sem credenciais, o comando executa os testes públicos e marca os autenticados como **skipped**, nunca como aprovados. Para habilitar as sessões de demonstração, defina apenas na sessão local do terminal as variáveis `MARV_AN_EMAIL`, `MARV_AN_PASSWORD`, `MARV_AC_EMAIL`, `MARV_AC_PASSWORD`, `MARV_UN_EMAIL` e `MARV_UN_PASSWORD`. Não salve senhas em arquivos nem as passe como argumento do comando. A conta UN deve ter as permissões parciais descritas no roteiro. Cada teste cria um contexto de navegador isolado.

Para informar as seis variáveis sem digitar senhas em comandos nem mantê-las no terminal após a execução, use no terminal do VS Code:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File Frontend/scripts/run-e2e-readonly.ps1
```

O script sugere e-mails cujos perfis foram confirmados no projeto principal em 23/10/2026: AN da NETSECBR, AC `adm@saint-gobain.com` e UN `tecnico@saint-gobain.com`. Pode-se substituir qualquer e-mail no prompt. As senhas são solicitadas de modo oculto e não são gravadas. O script limpa as variáveis do próprio processo ao terminar. Uma sessão de login pode gerar registros próprios do Supabase Auth, embora a suíte bloqueie requisições operacionais de escrita.

Os testes interceptam requisições de escrita para o Supabase (inclusive `record_tenant_access_activity`). O POST de autenticação é permitido porque o login real depende dele; ele pode gerar sessão/log no serviço de Auth. Nenhum teste envia formulários de cadastro, recuperação, OS, preventiva ou chamado. Os artefatos locais ficam em `tests/e2e/.artifacts/` e são ignorados pelo Git; as capturas autenticadas podem conter dados de clientes e não devem ser publicadas.

Cobertura por cenário do roteiro oficial:

| Cenário | Nesta suíte |
|---|---|
| 1. Login/troca/recuperação | Tela de login, formulário de recuperação sem envio e login válido por perfil; troca de senha e envio de recuperação pendentes de autorização de escrita. |
| 2. Usuários/permissões | Cadastro, alteração e reset pendentes de escrita. |
| 3. Cadastros | Acesso de AC a Configurações; CRUD pendente. |
| 4. Ativos | Navegação AC e consulta UN sem botão de criação; CRUD pendente. |
| 5. Solicitações | Navegação AC; abertura pendente. |
| 6. Triagem | Alterações pendentes; detalhe requer dados e sessão. |
| 7. Conversão em OS | Pendente de escrita. |
| 8. Execução/custos | Navegação AC; alterações pendentes. |
| 9. Cancelamento/reabertura | Pendente de escrita e dados de teste. |
| 10. Preventivas | Navegação AC e consulta UN sem botão de criação; CRUD/geração pendentes. |
| 11. Dashboard | Visibilidade de indicador; comparação numérica e atualização após mutação pendentes. |
| 12. Perfis | Menus AN/AC/UN; tentativas API e permissões completas pendentes. |

Passar em um teste parcial **não aprova o cenário completo**. Os testes não incluem compras.
