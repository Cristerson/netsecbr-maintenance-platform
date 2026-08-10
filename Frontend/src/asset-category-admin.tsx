import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Power, RefreshCw, X } from 'lucide-react';
import { supabase } from './supabase';

type Props = {
  tenantId: string;
  canManage: boolean;
  onClose: () => void;
};

type AssetCategory = {
  id: string;
  code: string;
  name: string;
  is_robot: boolean;
  is_active: boolean;
};

const emptyForm = {
  code: '',
  name: '',
  is_robot: false,
};

export function AssetCategoryAdmin({
  tenantId,
  canManage,
  onClose,
}: Props) {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<AssetCategory | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('asset_categories')
      .select('id, code, name, is_robot, is_active')
      .eq('tenant_id', tenantId)
      .order('name');

    if (error) {
      setErrorMessage(`Não foi possível carregar as categorias: ${error.message}`);
    } else {
      setCategories((data ?? []) as AssetCategory[]);
    }

    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openNewCategory() {
    setMessage('');
    setErrorMessage('');
    setEditingCategory(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  }

  function openEditCategory(category: AssetCategory) {
    setMessage('');
    setErrorMessage('');
    setEditingCategory(category);
    setForm({
      code: category.code,
      name: category.name,
      is_robot: category.is_robot,
    });
    setIsFormOpen(true);
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();

    if (!code || !name) {
      setErrorMessage('Informe o código e o nome da categoria.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const payload = {
      code,
      name,
      is_robot: form.is_robot,
    };

    const { error } = editingCategory
      ? await supabase
          .from('asset_categories')
          .update(payload)
          .eq('id', editingCategory.id)
      : await supabase.from('asset_categories').insert({
          ...payload,
          tenant_id: tenantId,
          is_active: true,
        });

    if (error) {
      setErrorMessage(`Não foi possível salvar a categoria: ${error.message}`);
    } else {
      setMessage(
        editingCategory
          ? 'Categoria atualizada com sucesso.'
          : 'Categoria cadastrada com sucesso.',
      );
      setIsFormOpen(false);
      await loadData();
    }

    setIsSaving(false);
  }

  async function toggleActive(category: AssetCategory) {
    const action = category.is_active ? 'desativar' : 'ativar';

    if (!window.confirm(`Deseja ${action} a categoria ${category.name}?`)) {
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('asset_categories')
      .update({ is_active: !category.is_active })
      .eq('id', category.id);

    if (error) {
      setErrorMessage(`Não foi possível atualizar a categoria: ${error.message}`);
    } else {
      setMessage(
        `Categoria ${category.is_active ? 'desativada' : 'ativada'} com sucesso.`,
      );
      await loadData();
    }

    setIsSaving(false);
  }

  return (
    <div>
      <div className="user-admin-actions">
        <button className="secondary" onClick={onClose}>
          Voltar para Ativos
        </button>

        {canManage && (
          <button className="button-with-icon" onClick={openNewCategory}>
            <Plus size={17} />
            Nova categoria
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
        <form className="new-user-form panel" onSubmit={saveCategory}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">CATEGORIA DE ATIVO</p>
              <h2>
                {editingCategory ? 'Editar categoria' : 'Cadastrar categoria'}
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

          <label className="field">
            <span>Código</span>
            <input
              required
              maxLength={30}
              value={form.code}
              placeholder="Ex.: ROBO"
              onChange={(event) =>
                setForm({ ...form, code: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span>Nome</span>
            <input
              required
              maxLength={120}
              value={form.name}
              placeholder="Ex.: Robô industrial"
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </label>

          <label className="permission-option">
            <span>
              <input
                type="checkbox"
                checked={form.is_robot}
                onChange={(event) =>
                  setForm({ ...form, is_robot: event.target.checked })
                }
              />{' '}
              Esta categoria representa um robô e conta para a licença.
            </span>
          </label>

          <div className="form-actions">
            <button type="submit" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar categoria'}
            </button>
          </div>
        </form>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">CADASTRO BASE</p>
            <h2>Categorias de ativos</h2>
          </div>
        </div>

        <div className="table">
          {isLoading && (
            <div className="empty-state">Carregando categorias...</div>
          )}

          {!isLoading && categories.length === 0 && (
            <div className="empty-state">
              Nenhuma categoria cadastrada para este cliente.
            </div>
          )}

          {!isLoading &&
            categories.map((category) => (
              <div
                className={`table-row ${
                  category.is_active ? '' : 'is-inactive'
                }`}
                key={category.id}
              >
                <div>
                  <strong>{category.name}</strong>
                  <small>{category.code}</small>
                </div>

                <span>
                  {category.is_robot ? 'Conta como robô' : 'Equipamento auxiliar'}
                </span>

                {canManage && (
                  <button
                    className="secondary icon-action"
                    disabled={isSaving}
                    title="Editar categoria"
                    aria-label="Editar categoria"
                    onClick={() => openEditCategory(category)}
                  >
                    <Pencil size={18} />
                  </button>
                )}

                {canManage && (
                  <button
                    className="secondary icon-action"
                    disabled={isSaving}
                    title={
                      category.is_active
                        ? 'Desativar categoria'
                        : 'Ativar categoria'
                    }
                    aria-label={
                      category.is_active
                        ? 'Desativar categoria'
                        : 'Ativar categoria'
                    }
                    onClick={() => void toggleActive(category)}
                  >
                    <Power size={18} />
                  </button>
                )}
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}