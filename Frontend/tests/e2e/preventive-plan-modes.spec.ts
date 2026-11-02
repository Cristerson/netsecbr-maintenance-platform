import { expect, test } from '@playwright/test';

test('plano oferece somente Modelo MARV e Modelo personalizado no celular', async ({ page }) => {
  await page.route('**/rest/v1/**', async (route) => {
    if (route.request().url().includes('/preventive_template_activities')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { position: 1, title: 'Verificar folga nos eixos', instruction: 'Registrar condição.', is_optional: false, requires_photo: false },
        { position: 2, title: 'Verificar zero dos eixos', instruction: 'Seguir fabricante.', is_optional: false, requires_photo: false },
      ]) });
    } else if (route.request().url().includes('/rpc/initialize_preventive_checklist')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '0' });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5183/tests/e2e/preventive-integrated.html');
  const panel = page.getByRole('region', { name: 'Checklist do plano preventivo' });
  const marv = panel.getByRole('button', { name: /MODELO MARV/ });
  const custom = panel.getByRole('button', { name: /MODELO PERSONALIZADO/ });
  await expect(marv).toBeVisible();
  await expect(custom).toBeVisible();
  await marv.click();
  await expect(marv).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByText('Atividade 2')).toBeVisible();
  await panel.getByLabel('Subir atividade 2').click();
  await expect(panel.getByLabel('Atividade *').first()).toHaveValue('Verificar zero dos eixos');
  await panel.getByLabel('Atividade *').first().fill('Conferir zero dos eixos');
  await expect(panel.getByLabel('Atividade *').first()).toHaveValue('Conferir zero dos eixos');
  await custom.click();
  await expect(custom).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByLabel('Atividade *')).toHaveCount(0);
  await expect(panel).toHaveAttribute('data-activity-count', '0');
  await panel.getByRole('button', { name: 'Adicionar atividade' }).click();
  await expect(panel.getByLabel('Atividade *')).toHaveCount(1);
  await panel.getByLabel('Atividade *').fill('Inspecionar lubrificação');
  await expect(panel.getByLabel('Atividade *')).toHaveValue('Inspecionar lubrificação');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
