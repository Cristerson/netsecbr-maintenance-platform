import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
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
  triage_notes: string | null;
  estimated_service_cost_cents: number | null;
  estimated_material_cost_cents: number | null;
  estimated_total_cost_cents: number;
  triaged_at: string | null;
  triaged_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
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

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const emptyForm = {
  title: '',
  description: '',
  category: 'geral',
  priority: 'medium' as ServiceRequestPriority,
  unit_id: '',
  cost_center_id: '',
  asset_id: '',
  status: 'open' as ServiceRequestStatus,
  triage_notes: '',
  estimated_service_cost: '',
  estimated_material_cost: '',
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
  const isDetailView = isFormOpen && editingRequest !== null;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    const { data: requestsData, error: requestsError } = await supabase
      .from('service_requests')
      .select(
        `id, request_number, tenant_id, unit_id, cost_center_id, asset_id, title, description, category, priority, status, requested_by, requested_at, converted_to_work_order_id, triage_notes, estimated_service_cost_cents, estimated_material_cost_cents, estimated_total_cost_cents, triaged_at, triaged_by, approved_at, approved_by,
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

  const estimatedTotal =
    (Number.isFinite(Number(form.estimated_service_cost))
      ? Number(form.estimated_service_cost)
      : 0) +
    (Number.isFinite(Number(form.estimated_material_cost))
      ? Number(form.estimated_material_cost)
      : 0);

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
      status: request.status,
      triage_notes: request.triage_notes ?? '',
      estimated_service_cost:
        request.estimated_service_cost_cents === null
          ? ''
          : (request.estimated_service_cost_cents / 100).toFixed(2),
      estimated_material_cost:
        request.estimated_material_cost_cents === null
          ? ''
          : (request.estimated_material_cost_cents / 100).toFixed(2),
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

    if (
      (form.estimated_service_cost !== '' &&
        (!Number.isFinite(Number(form.estimated_service_cost)) ||
          Number(form.estimated_service_cost) < 0)) ||
      (form.estimated_material_cost !== '' &&
        (!Number.isFinite(Number(form.estimated_material_cost)) ||
          Number(form.estimated_material_cost) < 0))
    ) {
      setErrorMessage('Informe valores validos para servicos e materiais estimados.');
      return;
    }

    if (editingRequest && form.status === 'triaged' && !form.triage_notes.trim()) {
      setErrorMessage('Informe a triagem do supervisor antes de encaminhar a solicitacao.');
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
      ...(editingRequest ? { status: form.status } : {}),
      triage_notes: form.triage_notes.trim() || null,
      estimated_service_cost_cents:
        form.estimated_service_cost === ''
          ? null
          : Math.round(Number(form.estimated_service_cost) * 100),
      estimated_material_cost_cents:
        form.estimated_material_cost === ''
          ? null
          : Math.round(Number(form.estimated_material_cost) * 100),
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

  async function convertToWorkOrder(request: ServiceRequest) {
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

    const { data, error } = await supabase.rpc(
      'approve_service_request_and_create_work_order',
      { target_request_id: request.id },
    );

    const rpcOrder = data?.[0];
    const newOrder = rpcOrder
      ? { id: rpcOrder.work_order_id, order_number: rpcOrder.order_number }
      : null;
    const orderError = error;

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
      {!isDetailView && <div className="user-admin-actions">
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
      </div>}

      {message && (
        <div className="operation-toast operation-toast-success" role="status">
          <span>{message}</span>
          <button
            type="button"
            aria-label="Fechar mensagem"
            title="Fechar"
            onClick={() => setMessage('')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="operation-toast operation-toast-error" role="alert">
          <span>{errorMessage}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            title="Fechar"
            onClick={() => setErrorMessage('')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {isFormOpen && (
        <form className="new-user-form panel" onSubmit={saveRequest}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">SOLICITAÇÃO DE MANUTENÇÃO</p>
              <h2>
                {editingRequest
                  ? `Solicitação #${editingRequest.request_number}`
                  : 'Nova solicitação'}
              </h2>
            </div>

            <button
              type="button"
              className="secondary"
              title={editingRequest ? 'Voltar para solicitações' : 'Cancelar'}
              aria-label={editingRequest ? 'Voltar para solicitações' : 'Cancelar'}
              onClick={() => setIsFormOpen(false)}
            >
              {editingRequest ? 'Voltar para solicitações' : <X size={18} />}
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
            {editingRequest && isTenantAdmin && editingRequest.status !== 'converted_to_wo' && (
              <section className="work-order-costs work-order-desc-field">
                <div>
                  <p className="eyebrow">TRIAGEM DO SUPERVISOR</p>
                  <h3>Aprovação e estimativa</h3>
                  <p>Registre a análise e a estimativa antes de aprovar a geração da OS.</p>
                </div>

                <div className="work-order-costs-grid">
                  <label className="field">
                    <span>Status da solicitação</span>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          status: event.target.value as ServiceRequestStatus,
                        })
                      }
                    >
                      <option value="open">Aberta</option>
                      <option value="triaged">Encaminhar para aprovação</option>
                      <option value="cancelled">Cancelar solicitação</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Serviços estimados (R$)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={form.estimated_service_cost}
                      placeholder="0,00"
                      onChange={(event) =>
                        setForm({ ...form, estimated_service_cost: event.target.value })
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Materiais estimados (R$)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={form.estimated_material_cost}
                      placeholder="0,00"
                      onChange={(event) =>
                        setForm({ ...form, estimated_material_cost: event.target.value })
                      }
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Triagem do supervisor *</span>
                  <textarea
                    rows={3}
                    value={form.triage_notes}
                    placeholder="Avaliação inicial, impacto e justificativa para execução."
                    onChange={(event) =>
                      setForm({ ...form, triage_notes: event.target.value })
                    }
                  />
                </label>

                <strong className="work-order-cost-total">
                  Total estimado: {currencyFormatter.format(estimatedTotal)}
                </strong>
              </section>
            )}
          </div>

          <div className="form-actions">
            {editingRequest && isTenantAdmin && editingRequest.status === 'triaged' && (
              <button
                type="button"
                className="secondary button-with-icon"
                disabled={isSaving}
                onClick={() => void convertToWorkOrder(editingRequest)}
              >
                <ArrowRight size={17} />
                Aprovar e criar OS
              </button>
            )}
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

      {!isDetailView && <article className="panel table">
        <div className="table-head request-table-head">
          <span>SOLICITAÇÃO</span>
          <span>ATIVO / UNIDADE</span>
          <span>CATEGORIA</span>
          <span>PRIORIDADE</span>
          <span>STATUS</span>
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
                <button
                  type="button"
                  className="work-order-link"
                  onClick={() => openEditRequest(request)}
                >
                  #{request.request_number} · {request.title}
                </button>
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

            </div>
          ))}
      </article>}
    </div>
  );
}
