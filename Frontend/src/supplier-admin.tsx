import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Power,
  RefreshCw,
  UserPlus,
  X,
} from 'lucide-react';
import { supabase } from './supabase';

type Props = {
  tenantId: string;
};

type Supplier = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  document_number: string | null;
  email: string | null;
  phone: string | null;
  service_category: string | null;
  is_active: boolean;
  notes: string | null;
};

const emptySupplier = {
  legalName: '',
  tradeName: '',
  documentNumber: '',
  email: '',
  phone: '',
  serviceCategory: 'Peças e serviços',
  notes: '',
};
function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function isValidCnpj(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) {
    return false;
  }

  const calculateDigit = (base: string, weights: number[]) => {
    const total = base
      .split('')
      .reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);

    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(
    digits.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  const secondDigit = calculateDigit(
    digits.slice(0, 12) + firstDigit,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  return digits === digits.slice(0, 12) + firstDigit + secondDigit;
}
export function SupplierAdmin({ tenantId }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptySupplier);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadSuppliers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('suppliers')
      .select(
        'id, legal_name, trade_name, document_number, email, phone, service_category, is_active, notes',
      )
      .eq('tenant_id', tenantId)
      .order('legal_name');

    if (error) {
      setErrorMessage(`Não foi possível carregar fornecedores: ${error.message}`);
    } else {
      setSuppliers((data ?? []) as Supplier[]);
    }

    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  async function createSupplier() {
    if (!form.legalName.trim()) {
      setErrorMessage('Informe a razão social ou nome do fornecedor.');
      return;
    }
if (
  form.documentNumber.trim() &&
  !isValidCnpj(form.documentNumber)
) {
  setErrorMessage('Informe um CNPJ válido ou deixe o campo em branco.');
  return;
}
    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase.from('suppliers').insert({
      tenant_id: tenantId,
      legal_name: form.legalName.trim(),
      trade_name: form.tradeName.trim() || null,
      document_number: form.documentNumber.trim() || null,
      email: form.email.trim().toLowerCase() || null,
      phone: form.phone.trim() || null,
      service_category: form.serviceCategory,
      notes: form.notes.trim() || null,
      is_active: true,
    });

    if (error) {
      setErrorMessage(`Não foi possível cadastrar o fornecedor: ${error.message}`);
    } else {
      setMessage('Fornecedor cadastrado com sucesso.');
      setForm(emptySupplier);
      setIsFormOpen(false);
      await loadSuppliers();
    }

    setIsSaving(false);
  }

  async function toggleActive(supplier: Supplier) {
    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('suppliers')
      .update({ is_active: !supplier.is_active })
      .eq('id', supplier.id)
      .eq('tenant_id', tenantId);

    if (error) {
      setErrorMessage(`Não foi possível atualizar o fornecedor: ${error.message}`);
    } else {
      setMessage(
        `Fornecedor ${supplier.is_active ? 'desativado' : 'ativado'} com sucesso.`,
      );
      await loadSuppliers();
    }

    setIsSaving(false);
  }

  return (
    <div>
      <div className="user-admin-actions">
        <button
          className="button-with-icon"
          onClick={() => {
            setMessage('');
            setErrorMessage('');
            setIsFormOpen(true);
          }}
        >
          <UserPlus size={17} />
          Novo fornecedor
        </button>

        <button
          className="secondary button-with-icon"
          onClick={() => void loadSuppliers()}
          disabled={isLoading}
        >
          <RefreshCw size={17} />
          Atualizar lista
        </button>
      </div>

      {message && <p className="success-message">{message}</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {isFormOpen && (
        <section className="new-user-form panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">NOVO FORNECEDOR</p>
              <h2>Cadastro manual</h2>
            </div>

            <button
              className="secondary icon-action"
              title="Cancelar cadastro"
              aria-label="Cancelar cadastro"
              onClick={() => setIsFormOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <label className="field">
            <span>Razão social ou nome completo *</span>
            <input
              value={form.legalName}
              onChange={(event) =>
                setForm({ ...form, legalName: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span>Nome fantasia</span>
            <input
              value={form.tradeName}
              onChange={(event) =>
                setForm({ ...form, tradeName: event.target.value })
              }
            />
          </label>

         <label className="field">
  <span>CNPJ (opcional)</span>
  <input
    inputMode="numeric"
    placeholder="00.000.000/0000-00"
    value={form.documentNumber}
    onChange={(event) =>
      setForm({
        ...form,
        documentNumber: formatCnpj(event.target.value),
      })
    }
  />
</label>

          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span>Telefone</span>
            <input
              value={form.phone}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span>Tipo de fornecimento</span>
            <select
              value={form.serviceCategory}
              onChange={(event) =>
                setForm({ ...form, serviceCategory: event.target.value })
              }
            >
              <option>Peças</option>
              <option>Serviços</option>
              <option>Peças e serviços</option>
            </select>
          </label>

          <label className="field">
            <span>Observações</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </label>

          <div className="form-actions">
            <button
              className="button-with-icon"
              disabled={isSaving}
              onClick={() => void createSupplier()}
            >
              <Building2 size={17} />
              {isSaving ? 'Salvando...' : 'Cadastrar fornecedor'}
            </button>
          </div>
        </section>
      )}

      <div className="table">
        {isLoading && (
          <div className="empty-state">Carregando fornecedores...</div>
        )}

        {!isLoading && suppliers.length === 0 && (
          <div className="empty-state">
            Nenhum fornecedor cadastrado para este cliente.
          </div>
        )}

        {!isLoading &&
          suppliers.map((supplier) => (
           <div className={`table-row ${supplier.is_active ? '' : 'is-inactive'}`} key={supplier.id}
>              <div>
                <strong>{supplier.trade_name || supplier.legal_name}</strong>
                <small>
                  {supplier.service_category || 'Não informado'}
                  {supplier.document_number
                    ? ` · ${supplier.document_number}`
                    : ''}
                </small>
              </div>

              <span>{supplier.email || supplier.phone || 'Sem contato'}</span>

              <button
                className="secondary icon-action"
                disabled={isSaving}
                title={supplier.is_active ? 'Desativar fornecedor' : 'Ativar fornecedor'}
                aria-label={
                  supplier.is_active ? 'Desativar fornecedor' : 'Ativar fornecedor'
                }
                onClick={() => void toggleActive(supplier)}
              >
                <Power size={18} />
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}