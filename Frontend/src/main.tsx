import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  Box,
  CalendarClock,
  ClipboardList,
  Factory,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import { AuthGate, type CurrentAccount } from './auth-gate';
import {
  type OperationalAsset as Asset,
  type OperationalWorkOrder as WorkOrder,
  type UpcomingPreventivePlan,
  useOperationalData,
} from './use-operational-data';
import { AssetAdmin } from './asset-admin';
import { WorkOrderAdmin } from './work-order-admin';
import { ServiceRequestAdmin } from './service-request-admin';
import { supabase } from './supabase';
import { UserAdmin as UserAdminModule } from './user-admin';
import { SupplierAdmin as SupplierAdminModule } from './supplier-admin';
import { OrganizationAdmin } from './organization-admin';
import { BrandingAdmin } from './branding-admin';
import { FinanceAdmin } from './finance-admin';
import { PurchaseManagement } from './purchase-management';
import { PreventivePlanAdmin } from './preventive-plan-admin';
import './styles.css';
import './brand.css';
import './auth.css';

function Badge({ children }: { children: string }) {
  return (
    <span className={`badge ${children.toLowerCase().replaceAll(' ', '-')}`}>
      {children}
    </span>
  );
}

function App({ account }: { account: CurrentAccount }) {
  const [page, setPage] = useState<
    | 'dashboard'
    | 'assets'
    | 'requests'
    | 'orders'
    | 'preventive_plans'
    | 'purchases'
    | 'client_admin'
    | 'netsecbr_admin'
  >('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const { assets, orders, overduePreventivePlans, upcomingPreventivePlans, isLoading, error, reload: reloadOperationalData } = useOperationalData(account.tenantId);
  const [search, setSearch] = useState('');
  const [clientAdminNavigationSignal, setClientAdminNavigationSignal] = useState(0);

  // Recarrega os dados operacionais toda vez que a Visão geral é aberta,
  // inclusive ao voltar de Preventivas (sem polling e sem Realtime).
  useEffect(() => {
    if (page === 'dashboard') {
      void reloadOperationalData();
    }
  }, [page, reloadOperationalData]);


     const nav = [
    { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
    { id: 'assets', label: 'Ativos', icon: Box },
    { id: 'requests', label: 'Solicitações', icon: AlertTriangle },
    { id: 'orders', label: 'Ordens de serviço', icon: ClipboardList },
    { id: 'preventive_plans', label: 'Preventivas', icon: CalendarClock },
    { id: 'client_admin', label: 'Configurações', icon: Factory },
    { id: 'netsecbr_admin', label: 'Control Center NETSECBR', icon: Wrench },
  ] as const;

  async function signOut() {
    await supabase.auth.signOut();
  }

  const canAccess = (permission: string) =>
    account.isNetsecbrAdmin ||
    account.isTenantAdmin ||
    account.permissions.includes(permission);

  const visibleNav = nav.filter(({ id }) => {
    if (id === 'dashboard') return true;

    if (id === 'assets') {
      return canAccess('assets.read') || canAccess('assets.manage');
    }

    if (id === 'requests') {
      return canAccess('service_requests.create');
    }

    if (id === 'orders') {
      return (
        canAccess('work_orders.read') ||
        canAccess('work_orders.create') ||
        canAccess('work_orders.execute')
      );
    }
    if (id === 'preventive_plans') {
      return (
        canAccess('assets.read') ||
        canAccess('assets.manage') ||
        canAccess('work_orders.read') ||
        canAccess('work_orders.create')
      );
    }

    if (id === 'client_admin') {
      return account.isTenantAdmin || account.isNetsecbrAdmin;
    }

    if (id === 'netsecbr_admin') {
      return account.isNetsecbrAdmin;
    }

    return false;
  });

  return (
    <div className="app-shell">
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <div className="brand-logo">
            <img src="/brand/logo_netsecbr.png" alt="NetSecBR" />
          </div>

          <div>
            <small>MARV PLATFORM</small>
          </div>

          <button className="mobile-close" onClick={() => setMenuOpen(false)}>
            <X />
          </button>
        </div>

        <div className="workspace">
          <Factory size={17} />
          <span>{account.tenantName}</span>
          <small>{account.roleLabel}</small>
        </div>

        <nav>
          {visibleNav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? 'active' : ''}
              onClick={() => {
                if (id === 'client_admin' && page === 'client_admin') {
                  setClientAdminNavigationSignal((current) => current + 1);
                }

                setPage(id);
                setMenuOpen(false);
                setSearch('');
              }}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button>
            <Bell size={18} />
            Notificações
            <span className="dot">3</span>
          </button>

          <button onClick={signOut}>
            <LogOut size={18} />
            Sair / trocar usuário
          </button>

          <div className="user">
            <span>{account.fullName.slice(0, 2).toUpperCase()}</span>

            <div>
              <strong>{account.fullName}</strong>
              <small>{account.roleLabel}</small>
            </div>
          </div>
        </div>
      </aside>

      <main>
        <header>
          <button className="mobile-menu" onClick={() => setMenuOpen(true)}>
            <Menu />
          </button>

          <div>
            <p className="eyebrow">
              {page === 'dashboard'
                ? 'GESTÃO DE MANUTENÇÃO'
                : page === 'client_admin'
                  ? 'MARV'
                  : page === 'netsecbr_admin'
                    ? 'ADMINISTRAÇÃO DA PLATAFORMA'
                  : 'GESTÃO DE MANUTENÇÃO'}
            </p>

            <h1>
              {page === 'dashboard'
                ? `Dashboard`
                : page === 'assets'
                  ? 'Ativos industriais'
                  : page === 'requests'
                    ? 'Solicitações de manutenção'
                    : page === 'orders'
                      ? 'Ordens de serviço'
                      : page === 'preventive_plans'
                        ? 'Planos preventivos'
                    : page === 'purchases'
                   ? 'Compras'
                      : page === 'client_admin'
                        ? 'Configurações'
                        : 'Control Center NETSECBR'}
            </h1>
          </div>

          <div className="header-actions">
            <label className="search">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar..."
              />
            </label>

            <button className="avatar" title={account.email}>
              {account.fullName.slice(0, 2).toUpperCase()}
            </button>
          </div>
        </header>

        {error && <p className="data-error">{error}</p>}
        {isLoading && <p className="data-loading">Carregando dados do cliente…</p>}

        {!isLoading && page === 'dashboard' && (
          <Dashboard
            assets={assets}
            orders={orders}
            overduePreventivePlans={overduePreventivePlans}
            upcomingPreventivePlans={upcomingPreventivePlans}
            onOpenOrders={() => setPage('orders')}
            onOpenPreventivePlans={() => setPage('preventive_plans')}
          />
        )}

        {!isLoading && page === 'assets' && (
          <AssetAdmin
            tenantId={account.tenantId}
            canManage={canAccess('assets.manage')}
          />
        )}

        {!isLoading && page === 'requests' && (
          <ServiceRequestAdmin
            tenantId={account.tenantId}
            currentUserId={account.userId}
            isTenantAdmin={account.isTenantAdmin || account.isNetsecbrAdmin}
            canCreate={
              account.isNetsecbrAdmin ||
              account.isTenantAdmin ||
              account.permissions.includes('service_requests.create')
            }
          />
        )}

        {!isLoading && page === 'orders' && (
          <WorkOrderAdmin
            tenantId={account.tenantId}
            currentUserId={account.userId}
            isTenantAdmin={account.isTenantAdmin || account.isNetsecbrAdmin}
            canCreate={
              account.isNetsecbrAdmin ||
              account.isTenantAdmin ||
              account.permissions.includes('work_orders.create')
            }
          />
        )}
        {!isLoading && page === 'preventive_plans' && (
          <PreventivePlanAdmin
            tenantId={account.tenantId}
            canManage={account.isTenantAdmin || account.isNetsecbrAdmin}
          />
        )}
        {!isLoading && page === 'purchases' && (
          <PurchaseManagement
            tenantId={account.tenantId}
            currentUserId={account.userId}
            canManage={
              account.isNetsecbrAdmin ||
              account.isTenantAdmin ||
              account.permissions.includes('purchase_requests.approve')
            }
          />
        )}
        {!isLoading && page === 'client_admin' && (
          <AdminPanel
            account={account}
            navigationSignal={clientAdminNavigationSignal}
            title="Configurações"
            cards={[
              'Usuários e permissões',
              'Identidade visual',
              'Painel Financeiro',
              'Cadastros',
              'Integrações e importações',
            ]}
          />
        )}

        {!isLoading && page === 'netsecbr_admin' && (
          <AdminPanel
            title="Control Center NETSECBR"
            cards={[
              'Clientes e tenants',
              'Planos e contratos',
              'Financeiro NETSECBR',
              'Suporte e auditoria',
            ]}
          />
        )}
      </main>
    </div>
  );
}

// Data local do usuário no formato YYYY-MM-DD, comparável com a coluna date.
function getLocalTodayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDashboardDate(value: string) {
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

// Rótulo relativo da próxima execução: Atrasada, Hoje, Amanhã ou "Em X dias".
function getPreventiveRelativeLabel(nextDueDate: string) {
  const today = getLocalTodayIso();

  if (nextDueDate < today) return 'Atrasada';

  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
  const [dueYear, dueMonth, dueDay] = nextDueDate.split('-').map(Number);
  const diffDays = Math.round(
    (Date.UTC(dueYear, dueMonth - 1, dueDay) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / 86400000,
  );

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';

  return `Em ${diffDays} dias`;
}

function Dashboard({
  assets,
  orders,
  overduePreventivePlans,
  upcomingPreventivePlans,
  onOpenOrders,
  onOpenPreventivePlans,
}: {
  assets: Asset[];
  orders: WorkOrder[];
  overduePreventivePlans: number;
  upcomingPreventivePlans: UpcomingPreventivePlan[];
  onOpenOrders: () => void;
  onOpenPreventivePlans: () => void;
}) {
  const critical = orders.filter((order) => order.priority === 'Crítica').length;

  return (
    <section className="content admin-panel">
      <div className="quick">
        <button className="primary" onClick={onOpenOrders}>
          <Plus size={18} />
          Ver ordens de serviço
        </button>
      </div>

      <div className="metrics">
        <Metric
          label="OS abertas"
          value={String(orders.length)}
          trend={`${critical} críticas`}
          icon={<ClipboardList />}
        />

        <Metric
          label="Preventivas atrasadas"
          value={String(overduePreventivePlans)}
          trend={
            overduePreventivePlans === 0
              ? 'Nenhuma preventiva atrasada'
              : overduePreventivePlans === 1
                ? '1 plano requer atenção'
                : `${overduePreventivePlans} planos requerem atenção`
          }
          icon={<AlertTriangle />}
          warn={overduePreventivePlans > 0}
        />

        <Metric
          label="Ativos em parada"
          value={String(
            assets.filter(
              (asset) =>
                asset.status === 'Parado' || asset.status === 'Em manutenção',
            ).length,
          )}
          trend={`de ${assets.length} ativos`}
          icon={<Wrench />}
        />

        <Metric
          label="Disponibilidade"
          value="—"
          trend="Indicador em breve"
          icon={<Factory />}
        />
      </div>

      <div className="grid">
        <article className="panel orders-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">ATENÇÃO IMEDIATA</p>
              <h2>Ordens prioritárias</h2>
            </div>

            <button onClick={onOpenOrders}>
              Ver todas <ArrowRight size={16} />
            </button>
          </div>

          {orders.slice(0, 3).map((order) => (
            <div className="order-row" key={order.id}>
              <div className="order-icon">
                <Wrench size={18} />
              </div>

              <div>
                <strong>
                  OS #{order.number} · {order.title}
                </strong>
                <p>
                  {order.asset} · {order.technician}
                </p>
              </div>

              <div>
                <Badge>{order.priority}</Badge>
                <small>{order.status}</small>
              </div>
            </div>
          ))}

          {!orders.length && <p className="empty">Nenhuma ordem cadastrada.</p>}
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">MANUTENÇÃO PREVENTIVA</p>
              <h2>Próximas preventivas</h2>
            </div>

            <button onClick={onOpenPreventivePlans}>
              Ver preventivas <ArrowRight size={16} />
            </button>
          </div>

          {upcomingPreventivePlans.length === 0 && (
            <p className="empty">Nenhuma preventiva programada.</p>
          )}

          {upcomingPreventivePlans.map((plan) => {
            const relativeLabel = getPreventiveRelativeLabel(plan.nextDueDate);

            return (
              <div className="order-row" key={plan.id}>
                <div className="order-icon">
                  <CalendarClock size={18} />
                </div>

                <div>
                  <strong>{plan.name}</strong>
                  <p>{plan.assetLabel}</p>
                </div>

                <div>
                  <Badge>{relativeLabel}</Badge>
                  <small>{formatDashboardDate(plan.nextDueDate)}</small>
                </div>
              </div>
            );
          })}
        </article>
      </div>

      <article className="panel asset-health">
        <div className="panel-head">
          <div>
            <p className="eyebrow">VISÃO OPERACIONAL</p>
            <h2>Saúde dos ativos</h2>
          </div>

          <button onClick={onOpenOrders}>
            Ver ordens <ArrowRight size={16} />
          </button>
        </div>

        <div className="health-row">
          <div>
            <b className="green">
              {assets.filter((asset) => asset.status === 'Operando').length}
            </b>
            <span>Operando normalmente</span>
          </div>

          <div>
            <b className="yellow">
              {assets.filter((asset) => asset.status === 'Em manutenção').length}
            </b>
            <span>Em manutenção</span>
          </div>

          <div>
            <b className="red">
              {assets.filter((asset) => asset.status === 'Parado').length}
            </b>
            <span>Parados</span>
          </div>
        </div>
      </article>
    </section>
  );
}

function AdminPanel({
  title,
  cards,
  account,
  navigationSignal = 0,
}: {
  title: string;
  cards: string[];
  account?: CurrentAccount;
  navigationSignal?: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const lastNavigationSignal = useRef(navigationSignal);
  const cardCategories: Record<string, string> = {
    'Usuários e permissões': 'ACESSOS',
    'Identidade visual': 'IDENTIDADE',
    'Painel Financeiro': 'FINANCEIRO',
    Cadastros: 'ESTRUTURA E PARCEIROS',
    'Integrações e importações': 'INTEGRAÇÕES',
    'Clientes e tenants': 'OPERAÇÃO',
    'Planos e contratos': 'COMERCIAL',
    'Financeiro NETSECBR': 'FINANCEIRO',
    'Suporte e auditoria': 'GOVERNANÇA',
  };

  useEffect(() => {
    if (lastNavigationSignal.current === navigationSignal) return;

    lastNavigationSignal.current = navigationSignal;
    setSelected(null);
  }, [navigationSignal]);

  return (
    <section className="content">
      {!selected && (
        <div className="admin-module-grid">
          {cards.map((card) => (
            <button
              className="admin-module-card"
              key={card}
              onClick={() => setSelected(card)}
            >
              <div className="metric-icon">
                <Wrench />
              </div>
              <p>{cardCategories[card] ?? 'CONFIGURAÇÕES'}</p>
              <h2>{card}</h2>
              <small>Abrir módulo →</small>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <section className="admin-module-detail">
          {/* Cadastros tem dois níveis e monta o próprio cabeçalho. */}
          {selected !== 'Cadastros' && (
            <div className="admin-module-header">
              <div>
                <p className="eyebrow">{title.toUpperCase()}</p>
                <h2>{selected}</h2>
              </div>

              <button className="secondary" onClick={() => setSelected(null)}>
                Voltar para configurações
              </button>
            </div>
          )}

         {selected === 'Usuários e permissões' && account ? (
  <UserAdmin tenantId={account.tenantId} account={account} />
) : selected === 'Identidade visual' && account ? (
  <BrandingAdmin tenantId={account.tenantId} />
) : selected === 'Painel Financeiro' && account ? (
  <FinanceAdmin tenantId={account.tenantId} />
) : selected === 'Cadastros' && account ? (
  <RegistryAdmin
    tenantId={account.tenantId}
    onBackToSettings={() => setSelected(null)}
  />
) : selected === 'Integrações e importações' ? (
            <div className="insight">
              <span>
                <Factory size={18} />
              </span>
              <p>
                Integrações e importações CSV serão configuradas por cliente nesta área.
              </p>
            </div>
          ) : (
            <p>Este módulo será conectado aos dados reais na próxima etapa.</p>
          )}
        </section>
      )}
    </section>
  );
}

function RegistryAdmin({
  tenantId,
  onBackToSettings,
}: {
  tenantId: string;
  onBackToSettings: () => void;
}) {
  const [selectedModule, setSelectedModule] = useState<'organization' | 'suppliers' | null>(null);

  const subModuleTitles = {
    organization: 'Unidades e centros de custo',
    suppliers: 'Fornecedores',
  } as const;

  if (selectedModule) {
    return (
      <section className="admin-registry-content">
        <div className="admin-module-header">
          <div>
            <p className="eyebrow">CONFIGURAÇÕES · CADASTROS</p>
            <h2>{subModuleTitles[selectedModule]}</h2>
          </div>

          <div className="admin-module-header-actions">
            <button className="secondary" onClick={() => setSelectedModule(null)}>
              Voltar para cadastros
            </button>

            <button className="secondary" onClick={onBackToSettings}>
              Voltar para configurações
            </button>
          </div>
        </div>

        {selectedModule === 'organization' ? (
          <OrganizationAdmin tenantId={tenantId} />
        ) : (
          <SupplierAdminModule tenantId={tenantId} />
        )}
      </section>
    );
  }

  return (
    <>
      <div className="admin-module-header">
        <div>
          <p className="eyebrow">CONFIGURAÇÕES</p>
          <h2>Cadastros</h2>
        </div>

        <button className="secondary" onClick={onBackToSettings}>
          Voltar para configurações
        </button>
      </div>

      <div className="admin-registry-grid">
        <button className="admin-module-card" onClick={() => setSelectedModule('organization')}>
          <div className="metric-icon"><Factory /></div>
          <p>ESTRUTURA</p>
          <h2>Unidades e centros de custo</h2>
          <small>Organizar a operação →</small>
        </button>
        <button className="admin-module-card" onClick={() => setSelectedModule('suppliers')}>
          <div className="metric-icon"><Building2 /></div>
          <p>PARCEIROS</p>
          <h2>Fornecedores</h2>
          <small>Gerenciar fornecedores →</small>
        </button>
      </div>
    </>
  );
}

function UserAdmin({
  tenantId,
  account,
}: {
  tenantId: string;
  account: CurrentAccount;
}) {
  return (
    <UserAdminModule
      tenantId={tenantId}
      currentName={account.fullName}
      currentRole={account.roleLabel}
    />
  );
}

function Metric({
  label,
  value,
  trend,
  icon,
  warn,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <article className={`metric ${warn ? 'warning' : ''}`}>
      <div className="metric-icon">{icon}</div>
      <p>{label}</p>
      <h2>{value}</h2>
      <small>{trend}</small>
    </article>
  );
}

createRoot(document.getElementById('root')!).render(
  <AuthGate>{(account) => <App account={account} />}</AuthGate>,
);
