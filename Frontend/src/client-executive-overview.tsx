import type { ReactNode } from 'react';
import { useClientDashboard, type ClientDashboardData } from './use-client-dashboard';
import './executive-dashboard.css';

type Props = {
  tenantId: string;
  onOpenAssets: () => void;
  onOpenPlans: () => void;
  onOpenOrders: () => void;
  onOpenRequests: () => void;
  canOpenAssets: boolean;
  canOpenPlans: boolean;
  canOpenOrders: boolean;
  canOpenRequests: boolean;
};

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const hours = (value: number) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)} h`;

function State({ loading, error, children }: { loading: boolean; error: string | null; children: ReactNode }) {
  if (loading) return <p className="executive-state">Carregando indicadores…</p>;
  if (error) return <p className="executive-state executive-state-error" role="alert">{error}</p>;
  return <>{children}</>;
}

function Figure({ label, value, tone = 'blue' }: { label: string; value: string | number; tone?: string }) {
  return <div className={`executive-figure executive-tone-${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}

function Link({ allowed, onClick, children }: { allowed: boolean; onClick: () => void; children: ReactNode }) {
  return allowed ? <button type="button" className="executive-link" onClick={onClick}>{children} →</button> : null;
}

function AssetHealth({ health }: { health: NonNullable<ClientDashboardData['health']['value']> }) {
  const healthy = health.total ? Math.round(health.normal / health.total * 100) : 0;
  const segments = [health.normal, health.attention, health.risk, health.critical].map((value) => health.total ? value / health.total * 180 : 0);
  const stops = segments.reduce<number[]>((result, segment) => [...result, (result.at(-1) ?? 0) + segment], []);
  const background = health.total ? `conic-gradient(from 270deg, #19885b 0deg ${stops[0]}deg, #e5ae28 ${stops[0]}deg ${stops[1]}deg, #e8752d ${stops[1]}deg ${stops[2]}deg, #c83b49 ${stops[2]}deg 180deg, #e7edf5 180deg 360deg)` : '#e7edf5';
  return <>
    <div className="executive-half-gauge" style={{ background }} role="img" aria-label={`${healthy}% dos ativos em condição normal`}>
      <div><strong>{health.total ? `${healthy}%` : '—'}</strong><span>em condição normal</span></div>
    </div>
    <div className="executive-health-key">
      <span><i className="executive-dot normal" />Normal <b>{health.normal}</b></span>
      <span><i className="executive-dot attention" />Atenção <b>{health.attention}</b></span>
      <span><i className="executive-dot risk" />Risco <b>{health.risk}</b></span>
      <span><i className="executive-dot critical" />Crítico <b>{health.critical}</b></span>
    </div>
    <p className="executive-definition">Normal: operando; atenção: manutenção/inativo; risco: parado; crítico: parado com criticidade alta/crítica. {health.retired > 0 && `${health.retired} aposentado(s) fora do total.`}</p>
  </>;
}

export function ClientExecutiveOverview(props: Props) {
  const { data, isLoading } = useClientDashboard(props.tenantId);
  return <div className="client-executive" aria-label="Indicadores executivos industriais">
    <div className="client-executive-heading"><div><p className="eyebrow">OPERAÇÃO INDUSTRIAL</p><h2>Panorama do cliente</h2></div><span>Dados acessíveis nesta sessão</span></div>
    <div className="client-executive-grid">
      <article className="panel executive-tile executive-tile-health">
        <h3>Saúde dos ativos</h3>
        <State loading={isLoading} error={data.health.error}>{data.health.value && <AssetHealth health={data.health.value} />}</State>
        <Link allowed={props.canOpenAssets} onClick={props.onOpenAssets}>Ver ativos</Link>
      </article>
      <article className="panel executive-tile">
        <h3>Ordens de serviço</h3>
        <State loading={isLoading} error={data.orders.error}>{data.orders.value && <div className="executive-figures">
          <Figure label="Abertas" value={data.orders.value.open} />
          <Figure label="Em execução ou aguardando material" value={data.orders.value.executing} tone="yellow" />
          <Figure label="Concluídas" value={data.orders.value.completed} tone="green" />
          <Figure label="Atrasadas (prazo agendado)" value={data.orders.value.overdue} tone="red" />
        </div>}</State>
        <Link allowed={props.canOpenOrders} onClick={props.onOpenOrders}>Ver OS</Link>
      </article>
      <article className="panel executive-tile">
        <h3>Preventivas</h3>
        <State loading={isLoading} error={data.plans.error}>{data.plans.value && <div className="executive-figures">
          <Figure label="Planos programados" value={data.plans.value.scheduled} />
          <Figure label="Próximas em 30 dias" value={data.plans.value.upcoming} tone="yellow" />
          <Figure label="Planos atrasados" value={data.plans.value.overdue} tone="red" />
          <Figure label="OS preventivas concluídas" value={data.plans.value.completedOrders} tone="green" />
        </div>}</State>
        <Link allowed={props.canOpenPlans} onClick={props.onOpenPlans}>Ver planos</Link>
      </article>
      <article className="panel executive-tile">
        <h3>Disponibilidade atual</h3>
        <State loading={isLoading} error={data.availability.error}>{data.availability.value && <>
          <div className="executive-figures"><Figure label="Ativos operando" value={data.availability.value.available} tone="green" /><Figure label="Parados ou em manutenção" value={data.availability.value.unavailable} tone="red" /></div>
          <p className="executive-detail">Paradas concluídas com início e fim registrados: {data.availability.value.downtimeHours === null ? 'sem medição completa' : hours(data.availability.value.downtimeHours)}</p>
          <p className="executive-detail">Tempo médio de reparo (MTTR): {data.availability.value.mttrHours === null ? 'sem dados suficientes' : hours(data.availability.value.mttrHours)}</p>
        </>}</State>
      </article>
      <article className="panel executive-tile">
        <h3>Custos registrados</h3>
        <State loading={isLoading} error={data.costs.error}>{data.costs.value && <>
          <div className="executive-figures"><Figure label="Preventiva" value={money(data.costs.value.preventiveCents)} /><Figure label="Corretiva" value={money(data.costs.value.correctiveCents)} tone="yellow" /></div>
          <p className="executive-detail">Paradas estimadas: {data.costs.value.estimatedStopCents === null ? 'sem valor/hora e duração completos' : money(data.costs.value.estimatedStopCents)}</p>
          <p className="executive-definition">Soma dos custos lançados nas OS acessíveis. Não inclui valores apenas estimados na solicitação.</p>
        </>}</State>
      </article>
      <article className="panel executive-tile">
        <h3>Solicitações</h3>
        <State loading={isLoading} error={data.requests.error}>{data.requests.value && <div className="executive-figures">
          <Figure label="Abertas" value={data.requests.value.open} />
          <Figure label="Em triagem / aprovação" value={data.requests.value.pendingApproval} tone="yellow" />
          <Figure label="Aprovadas em 30 dias" value={data.requests.value.recentlyApproved} tone="green" />
        </div>}</State>
        <Link allowed={props.canOpenRequests} onClick={props.onOpenRequests}>Ver solicitações</Link>
      </article>
    </div>
    <p className="executive-not-measured">SLA e MTBF: não calculados sem política aplicável e histórico de operação suficiente. Disponibilidade acima representa o estado atual dos ativos, não percentual de uptime.</p>
  </div>;
}
