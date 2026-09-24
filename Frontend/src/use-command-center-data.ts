import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

export type CommandCenterTenant = {
  tenantId: string;
  legalName: string;
  tradeName: string;
  documentNumber: string;
  status: string;
  statusLabel: string;
  isActive: boolean;
  createdAt: string;
  activeUsers: number;
  assetCount: number;
  openWorkOrders: number;
  overduePreventivePlans: number;
};

export type CommandCenterTotals = {
  activeTenants: number;
  inactiveTenants: number;
  activeUsers: number;
  assetCount: number;
  openWorkOrders: number;
  overduePreventivePlans: number;
};

export type CommandCenterSubscription = {
  id: string;
  planName: string;
  status: string;
  statusLabel: string;
  contractStartDate: string;
  contractEndDate: string;
  billingStartDate: string;
  trialEndsAt: string | null;
  robotLimit: number;
  annualPriceCents: number;
};

export type CommandCenterAdministrator = {
  id: string;
  fullName: string;
  role: string;
  roleLabel: string;
  isActive: boolean;
};

export type CommandCenterEntitlement = {
  code: string;
  name: string;
  limitValue: number | null;
  isUnlimited: boolean;
  isConfigured: boolean;
  unit: 'count' | 'bytes' | 'boolean' | null;
};

export type CommandCenterTenantDetail = {
  tenantId: string;
  accessStatus: string;
  accessStatusLabel: string;
  subscription: CommandCenterSubscription | null;
  administrators: CommandCenterAdministrator[];
  activeUnitsCount: number;
  activeCostCentersCount: number;
  entitlements: CommandCenterEntitlement[];
};

export type CommandCenterTenantUpdateInput = {
  tenantId: string;
  legalName: string;
  tradeName: string;
  documentNumber: string;
  status: string;
  reason: string;
};

const tenantStatusLabels: Record<string, string> = {
  active: 'Ativo',
  grace_period: 'Período de graça',
  payment_only: 'Somente pagamento',
  suspended: 'Suspenso',
};

const accessStatusLabels: Record<string, string> = {
  active: 'Ativo',
  grace_period: 'Tolerância',
  payment_only: 'Somente pagamento',
  suspended: 'Suspenso',
};

const subscriptionStatusLabels: Record<string, string> = {
  draft: 'Rascunho',
  trial: 'Degustação',
  active: 'Ativo',
  cancelled: 'Cancelado',
  expired: 'Expirado',
};

const membershipRoleLabels: Record<string, string> = {
  tenant_admin: 'Administrador do cliente',
};

const requiredEntitlementCodes = [
  'robots.registered',
  'users.active',
  'units.active',
  'work_orders.monthly',
  'storage.bytes',
];

