import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { supabase } from './supabase';
import { PurchaseRequestAdmin } from './purchase-request-admin';

type Props = {
  tenantId: string;
  currentUserId: string;
  isTenantAdmin: boolean;
  canCreate: boolean;
};

type WorkOrderType = 'corrective' | 'preventive' | 'predictive' | 'emergency' | 'improvement';
type WorkOrderPriority = 'low' | 'medium' | 'high' | 'critical';
type WorkOrderStatus = 'open' | 'in_progress' | 'waiting_material' | 'completed' | 'cancelled';

type WorkOrder = {
  id: string;
  order_number: number;
  tenant_id: string;
  unit_id: string;
  cost_center_id: string;
  asset_id: string | null;
  title: string;
  description: string | null;
  type: WorkOrderType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  opened_by: string;
  assigned_to: string | null;
  opened_at: string;
  scheduled_for: string | null;
  completed_at: string | null;
};

type WorkOrderRow = WorkOrder & {
  asset_name: string | null;
  unit_name: string;
  cost_center_name: string;
  assigned_name: string | null;
  opened_by_name: string | null;
};

type Asset = {
  id: string;
  code: string;
  name: string;
  unit_id: string;
  cost_center_id: string;
  status: string;
};

type Unit = {
  id: string;
  cost_center_id: string;
  code: string;
  name: string;
  is_active: boolean;
};

type CostCenter = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

type TeamMember = {
  id: string;
  full_name: string | null;
  role: string;
};

const typeLabels: Record<WorkOrderType, string> = {
  corrective: 'Corretiva',
  preventive: 'Preventiva',
  predictive: 'Preditiva',
  emergency: 'Emergencial',
  improvement: 'Melhoria',
};

const priorityLabels: Record<WorkOrderPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

