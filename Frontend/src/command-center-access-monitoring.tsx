import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

type AccessUser = {
  userId: string;
  fullName: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
};

type AccessResponse = { users?: AccessUser[]; error?: string };
type Situation = 'all' | 'signed_in' | 'no_sign_in';
type Period = 'all' | '7' | '30';

function dateTime(value: string | null) {
  if (!value) return 'Sem registro';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Sem registro' : parsed.toLocaleString('pt-BR');
}

function csvCell(value: string) {
  // Evita execução de fórmulas ao abrir o CSV em planilhas.
  const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function CommandCenterAccessMonitoring({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [situation, setSituation] = useState<Situation>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    setUsers([]);
    void supabase.functions.invoke<AccessResponse>('manage-platform-users', {
      body: { action: 'tenant_access_overview', tenantId },
    }).then(({ data, error: invokeError }) => {
      if (!mounted) return;
      if (invokeError || data?.error || !Array.isArray(data?.users)) {
        setError(data?.error ?? 'Telemetria de login indisponível. A função administrativa ainda não está publicada ou não pôde responder.');
      } else {
        setUsers(data.users);
      }
      setLoading(false);
    }).catch(() => {
      if (mounted) { setError('Telemetria de login indisponível.'); setLoading(false); }
    });
    return () => { mounted = false; };
  }, [tenantId, reloadToken]);

  const now = Date.now();
  const counts = useMemo(() => ({
    total: users.length,
    signedIn: users.filter((user) => user.lastSignInAt).length,
    withoutSignIn: users.filter((user) => !user.lastSignInAt).length,
    last7: users.filter((user) => user.lastSignInAt && new Date(user.lastSignInAt).getTime() >= now - 7 * 86400000).length,
    last30: users.filter((user) => user.lastSignInAt && new Date(user.lastSignInAt).getTime() >= now - 30 * 86400000).length,
  }), [users, now]);
  const filtered = users.filter((user) => {
    if (situation === 'signed_in' && !user.lastSignInAt) return false;
    if (situation === 'no_sign_in' && user.lastSignInAt) return false;
    if (period !== 'all' && (!user.lastSignInAt || new Date(user.lastSignInAt).getTime() < now - Number(period) * 86400000)) return false;
    return true;
  });
  const selectedUser = users.find((user) => user.userId === selectedUserId);

  const exportCsv = () => {
    const header = ['Cliente', 'Nome', 'E-mail', 'Perfil', 'Situação da conta', 'Primeiro login', 'Último login autenticado', 'Logins no período'];
    const rows = filtered.map((user) => [tenantName, user.fullName ?? '', user.email ?? '', user.role, user.isActive ? 'Ativo' : 'Inativo', 'Telemetria indisponível', user.lastSignInAt ? dateTime(user.lastSignInAt) : 'Sem registro', 'Telemetria indisponível']);
    const csv = '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `marv-acessos-${tenantId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <article className="panel">
    <div className="panel-head">
      <div><p className="eyebrow">ACOMPANHAMENTO DE ACESSOS</p><h2>Adoção dos usuários</h2></div>
      <div className="admin-module-header-actions">
        <button type="button" className="secondary" onClick={() => setReloadToken((value) => value + 1)}>Atualizar</button>
        <button type="button" className="secondary" onClick={exportCsv} disabled={loading || !!error}>Exportar CSV</button>
      </div>
    </div>
    <p className="empty" style={{ marginTop: 0 }}>Último login: dado do Supabase Auth. Atividade de navegação e renovação de sessão não são contadas como login.</p>
    {loading && <p>Carregando acessos…</p>}
    {error && <p className="data-error" role="alert">{error}</p>}
    {!loading && !error && <>
      <div className="metrics">
        <div className="metric"><span>Cadastrados</span><strong>{counts.total}</strong></div>
        <div className="metric"><span>Com login registrado</span><strong>{counts.signedIn}</strong></div>
        <div className="metric"><span>Sem login registrado</span><strong>{counts.withoutSignIn}</strong></div>
        <div className="metric"><span>Último login em 7 dias</span><strong>{counts.last7}</strong></div>
        <div className="metric"><span>Último login em 30 dias</span><strong>{counts.last30}</strong></div>
      </div>
      <div className="admin-module-header-actions" style={{ margin: '16px 0' }}>
        <label>Situação <select value={situation} onChange={(event) => setSituation(event.target.value as Situation)}><option value="all">Todos</option><option value="signed_in">Com login registrado</option><option value="no_sign_in">Sem login registrado</option></select></label>
        <label>Último login <select value={period} onChange={(event) => setPeriod(event.target.value as Period)}><option value="all">Qualquer data</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></select></label>
      </div>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead><tr><th>Usuário</th><th>Conta</th><th>Primeiro login</th><th>Último login</th><th>Logins no período</th></tr></thead>
        <tbody>{filtered.map((user) => <tr key={user.userId}>
          <td><button type="button" className="secondary" onClick={() => setSelectedUserId(user.userId)}>{user.fullName || user.email || user.userId}</button><br /><small>{user.email}</small></td>
          <td>{user.isActive ? 'Ativa' : 'Inativa'}</td><td>Não disponível</td><td>{dateTime(user.lastSignInAt)}</td><td>Não disponível</td>
        </tr>)}</tbody>
      </table></div>
      {filtered.length === 0 && <p className="empty">Nenhum usuário corresponde aos filtros.</p>}
      {selectedUser && <div className="insight" style={{ marginTop: 16 }} role="status">
        <p><strong>{selectedUser.fullName || selectedUser.email}</strong> — último login autenticado: {dateTime(selectedUser.lastSignInAt)}. Histórico de logins, primeiro acesso, quantidade no período e falhas de autenticação ainda não têm telemetria confiável disponível no banco.</p>
        <button type="button" className="secondary" onClick={() => setSelectedUserId(null)}>Fechar</button>
      </div>}
    </>}
  </article>;
}
