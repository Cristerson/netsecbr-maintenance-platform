import { useEffect, useState } from 'react';
import { supabase } from './supabase';

type Row = Record<string, any>;
type Section<T> = { value: T | null; error: string | null };
export type ClientDashboardData = {
  health: Section<{ total: number; normal: number; attention: number; risk: number; critical: number; retired: number }>;
  plans: Section<{ scheduled: number; overdue: number; upcoming: number; completedOrders: number }>;
  orders: Section<{ open: number; executing: number; completed: number; overdue: number }>;
  availability: Section<{ available: number; unavailable: number; downtimeHours: number | null; mttrHours: number | null }>;
  costs: Section<{ preventiveCents: number; correctiveCents: number; estimatedStopCents: number | null }>;
  requests: Section<{ open: number; pendingApproval: number; recentlyApproved: number }>;
};

const absent = <T,>(): Section<T> => ({ value: null, error: null });
const ready = <T,>(value: T): Section<T> => ({ value, error: null });
const failed = (error: string): Section<never> => ({ value: null, error });

async function loadAll(table: string, columns: string, tenantId: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase.from(table).select(columns).eq('tenant_id', tenantId).order('id').range(start, start + 499);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

function hoursBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const hours = (new Date(end).getTime() - new Date(start).getTime()) / 3600000;
  return Number.isFinite(hours) && hours >= 0 ? hours : null;
}

export function useClientDashboard(tenantId: string) {
  const [data, setData] = useState<ClientDashboardData>({
    health: absent(), plans: absent(), orders: absent(), availability: absent(), costs: absent(), requests: absent(),
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setIsLoading(true);
    setData({ health: absent(), plans: absent(), orders: absent(), availability: absent(), costs: absent(), requests: absent() });
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const upcomingIso = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 30)).toISOString().slice(0, 10);
    const recentIso = new Date(Date.now() - 30 * 86400000).toISOString();

    void (async () => {
      const [assetsResult, plansResult, ordersResult, costsResult, requestsResult] = await Promise.allSettled([
        loadAll('assets', 'id,status,criticality,deleted_at,estimated_production_value_per_hour_cents', tenantId),
        loadAll('maintenance_plans', 'id,is_active,next_due_date', tenantId),
        loadAll('work_orders', 'id,asset_id,type,status,scheduled_for,opened_at,completed_at,downtime_started_at,downtime_ended_at,causes_equipment_downtime,attendance_started_at,repair_started_at', tenantId),
        loadAll('work_order_costs', 'work_order_id,quantity,unit_cost_cents', tenantId),
        loadAll('service_requests', 'id,status,approved_at', tenantId),
      ]);
      if (!live) return;
      const assets = assetsResult.status === 'fulfilled' ? assetsResult.value.filter((asset) => !asset.deleted_at) : null;
      const plans = plansResult.status === 'fulfilled' ? plansResult.value : null;
      const orders = ordersResult.status === 'fulfilled' ? ordersResult.value : null;
      const costs = costsResult.status === 'fulfilled' ? costsResult.value : null;
      const requests = requestsResult.status === 'fulfilled' ? requestsResult.value : null;
      const unavailable = (name: string) => `Não foi possível carregar ${name}.`;

      const health = assets ? ready({
        total: assets.filter((asset) => asset.status !== 'retired').length,
        normal: assets.filter((asset) => asset.status === 'active').length,
        attention: assets.filter((asset) => ['maintenance', 'inactive'].includes(asset.status)).length,
        risk: assets.filter((asset) => asset.status === 'stopped' && !['high', 'critical'].includes(asset.criticality)).length,
        critical: assets.filter((asset) => asset.status === 'stopped' && ['high', 'critical'].includes(asset.criticality)).length,
        retired: assets.filter((asset) => asset.status === 'retired').length,
      }) : failed(unavailable('a saúde dos ativos'));

      const activePlans = plans?.filter((plan) => plan.is_active) ?? [];
      const plansSection = plans && orders ? ready({
        scheduled: activePlans.filter((plan) => plan.next_due_date >= todayIso).length,
        overdue: activePlans.filter((plan) => plan.next_due_date < todayIso).length,
        upcoming: activePlans.filter((plan) => plan.next_due_date >= todayIso && plan.next_due_date <= upcomingIso).length,
        completedOrders: orders.filter((order) => order.type === 'preventive' && order.status === 'completed').length,
      }) : failed(unavailable('as preventivas'));

      const activeStatuses = ['open', 'in_progress', 'waiting_material'];
      const ordersSection = orders ? ready({
        open: orders.filter((order) => order.status === 'open').length,
        executing: orders.filter((order) => ['in_progress', 'waiting_material'].includes(order.status)).length,
        completed: orders.filter((order) => order.status === 'completed').length,
        overdue: orders.filter((order) => activeStatuses.includes(order.status) && order.scheduled_for && new Date(order.scheduled_for).getTime() < Date.now()).length,
      }) : failed(unavailable('as ordens de serviço'));

      const downtimeRows = orders?.filter((order) => order.causes_equipment_downtime && order.downtime_started_at) ?? [];
      const measuredDowntime = downtimeRows.map((order) => hoursBetween(order.downtime_started_at, order.downtime_ended_at));
      const repairHours = orders?.filter((order) => order.type === 'corrective' && order.status === 'completed')
        .map((order) => hoursBetween(order.repair_started_at, order.completed_at))
        .filter((value): value is number => value !== null) ?? [];
      const availability = assets && orders ? ready({
        available: assets.filter((asset) => asset.status === 'active').length,
        unavailable: assets.filter((asset) => ['stopped', 'maintenance'].includes(asset.status)).length,
        downtimeHours: downtimeRows.length > 0 && measuredDowntime.every((value) => value !== null)
          ? measuredDowntime.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null,
        mttrHours: repairHours.length > 0 ? repairHours.reduce((sum, value) => sum + value, 0) / repairHours.length : null,
      }) : failed(unavailable('a disponibilidade'));

      const orderById = new Map(orders?.map((order) => [order.id, order]) ?? []);
      const assetById = new Map(assets?.map((asset) => [asset.id, asset]) ?? []);
      const totalCost = (type: string) => costs?.reduce((sum, cost) => {
        const order = orderById.get(cost.work_order_id);
        return sum + (order?.type === type ? Number(cost.quantity ?? 0) * Number(cost.unit_cost_cents ?? 0) : 0);
      }, 0) ?? 0;
      const stopEstimates = downtimeRows.map((order) => {
        const hours = hoursBetween(order.downtime_started_at, order.downtime_ended_at);
        const rate = assetById.get(order.asset_id)?.estimated_production_value_per_hour_cents;
        return hours !== null && rate != null ? hours * Number(rate) : null;
      });
      const costsSection = costs && orders && assets ? ready({
        preventiveCents: totalCost('preventive'), correctiveCents: totalCost('corrective'),
        estimatedStopCents: stopEstimates.length > 0 && stopEstimates.every((value) => value !== null)
          ? stopEstimates.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null,
      }) : failed(unavailable('os custos'));

      const requestsSection = requests ? ready({
        open: requests.filter((request) => request.status === 'open').length,
        pendingApproval: requests.filter((request) => request.status === 'triaged').length,
        recentlyApproved: requests.filter((request) => request.approved_at && request.approved_at >= recentIso).length,
      }) : failed(unavailable('as solicitações'));

      setData({ health, plans: plansSection, orders: ordersSection, availability, costs: costsSection, requests: requestsSection });
      setIsLoading(false);
    })();
    return () => { live = false; };
  }, [tenantId]);

  return { data, isLoading };
}
