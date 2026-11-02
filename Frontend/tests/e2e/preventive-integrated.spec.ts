import { expect, test } from '@playwright/test';

test('checklist real carrega, salva e cabe no Chrome móvel sem rede Supabase', async ({ page }) => {
  const posted: unknown[] = [];
  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/rpc/save_preventive_checklist_item')) {
      posted.push(route.request().postDataJSON());
      await route.fulfill({ status: 204 });
    } else if (url.includes('/rpc/initialize_preventive_checklist')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '1' });
    } else if (url.includes('/preventive_work_order_checklist_items')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{
        id: '33333333-3333-4333-8333-333333333333', title: 'Medir temperatura',
        instruction: 'Registrar a leitura', position: 1, result: 'pending', notes: null,
        nonconformity: null, measurement_value: null, measurement_unit: null,
        measurement_point: null, requires_photo: true, nonconformity_request_id: null,
      }]) });
    } else if (url.includes('/preventive_checklist_photos')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    } else await route.abort();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5183/tests/e2e/preventive-integrated.html');
  await expect(page.getByRole('heading', { name: 'Checklist da OS' })).toBeVisible();
  await expect(page.getByText('Medir temperatura').first()).toBeVisible();
  await page.getByLabel('Valor medido').fill('42.5');
  await page.getByLabel('Unidade da medição').fill('°C');
  await page.getByLabel('Ponto de medição').fill('Redutor');
  await page.getByLabel('Resultado').selectOption('ok');
  await page.getByRole('button', { name: 'Salvar checklist no MARV' }).click();
  await expect(page.getByText('Checklist salvo no MARV.')).toBeVisible();
  expect(posted).toHaveLength(1);
  expect(posted[0]).toMatchObject({ target_measurement_value: 42.5, target_measurement_unit: '°C', target_result: 'ok' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
