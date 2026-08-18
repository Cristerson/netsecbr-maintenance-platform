import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  PackageCheck,
  RefreshCw,
  Send,
  ShoppingCart,
} from 'lucide-react';
import { supabase } from './supabase';

type Props = {
  tenantId: string;
  currentUserId: string;
  canManage: boolean;
};

type RequestStatus =
  | 'pending_approval'
  | 'approved'
  | 'sent_to_supplier'
  | 'received'
  | 'cancelled';

type PurchaseRequest = {
  id: string;
  request_number: number;
  work_order_id: string;
  suggested_supplier_id: string | null;
  status: RequestStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requested_at: string;
};

type WorkOrder = {
  id: string;
  order_number: number;
  title: string;
};

type Supplier = {
  id: string;
  legal_name: string;
  trade_name: string | null;
};

const statusLabels: Record<RequestStatus, string> = {
  pending_approval: 'Aguardando aprovação',
  approved: 'Aprovada',
  sent_to_supplier: 'Enviada ao fornecedor',
  received: 'Recebida',
  cancelled: 'Cancelada',
};

const priorityLabels = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

export function PurchaseManagement({
  tenantId,
  currentUserId,
  canManage,
}: Props) {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [itemCountByRequest, setItemCountByRequest] = useState<Map<string, number>>(
    new Map(),
  );
  const [statusFilter, setStatusFilter] = useState<'all' | RequestStatus>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    const { data: requestData, error: requestError } = await supabase
      .from('purchase_requests')
      .select(
        'id, request_number, work_order_id, suggested_supplier_id, status, priority, requested_at',
      )
      .eq('tenant_id', tenantId)
      .order('requested_at', { ascending: false });

    if (requestError) {
      setErrorMessage(
        `Não foi possível carregar as requisições: ${requestError.message}`,
      );
      setIsLoading(false);
      return;
    }

    const loadedRequests = (requestData ?? []) as PurchaseRequest[];
    const orderIds = loadedRequests.map((request) => request.work_order_id);
    const supplierIds = loadedRequests
      .map((request) => request.suggested_supplier_id)
      .filter((id): id is string => Boolean(id));

    const [ordersResult, suppliersResult, itemsResult] = await Promise.all([
      orderIds.length
        ? supabase
            .from('work_orders')
            .select('id, order_number, title')
            .in('id', orderIds)
        : Promise.resolve({ data: [], error: null }),
      supplierIds.length
        ? supabase
            .from('suppliers')
            .select('id, legal_name, trade_name')
            .in('id', supplierIds)
        : Promise.resolve({ data: [], error: null }),
      loadedRequests.length
        ? supabase
            .from('purchase_request_items')
            .select('purchase_request_id')
            .in(
              'purchase_request_id',
              loadedRequests.map((request) => request.id),
            )
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (ordersResult.error || suppliersResult.error || itemsResult.error) {
      setErrorMessage(
        `Não foi possível carregar os detalhes das requisições: ${
          ordersResult.error?.message ??
          suppliersResult.error?.message ??
          itemsResult.error?.message
        }`,
      );
      setIsLoading(false);
      return;
    }

    const countByRequest = new Map<string, number>();

    for (const item of itemsResult.data ?? []) {
      countByRequest.set(
        item.purchase_request_id,
        (countByRequest.get(item.purchase_request_id) ?? 0) + 1,
      );
    }

    setRequests(loadedRequests);
    setOrders((ordersResult.data ?? []) as WorkOrder[]);
    setSuppliers((suppliersResult.data ?? []) as Supplier[]);
    setItemCountByRequest(countByRequest);
    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function changeStatus(
    request: PurchaseRequest,
    nextStatus: RequestStatus,
  ) {
    if (
      !window.confirm(
        `Deseja marcar a requisição #${request.request_number} como "${statusLabels[nextStatus]}"?`,
      )
    ) {
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const payload =
      nextStatus === 'approved'
        ? {
            status: nextStatus,
            approved_by: currentUserId,
            approved_at: new Date().toISOString(),
          }
        : nextStatus === 'sent_to_supplier'
          ? {
              status: nextStatus,
              sent_to_supplier_at: new Date().toISOString(),
            }
          : nextStatus === 'received'
            ? {
                status: nextStatus,
                received_at: new Date().toISOString(),
              }
            : { status: nextStatus };

    const { error } = await supabase
      .from('purchase_requests')
      .update(payload)
      .eq('id', request.id);

    if (error) {
      setErrorMessage(`Não foi possível atualizar a requisição: ${error.message}`);
    } else {
      setMessage(
        `Requisição #${request.request_number} atualizada para "${statusLabels[nextStatus]}".`,
      );
      await loadData();
    }

    setIsSaving(false);
  }

  function getOrder(request: PurchaseRequest) {
    return orders.find((order) => order.id === request.work_order_id);
  }

  function getSupplierName(request: PurchaseRequest) {
    if (!request.suggested_supplier_id) return 'Não definido';

    const supplier = suppliers.find(
      (item) => item.id === request.suggested_supplier_id,
    );

    return supplier
      ? supplier.trade_name || supplier.legal_name
      : 'Não encontrado';
  }

  function getNextAction(status: RequestStatus) {
    if (status === 'pending_approval') {
      return {
        label: 'Aprovar requisição',
        icon: <CheckCircle2 size={18} />,
        nextStatus: 'approved' as RequestStatus,
      };
    }

    if (status === 'approved') {
      return {
        label: 'Marcar como enviada ao fornecedor',
        icon: <Send size={18} />,
        nextStatus: 'sent_to_supplier' as RequestStatus,
      };
    }

    if (status === 'sent_to_supplier') {
      return {
        label: 'Registrar recebimento',
        icon: <PackageCheck size={18} />,
        nextStatus: 'received' as RequestStatus,
      };
    }

    return null;
  }

  const filteredRequests = requests.filter((request) =>
    statusFilter === 'all' ? true : request.status === statusFilter,
  );

  return (
    <div>
      <div className="user-admin-actions">
        <div>
          <p className="eyebrow">COMPRAS E MATERIAIS</p>
          <h2>Requisições de compra</h2>
        </div>

        <div className="asset-actions">
          <select
            className="status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as 'all' | RequestStatus)
            }
          >
            <option value="all">Todos os status</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <button
            className="secondary icon-action"
            title="Atualizar lista"
            aria-label="Atualizar lista"
            disabled={isLoading || isSaving}
            onClick={() => void loadData()}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {message && <p className="success-message">{message}</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <article className="panel table">
        <div className="table-head">
          <span>REQUISIÇÃO</span>
          <span>ORDEM DE SERVIÇO</span>
          <span>FORNECEDOR</span>
          <span>ITENS</span>
          <span>STATUS</span>
          {canManage && <span>AÇÕES</span>}
        </div>

        {isLoading && (
          <div className="empty-state">Carregando requisições...</div>
        )}

        {!isLoading && filteredRequests.length === 0 && (
          <div className="empty-state">
            Nenhuma requisição encontrada para este filtro.
          </div>
        )}

        {!isLoading &&
          filteredRequests.map((request) => {
            const order = getOrder(request);
            const nextAction = getNextAction(request.status);

            return (
              <div className="table-row" key={request.id}>
                <div>
                  <strong>#{request.request_number}</strong>
                  <small>
                    {new Date(request.requested_at).toLocaleDateString('pt-BR')}
                  </small>
                </div>

                <div>
                  <strong>
                    {order ? `OS #${order.order_number}` : 'OS não encontrada'}
                  </strong>
                  <small>{order?.title ?? '—'}</small>
                </div>

                <span>{getSupplierName(request)}</span>

                <span>{itemCountByRequest.get(request.id) ?? 0} item(ns)</span>

                <span>
                  <span className={`badge work-order-status-${request.status}`}>
                    {statusLabels[request.status]}
                  </span>
                </span>

                {canManage && (
                  <span className="asset-actions">
                    {nextAction && (
                      <button
                        className="secondary icon-action"
                        disabled={isSaving}
                        title={nextAction.label}
                        aria-label={`${nextAction.label} para requisição #${request.request_number}`}
                        onClick={() =>
                          void changeStatus(request, nextAction.nextStatus)
                        }
                      >
                        {nextAction.icon}
                      </button>
                    )}

                    {!nextAction && (
                      <ShoppingCart size={18} aria-label="Fluxo concluído" />
                    )}
                  </span>
                )}
              </div>
            );
          })}
      </article>
    </div>
  );
}
