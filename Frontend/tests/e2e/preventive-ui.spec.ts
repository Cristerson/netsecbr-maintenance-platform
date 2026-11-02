import { expect, test } from '@playwright/test';

test('fluxo visual local: rascunho, devolução, aprovação, assinatura e PDF', async ({ page }, testInfo) => {
  await page.goto('http://127.0.0.1:5183/tests/e2e/preventive-demo.html');
  await expect(page.getByRole('heading', { name: 'Execução preventiva' })).toBeVisible();
  await expect(page.getByText('Nenhuma alteração será gravada')).toBeVisible();

  const results = page.getByLabel('Resultado');
  await results.nth(0).selectOption('ok');
  await results.nth(1).selectOption('not_ok');
  await results.nth(2).selectOption('not_applicable');
  await page.getByLabel('Medição (inclua valor e unidade)').nth(1).fill('42 °C');
  await page.getByLabel('Não conformidade').fill('Temperatura acima do limite de teste.');
  await page.getByLabel('Descrição do serviço executado').fill('Inspeção de teste executada com leitura simulada e registro visual.');

  const photoBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 32;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#1688bd';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#fff';
    context.fillText('QA', 12, 20);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const png = Buffer.from(photoBase64, 'base64');
  await page.locator('input[type="file"]').nth(1).setInputFiles({ name: 'evidencia-qa.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByAltText('Prévia 1: evidencia-qa.png')).toBeVisible();
  await expect.poll(() => page.getByAltText('Prévia 1: evidencia-qa.png').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Salvar rascunho nesta aba' }).click();
  await expect(page.getByText('Rascunho de texto salvo somente nesta aba')).toBeVisible();
  await page.getByRole('button', { name: 'Visualizar relatório' }).click();
  await expect(page.getByRole('heading', { name: 'Relatório de execução preventiva' })).toBeVisible();
  await expect(page.getByText('Atividades de exemplo — não extraídas do plano real')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar para revisão visual' }).click();
  await page.getByLabel('Nome do supervisor de teste').fill('Supervisor QA');
  await page.getByLabel('Observações / motivo da devolução').fill('Refaça a medição antes de reenviar o relatório.');
  await page.getByRole('button', { name: 'Devolver para correção' }).click();
  await expect(page.getByText('Motivo da devolução:')).toBeVisible();
  await page.getByRole('button', { name: 'Corrigir execução' }).click();
  await page.getByRole('button', { name: 'Visualizar relatório' }).click();
  await page.getByRole('button', { name: 'Enviar para revisão visual' }).click();
  await page.getByRole('button', { name: 'Aprovar visualmente' }).click();
  await expect(page.getByRole('heading', { name: 'Coleta local do aceite' })).toBeVisible();

  await page.getByLabel('Nome do representante do cliente').fill('Representante QA');
  const canvas = page.getByRole('img', { name: 'Área de assinatura. Use o dedo, a caneta ou o mouse.' });
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 30, box!.y + 70);
  await page.mouse.down();
  await page.mouse.move(box!.x + 90, box!.y + 95, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Limpar' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirmar aceite de teste' }).click();
  await expect(page.getByText('Aceite simulado localmente')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Imprimir / salvar como PDF' })).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  await page.locator('#marv-preventive-print').screenshot({ path: testInfo.outputPath('relatorio-local-qa.png') });
  const pdf = await page.pdf({ path: testInfo.outputPath('relatorio-local-qa.pdf'), format: 'A4', printBackground: true });
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  expect(pdf.length).toBeGreaterThan(1000);
});

test('rascunho só nesta aba e guardas de checklist, autoaprovação e assinatura', async ({ page }) => {
  await page.goto('http://127.0.0.1:5183/tests/e2e/preventive-demo.html');
  await page.getByLabel('Resultado').first().selectOption('ok');
  await page.getByLabel('Descrição do serviço executado').fill('Texto de teste salvo temporariamente nesta aba.');
  await page.getByRole('button', { name: 'Salvar rascunho nesta aba' }).click();
  await page.reload();
  await expect(page.getByLabel('Descrição do serviço executado')).toHaveValue('Texto de teste salvo temporariamente nesta aba.');
  await expect(page.getByLabel('Resultado').first()).toHaveValue('ok');

  await page.getByRole('button', { name: 'Visualizar relatório' }).click();
  await expect(page.getByText('Informe o resultado de: Medição operacional.')).toBeVisible();
  await page.getByLabel('Resultado').nth(1).selectOption('ok');
  await page.getByLabel('Resultado').nth(2).selectOption('ok');
  await page.getByRole('button', { name: 'Visualizar relatório' }).click();
  await page.getByRole('button', { name: 'Enviar para revisão visual' }).click();
  await page.getByLabel('Nome do supervisor de teste').fill('Técnico QA');
  await page.getByRole('button', { name: 'Aprovar visualmente' }).click();
  await expect(page.getByText('O executor não pode simular a aprovação do próprio trabalho.')).toBeVisible();
  await page.getByLabel('Nome do supervisor de teste').fill('Supervisor QA');
  await page.getByRole('button', { name: 'Aprovar visualmente' }).click();
  await page.getByLabel('Nome do representante do cliente').fill('Representante QA');
  await page.getByRole('button', { name: 'Confirmar aceite de teste' }).click();
  await expect(page.getByText('Informe o nome do representante e capture sua assinatura')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Imprimir / salvar como PDF' })).toHaveCount(0);
});
