import { useEffect, useMemo, useState } from 'react';
import { IndustrialChecklistEditor, type ChecklistActivity, type ChecklistEntry } from './industrial-checklist-editor';
import { ReportPhotoPicker } from './report-photo-picker';
import { ReportSignaturePad } from './report-signature-pad';
import { advancePreventiveStage, validateChecklist, type PreventiveStage } from './preventive-local-workflow';

type Props = {
  order: {
    id: string;
    orderNumber: number;
    title: string;
    assetName: string;
    unitName: string;
    scheduledFor: string | null;
  };
  tenantName: string;
  actorId: string;
  actorName: string;
  canSimulateSupervisor: boolean;
  onClose: () => void;
};

type LocalDraft = { entries: ChecklistEntry[]; technicalNotes: string; savedAt: string };

// Atividades ilustrativas: NÃO são extraídas de planos, snapshots ou OS reais.
const sampleActivities: ChecklistActivity[] = [
  { id: 'sample-visual', title: 'Inspeção visual de segurança', instruction: 'Exemplo local: verificar condições gerais e proteções.' },
  { id: 'sample-measurement', title: 'Medição operacional', instruction: 'Exemplo local: registrar valor e unidade da medição.' },
  { id: 'sample-functional', title: 'Teste funcional', instruction: 'Exemplo local: registrar resultado do teste após a intervenção.' },
];

const stageLabels: Record<PreventiveStage, string> = {
  execution: 'Execução técnica',
  report: 'Relatório técnico',
  supervisor_review: 'Revisão do supervisor',
  returned: 'Devolvido para correção',
  acceptance: 'Termo de aceite',
  final: 'Prévia final local',
};

const resultLabels: Record<ChecklistEntry['result'], string> = {
  pending: 'Pendente', ok: 'Conforme', not_ok: 'Não conforme', not_applicable: 'Não se aplica',
};

function readLocalDraft(key: string): LocalDraft | null {
  try {
    const value = sessionStorage.getItem(key);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const draft = parsed as Partial<LocalDraft>;
    if (!Array.isArray(draft.entries) || typeof draft.technicalNotes !== 'string' || typeof draft.savedAt !== 'string') return null;
    return draft as LocalDraft;
  } catch {
    return null;
  }
}

