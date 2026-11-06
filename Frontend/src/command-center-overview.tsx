import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { CommandCenterTenant } from './use-command-center-data';
import './command-center-overview.css';

type Props = {
  tenants: CommandCenterTenant[];
  tenantsLoading: boolean;
  tenantsError: string;
  responseMs: number | null;
  onClients: () => void;
  onContracts: () => void;
  onSupport: () => void;
  onTeam: () => void;
};
type Subscription = { status: string; annual_price_cents_snapshot: number | null; contract_end_date: string | null; trial_ends_at: string | null };
type Ticket = { tenant_id: string; status: string; priority: string; created_at: string; resolved_at: string | null };
type Membership = { user_id: string; is_active: boolean; created_at: string };
type AccessActivity = { user_id: string; last_seen_at: string };
type AuditEvent = { id: string; action: string; created_at: string; tenant_id: string | null };
type Snapshot = { memberships: Membership[] | null; subscriptions: Subscription[] | null; tickets: Ticket[] | null; activity: AccessActivity[] | null; audit: AuditEvent[] | null; auth: 'ok' | 'error' | 'loading'; errors: string[] };

async function allRows<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table).select(columns).order('id').range(offset, offset + 499);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []) as T[]);
    if (!data || data.length < 500) return rows;
  }
}

