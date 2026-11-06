import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
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
  type OperationalWorkOrder as WorkOrder,
  type PendingServiceRequest,
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
import { SupportTicketAdmin } from './support-ticket-admin';
import { HelpCenterPage } from './help-center';
import { CommandCenter } from './command-center';
import { PlatformApp } from './platform-app';
import { workOrderDisplayTitle } from './work-order-label';
import { ClientExecutiveOverview } from './client-executive-overview';
import './styles.css';
import './executive-dashboard.css';
import './brand.css';
import './auth.css';

function Badge({ children }: { children: string }) {
  return (
    <span className={`badge ${children.toLowerCase().replaceAll(' ', '-')}`}>
      {children}
    </span>
  );
}

type Page = 'dashboard' | 'assets' | 'requests' | 'orders' | 'preventive_plans' | 'help' | 'purchases' | 'client_admin' | 'netsecbr_admin';

function canOpenPage(page: string, account: CurrentAccount): page is Page {
  const allowed = (permission: string) => account.isNetsecbrAdmin || account.isTenantAdmin || account.permissions.includes(permission);
  switch (page) {
    case 'dashboard': case 'help': return true;
    case 'assets': return allowed('assets.read') || allowed('assets.manage');
    case 'requests': return allowed('service_requests.create');
    case 'orders': return allowed('work_orders.read') || allowed('work_orders.create');
    case 'preventive_plans': return allowed('assets.read') || allowed('assets.manage') || allowed('work_orders.read') || allowed('work_orders.create');
    case 'purchases': return allowed('purchase_requests.approve');
    case 'client_admin': return account.isTenantAdmin || account.isNetsecbrAdmin;
    case 'netsecbr_admin': return account.isNetsecbrAdmin;
    default: return false;
  }
}

