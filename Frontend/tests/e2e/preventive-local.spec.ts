import { expect, test } from '@playwright/test';
import { advancePreventiveStage, validateChecklist } from '../../src/preventive-local-workflow';

const activities = [{ id: 'inspect', title: 'Inspeção visual' }];

test('fluxo local exige revisão antes do aceite', () => {
  let stage = advancePreventiveStage('execution', 'view_report');
  stage = advancePreventiveStage(stage, 'send_to_supervisor');
  stage = advancePreventiveStage(stage, 'approve');
  expect(stage).toBe('acceptance');
  expect(() => advancePreventiveStage(stage, 'approve')).toThrow('Transição inválida');
  expect(advancePreventiveStage(stage, 'sign_acceptance')).toBe('final');
});

test('devolução volta à execução, sem pular a aprovação', () => {
  const returned = advancePreventiveStage('supervisor_review', 'return_for_correction');
  expect(returned).toBe('returned');
  expect(advancePreventiveStage(returned, 'resume_correction')).toBe('execution');
  expect(() => advancePreventiveStage(returned, 'sign_acceptance')).toThrow('Transição inválida');
});

test('checklist incompleto ou não conformidade sem texto são barrados', () => {
  expect(validateChecklist(activities, [])).toContain('Inspeção visual');
  expect(validateChecklist(activities, [{ activityId: 'inspect', result: 'not_ok', measurement: '', observation: '', nonconformity: '' }])).toContain('não conformidade');
});

test('checklist preenchido permite prévia local', () => {
  expect(validateChecklist(activities, [{ activityId: 'inspect', result: 'ok', measurement: '42 °C', observation: 'Estável', nonconformity: '' }])).toBeNull();
});
