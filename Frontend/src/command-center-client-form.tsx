import { useState, type FormEvent } from 'react';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { createCommandCenterTenant } from './use-command-center-data';

/* Helpers de CNPJ duplicados de propósito: importá-los de command-center.tsx
   criaria ciclo de import, pois o módulo principal monta este formulário. */
function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
function isValidCnpj(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const calculate = (base: string, weights: number[]) => {
    const total = base.split('').reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculate(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculate(digits.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits === digits.slice(0, 12) + first + second;
}
/* Domínio principal vem sempre do e-mail do contato: jose.oliveira@minhaempresa.com.br
   gera minhaempresa.com.br. */
function extractDomainFromEmail(email: string) {
  const atIndex = email.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === email.length - 1) return '';
  return email.slice(atIndex + 1).trim().toLowerCase();
}
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const tenantStatusOptions = [
  { value: 'active', label: 'Ativo' },
  { value: 'grace_period', label: 'Tolerância' },
  { value: 'payment_only', label: 'Somente pagamento' },
  { value: 'suspended', label: 'Suspenso' },
];

type Props = {
  onCancel: () => void;
  onCreated: (tenantId: string) => Promise<void>;
};

export function CommandCenterClientForm({ onCancel, onCreated }: Props) {
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [status, setStatus] = useState('active');
  const [contactFullName, setContactFullName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [extraDomains, setExtraDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [domainError, setDomainError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const primaryDomain = extractDomainFromEmail(contactEmail.trim());

  const addExtraDomain = () => {
    const raw = newDomain.trim();
    setDomainError('');

    if (!raw) {
      setDomainError('Informe o domínio que deseja adicionar.');
      return;
    }
    if (raw.includes('@')) {
      setDomainError('Informe o domínio sem o caractere "@". Ex.: minhaempresa.com.br');
      return;
    }
    if (/\s/.test(raw)) {
      setDomainError('O domínio não pode conter espaços.');
      return;
    }

    const normalized = raw.toLowerCase();

    if (!normalized.includes('.')) {
      setDomainError('O domínio precisa conter ponto. Ex.: minhaempresa.com.br');
      return;
    }
    if (normalized.startsWith('.') || normalized.endsWith('.')) {
      setDomainError('O domínio não pode começar nem terminar com ponto.');
      return;
    }
    if (primaryDomain && normalized === primaryDomain) {
      setDomainError('Este domínio já é o domínio principal do cliente.');
      return;
    }
    if (extraDomains.includes(normalized)) {
      setDomainError('Este domínio já foi adicionado.');
      return;
    }

    setExtraDomains([...extraDomains, normalized]);
    setNewDomain('');
  };

  const removeExtraDomain = (domain: string) => {
    setDomainError('');
    setExtraDomains(extraDomains.filter((item) => item !== domain));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    setErrorMessage('');

    const trimmedLegalName = legalName.trim();
    const trimmedTradeName = tradeName.trim();
    const trimmedContactName = contactFullName.trim();
    const trimmedContactEmail = contactEmail.trim().toLowerCase();

    if (!trimmedLegalName) {
      setErrorMessage('Informe a razão social do cliente.');
      return;
    }
    if (!trimmedTradeName) {
      setErrorMessage('Informe o nome fantasia do cliente.');
      return;
    }
    if (documentNumber.trim() && !isValidCnpj(documentNumber)) {
      setErrorMessage('Informe um CNPJ válido ou deixe o campo em branco.');
      return;
    }
    if (!trimmedContactName) {
      setErrorMessage('Informe o nome completo do contato principal.');
      return;
    }
    if (!trimmedContactEmail) {
      setErrorMessage('Informe o e-mail do contato principal.');
      return;
    }
    if (!emailPattern.test(trimmedContactEmail)) {
      setErrorMessage('Informe um e-mail válido para o contato principal.');
      return;
    }
    if (!primaryDomain) {
      setErrorMessage('Não foi possível extrair o domínio do e-mail do contato principal.');
      return;
    }

    setIsSaving(true);
    try {
      const row = await createCommandCenterTenant({
        legalName: trimmedLegalName,
        tradeName: trimmedTradeName,
        documentNumber: documentNumber.trim(),
        status,
        contactFullName: trimmedContactName,
        contactEmail: trimmedContactEmail,
        contactPhone: contactPhone.trim(),
        extraDomains: extraDomains.filter((domain) => domain !== primaryDomain),
      });

      if (!row?.tenant_id) {
        throw new Error('A criação do cliente não foi confirmada. Atualize a lista e tente novamente.');
      }

      await onCreated(row.tenant_id as string);
    } catch (saveError) {
      setErrorMessage(
        saveError instanceof Error ? saveError.message : 'Não foi possível criar o cliente.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">NOVO CLIENTE</p>
          <h2>Cadastro de cliente</h2>
        </div>
      </div>

      <p className="empty">
        Crie o cliente com contato principal e domínios autorizados. Contrato, plano e usuário
        seguem fluxos próprios e não são criados aqui.
      </p>

      <form className="new-user-form" onSubmit={(event) => void handleSubmit(event)}>
        <p className="eyebrow">1 · DADOS DO CLIENTE</p>
        <div className="form-grid">
          <label className="field">
            <span>Razão social *</span>
            <input
              value={legalName}
              onChange={(event) => setLegalName(event.target.value)}
              disabled={isSaving}
            />
          </label>

          <label className="field">
            <span>Nome fantasia *</span>
            <input
              value={tradeName}
              onChange={(event) => setTradeName(event.target.value)}
              disabled={isSaving}
            />
          </label>

          <label className="field">
            <span>CNPJ</span>
            <input
              value={documentNumber}
              onChange={(event) => setDocumentNumber(formatCnpj(event.target.value))}
              placeholder="00.000.000/0000-00"
              disabled={isSaving}
            />
          </label>

          <label className="field">
            <span>Situação inicial *</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} disabled={isSaving}>
              {tenantStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="eyebrow" style={{ marginTop: 20 }}>2 · CONTATO PRINCIPAL</p>
        <div className="form-grid">
          <label className="field">
            <span>Nome completo *</span>
            <input
              value={contactFullName}
              onChange={(event) => setContactFullName(event.target.value)}
              disabled={isSaving}
            />
          </label>

          <label className="field">
            <span>E-mail *</span>
            <input
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="jose.oliveira@minhaempresa.com.br"
              disabled={isSaving}
            />
          </label>

          <label className="field">
            <span>Telefone</span>
            <input
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              placeholder="(11) 99999-9999"
              disabled={isSaving}
            />
          </label>
        </div>


        <p className="eyebrow" style={{ marginTop: 20 }}>3 · DOMÍNIOS AUTORIZADOS</p>
        <p className="empty" style={{ margin: '4px 0 10px' }}>
          O domínio principal é extraído automaticamente do e-mail do contato.
        </p>

        <div className="insight" style={{ marginBottom: 12 }}>
          <AlertTriangle size={18} />
          <p>
            {primaryDomain
              ? `Todos os usuários deste cliente deverão usar e-mail com o domínio @${primaryDomain} para acessar o sistema.`
              : 'Informe o e-mail do contato principal para identificar automaticamente o domínio principal do cliente.'}
          </p>
        </div>

        <p style={{ margin: '0 0 6px', color: '#6680a8', fontSize: 13 }}>
          Deseja adicionar outro domínio autorizado?
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <label className="field" style={{ flex: 1 }}>
            <span>Domínio extra</span>
            <input
              value={newDomain}
              onChange={(event) => {
                setNewDomain(event.target.value);
                setDomainError('');
              }}
              placeholder="Ex.: filial.minhaempresa.com.br"
              disabled={isSaving}
            />
          </label>
          <button
            type="button"
            className="secondary button-with-icon"
            onClick={addExtraDomain}
            disabled={isSaving}
          >
            <Plus size={17} />
            Adicionar domínio
          </button>
        </div>

        {domainError && <p className="data-error">{domainError}</p>}

        {(primaryDomain || extraDomains.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {primaryDomain && (
              <span className="badge asset-status-active">@{primaryDomain} · domínio principal</span>
            )}
            {extraDomains.map((domain) => (
              <span className="badge" key={domain}>
                {domain}
                <button
                  type="button"
                  onClick={() => removeExtraDomain(domain)}
                  disabled={isSaving}
                  aria-label={`Remover domínio ${domain}`}
                  title="Remover domínio"
                  style={{
                    marginLeft: 6,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    display: 'inline-flex',
                  }}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}

        {errorMessage && (
          <div className="operation-toast operation-toast-error" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="form-actions" style={{ marginTop: 18 }}>
          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar cliente'}
          </button>
          <button type="button" className="secondary" disabled={isSaving} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </article>
  );
}
