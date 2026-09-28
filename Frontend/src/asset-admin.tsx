import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Power, RefreshCw, Trash2, X } from 'lucide-react';
import { supabase } from './supabase';
import { AssetCategoryAdmin } from './asset-category-admin';

type Props = {
  tenantId: string;
  canManage: boolean;
};

type AssetStatus = 'active' | 'inactive' | 'maintenance' | 'stopped' | 'retired';
type Criticality = 'low' | 'medium' | 'high' | 'critical';

type Asset = {
  id: string;
  tenant_id: string;
  unit_id: string;
  cost_center_id: string;
  category_id: string;
  code: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  status: AssetStatus;
  criticality: Criticality;
  installed_at: string | null;
  notes: string | null;
  deleted_at: string | null;
};

type AssetCategory = {
  id: string;
  code: string;
  name: string;
  is_robot: boolean;
  is_active: boolean;
};

type Unit = {
  id: string;
  cost_center_id: string;
  code: string;
  name: string;
  city: string | null;
  is_active: boolean;
};

type CostCenter = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

type OperationalReadingStatus = 'normal' | 'attention' | 'critical' | 'unavailable';

type AssetOperationalReading = {
  id: string;
  hour_meter_hours: number | null;
  current_temperature_c: number | null;
  health_status: OperationalReadingStatus;
  source: 'manual' | 'ocr' | 'iot';
  captured_at: string;
  notes: string | null;
};

const statusLabels: Record<AssetStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  maintenance: 'Em manutenção',
  stopped: 'Parado',
  retired: 'Aposentado',
};

const criticalityLabels: Record<Criticality, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

const emptyForm = {
  code: '',
  name: '',
  category_id: '',
  unit_id: '',
  cost_center_id: '',
  manufacturer: '',
  model: '',
  serial_number: '',
  criticality: 'medium' as Criticality,
  status: 'active' as AssetStatus,
  installed_at: '',
  notes: '',
};

const emptyReadingForm = {
  hourMeterHours: '',
  currentTemperatureC: '',
  healthStatus: 'normal' as OperationalReadingStatus,
  notes: '',
};

const operationalReadingStatusLabels: Record<OperationalReadingStatus, string> = {
  normal: 'Normal',
  attention: 'Atenção',
  critical: 'Crítico',
  unavailable: 'Sem leitura disponível',
};

const operationalReadingSourceLabels = {
  manual: 'Digitada manualmente',
  ocr: 'OCR',
  iot: 'IoT',
} as const;

