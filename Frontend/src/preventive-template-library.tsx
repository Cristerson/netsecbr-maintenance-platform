import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type PlanChecklistActivity = {
  title: string;
  instruction: string;
  is_optional: boolean;
  requires_photo: boolean;
};

type TemplateActivity = PlanChecklistActivity & { position: number };
const MARV_TEMPLATE_ID = 'eb7a15e6-411d-43d9-8a14-ffed237a97e9';

type Props = {
  tenantId: string;
  assetId: string;
  planId: string | null;
  templateId: string;
  activities: PlanChecklistActivity[];
  onChange: (templateId: string, activities: PlanChecklistActivity[], changed: boolean) => void;
};

export function PreventiveTemplateLibrary({ tenantId, assetId, planId, templateId, activities, onChange }: Props) {
  const [marvActivities, setMarvActivities] = useState<PlanChecklistActivity[]>([]);
  const [sourcePlans, setSourcePlans] = useState<{ id: string; name: string }[]>([]);
  const [sourcePlanId, setSourcePlanId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void supabase.from('preventive_template_activities')
      .select('position,title,instruction,is_optional,requires_photo')
      .eq('template_id', MARV_TEMPLATE_ID).order('position')
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) { setError('Os checklists estarão disponíveis após a migration pendente.'); return; }
        setMarvActivities(((data ?? []) as TemplateActivity[]).map((activity) => ({
          title: activity.title, instruction: activity.instruction ?? '',
          is_optional: activity.is_optional, requires_photo: activity.requires_photo,
        })));
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!planId) return;
    let active = true;
    void supabase.from('preventive_plan_activities')
      .select('title,instruction,is_optional,requires_photo')
      .eq('plan_id', planId).order('position')
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) { setError(`Não foi possível carregar o checklist do plano: ${loadError.message}`); return; }
        onChange(templateId, ((data ?? []) as TemplateActivity[]).map((activity) => ({
          title: activity.title, instruction: activity.instruction ?? '',
          is_optional: activity.is_optional, requires_photo: activity.requires_photo,
        })), false);
      });
    return () => { active = false; };
  }, [planId]);

  useEffect(() => {
    if (!assetId) { setSourcePlans([]); return; }
    let active = true;
    void supabase.from('maintenance_plans').select('id,name')
      .eq('tenant_id', tenantId).eq('asset_id', assetId).order('name')
      .then(({ data }) => {
        if (active) setSourcePlans((data ?? []).filter((plan) => plan.id !== planId));
      });
    return () => { active = false; };
  }, [assetId, tenantId, planId]);

  async function copyFromPlan() {
    if (!sourcePlanId) return;
    const { data, error: copyError } = await supabase.from('preventive_plan_activities')
      .select('title,instruction,is_optional,requires_photo')
      .eq('plan_id', sourcePlanId).order('position');
    if (copyError || !data?.length) {
      setError(copyError?.message ?? 'Este plano não possui atividades estruturadas para copiar.');
      return;
    }
    setError('');
    onChange('', data.map((activity) => ({
      title: activity.title, instruction: activity.instruction ?? '',
      is_optional: activity.is_optional, requires_photo: activity.requires_photo,
    })), true);
  }

  function updateActivity(index: number, patch: Partial<PlanChecklistActivity>) {
    onChange(templateId, activities.map((activity, position) =>
      position === index ? { ...activity, ...patch } : activity), true);
  }

  return <section className="panel preventive-template-library" style={{ width: '100%', marginBlock: 12 }} aria-label="Checklist do plano preventivo" data-activity-count={activities.length}>
    <div className="panel-head"><div><p className="eyebrow">CHECKLIST DO PLANO</p><h3>Escolha como começar</h3></div></div>
    {error && <p role="alert">{error}</p>}
    <div className="preventive-template-options">
      <button type="button" className="secondary" aria-pressed={templateId === MARV_TEMPLATE_ID}
        onClick={() => {
          if (!marvActivities.length) { setError('O Modelo MARV ainda não está disponível.'); return; }
          setError(''); onChange(MARV_TEMPLATE_ID, marvActivities.map((activity) => ({ ...activity })), true);
        }}><strong>MODELO MARV</strong><span>16 atividades sugeridas para robôs industriais. Edite a cópia neste plano.</span></button>
      <button type="button" className="secondary" aria-pressed={templateId !== MARV_TEMPLATE_ID}
        onClick={() => { setError(''); onChange('', [], true); }}><strong>MODELO PERSONALIZADO</strong><span>Monte as atividades do zero.</span></button>
    </div>
    <p className="preventive-template-note">As alterações abaixo pertencem somente a este plano. Periodicidade e ciclo continuam configuráveis.</p>
    {sourcePlans.length > 0 && <div className="preventive-copy-plan">
      <label className="field"><span>Copiar atividades de outro plano deste ativo</span>
        <select value={sourcePlanId} onChange={(event) => setSourcePlanId(event.target.value)}>
          <option value="">Selecione o plano de origem</option>
          {sourcePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
        </select></label>
      <button type="button" className="secondary" disabled={!sourcePlanId} onClick={() => void copyFromPlan()}>Copiar atividades</button>
    </div>}
    <div className="preventive-template-activities">
      {activities.map((activity, index) => <div className="preventive-template-activity" key={`${index}-${templateId}`}>
        <div className="preventive-template-activity-head"><strong>Atividade {index + 1}</strong>
          <div>
            <button type="button" className="secondary" disabled={index === 0} onClick={() => {
              const updated = [...activities]; [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
              onChange(templateId, updated, true);
            }} aria-label={`Subir atividade ${index + 1}`}>↑</button>
            <button type="button" className="secondary" disabled={index === activities.length - 1} onClick={() => {
              const updated = [...activities]; [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
              onChange(templateId, updated, true);
            }} aria-label={`Descer atividade ${index + 1}`}>↓</button>
            <button type="button" className="secondary" onClick={() => onChange(templateId, activities.filter((_, position) => position !== index), true)}
              aria-label={`Remover atividade ${index + 1}`}>Remover</button>
          </div></div>
        <label className="field"><span>Atividade *</span><input value={activity.title} maxLength={180}
          onInput={(event) => updateActivity(index, { title: event.currentTarget.value })} /></label>
        <label className="field"><span>Instrução</span><textarea value={activity.instruction} rows={2} maxLength={3000}
          onInput={(event) => updateActivity(index, { instruction: event.currentTarget.value })} /></label>
        <div className="preventive-template-flags">
          <label><input type="checkbox" checked={activity.is_optional}
            onChange={(event) => updateActivity(index, { is_optional: event.target.checked })} /> Opcional</label>
          <label><input type="checkbox" checked={activity.requires_photo}
            onChange={(event) => updateActivity(index, { requires_photo: event.target.checked })} /> Foto prevista</label>
        </div>
      </div>)}
      <button type="button" className="secondary" onClick={() => onChange(templateId,
        [...activities, { title: '', instruction: '', is_optional: false, requires_photo: false }], true)}>
        Adicionar atividade
      </button>
    </div>
  </section>;
}