const emptyTotals: CommandCenterTotals = {
  activeTenants: 0,
  inactiveTenants: 0,
  activeUsers: 0,
  assetCount: 0,
  openWorkOrders: 0,
  overduePreventivePlans: 0,
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Leitura global via RPC segura: a função valida o perfil netsecbr_admin
// no banco antes de devolver qualquer dado de cliente.
export function useCommandCenterData() {
  const [tenants, setTenants] = useState<CommandCenterTenant[]>([]);
  const [totals, setTotals] = useState<CommandCenterTotals>(emptyTotals);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Recargas seguintes (botão "Atualizar dados") mantêm os dados atuais visíveis
  // até os novos chegarem. Sem polling e sem Realtime.
  const hasInitialLoadCompleted = useRef(false);

  const reload = useCallback(async () => {
    setError('');

    if (!hasInitialLoadCompleted.current) {
      setIsLoading(true);
    }

    const { data, error: rpcError } = await supabase.rpc('get_command_center_overview');

    if (rpcError) {
      const denied = rpcError.message.includes('Acesso negado');
      setError(
        denied
          ? 'Acesso negado ao Command Center. Fale com o administrador NETSECBR.'
          : 'Não foi possível carregar os dados do Command Center agora. Tente novamente.',
      );
      hasInitialLoadCompleted.current = true;
      setIsLoading(false);
      return;
    }

    const rows = (data ?? []) as any[];

    setTenants(rows.map((row) => ({
      tenantId: row.tenant_id,
      legalName: row.legal_name ?? 'Cliente sem razão social',
      tradeName: row.trade_name ?? row.legal_name ?? 'Cliente sem nome',
      documentNumber: row.document_number ?? '',
      status: row.tenant_status,
      statusLabel: tenantStatusLabels[row.tenant_status] ?? row.tenant_status,
      isActive: row.tenant_status === 'active',
      createdAt: row.tenant_created_at,
      activeUsers: toNumber(row.active_users),
      assetCount: toNumber(row.asset_count),
      openWorkOrders: toNumber(row.open_work_orders),
      overduePreventivePlans: toNumber(row.overdue_preventive_plans),
    })));

    setTotals(rows.reduce<CommandCenterTotals>((acc, row) => {
      const isActive = row.tenant_status === 'active';

      return {
        activeTenants: acc.activeTenants + (isActive ? 1 : 0),
        inactiveTenants: acc.inactiveTenants + (isActive ? 0 : 1),
        activeUsers: acc.activeUsers + toNumber(row.active_users),
        assetCount: acc.assetCount + toNumber(row.asset_count),
        openWorkOrders: acc.openWorkOrders + toNumber(row.open_work_orders),
        overduePreventivePlans: acc.overduePreventivePlans + toNumber(row.overdue_preventive_plans),
      };
    }, emptyTotals));

    hasInitialLoadCompleted.current = true;
    setIsLoading(false);
  }, []);

  return { tenants, totals, isLoading, error, reload };
}

export async function updateCommandCenterTenant(input: CommandCenterTenantUpdateInput) {
  const { data, error } = await supabase.rpc('update_command_center_tenant', {
    target_tenant_id: input.tenantId,
    target_legal_name: input.legalName,
    target_trade_name: input.tradeName,
    target_document_number: input.documentNumber,
    target_status: input.status,
    change_reason: input.reason || null,
  });

  if (error) throw new Error(error.message);

  return (data ?? [])[0] ?? null;
}


export function useCommandCenterTenantDetail(tenantId: string | null) {
  const [detail, setDetail] = useState<CommandCenterTenantDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadDetail = useCallback(async () => {
    if (!tenantId) {
      setDetail(null);
      setIsLoading(false);
      setError('');
      return;
    }

    setIsLoading(true);
    setDetail(null);
    setError('');

    const [tenantResult, subscriptionResult, membershipsResult, unitsResult, costCentersResult] =
      await Promise.all([
        supabase
          .from('tenants')
          .select('id, status')
          .eq('id', tenantId)
          .maybeSingle(),

        supabase
          .from('subscriptions')
          .select(
            'id, plan_name_snapshot, status, contract_start_date, contract_end_date, billing_start_date, trial_ends_at, robot_limit_snapshot, annual_price_cents_snapshot',
          )
          .eq('tenant_id', tenantId)
          .in('status', ['trial', 'active'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('tenant_memberships')
          .select('id, user_id, role, is_active')
          .eq('tenant_id', tenantId)
          .eq('role', 'tenant_admin')
          .order('created_at'),

        supabase
          .from('units')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),

        supabase
          .from('cost_centers')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
      ]);

    if (tenantResult.error || subscriptionResult.error || membershipsResult.error || unitsResult.error || costCentersResult.error) {
      setError('Não foi possível carregar os dados SaaS deste cliente. Tente novamente.');
      setIsLoading(false);
      return;
    }

    if (!tenantResult.data) {
      setError('Cliente não encontrado ou indisponível para consulta.');
      setDetail(null);
      setIsLoading(false);
      return;
    }

    const memberships = (membershipsResult.data ?? []) as Array<{
      id: string;
      user_id: string;
      role: string;
      is_active: boolean;
    }>;
    const administratorIds = memberships.map((membership) => membership.user_id);
    const profilesResult = administratorIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', administratorIds)
      : { data: [], error: null };

    if (profilesResult.error) {
      setError('Não foi possível carregar os administradores deste cliente. Tente novamente.');
      setIsLoading(false);
      return;
    }

    const profilesById = new Map(
      ((profilesResult.data ?? []) as Array<{ id: string; full_name: string | null }>).map((profile) => [profile.id, profile.full_name]),
    );
    const subscriptionRow = subscriptionResult.data as {
      id: string;
      plan_name_snapshot: string;
      status: string;
      contract_start_date: string;
      contract_end_date: string;
      billing_start_date: string;
      trial_ends_at: string | null;
      robot_limit_snapshot: number;
      annual_price_cents_snapshot: number;
    } | null;

    let entitlementRows: Array<{ entitlement_code: string; limit_value: number | null; is_unlimited: boolean }> = [];
    let entitlementDefinitions: Array<{ code: string; name: string; unit: 'count' | 'bytes' | 'boolean' }> = [];

    if (subscriptionRow) {
      const [entitlementsResult, definitionsResult] = await Promise.all([
        supabase
          .from('subscription_entitlements')
          .select('entitlement_code, limit_value, is_unlimited')
          .eq('subscription_id', subscriptionRow.id)
          .is('effective_to', null)
          .in('entitlement_code', requiredEntitlementCodes),
        supabase
          .from('entitlement_definitions')
          .select('code, name, unit')
          .in('code', requiredEntitlementCodes),
      ]);

      if (entitlementsResult.error || definitionsResult.error) {
        setError('Não foi possível carregar as franquias deste contrato. Tente novamente.');
        setIsLoading(false);
        return;
      }

      entitlementRows = (entitlementsResult.data ?? []) as typeof entitlementRows;
      entitlementDefinitions = (definitionsResult.data ?? []) as typeof entitlementDefinitions;
    }

    const definitionsByCode = new Map(entitlementDefinitions.map((definition) => [definition.code, definition]));
    const entitlementsByCode = new Map(entitlementRows.map((entitlement) => [entitlement.entitlement_code, entitlement]));
    const tenantStatus = String(tenantResult.data.status);

    setDetail({
      tenantId,
      accessStatus: tenantStatus,
      accessStatusLabel: accessStatusLabels[tenantStatus] ?? 'Não informado',
      subscription: subscriptionRow
        ? {
            id: subscriptionRow.id,
            planName: subscriptionRow.plan_name_snapshot,
            status: subscriptionRow.status,
            statusLabel: subscriptionStatusLabels[subscriptionRow.status] ?? subscriptionRow.status,
            contractStartDate: subscriptionRow.contract_start_date,
            contractEndDate: subscriptionRow.contract_end_date,
            billingStartDate: subscriptionRow.billing_start_date,
            trialEndsAt: subscriptionRow.trial_ends_at,
            robotLimit: toNumber(subscriptionRow.robot_limit_snapshot),
            annualPriceCents: toNumber(subscriptionRow.annual_price_cents_snapshot),
          }
        : null,
      administrators: memberships.map((membership) => ({
        id: membership.id,
        fullName: profilesById.get(membership.user_id) ?? 'Nome não informado',
        role: membership.role,
        roleLabel: membershipRoleLabels[membership.role] ?? membership.role,
        isActive: membership.is_active,
      })),
      activeUnitsCount: (unitsResult.data ?? []).length,
      activeCostCentersCount: (costCentersResult.data ?? []).length,
      entitlements: requiredEntitlementCodes.flatMap((code) => {
        const entitlement = entitlementsByCode.get(code);
        const definition = definitionsByCode.get(code);
        if (!definition) return [];
        return [{
          code,
          name: definition.name,
          limitValue: entitlement?.limit_value == null ? null : toNumber(entitlement.limit_value),
          isUnlimited: entitlement?.is_unlimited ?? false,
          isConfigured: Boolean(entitlement),
          unit: definition.unit,
        }];
      }),
    });
    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  return { detail, isLoading, error, reload: loadDetail };
}

export function subscriptionStatusLabel(status: string) {
  return subscriptionStatusLabels[status] ?? status;
}

export type SubscriptionPlanRecord = {
  id: string;
  name: string;
  robotLimit: number;
  annualPriceCents: number;
  includedStorageBytes: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
};

export type SubscriptionPlanInput = {
  id: string | null;
  name: string;
  robotLimit: number;
  annualPriceCents: number;
  includedStorageBytes: number;
  description: string;
  isActive: boolean;
};

function mapSubscriptionPlanError(message: string) {
  if (message.includes('subscription_plans_name_key') || message.includes('duplicate key')) {
    return 'Já existe um plano comercial com este nome.';
  }
  if (message.includes('row-level security')) {
    return 'Acesso negado ao Command Center.';
  }
  return message;
}

type PlanRpcArgs = {
  planId: string | null;
  name: string;
  robotLimit: number;
  annualPriceCents: number;
  includedStorageBytes: number;
  description: string;
  isActive: boolean;
};

// Única porta de escrita de planos: a RPC valida e audita antes/depois no banco.
async function savePlanThroughRpc(args: PlanRpcArgs) {
  const { data, error } = await supabase.rpc('save_command_center_subscription_plan', {
    target_plan_id: args.planId,
    target_name: args.name,
    target_robot_limit: args.robotLimit,
    target_annual_price_cents: args.annualPriceCents,
    target_included_storage_bytes: args.includedStorageBytes,
    target_description: args.description || null,
    target_is_active: args.isActive,
  });

  if (error) throw new Error(mapSubscriptionPlanError(error.message));

  const rows = (data ?? []) as Array<{ subscription_plan_id: string }>;
  return rows[0]?.subscription_plan_id ?? null;
}

export async function saveSubscriptionPlan(input: SubscriptionPlanInput) {
  return savePlanThroughRpc({
    planId: input.id,
    name: input.name,
    robotLimit: input.robotLimit,
    annualPriceCents: input.annualPriceCents,
    includedStorageBytes: input.includedStorageBytes,
    description: input.description,
    isActive: input.isActive,
  });
}

export async function setSubscriptionPlanActive(plan: SubscriptionPlanRecord, isActive: boolean) {
  return savePlanThroughRpc({
    planId: plan.id,
    name: plan.name,
    robotLimit: plan.robotLimit,
    annualPriceCents: plan.annualPriceCents,
    includedStorageBytes: plan.includedStorageBytes,
    description: plan.description ?? '',
    isActive,
  });
}

export function useSubscriptionPlans() {
  const [plans, setPlans] = useState<SubscriptionPlanRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setError('');

    const { data, error: loadError } = await supabase
      .from('subscription_plans')
      .select('id, name, robot_limit, annual_price_cents, included_storage_bytes, description, is_active, created_at')
      .order('name');

    if (loadError) {
      setError('Não foi possível carregar os planos comerciais agora. Tente novamente.');
      setIsLoading(false);
      return;
    }

    setPlans(((data ?? []) as Array<{
      id: string;
      name: string;
      robot_limit: number;
      annual_price_cents: number;
      included_storage_bytes: number;
      description: string | null;
      is_active: boolean;
      created_at: string;
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      robotLimit: toNumber(row.robot_limit),
      annualPriceCents: toNumber(row.annual_price_cents),
      includedStorageBytes: toNumber(row.included_storage_bytes),
      description: row.description,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
    })));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { plans, isLoading, error, reload };
}

export type SubscriptionContractRecord = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantLegalName: string;
  planId: string | null;
  planName: string;
  robotLimitSnapshot: number;
  annualPriceCentsSnapshot: number;
  includedStorageBytesSnapshot: number;
  status: string;
  contractStartDate: string;
  contractEndDate: string;
  billingStartDate: string;
  trialEndsAt: string | null;
  paymentProvider: string | null;
  paymentCustomerReference: string | null;
  notes: string | null;
  createdAt: string;
};

export function useSubscriptionContracts() {
  const [contracts, setContracts] = useState<SubscriptionContractRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setError('');

    const { data, error: loadError } = await supabase
      .from('subscriptions')
      .select(
        'id, tenant_id, plan_id, plan_name_snapshot, robot_limit_snapshot, annual_price_cents_snapshot, included_storage_bytes_snapshot, status, contract_start_date, contract_end_date, billing_start_date, trial_ends_at, payment_provider, payment_customer_reference, notes, created_at, tenants(trade_name, legal_name)',
      )
      .order('created_at', { ascending: false });

    if (loadError) {
      setError('Não foi possível carregar os contratos agora. Tente novamente.');
      setIsLoading(false);
      return;
    }

    setContracts(((data ?? []) as Array<Record<string, any>>).map((row) => {
      const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;

      return {
        id: row.id,
        tenantId: row.tenant_id,
        tenantName: tenant?.trade_name ?? tenant?.legal_name ?? 'Cliente sem nome',
        tenantLegalName: tenant?.legal_name ?? '',
        planId: row.plan_id,
        planName: row.plan_name_snapshot,
        robotLimitSnapshot: toNumber(row.robot_limit_snapshot),
        annualPriceCentsSnapshot: toNumber(row.annual_price_cents_snapshot),
        includedStorageBytesSnapshot: toNumber(row.included_storage_bytes_snapshot),
        status: row.status,
        contractStartDate: row.contract_start_date,
        contractEndDate: row.contract_end_date,
        billingStartDate: row.billing_start_date,
        trialEndsAt: row.trial_ends_at,
        paymentProvider: row.payment_provider,
        paymentCustomerReference: row.payment_customer_reference,
        notes: row.notes,
        createdAt: row.created_at,
      };
    }));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { contracts, isLoading, error, reload };
}

export type SubscriptionContractInput = {
  tenantId: string;
  planId: string;
  status: string;
  contractStartDate: string;
  billingStartDate: string;
  contractEndDate: string;
  trialEndsAt: string | null;
  paymentProvider: string;
  paymentCustomerReference: string;
  notes: string;
  replacementReason: string;
};

// Única porta de escrita de contratos: valida, substitui e audita em uma transação.
export async function createSubscriptionContract(input: SubscriptionContractInput) {
  const { data, error } = await supabase.rpc('create_command_center_subscription', {
    target_tenant_id: input.tenantId,
    target_plan_id: input.planId,
    target_status: input.status,
    target_contract_start_date: input.contractStartDate,
    target_billing_start_date: input.billingStartDate,
    target_contract_end_date: input.contractEndDate,
    target_trial_ends_at: input.trialEndsAt,
    target_payment_provider: input.paymentProvider || null,
    target_payment_customer_reference: input.paymentCustomerReference || null,
    target_notes: input.notes || null,
    replacement_reason: input.replacementReason || null,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{ subscription_id: string }>;
  return rows[0]?.subscription_id ?? null;
}
