import { useEffect, useState } from 'react';
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

const assetStatus = { active: 'Operando', inactive: 'Parado', maintenance: 'Em manutenção', stopped: 'Parado', retired: 'Parado' } as const;
const criticality = { critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Média' } as const;
const orderStatus = { open: 'Aberta', in_progress: 'Em execução', waiting_material: 'Aguardando material', completed: 'Concluída', cancelled: 'Cancelada' } as const;
const orderType = { corrective: 'Corretiva', preventive: 'Preventiva', predictive: 'Preditiva', emergency: 'Emergencial', improvement: 'Melhoria' } as const;

export function useOperationalData(tenantId: string) {
  const [assets, setAssets] = useState<OperationalAsset[]>([]);
  const [orders, setOrders] = useState<OperationalWorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');
      const [{ data: assetsData, error: assetsError }, { data: ordersData, error: ordersError }] = await Promise.all([
        supabase.from('assets').select('id, name, code, status, criticality, units(name, city)').eq('tenant_id', tenantId).order('name'),
        supabase.from('work_orders').select('id, order_number, title, type, priority, status, assets(name), assigned_profile:profiles!work_orders_assigned_to_fkey(full_name)').eq('tenant_id', tenantId).order('opened_at', { ascending: false }).limit(50),
      ]);

      if (assetsError || ordersError) {
        setError('Não foi possível carregar os dados operacionais agora. Atualize a página e tente novamente.');
        setIsLoading(false);
        return;
      }

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
      setIsLoading(false);
    };

    void load();
  }, [tenantId]);

  return { assets, orders, isLoading, error };
}
