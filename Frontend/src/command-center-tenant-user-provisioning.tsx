import { useState, type FormEvent } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { KeyRound, UserPlus } from 'lucide-react';
import { supabase } from './supabase';

type Props = {
  tenantId: string;
  tenantName: string;
  onCreated: () => Promise<void>;
};

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = new Uint32Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

export function CommandCenterTenantUserProvisioning({ tenantId, tenantName, onCreated }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('tenant_admin');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const open = () => {
    setIsOpen(true);
    setMessage('');
    setErrorMessage('');
    setPassword(generateTemporaryPassword());
  };

  const close = () => {
    if (isSaving) return;
    setIsOpen(false);
    setMessage('');
    setErrorMessage('');
  };

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || !normalizedEmail || password.length < 12) {
      setErrorMessage('Informe nome, e-mail e uma senha temporária com ao menos 12 caracteres.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase.functions.invoke('create-tenant-user', {
      body: {
        tenantId,
        fullName: normalizedName,
        email: normalizedEmail,
        password,
        role,
      },
    });

    if (error) {
      let detail = error.message;
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json();
        detail = String(body?.error ?? detail);
      }
      setErrorMessage(`Não foi possível criar o acesso: ${detail}`);
      setIsSaving(false);
      return;
    }

    setMessage('Acesso criado. Copie a senha temporária agora: o usuário deverá alterá-la no primeiro login.');
    await onCreated();
    setIsSaving(false);
  };

  if (!isOpen) {
    return (
      <button type="button" className="secondary button-with-icon" onClick={open}>
        <UserPlus size={17} />
        Criar acesso do cliente
      </button>
    );
  }

  return (
    <form className="new-user-form" onSubmit={(event) => void createUser(event)} style={{ marginTop: 16 }}>
      <p className="eyebrow">NOVO ACESSO DO CLIENTE</p>
      <p className="empty" style={{ marginTop: 0 }}>
        O acesso será vinculado a {tenantName}. O domínio do e-mail precisa estar autorizado para este cliente.
      </p>

      <div className="form-grid">
        <label className="field">
          <span>Nome completo *</span>
          <input value={fullName} disabled={isSaving} onChange={(event) => setFullName(event.target.value)} />
        </label>
        <label className="field">
          <span>E-mail *</span>
          <input type="email" value={email} disabled={isSaving} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="field">
          <span>Perfil *</span>
          <select value={role} disabled={isSaving} onChange={(event) => setRole(event.target.value)}>
            <option value="tenant_admin">Administrador do cliente</option>
            <option value="navigation">Navegação</option>
          </select>
        </label>
        <label className="field">
          <span>Senha temporária *</span>
          <input value={password} disabled={isSaving} onChange={(event) => setPassword(event.target.value)} />
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="secondary button-with-icon" disabled={isSaving} onClick={() => setPassword(generateTemporaryPassword())}>
          <KeyRound size={17} />
          Gerar outra senha
        </button>
        <button type="submit" disabled={isSaving}>{isSaving ? 'Criando acesso...' : 'Criar acesso'}</button>
        <button type="button" className="secondary" disabled={isSaving} onClick={close}>Cancelar</button>
      </div>

      {message && <p className="success-message">{message}</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}
    </form>
  );
}
