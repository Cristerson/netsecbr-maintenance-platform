import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../../backend/supabase/functions/manage-platform-users/index.ts', import.meta.url), 'utf8');
const code = stripTypeScriptTypes(source.replace("import { createClient } from 'npm:@supabase/supabase-js@2'", "const { createClient } = require('mock')"));
const ownerId = 'e00995cb-bc07-4ccb-9834-7798ed7f9af9';
const otherOwnerId = '0986c31c-c9e9-4526-b4b2-050b3f86e04b';
const operatorId = '33333333-3333-4333-8333-333333333333';
const tenantId = '11111111-1111-4111-8111-111111111111';

function localFunction(callerId = ownerId) {
  const writes = [];
  let handler;
  class Query {
    constructor(table) { this.table = table; this.filters = {}; }
    select() { return this; }
    eq(key, value) { this.filters[key] = value; return this; }
    order() { return this; }
    limit() { return this; }
    maybeSingle() {
      const data = this.table === 'platform_access_roles'
        ? [ownerId, otherOwnerId].includes(this.filters.user_id)
          ? { user_id: this.filters.user_id, role: 'owner', is_active: true, profiles: { full_name: 'Proprietário', platform_role: 'netsecbr_admin', is_active: true } }
          : this.filters.user_id === operatorId
            ? { user_id: operatorId, role: 'operator', is_active: true, profiles: { full_name: 'Operador', platform_role: 'netsecbr_admin', is_active: true } }
            : null
        : this.table === 'tenants' && this.filters.id === tenantId ? { id: tenantId } : null;
      return Promise.resolve({ data, error: null });
    }
    then(resolve, reject) {
      const data = this.table === 'tenant_memberships' && this.filters.tenant_id === tenantId
        ? [{ user_id: '22222222-2222-4222-8222-222222222222', role: 'tenant_admin', is_active: true, profiles: { full_name: 'Usuário de teste' } }]
        : [];
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    }
    insert(value) { writes.push({ table: this.table, value }); return Promise.resolve({ error: null }); }
    upsert(value) { writes.push({ table: this.table, value }); return Promise.resolve({ error: null }); }
    update(value) { writes.push({ table: this.table, value }); return this; }
  }
  const admin = {
    from: (table) => new Query(table),
    rpc: async () => ({ data: null, error: { message: 'RPC não implantada' } }),
    auth: { admin: {
      getUserById: async (id) => ({ data: { user: { id, email: 'teste@example.com', created_at: '2026-11-01T00:00:00Z', last_sign_in_at: '2026-11-04T12:00:00Z' } }, error: null }),
      updateUserById: async (id, input) => { writes.push({ table: 'auth.users', id, value: input }); return { error: null }; },
      listUsers: async () => ({ data: { users: [] }, error: null }),
      createUser: async (input) => { writes.push({ table: 'auth.users', value: input }); return { data: { user: { id: '33333333-3333-4333-8333-333333333333' } }, error: null }; },
    } },
  };
  const authClient = { auth: { getUser: async () => ({ data: { user: callerId ? { id: callerId } : null } }) } };
  vm.runInNewContext(code, {
    require: () => ({ createClient: (_url, key) => key === 'service' ? admin : authClient }),
    exports: {}, Response, crypto: globalThis.crypto,
    Deno: { env: { get: (key) => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' })[key] }, serve: (fn) => { handler = fn; } },
  });
  return {
    writes,
    async invoke(body) {
      const response = await handler({ method: 'POST', headers: new Map([['Authorization', 'Bearer teste-local'], ['origin', 'http://localhost:5173']]), json: async () => body });
      return { status: response.status, body: await response.json() };
    },
  };
}

test('Super Admin vê somente vínculos do cliente solicitado, sem escrita', async () => {
  const app = localFunction();
  const result = await app.invoke({ action: 'tenant_access_overview', tenantId });
  assert.equal(result.status, 200);
  assert.equal(result.body.users.length, 1);
  assert.equal(result.body.telemetry.loginHistoryAvailable, false);
  assert.deepEqual(app.writes, []);
  assert.equal((await localFunction(otherOwnerId).invoke({ action: 'tenant_access_overview', tenantId })).status, 403);
  assert.equal((await localFunction().invoke({ action: 'tenant_access_overview', tenantId: '99999999-9999-4999-8999-999999999999' })).status, 404);
});

test('conta proprietária não pode ser editada ou ter senha resetada pela função', async () => {
  const app = localFunction(otherOwnerId);
  assert.equal((await app.invoke({ action: 'list' })).status, 200);
  assert.equal((await app.invoke({ action: 'update_identity', userId: ownerId })).status, 403);
  assert.equal((await app.invoke({ action: 'set_temporary_password', userId: ownerId })).status, 403);
  assert.deepEqual(app.writes, []);
});

test('novos operadores globais ficam bloqueados sem afetar dados', async () => {
  const app = localFunction();
  assert.equal((await app.invoke({ action: 'create', fullName: 'QA', email: 'qa@example.com', password: 'senha-local-123', role: 'operator' })).status, 403);
  assert.equal((await app.invoke({ action: 'link_existing', email: 'qa@example.com', role: 'operator' })).status, 403);
  assert.deepEqual(app.writes, []);
});

test('edição e reset de operador já ativo continuam disponíveis (somente mock local)', async () => {
  const app = localFunction();
  const edit = await app.invoke({ action: 'update_identity', userId: operatorId, fullName: 'Nome atualizado', email: 'teste@example.com', role: 'operator', isActive: true });
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  assert.equal(app.writes.some((write) => write.table === 'profiles'), true);
  assert.equal(app.writes.some((write) => write.table === 'platform_access_roles'), true);
  const reset = await app.invoke({ action: 'set_temporary_password', userId: operatorId, mode: 'manual', password: 'senha-local-123' });
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  assert.equal(app.writes.some((write) => write.table === 'auth.users' && write.id === operatorId), true);
});
