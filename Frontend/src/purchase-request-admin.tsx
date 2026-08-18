import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ExternalLink,
  PackagePlus,
  Plus,
  RefreshCw,
  Trash2,
  X,
  
} from 'lucide-react';
import { supabase } from './supabase';

type Props = {
  tenantId: string;
  currentUserId: string;
  order: {
    id: string;
    order_number: number;
    title: string;
    unit_id: string;
    cost_center_id: string;
    asset_id: string | null;
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
  onClose: () => void;
  onSaved: () => void;
};

type Supplier = {
  id: string;
  legal_name: string;
  trade_name: string | null;
};

type PurchaseRequest = {
  id: string;
  request_number: number;
  status: 'pending_approval' | 'approved' | 'sent_to_supplier' | 'received' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  suggested_supplier_id: string | null;
  notes: string | null;
  requested_at: string;
};

type ItemDraft = {
  id: string;
  description: string;
  quantity: string;
  unit_of_measure: string;
  estimated_unit_cost: string;
};

const statusLabels = {
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
const manufacturerCatalogs = {
  ABB: 'https://one.robotics.abb.com/',
  KUKA: 'https://my.kuka.com/',
  FANUC: 'https://www.fanuc.com/service/',
  Yaskawa: 'https://www.yaskawa.com/spareparts/index',
};

function createEmptyItem(): ItemDraft {
  return {
    id: crypto.randomUUID(),
    description: '',
    quantity: '1',
    unit_of_measure: 'un',
    estimated_unit_cost: '',
  };
}

export function PurchaseRequestAdmin({
  tenantId,
  currentUserId,
  order,
  onClose,
  onSaved,
}: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [manufacturerCatalog, setManufacturerCatalog] = useState('');
  const selectedManufacturerUrl = manufacturerCatalog
    ? manufacturerCatalogs[
        manufacturerCatalog as keyof typeof manufacturerCatalogs
      ]
    : null;

  function openManufacturerCatalog() {
    if (!selectedManufacturerUrl) return;

    const catalogWindow = window.open(
      selectedManufacturerUrl,
      'netsecbr_manufacturer_catalog',
      'popup=yes,width=1280,height=900,noopener,noreferrer',
    );

    if (!catalogWindow) {
      setErrorMessage(
        'O navegador bloqueou a janela do fabricante. Libere pop-ups para localhost e tente novamente.',
      );
    }
  }
  const [priority, setPriority] = useState(order.priority);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([createEmptyItem()]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    const [{ data: supplierData, error: supplierError }, { data: requestData, error: requestError }] =
      await Promise.all([
        supabase
          .from('suppliers')
          .select('id, legal_name, trade_name')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('legal_name'),
        supabase
          .from('purchase_requests')
          .select('id, request_number, status, priority, suggested_supplier_id, notes, requested_at')
          .eq('work_order_id', order.id)
          .order('requested_at', { ascending: false }),
      ]);

    if (supplierError || requestError) {
      setErrorMessage(
        `Não foi possível carregar as requisições: ${
          supplierError?.message ?? requestError?.message
        }`,
      );
      setIsLoading(false);
      return;
    }

    setSuppliers((supplierData ?? []) as Supplier[]);
    setRequests((requestData ?? []) as PurchaseRequest[]);
    setIsLoading(false);
  }, [tenantId, order.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function updateItem(id: string, field: keyof ItemDraft, value: string) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  }

  function removeItem(id: string) {
    if (items.length === 1) {
      setErrorMessage('A requisição precisa ter pelo menos um item.');
      return;
    }

    setItems((current) => current.filter((item) => item.id !== id));
  }
  

  async function saveRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');

    const invalidItem = items.find(
      (item) =>
        item.description.trim().length < 3 ||
        Number(item.quantity) <= 0 ||
        Number.isNaN(Number(item.quantity)),
    );

    if (invalidItem) {
      setErrorMessage(
        'Informe a descrição e uma quantidade válida para todos os itens.',
      );
      return;
    }

    setIsSaving(true);

    const { data: request, error: requestError } = await supabase
      .from('purchase_requests')
      .insert({
        tenant_id: tenantId,
        work_order_id: order.id,
        unit_id: order.unit_id,
        cost_center_id: order.cost_center_id,
        asset_id: order.asset_id,
        suggested_supplier_id: supplierId || null,
        priority,
        notes: notes.trim() || null,
        requested_by: currentUserId,
      })
      .select('id, request_number')
      .single();

    if (requestError || !request) {
      setErrorMessage(
        `Não foi possível criar a requisição: ${
          requestError?.message ?? 'Resposta inválida do banco.'
        }`,
      );
      setIsSaving(false);
      return;
    }

    const itemPayload = items.map((item) => ({
      purchase_request_id: request.id,
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unit_of_measure: item.unit_of_measure.trim() || 'un',
      estimated_unit_cost_cents: item.estimated_unit_cost
        ? Math.round(Number(item.estimated_unit_cost) * 100)
        : null,
    }));

    const { error: itemError } = await supabase
      .from('purchase_request_items')
      .insert(itemPayload);

    if (itemError) {
      setErrorMessage(
        `A requisição #${request.request_number} foi criada, mas os itens não puderam ser incluídos: ${itemError.message}`,
      );
      setIsSaving(false);
      await loadData();
      return;
    }

    setMessage(`Requisição #${request.request_number} criada com sucesso.`);
    setSupplierId('');
    setPriority(order.priority);
    setNotes('');
    setItems([createEmptyItem()]);
    setIsSaving(false);

    await loadData();
    onSaved();
  }

  function getSupplierName(suggestedSupplierId: string | null) {
    if (!suggestedSupplierId) return 'Fornecedor ainda não definido';

    const supplier = suppliers.find((item) => item.id === suggestedSupplierId);

    return supplier
      ? supplier.trade_name || supplier.legal_name
      : 'Fornecedor não encontrado';
  }

  return (
    <div>
      <div className="user-admin-actions">
        <div>
          <p className="eyebrow">COMPRAS E MATERIAIS</p>
          <h2>Requisições da OS #{order.order_number}</h2>
          <p className="authenticated-user">{order.title}</p>
        </div>

        <div className="asset-actions">
          <button
            type="button"
            className="secondary icon-action"
            title="Atualizar lista"
            aria-label="Atualizar lista"
            disabled={isLoading || isSaving}
            onClick={() => void loadData()}
          >
            <RefreshCw size={18} />
          </button>

          <button
            type="button"
            className="secondary icon-action"
            title="Voltar para ordens de serviço"
            aria-label="Voltar para ordens de serviço"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {message && <p className="success-message">{message}</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <form className="new-user-form panel" onSubmit={saveRequest}>
        <div className="panel-head">
          <div>
            <p className="eyebrow">NOVA REQUISIÇÃO</p>
            <h2>Materiais ou serviços necessários</h2>
          </div>

          <PackagePlus size={24} />
        </div>

        <div className="asset-form-grid">
          <label className="field">
            <span>Fornecedor sugerido</span>
            <select
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              <option value="">Definir depois</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.trade_name || supplier.legal_name}
                </option>
              ))}
            </select>
          </label>
