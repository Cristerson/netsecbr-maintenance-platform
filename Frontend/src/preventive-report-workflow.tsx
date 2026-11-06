import { useCallback, useEffect, useState } from 'react';
import { ReportSignaturePad } from './report-signature-pad';
import { supabase } from './supabase';

type ReportState = 'draft' | 'submitted' | 'returned' | 'approved';
type ReportRevision = {
  id: string;
  revision_number: number;
  state: ReportState;
  is_current: boolean;
  acceptance_required: boolean;
  snapshot: Record<string, unknown>;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  pdf_storage_path: string | null;
  pdf_sha256: string | null;
  pdf_byte_count: number | null;
};
type Signature = {
  representative_name: string;
  captured_at: string;
  collector_name: string | null;
};
type AuditEvent = {
  id: string;
  event_type: string;
  state_before: string | null;
  state_after: string | null;
  changed_by_name: string | null;
  changed_at: string;
  details: Record<string, unknown>;
};
type Props = {
  workOrderId: string;
  tenantId: string;
  orderNumber: number;
  orderStatus: string;
  hasVerifiedCycle: boolean;
  acceptanceRequiredDefault: boolean;
  canEdit: boolean;
  isSupervisor: boolean;
  onCompleted: () => Promise<void>;
};

const stateLabels: Record<ReportState, string> = {
  draft: 'Rascunho', submitted: 'Aguardando revisão', returned: 'Devolvido para correção', approved: 'Aprovado',
};
const auditLabels: Record<string, string> = {
  draft_created: 'Rascunho criado', submitted: 'Enviado para revisão', approved: 'Aprovado pelo supervisor',
  returned: 'Devolvido pelo supervisor', signature_collected: 'Aceite industrial coletado',
  pdf_generated: 'PDF final arquivado', work_order_completed: 'OS preventiva concluída',
};

function safeError(error: unknown, fallback: string) {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? '') : '';
  if (['42P01', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code)) {
    return 'O fluxo de relatório depende da migration preventiva, que ainda não foi aplicada ao banco.';
  }
  if (code === '42501') return 'Seu perfil não tem autorização para esta ação ou unidade.';
  const raw = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message ?? '') : '';
  const message = raw.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[registro]')
    .replace(/[\r\n]+/g, ' ').trim().slice(0, 220);
  return message ? `${fallback} ${message}` : fallback;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—';
}

