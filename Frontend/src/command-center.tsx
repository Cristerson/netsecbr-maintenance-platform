import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Box,
  Building2,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileText,
  LifeBuoy,
  RefreshCw,
  Users,
} from 'lucide-react';
import {
  useCommandCenterData,
  useCommandCenterConsumption,
  useCommandCenterTenantDetail,
  updateCommandCenterTenant,
  formatStorage,
  formatConsumptionSummary,
  matchesFranchiseFilter,
  summarizeFranchiseByTenant,
  type ConsumptionSituation,
  type FranchiseFilter,
  type TenantFranchiseSummary,
  type CommandCenterTenant,
  type CommandCenterTenantDetail,
} from './use-command-center-data';
import { TenantFranchisePanel } from './tenant-franchise-panel';
import { PlatformTeamAdmin } from './platform-team-admin';
import { CommandCenterSupportAdmin } from './command-center-support-admin';
import { CommandCenterClientForm } from './command-center-client-form';
import { CommandCenterTenantUserProvisioning } from './command-center-tenant-user-provisioning';
import { UserAdmin } from './user-admin';
import { supabase } from './supabase';


import {
  createSubscriptionContract,
  saveSubscriptionPlan,
  setSubscriptionPlanActive,
  subscriptionStatusLabel,
  useSubscriptionContracts,
  useSubscriptionPlans,
  type SubscriptionContractRecord,
  type SubscriptionPlanRecord,
} from './use-command-center-data';


type SituationFilter = 'all' | 'active' | 'inactive' | 'franchise_attention' | 'franchise_ok' | 'franchise_unconfigured';

/* Converte a opção do filtro de situação em filtro de franquia na lista de clientes. */
const franchiseFilterBySituation: Partial<Record<SituationFilter, FranchiseFilter>> = {
  franchise_attention: 'attention',
  franchise_ok: 'ok',
  franchise_unconfigured: 'unconfigured',
};

type CommandCenterView = 'home' | 'clients' | 'health' | 'contracts' | 'platform_team' | 'support';

type TenantEditForm = {
  legalName: string;
  tradeName: string;
  documentNumber: string;
  status: string;
  reason: string;
};

/* Módulo SaaS ainda não implementado: aparece na home apenas como planejado. */
const plannedModules = [
  { eyebrow: 'FINANCEIRO', title: 'Cobrança', icon: <CreditCard /> },
];

type ClientDetailTabId = 'overview' | 'users' | 'contract' | 'operation' | 'audit';

/* Faixa de comandos do dossiê do cliente: navegação interna, sem nova rota. */
const clientDetailTabs: { id: ClientDetailTabId; label: string }[] = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'users', label: 'Usuários e acessos' },
  { id: 'contract', label: 'Contrato e licença' },
  { id: 'operation', label: 'Operação' },
  { id: 'audit', label: 'Auditoria' },
];

