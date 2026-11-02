import { type Page } from '@playwright/test';

const readOnlyRpc = new Set([
  'get_command_center_overview',
  'get_command_center_consumption',
  'get_command_center_support_agents',
]);

// Impede gravações operacionais no projeto principal, inclusive a telemetria
// automática de presença após login. Um RPC desconhecido é bloqueado por padrão.
export async function protectProduction(page: Page) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      await route.continue();
      return;
    }

    // O login Supabase exige POST. Não permite reset de senha, cadastro ou logout.
    if (method === 'POST' && url.hostname.endsWith('.supabase.co') && url.pathname === '/auth/v1/token') {
      await route.continue();
      return;
    }

    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
    if (method === 'POST' && url.hostname.endsWith('.supabase.co') && rpc && readOnlyRpc.has(rpc)) {
      await route.continue();
      return;
    }

    await route.abort('blockedbyclient');
  });
}
