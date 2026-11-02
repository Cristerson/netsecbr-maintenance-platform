# Ambientes do MARV

## Build de homologação (banco principal)

O desenvolvimento local e o comando `npm run build` usam o modo `staging`.
O Vite lê `Frontend/.env.staging`. Pela decisão atual de operar com um único
projeto Supabase, esse modo aponta para o banco principal
`zhsutxrvjocamdyyrquy`. O nome `staging` identifica o build, **não** um
banco isolado. Testes de escrita podem afetar dados reais.

```powershell
npm --prefix Frontend run dev
npm --prefix Frontend run build:staging
```

O resultado é gravado em `Frontend/dist/staging` e não deve ser enviado ao
HostGator.

## Produção

Produção é sempre uma ação explícita. O modo `production` usa
`Frontend/.env.local`, que deve apontar para `zhsutxrvjocamdyyrquy`.

```powershell
npm --prefix Frontend run build:production
npm --prefix Frontend run package:production
```

`package:production` recria `Frontend/marv.zip` com o conteúdo de
`Frontend/dist/production`. Esse é o único pacote a enviar para a raiz do
subdomínio `marv.netsecbr.com.br`.

## Travas

- O Vite bloqueia o build se a URL Supabase não corresponder ao modo escolhido.
- Chave publishable ausente também bloqueia o build.
- Não versionar arquivos `.env*`, `dist` ou `marv.zip`.
- Edge Functions devem receber `--project-ref` explícito; nunca depender do
  projeto atualmente linkado.
- Migrations no projeto principal exigem tarefa e autorização próprias; não usar
  `supabase db push` enquanto o histórico remoto não for saneado.
