import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles.css';
import { PreventiveExecutionLocal } from '../../src/preventive-execution-local';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreventiveExecutionLocal
      order={{
        id: '00000000-0000-4000-8000-000000000001',
        orderNumber: 999999,
        title: 'Teste local de preventiva — sem banco',
        assetName: 'Ativo fictício QA',
        unitName: 'Unidade fictícia QA',
        scheduledFor: '2026-11-01T12:00:00.000Z',
      }}
      tenantName="Cliente fictício QA"
      actorId="00000000-0000-4000-8000-000000000002"
      actorName="Técnico QA"
      canSimulateSupervisor
      onClose={() => { /* Fixture isolada: sem navegação real. */ }}
    />
  </React.StrictMode>,
);
