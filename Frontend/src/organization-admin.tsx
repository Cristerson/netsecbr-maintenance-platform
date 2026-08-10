import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Power, RefreshCw, X } from 'lucide-react';
import { supabase } from './supabase';

type Props = {
  tenantId: string;
};

type CostCenter = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

type Unit = {
  id: string;
  cost_center_id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string;
  is_active: boolean;
};

const emptyCostCenter = {
  code: '',
  name: '',
};

const emptyUnit = {
  cost_center_id: '',
  code: '',
  name: '',
  city: '',
  state: '',
  country: 'Brasil',
};

export function OrganizationAdmin({ tenantId }: Props) {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [isCostCenterFormOpen, setIsCostCenterFormOpen] = useState(false);
  const [editingCostCenter, setEditingCostCenter] = useState<CostCenter | null>(null);
  const [costCenterForm, setCostCenterForm] = useState(emptyCostCenter);

  const [isUnitFormOpen, setIsUnitFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitForm, setUnitForm] = useState(emptyUnit);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    const [{ data: costCenterData, error: costCenterError }, { data: unitData, error: unitError }] =
      await Promise.all([
        supabase
          .from('cost_centers')
          .select('id, code, name, is_active')
          .eq('tenant_id', tenantId)
          .order('code'),
        supabase
          .from('units')
          .select('id, cost_center_id, code, name, city, state, country, is_active')
          .eq('tenant_id', tenantId)
          .order('code'),
      ]);

    if (costCenterError || unitError) {
      setErrorMessage(
        `Não foi possível carregar a estrutura organizacional: ${
          costCenterError?.message ?? unitError?.message
        }`,
      );
      setIsLoading(false);
      return;
    }

    setCostCenters((costCenterData ?? []) as CostCenter[]);
    setUnits((unitData ?? []) as Unit[]);
    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openNewCostCenter() {
    setMessage('');
    setErrorMessage('');
    setEditingCostCenter(null);
    setCostCenterForm(emptyCostCenter);
    setIsCostCenterFormOpen(true);
  }

  function openEditCostCenter(costCenter: CostCenter) {
    setMessage('');
    setErrorMessage('');
    setEditingCostCenter(costCenter);
    setCostCenterForm({
      code: costCenter.code,
      name: costCenter.name,
    });
    setIsCostCenterFormOpen(true);
  }

  async function saveCostCenter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const payload = {
      code: costCenterForm.code.trim().toUpperCase(),
      name: costCenterForm.name.trim(),
    };

    const { error } = editingCostCenter
      ? await supabase
          .from('cost_centers')
          .update(payload)
          .eq('id', editingCostCenter.id)
      : await supabase.from('cost_centers').insert({
          ...payload,
          tenant_id: tenantId,
        });

    if (error) {
      setErrorMessage(`Não foi possível salvar o centro de custo: ${error.message}`);
    } else {
      setMessage(
        editingCostCenter
          ? 'Centro de custo atualizado com sucesso.'
          : 'Centro de custo cadastrado com sucesso.',
      );
      setIsCostCenterFormOpen(false);
      await loadData();
    }

    setIsSaving(false);
  }

  async function toggleCostCenter(costCenter: CostCenter) {
    const action = costCenter.is_active ? 'desativar' : 'ativar';

    if (!window.confirm(`Deseja ${action} o centro de custo ${costCenter.name}?`)) {
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('cost_centers')
      .update({ is_active: !costCenter.is_active })
      .eq('id', costCenter.id);

    if (error) {
      setErrorMessage(`Não foi possível atualizar o centro de custo: ${error.message}`);
    } else {
      setMessage(`Centro de custo ${costCenter.is_active ? 'desativado' : 'ativado'} com sucesso.`);
      await loadData();
    }

    setIsSaving(false);
  }

  function openNewUnit() {
    setMessage('');
    setErrorMessage('');
    setEditingUnit(null);
    setUnitForm({
      ...emptyUnit,
      cost_center_id: costCenters.find((costCenter) => costCenter.is_active)?.id ?? '',
    });
    setIsUnitFormOpen(true);
  }

  function openEditUnit(unit: Unit) {
    setMessage('');
    setErrorMessage('');
    setEditingUnit(unit);
    setUnitForm({
      cost_center_id: unit.cost_center_id,
      code: unit.code,
      name: unit.name,
      city: unit.city ?? '',
      state: unit.state ?? '',
      country: unit.country,
    });
    setIsUnitFormOpen(true);
  }

  async function saveUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const payload = {
      cost_center_id: unitForm.cost_center_id,
      code: unitForm.code.trim().toUpperCase(),
      name: unitForm.name.trim(),
      city: unitForm.city.trim() || null,
      state: unitForm.state.trim().toUpperCase() || null,
      country: unitForm.country.trim() || 'Brasil',
    };

    const { error } = editingUnit
      ? await supabase
          .from('units')
          .update(payload)
          .eq('id', editingUnit.id)
      : await supabase.from('units').insert({
          ...payload,
          tenant_id: tenantId,
        });

    if (error) {
      setErrorMessage(`Não foi possível salvar a unidade: ${error.message}`);
    } else {
      setMessage(
        editingUnit
          ? 'Unidade atualizada com sucesso.'
          : 'Unidade cadastrada com sucesso.',
      );
      setIsUnitFormOpen(false);
      await loadData();
    }

    setIsSaving(false);
  }

  async function toggleUnit(unit: Unit) {
    const action = unit.is_active ? 'desativar' : 'ativar';

    if (!window.confirm(`Deseja ${action} a unidade ${unit.name}?`)) {
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('units')
      .update({ is_active: !unit.is_active })
      .eq('id', unit.id);

    if (error) {
      setErrorMessage(`Não foi possível atualizar a unidade: ${error.message}`);
    } else {
      setMessage(`Unidade ${unit.is_active ? 'desativada' : 'ativada'} com sucesso.`);
      await loadData();
    }

    setIsSaving(false);
  }

  function getCostCenterName(costCenterId: string) {
    return costCenters.find((costCenter) => costCenter.id === costCenterId)?.name ?? 'Não informado';
  }

  const availableCostCenters = costCenters.filter(
    (costCenter) =>
      costCenter.is_active || costCenter.id === editingUnit?.cost_center_id,
  );

  return (
    <div>
      <div className="user-admin-actions">
        <button
          className="button-with-icon"
          onClick={openNewCostCenter}
          disabled={isSaving}
        >
          <Plus size={17} />
          Novo centro de custo
        </button>

        <button
          className="button-with-icon"
          onClick={openNewUnit}
          disabled={isSaving || costCenters.filter((costCenter) => costCenter.is_active).length === 0}
          title={
            costCenters.some((costCenter) => costCenter.is_active)
              ? 'Cadastrar unidade'
              : 'Cadastre primeiro um centro de custo ativo'
          }
        >
          <Plus size={17} />
          Nova unidade
        </button>

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

      {isCostCenterFormOpen && (
        <form className="new-user-form panel" onSubmit={saveCostCenter}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">CENTRO DE CUSTO</p>
              <h2>
                {editingCostCenter ? 'Editar centro de custo' : 'Cadastrar centro de custo'}
              </h2>
            </div>

            <button
              type="button"
              className="secondary icon-action"
              title="Cancelar"
              aria-label="Cancelar"
              onClick={() => setIsCostCenterFormOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <label className="field">
            <span>Código</span>
            <input
              required
              maxLength={30}
              value={costCenterForm.code}
              onChange={(event) =>
                setCostCenterForm({ ...costCenterForm, code: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span>Nome</span>
            <input
              required
              maxLength={120}
              value={costCenterForm.name}
              onChange={(event) =>
                setCostCenterForm({ ...costCenterForm, name: event.target.value })
              }
            />
          </label>

          <div className="form-actions">
            <button type="submit" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar centro de custo'}
            </button>
          </div>
        </form>
      )}

      {isUnitFormOpen && (
        <form className="new-user-form panel" onSubmit={saveUnit}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">UNIDADE</p>
              <h2>{editingUnit ? 'Editar unidade' : 'Cadastrar unidade'}</h2>
            </div>

            <button
              type="button"
              className="secondary icon-action"
              title="Cancelar"
              aria-label="Cancelar"
              onClick={() => setIsUnitFormOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <label className="field">
            <span>Centro de custo</span>
            <select
              required
              value={unitForm.cost_center_id}
              onChange={(event) =>
                setUnitForm({ ...unitForm, cost_center_id: event.target.value })
              }
            >
              <option value="">Selecione</option>

              {availableCostCenters.map((costCenter) => (
                <option key={costCenter.id} value={costCenter.id}>
                  {costCenter.code} — {costCenter.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Código da unidade</span>
            <input
              required
              maxLength={30}
              value={unitForm.code}
              onChange={(event) =>
                setUnitForm({ ...unitForm, code: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span>Nome da unidade</span>
            <input
              required
              maxLength={120}
              value={unitForm.name}
              onChange={(event) =>
                setUnitForm({ ...unitForm, name: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span>Cidade</span>
            <input
              maxLength={100}
              value={unitForm.city}
              onChange={(event) =>
                setUnitForm({ ...unitForm, city: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span>UF</span>
            <input
              maxLength={2}
              value={unitForm.state}
              onChange={(event) =>
                setUnitForm({ ...unitForm, state: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span>País</span>
            <input
              required
              maxLength={100}
              value={unitForm.country}
              onChange={(event) =>
                setUnitForm({ ...unitForm, country: event.target.value })
              }
            />
          </label>

          <div className="form-actions">
            <button type="submit" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar unidade'}
            </button>
          </div>
        </form>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">ESTRUTURA FINANCEIRA</p>
            <h2>Centros de custo</h2>
          </div>
        </div>

        <div className="table">
          {isLoading && <div className="empty-state">Carregando centros de custo...</div>}

          {!isLoading && costCenters.length === 0 && (
            <div className="empty-state">Nenhum centro de custo cadastrado.</div>
          )}

          {!isLoading &&
            costCenters.map((costCenter) => (
              <div
               className={`table-row ${costCenter.is_active ? '' : 'is-inactive'}`}
                key={costCenter.id}
              >
                <div>
                  <strong>{costCenter.name}</strong>
                  <small>{costCenter.code}</small>
                </div>

                <span>{costCenter.is_active ? 'Ativo' : 'Inativo'}</span>

                <button
                  className="secondary icon-action"
                  disabled={isSaving}
                  title="Editar centro de custo"
                  aria-label="Editar centro de custo"
                  onClick={() => openEditCostCenter(costCenter)}
                >
                  <Pencil size={18} />
                </button>

                <button
                  className="secondary icon-action"
                  disabled={isSaving}
                  title={costCenter.is_active ? 'Desativar centro de custo' : 'Ativar centro de custo'}
                  aria-label={costCenter.is_active ? 'Desativar centro de custo' : 'Ativar centro de custo'}
                  onClick={() => void toggleCostCenter(costCenter)}
                >
                  <Power size={18} />
                </button>
              </div>
            ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">ESTRUTURA OPERACIONAL</p>
            <h2>Unidades</h2>
          </div>
        </div>

        <div className="table">
          {isLoading && <div className="empty-state">Carregando unidades...</div>}

          {!isLoading && units.length === 0 && (
            <div className="empty-state">Nenhuma unidade cadastrada.</div>
          )}

          {!isLoading &&
            units.map((unit) => (
              <div
                className={`table-row unit-row ${unit.is_active ? '' : 'is-inactive'}`}
                key={unit.id}
              >
                <div>
                  <strong>{unit.name}</strong>
                  <small>{unit.code}</small>
                </div>

                <span>{getCostCenterName(unit.cost_center_id)}</span>
                <span>{[unit.city, unit.state].filter(Boolean).join(' / ') || '—'}</span>

                <button
                  className="secondary icon-action"
                  disabled={isSaving}
                  title="Editar unidade"
                  aria-label="Editar unidade"
                  onClick={() => openEditUnit(unit)}
                >
                  <Pencil size={18} />
                </button>

                <button
                  className="secondary icon-action"
                  disabled={isSaving}
                  title={unit.is_active ? 'Desativar unidade' : 'Ativar unidade'}
                  aria-label={unit.is_active ? 'Desativar unidade' : 'Ativar unidade'}
                  onClick={() => void toggleUnit(unit)}
                >
                  <Power size={18} />
                </button>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}