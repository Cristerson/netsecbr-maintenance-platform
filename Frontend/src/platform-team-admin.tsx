import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, KeyRound, LockKeyhole, UserPlus } from 'lucide-react';
import { supabase } from './supabase';

type PlatformUser = {
  id: string;
  fullName: string;
  email: string;
  role: 'owner' | 'operator';
  isActive: boolean;
  createdAt: string | null;
};

type Props = { currentUserId: string; onBack: () => void };

type NewUserForm = { fullName: string; email: string; password: string; role: PlatformUser['role'] };

const emptyForm: NewUserForm = { fullName: '', email: '', password: '', role: 'operator' };

function roleLabel(role: PlatformUser['role']) {
  return role === 'owner' ? 'Proprietário' : 'Administrador';
}

function formatPlatformCreatedAt(createdAt: string | null | undefined) {
  if (!createdAt) return 'Data não disponível';
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return 'Data não disponível';
  return parsed.toLocaleDateString('pt-BR');
}

export function PlatformTeamAdmin({ currentUserId, onBack }: Props) {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [formMode, setFormMode] = useState<'new' | 'existing'>('new');
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Estados de edição do usuário selecionado
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<PlatformUser['role']>('operator');
  const [editActive, setEditActive] = useState(true);

  // Estados de redefinição de senha
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [temporaryPasswordMode, setTemporaryPasswordMode] = useState<'generated' | 'manual'>('generated');
  const [manualTemporaryPassword, setManualTemporaryPassword] = useState('');
  const [issuedTemporaryPassword, setIssuedTemporaryPassword] = useState('');

  const loadUsers = useCallback(async () => {
    setError('');
    const { data, error: functionError } = await supabase.functions.invoke('manage-platform-users', {
      body: { action: 'list' },
    });
    if (functionError || data?.error) {
      setError(data?.error ?? 'Não foi possível carregar a equipe da plataforma.');
    } else {
      setUsers((data?.users ?? []) as PlatformUser[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const clearFeedback = () => {
    setMessage('');
    setError('');
    setIssuedTemporaryPassword('');
  };

  const closeDetail = () => {
    clearFeedback();
    setForm(null);
    setFormMode('new');
    setSelectedUser(null);
    setIsPasswordResetOpen(false);
    setManualTemporaryPassword('');
    setIssuedTemporaryPassword('');
  };

  const openUserDetail = (user: PlatformUser) => {
    clearFeedback();
    setForm(null);
    setSelectedUser(user);
    setEditFullName(user.fullName);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditActive(user.isActive);
    setIsPasswordResetOpen(false);
    setTemporaryPasswordMode('generated');
    setManualTemporaryPassword('');
    setIssuedTemporaryPassword('');
  };

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    if (!form.email.trim() || (formMode === 'new' && (!form.fullName.trim() || form.password.length < 12))) {
      setError('Informe nome, e-mail e uma senha inicial de pelo menos 12 caracteres.');
      return;
    }
    setIsSaving(true);
    clearFeedback();
    const action = formMode === 'existing' ? 'link_existing' : 'create';
    const { data, error: functionError } = await supabase.functions.invoke('manage-platform-users', {
      body: { action, ...form },
    });
    if (functionError || data?.error) {
      setError(data?.error ?? functionError?.message ?? 'Não foi possível cadastrar o usuário.');
    } else {
      setForm(null);
      setMessage(formMode === 'existing' ? 'Usuário existente vinculado à plataforma com sucesso.' : 'Usuário da plataforma cadastrado com sucesso.');
      await loadUsers();
    }
    setIsSaving(false);
  };

  const saveIdentity = async () => {
    if (!selectedUser) return;
    if (selectedUser.id === currentUserId) {
      setError('Você não pode alterar o próprio acesso neste painel.');
      return;
    }

    const trimmedFullName = editFullName.trim();
    const trimmedEmail = editEmail.trim().toLowerCase();

    if (!trimmedFullName) {
      setError('O nome completo é obrigatório.');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Informe um e-mail válido.');
      return;
    }

    if (trimmedEmail !== selectedUser.email.toLowerCase()) {
      const confirmed = window.confirm(
        `Atenção: o e-mail é utilizado como credencial de login do usuário.\n\n` +
        `Confirma a alteração do e-mail de login de:\n"${selectedUser.email}"\npara:\n"${trimmedEmail}"?`
      );
      if (!confirmed) {
        return;
      }
    }

    setIsSaving(true);
    clearFeedback();

    const { data, error: functionError } = await supabase.functions.invoke('manage-platform-users', {
      body: {
        action: 'update_identity',
        userId: selectedUser.id,
        fullName: trimmedFullName,
        email: trimmedEmail,
        role: editRole,
        isActive: editActive,
      },
    });

    if (functionError || data?.error) {
      setError(data?.error ?? functionError?.message ?? 'Não foi possível salvar as alterações.');
    } else {
      const updatedUser: PlatformUser = {
        ...selectedUser,
        fullName: trimmedFullName,
        email: trimmedEmail,
        role: editRole,
        isActive: editActive,
      };
      setSelectedUser(updatedUser);
      setMessage(
        data?.emailChanged
          ? 'Cadastro e e-mail de acesso da plataforma atualizados e registrados na auditoria.'
          : 'Cadastro da plataforma atualizado e registrado na auditoria.'
      );
      await loadUsers();
    }
    setIsSaving(false);
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUser) return;
    if (selectedUser.id === currentUserId) {
      setError('Você não pode redefinir a própria senha neste painel. Use a recuperação de acesso.');
      return;
    }

    if (temporaryPasswordMode === 'manual' && manualTemporaryPassword.length < 12) {
      setError('A senha temporária deve ter pelo menos 12 caracteres.');
      return;
    }

    setIsSaving(true);
    clearFeedback();

    const { data, error: functionError } = await supabase.functions.invoke('manage-platform-users', {
      body: {
        action: 'set_temporary_password',
        userId: selectedUser.id,
        mode: temporaryPasswordMode,
        ...(temporaryPasswordMode === 'manual' ? { password: manualTemporaryPassword } : {}),
      },
    });

    if (functionError || data?.error) {
      setError(data?.error ?? functionError?.message ?? 'Não foi possível redefinir a senha.');
    } else {
      const issued = temporaryPasswordMode === 'generated'
        ? String(data?.temporaryPassword ?? '')
        : manualTemporaryPassword;
      setIssuedTemporaryPassword(issued);
      setMessage(
        temporaryPasswordMode === 'generated'
          ? 'Senha temporária gerada com sucesso. Copie o valor abaixo e envie por canal seguro.'
          : 'Senha temporária definida com sucesso. Copie o valor abaixo e envie por canal seguro.'
      );
    }
    setIsSaving(false);
  };

  const isSelf = selectedUser?.id === currentUserId;
  const hasChanges = Boolean(
    selectedUser &&
    (editFullName.trim() !== selectedUser.fullName ||
      editEmail.trim().toLowerCase() !== selectedUser.email.toLowerCase() ||
      editRole !== selectedUser.role ||
      editActive !== selectedUser.isActive)
  );

  const isNew = form !== null;
  return (
    <section className="content admin-panel">
      <div className="admin-module-header">
        <div><p className="eyebrow">MARV COMMAND CENTER · GOVERNANÇA</p><h2>Equipe da plataforma</h2></div>
        <div className="admin-module-header-actions"><button className="secondary" onClick={onBack}><ArrowLeft size={17} />Voltar para Command Center</button></div>
      </div>
      {error && <div className="operation-toast operation-toast-error" role="alert">{error}</div>}
      {message && <div className="operation-toast" role="status">{message}</div>}

      {!isNew && !selectedUser && (
        <>
          <div className="user-admin-actions"><button className="primary button-with-icon" onClick={() => { clearFeedback(); setFormMode('new'); setForm({ ...emptyForm }); }}><UserPlus size={17} />Novo usuário da plataforma</button><button className="secondary button-with-icon" onClick={() => { clearFeedback(); setFormMode('existing'); setForm({ ...emptyForm }); }}><UserPlus size={17} />Vincular usuário existente</button></div>
          <article className="panel table">
            <div className="panel-head"><div><p className="eyebrow">ACESSOS GLOBAIS</p><h2>Proprietários e administradores</h2></div><button className="secondary" onClick={() => void loadUsers()}>Atualizar lista</button></div>
            {isLoading ? <p className="empty">Carregando equipe...</p> : users.length === 0 ? <p className="empty">Nenhum usuário da plataforma encontrado.</p> : <>
              <div className="table-head" style={{ gridTemplateColumns: '1.6fr 1.5fr 1fr .8fr' }}><span>Nome</span><span>E-mail</span><span>Perfil</span><span>Situação</span></div>
              {users.map((user) => <div className={`table-row${user.isActive ? '' : ' is-inactive'}`} style={{ gridTemplateColumns: '1.6fr 1.5fr 1fr .8fr' }} key={user.id}>
                <div><button className="work-order-link" onClick={() => openUserDetail(user)}>{user.fullName}</button></div><span>{user.email}</span><span>{roleLabel(user.role)}</span><span className={`badge ${user.isActive ? 'asset-status-active' : 'asset-status-inactive'}`}>{user.isActive ? 'Ativo' : 'Inativo'}</span>
              </div>)}
            </>}
          </article>
        </>
      )}

      {isNew && form && <form className="new-user-form panel" onSubmit={(event) => void createUser(event)}>
        <div className="panel-head"><div><p className="eyebrow">{formMode === 'existing' ? 'VINCULAR ACESSO EXISTENTE' : 'NOVO ACESSO GLOBAL'}</p><h2>{formMode === 'existing' ? 'Vincular usuário à plataforma' : 'Cadastrar usuário da plataforma'}</h2></div></div>
        {formMode === 'existing' && <p className="empty">Use uma conta que já existe no MARV. O vínculo concede acesso global e fica registrado na auditoria.</p>}
        <div className="form-grid">{formMode === 'new' && <label className="field"><span>Nome completo *</span><input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} disabled={isSaving} required /></label>}<label className="field"><span>E-mail *</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={isSaving} required /></label>{formMode === 'new' && <label className="field"><span>Senha inicial *</span><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} disabled={isSaving} minLength={12} required /></label>}<label className="field"><span>Perfil *</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as PlatformUser['role'] })} disabled={isSaving}><option value="operator">Administrador</option><option value="owner">Proprietário</option></select></label></div>
        <div className="form-actions"><button type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : formMode === 'existing' ? 'Vincular usuário' : 'Cadastrar usuário'}</button><button type="button" className="secondary" onClick={closeDetail} disabled={isSaving}>Cancelar</button></div>
      </form>}

      {selectedUser && (
        <article className="new-user-form panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">CADASTRO DA PLATAFORMA</p>
              <h2>{selectedUser.fullName}</h2>
            </div>
          </div>

          <div className="insight" style={{ marginBottom: 16 }}>
            <p>
              <strong>Aviso de governança:</strong> no MARV, a exclusão de usuários é tratada exclusivamente por desativação para preservar integridade operacional, rastreabilidade e histórico de auditoria. Contas nunca são apagadas fisicamente.
            </p>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Nome completo *</span>
              <input
                type="text"
                value={editFullName}
                disabled={isSaving || isSelf}
                onChange={(event) => setEditFullName(event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>E-mail (login) *</span>
              <input
                type="email"
                value={editEmail}
                disabled={isSaving || isSelf}
                onChange={(event) => setEditEmail(event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Perfil *</span>
              <select
                value={editRole}
                disabled={isSaving || isSelf}
                onChange={(event) => setEditRole(event.target.value as PlatformUser['role'])}
              >
                <option value="operator">Administrador</option>
                <option value="owner">Proprietário</option>
              </select>
            </label>

            <label className="field">
              <span>Situação *</span>
              <select
                value={editActive ? 'active' : 'inactive'}
                disabled={isSaving || isSelf}
                onChange={(event) => setEditActive(event.target.value === 'active')}
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>

            <label className="field">
              <span>Data de criação</span>
              <input
                readOnly
                value={formatPlatformCreatedAt(selectedUser.createdAt)}
              />
            </label>
          </div>

          {isSelf && (
            <p className="empty">
              Você não pode alterar o próprio acesso, próprio perfil, própria situação, próprio e-mail ou própria senha neste painel.
            </p>
          )}

          <div className="form-actions admin-record-actions" style={{ marginTop: 20 }}>
            <button
              type="button"
              disabled={isSaving || isSelf || !hasChanges || !editFullName.trim() || !editEmail.trim()}
              onClick={() => void saveIdentity()}
            >
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </button>

            <button
              type="button"
              className="secondary button-with-icon"
              disabled={isSaving || isSelf || !editActive}
              onClick={() => {
                if (isSelf) {
                  setError('Você não pode redefinir a própria senha neste painel.');
                  return;
                }
                clearFeedback();
                setIsPasswordResetOpen((current) => !current);
                setTemporaryPasswordMode('generated');
                setManualTemporaryPassword('');
                setIssuedTemporaryPassword('');
              }}
            >
              <KeyRound size={17} />
              Redefinir senha
            </button>

            <button
              type="button"
              className="secondary"
              disabled={isSaving}
              onClick={closeDetail}
            >
              Voltar para equipe
            </button>
          </div>

          {isPasswordResetOpen && editActive && !isSelf && (
            <div className="overlay" role="presentation">
              <form className="modal" role="dialog" aria-modal="true" aria-labelledby="platform-password-reset-title" onSubmit={(event) => void resetPassword(event)}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">SENHA TEMPORÁRIA</p>
                  <h2 id="platform-password-reset-title">Redefinir acesso de {selectedUser.fullName}</h2>
                </div>
                <button
                  type="button"
                  aria-label="Fechar redefinição de senha"
                  disabled={isSaving}
                  onClick={() => {
                    setIsPasswordResetOpen(false);
                    setManualTemporaryPassword('');
                    setIssuedTemporaryPassword('');
                  }}
                >×</button>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Como definir a senha temporária?</span>
                  <select
                    value={temporaryPasswordMode}
                    disabled={isSaving || Boolean(issuedTemporaryPassword)}
                    onChange={(event) => setTemporaryPasswordMode(event.target.value as 'generated' | 'manual')}
                  >
                    <option value="generated">MARV gera uma senha forte</option>
                    <option value="manual">Definir uma senha temporária</option>
                  </select>
                </label>

                {temporaryPasswordMode === 'manual' && !issuedTemporaryPassword && (
                  <label className="field">
                    <span>Senha temporária (mínimo de 12 caracteres)</span>
                    <input
                      type="password"
                      minLength={12}
                      required
                      autoComplete="new-password"
                      value={manualTemporaryPassword}
                      onChange={(event) => setManualTemporaryPassword(event.target.value)}
                      disabled={isSaving}
                    />
                  </label>
                )}
              </div>

              <p className="empty">
                A senha temporária permite o acesso imediato. No primeiro login, o MARV exigirá a troca obrigatória da credencial.
              </p>

              {issuedTemporaryPassword && (
                <div className="panel" style={{ marginTop: 12, border: '1px solid #1f8b4c', background: '#f4fbf6' }}>
                  <p className="eyebrow" style={{ color: '#176b3a' }}>SENHA TEMPORÁRIA GERADA</p>
                  <p style={{ fontSize: '1.25rem', fontFamily: 'monospace', margin: '8px 0', wordBreak: 'break-all' }}>
                    <strong>{issuedTemporaryPassword}</strong>
                  </p>
                  <p className="empty" style={{ margin: 0 }}>
                    Copie esta senha e entregue ao usuário por um canal seguro. Ela não será exibida novamente após fechar esta tela.
                  </p>
                </div>
              )}

              <div className="form-actions" style={{ marginTop: 16 }}>
                {!issuedTemporaryPassword && (
                  <button type="submit" className="button-with-icon" disabled={isSaving}>
                    <LockKeyhole size={16} />
                    {isSaving ? 'Salvando...' : 'Confirmar e redefinir senha'}
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  disabled={isSaving}
                  onClick={() => {
                    setIsPasswordResetOpen(false);
                    setManualTemporaryPassword('');
                    setIssuedTemporaryPassword('');
                  }}
                >
                  {issuedTemporaryPassword ? 'Concluir' : 'Cancelar redefinição'}
                </button>
              </div>
              </form>
            </div>
          )}
        </article>
      )}
    </section>
  );
}