export function AssetAdmin({ tenantId, canManage }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryAdminOpen, setIsCategoryAdminOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [operationalReadings, setOperationalReadings] = useState<AssetOperationalReading[]>([]);
  const [readingForm, setReadingForm] = useState(emptyReadingForm);
  const [isReadingSaving, setIsReadingSaving] = useState(false);
  const [readingError, setReadingError] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const isDetailView = isFormOpen && editingAsset !== null;

  // A recarga silenciosa mantém a lista atual visível enquanto os dados novos chegam.
  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    setErrorMessage('');

    const [
      { data: assetsData, error: assetsError },
      { data: categoryData, error: categoryError },
      { data: unitData, error: unitError },
      { data: costCenterData, error: costCenterError },
    ] = await Promise.all([
      supabase
        .from('assets')
        .select(
          'id, tenant_id, unit_id, cost_center_id, category_id, code, name, manufacturer, model, serial_number, status, criticality, installed_at, notes, deleted_at',
        )
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('name'),
      supabase
        .from('asset_categories')
        .select('id, code, name, is_robot, is_active')
        .eq('tenant_id', tenantId)
        .order('name'),
      supabase
        .from('units')
        .select('id, cost_center_id, code, name, city, is_active')
        .eq('tenant_id', tenantId)
        .order('name'),
      supabase
        .from('cost_centers')
        .select('id, code, name, is_active')
        .eq('tenant_id', tenantId)
        .order('name'),
    ]);

    if (assetsError || categoryError || unitError || costCenterError) {
      setErrorMessage(
        `Não foi possível carregar os dados: ${
          assetsError?.message ??
          categoryError?.message ??
          unitError?.message ??
          costCenterError?.message
        }`,
      );
      if (!silent) {
        setIsLoading(false);
      }

      return;
    }

    setAssets((assetsData ?? []) as Asset[]);
    setCategories((categoryData ?? []) as AssetCategory[]);
    setUnits((unitData ?? []) as Unit[]);
    setCostCenters((costCenterData ?? []) as CostCenter[]);

    if (!silent) {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredAssets = assets.filter((asset) =>
    `${asset.name} ${asset.code} ${asset.manufacturer ?? ''} ${asset.model ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const availableCategories = categories.filter((category) =>
    category.is_active || category.id === editingAsset?.category_id,
  );

  const availableUnits = units.filter(
    (unit) => unit.is_active || unit.id === editingAsset?.unit_id,
  );

  const availableCostCenters = costCenters.filter(
    (costCenter) =>
      costCenter.is_active || costCenter.id === editingAsset?.cost_center_id,
  );

  const selectedUnit = units.find((unit) => unit.id === form.unit_id);
  const unitCostCenters = availableCostCenters.filter(
    (costCenter) =>
      !selectedUnit ||
      costCenter.id === selectedUnit.cost_center_id ||
      costCenter.id === form.cost_center_id,
  );

  function getCategoryName(categoryId: string) {
    return categories.find((category) => category.id === categoryId)?.name ?? '—';
  }

  function getUnitName(unitId: string) {
    return units.find((unit) => unit.id === unitId)?.name ?? '—';
  }

  function getCostCenterName(costCenterId: string) {
    return (
      costCenters.find((costCenter) => costCenter.id === costCenterId)?.name ?? '—'
    );
  }

  function openNewAsset() {
    setMessage('');
    setErrorMessage('');
    setEditingAsset(null);
    setOperationalReadings([]);
    setReadingForm(emptyReadingForm);
    setReadingError('');
    setForm({
      ...emptyForm,
      category_id: availableCategories[0]?.id ?? '',
      unit_id: availableUnits[0]?.id ?? '',
      cost_center_id: availableUnits[0]?.cost_center_id ?? availableCostCenters[0]?.id ?? '',
    });
    setIsFormOpen(true);
  }

  function openEditAsset(asset: Asset) {
    setMessage('');
    setErrorMessage('');
    setEditingAsset(asset);
    setOperationalReadings([]);
    setReadingForm(emptyReadingForm);
    setReadingError('');
    setForm({
      code: asset.code,
      name: asset.name,
      category_id: asset.category_id,
      unit_id: asset.unit_id,
      cost_center_id: asset.cost_center_id,
      manufacturer: asset.manufacturer ?? '',
      model: asset.model ?? '',
      serial_number: asset.serial_number ?? '',
      criticality: asset.criticality,
      status: asset.status,
      installed_at: asset.installed_at ?? '',
      notes: asset.notes ?? '',
    });
    void loadOperationalReadings(asset.id);
    setIsFormOpen(true);
  }

  async function loadOperationalReadings(assetId: string) {
    const { data, error } = await supabase
      .from('asset_operational_readings')
      .select('id, hour_meter_hours, current_temperature_c, health_status, source, captured_at, notes')
      .eq('tenant_id', tenantId)
      .eq('asset_id', assetId)
      .order('captured_at', { ascending: false })
      .limit(8);

    if (error) {
      setReadingError(`Não foi possível carregar as leituras operacionais: ${error.message}`);
      return;
    }

    setOperationalReadings((data ?? []) as AssetOperationalReading[]);
  }

  async function saveOperationalReading() {
    if (!editingAsset || isReadingSaving) return;

    const hourMeterHours = readingForm.hourMeterHours.trim() === ''
      ? null
      : Number(readingForm.hourMeterHours);
    const currentTemperatureC = readingForm.currentTemperatureC.trim() === ''
      ? null
      : Number(readingForm.currentTemperatureC);

    if (hourMeterHours === null && currentTemperatureC === null && !readingForm.notes.trim()) {
      setReadingError('Informe o horímetro, a temperatura ou uma observação da leitura.');
      return;
    }
    if (hourMeterHours !== null && (!Number.isFinite(hourMeterHours) || hourMeterHours < 0)) {
      setReadingError('Informe um horímetro igual ou maior que zero.');
      return;
    }
    if (
      currentTemperatureC !== null
      && (!Number.isFinite(currentTemperatureC) || currentTemperatureC < -100 || currentTemperatureC > 1000)
    ) {
      setReadingError('Informe uma temperatura entre -100 °C e 1.000 °C.');
      return;
    }

    setIsReadingSaving(true);
    setReadingError('');

    const { error } = await supabase.from('asset_operational_readings').insert({
      tenant_id: tenantId,
      asset_id: editingAsset.id,
      hour_meter_hours: hourMeterHours,
      current_temperature_c: currentTemperatureC,
      health_status: readingForm.healthStatus,
      source: 'manual',
      notes: readingForm.notes.trim() || null,
    });

    if (error) {
      setReadingError(`Não foi possível registrar a leitura: ${error.message}`);
    } else {
      setReadingForm(emptyReadingForm);
      setMessage('Leitura operacional registrada com sucesso.');
      await loadOperationalReadings(editingAsset.id);
    }

    setIsReadingSaving(false);
  }

  function handleUnitChange(unitId: string) {
    const unit = units.find((item) => item.id === unitId);

    setForm({
      ...form,
      unit_id: unitId,
      cost_center_id: unit?.cost_center_id ?? '',
    });
  }

  async function saveAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.code.trim()) {
      setErrorMessage('Informe o código do ativo.');
      return;
    }

    if (!form.name.trim()) {
      setErrorMessage('Informe o nome do ativo.');
      return;
    }

    if (!form.category_id) {
      setErrorMessage('Selecione uma categoria.');
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
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      category_id: form.category_id,
      unit_id: form.unit_id,
      cost_center_id: form.cost_center_id,
      manufacturer: form.manufacturer.trim() || null,
      model: form.model.trim() || null,
      serial_number: form.serial_number.trim() || null,
      criticality: form.criticality,
      status: form.status,
      installed_at: form.installed_at || null,
      notes: form.notes.trim() || null,
    };

    const { error } = editingAsset
      ? await supabase.from('assets').update(payload).eq('id', editingAsset.id)
      : await supabase.from('assets').insert({ ...payload, tenant_id: tenantId });

    if (error) {
      setErrorMessage(`Não foi possível salvar o ativo: ${error.message}`);
    } else {
      setMessage(
        editingAsset
          ? 'Ativo atualizado com sucesso.'
          : 'Ativo cadastrado com sucesso.',
      );
      setIsFormOpen(false);
      await loadData(true);
    }

    setIsSaving(false);
  }

  async function toggleAssetStatus(asset: Asset) {
    const nextStatus: AssetStatus =
      asset.status === 'active' ? 'inactive' : 'active';
    const action = asset.status === 'active' ? 'desativar' : 'ativar';

    if (!window.confirm(`Deseja ${action} o ativo ${asset.name}?`)) return;

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('assets')
      .update({ status: nextStatus })
      .eq('id', asset.id);

    if (error) {
      setErrorMessage(`Não foi possível atualizar o ativo: ${error.message}`);
    } else {
      setMessage(`Ativo ${asset.status === 'active' ? 'desativado' : 'ativado'} com sucesso.`);
      await loadData(true);
    }

    setIsSaving(false);
  }

  async function deleteAsset(asset: Asset) {
    if (
      !window.confirm(
        `Excluir o ativo ${asset.name}? O registro será preservado para histórico, mas não aparecerá mais na operação.`,
      )
    ) {
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('assets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', asset.id);

    if (error) {
      setErrorMessage(`Não foi possível excluir o ativo: ${error.message}`);
    } else {
      setMessage('Ativo excluído com sucesso.');
      setIsFormOpen(false);
      setEditingAsset(null);
      await loadData(true);
    }

    setIsSaving(false);
  }
  if (isCategoryAdminOpen) {
    return (
      <AssetCategoryAdmin
        tenantId={tenantId}
        canManage={canManage}
        onClose={() => {
          setIsCategoryAdminOpen(false);
          void loadData(true);
        }}
      />
    );
  }
  return (
    <section className="content asset-admin">
      {!isDetailView && <div className="user-admin-actions">
        <div className="asset-search">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar ativo..."
          />
        </div>

        {canManage && (
          <button
            className="button-with-icon"
            onClick={openNewAsset}
            disabled={isSaving || isLoading}
            title="Cadastrar novo ativo"
          >
            <Plus size={17} />
            Novo ativo
          </button>
        )}

        {canManage && (
          <button
            className="secondary button-with-icon"
            onClick={() => setIsCategoryAdminOpen(true)}
            disabled={isSaving || isLoading}
          >
            <Pencil size={17} />
            Categorias
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

      {message && <p className="success-message">{message}</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {isFormOpen && canManage && (
        <form className="new-user-form panel" onSubmit={saveAsset}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">CADASTRO DE ATIVO</p>
              <h2>{editingAsset ? `Ativo: ${editingAsset.name}` : 'Novo ativo'}</h2>
            </div>

            <button
              type="button"
              className="secondary"
              title={editingAsset ? 'Voltar para ativos' : 'Cancelar'}
              aria-label={editingAsset ? 'Voltar para ativos' : 'Cancelar'}
              onClick={() => setIsFormOpen(false)}
            >
              {editingAsset ? 'Voltar para ativos' : <X size={18} />}
            </button>
          </div>

          <div className="asset-form-grid">
            <label className="field">
              <span>Código *</span>
              <input
                required
                maxLength={60}
                value={form.code}
                placeholder="Ex.: ROB-001"
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value })
                }
              />
            </label>

            <label className="field">
              <span>Nome do ativo *</span>
              <input
                required
                maxLength={200}
                value={form.name}
                placeholder="Ex.: Robô de solda ABB IRB 6700"
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </label>

            <label className="field">
              <span>Categoria *</span>
              <select
                required
                value={form.category_id}
                onChange={(event) =>
                  setForm({ ...form, category_id: event.target.value })
                }
              >
                <option value="">Selecione</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.is_robot ? ' · Robô' : ''}
                  </option>
                ))}
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
                    {unit.city ? ` · ${unit.city}` : ''}
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
              <span>Fabricante</span>
              <input
                maxLength={120}
                value={form.manufacturer}
                placeholder="Ex.: ABB"
                onChange={(event) =>
                  setForm({ ...form, manufacturer: event.target.value })
                }
              />
            </label>

            <label className="field">
              <span>Modelo</span>
              <input
                maxLength={120}
                value={form.model}
                placeholder="Ex.: IRB 6700"
                onChange={(event) =>
                  setForm({ ...form, model: event.target.value })
                }
              />
            </label>

            <label className="field">
              <span>Número de série</span>
              <input
                maxLength={120}
                value={form.serial_number}
                onChange={(event) =>
                  setForm({ ...form, serial_number: event.target.value })
                }
              />
            </label>

            <label className="field">
              <span>Criticidade</span>
              <select
                value={form.criticality}
                onChange={(event) =>
                  setForm({
                    ...form,
                    criticality: event.target.value as Criticality,
                  })
                }
              >
                {(Object.keys(criticalityLabels) as Criticality[]).map(
                  (criticality) => (
                    <option key={criticality} value={criticality}>
                      {criticalityLabels[criticality]}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="field">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    status: event.target.value as AssetStatus,
                  })
                }
              >
                {(Object.keys(statusLabels) as AssetStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Data de instalação</span>
              <input
                type="date"
                value={form.installed_at}
                onChange={(event) =>
                  setForm({ ...form, installed_at: event.target.value })
                }
              />
            </label>

            <label className="field asset-form-notes">
              <span>Observações</span>
              <textarea
                rows={3}
                value={form.notes}
                placeholder="Informações complementares sobre o ativo..."
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
              />
            </label>
          </div>

          {editingAsset && (
            <section
              aria-label="Leituras operacionais"
              style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #d8e3f0' }}
            >
              <p className="eyebrow">LEITURAS OPERACIONAIS</p>
              <h3 style={{ margin: '4px 0 8px' }}>Medição manual do ativo</h3>
              <p className="empty" style={{ margin: '0 0 16px' }}>
                Registre horímetro, temperatura e condição observada. A estrutura também comporta
                futuras leituras por OCR ou IoT, sem afirmar que essas integrações já estão ativas.
              </p>

              <div className="asset-form-grid">
                <label className="field">
                  <span>Horímetro (horas)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={readingForm.hourMeterHours}
                    placeholder="Ex.: 12450,50"
                    disabled={isReadingSaving}
                    onChange={(event) => setReadingForm({ ...readingForm, hourMeterHours: event.target.value })}
                  />
                </label>

                <label className="field">
                  <span>Temperatura atual (°C)</span>
                  <input
                    type="number"
                    min="-100"
                    max="1000"
                    step="0.1"
                    value={readingForm.currentTemperatureC}
                    placeholder="Ex.: 41,5"
                    disabled={isReadingSaving}
                    onChange={(event) => setReadingForm({ ...readingForm, currentTemperatureC: event.target.value })}
                  />
                </label>

                <label className="field">
                  <span>Condição observada</span>
                  <select
                    value={readingForm.healthStatus}
                    disabled={isReadingSaving}
                    onChange={(event) => setReadingForm({
                      ...readingForm,
                      healthStatus: event.target.value as OperationalReadingStatus,
                    })}
                  >
                    {(Object.keys(operationalReadingStatusLabels) as OperationalReadingStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {operationalReadingStatusLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field asset-form-notes">
                  <span>Observação da leitura</span>
                  <textarea
                    rows={3}
                    value={readingForm.notes}
                    placeholder="Ex.: leitura verificada no painel local; avaliar circuito hidráulico."
                    disabled={isReadingSaving}
                    onChange={(event) => setReadingForm({ ...readingForm, notes: event.target.value })}
                  />
                </label>
              </div>

              {readingError && <p className="error-message">{readingError}</p>}

              <div className="form-actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="secondary button-with-icon"
                  disabled={isReadingSaving}
                  onClick={() => void saveOperationalReading()}
                >
                  {isReadingSaving ? 'Registrando leitura...' : 'Registrar leitura'}
                </button>
              </div>

              <div style={{ marginTop: 18 }}>
                <h3 style={{ margin: '0 0 8px' }}>Últimas leituras</h3>
                {operationalReadings.length === 0 ? (
                  <p className="empty">Nenhuma leitura operacional registrada para este ativo.</p>
                ) : (
                  <div className="data-list">
                    {operationalReadings.map((reading) => (
                      <div className="data-row" key={reading.id}>
                        <div>
                          <strong>
                            {reading.hour_meter_hours !== null ? `${reading.hour_meter_hours.toLocaleString('pt-BR')} h` : 'Horímetro não informado'}
                            {' · '}
                            {reading.current_temperature_c !== null ? `${reading.current_temperature_c.toLocaleString('pt-BR')} °C` : 'Temperatura não informada'}
                          </strong>
                          <small>
                            {new Date(reading.captured_at).toLocaleString('pt-BR')} · {operationalReadingSourceLabels[reading.source]}
                            {reading.notes ? ` · ${reading.notes}` : ''}
                          </small>
                        </div>
                        <span className="badge">{operationalReadingStatusLabels[reading.health_status]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          <div className="form-actions">
            {editingAsset && (
              <>
                <button
                  type="button"
                  className="secondary"
                  disabled={isSaving}
                  onClick={() => void toggleAssetStatus(editingAsset)}
                >
                  {editingAsset.status === 'active' ? 'Desativar ativo' : 'Ativar ativo'}
                </button>
                <button
                  type="button"
                  className="secondary asset-delete"
                  disabled={isSaving}
                  onClick={() => void deleteAsset(editingAsset)}
                >
                  Excluir ativo
                </button>
              </>
            )}
            <button type="submit" disabled={isSaving} className="button-with-icon">
              {isSaving ? 'Salvando...' : 'Salvar ativo'}
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
        <div className="table-head asset-table-head">
          <span>ATIVO</span>
          <span>CATEGORIA</span>
          <span>UNIDADE</span>
          <span>CENTRO DE CUSTO</span>
          <span>CRITICIDADE</span>
          <span>STATUS</span>
        </div>

        {isLoading && (
          <div className="empty-state">Carregando ativos...</div>
        )}

        {!isLoading && filteredAssets.length === 0 && (
          <div className="empty-state">
            {search
              ? 'Nenhum ativo encontrado para a busca.'
              : 'Nenhum ativo cadastrado para este cliente.'}
          </div>
        )}

        {!isLoading &&
          filteredAssets.map((asset) => (
            <div className="table-row asset-table-row" key={asset.id}>
              <div>
                <button
                  type="button"
                  className="work-order-link"
                  onClick={() => openEditAsset(asset)}
                >
                  {asset.name}
                </button>
                <small>
                  {asset.code}
                  {asset.manufacturer ? ` · ${asset.manufacturer}` : ''}
                  {asset.model ? ` · ${asset.model}` : ''}
                </small>
              </div>

              <span>
                {getCategoryName(asset.category_id)}
                {categories.find((category) => category.id === asset.category_id)
                  ?.is_robot
                  ? ' · Robô'
                  : ''}
              </span>

              <span>{getUnitName(asset.unit_id)}</span>
              <span>{getCostCenterName(asset.cost_center_id)}</span>
              <span>
                <span
                  className={`badge asset-criticality-${asset.criticality}`}
                >
                  {criticalityLabels[asset.criticality]}
                </span>
              </span>
              <span>
                <span className={`badge asset-status-${asset.status}`}>
                  {statusLabels[asset.status]}
                </span>
              </span>

            </div>
          ))}
      </article>}
    </section>
  );
}
