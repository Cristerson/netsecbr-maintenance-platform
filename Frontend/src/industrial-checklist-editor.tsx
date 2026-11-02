export type ChecklistActivity = {
  id: string;
  title: string;
  instruction?: string | null;
};

export type ChecklistEntry = {
  activityId: string;
  result: 'pending' | 'ok' | 'not_ok' | 'not_applicable';
  measurement: string;
  measurementUnit?: string;
  measurementPoint?: string;
  observation: string;
  nonconformity: string;
};

type Props = {
  activities: ChecklistActivity[];
  entries: ChecklistEntry[];
  onChange: (entries: ChecklistEntry[]) => void;
  disabled?: boolean;
};

const emptyEntry = (activityId: string): ChecklistEntry => ({
  activityId,
  result: 'pending',
  measurement: '',
  measurementUnit: '',
  measurementPoint: '',
  observation: '',
  nonconformity: '',
});

/** Editor local; a persistência deve usar snapshot e autorização no backend. */
export function IndustrialChecklistEditor({ activities, entries, onChange, disabled = false }: Props) {
  function updateEntry(activityId: string, patch: Partial<ChecklistEntry>) {
    if (disabled) return;
    const current = entries.find((entry) => entry.activityId === activityId) ?? emptyEntry(activityId);
    const next = activities.map((activity) =>
      activity.id === activityId
        ? { ...current, ...patch, activityId }
        : entries.find((entry) => entry.activityId === activity.id) ?? emptyEntry(activity.id),
    );
    onChange(next);
  }

  return (
    <section aria-label="Checklist da manutenção">
      {activities.map((activity, index) => {
        const entry = entries.find((item) => item.activityId === activity.id) ?? emptyEntry(activity.id);
        const prefix = `checklist-${activity.id}`;
        return (
          <div className="panel" key={activity.id} style={{ marginBottom: 12 }}>
            <h3>{index + 1}. {activity.title}</h3>
            {activity.instruction && <p>{activity.instruction}</p>}
            <label className="field" htmlFor={`${prefix}-result`}>
              <span>Resultado</span>
              <select id={`${prefix}-result`} value={entry.result} disabled={disabled} onChange={(event) => updateEntry(activity.id, { result: event.target.value as ChecklistEntry['result'] })}>
                <option value="pending">Pendente</option>
                <option value="ok">Conforme</option>
                <option value="not_ok">Não conforme</option>
                <option value="not_applicable">Não se aplica</option>
              </select>
            </label>
            <label className="field" htmlFor={`${prefix}-measurement`}>
              <span>Valor medido</span>
              <input id={`${prefix}-measurement`} type="number" step="any" inputMode="decimal" value={entry.measurement} disabled={disabled} onChange={(event) => updateEntry(activity.id, { measurement: event.target.value })} />
            </label>
            <label className="field" htmlFor={`${prefix}-unit`}>
              <span>Unidade da medição</span>
              <input id={`${prefix}-unit`} value={entry.measurementUnit ?? ''} disabled={disabled} maxLength={40} placeholder="Ex.: °C, h, mm" onChange={(event) => updateEntry(activity.id, { measurementUnit: event.target.value })} />
            </label>
            <label className="field" htmlFor={`${prefix}-point`}>
              <span>Ponto de medição</span>
              <input id={`${prefix}-point`} value={entry.measurementPoint ?? ''} disabled={disabled} maxLength={160} placeholder="Ex.: redutor do eixo 2" onChange={(event) => updateEntry(activity.id, { measurementPoint: event.target.value })} />
            </label>
            <label className="field" htmlFor={`${prefix}-observation`}>
              <span>Observações</span>
              <textarea id={`${prefix}-observation`} value={entry.observation} disabled={disabled} maxLength={3000} rows={3} style={{ width: '100%' }} onChange={(event) => updateEntry(activity.id, { observation: event.target.value })} />
            </label>
            {entry.result === 'not_ok' && (
              <label className="field" htmlFor={`${prefix}-nonconformity`}>
                <span>Não conformidade</span>
                <textarea id={`${prefix}-nonconformity`} value={entry.nonconformity} disabled={disabled} maxLength={3000} rows={3} style={{ width: '100%' }} onChange={(event) => updateEntry(activity.id, { nonconformity: event.target.value })} />
              </label>
            )}
          </div>
        );
      })}
    </section>
  );
}
