# Reconciliação proposta das sete OS preventivas sem ciclo

Fonte: consulta `SELECT` no projeto principal `zhsutxrvjocamdyyrquy` em 31/10/2026. **Nenhuma linha foi alterada.** A data agendada não comprova a data originalmente prevista; os ciclos abaixo são apenas hipóteses para conferência em auditoria e documentos de origem.

| OS / ID | Tenant | Ativo | Plano de origem | Data agendada | Situação | Ciclo possível, não confirmado | Conflito | Ação recomendada |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #9 `835e9647-86d8-44d7-9158-b99ff6057a6b` | Dedini | RB-MTRZ-WELD-02 — braço de solda | Nenhum | Não informada; aberta 25/09/2026, concluída 26/09/2026 | Concluída | Indeterminado | Sem plano e sem data; não é possível atribuir ciclo por inferência. | Preservar; conferir OS/documento original e auditoria antes de associar a plano ou ciclo. Bloquear nova geração nesse ativo até decisão. |
| #5 `404bb46b-9761-43c0-b771-4e3bb041dd97` | NETSECBR Demonstração | ROBONEWS — Robo KUka | `10358729-dbee-4136-a6a9-d9a0f8700d38`, 30 dias | 30/09/2026 | Aberta | Mensal set/2026, somente se o vencimento original for confirmado | O próximo vencimento atual é 30/10; o ciclo da OS parece anterior, mas não está registrado. | Consultar criação/auditoria do plano e da OS; não derivar chave apenas de `scheduled_for`. |
| #6 `b0d05c83-80c0-4259-91bb-20d969c53143` | NETSECBR Demonstração | ROB002 — painel controlador | `20f0ef07-5144-419f-b5a1-55665b7bb883`, 365 dias, hoje inativo | 30/09/2026 | Aberta | Anual/2026, não confirmado | Mesma combinação ativo+ano da OS #7. | Investigar se são duplicatas, reexecução autorizada ou serviços distintos; manter as duas até conclusão documentada. |
| #7 `cb577900-21c6-40bb-a909-b20adb74103f` | NETSECBR Demonstração | ROB002 — painel controlador | Mesmo plano da #6 | 22/10/2026 | Aberta | Anual/2026, não confirmado | Potencial conflito com #6; plano atual está inativo. | Mesma análise da #6; não cancelar nem fundir automaticamente. |
| #11 `187c2fdd-6a06-4640-9c2b-f68844442f38` | Saint-Gobain | RB-PRENSA-16 | `bf1e759c-ab68-455e-8427-0a62f031b494`, SIMULAÇÃO, 30 dias | 09/10/2026 | Concluída | Mensal out/2026, não confirmado | Vencimento atual do plano é 03/09/2026; programação e vencimento não coincidem. | Preservar como demonstração; conferir histórico de reagendamento. Não converter para preventiva anual real. |
| #12 `2ba892ad-d11e-473b-8f87-3c81e6184d93` | Saint-Gobain | RB-PRENSA-21 | `f52ee028-d0b7-4a44-a996-bccd49c63135`, SIMULAÇÃO, 30 dias | 10/10/2026 | Aberta | Mensal out/2026, não confirmado | Vencimento atual do plano é 18/09/2026; programação e vencimento não coincidem. | Preservar como demonstração; confirmar ciclo original antes de qualquer nova geração. |
| #13 `f59ae601-f277-45ee-b459-8c03630924fe` | Saint-Gobain | RB-PRENSA-22-STW | `422aa432-8020-43d2-8a76-bb9e5fd0daf2`, SIMULAÇÃO, 30 dias | 13/10/2026 | Concluída | Mensal out/2026, não confirmado | Data agendada coincide com vencimento atual, mas isso não prova identidade do ciclo. | Preservar como demonstração; confirmar origem em auditoria antes de registrar chave. |

## Critério para reconciliação futura

1. Exportar valores atuais das sete OS e seus eventos de auditoria antes de qualquer mudança.
2. Obter documento/registro que comprove vencimento originalmente programado, reagendamentos, tipo real do serviço e motivo de eventual duplicidade.
3. Classificar cada OS como ciclo identificável, reexecução excepcional ou legado sem ciclo determinável. Não preencher `preventive_cycle_key` por data agendada isoladamente.
4. Tratar #6/#7 conjuntamente: uma chave anual única não pode ser atribuída às duas sem regra explícita de reexecução/histórico.
5. Manter os cinco planos Saint-Gobain de SIMULAÇÃO inalterados. Qualquer plano anual real será cadastro separado após validação técnica.
6. Só então preparar migration de reconciliação por ID, com antes/depois, auditoria e aprovação específica. Esta tabela é **proposta**, não alteração do banco.