function TenantApp({ account }: { account: CurrentAccount }) {
  const [tenantBranding, setTenantBranding] = useState<{ name: string | null; logoUrl: string | null }>({ name: null, logoUrl: null });
  useEffect(() => {
    if (!account.tenantId) return;
    let active = true;
    const refreshBranding = () => { void (async () => {
      const { data, error } = await supabase.from('tenant_branding')
        .select('display_name, logo_path').eq('tenant_id', account.tenantId).maybeSingle();
      if (!active || error || !data) return;
      let logoUrl: string | null = null;
      if (data.logo_path) {
        const { data: signed, error: signedError } = await supabase.storage
          .from('tenant-branding').createSignedUrl(data.logo_path, 86400);
        if (!signedError) logoUrl = signed?.signedUrl ?? null;
      }
      if (active) setTenantBranding({ name: data.display_name, logoUrl });
    })(); };
    refreshBranding();
    const onBrandingUpdated = (event: Event) => {
      if ((event as CustomEvent<{ tenantId: string }>).detail?.tenantId === account.tenantId) refreshBranding();
    };
    window.addEventListener('marv:branding-updated', onBrandingUpdated);
    return () => { active = false; window.removeEventListener('marv:branding-updated', onBrandingUpdated); };
  }, [account.tenantId]);
  const pageStorageKey = `marv:last-page:${account.userId}:${account.tenantId}`;
  const [page, setPage] = useState<Page>(() => {
    try {
      const stored = window.sessionStorage.getItem(pageStorageKey) ?? '';
      return canOpenPage(stored, account) ? stored : 'dashboard';
    } catch { return 'dashboard'; }
  });
  useEffect(() => {
    try { window.sessionStorage.setItem(pageStorageKey, page); } catch { /* storage indisponível */ }
  }, [pageStorageKey, page]);
  const [focusedWorkOrderId, setFocusedWorkOrderId] = useState<string | null>(null);
  const [focusedPlan, setFocusedPlan] = useState<{ assetId: string; planId?: string; create?: boolean } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const {
    orders,
    upcomingPreventivePlans,
    pendingServiceRequests,
    isLoading,
    error,
    reload: reloadOperationalData,
  } = useOperationalData(account.tenantId);
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
    { id: 'help', label: 'Ajuda', icon: BookOpen },
    { id: 'client_admin', label: 'Configurações', icon: Factory },
    { id: 'netsecbr_admin', label: 'MARV Command Center', icon: Wrench },
  ] as const;

  async function signOut() {
    try { window.sessionStorage.removeItem(pageStorageKey); } catch { /* storage indisponível */ }
    await supabase.auth.signOut();
  }

  const canAccess = (permission: string) =>
    account.isNetsecbrAdmin ||
    account.isTenantAdmin ||
    account.permissions.includes(permission);

  const visibleNav = nav.filter(({ id }) => {
    if (id === 'dashboard') return true;

    // A Ajuda é liberada para todo usuário autenticado.
    if (id === 'help') return true;

    if (id === 'assets') {
      return canAccess('assets.read') || canAccess('assets.manage');
    }

    if (id === 'requests') {
      return canAccess('service_requests.create');
    }

    if (id === 'orders') {
      return canAccess('work_orders.read') || canAccess('work_orders.create');
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

  // Atalhos do Dashboard seguem exatamente as mesmas condições do menu:
  // nenhum botão abre um módulo que estaria oculto na navegação.
  const canOpenAssets = canAccess('assets.read') || canAccess('assets.manage');
  const canOpenOrders = canAccess('work_orders.read') || canAccess('work_orders.create');
  const canOpenRequests = canAccess('service_requests.create');
  const canApproveRequests = account.isTenantAdmin || account.isNetsecbrAdmin;
  const canOpenPreventivePlans =
    canAccess('assets.read') ||
    canAccess('assets.manage') ||
    canAccess('work_orders.read') ||
    canAccess('work_orders.create');

  return (
    <div className="app-shell">
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <div className="brand-logo">
            <img
              src={page === 'netsecbr_admin' ? '/brand/logo_netsecbr.png' : tenantBranding.logoUrl ?? '/brand/logo_netsecbr.png'}
              alt={page === 'netsecbr_admin' ? 'NetSecBR' : tenantBranding.name ?? account.tenantName}
            />
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
          <span>{page === 'netsecbr_admin' ? 'NETSECBR' : tenantBranding.name ?? account.tenantName}</span>
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
                    ? 'VISÃO GLOBAL DA OPERAÇÃO MARV'
                  : page === 'help'
                    ? 'SUPORTE E ORIENTAÇÕES'
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
                        : page === 'help' ? 'Ajuda e Manual de Operação' : 'MARV Command Center'}
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
        {page === 'dashboard' && isLoading && (
          <p className="data-loading">Carregando dados do cliente…</p>
        )}

        {!isLoading && page === 'dashboard' && (
          <Dashboard
            tenantId={account.tenantId}
            orders={orders}
            upcomingPreventivePlans={upcomingPreventivePlans}
            pendingServiceRequests={pendingServiceRequests}
            canOpenOrders={canOpenOrders}
            canOpenAssets={canOpenAssets}
            canOpenPreventivePlans={canOpenPreventivePlans}
            canOpenRequests={canOpenRequests}
            canApproveRequests={canApproveRequests}
            onOpenOrders={() => {
              if (canOpenOrders) setPage('orders');
            }}
            onOpenAssets={() => {
              if (canOpenAssets) setPage('assets');
            }}
            onOpenPreventivePlans={() => {
              if (canOpenPreventivePlans) setPage('preventive_plans');
            }}
            onOpenRequests={() => {
              if (canOpenRequests) setPage('requests');
            }}
          />
        )}

        {!isLoading && page === 'assets' && (
          <AssetAdmin
            tenantId={account.tenantId}
            canManage={canAccess('assets.manage')}
            onOpenPlan={(assetId, planId) => { setFocusedPlan({ assetId, planId, create: !planId }); setPage('preventive_plans'); }}
            onOpenOrder={(workOrderId) => { setFocusedWorkOrderId(workOrderId); setPage('orders'); }}
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
            onOpenOrders={() => setPage('orders')}
          />
        )}

        {!isLoading && page === 'orders' && (
          <WorkOrderAdmin
            tenantId={account.tenantId}
            focusWorkOrderId={focusedWorkOrderId}
            onFocusConsumed={() => setFocusedWorkOrderId(null)}
            currentUserId={account.userId}
            currentUserName={account.fullName}
            tenantName={account.tenantName}
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
            focus={focusedPlan}
            onFocusConsumed={() => setFocusedPlan(null)}
            onOpenOrders={(workOrderId) => {
              setFocusedWorkOrderId(workOrderId);
              setPage('orders');
            }}
          />
        )}
        {!isLoading && page === 'help' && <HelpCenterPage />}

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
              ...(account.isTenantAdmin ? ['Suporte NETSECBR'] : []),
            ]}
          />
        )}

        {!isLoading && page === 'netsecbr_admin' && (
          <CommandCenter isNetsecbrAdmin={account.isNetsecbrAdmin} currentUserId={account.userId} />
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
  tenantId,
  orders,
  upcomingPreventivePlans,
  pendingServiceRequests,
  canOpenAssets,
  canOpenOrders,
  canOpenPreventivePlans,
  canOpenRequests,
  canApproveRequests,
  onOpenAssets,
  onOpenOrders,
  onOpenPreventivePlans,
  onOpenRequests,
}: {
  tenantId: string;
  orders: WorkOrder[];
  upcomingPreventivePlans: UpcomingPreventivePlan[];
  pendingServiceRequests: PendingServiceRequest[];
  canOpenAssets: boolean;
  canOpenOrders: boolean;
  canOpenPreventivePlans: boolean;
  canOpenRequests: boolean;
  canApproveRequests: boolean;
  onOpenAssets: () => void;
  onOpenOrders: () => void;
  onOpenPreventivePlans: () => void;
  onOpenRequests: () => void;
}) {
  return (
    <section className="content admin-panel">
      <div className="quick">
        {canOpenOrders && (
          <button className="primary" onClick={onOpenOrders}>
            <Plus size={18} />
            Ver ordens de serviço
          </button>
        )}
      </div>

      <ClientExecutiveOverview
        tenantId={tenantId}
        canOpenAssets={canOpenAssets}
        canOpenPlans={canOpenPreventivePlans}
        canOpenOrders={canOpenOrders}
        canOpenRequests={canOpenRequests}
        onOpenAssets={onOpenAssets}
        onOpenPlans={onOpenPreventivePlans}
        onOpenOrders={onOpenOrders}
        onOpenRequests={onOpenRequests}
      />

      <div className="grid">
        <article className="panel orders-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">ACOMPANHAMENTO</p>
              <h2>OS recentes</h2>
            </div>

            {canOpenOrders && (
              <button onClick={onOpenOrders}>
                Ver todas <ArrowRight size={16} />
              </button>
            )}
          </div>

          {orders.slice(0, 3).map((order) => (
            <div className="order-row" key={order.id}>
              <div className="order-icon">
                <Wrench size={18} />
              </div>

              <div>
                <strong>
                  OS #{order.number} · {workOrderDisplayTitle(order.title, order.type.toLowerCase() === 'preventiva' ? 'preventive' : order.type.toLowerCase())}
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

            {canOpenPreventivePlans && (
              <button onClick={onOpenPreventivePlans}>
                Ver preventivas <ArrowRight size={16} />
              </button>
            )}
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

        {canApproveRequests && <article className="panel orders-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">APROVAÇÕES</p>
              <h2>Solicitações pendentes</h2>
            </div>

            {canOpenRequests && (
              <button onClick={onOpenRequests}>
                Ver solicitações <ArrowRight size={16} />
              </button>
            )}
          </div>

          {pendingServiceRequests.length === 0 && (
            <p className="empty">Nenhuma solicitação aguardando aprovação.</p>
          )}

          {pendingServiceRequests.slice(0, 3).map((request) => (
            <div className="order-row" key={request.id}>
              <div className="order-icon">
                <ClipboardList size={18} />
              </div>

              <div>
                <strong>Solicitação #{request.requestNumber} · {request.title}</strong>
                <p>Aguardando aprovação para criação da OS</p>
              </div>

              <div>
                <Badge>{request.priority}</Badge>
                <small>{formatDashboardDate(request.requestedAt)}</small>
              </div>
            </div>
          ))}
        </article>}
      </div>

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
  const settingsKey = `marv:settings:${account?.userId ?? 'anonymous'}:${account?.tenantId ?? ''}`;
  const [selected, setSelected] = useState<string | null>(() => {
    try {
      const saved = window.sessionStorage.getItem(settingsKey);
      return saved && cards.includes(saved) ? saved : null;
    } catch { return null; }
  });
  useEffect(() => {
    try {
      if (selected) window.sessionStorage.setItem(settingsKey, selected);
      else window.sessionStorage.removeItem(settingsKey);
    } catch { /* storage indisponível */ }
  }, [settingsKey, selected]);
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
    'Suporte NETSECBR': 'SUPORTE',
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
) : selected === 'Suporte NETSECBR' && account ? (
  <SupportTicketAdmin tenantId={account.tenantId} account={account} />
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
      currentUserId={account.userId}
      currentName={account.fullName}
      currentRole={account.roleLabel}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <AuthGate>{(account) => account.isNetsecbrAdmin ? <PlatformApp account={account} /> : <TenantApp account={account} />}</AuthGate>,
);