export function PreventiveExecutionLocal({ order, tenantName, actorId, actorName, canSimulateSupervisor, onClose }: Props) {
  const storageKey = `marv-local-preventive-draft:${actorId}:${order.id}`;
  const [savedDraft, setSavedDraft] = useState<LocalDraft | null>(() => readLocalDraft(storageKey));
  const [entries, setEntries] = useState<ChecklistEntry[]>(() => readLocalDraft(storageKey)?.entries ?? []);
  const [technicalNotes, setTechnicalNotes] = useState(() => readLocalDraft(storageKey)?.technicalNotes ?? '');
  const [photosByActivity, setPhotosByActivity] = useState<Record<string, File[]>>({});
  const [stage, setStage] = useState<PreventiveStage>('execution');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorNote, setSupervisorNote] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signature, setSignature] = useState<Blob | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<{ activityId: string; name: string; url: string }[]>([]);
  const [message, setMessage] = useState('');

  const allPhotos = useMemo(
    () => Object.entries(photosByActivity).flatMap(([activityId, files]) => files.map((file) => ({ activityId, file }))),
    [photosByActivity],
  );

  useEffect(() => {
    const next = allPhotos.map(({ activityId, file }) => ({ activityId, name: file.name, url: URL.createObjectURL(file) }));
    setPhotoUrls(next);
    return () => next.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [allPhotos]);

  useEffect(() => {
    if (!signature) {
      setSignatureUrl(null);
      return;
    }
    const url = URL.createObjectURL(signature);
    setSignatureUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [signature]);

  function saveDraft() {
    const draft: LocalDraft = { entries, technicalNotes, savedAt: new Date().toISOString() };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
      setSavedDraft(draft);
      setMessage('Rascunho de texto salvo somente nesta aba. Fotos e assinatura não são recuperadas após recarga. Nada foi enviado ao Supabase.');
    } catch {
      setMessage('O navegador não permitiu salvar o rascunho nesta sessão. Os dados permanecem apenas enquanto esta tela estiver aberta.');
    }
  }

  function openReport() {
    const checklistError = validateChecklist(sampleActivities, entries);
    if (checklistError) return setMessage(checklistError);
    if (technicalNotes.trim().length < 10) return setMessage('Descreva o serviço executado em pelo menos 10 caracteres.');
    setMessage('');
    setStage(advancePreventiveStage(stage, 'view_report'));
  }

  function submitReport() {
    setStage(advancePreventiveStage(stage, 'send_to_supervisor'));
    setMessage('Envio simulado nesta aba. Nenhum supervisor recebeu o relatório.');
  }

  function review(approved: boolean) {
    if (!canSimulateSupervisor) return setMessage('Somente o administrador pode simular a revisão nesta tela local.');
    if (supervisorName.trim().length < 3) return setMessage('Informe o nome do supervisor de teste.');
    if (supervisorName.trim().toLocaleLowerCase('pt-BR') === actorName.trim().toLocaleLowerCase('pt-BR')) {
      return setMessage('O executor não pode simular a aprovação do próprio trabalho.');
    }
    if (!approved && supervisorNote.trim().length < 10) return setMessage('Explique a devolução em pelo menos 10 caracteres.');
    if (approved) {
      setStage(advancePreventiveStage(stage, 'approve'));
      setMessage('Aprovação apenas visual. O termo de aceite ainda precisa de assinatura.');
    } else {
      setReturnReason(supervisorNote.trim());
      setStage(advancePreventiveStage(stage, 'return_for_correction'));
      setMessage('Devolução simulada nesta aba. Corrija e reenvie o relatório.');
    }
  }

  function signAcceptance() {
    if (signerName.trim().length < 3 || !signature) return setMessage('Informe o nome do representante e capture sua assinatura antes de continuar.');
    setStage(advancePreventiveStage(stage, 'sign_acceptance'));
    setMessage('Aceite simulado localmente. Não houve assinatura eletrônica auditável nem conclusão da OS real.');
  }

  async function printPdf() {
    await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>('#marv-preventive-print img')).map((img) => img.decode().catch(() => undefined)));
    window.print();
  }

  const report = (
    <article id="marv-preventive-print" className="panel marv-local-report">
      <p className="eyebrow">MARV INDUSTRIAL · RELATÓRIO DE TESTE LOCAL</p>
      <h2>Relatório de execução preventiva</h2>
      <p><strong>RASCUNHO LOCAL — SEM VALIDADE OPERACIONAL</strong></p>
      <p><strong>Cliente:</strong> {tenantName} · <strong>Unidade:</strong> {order.unitName}</p>
      <p><strong>Ativo:</strong> {order.assetName} · <strong>OS de referência:</strong> #{order.orderNumber}</p>
      <p><strong>Serviço:</strong> {order.title}</p>
      <p><strong>Programação exibida na OS:</strong> {order.scheduledFor ? new Date(order.scheduledFor).toLocaleString('pt-BR') : 'Não informada'}</p>
      <p><strong>Executor desta simulação:</strong> {actorName}</p>
      <h3>Atividades de exemplo — não extraídas do plano real</h3>
      {sampleActivities.map((activity) => {
        const entry = entries.find((item) => item.activityId === activity.id);
        return <section key={activity.id} className="marv-local-report-activity">
          <h4>{activity.title}</h4>
          <p><strong>Resultado:</strong> {resultLabels[entry?.result ?? 'pending']}</p>
          {entry?.measurement && <p><strong>Medição:</strong> {entry.measurement}</p>}
          {entry?.observation && <p><strong>Observações:</strong> {entry.observation}</p>}
          {entry?.nonconformity && <p><strong>Não conformidade:</strong> {entry.nonconformity}</p>}
          {photoUrls.filter((photo) => photo.activityId === activity.id).map((photo) => <figure key={photo.url}><img src={photo.url} alt={`Fotografia: ${photo.name}`} /><figcaption>{photo.name}</figcaption></figure>)}
        </section>;
      })}
      <h3>Descrição do serviço</h3>
      <p style={{ whiteSpace: 'pre-wrap' }}>{technicalNotes}</p>
      {stage !== 'execution' && stage !== 'report' && <p><strong>Etapa visual:</strong> {stageLabels[stage]}</p>}
      {stage === 'acceptance' || stage === 'final' ? <section>
        <h3>Termo de aceite — simulação</h3>
        <p>O representante confirma ter recebido as informações descritas neste relatório de teste. Este registro local não substitui o termo definitivo, a validação de identidade ou o arquivo auditável.</p>
        {stage === 'final' && <><p><strong>Representante:</strong> {signerName}</p>{signatureUrl && <img className="marv-local-signature" src={signatureUrl} alt="Assinatura capturada nesta sessão" />}</>}
      </section> : null}
    </article>
  );

  return <section className="content asset-admin marv-local-execution">
    <div className="panel-head">
      <div><p className="eyebrow">PROTÓTIPO LOCAL · OS #{order.orderNumber}</p><h2>Execução preventiva</h2></div>
      <button type="button" className="secondary" onClick={onClose}>Voltar à OS</button>
    </div>
    <div className="operation-toast operation-toast-error" role="note">Nenhuma alteração será gravada na OS, no plano ou no banco. Atividades abaixo são exemplos de teste, não o checklist real.</div>
    <p><strong>Etapa:</strong> {stageLabels[stage]}</p>
    {message && <p role="status">{message}</p>}
    {stage === 'execution' && <>
      {savedDraft && <p>Último rascunho de texto nesta aba: {new Date(savedDraft.savedAt).toLocaleString('pt-BR')}.</p>}
      <IndustrialChecklistEditor activities={sampleActivities} entries={entries} onChange={setEntries} />
      {sampleActivities.map((activity) => <div key={activity.id} className="panel" style={{ marginBottom: 12 }}>
        <h3>Fotos — {activity.title}</h3>
        <ReportPhotoPicker files={photosByActivity[activity.id] ?? []} onChange={(files) => setPhotosByActivity((current) => ({ ...current, [activity.id]: files }))} />
      </div>)}
      <label className="field"><span>Descrição do serviço executado</span><textarea value={technicalNotes} rows={6} maxLength={10000} style={{ width: '100%' }} onChange={(event) => setTechnicalNotes(event.target.value)} /></label>
      <div className="user-admin-actions"><button type="button" className="secondary" onClick={saveDraft}>Salvar rascunho nesta aba</button><button type="button" onClick={openReport}>Visualizar relatório</button></div>
    </>}
    {stage === 'returned' && <div className="panel"><p><strong>Motivo da devolução:</strong> {returnReason}</p><button type="button" onClick={() => { setStage(advancePreventiveStage(stage, 'resume_correction')); setMessage(''); }}>Corrigir execução</button></div>}
    {stage === 'report' && <>{report}<div className="user-admin-actions"><button type="button" className="secondary" onClick={() => setStage(advancePreventiveStage(stage, 'edit_execution'))}>Voltar à execução</button><button type="button" onClick={submitReport}>Enviar para revisão visual</button></div></>}
    {stage === 'supervisor_review' && <>{report}<div className="panel"><h3>Decisão do supervisor — somente simulação local</h3><label className="field"><span>Nome do supervisor de teste</span><input value={supervisorName} maxLength={120} onChange={(event) => setSupervisorName(event.target.value)} /></label><label className="field"><span>Observações / motivo da devolução</span><textarea value={supervisorNote} rows={3} style={{ width: '100%' }} onChange={(event) => setSupervisorNote(event.target.value)} /></label><div className="user-admin-actions"><button type="button" className="secondary" disabled={!canSimulateSupervisor} onClick={() => review(false)}>Devolver para correção</button><button type="button" disabled={!canSimulateSupervisor} onClick={() => review(true)}>Aprovar visualmente</button></div></div></>}
    {stage === 'acceptance' && <>{report}<div className="panel"><h3>Coleta local do aceite</h3><label className="field"><span>Nome do representante do cliente</span><input value={signerName} maxLength={120} onChange={(event) => setSignerName(event.target.value)} /></label><ReportSignaturePad onChange={setSignature} /><button type="button" onClick={signAcceptance}>Confirmar aceite de teste</button></div></>}
    {stage === 'final' && <>{report}<p>Para gerar um PDF local, use a opção “Salvar como PDF” na janela de impressão. O arquivo não será enviado nem arquivado pelo MARV.</p><button type="button" onClick={() => void printPdf()}>Imprimir / salvar como PDF</button></>}
  </section>;
}