const statusLabels: Record<WorkOrderStatus, string> = {
  open: 'Aberta',
  in_progress: 'Em execução',
  waiting_material: 'Aguardando material',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

const emptyForm = {
  title: '',
  description: '',
  type: 'corrective' as WorkOrderType,
  priority: 'medium' as WorkOrderPriority,
  status: 'open' as WorkOrderStatus,
  unit_id: '',
  cost_center_id: '',
  asset_id: '',
  assigned_to: '',
  scheduled_for: '',
};

export function WorkOrderAdmin({
  tenantId,
  currentUserId,
  isTenantAdmin,
  canCreate,
}: Props) {
  const [orders, setOrders] = useState<WorkOrderRow[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | WorkOrderStatus>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<WorkOrderRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    const { data: ordersData, error: ordersError } = await supabase
      .from('work_orders')
      .select(
        `id, order_number, tenant_id, unit_id, cost_center_id, asset_id, title, description, type, priority, status, opened_by, assigned_to, opened_at, scheduled_for, completed_at,
        assets(name),
        units(name),
        cost_centers(name),
        assigned_profile:profiles!work_orders_assigned_to_fkey(full_name),
        opened_profile:profiles!work_orders_opened_by_fkey(full_name)`,
      )
      .eq('tenant_id', tenantId)
      .order('opened_at', { ascending: false })
      .limit(200);

    if (ordersError) {
      setErrorMessage(`Não foi possível carregar as ordens de serviço: ${ordersError.message}`);
      setIsLoading(false);
      return;
    }

    const [{ data: unitData, error: unitError }, { data: costCenterData, error: costCenterError }, { data: assetData, error: assetError }, { data: membershipData, error: membershipError }] =
      await Promise.all([
        supabase
          .from('units')
          .select('id, cost_center_id, code, name, is_active')
          .eq('tenant_id', tenantId)
          .order('name'),
        supabase
          .from('cost_centers')
          .select('id, code, name, is_active')
          .eq('tenant_id', tenantId)
          .order('name'),
        supabase
          .from('assets')
          .select('id, code, name, unit_id, cost_center_id, status')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('name'),
        supabase
          .from('tenant_memberships')
          .select('user_id, role')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
      ]);

    if (unitError || costCenterError || assetError || membershipError) {
      setErrorMessage(
        `Não foi possível carregar os dados de apoio: ${
          unitError?.message ?? costCenterError?.message ?? assetError?.message ?? membershipError?.message
        }`,
      );
      setIsLoading(false);
      return;
    }

    setUnits((unitData ?? []) as Unit[]);
    setCostCenters((costCenterData ?? []) as CostCenter[]);
    setAssets((assetData ?? []) as Asset[]);

    const userIds = (membershipData ?? []).map((membership) => membership.user_id);

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profilesError) {
        setErrorMessage(`Não foi possível carregar os usuários: ${profilesError.message}`);
        setIsLoading(false);
        return;
      }

      const namesById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));

      setTeamMembers(
        (membershipData ?? []).map((membership) => ({
          id: membership.user_id,
          full_name: namesById.get(membership.user_id) ?? null,
          role: membership.role,
        })),
      );
    } else {
      setTeamMembers([]);
    }

    setOrders(
      (ordersData ?? []).map((order: any) => ({
        ...order,
        asset_name: order.assets?.name ?? null,
        unit_name: order.units?.name ?? '—',
        cost_center_name: order.cost_centers?.name ?? '—',
        assigned_name: order.assigned_profile?.full_name ?? null,
        opened_by_name: order.opened_profile?.full_name ?? null,
      })),
    );
    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredOrders = orders.filter((order) =>
    statusFilter === 'all' ? true : order.status === statusFilter,
  );

  const availableUnits = units.filter(
    (unit) => unit.is_active || unit.id === editingOrder?.unit_id,
  );

  const availableCostCenters = costCenters.filter(
    (costCenter) =>
      costCenter.is_active || costCenter.id === editingOrder?.cost_center_id,
  );

  const selectedUnit = units.find((unit) => unit.id === form.unit_id);
  const unitCostCenters = availableCostCenters.filter(
    (costCenter) =>
      !selectedUnit ||
      costCenter.id === selectedUnit.cost_center_id ||
      costCenter.id === form.cost_center_id,
  );

  const availableAssets = assets.filter(
    (asset) =>
      !form.unit_id ||
      (asset.unit_id === form.unit_id &&
        (asset.cost_center_id === form.cost_center_id || asset.cost_center_id === null)) ||
      asset.id === editingOrder?.asset_id,
  );

  function openNewOrder() {
    setMessage('');
    setErrorMessage('');
    setEditingOrder(null);
    setForm({
      ...emptyForm,
      unit_id: availableUnits[0]?.id ?? '',
      cost_center_id: availableUnits[0]?.cost_center_id ?? availableCostCenters[0]?.id ?? '',
    });
    setIsFormOpen(true);
  }

  function openEditOrder(order: WorkOrder) {
    setMessage('');
    setErrorMessage('');
    setEditingOrder(order);
    setForm({
      title: order.title,
      description: order.description ?? '',
      type: order.type,
      priority: order.priority,
      status: order.status,
      unit_id: order.unit_id,
      cost_center_id: order.cost_center_id,
      asset_id: order.asset_id ?? '',
      assigned_to: order.assigned_to ?? '',
      scheduled_for: order.scheduled_for ? order.scheduled_for.slice(0, 16) : '',
    });
    setIsFormOpen(true);
  }

  function handleUnitChange(unitId: string) {
    const unit = units.find((item) => item.id === unitId);

    setForm({
      ...form,
      unit_id: unitId,
      cost_center_id: unit?.cost_center_id ?? '',
      asset_id: '',
    });
  }

  async function saveOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.title.trim().length < 3) {
      setErrorMessage('O título precisa ter pelo menos 3 caracteres.');
      return;
    }

    if (!form.unit_id) {
      setErrorMessage('Selecione uma unidade.');
      return;
    }

    if (!form.cost_center_id) {
      setErrorMessage('Selecione um centro de custo.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      type: form.type,
      priority: form.priority,
      unit_id: form.unit_id,
      cost_center_id: form.cost_center_id,
      asset_id: form.asset_id || null,
      assigned_to: form.assigned_to || null,
      scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null,
    };

    if (editingOrder) {
      const statusPayload = {
        ...payload,
        status: form.status,
        completed_at:
          form.status === 'completed' ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from('work_orders')
        .update(statusPayload)
        .eq('id', editingOrder.id);

      if (error) {
        setErrorMessage(`Não foi possível atualizar a ordem de serviço: ${error.message}`);
      } else {
        setMessage('Ordem de serviço atualizada com sucesso.');
        setIsFormOpen(false);
        await loadData();
      }
    } else {
      const { error } = await supabase.from('work_orders').insert({
        ...payload,
        tenant_id: tenantId,
        opened_by: currentUserId,
      });

      if (error) {
        setErrorMessage(`Não foi possível cadastrar a ordem de serviço: ${error.message}`);
      } else {
        setMessage('Ordem de serviço cadastrada com sucesso.');
        setIsFormOpen(false);
        await loadData();
      }
    }

    setIsSaving(false);
  }

  async function changeStatus(order: WorkOrderRow, nextStatus: WorkOrderStatus) {
    const action = statusLabels[nextStatus];

    if (!window.confirm(`Deseja marcar a OS #${order.order_number} como "${action}"?`)) return;

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('work_orders')
      .update({
        status: nextStatus,
        completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', order.id);

    if (error) {
      setErrorMessage(`Não foi possível atualizar o status: ${error.message}`);
    } else {
      setMessage(`OS #${order.order_number} marcada como "${action}".`);
      await loadData();
    }

    setIsSaving(false);
  }

   function getStatusNextOptions(status: WorkOrderStatus): WorkOrderStatus[] {
    switch (status) {
      case 'open':
        return ['in_progress', 'waiting_material', 'cancelled'];
      case 'in_progress':
        return ['waiting_material', 'completed', 'cancelled'];
      case 'waiting_material':
        return ['in_progress', 'completed', 'cancelled'];
      case 'completed':
        return ['in_progress'];
      case 'cancelled':
        return ['open'];
      default:
        return [];
    }
  }

  if (purchaseOrder) {
    return (
      <PurchaseRequestAdmin
        tenantId={tenantId}
        currentUserId={currentUserId}
        order={purchaseOrder}
        onClose={() => setPurchaseOrder(null)}
        onSaved={() => {
          setMessage(
            `Requisições da OS #${purchaseOrder.order_number} atualizadas.`,
          );
          void loadData();
        }}
      />
    );
  }

  return (
    <div>
      <div className="user-admin-actions">
        <div className="asset-search">
          <select
            className="status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as 'all' | WorkOrderStatus)
            }
          >
            <option value="all">Todos os status</option>
            {(Object.keys(statusLabels) as WorkOrderStatus[]).map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </div>

        {canCreate && (
          <button
            className="button-with-icon"
            onClick={openNewOrder}
            disabled={isSaving || isLoading}
            title="Nova ordem de serviço"
          >
            <Plus size={17} />
            Nova OS
          </button>
        )}

        <button
          className="secondary button-with-icon"
          onClick={() => void loadData()}
          disabled={isLoading || isSaving}
        >
          <RefreshCw size={17} />
          Atualizar lista
        </button>
      </div>

      {message && <p className="success-message">{message}</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {isFormOpen && (
        <form className="new-user-form panel" onSubmit={saveOrder}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">ORDEM DE SERVIÇO</p>
              <h2>
                {editingOrder ? `Editar OS #${editingOrder.order_number}` : 'Nova ordem de serviço'}
              </h2>
            </div>

            <button
              type="button"
              className="secondary icon-action"
              title="Cancelar"
              aria-label="Cancelar"
              onClick={() => setIsFormOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          {editingOrder && (
            <div className="order-summary">
              <p>
                <strong>Número:</strong> #{editingOrder.order_number} ·{' '}
                <strong>Aberta em:</strong>{' '}
                {new Date(editingOrder.opened_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          )}

          <div className="asset-form-grid">
            <label className="field work-order-title-field">
              <span>Título *</span>
              <input
                required
                minLength={3}
                maxLength={180}
                value={form.title}
                placeholder="Ex.: Troca de garras do robô de solda"
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </label>

            <label className="field">
              <span>Tipo</span>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as WorkOrderType })
                }
              >
                {(Object.keys(typeLabels) as WorkOrderType[]).map((type) => (
                  <option key={type} value={type}>
                    {typeLabels[type]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Prioridade</span>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm({
                    ...form,
                    priority: event.target.value as WorkOrderPriority,
                  })
                }
              >
                {(Object.keys(priorityLabels) as WorkOrderPriority[]).map(
                  (priority) => (
                    <option key={priority} value={priority}>
                      {priorityLabels[priority]}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="field">
              <span>Unidade *</span>
              <select
                required
                value={form.unit_id}
                onChange={(event) => handleUnitChange(event.target.value)}
              >
                <option value="">Selecione</option>
                {availableUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Centro de custo *</span>
              <select
                required
                value={form.cost_center_id}
                onChange={(event) =>
                  setForm({ ...form, cost_center_id: event.target.value })
                }
              >
                <option value="">Selecione</option>
                {unitCostCenters.map((costCenter) => (
                  <option key={costCenter.id} value={costCenter.id}>
                    {costCenter.code} — {costCenter.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Ativo</span>
              <select
                value={form.asset_id}
                onChange={(event) =>
                  setForm({ ...form, asset_id: event.target.value })
                }
              >
                <option value="">Sem ativo vinculado</option>
                {availableAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} ({asset.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Responsável</span>
              <select
                value={form.assigned_to}
                onChange={(event) =>
                  setForm({ ...form, assigned_to: event.target.value })
                }
              >
                <option value="">Não atribuído</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name ?? 'Usuário'}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Data programada</span>
              <input
                type="datetime-local"
                value={form.scheduled_for}
                onChange={(event) =>
                  setForm({ ...form, scheduled_for: event.target.value })
                }
              />
            </label>

            {editingOrder && (
              <label className="field">
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      status: event.target.value as WorkOrderStatus,
                    })
                  }
                >
                  {(Object.keys(statusLabels) as WorkOrderStatus[]).map(
                    (status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ),
                  )}
                </select>
              </label>
            )}

            <label className="field work-order-desc-field">
              <span>Descrição</span>
              <textarea
                rows={4}
                value={form.description}
                placeholder="Detalhes da intervenção, causa, solução..."
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={isSaving} className="button-with-icon">
              {isSaving
                ? 'Salvando...'
                : editingOrder
                  ? 'Salvar alterações'
                  : 'Cadastrar OS'}
            </button>

            <button
              type="button"
              className="secondary"
              onClick={() => setIsFormOpen(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <article className="panel table">
        <div className="table-head work-order-table-head">
          <span>ORDEM</span>
          <span>ATIVO / UNIDADE</span>
          <span>TIPO</span>
          <span>PRIORIDADE</span>
          <span>RESPONSÁVEL</span>
          <span>STATUS</span>
          {isTenantAdmin && <span>AÇÕES</span>}
        </div>

        {isLoading && <div className="empty-state">Carregando ordens de serviço...</div>}

        {!isLoading && filteredOrders.length === 0 && (
          <div className="empty-state">
            {statusFilter !== 'all'
              ? `Nenhuma ordem com status "${statusLabels[statusFilter]}".`
              : 'Nenhuma ordem de serviço cadastrada para este cliente.'}
          </div>
        )}

        {!isLoading &&
          filteredOrders.map((order) => (
            <div className="table-row work-order-table-row" key={order.id}>
              <div>
                <strong>
                  #{order.order_number} · {order.title}
                </strong>
                <small>
                  {order.opened_by_name
                    ? `Aberta por ${order.opened_by_name}`
                    : 'Origem não informada'}
                </small>
              </div>

              <div>
                <span>{order.asset_name ?? 'Sem ativo'}</span>
                <small>{order.unit_name}</small>
              </div>

              <span>{typeLabels[order.type]}</span>

              <span>
                <span className={`badge work-order-priority-${order.priority}`}>
                  {priorityLabels[order.priority]}
                </span>
              </span>

              <span>{order.assigned_name ?? 'Não atribuído'}</span>

              <span>
                <span className={`badge work-order-status-${order.status}`}>
                  {statusLabels[order.status]}
                </span>

                {order.scheduled_for && (
                  <small className="work-order-scheduled">
                    Prog.: {new Date(order.scheduled_for).toLocaleDateString('pt-BR')}
                  </small>
                )}
              </span>

              {isTenantAdmin && (
                <span className="asset-actions">
                  <button
                    className="secondary icon-action"
                    disabled={isSaving}
                    title="Editar OS"
                    aria-label={`Editar OS #${order.order_number}`}
                    onClick={() => openEditOrder(order)}
                  >
                    <Pencil size={18} />
                  </button>
<button
  className="secondary icon-action"
  disabled={isSaving}
  title="Solicitar compra ou material"
  aria-label={`Criar requisição de compra para OS #${order.order_number}`}
  onClick={() => setPurchaseOrder(order)}
>
  <PackagePlus size={18} />
</button>
                  {getStatusNextOptions(order.status).map((nextStatus) => (
                    <button
                      key={nextStatus}
                      className={`secondary icon-action work-order-status-action`}
                      disabled={isSaving}
                      title={`Marcar como ${statusLabels[nextStatus]}`}
                      aria-label={`Marcar OS #${order.order_number} como ${statusLabels[nextStatus]}`}
                      onClick={() => void changeStatus(order, nextStatus)}
                    >
                      {nextStatus === 'completed' ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <ClipboardList size={18} />
                      )}
                    </button>
                  ))}
                </span>
              )}
            </div>
          ))}
      </article>
    </div>
  );
}