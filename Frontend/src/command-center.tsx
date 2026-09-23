import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Building2,
  CalendarClock,
  ClipboardList,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useCommandCenterData, type CommandCenterTenant } from './use-command-center-data';

type SituationFilter = 'all' | 'active' | 'inactive';

const tableGrid = { gridTemplateColumns: '1.6fr 1.1fr .8fr .7fr .6fr .7fr .9fr .8fr' };

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${day}/${month}/${date.getFullYear()}`;
}

function matchesSearch(tenant: CommandCenterTenant, term: string) {
  if (!term) return true;

  const text = `${tenant.tradeName} ${tenant.legalName}`.toLowerCase();
  const digits = tenant.documentNumber.replace(/\D/g, '');

  return text.includes(term) || (digits !== '' && digits.includes(term.replace(/\D/g, '')));
}

export function CommandCenter({ isNetsecbrAdmin }: { isNetsecbrAdmin: boolean }) {
  const { tenants, totals, isLoading, error, reload } = useCommandCenterData();
  const [search, setSearch] = useState('');
  const [situationFilter, setSituationFilter] = useState<SituationFilter>('all');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (isNetsecbrAdmin) {
      void reload();
    }
  }, [isNetsecbrAdmin, reload]);

  const normalizedSearch = search.trim().toLowerCase();

  const visibleTenants = useMemo(
    () => tenants.filter((tenant) => {
      if (!matchesSearch(tenant, normalizedSearch)) return false;
      if (situationFilter === 'active') return tenant.isActive;
      if (situationFilter === 'inactive') return !tenant.isActive;

      return true;
    }),
    [tenants, normalizedSearch, situationFilter],
  );

  if (!isNetsecbrAdmin) {
    return (
      <section className="content admin-panel">
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">ACESSO RESTRITO</p>
              <h2>MARV Command Center</h2>
            </div>
          </div>
          <p className="empty">
            Esta visão é exclusiva da equipe NETSECBR. Fale com o administrador da plataforma.
          </p>
        </article>
      </section>
    );
  }

  if (isLoading && tenants.length === 0) {
    return (
      <section className="content admin-panel">
        <article className="panel">
          <p className="empty">Carregando visão global…</p>
        </article>
      </section>
    );
  }

  const selectedTenant = tenants.find((tenant) => tenant.tenantId === selectedTenantId) ?? null;

  if (selectedTenant) {
    return (
      <section className="content admin-panel">
        <div className="admin-module-header">
          <div>
            <p className="eyebrow">MARV COMMAND CENTER · CLIENTE</p>
            <h2>{selectedTenant.tradeName}</h2>
          </div>
          <div className="admin-module-header-actions">
            <button className="secondary" onClick={() => setSelectedTenantId(null)}>
              <ArrowLeft size={17} />
              Voltar para Command Center
            </button>
          </div>
        </div>

        {error && <p className="data-error">{error}</p>}

        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">DADOS DO CLIENTE</p>
              <h2>{selectedTenant.legalName}</h2>
            </div>
            <span className={`badge ${selectedTenant.isActive ? 'asset-status-active' : 'asset-status-inactive'}`}>
              {selectedTenant.statusLabel}
            </span>
          </div>

          <div className="order-summary">
            <p><span>CNPJ</span><strong>{selectedTenant.documentNumber || 'Não informado'}</strong></p>
            <p><span>Criado em</span><strong>{formatDate(selectedTenant.createdAt)}</strong></p>
          </div>
        </article>

        <div className="metrics">
          <Metric label="Usuários ativos" value={String(selectedTenant.activeUsers)} icon={<Users size={17} />} />
          <Metric label="Ativos cadastrados" value={String(selectedTenant.assetCount)} icon={<Box size={17} />} />
          <Metric label="OS abertas" value={String(selectedTenant.openWorkOrders)} icon={<ClipboardList size={17} />} />
          <Metric
            label="Preventivas atrasadas"
            value={String(selectedTenant.overduePreventivePlans)}
            icon={<CalendarClock size={17} />}
            warn={selectedTenant.overduePreventivePlans > 0}
          />
        </div>

        <article className="panel">
          <div className="insight">
            <AlertTriangle size={18} />
            <p>
              Esta é uma visão global da NETSECBR. Alterações operacionais do cliente são
              realizadas dentro do ambiente do próprio cliente.
            </p>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="content admin-panel">
      <div className="user-admin-actions">
        <div className="asset-search">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou CNPJ..."
          />
        </div>

        <select
          className="status-filter"
          value={situationFilter}
          onChange={(event) => setSituationFilter(event.target.value as SituationFilter)}
        >
          <option value="all">Todos os clientes</option>
          <option value="active">Somente ativos</option>
          <option value="inactive">Somente inativos</option>
        </select>

        <button
          className="secondary button-with-icon"
          onClick={() => void reload()}
          disabled={isLoading}
        >
          <RefreshCw size={17} />
          Atualizar dados
        </button>
      </div>

      {error && (
        <div className="operation-toast operation-toast-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className="metrics">
        <Metric
          label="Clientes ativos"
          value={String(totals.activeTenants)}
          icon={<Building2 size={17} />}
        />
        <Metric
          label="Clientes inativos"
          value={String(totals.inactiveTenants)}
          icon={<Building2 size={17} />}
          warn={totals.inactiveTenants > 0}
        />
        <Metric
          label="Usuários ativos"
          value={String(totals.activeUsers)}
          icon={<Users size={17} />}
        />
        <Metric
          label="Ativos cadastrados"
          value={String(totals.assetCount)}
          icon={<Box size={17} />}
        />
        <Metric
          label="Ordens de serviço abertas"
          value={String(totals.openWorkOrders)}
          icon={<ClipboardList size={17} />}
        />
        <Metric
          label="Preventivas atrasadas"
          value={String(totals.overduePreventivePlans)}
          icon={<CalendarClock size={17} />}
          warn={totals.overduePreventivePlans > 0}
        />
      </div>

      <article className="panel table">
        <div className="panel-head">
          <div>
            <p className="eyebrow">CLIENTES MARV</p>
            <h2>Clientes</h2>
          </div>
          <span className="badge">
            {visibleTenants.length} de {tenants.length}
          </span>
        </div>

        {isLoading && <p className="empty">Atualizando dados...</p>}

        {!isLoading && tenants.length === 0 && (
          <p className="empty">Nenhum cliente cadastrado na plataforma até agora.</p>
        )}

        {!isLoading && tenants.length > 0 && visibleTenants.length === 0 && (
          <p className="empty">Nenhum cliente encontrado com a busca e o filtro atuais.</p>
        )}

        {visibleTenants.length > 0 && (
          <>
            <div className="table-head" style={tableGrid}>
              <span>Cliente</span>
              <span>CNPJ</span>
              <span>Situação</span>
              <span>Usuários ativos</span>
              <span>Ativos</span>
              <span>OS abertas</span>
              <span>Preventivas atrasadas</span>
              <span>Criado em</span>
            </div>

            {visibleTenants.map((tenant) => (
              <div
                className={`table-row${tenant.isActive ? '' : ' is-inactive'}`}
                style={tableGrid}
                key={tenant.tenantId}
              >
                <div>
                  <button
                    className="work-order-link"
                    onClick={() => setSelectedTenantId(tenant.tenantId)}
                  >
                    {tenant.tradeName}
                  </button>
                  <small>{tenant.legalName}</small>
                </div>
                <span>{tenant.documentNumber || 'Não informado'}</span>
                <span
                  className={`badge ${tenant.isActive ? 'asset-status-active' : 'asset-status-inactive'}`}
                >
                  {tenant.statusLabel}
                </span>
                <span>{tenant.activeUsers}</span>
                <span>{tenant.assetCount}</span>
                <span>{tenant.openWorkOrders}</span>
                <span>{tenant.overduePreventivePlans}</span>
                <span>{formatDate(tenant.createdAt)}</span>
              </div>
            ))}
          </>
        )}
      </article>
    </section>
  );
}

function Metric({
  label,
  value,
  icon,
  warn,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  warn?: boolean;
}) {
  return (
    <article className={`metric ${warn ? 'warning' : ''}`}>
      <div className="metric-icon">{icon}</div>
      <p>{label}</p>
      <h2>{value}</h2>
    </article>
  );
}

