# Checklist de Ativos e Licença

1. Criar categoria `ROBOT` com `is_robot = true`.
2. Cadastrar robô ativo, inativo e em manutenção: os três devem permanecer licenciáveis.
3. Tentar cadastrar ativo com unidade de outro tenant: a operação deve falhar.
4. Tentar usar centro de custo diferente do centro da unidade: a operação deve falhar.
5. Confirmar que um usuário de outro tenant não consulta os ativos.
6. Ao preencher `deleted_at`, o ativo deve desaparecer das consultas normais, mas continuar preservado no banco para histórico.
