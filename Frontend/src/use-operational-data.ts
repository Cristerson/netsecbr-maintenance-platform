import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

export type OperationalAsset = {
  id: string;
  name: string;
  code: string;
  location: string;
  criticality: 'Crítica' | 'Alta' | 'Média';
  status: 'Operando' | 'Em manutenção' | 'Parado';
};

export type OperationalWorkOrder = {
  id: string;
  number: number;
  title: string;
  asset: string;
  type: string;
  priority: 'Crítica' | 'Alta' | 'Média';
  status: 'Aberta' | 'Em execução' | 'Aguardando material' | 'Concluída' | 'Cancelada';
  technician: string;
};

export type UpcomingPreventivePlan = {
  id: string;
  name: string;
  nextDueDate: string;
  assetLabel: string;
};

const assetStatus = { active: 'Operando', inactive: 'Parado', maintenance: 'Em manutenção', stopped: 'Parado', retired: 'Parado' } as const;
const criticality = { critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Média' } as const;
const orderStatus = { open: 'Aberta', in_progress: 'Em execução', waiting_material: 'Aguardando material', completed: 'Concluída', cancelled: 'Cancelada' } as const;
const orderType = { corrective: 'Corretiva', preventive: 'Preventiva', predictive: 'Preditiva', emergency: 'Emergencial', improvement: 'Melhoria' } as const;

export function useOperationalData(tenantId: string) {
  const [assets, setAssets] = useState<OperationalAsset[]>([]);
  const [orders, setOrders] = useState<OperationalWorkOrder[]>([]);
  const [overduePreventivePlans, setOverduePreventivePlans] = useState(0);
  const [upcomingPreventivePlans, setUpcomingPreventivePlans] = useState<UpcomingPreventivePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Recargas após a primeira carga não travam a tela: os dados atuais permanecem
  // visíveis até os novos chegarem (sem polling e sem Realtime).
  const hasInitialLoadCompleted = useRef(false);

  // Guarda de concorrência: cada carga recebe um identificador crescente e só a
  // execução mais recente pode aplicar estado. Respostas antigas são descartadas.
  const latestRequestId = useRef(0);

  // Tenant da carga atualmente válida: permite detectar a troca de tenant dentro
  // do próprio hook, sem depender do componente que o consome.
  const loadedTenantId = useRef(tenantId);

  // Troca de tenant (ou de usuário, que também troca o tenant): invalida
  // respostas em voo, volta ao estado de carga inicial e descarta os dados do
  // tenant anterior para que nunca sejam exibidos como se fossem do tenant novo.
  useEffect(() => {
    if (loadedTenantId.current === tenantId) return;

    loadedTenantId.current = tenantId;
    hasInitialLoadCompleted.current = false;
    latestRequestId.current += 1;

    setAssets([]);
    setOrders([]);
    setOverduePreventivePlans(0);
    setUpcomingPreventivePlans([]);
    setError('');
    setIsLoading(true);
  }, [tenantId]);

  const load = useCallback(async () => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    // Vale para todo setState assíncrono abaixo: se outra carga começou depois,
    // esta execução está obsoleta e não pode mais alterar o estado.
    const isLatestRequest = () => latestRequestId.current === requestId;

    setError('');

    if (!hasInitialLoadCompleted.current) {
      setIsLoading(true);
    }

    const [{ data: assetsData, error: assetsError }, { data: ordersData, error: ordersError }, { data: plansData, error: plansError }, { data: upcomingPlansData, error: upcomingPlansError }] = await Promise.all([
      supabase.from('assets').select('id, name, code, status, criticality, units(name, city)').eq('tenant_id', tenantId).order('name'),
      supabase.from('work_orders').select('id, order_number, title, type, priority, status, assets(name), assigned_profile:profiles!work_orders_assigned_to_fkey(full_name)').eq('tenant_id', tenantId).order('opened_at', { ascending: false }).limit(50),
      supabase.from('maintenance_plans').select('id, is_active, next_due_date').eq('tenant_id', tenantId),
      supabase
        .from('maintenance_plans')
        .select('id, name, next_due_date, assets(name, code)')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('next_due_date', { ascending: true })
        .limit(3),
    ]);

    // Resposta de uma carga já substituída por outra mais recente: descarta em silêncio.
    if (!isLatestRequest()) return;

    if (assetsError || ordersError || plansError || upcomingPlansError) {
      setError('Não foi possível carregar os dados operacionais agora. Atualize a página e tente novamente.');
      hasInitialLoadCompleted.current = true;
      setIsLoading(false);
      return;
    }

    // Atrasado apenas se o plano está ativo e o vencimento é anterior ao dia atual (data local YYYY-MM-DD).
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const overdue = (plansData ?? []).filter(
      (plan: any) => plan.is_active === true && plan.next_due_date < today,
    ).length;
    setOverduePreventivePlans(overdue);

    setUpcomingPreventivePlans((upcomingPlansData ?? []).map((plan: any) => ({
      id: plan.id,
      name: plan.name,
      nextDueDate: plan.next_due_date,
      assetLabel: plan.assets ? `${plan.assets.code} · ${plan.assets.name}` : 'Ativo não vinculado',
    })));

    setAssets((assetsData ?? []).map((asset: any) => ({
      id: asset.id,
      name: asset.name,
      code: asset.code,
      location: [asset.units?.name, asset.units?.city].filter(Boolean).join(' · ') || 'Unidade não informada',
      criticality: criticality[asset.criticality as keyof typeof criticality] ?? 'Média',
      status: assetStatus[asset.status as keyof typeof assetStatus] ?? 'Operando',
    })));
    setOrders((ordersData ?? []).map((order: any) => ({
      id: order.id,
      number: order.order_number,
      title: order.title,
      asset: order.assets?.name ?? 'Sem ativo vinculado',
      type: orderType[order.type as keyof typeof orderType] ?? order.type,
      priority: criticality[order.priority as keyof typeof criticality] ?? 'Média',
      status: orderStatus[order.status as keyof typeof orderStatus] ?? order.status,
      technician: order.assigned_profile?.full_name ?? 'Não atribuído',
    })));

    hasInitialLoadCompleted.current = true;
    setIsLoading(false);
  }, [tenantId]);

  return { assets, orders, overduePreventivePlans, upcomingPreventivePlans, isLoading, error, reload: load };
}