const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export function CommandCenterOverview({ tenants, tenantsLoading, tenantsError, responseMs, onClients, onContracts, onSupport, onTeam }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ memberships: null, subscriptions: null, tickets: null, activity: null, audit: null, auth: 'loading', errors: [] });
  useEffect(() => {
    let live = true;
    void (async () => {
      const [memberships, subscriptions, tickets, activity, audit, auth] = await Promise.allSettled([
        allRows<Membership>('tenant_memberships', 'user_id,is_active,created_at'),
        allRows<Subscription>('subscriptions', 'status,annual_price_cents_snapshot,contract_end_date,trial_ends_at'),
        allRows<Ticket>('support_tickets', 'tenant_id,status,priority,created_at,resolved_at'),
        supabase.from('tenant_access_activity').select('user_id,last_seen_at').gte('last_seen_at', new Date(Date.now() - 86400000).toISOString()).order('last_seen_at', { ascending: false }).limit(500),
        supabase.from('audit_logs').select('id,action,created_at,tenant_id').order('created_at', { ascending: false }).limit(8),
        supabase.auth.getUser(),
      ]);
      if (!live) return;
      const errors: string[] = [];
      const membershipRows = memberships.status === 'fulfilled' ? memberships.value : null;
      if (!membershipRows) errors.push('Não foi possível consultar os usuários.');
      const subscriptionRows = subscriptions.status === 'fulfilled' ? subscriptions.value : null;
      if (!subscriptionRows) errors.push('Não foi possível consultar contratos e licenças.');
      const ticketRows = tickets.status === 'fulfilled' ? tickets.value : null;
      if (!ticketRows) errors.push('Não foi possível consultar chamados.');
      const activityRows = activity.status === 'fulfilled' && !activity.value.error ? activity.value.data as AccessActivity[] : null;
      const auditRows = audit.status === 'fulfilled' && !audit.value.error ? audit.value.data as AuditEvent[] : null;
      const authOk = auth.status === 'fulfilled' && !auth.value.error && !!auth.value.data.user;
      setSnapshot({ memberships: membershipRows, subscriptions: subscriptionRows, tickets: ticketRows, activity: activityRows, audit: auditRows, auth: authOk ? 'ok' : 'error', errors });
    })();
    return () => { live = false; };
  }, []);

  const active = tenants.filter((tenant) => tenant.status === 'active').length;
  const suspended = tenants.filter((tenant) => tenant.status === 'suspended').length;
  const inactive = tenants.length - active - suspended;
  const subscriptions = snapshot.subscriptions;
  const tickets = snapshot.tickets;
  const openTickets = tickets?.filter((ticket) => ['open', 'in_progress'].includes(ticket.status)) ?? [];
  const criticalTickets = openTickets.filter((ticket) => ticket.priority === 'critical');
  const oldestHours = openTickets.length ? Math.max(...openTickets.map((ticket) => Math.max(0, (Date.now() - new Date(ticket.created_at).getTime()) / 3600000))) : null;
  const byTenant = new Map<string, number>();
  for (const ticket of openTickets) byTenant.set(ticket.tenant_id, (byTenant.get(ticket.tenant_id) ?? 0) + 1);
  const highestTenants = [...byTenant].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const endingSoon = subscriptions?.filter((subscription) => subscription.contract_end_date && subscription.contract_end_date >= new Date().toISOString().slice(0, 10) && subscription.contract_end_date <= new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)).length ?? null;
  const recentCutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const newTenants = tenants.filter((tenant) => tenant.createdAt >= recentCutoff).length;
  const memberships = snapshot.memberships;
  const registeredUsers = memberships ? new Set(memberships.map((member) => member.user_id)).size : null;
  const activeUsers = memberships ? new Set(memberships.filter((member) => member.is_active).map((member) => member.user_id)).size : null;
  const inactiveUsers = memberships ? new Set(memberships.filter((member) => !member.is_active).map((member) => member.user_id)).size : null;
  const newUsers = memberships ? new Set(memberships.filter((member) => member.created_at >= recentCutoff).map((member) => member.user_id)).size : null;
  const recentlyActive = snapshot.activity ? new Set(snapshot.activity.map((item) => item.user_id)).size : null;
  const resolvedTickets = tickets?.filter((ticket) => ticket.resolved_at) ?? [];
  const meanResolutionHours = resolvedTickets.length ? resolvedTickets.reduce((sum, ticket) => sum + Math.max(0, (new Date(ticket.resolved_at!).getTime() - new Date(ticket.created_at).getTime()) / 3600000), 0) / resolvedTickets.length : null;
  const openOver24Hours = openTickets.filter((ticket) => Date.now() - new Date(ticket.created_at).getTime() > 86400000).length;
  const alerts = [
    tenantsError && 'Falha na consulta da visão global',
    suspended > 0 && `${suspended} cliente(s) suspenso(s)`,
    criticalTickets.length > 0 && `${criticalTickets.length} chamado(s) crítico(s)`,
    endingSoon !== null && endingSoon > 0 && `${endingSoon} contrato(s) vencem em 60 dias`,
  ].filter(Boolean) as string[];

  return <div className="cc-executive" aria-label="Visão executiva da plataforma">
    <div className="cc-executive-heading"><div><p className="eyebrow">NETSECBR · OPERAÇÃO SAAS</p><h3>Visão geral da plataforma</h3></div><span>Indicadores administrativos, sem métricas industriais dos clientes</span></div>
    {alerts.length > 0 && <div className="cc-alert-strip" role="status"><strong>Atenção</strong>{alerts.map((alert) => <span key={alert}>{alert}</span>)}</div>}
    {snapshot.errors.length > 0 && <p className="cc-executive-error" role="alert">{snapshot.errors.join(' ')}</p>}
    <div className="cc-executive-grid">
      <section className="panel cc-executive-panel"><div className="cc-panel-heading"><h4>Clientes</h4><button onClick={onClients}>Abrir clientes →</button></div>
        {tenantsLoading && tenants.length === 0 ? <p>Carregando…</p> : tenantsError ? <p className="cc-executive-error">{tenantsError}</p> : <div className="cc-stat-grid">
          <div><strong>{tenants.length}</strong><span>Total</span></div><div><strong>{active}</strong><span>Ativos</span></div><div><strong>{suspended}</strong><span>Suspensos</span></div><div><strong>{inactive}</strong><span>Outras situações</span></div><div><strong>{newTenants}</strong><span>Novos em 30 dias</span></div>
        </div>}
      </section>
      <section className="panel cc-executive-panel"><div className="cc-panel-heading"><h4>Contratos e licenças</h4><button onClick={onContracts}>Abrir contratos →</button></div>
        {subscriptions ? <><div className="cc-stat-grid"><div><strong>{subscriptions.filter((item) => item.status === 'active').length}</strong><span>Ativos</span></div><div><strong>{subscriptions.filter((item) => item.status === 'trial').length}</strong><span>Degustação</span></div><div><strong>{endingSoon}</strong><span>Vencem em 60 dias</span></div></div>
          <p className="cc-panel-note">Valor anual contratado ativo: {brl(subscriptions.filter((item) => item.status === 'active').reduce((sum, item) => sum + Number(item.annual_price_cents_snapshot ?? 0), 0))}. Não representa receita recebida.</p></> : <p>Dados indisponíveis.</p>}
      </section>
      <section className="panel cc-executive-panel"><div className="cc-panel-heading"><h4>Usuários e administração</h4><button onClick={onTeam}>Equipe da plataforma →</button></div>
        <div className="cc-stat-grid"><div><strong>{registeredUsers ?? '—'}</strong><span>Usuários vinculados</span></div><div><strong>{activeUsers ?? '—'}</strong><span>Com vínculo ativo</span></div><div><strong>{inactiveUsers ?? '—'}</strong><span>Com vínculo inativo</span></div><div><strong>{newUsers ?? '—'}</strong><span>Novos em 30 dias</span></div><div><strong>{recentlyActive === null ? '—' : `${snapshot.activity?.length === 500 ? '≥' : ''}${recentlyActive}`}</strong><span>Atividade nas últimas 24 h</span></div></div><p className="cc-panel-note">Atividade recente não significa sessão online. Usuários com vínculos em estados diferentes podem aparecer nas duas categorias.</p>
      </section>
      <section className="panel cc-executive-panel"><div className="cc-panel-heading"><h4>Saúde dos serviços</h4></div>
        <div className="cc-service-list"><p><span>Banco / RPC</span><b className={tenantsError ? 'cc-bad' : tenantsLoading ? 'cc-unknown' : 'cc-good'}>{tenantsLoading ? 'Verificando' : tenantsError ? 'Erro na consulta' : 'Consulta OK'}</b></p>
          <p><span>Latência da consulta global</span><b>{responseMs === null ? 'Não disponível' : `${responseMs} ms`}</b></p>
          <p><span>Autenticação desta sessão</span><b className={snapshot.auth === 'ok' ? 'cc-good' : 'cc-unknown'}>{snapshot.auth === 'loading' ? 'Verificando' : snapshot.auth === 'ok' ? 'Sessão válida' : 'Não verificada'}</b></p>
          <p><span>Storage</span><b className="cc-unknown">Sem monitoramento</b></p><p><span>Edge Functions</span><b className="cc-unknown">Sem telemetria de falhas</b></p><p><span>Notificações / e-mails</span><b className="cc-unknown">Sem telemetria de entrega</b></p></div>
        <p className="cc-panel-note">Latência medida no navegador (rede + API + banco). Consulta bem-sucedida não é medição de uptime. CPU, memória, conexões, tamanho e erros históricos exigem telemetria de servidor.</p>
      </section>
      <section className="panel cc-executive-panel cc-executive-support"><div className="cc-panel-heading"><h4>Suporte e chamados</h4><button onClick={onSupport}>Abrir atendimento →</button></div>
        {tickets ? <><div className="cc-stat-grid"><div><strong>{openTickets.length}</strong><span>Em aberto</span></div><div><strong>{criticalTickets.length}</strong><span>Críticos</span></div><div><strong>{openOver24Hours}</strong><span>Abertos há mais de 24 h</span></div><div><strong>{oldestHours === null ? '—' : `${Math.floor(oldestHours)} h`}</strong><span>Mais antigo em aberto</span></div><div><strong>{meanResolutionHours === null ? '—' : `${Math.round(meanResolutionHours)} h`}</strong><span>Tempo médio até resolução</span></div></div>
          {highestTenants.length > 0 && <div className="cc-tenant-tickets"><strong>Por cliente</strong>{highestTenants.map(([id, count]) => <p key={id}><span>{tenants.find((tenant) => tenant.tenantId === id)?.tradeName ?? 'Cliente não listado'}</span><b>{count}</b></p>)}</div>}</> : <p>Dados indisponíveis.</p>}
      </section>
      <section className="panel cc-executive-panel cc-executive-support"><div className="cc-panel-heading"><h4>Segurança e auditoria</h4></div>
        {snapshot.audit ? snapshot.audit.length > 0 ? <div className="cc-service-list">{snapshot.audit.map((event) => <p key={event.id}><span>{event.action.replaceAll('_', ' ')} · {event.tenant_id ? tenants.find((tenant) => tenant.tenantId === event.tenant_id)?.tradeName ?? 'Cliente' : 'Plataforma'}</span><b>{new Date(event.created_at).toLocaleString('pt-BR')}</b></p>)}</div> : <p>Nenhum evento registrado.</p> : <p>Eventos não disponíveis para esta sessão.</p>}
        <p className="cc-panel-note">Falhas de login e tentativas negadas não são inferidas desta trilha; dependem de logs de Auth e acesso.</p>
      </section>
    </div>
  </div>;
}
