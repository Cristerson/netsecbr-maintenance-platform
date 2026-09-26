-- MVP1: saneamento da estrutura detalhada de custos (adiada para V2).
--
-- Decisão de produto aprovada: no MVP1 o modelo oficial de custos é o
-- consolidado nas colunas de public.work_orders:
--   service_cost_cents, material_cost_cents, total_cost_cents.
-- A estrutura detalhada public.work_order_costs é adiada para o V2.
--
-- Esta migration foi criada apenas localmente. NÃO executar em nenhum
-- banco (remoto ou local) sem revisão e autorização explícitas.
--
-- Regras de segurança:
-- 1) Se public.work_order_costs existir com qualquer registro, gera
--    EXCEPTION clara e interrompe o script sem apagar nada;
-- 2) Se existir vazia, remove a tabela sem CASCADE;
-- 3) Remove public.validate_work_order_cost_scope somente se existir;
-- 4) Não altera public.work_orders nem os campos de custo consolidado
--    (service_cost_cents, material_cost_cents, total_cost_cents).

do $$
begin
  if to_regclass('public.work_order_costs') is not null then
    if exists (select 1 from public.work_order_costs) then
      raise exception 'Saneamento cancelado: public.work_order_costs possui registros. Nada foi alterado.';
    end if;

    drop table public.work_order_costs;
  end if;

  if exists (
    select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'validate_work_order_cost_scope'
  ) then
    drop function public.validate_work_order_cost_scope();
  end if;
end;
$$;