export function PreventiveReportWorkflow({
  workOrderId, tenantId, orderNumber, orderStatus, hasVerifiedCycle,
  acceptanceRequiredDefault, canEdit, isSupervisor, onCompleted,
}: Props) {
  const [report, setReport] = useState<ReportRevision | null>(null);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [acceptanceRequired, setAcceptanceRequired] = useState(acceptanceRequiredDefault);
  const [representativeName, setRepresentativeName] = useState('');
  const [signaturePng, setSignaturePng] = useState<Blob | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [schemaAvailable, setSchemaAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [{ data, error: reportError }, { data: orderGate, error: orderGateError }] = await Promise.all([
      supabase.from('work_order_report_revisions')
        .select('id,revision_number,state,is_current,acceptance_required,snapshot,reviewed_by_name,reviewed_at,review_reason,pdf_storage_path,pdf_sha256,pdf_byte_count')
        .eq('tenant_id', tenantId).eq('work_order_id', workOrderId).eq('is_current', true).maybeSingle(),
      supabase.from('work_orders').select('preventive_acceptance_required')
        .eq('tenant_id', tenantId).eq('id', workOrderId).single(),
    ]);
    if (reportError || orderGateError) {
      setSchemaAvailable(false);
      setReport(null);
      setSignature(null);
      setAudit([]);
      setError(safeError(reportError ?? orderGateError, 'Não foi possível consultar o relatório preventivo.'));
      setLoading(false);
      return false;
    }

    setSchemaAvailable(true);
    const current = data as ReportRevision | null;
    setReport(current);
    setAcceptanceRequired(current?.acceptance_required ?? orderGate.preventive_acceptance_required ?? acceptanceRequiredDefault);
    setPdfUrl('');
    setSignature(null);
    if (current) {
      const [{ data: signatureRow, error: signatureError }, { data: auditRows, error: auditError }] = await Promise.all([
        supabase.from('work_order_report_signatures')
          .select('representative_name,captured_at,collector_name')
          .eq('report_revision_id', current.id).maybeSingle(),
        supabase.from('work_order_report_audit_log')
          .select('id,event_type,state_before,state_after,changed_by_name,changed_at,details')
          .eq('tenant_id', tenantId).eq('work_order_id', workOrderId)
          .order('changed_at', { ascending: false }).limit(50),
      ]);
      if (signatureError) setError(safeError(signatureError, 'Não foi possível ler o registro de aceite.'));
      else setSignature((signatureRow as Signature | null) ?? null);
      if (auditError) setError((currentError) => currentError || safeError(auditError, 'Não foi possível ler a trilha de auditoria.'));
      else setAudit((auditRows ?? []) as AuditEvent[]);
      if (current.pdf_storage_path) {
        const { data: signed, error: signedError } = await supabase.storage
          .from('work-order-reports').createSignedUrl(current.pdf_storage_path, 600);
        if (signedError) setError((currentError) => currentError || safeError(signedError, 'O PDF está arquivado, mas o acesso temporário falhou.'));
        else setPdfUrl(signed?.signedUrl ?? '');
      }
    } else {
      setAudit([]);
    }
    setLoading(false);
    return true;
  }, [acceptanceRequiredDefault, tenantId, workOrderId]);

  useEffect(() => { void load(); }, [load]);

  async function toggleAcceptance(required: boolean) {
    if (!isSupervisor || !hasVerifiedCycle || report || busy) return;
    setBusy(true); setError(''); setMessage('');
    const { data, error: updateError } = await supabase.rpc('set_preventive_acceptance_required', {
      target_order_id: workOrderId, target_required: required,
    });
    if (updateError || data !== true) {
      setError(safeError(updateError, 'Não foi possível salvar a exigência de aceite desta OS.'));
      setBusy(false);
      return;
    }
    const { data: verified, error: verifyError } = await supabase.from('work_orders')
      .select('preventive_acceptance_required').eq('tenant_id', tenantId).eq('id', workOrderId).single();
    if (verifyError || verified?.preventive_acceptance_required !== required) {
      setError(safeError(verifyError, 'A decisão de aceite não foi confirmada na OS. Atualize antes de continuar.'));
      setBusy(false);
      return;
    }
    setAcceptanceRequired(required);
    if (!await load()) { setBusy(false); return; }
    setMessage(required
      ? 'Esta OS preventiva agora exige aceite do representante. A decisão foi registrada na auditoria.'
      : 'O aceite do representante não será exigido nesta OS. A decisão foi registrada na auditoria.');
    setBusy(false);
  }

  async function createDraft() {
    if (!canEdit || busy || !hasVerifiedCycle) return;
    setBusy(true); setError(''); setMessage('');
    const { data, error: createError } = await supabase.rpc('create_preventive_report_revision', {
      target_order_id: workOrderId,
    });
    const created = Array.isArray(data) ? data[0] : data;
    if (createError || !created?.report_revision_id || created.state !== 'draft') {
      setError(safeError(createError, 'Não foi possível iniciar o relatório preventivo.'));
      setBusy(false);
      return;
    }
    const { data: verified, error: verifyError } = await supabase.from('work_order_report_revisions')
      .select('id,revision_number,state,is_current').eq('id', created.report_revision_id).maybeSingle();
    if (verifyError || !verified || verified.state !== 'draft' || !verified.is_current) {
      setError(safeError(verifyError, 'A nova revisão não foi confirmada como rascunho atual. Atualize antes de continuar.'));
      setBusy(false);
      return;
    }
    if (!await load()) { setBusy(false); return; }
    setMessage(`Rascunho da revisão ${created.revision_number} carregado a partir dos dados persistidos.`);
    setBusy(false);
  }

  async function submitReport() {
    if (!report || !canEdit || busy) return;
    setBusy(true); setError(''); setMessage('');
    const { data, error: submitError } = await supabase.rpc('submit_preventive_report_revision', {
      target_revision_id: report.id,
    });
    if (submitError || data !== true) {
      setError(safeError(submitError, 'Não foi possível enviar o relatório para revisão.'));
      setBusy(false);
      return;
    }
    const { data: verified, error: verifyError } = await supabase.from('work_order_report_revisions')
      .select('state,is_current').eq('id', report.id).maybeSingle();
    if (verifyError || verified?.state !== 'submitted' || !verified.is_current) {
      setError(safeError(verifyError, 'O envio não foi confirmado como revisão atual. Atualize antes de continuar.'));
      setBusy(false);
      return;
    }
    if (!await load()) { setBusy(false); return; }
    setMessage('Relatório enviado para revisão do supervisor com snapshot dos dados persistidos.');
    setBusy(false);
  }

  async function reviewReport(decision: 'approve' | 'return') {
    if (!report || !isSupervisor || busy) return;
    if (decision === 'return' && returnReason.trim().length < 5) {
      setError('Informe o motivo da devolução (mínimo 5 caracteres).');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    const { data, error: reviewError } = await supabase.rpc('review_preventive_report_revision', {
      target_revision_id: report.id, decision, reason: decision === 'return' ? returnReason.trim() : null,
    });
    if (reviewError || data !== (decision === 'approve' ? 'approved' : 'returned')) {
      setError(safeError(reviewError, decision === 'approve'
        ? 'Não foi possível aprovar o relatório.' : 'Não foi possível devolver o relatório.'));
      setBusy(false);
      return;
    }
    const expectedState = decision === 'approve' ? 'approved' : 'returned';
    const { data: verified, error: verifyError } = await supabase.from('work_order_report_revisions')
      .select('state,is_current,reviewed_by_name,reviewed_at').eq('id', report.id).maybeSingle();
    if (verifyError || verified?.state !== expectedState || !verified.is_current || !verified.reviewed_at) {
      setError(safeError(verifyError, 'A decisão do supervisor não foi confirmada na revisão atual. Atualize antes de continuar.'));
      setBusy(false);
      return;
    }
    if (!await load()) { setBusy(false); return; }
    setReturnReason('');
    setMessage(decision === 'approve'
      ? 'Relatório aprovado pelo supervisor. Prossiga com o aceite/PDF configurado para esta OS.'
      : 'Relatório devolvido com motivo registrado na auditoria.');
    setBusy(false);
  }

  async function saveSignature() {
    if (!report || !signaturePng || representativeName.trim().length < 2 || busy) {
      setError('Informe o nome do representante e registre a assinatura na tela.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    const path = `${tenantId}/${workOrderId}/${report.id}/signature.png`;
    const { error: uploadError } = await supabase.storage.from('work-order-reports')
      .upload(path, signaturePng, { contentType: 'image/png', upsert: false });
    if (uploadError) {
      setError(safeError(uploadError, 'Não foi possível armazenar a assinatura no bucket privado.'));
      setBusy(false);
      return;
    }
    const { data: recordedId, error: recordError } = await supabase.rpc('record_preventive_report_signature', {
      target_revision_id: report.id,
      representative: representativeName.trim(),
      target_storage_path: path,
    });
    if (recordError || !recordedId) {
      const { error: cleanupError } = await supabase.storage.from('work-order-reports').remove([path]);
      setError(`${safeError(recordError, 'Não foi possível vincular a assinatura ao relatório.')}${cleanupError ? ' A limpeza do arquivo também falhou; informe o suporte.' : ''}`);
      setBusy(false);
      return;
    }
    const { data: verified, error: verifyError } = await supabase.from('work_order_report_signatures')
      .select('representative_name,captured_at,collector_name').eq('report_revision_id', report.id).maybeSingle();
    if (verifyError || verified?.representative_name !== representativeName.trim() || !verified?.captured_at) {
      setError(safeError(verifyError, 'A assinatura não foi confirmada no relatório. Atualize antes de prosseguir.'));
      setBusy(false);
      return;
    }
    if (!await load()) { setBusy(false); return; }
    setSignaturePng(null);
    setRepresentativeName('');
    setMessage('Assinatura do representante e identidade de quem a coletou foram registradas na auditoria desta OS.');
    setBusy(false);
  }

  async function generatePdf() {
    if (!report || report.state !== 'approved' || !canEdit || !schemaAvailable || busy) return;
    setBusy(true); setError(''); setMessage('');
    const { data, error: functionError } = await supabase.functions.invoke('generate-preventive-report', {
      body: { reportRevisionId: report.id },
    });
    if (functionError || data?.ok !== true) {
      setError(safeError(functionError ?? data, 'Não foi possível gerar/arquivar o PDF final.'));
      setBusy(false);
      return;
    }
    const { data: verified, error: verifyError } = await supabase.from('work_order_report_revisions')
      .select('pdf_storage_path,pdf_sha256,pdf_byte_count').eq('id', report.id).maybeSingle();
    if (verifyError || !verified?.pdf_storage_path || !verified.pdf_sha256 || !verified.pdf_byte_count) {
      setError(safeError(verifyError, 'A função respondeu, mas o PDF não foi confirmado no registro da revisão. Atualize antes de tentar novamente.'));
      setBusy(false);
      return;
    }
    if (!await load()) { setBusy(false); return; }
    setMessage('PDF gerado com dados persistidos e arquivado no Storage privado desta revisão.');
    setBusy(false);
  }

  async function completeOrder() {
    if (!report || !isSupervisor || report.state !== 'approved' || !report.pdf_storage_path || busy) return;
    if (!window.confirm(`Concluir a OS preventiva #${orderNumber}? O relatório aprovado será preservado como registro final.`)) return;
    setBusy(true); setError(''); setMessage('');
    const { data, error: completeError } = await supabase.rpc('complete_preventive_work_order', {
      target_order_id: workOrderId,
    });
    if (completeError || data !== true) {
      setError(safeError(completeError, 'Não foi possível concluir a OS preventiva.'));
      setBusy(false);
      return;
    }
    await onCompleted();
    await load();
    setMessage(`OS preventiva #${orderNumber} concluída com relatório e aceite arquivados.`);
    setBusy(false);
  }

  const canContinue = orderStatus !== 'completed' && orderStatus !== 'cancelled' && hasVerifiedCycle;
  const signatureIsSatisfied = !report?.acceptance_required || Boolean(signature);

  return <section className="panel preventive-report-workflow" aria-label="Relatório final e aceite industrial">
    <div className="panel-head">
      <div><p className="eyebrow">RELATÓRIO E ACEITE</p><h3>Relatório preventivo persistido</h3></div>
      <button type="button" className="secondary" disabled={loading || busy} onClick={() => void load()}>Atualizar</button>
    </div>
    {error && <p role="alert" className="operation-toast operation-toast-error">{error}</p>}
    {message && <p role="status" className="operation-toast operation-toast-success">{message}</p>}
    {loading ? <p role="status">Consultando revisão, assinatura e auditoria...</p> : <>
      {!hasVerifiedCycle && <p className="preventive-report-legacy-warning">
        Esta é uma OS preventiva histórica sem ciclo comprovado. O relatório, a exigência de aceite e a inicialização do checklist ficam somente para consulta; nenhum dado histórico será retrofittado.
      </p>}

      {schemaAvailable && hasVerifiedCycle && isSupervisor && <label className="preventive-acceptance-option">
        <input type="checkbox" checked={report?.acceptance_required ?? acceptanceRequired}
          disabled={!canContinue || Boolean(report) || busy}
          onChange={(event) => void toggleAcceptance(event.target.checked)} />
        <span><strong>Exigir aceite industrial do representante nesta OS</strong>
          <small>Opcional e individual por OS preventiva. A decisão do supervisor é auditada; o padrão é não exigir assinatura.</small></span>
      </label>}
      {schemaAvailable && hasVerifiedCycle && !isSupervisor && <p className="preventive-report-info">
        Aceite industrial nesta OS: <strong>{(report?.acceptance_required ?? acceptanceRequiredDefault) ? 'exigido pelo supervisor' : 'não exigido'}</strong>.
      </p>}

      {report && <div className="preventive-report-status">
        <span className={`badge preventive-report-state-${report.state}`}>Revisão {report.revision_number} · {stateLabels[report.state]}</span>
        {report.reviewed_at && <p>Revisado por <strong>{report.reviewed_by_name ?? 'Supervisor'}</strong> em {formatDate(report.reviewed_at)}.</p>}
        {report.review_reason && <p><strong>Motivo da devolução:</strong> {report.review_reason}</p>}
        <p>Snapshot imutável da revisão: dados de ativo, OS, atividades, medições, observações, não conformidades e evidências persistidas.</p>
      </div>}

      {schemaAvailable && canContinue && !report && canEdit && <button type="button" disabled={busy} onClick={() => void createDraft()}>
        {busy ? 'Preparando...' : 'Iniciar relatório desta OS'}
      </button>}
      {schemaAvailable && canContinue && report?.state === 'draft' && canEdit && <div className="preventive-report-actions">
        <p>O rascunho será atualizado com o estado persistido do checklist ao ser enviado para revisão.</p>
        <button type="button" disabled={busy} onClick={() => void submitReport()}>{busy ? 'Enviando...' : 'Enviar ao supervisor para revisão'}</button>
      </div>}
      {schemaAvailable && canContinue && report?.state === 'returned' && canEdit && <button type="button" disabled={busy} onClick={() => void createDraft()}>
        {busy ? 'Criando revisão...' : 'Criar próxima revisão após correção'}
      </button>}
      {schemaAvailable && report?.state === 'submitted' && !isSupervisor && <p className="preventive-report-info">O relatório está aguardando a revisão do supervisor.</p>}
      {schemaAvailable && report?.state === 'submitted' && isSupervisor && <div className="preventive-report-review">
        <label className="field"><span>Motivo da devolução (obrigatório para devolver)</span>
          <textarea rows={3} maxLength={2000} value={returnReason} onChange={(event) => setReturnReason(event.target.value)} /></label>
        <div className="form-actions">
          <button type="button" disabled={busy} onClick={() => void reviewReport('approve')}>{busy ? 'Salvando...' : 'Aprovar revisão'}</button>
          <button type="button" className="secondary" disabled={busy || returnReason.trim().length < 5}
            onClick={() => void reviewReport('return')}>Devolver com motivo</button>
        </div>
      </div>}

      {schemaAvailable && report?.state === 'approved' && <div className="preventive-report-approved">
        {report.acceptance_required && !signature && <div className="preventive-signature-capture">
          <p>O supervisor marcou esta OS para aceite. A assinatura é capturada no dispositivo e vinculada à revisão aprovada.</p>
          {canEdit && <>
            <label className="field"><span>Nome do representante *</span>
              <input value={representativeName} maxLength={160} onChange={(event) => setRepresentativeName(event.target.value)} /></label>
            <ReportSignaturePad onChange={setSignaturePng} disabled={busy} />
            <button type="button" disabled={busy || !signaturePng || representativeName.trim().length < 2} onClick={() => void saveSignature()}>
              Registrar aceite nesta OS
            </button>
          </>}
        </div>}
        {signature && <div className="preventive-signature-record" role="status">
          <strong>Aceite industrial registrado</strong>
          <span>Representante: {signature.representative_name}</span>
          <span>Coletado por: {signature.collector_name ?? 'Usuário autenticado'}</span>
          <span>Data/hora: {formatDate(signature.captured_at)}</span>
        </div>}
        {!report.pdf_storage_path && <button type="button" disabled={busy || !canEdit || (report.acceptance_required && !signature)} onClick={() => void generatePdf()}>
          {busy ? 'Gerando PDF...' : 'Gerar e arquivar PDF final'}
        </button>}
        {report.pdf_storage_path && <div className="preventive-report-file">
          <p>PDF final arquivado · revisão {report.revision_number}{report.pdf_byte_count ? ` · ${(report.pdf_byte_count / 1024).toFixed(0)} KB` : ''}</p>
          {pdfUrl ? <a className="secondary" href={pdfUrl} target="_blank" rel="noreferrer">Abrir PDF final</a>
            : <p>O arquivo está arquivado; atualize para renovar o link temporário.</p>}
        </div>}
        {isSupervisor && canContinue && <button type="button" className="primary" disabled={busy || !report.pdf_storage_path || !signatureIsSatisfied}
          onClick={() => void completeOrder()}>
          {busy ? 'Concluindo...' : 'Concluir OS preventiva'}
        </button>}
      </div>}

      {audit.length > 0 && <details className="preventive-report-audit">
        <summary>Trilha de auditoria desta OS ({audit.length})</summary>
        <ol>{audit.map((event) => <li key={event.id}>
          <strong>{auditLabels[event.event_type] ?? 'Evento registrado'}</strong>
          <span>{event.changed_by_name ?? 'Usuário autenticado'} · {formatDate(event.changed_at)}</span>
          {event.event_type === 'returned' && typeof event.details?.review_reason === 'string'
            && <small>Motivo: {event.details.review_reason}</small>}
        </li>)}</ol>
      </details>}
    </>}
  </section>;
}
