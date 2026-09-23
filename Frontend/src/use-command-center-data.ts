import { useCallback, useRef, useState } from 'react';
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

const tenantStatusLabels: Record<string, string> = {
  active: 'Ativo',
  grace_period: 'Período de graça',
  payment_only: 'Somente pagamento',
  suspended: 'Suspenso',
};

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
