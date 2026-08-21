import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from 'react';
import { RefreshCw, RotateCcw, Save, Upload, X } from 'lucide-react';
import { supabase } from './supabase';

type Props = {
  tenantId: string;
};

type Branding = {
  display_name: string | null;
  logo_path: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  report_header_text: string | null;
};

const emptyBranding = {
  display_name: '',
  primary_color: '',
  secondary_color: '',
  report_header_text: '',
};

export function BrandingAdmin({ tenantId }: Props) {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [form, setForm] = useState(emptyBranding);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadBranding = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('tenant_branding')
      .select('display_name, logo_path, primary_color, secondary_color, report_header_text')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      setErrorMessage(`Não foi possível carregar a identidade visual: ${error.message}`);
      setIsLoading(false);
      return;
    }

    const currentBranding = data as Branding | null;

    setBranding(currentBranding);
    setForm({
      display_name: currentBranding?.display_name ?? '',
      primary_color: currentBranding?.primary_color ?? '',
      secondary_color: currentBranding?.secondary_color ?? '',
      report_header_text: currentBranding?.report_header_text ?? '',
    });

    if (currentBranding?.logo_path) {
      const { data: signedLogo, error: signedLogoError } = await supabase.storage
        .from('tenant-branding')
        .createSignedUrl(currentBranding.logo_path, 3600);

      if (!signedLogoError && signedLogo?.signedUrl) {
        setLogoUrl(signedLogo.signedUrl);
      } else {
        setLogoUrl('');
      }
    } else {
      setLogoUrl('');
    }

    setLogoFile(null);
    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void loadBranding();
  }, [loadBranding]);

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;

    if (!selectedFile) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];

    if (!allowedTypes.includes(selectedFile.type)) {
      setErrorMessage('Escolha uma imagem PNG, JPG ou WebP.');
      return;
    }

    if (selectedFile.size > 2 * 1024 * 1024) {
      setErrorMessage('O logo pode ter no máximo 2 MB.');
      return;
    }

    setErrorMessage('');
    setLogoFile(selectedFile);
    setLogoUrl(URL.createObjectURL(selectedFile));
  }

  async function saveBranding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    let logoPath = branding?.logo_path ?? null;

    if (logoFile) {
      const extension = logoFile.name.split('.').pop()?.toLowerCase() || 'png';
      logoPath = `${tenantId}/logo.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('tenant-branding')
        .upload(logoPath, logoFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: logoFile.type,
        });

      if (uploadError) {
        setIsSaving(false);
        setErrorMessage(`Não foi possível enviar o logo: ${uploadError.message}`);
        return;
      }
    }

    const { error } = await supabase.from('tenant_branding').upsert(
      {
        tenant_id: tenantId,
        display_name: form.display_name.trim() || null,
        primary_color: form.primary_color.trim() || null,
        secondary_color: form.secondary_color.trim() || null,
        report_header_text: form.report_header_text.trim() || null,
        logo_path: logoPath,
      },
      { onConflict: 'tenant_id' },
    );

    if (error) {
      setErrorMessage(`Não foi possível salvar a identidade visual: ${error.message}`);
    } else {
      setMessage('Identidade visual salva com sucesso.');
      await loadBranding();
    }

    setIsSaving(false);
  }

  async function resetToNetsecbr() {
    if (
      !window.confirm(
        'Deseja remover a personalização e voltar ao padrão visual da NETSECBR?',
      )
    ) {
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    if (branding?.logo_path) {
      const { error: removeError } = await supabase.storage
        .from('tenant-branding')
        .remove([branding.logo_path]);

      if (removeError) {
        setIsSaving(false);
        setErrorMessage(`Não foi possível remover o logo: ${removeError.message}`);
        return;
      }
    }

    const { error } = await supabase
      .from('tenant_branding')
      .upsert(
        {
          tenant_id: tenantId,
          display_name: null,
          primary_color: null,
          secondary_color: null,
          report_header_text: null,
          logo_path: null,
        },
        { onConflict: 'tenant_id' },
      );

    if (error) {
      setErrorMessage(`Não foi possível restaurar o padrão NETSECBR: ${error.message}`);
    } else {
      setMessage('Padrão visual da NETSECBR restaurado.');
      await loadBranding();
    }

    setIsSaving(false);
  }

  return (
    <form className="new-user-form panel" onSubmit={saveBranding}>
      <div className="panel-head">
        <div>
          <p className="eyebrow">IDENTIDADE VISUAL</p>
          <h2>Personalização do cliente</h2>
        </div>

        <button
          type="button"
          className="secondary icon-action"
          title="Atualizar dados"
          aria-label="Atualizar dados"
          disabled={isLoading || isSaving}
          onClick={() => void loadBranding()}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <p className="authenticated-user">
        A personalização é opcional. Sem configuração, a plataforma mantém a
        identidade visual da <strong>NETSECBR</strong>.
      </p>

      {message && <p className="success-message">{message}</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {isLoading ? (
        <div className="empty-state">Carregando identidade visual...</div>
      ) : (
        <>
          <label className="field">
            <span>Nome exibido na plataforma e relatórios</span>
            <input
              maxLength={120}
              value={form.display_name}
              placeholder="Ex.: Indústria Exemplo"
              onChange={(event) =>
                setForm({ ...form, display_name: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span>Texto do cabeçalho de relatórios</span>
            <input
              maxLength={160}
              value={form.report_header_text}
              placeholder="Ex.: Gestão de Manutenção"
              onChange={(event) =>
                setForm({ ...form, report_header_text: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span>Cor primária (opcional)</span>
            <input
              value={form.primary_color}
              placeholder="#087DC2"
              pattern="#[0-9A-Fa-f]{6}"
              onChange={(event) =>
                setForm({ ...form, primary_color: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span>Cor secundária (opcional)</span>
            <input
              value={form.secondary_color}
              placeholder="#075395"
              pattern="#[0-9A-Fa-f]{6}"
              onChange={(event) =>
                setForm({ ...form, secondary_color: event.target.value })
              }
            />
          </label>

          <label className="field">
            <span>Logo do cliente — PNG, JPG ou WebP, até 2 MB</span>

            <span className="password-field">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoChange}
              />

              {logoFile && (
                <button
                  type="button"
                  className="password-toggle"
                  title="Remover logo selecionado"
                  aria-label="Remover logo selecionado"
                  onClick={() => {
                    setLogoFile(null);
                    setLogoUrl('');
                  }}
                >
                  <X size={18} />
                </button>
              )}
            </span>
          </label>

          {logoUrl && (
            <div className="panel">
              <p className="eyebrow">PRÉ-VISUALIZAÇÃO</p>
              <img
                src={logoUrl}
                alt="Pré-visualização do logo"
                style={{ maxWidth: '220px', maxHeight: '100px', objectFit: 'contain' }}
              />
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="button-with-icon"
              disabled={isSaving}
            >
              <Save size={17} />
              {isSaving ? 'Salvando...' : 'Salvar identidade visual'}
            </button>

            <button
              type="button"
              className="secondary button-with-icon"
              disabled={isSaving}
              onClick={() => void resetToNetsecbr()}
            >
              <RotateCcw size={17} />
              Restaurar padrão NETSECBR
            </button>
          </div>
        </>
      )}
    </form>
  );
}