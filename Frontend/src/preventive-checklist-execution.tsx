import { useCallback, useEffect, useState } from 'react';
import { IndustrialChecklistEditor, type ChecklistEntry } from './industrial-checklist-editor';
import { ReportPhotoPicker } from './report-photo-picker';
import { supabase } from './supabase';

type Item = {
  id: string; title: string; instruction: string | null; position: number;
  result: ChecklistEntry['result'] | 'not_executed'; notes: string | null;
  nonconformity: string | null; measurement_value: number | null;
  measurement_unit: string | null; measurement_point: string | null;
  measurement_parameter?: string | null;
  configured_measurement_unit?: string | null;
  configured_measurement_point?: string | null;
  requires_photo: boolean; nonconformity_request_id: string | null;
};
type Photo = { id: string; checklist_item_id: string; storage_path: string; url: string };
type Props = { workOrderId: string; tenantId: string; canEdit: boolean; tenantName: string;
  order: { number: number; title: string; openedAt: string; completedAt: string | null;
    assetName: string | null; unitName: string; assignedName: string | null;
    actionTaken: string | null; resolutionNotes: string | null } };

const resultLabels: Record<Item['result'], string> = {
  pending: 'Pendente', ok: 'Conforme', not_ok: 'Não conforme',
  not_executed: 'Não realizada', not_applicable: 'Não se aplica',
};

function safeErrorMessage(error: unknown, fallback: string) {
  const raw = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : '';
  const safe = raw.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[registro]')
    .replace(/[\r\n]+/g, ' ').trim().slice(0, 240);
  return safe ? `${fallback} ${safe}` : fallback;
}

async function normalizePhoto(file: File): Promise<File> {
  if (file.type !== 'image/webp') return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) { bitmap.close(); throw new Error('Não foi possível preparar esta imagem.'); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  if (!blob) throw new Error('Não foi possível converter a imagem para JPEG.');
  return new File([blob], file.name.replace(/\.webp$/i, '.jpg'), { type: 'image/jpeg', lastModified: file.lastModified });
}

