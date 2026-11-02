import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { protectProduction } from './read-only';

type Role = 'AN' | 'AC' | 'UN';

async function login(page: Page, role: Role, testInfo: TestInfo) {
  const email = process.env[`MARV_${role}_EMAIL`];
  const password = process.env[`MARV_${role}_PASSWORD`];
  test.skip(!email || !password, `Credenciais ${role} ausentes nas variáveis locais`);

  await protectProduction(page);
  await page.goto('/');
  await page.getByLabel('E-mail').fill(email!);
  await page.getByLabel('Senha', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  // O contexto de falha do Playwright inclui o valor de inputs. Limpe o campo
  // imediatamente após enviar o login, antes de qualquer asserção com timeout.
  const passwordField = page.getByLabel('Senha', { exact: true });
  if (await passwordField.isVisible().catch(() => false)) {
    await passwordField.fill('');
  }
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 25_000 });
  await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-dashboard.png`), fullPage: true });
}

async function openMenu(page: Page, name: string, heading: string, testInfo: TestInfo, evidence: string) {
  await page.locator('aside nav').getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(evidence), fullPage: true });
}

test('01/12 · AN autentica e acessa Command Center', async ({ page }, testInfo) => {
  await login(page, 'AN', testInfo);
  await expect(page.locator('aside nav').getByRole('button', { name: 'Configurações' })).toBeVisible();
  await page.locator('aside nav').getByRole('button', { name: 'MARV Command Center' }).click();
  await expect(page.getByRole('heading', { name: 'MARV Command Center', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Clientes', exact: true })).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: testInfo.outputPath('an-command-center.png'), fullPage: true });
});

test('01/03/04/05/10/11/12 · AC navega módulos em leitura', async ({ page }, testInfo) => {
  await login(page, 'AC', testInfo);
  const nav = page.locator('aside nav');
  await expect(nav.getByRole('button', { name: 'MARV Command Center' })).toHaveCount(0);
  await expect(page.getByText('OS abertas', { exact: true })).toBeVisible();
  await openMenu(page, 'Ativos', 'Ativos industriais', testInfo, 'ac-ativos.png');
  await openMenu(page, 'Solicitações', 'Solicitações de manutenção', testInfo, 'ac-solicitacoes.png');
  await openMenu(page, 'Ordens de serviço', 'Ordens de serviço', testInfo, 'ac-ordens.png');
  await openMenu(page, 'Preventivas', 'Planos preventivos', testInfo, 'ac-preventivas.png');
  await openMenu(page, 'Configurações', 'Configurações', testInfo, 'ac-configuracoes.png');
  await expect(page.getByRole('button', { name: 'Cadastros' })).toBeVisible();
});

test('01/04/10/12 · UN com permissões parciais só consulta', async ({ page }, testInfo) => {
  await login(page, 'UN', testInfo);
  const nav = page.locator('aside nav');
  await expect(nav.getByRole('button', { name: 'Configurações' })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: 'MARV Command Center' })).toHaveCount(0);
  await openMenu(page, 'Ativos', 'Ativos industriais', testInfo, 'un-ativos.png');
  await expect(page.getByRole('button', { name: 'Novo ativo' })).toHaveCount(0);
  await openMenu(page, 'Preventivas', 'Planos preventivos', testInfo, 'un-preventivas.png');
  await expect(page.getByRole('button', { name: 'Nova preventiva' })).toHaveCount(0);
});
