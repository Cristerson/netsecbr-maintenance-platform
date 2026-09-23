import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Wrench, X } from 'lucide-react';
import { supabase } from './supabase';

type Props = {
  tenantId: string;
  canManage: boolean;
};

// Situação exibida na lista. "Atrasada" é calculada apenas na tela, nunca gravada no banco.
type PlanSituation = 'active' | 'inactive' | 'late';

type PreventivePlan = {
  id: string;
  tenant_id: string;
  asset_id: string;
  name: string;
  periodicity_days: number;
  next_due_date: string;
  assigned_to: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type PreventivePlanRow = PreventivePlan & {
  asset_name: string | null;
  asset_code: string | null;
  assigned_name: string | null;
};

type Asset = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type TeamMember = {
  id: string;
  full_name: string | null;
  role: string;
};

// Retorno de public.create_preventive_work_order_from_plan (returns table).
type PreventiveWorkOrderResult = {
  work_order_id: string;
  order_number: number;
  next_due_date: string;
};

const situationLabels: Record<PlanSituation, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  late: 'Atrasada',
};

const emptyForm = {
  asset_id: '',
  name: '',
  periodicity_days: '30',
  next_due_date: '',
  assigned_to: '',
  is_active: true,
  notes: '',
};

function formatRole(role: string) {
  const roles: Record<string, string> = {
    tenant_admin: 'Administrador do cliente',
    navigation: 'Navegação',
    netsecbr_admin: 'Administrador NETSECBR',
    netsecbr_support: 'Suporte NETSECBR',
  };

  return roles[role] || role;
}

