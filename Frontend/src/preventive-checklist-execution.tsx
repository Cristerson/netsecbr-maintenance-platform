import { useCallback, useEffect, useState } from 'react';
import { IndustrialChecklistEditor, type ChecklistEntry } from './industrial-checklist-editor';
import { ReportPhotoPicker } from './report-photo-picker';
import { supabase } from './supabase';

type Item = {
  id: string; title: string; instruction: string | null; position: number;
  result: ChecklistEntry['result'] | 'not_executed'; notes: string | null;
  nonconformity: string | null; measurement_value: number | null;
  measurement_unit: string | null; measurement_point: string | null;
  requires_photo: boolean; nonconformity_request_id: string | null;
};
type Photo = { id: string; checklist_item_id: string; storage_path: string; url: string };
type Props = { workOrderId: string; tenantId: string; canEdit: boolean };

export function PreventiveChecklistExecution({ workOrderId, tenantId, canEdit }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [entries, setEntries] = useState<ChecklistEntry[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<Record<string, File[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: itemsError } = await supabase.from('preventive_work_order_checklist_items')
      .select('id,title,instruction,position,result,notes,nonconformity,measurement_value,measurement_unit,measurement_point,requires_photo,nonconformity_request_id')
      .eq('work_order_id', workOrderId).eq('tenant_id', tenantId).order('position');
    if (itemsError) {
      setError(`Não foi possível carregar o checklist: ${itemsError.message}`);
      setLoading(false);
      return;
    }
    const nextItems = (data ?? []) as Item[];
    setItems(nextItems);
    setEntries(nextItems.map((item) => ({
      activityId: item.id,
      result: item.result === 'not_executed' ? 'not_applicable' : item.result,
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
      if (photoError) setError(`Checklist carregado, mas as fotos falharam: ${photoError.message}`);
      else setPhotos(await Promise.all((photoData ?? []).map(async (photo) => {
        const { data: signed } = await supabase.storage.from('preventive-evidence').createSignedUrl(photo.storage_path, 300);
        return { ...photo, url: signed?.signedUrl ?? '' } as Photo;
      })));
    } else setPhotos([]);
    setLoading(false);
  }, [tenantId, workOrderId]);

  useEffect(() => { void load(); }, [load]);

  async function initializeChecklist() {
    if (!canEdit || saving || items.length) return;
    setSaving(true); setError(''); setMessage('');
    const { data: count, error: initError } = await supabase.rpc('initialize_preventive_checklist', {
      target_order_id: workOrderId,
    });
    if (initError || !count) {
      setError(`Checklist não inicializado: ${initError?.message ?? 'o plano ainda não possui atividades aplicáveis a esta OS'}. Confira o plano vinculado; nenhum resultado existente foi alterado.`);
      setSaving(false);
      return;
    }
    await load();
    setMessage(`${count} atividades inicializadas nesta OS.`);
    setSaving(false);
  }

  async function saveChecklist() {
    if (!canEdit || saving) return;
    setSaving(true); setError(''); setMessage('');
    for (const entry of entries) {
      const value = entry.measurement.trim();
      if (value && !Number.isFinite(Number(value))) {
        setError('Informe um valor numérico válido para a medição.'); setSaving(false); return;
      }
      const { error: saveError } = await supabase.rpc('save_preventive_checklist_item', {
        target_item_id: entry.activityId, target_result: entry.result,
        target_notes: entry.observation,
        target_measurement_value: value ? Number(value) : null,
        target_measurement_unit: entry.measurementUnit ?? '',
        target_measurement_point: entry.measurementPoint ?? '',
        target_nonconformity: entry.nonconformity,
      });
      if (saveError) {
        setError(`Falha ao salvar ${items.find((item) => item.id === entry.activityId)?.title ?? 'atividade'}: ${saveError.message}. Atividades anteriores podem ter sido salvas; atualize antes de repetir.`);
        setSaving(false); return;
      }
    }
    await load(); setMessage('Checklist salvo no MARV.'); setSaving(false);
  }

  async function uploadPhotos(item: Item) {
    const files = pendingPhotos[item.id] ?? [];
    if (!files.length || saving) return;
    if (files.length + photos.filter((photo) => photo.checklist_item_id === item.id).length > 12) {
      setError('Limite de 12 fotos por atividade.'); return;
    }
    setSaving(true); setError('');
    for (const file of files) {
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${tenantId}/${workOrderId}/${item.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('preventive-evidence')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) { setError(`Falha no envio: ${uploadError.message}`); setSaving(false); return; }
      const { error: recordError } = await supabase.from('preventive_checklist_photos')
        .insert({ tenant_id: tenantId, checklist_item_id: item.id, storage_path: path });
      if (recordError) {
        const { error: cleanupError } = await supabase.storage.from('preventive-evidence').remove([path]);
        setError(`Foto enviada sem registro: ${recordError.message}${cleanupError ? '; limpeza do arquivo também falhou' : ''}.`);
        setSaving(false); return;
      }
    }
    setPendingPhotos((current) => ({ ...current, [item.id]: [] }));
    await load(); setMessage('Fotos salvas no armazenamento privado.'); setSaving(false);
  }

  async function openCorrective(item: Item) {
    if (saving) return;
    setSaving(true); setError('');
    const { data, error: requestError } = await supabase.rpc('open_preventive_nonconformity_request', { target_item_id: item.id });
    if (requestError) setError(`Falha ao abrir solicitação: ${requestError.message}`);
    else { await load(); setMessage(`Solicitação corretiva vinculada: ${data}. Continue a triagem em Solicitações.`); }
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
      <IndustrialChecklistEditor activities={items.map((item) => ({ id: item.id, title: item.title, instruction: item.instruction }))}
        entries={entries} onChange={setEntries} disabled={!canEdit || saving} />
      {canEdit && <button type="button" disabled={saving} onClick={() => void saveChecklist()}>{saving ? 'Salvando...' : 'Salvar checklist no MARV'}</button>}
      {items.map((item) => <div className="panel" key={item.id} style={{ marginTop: 12 }}>
        <h3>Fotos e não conformidade · {item.title}{item.requires_photo ? ' (foto prevista)' : ''}</h3>
        {photos.filter((photo) => photo.checklist_item_id === item.id).map((photo) => photo.url
          ? <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">Ver foto salva</a>
          : <p key={photo.id}>Foto registrada; atualize para renovar o acesso.</p>)}
        {canEdit && <><ReportPhotoPicker files={pendingPhotos[item.id] ?? []}
          onChange={(files) => setPendingPhotos((current) => ({ ...current, [item.id]: files }))}
          disabled={saving} maxPhotos={12} hint="As fotos selecionadas ficam neste dispositivo até você clicar em Enviar fotos desta atividade." />
          <button type="button" disabled={saving || !(pendingPhotos[item.id]?.length)} onClick={() => void uploadPhotos(item)}>Enviar fotos desta atividade</button></>}
        {item.result === 'not_ok' && (item.nonconformity_request_id
          ? <p>Solicitação corretiva vinculada: {item.nonconformity_request_id}</p>
          : canEdit && <button type="button" className="secondary" disabled={saving} onClick={() => void openCorrective(item)}>Abrir solicitação corretiva</button>)}
      </div>)}
    </>}
  </section>;
}