const tableGrid = { gridTemplateColumns: '1.5fr .95fr .75fr .7fr .6fr .6fr .8fr .7fr 1.05fr' };

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function isValidCnpj(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const calculate = (base: string, weights: number[]) => {
    const total = base.split('').reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculate(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculate(digits.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits === digits.slice(0, 12) + first + second;
}

function formatDate(value: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${day}/${month}/${date.getFullYear()}`;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function matchesSearch(tenant: CommandCenterTenant, term: string) {
  if (!term) return true;

  const text = `${tenant.tradeName} ${tenant.legalName}`.toLowerCase();
  const digits = tenant.documentNumber.replace(/\D/g, '');
  return text.includes(term) || (digits !== '' && digits.includes(term.replace(/\D/g, '')));
}

function formatAccessDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function isAccessOnline(lastSeenAt: string) {
  const lastSeen = new Date(lastSeenAt).getTime();
  return Number.isFinite(lastSeen) && Date.now() - lastSeen <= 5 * 60 * 1000;
}

/* Na lista de clientes o badge considera apenas franquias configuradas: quando nenhuma
   métrica tem limite contratado, o rótulo deixa claro que não há franquia, evitando
   marcar a carteira inteira como pendência. */
function getFranchiseBadge(summary: TenantFranchiseSummary): ConsumptionSituation {
  if (!summary.worstConfigured) {
    return { label: 'Sem franquia', className: 'asset-status-inactive', severity: 2 };
  }

  return summary.worstConfigured;
}

function TenantSaaSDetail({
  detail,
  franchiseByTenant,
  isFranchiseLoading,
  franchiseError,
  tenantName,
  onTenantUserCreated,
}: {
  detail: CommandCenterTenantDetail;
  franchiseByTenant: Map<string, TenantFranchiseSummary>;
  isFranchiseLoading: boolean;
  franchiseError: string;
  tenantName: string;
  onTenantUserCreated: () => Promise<void>;
}) {
  const { subscription } = detail;
  const onlineAccesses = detail.recentAccessActivities.filter((activity) => isAccessOnline(activity.lastSeenAt));

  return (
    <>
      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">ACESSO SAAS</p>
            <h2>Situação de acesso do tenant</h2>
          </div>
          <span
            className={`badge ${
              detail.accessStatus === 'active'
                ? 'asset-status-active'
                : 'asset-status-inactive'
            }`}
          >
            {detail.accessStatusLabel}
          </span>
        </div>
        <p className="empty">
          {detail.accessStatus === 'active'
            ? 'Cliente com acesso operacional liberado.'
            : detail.accessStatus === 'grace_period'
              ? 'Cliente em tolerância, com acesso operacional liberado temporariamente.'
              : detail.accessStatus === 'payment_only'
                ? 'Cliente limitado às ações de pagamento.'
                : 'Cliente com acesso suspenso.'}
        </p>

        <div className="metrics">
          <Metric
            label="Usuários online"
            value={String(new Set(onlineAccesses.map((activity) => activity.userId)).size)}
            icon={<Users size={17} />}
          />
          <Metric
            label="Sessões ativas"
            value={String(onlineAccesses.length)}
            icon={<Activity size={17} />}
          />
        </div>

        <div className="panel-head" style={{ marginTop: 18 }}>
          <div>
            <p className="eyebrow">ATIVIDADE RECENTE</p>
            <h2>Acessos ao MARV</h2>
          </div>
        </div>
        {detail.recentAccessActivities.length === 0 ? (
          <p className="empty">Nenhuma atividade registrada nos últimos 30 dias.</p>
        ) : (
          <div className="table">
            {detail.recentAccessActivities.map((activity) => {
              const isOnline = isAccessOnline(activity.lastSeenAt);
              return (
                <div className="table-row" key={activity.id}>
                  <div>
                    <strong>{activity.fullName}</strong>
                    <small>{activity.deviceLabel} · {activity.accessOrigin}</small>
                  </div>
                  <span>{isOnline ? 'Online agora' : `Visto em ${formatAccessDateTime(activity.lastSeenAt)}`}</span>
                  <span className={`badge ${isOnline ? 'asset-status-active' : 'asset-status-inactive'}`}>
                    {isOnline ? 'Online' : 'Inativo'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <p className="empty">A atividade indica que o MARV permaneceu aberto no dispositivo. O sistema não coleta hostname físico, IP bruto ou token de sessão.</p>
      </article>

      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">CONTRATO VIGENTE</p>
            <h2>Contrato e condições</h2>
          </div>
          {subscription && (
            <span className="badge">{subscription.statusLabel}</span>
          )}
        </div>

        {!subscription ? (
          <p className="empty">Nenhum contrato vigente cadastrado.</p>
        ) : (
          <div className="table">
            <div className="table-row">
              <div>
                <strong>Plano contratado</strong>
                <small>{subscription.planName}</small>
              </div>
              <span>Situação: {subscription.statusLabel}</span>
              <span>Limite de robôs: {subscription.robotLimit}</span>
            </div>
            <div className="table-row">
              <div>
                <strong>Vigência e cobrança</strong>
                <small>
                  {formatDate(subscription.contractStartDate)} até{' '}
                  {formatDate(subscription.contractEndDate)}
                </small>
              </div>
              <span>Início de cobrança: {formatDate(subscription.billingStartDate)}</span>
              <span>
                Trial:{' '}
                {subscription.trialEndsAt
                  ? `até ${formatDate(subscription.trialEndsAt)}`
                  : 'não informado'}
              </span>
            </div>
            <div className="table-row">
              <div>
                <strong>Valor anual</strong>
                <small>Valor registrado no contrato vigente</small>
              </div>
              <span>{formatCurrency(subscription.annualPriceCents)}</span>
              <span />
            </div>
          </div>
        )}
      </article>

      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">ADMINISTRADORES DO CLIENTE</p>
            <h2>Acessos administrativos</h2>
          </div>
          <CommandCenterTenantUserProvisioning
            tenantId={detail.tenantId}
            tenantName={tenantName}
            onCreated={onTenantUserCreated}
          />
        </div>

        {detail.administrators.length === 0 ? (
          <p className="empty">Nenhum administrador cadastrado para este cliente.</p>
        ) : (
          <div className="table">
            {detail.administrators.map((administrator) => (
              <div className="table-row" key={administrator.id}>
                <div>
                  <strong>{administrator.fullName}</strong>
                  <small>{administrator.roleLabel}</small>
                </div>
                <span>{administrator.isActive ? 'Ativo' : 'Inativo'}</span>
              </div>
            ))}
          </div>
        )}
      </article>

      <div className="metrics">
        <Metric
          label="Unidades ativas"
          value={String(detail.activeUnitsCount)}
          icon={<Building2 size={17} />}
        />
        <Metric
          label="Centros de custo ativos"
          value={String(detail.activeCostCentersCount)}
          icon={<Building2 size={17} />}
        />
      </div>

      <TenantFranchisePanel
        itemsByCode={franchiseByTenant.get(detail.tenantId)?.itemsByCode}
        isLoading={isFranchiseLoading}
        error={franchiseError}
        fallbackEntitlements={detail.entitlements}
      />
    </>
  );
}

type ContractsTab = 'contracts' | 'plans';

type PlanFormState = {
  id: string | null;
  name: string;
  robotLimit: string;
  annualPrice: string;
  storageMb: string;
  description: string;
  isActive: boolean;
};

type ContractFormState = {
  tenantId: string;
  planId: string;
  status: string;
  contractStartDate: string;
  billingStartDate: string;
  contractEndDate: string;
  trialEndDate: string;
  paymentProvider: string;
  paymentCustomerReference: string;
  notes: string;
  replacementReason: string;
};

const emptyPlanForm: PlanFormState = {
  id: null,
  name: '',
  robotLimit: '',
  annualPrice: '',
  storageMb: '',
  description: '',
  isActive: true,
};

const emptyContractForm: ContractFormState = {
  tenantId: '',
  planId: '',
  status: 'draft',
  contractStartDate: '',
  billingStartDate: '',
  contractEndDate: '',
  trialEndDate: '',
  paymentProvider: '',
  paymentCustomerReference: '',
  notes: '',
  replacementReason: '',
};

const BYTES_PER_MB = 1024 * 1024;

function parseCurrencyToCents(value: string) {
  const normalized = value.trim().replace(/^R\$\s*/i, '');
  if (!normalized) return null;
  const cleaned = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

// Vigência mínima de 12 meses, com o mesmo tratamento de dia inexistente do banco.
function addTwelveMonths(dateString: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const next = new Date(Date.UTC(year + 1, month - 1, day));
  if (next.getUTCDate() !== day) {
    return new Date(Date.UTC(year + 1, month, 0)).toISOString().slice(0, 10);
  }
  return next.toISOString().slice(0, 10);
}

function ContractsAndLicensesModule({
  tenants,
  areTenantsLoading,
  onBack,
}: {
  tenants: CommandCenterTenant[];
  areTenantsLoading: boolean;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<ContractsTab>('contracts');
  const contractsData = useSubscriptionContracts();
  const plansData = useSubscriptionPlans();
  const [statusFilter, setStatusFilter] = useState('all');
  const [planSearch, setPlanSearch] = useState('');
  const [planForm, setPlanForm] = useState<PlanFormState | null>(null);
  const [contractForm, setContractForm] = useState<ContractFormState | null>(null);
  const [detailContractId, setDetailContractId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const clearFeedback = () => {
    setMessage('');
    setErrorMessage('');
  };

  const visibleContracts = useMemo(
    () =>
      contractsData.contracts.filter(
        (contract) => statusFilter === 'all' || contract.status === statusFilter,
      ),
    [contractsData.contracts, statusFilter],
  );

  const normalizedPlanSearch = planSearch.trim().toLowerCase();

  const visiblePlans = useMemo(
    () =>
      plansData.plans.filter(
        (plan) => !normalizedPlanSearch || plan.name.toLowerCase().includes(normalizedPlanSearch),
      ),
    [plansData.plans, normalizedPlanSearch],
  );

  const activePlans = plansData.plans.filter((plan) => plan.isActive);

  const selectedContractPlan = contractForm?.planId
    ? plansData.plans.find((plan) => plan.id === contractForm.planId) ?? null
    : null;

  const currentContractForTenant = useMemo(() => {
    if (!contractForm?.tenantId) return null;

    return (
      contractsData.contracts.find(
        (contract) =>
          contract.tenantId === contractForm.tenantId &&
          ['draft', 'trial', 'active'].includes(contract.status),
      ) ?? null
    );
  }, [contractForm?.tenantId, contractsData.contracts]);

  const detailContract = detailContractId
    ? contractsData.contracts.find((contract) => contract.id === detailContractId) ?? null
    : null;

  const planGrid = { gridTemplateColumns: '1.6fr .9fr 1fr 1.1fr .8fr' };
  const contractGrid = { gridTemplateColumns: '1.3fr 1.2fr .8fr 1.3fr .9fr .7fr' };

  const openNewPlan = () => {
    clearFeedback();
    setPlanForm({ ...emptyPlanForm });
  };

  const openPlan = (plan: SubscriptionPlanRecord) => {
    clearFeedback();
    setPlanForm({
      id: plan.id,
      name: plan.name,
      robotLimit: String(plan.robotLimit),
      annualPrice: (plan.annualPriceCents / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
      }),
      storageMb: String(Math.round(plan.includedStorageBytes / BYTES_PER_MB)),
      description: plan.description ?? '',
      isActive: plan.isActive,
    });
  };

  const closePlanForm = () => {
    clearFeedback();
    setPlanForm(null);
  };

  const savePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!planForm) return;

    const name = planForm.name.trim();
    const robotLimit = Number(planForm.robotLimit);
    const annualPriceCents = parseCurrencyToCents(planForm.annualPrice);
    const storageMb = Number(planForm.storageMb);

    if (!name) {
      setErrorMessage('Informe o nome do plano comercial.');
      return;
    }
    if (!Number.isInteger(robotLimit) || robotLimit < 0) {
      setErrorMessage('Informe um limite de robôs inteiro maior ou igual a zero.');
      return;
    }
    if (annualPriceCents === null) {
      setErrorMessage('Informe um valor anual válido em reais.');
      return;
    }
    if (!Number.isFinite(storageMb) || storageMb < 0) {
      setErrorMessage('Informe o armazenamento incluído em MB.');
      return;
    }

    setIsSaving(true);
    clearFeedback();
    try {
      await saveSubscriptionPlan({
        id: planForm.id,
        name,
        robotLimit,
        annualPriceCents,
        includedStorageBytes: Math.round(storageMb * BYTES_PER_MB),
        description: planForm.description,
        isActive: planForm.isActive,
      });
      await plansData.reload();
      setPlanForm(null);
      setMessage('Plano comercial salvo com sucesso.');
    } catch (saveError) {
      setErrorMessage(
        saveError instanceof Error ? saveError.message : 'Não foi possível salvar o plano comercial.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const togglePlanActive = async () => {
    if (!planForm?.id) return;

    const currentPlan = plansData.plans.find((plan) => plan.id === planForm.id);
    if (!currentPlan) {
      setErrorMessage('Plano comercial não encontrado. Atualize a lista e tente novamente.');
      return;
    }

    setIsSaving(true);
    clearFeedback();
    try {
      const nextActive = !planForm.isActive;
      await setSubscriptionPlanActive(currentPlan, nextActive);
      await plansData.reload();
      setPlanForm({ ...planForm, isActive: nextActive });
      setMessage(nextActive ? 'Plano ativado com sucesso.' : 'Plano desativado com sucesso.');
    } catch (saveError) {
      setErrorMessage(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível alterar a situação do plano.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openNewContract = () => {
    clearFeedback();
    setDetailContractId(null);
    setContractForm({ ...emptyContractForm });
  };

  const closeContractForm = () => {
    clearFeedback();
    setContractForm(null);
  };

  const openContractDetail = (contract: SubscriptionContractRecord) => {
    clearFeedback();
    setContractForm(null);
    setDetailContractId(contract.id);
  };

  const closeContractDetail = () => {
    clearFeedback();
    setDetailContractId(null);
  };

  const createContract = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contractForm) return;

    if (!contractForm.tenantId) {
      setErrorMessage('Selecione o cliente.');
      return;
    }
    if (!contractForm.planId) {
      setErrorMessage('Selecione o plano comercial.');
      return;
    }
    if (
      !contractForm.contractStartDate ||
      !contractForm.billingStartDate ||
      !contractForm.contractEndDate
    ) {
      setErrorMessage('Informe o início, o início de cobrança e o fim da vigência.');
      return;
    }
    if (contractForm.contractEndDate <= contractForm.contractStartDate) {
      setErrorMessage('A data final da vigência deve ser posterior à data de início.');
      return;
    }
    if (contractForm.billingStartDate < contractForm.contractStartDate) {
      setErrorMessage('A cobrança não pode começar antes do início do contrato.');
      return;
    }

    const minimumEndDate = addTwelveMonths(contractForm.contractStartDate);
    if (minimumEndDate && contractForm.contractEndDate < minimumEndDate) {
      setErrorMessage('A vigência mínima do contrato é de 12 meses.');
      return;
    }

    if (contractForm.status === 'trial') {
      if (!contractForm.trialEndDate) {
        setErrorMessage('Informe a data final da degustação.');
        return;
      }
      if (
        contractForm.trialEndDate < contractForm.contractStartDate ||
        contractForm.trialEndDate > contractForm.contractEndDate
      ) {
        setErrorMessage('A degustação deve terminar dentro da vigência do contrato.');
        return;
      }
    }

    const isReplacing = Boolean(currentContractForTenant);

    if (isReplacing && !contractForm.replacementReason.trim()) {
      setErrorMessage('Informe o motivo da substituição do contrato vigente.');
      return;
    }

    if (
      isReplacing &&
      !window.confirm('Confirmar a substituição do contrato vigente deste cliente?')
    ) {
      return;
    }

    setIsSaving(true);
    clearFeedback();
    try {
      const newContractId = await createSubscriptionContract({
        tenantId: contractForm.tenantId,
        planId: contractForm.planId,
        status: contractForm.status,
        contractStartDate: contractForm.contractStartDate,
        billingStartDate: contractForm.billingStartDate,
        contractEndDate: contractForm.contractEndDate,
        trialEndsAt: contractForm.trialEndDate
          ? new Date(`${contractForm.trialEndDate}T23:59:59Z`).toISOString()
          : null,
        paymentProvider: contractForm.paymentProvider,
        paymentCustomerReference: contractForm.paymentCustomerReference,
        notes: contractForm.notes,
        replacementReason: contractForm.replacementReason,
      });
      await contractsData.reload();
      setContractForm(null);
      setDetailContractId(newContractId);
      setMessage(
        isReplacing
          ? 'Contrato anterior encerrado, novo contrato criado e substituição registrada na auditoria.'
          : 'Contrato criado e registrado com sucesso.',
      );
    } catch (saveError) {
      setErrorMessage(
        saveError instanceof Error ? saveError.message : 'Não foi possível criar o contrato.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="content admin-panel">
      <div className="admin-module-header">
        <div>
          <p className="eyebrow">MARV COMMAND CENTER · CONTRATOS E LICENÇAS</p>
          <h2>Contratos e licenças</h2>
        </div>
        <div className="admin-module-header-actions">
          <button className="secondary" onClick={onBack}>
            <ArrowLeft size={17} />
            Voltar para Command Center
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="operation-toast operation-toast-error" role="alert">
          {errorMessage}
        </div>
      )}
      {message && (
        <div className="operation-toast" role="status">
          {message}
        </div>
      )}

      {!planForm && !contractForm && !detailContract && (
        <div className="user-admin-actions">
          <button
            className={tab === 'contracts' ? 'primary' : 'secondary'}
            onClick={() => {
              clearFeedback();
              setTab('contracts');
            }}
          >
            Contratos
          </button>
          <button
            className={tab === 'plans' ? 'primary' : 'secondary'}
            onClick={() => {
              clearFeedback();
              setTab('plans');
            }}
          >
            Planos comerciais
          </button>
        </div>
      )}

      {tab === 'plans' && !planForm && (
        <>
          <div className="user-admin-actions">
            <div className="asset-search">
              <input
                value={planSearch}
                onChange={(event) => setPlanSearch(event.target.value)}
                placeholder="Buscar plano por nome..."
              />
            </div>
          </div>

          <article className="panel table">
            <div className="panel-head">
              <div>
                <p className="eyebrow">CATÁLOGO COMERCIAL</p>
                <h2>Planos comerciais</h2>
              </div>
              <button className="primary" onClick={openNewPlan}>
                Novo plano
              </button>
            </div>

            {plansData.isLoading && <p className="empty">Carregando planos comerciais...</p>}
            {!plansData.isLoading && plansData.error && (
              <p className="data-error">{plansData.error}</p>
            )}
            {!plansData.isLoading && !plansData.error && visiblePlans.length === 0 && (
              <p className="empty">Nenhum plano comercial encontrado.</p>
            )}

            {visiblePlans.length > 0 && (
              <>
                <div className="table-head" style={planGrid}>
                  <span>Plano</span>
                  <span>Robôs incluídos</span>
                  <span>Valor anual</span>
                  <span>Armazenamento incluído</span>
                  <span>Situação</span>
                </div>

                {visiblePlans.map((plan) => (
                  <div
                    className={`table-row${plan.isActive ? '' : ' is-inactive'}`}
                    style={planGrid}
                    key={plan.id}
                  >
                    <div>
                      <button className="work-order-link" onClick={() => openPlan(plan)}>
                        {plan.name}
                      </button>
                      <small>{plan.description ?? 'Sem descrição'}</small>
                    </div>
                    <span>{plan.robotLimit.toLocaleString('pt-BR')}</span>
                    <span>{formatCurrency(plan.annualPriceCents)}</span>
                    <span>{formatStorage(plan.includedStorageBytes, false)}</span>
                    <span
                      className={`badge ${plan.isActive ? 'asset-status-active' : 'asset-status-inactive'}`}
                    >
                      {plan.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                ))}
              </>
            )}
          </article>
        </>
      )}

      {tab === 'plans' && planForm && (
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">{planForm.id ? 'DETALHE DO PLANO' : 'NOVO PLANO'}</p>
              <h2>{planForm.id ? planForm.name || 'Plano comercial' : 'Novo plano comercial'}</h2>
            </div>
          </div>

          <form className="new-user-form" onSubmit={(event) => void savePlan(event)}>
            <div className="form-grid">
              <label className="field">
                <span>Nome do plano *</span>
                <input
                  value={planForm.name}
                  onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })}
                  disabled={isSaving}
                />
              </label>

              <label className="field">
                <span>Limite de robôs incluídos *</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={planForm.robotLimit}
                  onChange={(event) => setPlanForm({ ...planForm, robotLimit: event.target.value })}
                  disabled={isSaving}
                />
              </label>

              <label className="field">
                <span>Valor anual (R$) *</span>
                <input
                  value={planForm.annualPrice}
                  onChange={(event) => setPlanForm({ ...planForm, annualPrice: event.target.value })}
                  placeholder="Ex.: 12.000,00"
                  disabled={isSaving}
                />
              </label>

              <label className="field">
                <span>Armazenamento incluído (MB) *</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={planForm.storageMb}
                  onChange={(event) => setPlanForm({ ...planForm, storageMb: event.target.value })}
                  disabled={isSaving}
                />
              </label>

              <label className="field">
                <span>Situação *</span>
                <select
                  value={planForm.isActive ? 'active' : 'inactive'}
                  onChange={(event) =>
                    setPlanForm({ ...planForm, isActive: event.target.value === 'active' })
                  }
                  disabled={isSaving}
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>Descrição (opcional)</span>
              <textarea
                rows={3}
                value={planForm.description}
                onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })}
                disabled={isSaving}
              />
            </label>

            <div className="form-actions">
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar alterações'}
              </button>
              {planForm.id && (
                <button
                  type="button"
                  className="secondary"
                  disabled={isSaving}
                  onClick={() => void togglePlanActive()}
                >
                  {planForm.isActive ? 'Desativar plano' : 'Ativar plano'}
                </button>
              )}
              <button
                type="button"
                className="secondary"
                disabled={isSaving}
                onClick={closePlanForm}
              >
                Voltar para planos
              </button>
            </div>
          </form>
        </article>
      )}

      {tab === 'contracts' && !contractForm && !detailContract && (
        <>
          <div className="user-admin-actions">
            <select
              className="status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Todas as situações</option>
              <option value="draft">Rascunho</option>
              <option value="trial">Degustação</option>
              <option value="active">Ativo</option>
              <option value="cancelled">Cancelado</option>
              <option value="expired">Expirado</option>
            </select>
          </div>

          <article className="panel table">
            <div className="panel-head">
              <div>
                <p className="eyebrow">CONTRATOS POR CLIENTE</p>
                <h2>Contratos e licenças</h2>
              </div>
              <button className="primary" onClick={openNewContract}>
                Novo contrato
              </button>
            </div>

            {contractsData.isLoading && <p className="empty">Carregando contratos...</p>}
            {!contractsData.isLoading && contractsData.error && (
              <p className="data-error">{contractsData.error}</p>
            )}
            {!contractsData.isLoading && !contractsData.error && visibleContracts.length === 0 && (
              <p className="empty">Nenhum contrato encontrado para o filtro atual.</p>
            )}

            {visibleContracts.length > 0 && (
              <>
                <div className="table-head" style={contractGrid}>
                  <span>Cliente</span>
                  <span>Plano</span>
                  <span>Situação</span>
                  <span>Vigência</span>
                  <span>Valor anual</span>
                  <span>Robôs</span>
                </div>

                {visibleContracts.map((contract) => (
                  <div
                    className={`table-row${
                      ['cancelled', 'expired'].includes(contract.status) ? ' is-inactive' : ''
                    }`}
                    style={contractGrid}
                    key={contract.id}
                  >
                    <div>
                      <button
                        className="work-order-link"
                        onClick={() => openContractDetail(contract)}
                      >
                        {contract.tenantName}
                      </button>
                      <small>
                        {subscriptionStatusLabel(contract.status)} ·{' '}
                        {formatDate(contract.contractStartDate)} até{' '}
                        {formatDate(contract.contractEndDate)}
                      </small>
                    </div>
                    <span>{contract.planName}</span>
                    <span
                      className={`badge ${
                        contract.status === 'active'
                          ? 'asset-status-active'
                          : ['cancelled', 'expired'].includes(contract.status)
                            ? 'asset-status-inactive'
                            : ''
                      }`}
                    >
                      {subscriptionStatusLabel(contract.status)}
                    </span>
                    <span>
                      {formatDate(contract.contractStartDate)} até{' '}
                      {formatDate(contract.contractEndDate)}
                    </span>
                    <span>{formatCurrency(contract.annualPriceCentsSnapshot)}</span>
                    <span>{contract.robotLimitSnapshot.toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </>
            )}
          </article>
        </>
      )}

      {tab === 'contracts' && contractForm && (
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">NOVO CONTRATO</p>
              <h2>Contrato por cliente</h2>
            </div>
          </div>

          {currentContractForTenant && (
            <div className="insight" style={{ marginBottom: 14 }}>
              <AlertTriangle size={18} />
              <p>
                Este cliente já possui um contrato {subscriptionStatusLabel(currentContractForTenant.status).toLowerCase()} ({currentContractForTenant.planName}). Ao salvar, o contrato atual será encerrado como Cancelado e o novo será criado e auditado.
              </p>
            </div>
          )}

          <form className="new-user-form" onSubmit={(event) => void createContract(event)}>
            <div className="form-grid">
              <label className="field">
                <span>Cliente *</span>
                <select
                  value={contractForm.tenantId}
                  onChange={(event) => setContractForm({ ...contractForm, tenantId: event.target.value })}
                  disabled={isSaving}
                >
                  <option value="">
                    {areTenantsLoading ? 'Carregando clientes...' : 'Selecione o cliente'}
                  </option>
                  {tenants.map((tenant) => (
                    <option key={tenant.tenantId} value={tenant.tenantId}>
                      {tenant.tradeName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Plano comercial ativo *</span>
                <select
                  value={contractForm.planId}
                  onChange={(event) => setContractForm({ ...contractForm, planId: event.target.value })}
                  disabled={isSaving}
                >
                  <option value="">
                    {plansData.isLoading ? 'Carregando planos...' : 'Selecione o plano'}
                  </option>
                  {activePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Situação do contrato *</span>
                <select
                  value={contractForm.status}
                  onChange={(event) => setContractForm({ ...contractForm, status: event.target.value })}
                  disabled={isSaving}
                >
                  <option value="draft">Rascunho</option>
                  <option value="trial">Degustação</option>
                  <option value="active">Ativo</option>
                </select>
              </label>
            </div>

            {selectedContractPlan && (
              <div className="command-center-client-summary" style={{ marginBottom: 14 }}>
                <p>
                  <span>Condições que serão copiadas</span>
                  <strong>{selectedContractPlan.name}</strong>
                </p>
                <p>
                  <span>Robôs incluídos</span>
                  <strong>{selectedContractPlan.robotLimit.toLocaleString('pt-BR')}</strong>
                </p>
                <p>
                  <span>Valor anual</span>
                  <strong>{formatCurrency(selectedContractPlan.annualPriceCents)}</strong>
                </p>
                <p>
                  <span>Armazenamento incluído</span>
                  <strong>{formatStorage(selectedContractPlan.includedStorageBytes, false)}</strong>
                </p>
              </div>
            )}

            <div className="form-grid">
              <label className="field">
                <span>Início do contrato *</span>
                <input
                  type="date"
                  value={contractForm.contractStartDate}
                  onChange={(event) => {
                    const nextStartDate = event.target.value;
                    const suggestedEndDate = addTwelveMonths(nextStartDate) ?? '';
                    const previousSuggestion = addTwelveMonths(contractForm.contractStartDate);
                    const shouldUpdateEndDate =
                      !contractForm.contractEndDate ||
                      contractForm.contractEndDate === previousSuggestion;

                    setContractForm({
                      ...contractForm,
                      contractStartDate: nextStartDate,
                      contractEndDate: shouldUpdateEndDate
                        ? suggestedEndDate
                        : contractForm.contractEndDate,
                    });
                  }}
                  disabled={isSaving}
                />
              </label>

              <label className="field">
                <span>Início da cobrança *</span>
                <input
                  type="date"
                  value={contractForm.billingStartDate}
                  onChange={(event) =>
                    setContractForm({ ...contractForm, billingStartDate: event.target.value })
                  }
                  disabled={isSaving}
                />
              </label>

              <label className="field">
                <span>Fim da vigência * (mínimo 12 meses)</span>
                <input
                  type="date"
                  value={contractForm.contractEndDate}
                  onChange={(event) =>
                    setContractForm({ ...contractForm, contractEndDate: event.target.value })
                  }
                  disabled={isSaving}
                />
              </label>

              {contractForm.status === 'trial' && (
                <label className="field">
                  <span>Data final da degustação *</span>
                  <input
                    type="date"
                    value={contractForm.trialEndDate}
                    onChange={(event) =>
                      setContractForm({ ...contractForm, trialEndDate: event.target.value })
                    }
                    disabled={isSaving}
                  />
                </label>
              )}
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Provedor de pagamento (opcional)</span>
                <input
                  value={contractForm.paymentProvider}
                  onChange={(event) =>
                    setContractForm({ ...contractForm, paymentProvider: event.target.value })
                  }
                  disabled={isSaving}
                  placeholder="Ex.: Stripe, Mercado Pago"
                />
              </label>

              <label className="field">
                <span>Referência no provedor (opcional)</span>
                <input
                  value={contractForm.paymentCustomerReference}
                  onChange={(event) =>
                    setContractForm({
                      ...contractForm,
                      paymentCustomerReference: event.target.value,
                    })
                  }
                  disabled={isSaving}
                />
              </label>
            </div>

            <label className="field">
              <span>Observações (opcional)</span>
              <textarea
                rows={3}
                value={contractForm.notes}
                onChange={(event) => setContractForm({ ...contractForm, notes: event.target.value })}
                disabled={isSaving}
              />
            </label>

            {currentContractForTenant && (
              <label className="field">
                <span>Motivo da substituição *</span>
                <textarea
                  rows={3}
                  value={contractForm.replacementReason}
                  onChange={(event) =>
                    setContractForm({ ...contractForm, replacementReason: event.target.value })
                  }
                  disabled={isSaving}
                  placeholder="Explique por que o contrato vigente será substituído."
                />
              </label>
            )}

            <div className="form-actions">
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Criar contrato'}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={isSaving}
                onClick={closeContractForm}
              >
                Voltar para contratos
              </button>
            </div>
          </form>
        </article>
      )}

      {tab === 'contracts' && !contractForm && detailContract && (
        <>
          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">DETALHE DO CONTRATO</p>
                <h2>{detailContract.tenantName}</h2>
              </div>
              <span
                className={`badge ${
                  detailContract.status === 'active'
                    ? 'asset-status-active'
                    : ['cancelled', 'expired'].includes(detailContract.status)
                      ? 'asset-status-inactive'
                      : ''
                }`}
              >
                {subscriptionStatusLabel(detailContract.status)}
              </span>
            </div>

            <div className="table">
              <div className="table-row">
                <div>
                  <strong>{detailContract.planName}</strong>
                  <small>Plano contratado (snapshot na criação)</small>
                </div>
                <span>
                  {formatDate(detailContract.contractStartDate)} até{' '}
                  {formatDate(detailContract.contractEndDate)}
                </span>
                <span>Início de cobrança: {formatDate(detailContract.billingStartDate)}</span>
              </div>

              <div className="table-row">
                <div>
                  <strong>Robôs, valor e armazenamento</strong>
                  <small>Condições congeladas no contrato</small>
                </div>
                <span>Robôs: {detailContract.robotLimitSnapshot.toLocaleString('pt-BR')}</span>
                <span>{formatCurrency(detailContract.annualPriceCentsSnapshot)}</span>
                <span>{formatStorage(detailContract.includedStorageBytesSnapshot, false)}</span>
              </div>

              <div className="table-row">
                <div>
                  <strong>Degustação</strong>
                  <small>Período de trial, quando concedido</small>
                </div>
                <span>
                  {detailContract.trialEndsAt
                    ? `Até ${formatDate(detailContract.trialEndsAt)}`
                    : 'Sem degustação'}
                </span>
                <span>Provedor: {detailContract.paymentProvider || 'Não informado'}</span>
              </div>

              {detailContract.paymentCustomerReference && (
                <div className="table-row">
                  <div>
                    <strong>Referência no provedor</strong>
                    <small>Somente referência: nenhum dado de cartão é armazenado</small>
                  </div>
                  <span>{detailContract.paymentCustomerReference}</span>
                </div>
              )}

              {detailContract.notes && (
                <div className="table-row">
                  <div>
                    <strong>Observações</strong>
                    <small>Condições comerciais registradas</small>
                  </div>
                  <span>{detailContract.notes}</span>
                </div>
              )}
            </div>
          </article>

          <div className="form-actions">
            <button type="button" className="secondary" onClick={closeContractDetail}>
              Voltar para contratos
            </button>
          </div>

          <p className="empty">
            As condições deste contrato estão congeladas nos snapshots. Para mudar plano, valores ou
            limites, crie um novo contrato pelo Command Center.
          </p>
        </>
      )}
    </section>
  );
}

export function CommandCenter({ isNetsecbrAdmin, currentUserId }: { isNetsecbrAdmin: boolean; currentUserId: string }) {
  const [search, setSearch] = useState('');
  const [situationFilter, setSituationFilter] = useState<SituationFilter>('all');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [view, setView] = useState<CommandCenterView>('home');
  const [isEditingTenant, setIsEditingTenant] = useState(false);
  const [isSavingTenant, setIsSavingTenant] = useState(false);
  const [tenantEditMessage, setTenantEditMessage] = useState('');
  const [tenantEditError, setTenantEditError] = useState('');
  const [tenantForm, setTenantForm] = useState<TenantEditForm | null>(null);
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  const [clientDetailTab, setClientDetailTab] = useState<ClientDetailTabId>('overview');
  const [currentUserName, setCurrentUserName] = useState('');
  const { tenants, totals, isLoading, error, reload } = useCommandCenterData();
  const {
    items: consumptionItems,
    isLoading: isConsumptionLoading,
    error: consumptionError,
    reload: reloadConsumption,
  } = useCommandCenterConsumption();
  const franchiseByTenant = useMemo(() => summarizeFranchiseByTenant(consumptionItems), [consumptionItems]);
  const hasFranchiseData = !consumptionError && consumptionItems.length > 0;
  const isFranchiseFilter = situationFilter.startsWith('franchise_');
  const {
    detail: tenantDetail,
    isLoading: isTenantDetailLoading,
    error: tenantDetailError,
    reload: reloadTenantDetail,
  } = useCommandCenterTenantDetail(selectedTenantId);

  /* Último acesso por usuário disponível no detalhe do tenant (janela de 30 dias). */
  const lastAccessByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const activity of tenantDetail?.recentAccessActivities ?? []) {
      if (!map.has(activity.userId)) map.set(activity.userId, activity.lastSeenAt);
    }
    return map;
  }, [tenantDetail]);

  const openView = (nextView: CommandCenterView, nextFilter: SituationFilter = 'all') => {
    setSelectedTenantId(null);
    setIsCreatingTenant(false);
    setIsEditingTenant(false);
    setTenantEditMessage('');
    setTenantEditError('');
    setSituationFilter(nextFilter);
    setView(nextView);
  };

  const goHome = () => {
    setSelectedTenantId(null);
    setIsCreatingTenant(false);
    setIsEditingTenant(false);
    setTenantEditMessage('');
    setTenantEditError('');
    setSituationFilter('all');
    setView('home');
  };

  const moduleMeta =
    view === 'health'
      ? { eyebrow: 'MARV COMMAND CENTER · SAÚDE DA CARTEIRA', title: 'Saúde da carteira' }
      : { eyebrow: 'MARV COMMAND CENTER · CLIENTES', title: 'Clientes' };

  useEffect(() => {
    if (isNetsecbrAdmin) {
      void reload();
    }
  }, [isNetsecbrAdmin, reload]);

  /* A faixa do dossiê sempre volta para "Visão geral" quando o cliente muda. */
  useEffect(() => {
    setClientDetailTab('overview');
  }, [selectedTenantId]);

  /* Nome do administrador NETSECBR para a linha de sessão do módulo de usuários. */
  useEffect(() => {
    if (!currentUserId) return;

    let isCancelled = false;
    void supabase
      .from('profiles')
      .select('full_name')
      .eq('id', currentUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (!isCancelled) setCurrentUserName(data?.full_name ?? '');
      });

    return () => {
      isCancelled = true;
    };
  }, [currentUserId]);

  const normalizedSearch = search.trim().toLowerCase();

  const visibleTenants = useMemo(
    () => tenants.filter((tenant) => {
      if (!matchesSearch(tenant, normalizedSearch)) return false;
      if (situationFilter === 'active') return tenant.isActive;
      if (situationFilter === 'inactive') return !tenant.isActive;

      const franchiseFilter = franchiseFilterBySituation[situationFilter];
      if (franchiseFilter) {
        return matchesFranchiseFilter(franchiseByTenant.get(tenant.tenantId), franchiseFilter);
      }

      return true;
    }),
    [tenants, normalizedSearch, situationFilter, franchiseByTenant],
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

  if (view === 'home') {
    return (
      <section className="content admin-panel">
        <div className="admin-module-header">
          <div>
            <p className="eyebrow">ADMINISTRAÇÃO SAAS</p>
            <h2>MARV Command Center</h2>
          </div>
        </div>

        <p style={{ margin: '0 0 18px', color: '#6680a8', fontSize: 13 }}>
          Gerencie clientes, contratos, cobrança, suporte e segurança da plataforma.
        </p>

        <div className="admin-module-grid">
          <button className="admin-module-card" onClick={() => openView('clients')}>
            <div className="metric-icon">
              <Users />
            </div>
            <p>OPERAÇÃO</p>
            <h2>Clientes</h2>
            <small>Abrir módulo →</small>
          </button>

          <button className="admin-module-card" onClick={() => openView('contracts')}>
            <div className="metric-icon">
              <FileText />
            </div>
            <p>COMERCIAL</p>
            <h2>Contratos e licenças</h2>
            <small>Abrir módulo →</small>
          </button>

          <button className="admin-module-card" onClick={() => openView('platform_team')}>
            <div className="metric-icon"><Users /></div>
            <p>GOVERNANÇA</p>
            <h2>Equipe da plataforma</h2>
            <small>Abrir módulo →</small>
          </button>

          <button className="admin-module-card" onClick={() => openView('support')}>
            <div className="metric-icon">
              <LifeBuoy />
            </div>
            <p>SUPORTE</p>
            <h2>Atendimento e exceções</h2>
            <small>Abrir módulo →</small>
          </button>

          {plannedModules.map((module) => (
            <article
              className="admin-module-card"
              key={module.title}
              style={{ cursor: 'default' }}
            >
              <div className="metric-icon">{module.icon}</div>
              <p>{module.eyebrow}</p>
              <h2>{module.title}</h2>
              <small style={{ color: '#8798ae' }}>Módulo em construção</small>
            </article>
          ))}

          <button className="admin-module-card" onClick={() => openView('health')}>
            <div className="metric-icon">
              <Activity />
            </div>
            <p>ANÁLISE</p>
            <h2>Saúde da carteira</h2>
            <small>Abrir módulo →</small>
          </button>
        </div>
      </section>
    );
  }

  if (view === 'contracts') {
    return <ContractsAndLicensesModule tenants={tenants} areTenantsLoading={isLoading} onBack={goHome} />;
  }

  if (view === 'platform_team') {
    return <PlatformTeamAdmin currentUserId={currentUserId} onBack={goHome} />;
  }

  if (view === 'support') {
    return <CommandCenterSupportAdmin tenants={tenants} onBack={goHome} />;
  }

  if (isLoading && tenants.length === 0) {
    return (
      <section className="content admin-panel">
        <div className="admin-module-header">
          <div>
            <p className="eyebrow">{moduleMeta.eyebrow}</p>
            <h2>{moduleMeta.title}</h2>
          </div>
          <div className="admin-module-header-actions">
            <button className="secondary" onClick={goHome}>
              <ArrowLeft size={17} />
              Voltar para Command Center
            </button>
          </div>
        </div>
        <article className="panel">
          <p className="empty">Carregando visão global…</p>
        </article>
      </section>
    );
  }

  const selectedTenant = tenants.find((tenant) => tenant.tenantId === selectedTenantId) ?? null;

  const openTenantEditor = () => {
    if (!selectedTenant) return;
    setTenantEditError('');
    setTenantEditMessage('');
    setTenantForm({
      legalName: selectedTenant.legalName,
      tradeName: selectedTenant.tradeName,
      documentNumber: formatCnpj(selectedTenant.documentNumber),
      status: selectedTenant.status,
      reason: '',
    });
    setIsEditingTenant(true);
  };

  const closeTenantEditor = () => {
    setIsEditingTenant(false);
    setTenantForm(null);
    setTenantEditError('');
  };

  const saveTenant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTenant || !tenantForm) return;

    const statusChanged = tenantForm.status !== selectedTenant.status;
    const restrictsAccess = tenantForm.status === 'payment_only' || tenantForm.status === 'suspended';

    if (!tenantForm.legalName.trim() || !tenantForm.tradeName.trim()) {
      setTenantEditError('Informe a razão social e o nome comercial do cliente.');
      return;
    }
    if (tenantForm.documentNumber.trim() && !isValidCnpj(tenantForm.documentNumber)) {
      setTenantEditError('Informe um CNPJ válido ou deixe o campo em branco.');
      return;
    }
    if (statusChanged && restrictsAccess && !tenantForm.reason.trim()) {
      setTenantEditError('Informe o motivo para restringir o acesso do cliente.');
      return;
    }
    if (statusChanged && !window.confirm('Confirmar a alteração da situação de acesso deste cliente?')) return;

    setIsSavingTenant(true);
    setTenantEditError('');
    setTenantEditMessage('');
    try {
      await updateCommandCenterTenant({
        tenantId: selectedTenant.tenantId,
        legalName: tenantForm.legalName,
        tradeName: tenantForm.tradeName,
        documentNumber: tenantForm.documentNumber,
        status: tenantForm.status,
        reason: tenantForm.reason,
      });
      await Promise.all([reload(), reloadTenantDetail()]);
      setTenantEditMessage('Dados do cliente salvos e registrados na auditoria.');
      setIsEditingTenant(false);
      setTenantForm(null);
    } catch (saveError) {
      setTenantEditError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o cliente.');
    } finally {
      setIsSavingTenant(false);
    }
  };

  const openNewClientForm = () => {
    setTenantEditMessage('');
    setTenantEditError('');
    setIsCreatingTenant(true);
  };

  const closeNewClientForm = () => {
    setTenantEditError('');
    setIsCreatingTenant(false);
  };

  const handleClientCreated = async (tenantId: string) => {
    await reload();
    setIsCreatingTenant(false);
    setSelectedTenantId(tenantId);
    setTenantEditMessage(
      'Cliente criado com sucesso. Contato principal e domínios autorizados registrados.',
    );
  };

  if (isCreatingTenant) {
    return (
      <section className="content admin-panel">
        <div className="admin-module-header">
          <div>
            <p className="eyebrow">MARV COMMAND CENTER · NOVO CLIENTE</p>
            <h2>Novo cliente</h2>
          </div>
          <div className="admin-module-header-actions">
            <button className="secondary" onClick={closeNewClientForm}>
              <ArrowLeft size={17} />
              Voltar para clientes
            </button>
          </div>
        </div>

        <CommandCenterClientForm
          onCancel={closeNewClientForm}
          onCreated={handleClientCreated}
        />
      </section>
    );
  }

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
              Voltar para clientes
            </button>
          </div>
        </div>

        {error && <p className="data-error">{error}</p>}
        {tenantDetailError && <p className="data-error">{tenantDetailError}</p>}
        {tenantEditError && <div className="operation-toast operation-toast-error" role="alert">{tenantEditError}</div>}
        {tenantEditMessage && <div className="operation-toast" role="status">{tenantEditMessage}</div>}

        <div className="quick" role="tablist" aria-label="Seções do dossiê do cliente">
          {clientDetailTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={clientDetailTab === tab.id}
              className={clientDetailTab === tab.id ? 'primary' : 'secondary'}
              onClick={() => setClientDetailTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {clientDetailTab === 'overview' && (
          <>
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

              {!isEditingTenant && (
                <div className="form-actions">
                  <button type="button" className="secondary" onClick={openTenantEditor}>
                    Editar dados e acesso
                  </button>
                </div>
              )}

              {isEditingTenant && tenantForm ? (
                <form className="new-user-form" onSubmit={(event) => void saveTenant(event)}>
                  <div className="form-grid">
                    <label className="field">
                      <span>Razão social *</span>
                      <input value={tenantForm.legalName} onChange={(event) => setTenantForm({ ...tenantForm, legalName: event.target.value })} disabled={isSavingTenant} />
                    </label>
                    <label className="field">
                      <span>Nome comercial *</span>
                      <input value={tenantForm.tradeName} onChange={(event) => setTenantForm({ ...tenantForm, tradeName: event.target.value })} disabled={isSavingTenant} />
                    </label>
                    <label className="field">
                      <span>CNPJ</span>
                      <input value={tenantForm.documentNumber} onChange={(event) => setTenantForm({ ...tenantForm, documentNumber: formatCnpj(event.target.value) })} disabled={isSavingTenant} />
                    </label>
                    <label className="field">
                      <span>Situação de acesso *</span>
                      <select value={tenantForm.status} onChange={(event) => setTenantForm({ ...tenantForm, status: event.target.value })} disabled={isSavingTenant}>
                        <option value="active">Ativo</option>
                        <option value="grace_period">Tolerância</option>
                        <option value="payment_only">Somente pagamento</option>
                        <option value="suspended">Suspenso</option>
                      </select>
                    </label>
                  </div>

                  {tenantForm.status !== selectedTenant.status && (
                    <label className="field">
                      <span>Motivo da alteração {tenantForm.status === 'payment_only' || tenantForm.status === 'suspended' ? '*' : '(opcional)'}</span>
                      <textarea value={tenantForm.reason} onChange={(event) => setTenantForm({ ...tenantForm, reason: event.target.value })} disabled={isSavingTenant} placeholder="Registre o motivo para a cadeia de auditoria." />
                    </label>
                  )}

                  <div className="form-actions">
                    <button type="submit" disabled={isSavingTenant}>{isSavingTenant ? 'Salvando...' : 'Salvar alterações'}</button>
                    <button type="button" className="secondary" disabled={isSavingTenant} onClick={closeTenantEditor}>Cancelar</button>
                  </div>
                </form>
              ) : (
                <div className="command-center-client-summary">
                  <p><span>CNPJ</span><strong>{selectedTenant.documentNumber || 'Não informado'}</strong></p>
                  <p><span>Criado em</span><strong>{formatDate(selectedTenant.createdAt)}</strong></p>
                </div>
              )}
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

            {isTenantDetailLoading && (
              <article className="panel">
                <p className="empty">Carregando dados SaaS do cliente…</p>
              </article>
            )}

            {!isTenantDetailLoading && tenantDetail && (
              <TenantSaaSDetail
                detail={tenantDetail}
                franchiseByTenant={franchiseByTenant}
                isFranchiseLoading={isConsumptionLoading}
                franchiseError={consumptionError}
                tenantName={selectedTenant.tradeName}
                onTenantUserCreated={async () => {
                  await Promise.all([reload(), reloadTenantDetail()]);
                }}
              />
            )}

            <article className="panel">
              <div className="insight">
                <AlertTriangle size={18} />
                <p>
                  Esta é uma visão global da NETSECBR. Alterações operacionais do cliente são
                  realizadas dentro do ambiente do próprio cliente.
                </p>
              </div>
            </article>
          </>
        )}

        {clientDetailTab === 'users' && (
          <>
            <article className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">USUÁRIOS E ACESSOS</p>
                  <h2>Administração de acessos</h2>
                </div>
              </div>
              <p className="empty" style={{ marginTop: 0 }}>
                Administre os usuários de {selectedTenant.tradeName}: novo usuário, perfil, situação,
                senha temporária e permissões. O domínio do e-mail precisa estar autorizado para
                este cliente.
              </p>
            </article>

            <UserAdmin
              tenantId={selectedTenant.tenantId}
              currentUserId={currentUserId}
              currentName={currentUserName || 'Administrador NETSECBR'}
              currentRole="netsecbr_admin"
              lastAccessByUserId={lastAccessByUserId}
            />
          </>
        )}

        {clientDetailTab === 'contract' && (
          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">CONTRATO E LICENÇA</p>
                <h2>Contrato e licença</h2>
              </div>
            </div>
            <div className="insight">
              <FileText size={18} />
              <p>Esta área será integrada ao dossiê do cliente na próxima etapa.</p>
            </div>
          </article>
        )}

        {clientDetailTab === 'operation' && (
          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">OPERAÇÃO</p>
                <h2>Operação</h2>
              </div>
            </div>
            <div className="insight">
              <Activity size={18} />
              <p>Esta área será integrada ao dossiê do cliente na próxima etapa.</p>
            </div>
          </article>
        )}

        {clientDetailTab === 'audit' && (
          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">AUDITORIA</p>
                <h2>Auditoria</h2>
              </div>
            </div>
            <div className="insight">
              <ClipboardList size={18} />
              <p>Esta área será integrada ao dossiê do cliente na próxima etapa.</p>
            </div>
          </article>
        )}
      </section>
    );
  }

  return (
    <section className="content admin-panel">
      <div className="admin-module-header">
        <div>
          <p className="eyebrow">{moduleMeta.eyebrow}</p>
          <h2>{moduleMeta.title}</h2>
        </div>
        <div className="admin-module-header-actions">
          <button className="secondary" onClick={goHome}>
            <ArrowLeft size={17} />
            Voltar para Command Center
          </button>
        </div>
      </div>

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
          <optgroup label="Franquia e consumo">
            <option value="franchise_attention">Franquia em atenção</option>
            <option value="franchise_ok">Franquia dentro do limite</option>
            <option value="franchise_unconfigured">Franquia não configurada</option>
          </optgroup>
        </select>

        <button
          className="secondary button-with-icon"
          onClick={() => { void reload(); void reloadConsumption(); }}
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

      {consumptionError && (
        <div className="operation-toast operation-toast-error" role="alert">
          <span>{consumptionError}</span>
        </div>
      )}

      {view === 'health' && (
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
      )}

      <article className="panel table">
        <div className="panel-head">
          <div>
            <p className="eyebrow">CLIENTES MARV</p>
            <h2>Clientes</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {view === 'clients' && (
              <button type="button" className="primary" onClick={openNewClientForm}>
                Novo cliente
              </button>
            )}
            <span className="badge">
              {visibleTenants.length} de {tenants.length}
            </span>
          </div>
        </div>

        {isLoading && <p className="empty">Atualizando dados...</p>}

        {!isLoading && tenants.length === 0 && (
          <p className="empty">Nenhum cliente cadastrado na plataforma até agora.</p>
        )}

        {!isLoading && tenants.length > 0 && visibleTenants.length === 0 && (
          <p className="empty">
            {isFranchiseFilter && hasFranchiseData
              ? 'Nenhum cliente com a situação de franquia selecionada.'
              : 'Nenhum cliente encontrado com a busca e o filtro atuais.'}
          </p>
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
              <span>Robôs (franquia)</span>
              <span>Franquia</span>
            </div>

            {visibleTenants.map((tenant) => {
              const franchise = franchiseByTenant.get(tenant.tenantId);
              const franchiseBadge = franchise ? getFranchiseBadge(franchise) : null;

              return (
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
                  <span title={franchise ? 'Robôs cadastrados x franquia contratada' : 'Franquias indisponíveis'}>
                    {formatConsumptionSummary(franchise?.itemsByCode.get('robots.registered'))}
                  </span>
                  {franchiseBadge ? (
                    <span className={`badge ${franchiseBadge.className}`}>{franchiseBadge.label}</span>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              );
            })}
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

