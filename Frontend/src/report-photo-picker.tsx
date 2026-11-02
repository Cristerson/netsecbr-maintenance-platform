import { useEffect, useState } from 'react';

type Preview = { file: File; url: string };

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  maxPhotos?: number;
  hint?: string;
};

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxFileBytes = 10 * 1024 * 1024;

/** Seleção local de evidências; upload privado requer Storage/RLS próprios. */
export function ReportPhotoPicker({ files, onChange, disabled = false, maxPhotos = 12, hint = 'As imagens estão apenas neste dispositivo até que o relatório seja salvo em armazenamento privado.' }: Props) {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const next = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(next);
    return () => next.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [files]);

  function addFiles(incoming: FileList | null) {
    if (disabled || !incoming?.length) return;
    const selected = Array.from(incoming);
    const invalid = selected.find((file) => !allowedTypes.has(file.type) || file.size > maxFileBytes);
    if (invalid) {
      setError(`A foto ${invalid.name} deve ser JPG, PNG ou WebP e ter até 10 MB.`);
      return;
    }
    if (files.length + selected.length > maxPhotos) {
      setError(`É possível selecionar até ${maxPhotos} fotos por relatório.`);
      return;
    }
    const next = [...files, ...selected];
    setError('');
    onChange(next);
  }

  function removeFile(index: number) {
    if (disabled) return;
    const next = files.filter((_, current) => current !== index);
    onChange(next);
  }

  return (
    <div className="field">
      <span>Fotografias do atendimento</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <label>
          <span>Usar câmera</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={disabled} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
        </label>
        <label>
          <span>Escolher da galeria</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {previews.map(({ file, url }, index) => (
          <figure key={`${file.name}-${file.lastModified}-${index}`} style={{ margin: 0, width: 136 }}>
            <img src={url} alt={`Prévia ${index + 1}: ${file.name}`} style={{ width: 136, height: 104, objectFit: 'cover', borderRadius: 7 }} />
            <figcaption style={{ overflowWrap: 'anywhere' }}>{file.name}</figcaption>
            <button type="button" disabled={disabled} onClick={() => removeFile(index)}>Remover</button>
          </figure>
        ))}
      </div>
      <small>{hint}</small>
    </div>
  );
}
