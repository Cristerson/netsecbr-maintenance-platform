import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { supabase } from './supabase';

type Props = {
  tenantId: string;
  currentUserId: string;
  isTenantAdmin: boolean;
  canCreate: boolean;
};

type ServiceRequestStatus = 'open' | 'triaged' | 'converted_to_wo' | 'cancelled';
type ServiceRequestPriority = 'low' | 'medium' | 'high' | 'critical';

type ServiceRequest = {
  id: string;
  request_number: number;
  tenant_id: string;
  unit_id: string;
  cost_center_id: string;
  asset_id: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: ServiceRequestPriority;
  status: ServiceRequestStatus;
  requested_by: string;
  requested_at: string;
  converted_to_work_order_id: string | null;
};

type ServiceRequestRow = ServiceRequest & {
  asset_name: string | null;
  unit_name: string;
  cost_center_name: string;
  requested_by_name: string | null;
  converted_wo_number: number | null;
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

const statusLabels: Record<ServiceRequestStatus, string> = {
  open: 'Aberta',
  triaged: 'Em triagem',
  converted_to_wo: 'Convertida em OS',
  cancelled: 'Cancelada',
};

const priorityLabels: Record<ServiceRequestPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

const emptyForm = {
  title: '',
  description: '',
  category: 'geral',
  priority: 'medium' as ServiceRequestPriority,
  unit_id: '',
  cost_center_id: '',
  asset_id: '',
};

export function ServiceRequestAdmin({
  tenantId,
  currentUserId,
  isTenantAdmin,
  canCreate,
}: Props) {
  const [requests, setRequests] = useState<ServiceRequestRow[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | ServiceRequestStatus>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ServiceRequest | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    const { data: requestsData, error: requestsError } = await supabase
      .from('service_requests')
      .select(
        `id, request_number, tenant_id, unit_id, cost_center_id, asset_id, title, description, category, priority, status, requested_by, requested_at, converted_to_work_order_id,
        assets(name),
        units(name),
        cost_centers(name),
        requested_profile:profiles!service_requests_requested_by_fkey(full_name),
        converted_wo:work_orders!service_requests_converted_to_work_order_id_fkey(order_number)`,
      )
      .eq('tenant_id', tenantId)
      .order('requested_at', { ascending: false })
      .limit(200);

    if (requestsError) {
      setErrorMessage(`Não foi possível carregar as solicitações: ${requestsError.message}`);
      setIsLoading(false);
      return;
    }

    const [{ data: unitData, error: unitError }, { data: costCenterData, error: costCenterError }, { data: assetData, error: assetError }] =
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
      ]);

    if (unitError || costCenterError || assetError) {
      setErrorMessage(
        `Não foi possível carregar os dados de apoio: ${
          unitError?.message ?? costCenterError?.message ?? assetError?.message
        }`,
      );
      setIsLoading(false);
      return;
    }

    setUnits((unitData ?? []) as Unit[]);
    setCostCenters((costCenterData ?? []) as CostCenter[]);
    setAssets((assetData ?? []) as Asset[]);

    setRequests(
      (requestsData ?? []).map((request: any) => ({
        ...request,
        asset_name: request.assets?.name ?? null,
        unit_name: request.units?.name ?? '—',
        cost_center_name: request.cost_centers?.name ?? '—',
        requested_by_name: request.requested_profile?.full_name ?? null,
        converted_wo_number: request.converted_wo?.order_number ?? null,
      })),
    );
    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRequests = requests.filter((request) =>
    statusFilter === 'all' ? true : request.status === statusFilter,
  );

  const availableUnits = units.filter(
    (unit) => unit.is_active || unit.id === editingRequest?.unit_id,
  );

  const availableCostCenters = costCenters.filter(
    (costCenter) =>
      costCenter.is_active || costCenter.id === editingRequest?.cost_center_id,
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
      asset.id === editingRequest?.asset_id,
  );

  function openNewRequest() {
    setMessage('');
    setErrorMessage('');
    setEditingRequest(null);
    setForm({
      ...emptyForm,
      unit_id: availableUnits[0]?.id ?? '',
      cost_center_id: availableUnits[0]?.cost_center_id ?? availableCostCenters[0]?.id ?? '',
    });
    setIsFormOpen(true);
  }

  function openEditRequest(request: ServiceRequest) {
    setMessage('');
    setErrorMessage('');
    setEditingRequest(request);
    setForm({
      title: request.title,
      description: request.description ?? '',
      category: request.category,
      priority: request.priority,
      unit_id: request.unit_id,
      cost_center_id: request.cost_center_id,
      asset_id: request.asset_id ?? '',
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

  async function saveRequest(event: FormEvent<HTMLFormElement>) {
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
      category: form.category,
      priority: form.priority,
      unit_id: form.unit_id,
      cost_center_id: form.cost_center_id,
      asset_id: form.asset_id || null,
    };

    if (editingRequest) {
      const { error } = await supabase
        .from('service_requests')
        .update(payload)
        .eq('id', editingRequest.id);

      if (error) {
        setErrorMessage(`Não foi possível atualizar a solicitação: ${error.message}`);
      } else {
        setMessage('Solicitação atualizada com sucesso.');
        setIsFormOpen(false);
        await loadData();
      }
    } else {
      const { error } = await supabase.from('service_requests').insert({
        ...payload,
        tenant_id: tenantId,
        requested_by: currentUserId,
      });

      if (error) {
        setErrorMessage(`Não foi possível abrir a solicitação: ${error.message}`);
      } else {
        setMessage('Solicitação aberta com sucesso.');
        setIsFormOpen(false);
        await loadData();
      }
    }

    setIsSaving(false);
  }

  function getNextTransitions(status: ServiceRequestStatus): {
    status: ServiceRequestStatus;
    label: string;
  }[] {
    switch (status) {
      case 'open':
        return [
          { status: 'triaged', label: 'Triagem' },
          { status: 'cancelled', label: 'Cancelar' },
        ];
      case 'triaged':
        return [
          { status: 'open', label: 'Reabrir' },
          { status: 'cancelled', label: 'Cancelar' },
        ];
      case 'cancelled':
        return [{ status: 'open', label: 'Reabrir' }];
      default:
        return [];
    }
  }

  async function changeStatus(request: ServiceRequestRow, nextStatus: ServiceRequestStatus) {
    if (!isTenantAdmin) return;

    const action = statusLabels[nextStatus];

    if (!window.confirm(`Deseja marcar a solicitação #${request.request_number} como "${action}"?`)) return;

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('service_requests')
      .update({ status: nextStatus })
      .eq('id', request.id);

    if (error) {
      setErrorMessage(`Não foi possível atualizar o status: ${error.message}`);
    } else {
      setMessage(`Solicitação #${request.request_number} marcada como "${action}".`);
      await loadData();
    }

    setIsSaving(false);
  }

  async function convertToWorkOrder(request: ServiceRequestRow) {
    if (!isTenantAdmin) return;

    if (
      !window.confirm(
        `Converter a solicitação #${request.request_number} em ordem de serviço? A OS usará o título, descrição, ativo, unidade e centro de custo da solicitação.`,
      )
    ) {
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const { data: newOrder, error: orderError } = await supabase
      .from('work_orders')
      .insert({
        tenant_id: tenantId,
        unit_id: request.unit_id,
        cost_center_id: request.cost_center_id,
        asset_id: request.asset_id,
        title: request.title,
        description: request.description,
        type: 'corrective',
        priority: request.priority,
        status: 'open',
        opened_by: currentUserId,
      })
      .select('id, order_number')
      .single();

    if (orderError || !newOrder) {
      setErrorMessage(`Não foi possível criar a ordem de serviço: ${orderError?.message ?? 'Erro desconhecido'}`);
      setIsSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('service_requests')
      .update({
        status: 'converted_to_wo',
        converted_to_work_order_id: newOrder.id,
      })
      .eq('id', request.id);

    if (updateError) {
      setErrorMessage(`A OS #${newOrder.order_number} foi criada, mas não foi possível atualizar a solicitação: ${updateError.message}`);
    } else {
      setMessage(`Solicitação #${request.request_number} convertida na OS #${newOrder.order_number}.`);
    }

    setIsSaving(false);
    await loadData();
  }

  return (
    <div>
      <div className="user-admin-actions">
        <div className="asset-search">
          <select
            className="status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as 'all' | ServiceRequestStatus)
            }
          >
            <option value="all">Todos os status</option>
            {(Object.keys(statusLabels) as ServiceRequestStatus[]).map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </div>

        {canCreate && (
          <button
            className="button-with-icon"
            onClick={openNewRequest}
            disabled={isSaving || isLoading}
            title="Nova solicitação de manutenção"
          >
            <Plus size={17} />
            Nova solicitação
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
        <form className="new-user-form panel" onSubmit={saveRequest}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">SOLICITAÇÃO DE MANUTENÇÃO</p>
              <h2>
                {editingRequest
                  ? `Editar solicitação #${editingRequest.request_number}`
                  : 'Nova solicitação'}
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

          {editingRequest && (
            <div className="order-summary">
              <p>
                <strong>Número:</strong> #{editingRequest.request_number} ·{' '}
                <strong>Solicitada em:</strong>{' '}
                {new Date(editingRequest.requested_at).toLocaleDateString('pt-BR')}
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
                placeholder="Ex.: Parafuso solto na base do robô 02"
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </label>

            <label className="field">
              <span>Categoria</span>
              <select
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
              >
                <option value="geral">Geral</option>
                <option value="mecanica">Mecânica</option>
                <option value="eletrica">Elétrica</option>
                <option value="eletronica">Eletrônica</option>
                <option value="hidraulica">Hidráulica</option>
                <option value="pneumatica">Pneumática</option>
                <option value="software">Software / Controlador</option>
                <option value="civil">Civil / Infraestrutura</option>
              </select>
            </label>

            <label className="field">
              <span>Prioridade</span>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm({
                    ...form,
                    priority: event.target.value as ServiceRequestPriority,
                  })
                }
              >
                {(Object.keys(priorityLabels) as ServiceRequestPriority[]).map(
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

            <label className="field work-order-desc-field">
              <span>Descrição</span>
              <textarea
                rows={4}
                value={form.description}
                placeholder="Descreva o problema, o que foi observado, frequência..."
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
                : editingRequest
                  ? 'Salvar alterações'
                  : 'Abrir solicitação'}
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
        <div className="table-head request-table-head">
          <span>SOLICITAÇÃO</span>
          <span>ATIVO / UNIDADE</span>
          <span>CATEGORIA</span>
          <span>PRIORIDADE</span>
          <span>STATUS</span>
          {isTenantAdmin && <span>AÇÕES</span>}
        </div>

        {isLoading && <div className="empty-state">Carregando solicitações...</div>}

        {!isLoading && filteredRequests.length === 0 && (
          <div className="empty-state">
            {statusFilter !== 'all'
              ? `Nenhuma solicitação com status "${statusLabels[statusFilter]}".`
              : 'Nenhuma solicitação de manutenção para este cliente.'}
          </div>
        )}

        {!isLoading &&
          filteredRequests.map((request) => (
            <div className="table-row request-table-row" key={request.id}>
              <div>
                <strong>
                  #{request.request_number} · {request.title}
                </strong>
                <small>
                  {request.requested_by_name
                    ? `Solicitada por ${request.requested_by_name}`
                    : 'Solicitante não informado'}
                </small>
                {request.description && (
                  <small className="request-description">{request.description}</small>
                )}
              </div>

              <div>
                <span>{request.asset_name ?? 'Sem ativo'}</span>
                <small>{request.unit_name}</small>
              </div>

              <span className="request-category">{request.category}</span>

              <span>
                <span className={`badge request-priority-${request.priority}`}>
                  {priorityLabels[request.priority]}
                </span>
              </span>

              <span>
                <span className={`badge request-status-${request.status}`}>
                  {statusLabels[request.status]}
                </span>

                {request.converted_wo_number && (
                  <small className="request-converted">
                    OS #{request.converted_wo_number}
                  </small>
                )}
              </span>

              {isTenantAdmin && (
                <span className="asset-actions">
                  {request.status !== 'converted_to_wo' && (
                    <button
                      className="secondary icon-action"
                      disabled={isSaving}
                      title="Editar solicitação"
                      aria-label={`Editar solicitação #${request.request_number}`}
                      onClick={() => openEditRequest(request)}
                    >
                      <Pencil size={18} />
                    </button>
                  )}

                  {request.status === 'open' || request.status === 'triaged' ? (
                    <button
                      className="secondary icon-action request-convert-action"
                      disabled={isSaving}
                      title="Converter em ordem de serviço"
                      aria-label={`Converter solicitação #${request.request_number} em OS`}
                      onClick={() => void convertToWorkOrder(request)}
                    >
                      <ArrowRight size={18} />
                    </button>
                  ) : null}

                  {getNextTransitions(request.status).map((transition) => (
                    <button
                      key={transition.status}
                      className={`secondary icon-action request-status-action ${transition.status === 'cancelled' ? 'request-cancel-action' : ''}`}
                      disabled={isSaving}
                      title={`${transition.label}`}
                      aria-label={`Marcar solicitação #${request.request_number} como ${statusLabels[transition.status]}`}
                      onClick={() => void changeStatus(request, transition.status)}
                    >
                      {transition.status === 'cancelled' ? (
                        <X size={18} />
                      ) : (
                        <CheckCircle2 size={18} />
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