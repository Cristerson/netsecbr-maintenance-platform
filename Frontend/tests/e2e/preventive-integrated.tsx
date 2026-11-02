import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PreventiveChecklistExecution } from '../../src/preventive-checklist-execution';
import { PreventiveTemplateLibrary, type PlanChecklistActivity } from '../../src/preventive-template-library';
import '../../src/styles.css';

function TestScreen() {
  const [templateId, setTemplateId] = useState('');
  const [activities, setActivities] = useState<PlanChecklistActivity[]>([]);
  return <main style={{ margin: 0, width: '100%', padding: 12 }}>
    <PreventiveTemplateLibrary tenantId="22222222-2222-4222-8222-222222222222" assetId="11111111-1111-4111-8111-111111111111" planId={null} templateId={templateId} activities={activities}
      onChange={(nextId, nextActivities) => { setTemplateId(nextId); setActivities(nextActivities); }} />
  <PreventiveChecklistExecution
    workOrderId="11111111-1111-4111-8111-111111111111"
    tenantId="22222222-2222-4222-8222-222222222222"
    canEdit
  />
  </main>;
}

createRoot(document.getElementById('root')!).render(<TestScreen />);
