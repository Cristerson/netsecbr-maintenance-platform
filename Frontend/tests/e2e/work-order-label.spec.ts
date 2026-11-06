import { expect, test } from '@playwright/test';
import { workOrderDisplayTitle } from '../../src/work-order-label';

test('título preventivo legado não expõe chave técnica do ciclo', () => {
  const legacyTitle = 'Preventiva interval:7f0ca0ac-e7a5-4820-9a8d-cf578ae93d56:2026-12-12 - Robô KUKA KR20 R1810 — Célula 4 Acabamento';
  expect(workOrderDisplayTitle(legacyTitle, 'preventive')).toBe('Preventiva — Robô KUKA KR20 R1810 — Célula 4 Acabamento');
  expect(workOrderDisplayTitle('Troca de motor', 'corrective')).toBe('Troca de motor');
});
