-- Executar somente em banco PostgreSQL isolado APÓS aplicar a migration local.
-- Este arquivo não altera dados de negócio.
do $$
begin
  if public.next_annual_calendar_due_date(date '2024-02-29', date '2024-02-29')
     is distinct from date '2025-02-28' then
    raise exception 'Falha: 29/02/2024 deve avançar para 28/02/2025';
  end if;

  if public.next_annual_calendar_due_date(date '2027-02-28', date '2024-02-29')
     is distinct from date '2028-02-29' then
    raise exception 'Falha: ciclo bissexto deve voltar a 29/02/2028';
  end if;

  if public.next_annual_calendar_due_date(date '2025-12-31', date '2024-12-31')
     is distinct from date '2026-12-31' then
    raise exception 'Falha: 31/12 deve permanecer em dezembro';
  end if;

  if public.next_annual_calendar_due_date(date '2026-03-15', date '2024-03-15')
     is distinct from date '2027-03-15' then
    raise exception 'Falha: dia ordinário deve permanecer fixo';
  end if;
end;
$$;