// Data local (fuso do usuário) no formato YYYY-MM-DD, comparável com a coluna date.
function todayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDate(value: string | null) {
  if (!value) return '—';

  const [year, month, day] = value.split('-');

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

function getPlanSituation(
  plan: { is_active: boolean; next_due_date: string },
  today: string,
): PlanSituation {
  if (!plan.is_active) return 'inactive';

  return plan.next_due_date < today ? 'late' : 'active';
}

function situationClassName(situation: PlanSituation) {
  if (situation === 'late') return 'badge preventive-plan-situation-late';

  return `badge ${situation === 'active' ? 'asset-status-active' : 'asset-status-inactive'}`;
}

export function PreventivePlanAdmin({ tenantId, canManage }: Props) {
  const [plans, setPlans] = useState<PreventivePlanRow[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState('');
  const [situationFilter, setSituationFilter] = useState<'all' | PlanSituation>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingWorkOrder, setIsGeneratingWorkOrder] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PreventivePlanRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const isDetailView = isFormOpen && editingPlan !== null;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    const { data: plansData, error: plansError } = await supabase
      .from('maintenance_plans')
      .select(
        'id, tenant_id, asset_id, name, periodicity_days, next_due_date, assigned_to, is_active, notes, created_at, updated_at, assets(name, code)',
      )
      .eq('tenant_id', tenantId)
      .order('next_due_date');

    if (plansError) {
      setErrorMessage(`Não foi possível carregar os planos preventivos: ${plansError.message}`);
      setIsLoading(false);
      return;
    }

    const [
      { data: assetData, error: assetError },
      { data: membershipData, error: membershipError },
    ] = await Promise.all([
      supabase
        .from('assets')
        .select('id, code, name, status')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('name'),
      supabase
        .from('tenant_memberships')
        .select('user_id, role')
        .eq('tenant_id', tenantId)
        .eq('is_active', true),
    ]);

    if (assetError || membershipError) {
      setErrorMessage(
        `Não foi possível carregar os dados de apoio: ${
          assetError?.message ?? membershipError?.message
        }`,
      );
      setIsLoading(false);
      return;
    }

    setAssets((assetData ?? []) as Asset[]);

    const userIds = (membershipData ?? []).map((membership) => membership.user_id);
    const namesById = new Map<string, string | null>();

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

      (profiles ?? []).forEach((profile) => {
        namesById.set(profile.id, profile.full_name);
      });

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

    setPlans(
      (plansData ?? []).map((plan: any) => ({
        ...plan,
        asset_name: plan.assets?.name ?? null,
        asset_code: plan.assets?.code ?? null,
        assigned_name: plan.assigned_to ? namesById.get(plan.assigned_to) ?? null : null,
      })),
    );
    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Referência da tela: "Atrasada" depende da data atual do usuário.
  const today = todayIsoDate();

  const filteredPlans = plans.filter((plan) => {
    const matchesSearch = `${plan.asset_name ?? ''} ${plan.asset_code ?? ''} ${plan.name} ${
      plan.assigned_name ?? ''
    }`
      .toLowerCase()
      .includes(search.toLowerCase());

    if (!matchesSearch) return false;

    return situationFilter === 'all' ? true : getPlanSituation(plan, today) === situationFilter;
  });

  const availableAssets = assets.filter(
    (asset) => asset.status !== 'retired' || asset.id === editingPlan?.asset_id,
  );

  function getAssetLabel(assetId: string) {
    const asset = assets.find((item) => item.id === assetId);

    return asset ? `${asset.code} · ${asset.name}` : 'Ativo removido';
  }

  function openNewPlan() {
    setMessage('');
    setErrorMessage('');
    setEditingPlan(null);
    setForm({
      ...emptyForm,
      asset_id: availableAssets[0]?.id ?? '',
    });
    setIsFormOpen(true);
  }

  function openEditPlan(plan: PreventivePlanRow) {
    setMessage('');
    setErrorMessage('');
    setEditingPlan(plan);
    setForm({
      asset_id: plan.asset_id,
      name: plan.name,
      periodicity_days: String(plan.periodicity_days),
      next_due_date: plan.next_due_date,
      assigned_to: plan.assigned_to ?? '',
      is_active: plan.is_active,
      notes: plan.notes ?? '',
    });
    setIsFormOpen(true);
  }

  async function savePlan(event: FormEvent) {
    event.preventDefault();

    const periodicity = Number(form.periodicity_days);

    if (!form.asset_id) {
      setErrorMessage('Selecione o ativo do plano preventivo.');
      return;
    }

    if (form.name.trim().length < 3) {
      setErrorMessage('A atividade precisa ter pelo menos 3 caracteres.');
      return;
    }

    if (!Number.isInteger(periodicity) || periodicity < 1 || periodicity > 3650) {
      setErrorMessage('A periodicidade deve ser um número inteiro entre 1 e 3650 dias.');
      return;
    }

    if (!form.next_due_date) {
      setErrorMessage('Informe a próxima execução do plano preventivo.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const payload = {
      asset_id: form.asset_id,
      name: form.name.trim(),
      periodicity_days: periodicity,
      next_due_date: form.next_due_date,
      assigned_to: form.assigned_to || null,
      is_active: form.is_active,
      notes: form.notes.trim() || null,
    };

    const { error } = editingPlan
      ? await supabase.from('maintenance_plans').update(payload).eq('id', editingPlan.id)
      : await supabase.from('maintenance_plans').insert({ ...payload, tenant_id: tenantId });

    if (error) {
      setErrorMessage(`Não foi possível salvar o plano preventivo: ${error.message}`);
    } else {
      setMessage(
        editingPlan
          ? 'Plano preventivo atualizado com sucesso.'
          : 'Plano preventivo cadastrado com sucesso.',
      );
      setIsFormOpen(false);
      setEditingPlan(null);
      await loadData();
    }

    setIsSaving(false);
  }

  async function togglePlanStatus(plan: PreventivePlanRow) {
    const nextIsActive = !plan.is_active;

    if (
      !window.confirm(
        `Deseja ${nextIsActive ? 'ativar' : 'desativar'} o plano ${plan.name}?`,
      )
    ) {
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('maintenance_plans')
      .update({ is_active: nextIsActive })
      .eq('id', plan.id);

    if (error) {
      setErrorMessage(`Não foi possível atualizar o plano preventivo: ${error.message}`);
    } else {
      setMessage(`Plano preventivo ${nextIsActive ? 'ativado' : 'desativado'} com sucesso.`);

      // O detalhe permanece aberto e sincronizado com o banco: plano e formulário passam a
      // refletir o novo estado, evitando que "Salvar alterações" reverta a ativação/desativação
      // e liberando o botão "Gerar OS preventiva" quando o plano é ativado.
      setEditingPlan((current) =>
        current && current.id === plan.id ? { ...current, is_active: nextIsActive } : current,
      );
      setForm((current) => ({ ...current, is_active: nextIsActive }));

      await loadData();
    }

    setIsSaving(false);
  }

  async function generatePreventiveWorkOrder(plan: PreventivePlanRow) {
    if (!canManage || !plan.is_active) return;

    if (
      !window.confirm(
        'Gerar a OS preventiva para esta atividade? A próxima execução do plano será atualizada.',
      )
    ) {
      return;
    }

    setIsGeneratingWorkOrder(true);
    setMessage('');
    setErrorMessage('');

    const { data, error } = await supabase.rpc(
      'create_preventive_work_order_from_plan',
      { target_plan_id: plan.id },
    );

    const generatedWorkOrder = (data?.[0] ?? null) as PreventiveWorkOrderResult | null;

    if (error || !generatedWorkOrder) {
      // Falha na geração: a próxima execução exibida permanece como estava.
      setErrorMessage(
        `Não foi possível gerar a OS preventiva: ${
          error?.message ?? 'Erro desconhecido'
        }`,
      );
      setIsGeneratingWorkOrder(false);
      return;
    }

    // Sucesso: permanece no detalhe exibindo a nova próxima execução devolvida pela RPC.
    setEditingPlan({
      ...plan,
      next_due_date: generatedWorkOrder.next_due_date,
      updated_at: new Date().toISOString(),
    });
    setForm((current) => ({ ...current, next_due_date: generatedWorkOrder.next_due_date }));
    setIsGeneratingWorkOrder(false);
    setMessage(`OS preventiva #${generatedWorkOrder.order_number} gerada com sucesso.`);
    await loadData();
  }

  return (
    <section className="content asset-admin">
      {!isDetailView && (
        <div className="user-admin-actions">
          <div className="asset-search">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar preventiva..."
            />
          </div>

          <select
            className="status-filter"
            value={situationFilter}
            onChange={(event) =>
              setSituationFilter(event.target.value as 'all' | PlanSituation)
            }
          >
            <option value="all">Todas as situações</option>
            {(Object.keys(situationLabels) as PlanSituation[]).map((situation) => (
              <option key={situation} value={situation}>
                {situationLabels[situation]}
              </option>
            ))}
          </select>

          {canManage && (
            <button
              className="button-with-icon"
              onClick={openNewPlan}
              disabled={isSaving || isLoading}
              title="Cadastrar nova preventiva"
            >
              <Plus size={17} />
              Nova preventiva
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
      )}

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

      {isFormOpen && canManage && (
        <form className="new-user-form panel" onSubmit={savePlan}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">PLANO PREVENTIVO</p>
              <h2>{editingPlan ? `Preventiva: ${editingPlan.name}` : 'Nova preventiva'}</h2>
            </div>

            {isDetailView ? (
              <button
                type="button"
                className="secondary"
                onClick={() => setIsFormOpen(false)}
              >
                Voltar para preventivas
              </button>
            ) : (
              <button
                type="button"
                className="secondary icon-action"
                title="Cancelar"
                aria-label="Cancelar"
                onClick={() => setIsFormOpen(false)}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {editingPlan && (
            <div className="order-summary">
              <p>
                <strong>Ativo:</strong>{' '}
                {editingPlan.asset_name ?? getAssetLabel(editingPlan.asset_id)} ·{' '}
                <strong>Periodicidade:</strong> {editingPlan.periodicity_days} dias ·{' '}
                <strong>Próxima execução:</strong> {formatDate(editingPlan.next_due_date)} ·{' '}
                <strong>Situação:</strong> {situationLabels[getPlanSituation(editingPlan, today)]}
              </p>
              <p>
                <strong>Cadastrado em:</strong>{' '}
                {new Date(editingPlan.created_at).toLocaleString('pt-BR')} ·{' '}
                <strong>Atualizado em:</strong>{' '}
                {new Date(editingPlan.updated_at).toLocaleString('pt-BR')}
              </p>
            </div>
          )}

          <div className="asset-form-grid">
            <label className="field">
              <span>Ativo *</span>
              <select
                required
                value={form.asset_id}
                onChange={(event) => setForm({ ...form, asset_id: event.target.value })}
              >
                <option value="">Selecione</option>
                {availableAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.code} · {asset.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field preventive-plan-activity-field">
              <span>Atividade *</span>
              <input
                required
                minLength={3}
                maxLength={180}
                value={form.name}
                placeholder="Ex.: Lubrificação dos redutores do eixo 3"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>

            <label className="field">
              <span>Periodicidade (dias) *</span>
              <input
                required
                type="number"
                min={1}
                max={3650}
                step={1}
                value={form.periodicity_days}
                placeholder="Ex.: 30"
                onChange={(event) =>
                  setForm({ ...form, periodicity_days: event.target.value })
                }
              />
            </label>

            <label className="field">
              <span>Próxima execução *</span>
              <input
                required
                type="date"
                value={form.next_due_date}
                onChange={(event) =>
                  setForm({ ...form, next_due_date: event.target.value })
                }
              />
            </label>

            <label className="field">
              <span>Responsável</span>
              <select
                value={form.assigned_to}
                onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}
              >
                <option value="">Não atribuído</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {`${member.full_name ?? 'Usuário sem nome'} · ${formatRole(member.role)}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Situação</span>
              <select
                value={form.is_active ? 'active' : 'inactive'}
                onChange={(event) =>
                  setForm({ ...form, is_active: event.target.value === 'active' })
                }
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>

            <label className="field asset-form-notes">
              <span>Observações</span>
              <textarea
                rows={3}
                value={form.notes}
                placeholder="Instruções, EPIs necessários, itens de inspeção..."
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>
          </div>

          <div className="form-actions">
            {editingPlan && editingPlan.is_active && (
              <button
                type="button"
                className="secondary button-with-icon"
                disabled={isSaving || isGeneratingWorkOrder}
                onClick={() => void generatePreventiveWorkOrder(editingPlan)}
              >
                <Wrench size={17} />
                {isGeneratingWorkOrder ? 'Gerando OS...' : 'Gerar OS preventiva'}
              </button>
            )}

            {editingPlan && (
              <button
                type="button"
                className="secondary"
                disabled={isSaving || isGeneratingWorkOrder}
                onClick={() => void togglePlanStatus(editingPlan)}
              >
                {editingPlan.is_active ? 'Desativar plano' : 'Ativar plano'}
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving || isGeneratingWorkOrder}
              className="button-with-icon"
            >
              {isSaving
                ? 'Salvando...'
                : editingPlan
                  ? 'Salvar alterações'
                  : 'Cadastrar preventiva'}
            </button>

            <button
              type="button"
              className="secondary"
              disabled={isSaving || isGeneratingWorkOrder}
              onClick={() => setIsFormOpen(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!isDetailView && (
        <article className="panel table">
          <div className="table-head preventive-plan-table-head">
            <span>ATIVO</span>
            <span>ATIVIDADE</span>
            <span>PERIODICIDADE</span>
            <span>PRÓXIMA EXECUÇÃO</span>
            <span>RESPONSÁVEL</span>
            <span>SITUAÇÃO</span>
          </div>

          {isLoading && (
            <div className="empty-state">Carregando planos preventivos...</div>
          )}

          {!isLoading && filteredPlans.length === 0 && (
            <div className="empty-state">
              {search || situationFilter !== 'all'
                ? 'Nenhum plano preventivo encontrado para os filtros.'
                : 'Nenhum plano preventivo cadastrado para este cliente.'}
            </div>
          )}

          {!isLoading &&
            filteredPlans.map((plan) => {
              const situation = getPlanSituation(plan, today);

              return (
                <div className="table-row preventive-plan-table-row" key={plan.id}>
                  <div>
                    <span>{plan.asset_name ?? 'Ativo removido'}</span>
                    <small>{plan.asset_code ?? '—'}</small>
                  </div>

                  <div>
                    {canManage ? (
                      <button
                        type="button"
                        className="work-order-link"
                        onClick={() => openEditPlan(plan)}
                      >
                        {plan.name}
                      </button>
                    ) : (
                      <span>{plan.name}</span>
                    )}
                  </div>

                  <span>{plan.periodicity_days} dias</span>
                  <span>{formatDate(plan.next_due_date)}</span>
                  <span>{plan.assigned_name ?? 'Não atribuído'}</span>
                  <span>
                    <span className={situationClassName(situation)}>
                      {situationLabels[situation]}
                    </span>
                  </span>
                </div>
              );
            })}
        </article>
      )}
    </section>
  );
}