<label className="field">
  <span>Consultar fabricante</span>

  <select
    value={manufacturerCatalog}
    onChange={(event) => setManufacturerCatalog(event.target.value)}
  >
    <option value="">Selecione a marca</option>
    {Object.keys(manufacturerCatalogs).map((manufacturer) => (
      <option key={manufacturer} value={manufacturer}>
        {manufacturer}
      </option>
    ))}
  </select>
            <button
              type="button"
              className="secondary button-with-icon"
              disabled={!selectedManufacturerUrl}
              onClick={openManufacturerCatalog}
            >
              <ExternalLink size={17} />
              Abrir catálogo oficial
            </button>
</label>
          <label className="field">
            <span>Prioridade</span>
            <select
              value={priority}
              onChange={(event) =>
                setPriority(
                  event.target.value as 'low' | 'medium' | 'high' | 'critical',
                )
              }
            >
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="field work-order-desc-field">
            <span>Observações</span>
            <textarea
              rows={3}
              value={notes}
              placeholder="Ex.: material necessário para concluir a manutenção..."
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </div>

        <div className="panel-head">
          <div>
            <p className="eyebrow">ITENS DA REQUISIÇÃO</p>
            <h2>Materiais e serviços</h2>
          </div>

          <button
            type="button"
            className="secondary button-with-icon"
            onClick={() => setItems((current) => [...current, createEmptyItem()])}
          >
            <Plus size={17} />
            Adicionar item
          </button>
        </div>

        {items.map((item, index) => (
          <div className="asset-form-grid" key={item.id}>
            <label className="field work-order-title-field">
              <span>Item {index + 1} *</span>
              <input
                required
                minLength={3}
                maxLength={300}
                value={item.description}
                placeholder="Ex.: Correia dentada para esteira"
                onChange={(event) =>
                  updateItem(item.id, 'description', event.target.value)
                }
              />
            </label>

            <label className="field">
              <span>Quantidade *</span>
              <input
                required
                type="number"
                min="0.001"
                step="0.001"
                value={item.quantity}
                onChange={(event) =>
                  updateItem(item.id, 'quantity', event.target.value)
                }
              />
            </label>

            <label className="field">
              <span>Unidade</span>
              <input
                maxLength={20}
                value={item.unit_of_measure}
                placeholder="un, kg, m..."
                onChange={(event) =>
                  updateItem(item.id, 'unit_of_measure', event.target.value)
                }
              />
            </label>

            <label className="field">
              <span>Valor estimado unitário (R$)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.estimated_unit_cost}
                placeholder="0,00"
                onChange={(event) =>
                  updateItem(item.id, 'estimated_unit_cost', event.target.value)
                }
              />
            </label>

            <div className="asset-actions">
              <button
                type="button"
                className="secondary icon-action"
                title="Remover item"
                aria-label={`Remover item ${index + 1}`}
                onClick={() => removeItem(item.id)}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}

        <div className="form-actions">
          <button
            type="submit"
            className="button-with-icon"
            disabled={isSaving || isLoading}
          >
            <PackagePlus size={17} />
            {isSaving ? 'Criando...' : 'Criar requisição'}
          </button>
        </div>
      </form>

      <article className="panel table">
        <div className="table-head">
          <span>REQUISIÇÃO</span>
          <span>FORNECEDOR SUGERIDO</span>
          <span>PRIORIDADE</span>
          <span>STATUS</span>
        </div>

        {isLoading && (
          <div className="empty-state">Carregando requisições...</div>
        )}

        {!isLoading && requests.length === 0 && (
          <div className="empty-state">
            Ainda não há requisições de compra para esta OS.
          </div>
        )}

        {!isLoading &&
          requests.map((request) => (
            <div className="table-row" key={request.id}>
              <div>
                <strong>#{request.request_number}</strong>
                <small>
                  Criada em{' '}
                  {new Date(request.requested_at).toLocaleDateString('pt-BR')}
                </small>
              </div>

              <span>{getSupplierName(request.suggested_supplier_id)}</span>

              <span>
                <span className={`badge work-order-priority-${request.priority}`}>
                  {priorityLabels[request.priority]}
                </span>
              </span>

              <span>{statusLabels[request.status]}</span>
            </div>
          ))}
      </article>
    </div>
  );
}