export function PreventiveChecklistExecution({ workOrderId, tenantId, canEdit, tenantName, order }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [entries, setEntries] = useState<ChecklistEntry[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<Record<string, File[]>>({});
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!activePhoto) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActivePhoto(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activePhoto]);

  const load = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError('');
    const { data, error: itemsError } = await supabase.from('preventive_work_order_checklist_items')
      .select('*')
      .eq('work_order_id', workOrderId).eq('tenant_id', tenantId).order('position');
    if (itemsError) {
      setError(safeErrorMessage(itemsError, 'Não foi possível carregar o checklist.'));
      setLoading(false);
      return false;
    }
    const nextItems = (data ?? []) as Item[];
    setItems(nextItems);
    setEntries(nextItems.map((item) => ({
      activityId: item.id,
      result: item.result,
      measurement: item.measurement_value?.toString() ?? '',
      measurementUnit: item.measurement_unit ?? '',
      measurementPoint: item.measurement_point ?? '',
      observation: item.notes ?? '',
      nonconformity: item.nonconformity ?? '',
    })));
    if (nextItems.length) {
      const { data: photoData, error: photoError } = await supabase.from('preventive_checklist_photos')
        .select('id,checklist_item_id,storage_path').eq('tenant_id', tenantId)
        .in('checklist_item_id', nextItems.map((item) => item.id));
      if (photoError) {
        setError(safeErrorMessage(photoError, 'Checklist carregado, mas não foi possível listar as fotos.'));
        setPhotos([]);
        setLoading(false);
        return false;
      }
      const signedPhotos = await Promise.all((photoData ?? []).map(async (photo) => {
        const { data: signed, error: signedError } = await supabase.storage
          .from('preventive-evidence').createSignedUrl(photo.storage_path, 300);
        return { photo, url: signed?.signedUrl ?? '', failed: Boolean(signedError) };
      }));
      setPhotos(signedPhotos.map(({ photo, url }) => ({ ...photo, url } as Photo)));
      if (signedPhotos.some((photo) => photo.failed)) {
        setError('Checklist carregado, mas algumas fotos não puderam ser abertas. Atualize para renovar o acesso.');
        setLoading(false);
        return false;
      }
    } else setPhotos([]);
    setLoading(false);
    return true;
  }, [tenantId, workOrderId]);

  useEffect(() => { void load(); }, [load]);

  async function initializeChecklist() {
    if (!canEdit || saving || items.length) return;
    setSaving(true); setError(''); setMessage('');
    const { data: count, error: initError } = await supabase.rpc('initialize_preventive_checklist', {
      target_order_id: workOrderId,
    });
    if (initError || !count) {
      setError(safeErrorMessage(initError, 'Checklist não inicializado. Confira se o plano possui atividades aplicáveis; nenhum resultado existente foi alterado.'));
      setSaving(false);
      return;
    }
    const loaded = await load();
    const { data: confirmed, error: confirmationError } = await supabase
      .from('preventive_work_order_checklist_items').select('id')
      .eq('tenant_id', tenantId).eq('work_order_id', workOrderId);
    if (!loaded || confirmationError || (confirmed?.length ?? 0) !== count) {
      setError(safeErrorMessage(confirmationError, 'O banco não confirmou a leitura completa do checklist inicializado. Atualize antes de continuar.'));
      setSaving(false);
      return;
    }
    setMessage(`${count} atividades inicializadas nesta OS.`);
    setSaving(false);
  }

  async function saveChecklist() {
    if (!canEdit || saving) return;
    setSaving(true); setError(''); setMessage('');
    for (const entry of entries) {
      const value = entry.measurement.trim();
      const item = items.find((current) => current.id === entry.activityId);
      if (!item) {
        setError('Uma atividade não está mais disponível. Atualize o checklist antes de salvar.');
        setSaving(false);
        return;
      }
      const measurementConfigured = Boolean(
        item.measurement_parameter?.trim() &&
        item.configured_measurement_unit?.trim() &&
        item.configured_measurement_point?.trim(),
      );
      if (value && !Number.isFinite(Number(value))) {
        setError('Informe um valor numérico válido para a medição.'); setSaving(false); return;
      }
      if (value && !measurementConfigured) {
        setError(`Configure parâmetro, unidade e ponto da medição em “${item.title}” antes de registrar um valor.`);
        setSaving(false);
        return;
      }
      const { error: saveError } = await supabase.rpc('save_preventive_checklist_item', {
        target_item_id: entry.activityId, target_result: entry.result,
        target_notes: entry.observation,
        target_measurement_value: value ? Number(value) : null,
        target_measurement_unit: measurementConfigured ? item.configured_measurement_unit : '',
        target_measurement_point: measurementConfigured ? item.configured_measurement_point : '',
        target_nonconformity: entry.nonconformity,
      });
      if (saveError) {
        const failure = safeErrorMessage(saveError, `Falha ao salvar “${item.title}”.`);
        await load();
        setError(`${failure} Atividades anteriores podem ter sido salvas; atualize antes de repetir.`);
        setSaving(false); return;
      }
    }
    const expectedById = new Map(entries.map((entry) => [entry.activityId, entry]));
    const { data: persisted, error: verifyError } = await supabase
      .from('preventive_work_order_checklist_items')
      .select('id,result,measurement_value,notes,nonconformity,nonconformity_request_id')
      .eq('tenant_id', tenantId).eq('work_order_id', workOrderId);
    const confirmed = !verifyError && (persisted?.length ?? 0) === entries.length
      && (persisted ?? []).every((row) => {
        const entry = expectedById.get(row.id);
        if (!entry || row.result !== entry.result) return false;
        const item = items.find((current) => current.id === row.id);
        const measurementConfigured = Boolean(item?.measurement_parameter?.trim()
          && item.configured_measurement_unit?.trim() && item.configured_measurement_point?.trim());
        const expectedMeasurement = measurementConfigured && entry.measurement.trim() !== ''
          ? Number(entry.measurement) : null;
        const actualMeasurement = row.measurement_value === null ? null : Number(row.measurement_value);
        return actualMeasurement === expectedMeasurement
          && String(row.notes ?? '') === entry.observation.trim()
          && (entry.result !== 'not_ok' || (Boolean(row.nonconformity_request_id)
            && String(row.nonconformity ?? '') === entry.nonconformity.trim()));
      });
    const loaded = await load();
    if (!confirmed) {
      setError(safeErrorMessage(verifyError, 'O banco não confirmou o salvamento integral. Atualize o checklist antes de continuar.'));
      setSaving(false);
      return;
    }
    setMessage(loaded
      ? 'Checklist salvo e confirmado no MARV.'
      : 'Checklist salvo no MARV, mas a leitura de algumas evidências falhou. Atualize para conferir.');
    setSaving(false);
  }

  async function uploadPhotos(item: Item) {
    const files = pendingPhotos[item.id] ?? [];
    if (!files.length || saving) return;
    if (files.length + photos.filter((photo) => photo.checklist_item_id === item.id).length > 12) {
      setError('Limite de 12 fotos por atividade.'); return;
    }
    setSaving(true); setError('');
    for (const sourceFile of files) {
      let file: File;
      try { file = await normalizePhoto(sourceFile); }
      catch (normalizationError) {
        setError(safeErrorMessage(normalizationError, 'Não foi possível preparar uma das imagens.'));
        setSaving(false);
        return;
      }
      const extension = file.type === 'image/png' ? 'png' : 'jpg';
      const path = `${tenantId}/${workOrderId}/${item.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('preventive-evidence')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) { setError(safeErrorMessage(uploadError, 'Falha no envio da foto.')); setSaving(false); return; }
      const { error: recordError } = await supabase.from('preventive_checklist_photos')
        .insert({ tenant_id: tenantId, checklist_item_id: item.id, storage_path: path });
      if (recordError) {
        const { error: cleanupError } = await supabase.storage.from('preventive-evidence').remove([path]);
        setError(`${safeErrorMessage(recordError, 'Foto enviada sem registro.')}${cleanupError ? ' A limpeza do arquivo também falhou; informe o suporte.' : ''}`);
        setSaving(false); return;
      }
    }
    setPendingPhotos((current) => ({ ...current, [item.id]: [] }));
    const loaded = await load();
    setMessage(loaded
      ? 'Fotos salvas no armazenamento privado e confirmadas.'
      : 'Fotos salvas no armazenamento privado, mas não foi possível renovar a visualização. Atualize para conferir.');
    setSaving(false);
  }

  async function openCorrective(item: Item) {
    if (saving) return;
    setSaving(true); setError('');
    const { data, error: requestError } = await supabase.rpc('open_preventive_nonconformity_request', { target_item_id: item.id });
    if (requestError) setError(safeErrorMessage(requestError, 'Falha ao vincular a solicitação corretiva.'));
    else { await load(); setMessage(data ? 'Solicitação corretiva vinculada. Continue a triagem em Solicitações.' : 'Solicitação corretiva vinculada.'); }
    setSaving(false);
  }

  if (loading) return <p role="status">Carregando checklist preventivo...</p>;
  return <section className="panel preventive-checklist-execution" aria-label="Execução do checklist preventivo">
    <div className="panel-head"><div><p className="eyebrow">EXECUÇÃO PREVENTIVA</p><h2>Checklist da OS</h2></div>
      <button type="button" className="secondary" onClick={() => void load()}>Atualizar</button></div>
    {error && <p role="alert" className="operation-toast operation-toast-error">{error}</p>}
    {message && <p role="status" className="operation-toast operation-toast-success">{message}</p>}
    {!items.length ? <div><p>Esta OS ainda não possui atividades estruturadas. Confira o plano vinculado antes de inicializar. Nenhum resultado ou evidência existente será sobrescrito.</p>
      {canEdit && <button type="button" disabled={saving} onClick={() => void initializeChecklist()}>
        {saving ? 'Inicializando...' : 'Inicializar checklist desta OS'}
      </button>}</div> : <>
      <IndustrialChecklistEditor activities={items.map((item) => ({
        id: item.id, title: item.title, instruction: item.instruction,
        measurementParameter: item.measurement_parameter,
        measurementUnit: item.configured_measurement_unit ?? item.measurement_unit,
        measurementPoint: item.configured_measurement_point ?? item.measurement_point,
      }))}
        entries={entries} onChange={setEntries} disabled={!canEdit || saving}
        renderEvidence={(activity) => {
          const item = items.find((current) => current.id === activity.id);
          if (!item) return null;
          return <div className="preventive-activity-evidence">
            <h4>Fotos e não conformidade{item.requires_photo ? ' · foto prevista' : ''}</h4>
            <div className="preventive-saved-photos">{photos.filter((photo) => photo.checklist_item_id === item.id).map((photo) => photo.url
              ? <button type="button" className="preventive-photo-thumb" key={photo.id}
                  onClick={() => setActivePhoto(photo.url)} aria-label={`Ampliar foto da atividade ${item.title}`}>
                  <img src={photo.url} alt={`Foto registrada em ${item.title}`} loading="lazy" /></button>
              : <p key={photo.id}>Foto registrada; atualize para renovar o acesso.</p>)}</div>
            {canEdit && <><ReportPhotoPicker files={pendingPhotos[item.id] ?? []}
              onChange={(files) => setPendingPhotos((current) => ({ ...current, [item.id]: files }))}
              disabled={saving} maxPhotos={12} label="Fotografias desta atividade"
              hint="As fotos selecionadas ficam neste dispositivo até você clicar em Enviar fotos desta atividade." />
              <button type="button" disabled={saving || !(pendingPhotos[item.id]?.length)} onClick={() => void uploadPhotos(item)}>Enviar fotos desta atividade</button></>}
            {item.result === 'not_ok' && (item.nonconformity_request_id
              ? <p>Solicitação corretiva vinculada. Acompanhe em Solicitações.</p>
              : canEdit && <button type="button" className="secondary" disabled={saving} onClick={() => void openCorrective(item)}>Criar solicitação corretiva vinculada</button>)}
            {item.result !== 'not_ok' && entries.find((entry) => entry.activityId === item.id)?.result === 'not_ok' &&
              <p>Salve o checklist para registrar a não conformidade e abrir uma solicitação vinculada. Isso não cria uma OS corretiva automaticamente.</p>}
          </div>;
        }} />
      {canEdit && <button type="button" disabled={saving} onClick={() => void saveChecklist()}>{saving ? 'Salvando...' : 'Salvar checklist no MARV'}</button>}
      <details className="preventive-report-preview">
        <summary>Visualizar relatório técnico com dados registrados</summary>
        <p className="preventive-report-warning">Prévia para conferência. A impressão em PDF pelo navegador não arquiva o documento, não aprova a OS e não substitui a assinatura do cliente.</p>
        <div id="marv-preventive-print" className="marv-local-report">
          <p className="eyebrow">MARV · NETSECBR</p><h2>Relatório técnico preventivo — prévia</h2>
          <p><strong>Cliente:</strong> {tenantName} · <strong>Unidade:</strong> {order.unitName}</p>
          <p><strong>Equipamento:</strong> {order.assetName ?? 'Não identificado'} · <strong>OS:</strong> #{order.number}</p>
          <p><strong>Serviço:</strong> {order.title} · <strong>Responsável:</strong> {order.assignedName ?? 'Não atribuído'}</p>
          <p><strong>Abertura:</strong> {new Date(order.openedAt).toLocaleString('pt-BR')}
            {order.completedAt ? ` · Conclusão: ${new Date(order.completedAt).toLocaleString('pt-BR')}` : ''}</p>
          {items.map((item, index) => <article className="marv-local-report-activity" key={item.id}>
            <h3>{index + 1}. {item.title}</h3>
            <p><strong>Resultado:</strong> {resultLabels[item.result]}
              {item.measurement_value !== null ? ` · ${item.measurement_parameter ?? 'Medição'}: ${item.measurement_value} ${item.measurement_unit ?? item.configured_measurement_unit ?? ''}` : ''}</p>
            {item.measurement_point && <p><strong>Ponto:</strong> {item.measurement_point}</p>}
            {item.notes && <p><strong>Observação:</strong> {item.notes}</p>}
            {item.nonconformity && <p><strong>Não conformidade:</strong> {item.nonconformity}</p>}
            {photos.filter((photo) => photo.checklist_item_id === item.id && photo.url).map((photo) =>
              <figure key={photo.id}><img src={photo.url} alt={`Evidência da atividade ${item.title}`} /></figure>)}
          </article>)}
          {order.actionTaken && <p><strong>Serviço executado:</strong> {order.actionTaken}</p>}
          {order.resolutionNotes && <p><strong>Resumo do atendimento:</strong> {order.resolutionNotes}</p>}
          <p><strong>Situação do documento:</strong> prévia não aprovada, não assinada e não arquivada.</p>
        </div>
        <button type="button" className="secondary" onClick={() => window.print()}>Imprimir ou salvar prévia em PDF</button>
      </details>
    </>}
    {activePhoto && <div className="preventive-photo-lightbox" role="dialog" aria-modal="true" aria-label="Foto de evidência ampliada"
      onClick={() => setActivePhoto(null)}>
      <button type="button" className="secondary preventive-photo-lightbox-close" onClick={() => setActivePhoto(null)}>Fechar imagem</button>
      <img src={activePhoto} alt="Evidência fotográfica ampliada" onClick={(event) => event.stopPropagation()} />
    </div>}
  </section>;
}
