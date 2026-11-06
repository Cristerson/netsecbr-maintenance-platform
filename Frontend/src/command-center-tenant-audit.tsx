import { useEffect, useState } from 'react';
import { supabase } from './supabase';

type Event = { id: string; action: string; created_at: string; actor_id: string | null };

export function CommandCenterTenantAudit({ tenantId }: { tenantId: string }) {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setEvents(null);
    setError('');
    void (async () => {
      const result = await supabase.from('audit_logs').select('id,action,created_at,actor_id')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(30);
      if (!live) return;
      if (result.error) { setError('Não foi possível consultar a auditoria deste cliente.'); return; }
      const rows = (result.data ?? []) as Event[];
      setEvents(rows);
      const ids = [...new Set(rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
      if (!ids.length) return;
      const profiles = await supabase.from('profiles').select('id,full_name').in('id', ids);
      if (live && !profiles.error) setNames(Object.fromEntries((profiles.data ?? []).map((profile) => [profile.id, profile.full_name || 'Usuário sem nome'])));
    })();
    return () => { live = false; };
  }, [tenantId]);

  return <article className="panel">
    <div className="panel-head"><div><p className="eyebrow">RASTREABILIDADE</p><h2>Eventos administrativos recentes</h2></div></div>
    {error && <p className="data-error" role="alert">{error}</p>}
    {!error && events === null && <p className="empty">Carregando auditoria…</p>}
    {events?.length === 0 && <p className="empty">Nenhum evento registrado para este cliente.</p>}
    {events && events.length > 0 && <div className="data-list">{events.map((event) => <div className="data-row" key={event.id}>
      <div><strong>{event.action.replaceAll('_', ' ')}</strong><small>{names[event.actor_id ?? ''] ?? 'Ator não identificado'} · {new Date(event.created_at).toLocaleString('pt-BR')}</small></div>
    </div>)}</div>}
    <p className="cc-panel-note">Últimos 30 eventos. Falhas de login não são registradas nesta tabela.</p>
  </article>;
}
