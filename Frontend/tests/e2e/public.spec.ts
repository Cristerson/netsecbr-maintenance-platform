import { expect, test } from '@playwright/test';
import { protectProduction } from './read-only';

test.beforeEach(async ({ page }) => {
  await protectProduction(page);
});

test('01 · login público carrega sem sessão', async ({ page }, testInfo) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Entre com suas credenciais' })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await expect(page.getByLabel('Senha', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('login-publico.png'), fullPage: true });
});

test('01 · formulário de recuperação abre sem enviar e-mail', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await expect(page.getByRole('heading', { name: 'Recupere sua senha' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar link de recuperação' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('recuperacao-formulario.png'), fullPage: true });
  await page.getByRole('button', { name: 'Voltar para o login' }).click();
  await expect(page.getByRole('heading', { name: 'Entre com suas credenciais' })).toBeVisible();
});
