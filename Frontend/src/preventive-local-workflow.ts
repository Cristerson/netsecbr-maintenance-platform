import type { ChecklistActivity, ChecklistEntry } from './industrial-checklist-editor';

export type PreventiveStage =
  | 'execution'
  | 'report'
  | 'supervisor_review'
  | 'returned'
  | 'acceptance'
  | 'final';

export type PreventiveEvent =
  | 'view_report'
  | 'edit_execution'
  | 'send_to_supervisor'
  | 'return_for_correction'
  | 'resume_correction'
  | 'approve'
  | 'sign_acceptance';

const transitions: Record<PreventiveStage, Partial<Record<PreventiveEvent, PreventiveStage>>> = {
  execution: { view_report: 'report' },
  report: { edit_execution: 'execution', send_to_supervisor: 'supervisor_review' },
  supervisor_review: { return_for_correction: 'returned', approve: 'acceptance' },
  returned: { resume_correction: 'execution' },
  acceptance: { sign_acceptance: 'final' },
  final: {},
};

export function advancePreventiveStage(stage: PreventiveStage, event: PreventiveEvent): PreventiveStage {
  const next = transitions[stage][event];
  if (!next) throw new Error(`Transição inválida: ${stage} → ${event}`);
  return next;
}

export function validateChecklist(activities: ChecklistActivity[], entries: ChecklistEntry[]): string | null {
  if (activities.length === 0) return 'O checklist não possui atividades de teste.';
  for (const activity of activities) {
    const entry = entries.find((item) => item.activityId === activity.id);
    if (!entry || entry.result === 'pending') return `Informe o resultado de: ${activity.title}.`;
    if (entry.result === 'not_ok' && entry.nonconformity.trim().length < 5) {
      return `Descreva a não conformidade de: ${activity.title}.`;
    }
  }
  return null;
}
