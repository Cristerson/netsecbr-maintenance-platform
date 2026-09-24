import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, KeyRound, UserPlus } from 'lucide-react';
import { supabase } from './supabase';

type PlatformUser = {
  id: string;
  fullName: string;
  email: string;
  role: 'owner' | 'operator';
  isActive: boolean;
};

type Props = { currentUserId: string; onBack: () => void };

type NewUserForm = { fullName: string; email: string; password: string; role: PlatformUser['role'] };

const emptyForm: NewUserForm = { fullName: '', email: '', password: '', role: 'operator' };

function roleLabel(role: PlatformUser['role']) {
  return role === 'owner' ? 'Proprietário' : 'Administrador';
}

export function PlatformTeamAdmin({ currentUserId, onBack }: Props) {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');

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

  const clearFeedback = () => { setMessage(''); setError(''); setTemporaryPassword(''); };
  const closeDetail = () => { clearFeedback(); setForm(null); setSelectedUser(null); };

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    if (!form.fullName.trim() || !form.email.trim() || form.password.length < 12) {
      setError('Informe nome, e-mail e uma senha inicial de pelo menos 12 caracteres.');
      return;
    }
    setIsSaving(true); clearFeedback();
    const { data, error: functionError } = await supabase.functions.invoke('manage-platform-users', { body: { action: 'create', ...form } });
    if (functionError || data?.error) setError(data?.error ?? 'Não foi possível cadastrar o usuário.');
    else { setForm(null); setMessage('Usuário da plataforma cadastrado com sucesso.'); await loadUsers(); }
    setIsSaving(false);
  };

  const saveAccess = async () => {
    if (!selectedUser || selectedUser.id === currentUserId) return;
    setIsSaving(true); clearFeedback();
    const { data, error: functionError } = await supabase.functions.invoke('manage-platform-users', {
      body: { action: 'update_access', userId: selectedUser.id, role: selectedUser.role, isActive: selectedUser.isActive },
    });
    if (functionError || data?.error) setError(data?.error ?? 'Não foi possível alterar o acesso.');
    else { setMessage('Acesso da plataforma atualizado e registrado na auditoria.'); await loadUsers(); }
    setIsSaving(false);
  };

  const resetPassword = async () => {
    if (!selectedUser || selectedUser.id === currentUserId || !window.confirm('Gerar uma senha temporária para este usuário?')) return;
    setIsSaving(true); clearFeedback();
    const { data, error: functionError } = await supabase.functions.invoke('manage-platform-users', { body: { action: 'set_temporary_password', userId: selectedUser.id, mode: 'generated' } });
    if (functionError || data?.error) setError(data?.error ?? 'Não foi possível redefinir a senha.');
    else setTemporaryPassword(String(data.temporaryPassword ?? ''));
    setIsSaving(false);
  };

  const isNew = form !== null;
  return (
    <section className="content admin-panel">
      <div className="admin-module-header">
        <div><p className="eyebrow">MARV COMMAND CENTER · GOVERNANÇA</p><h2>Equipe da plataforma</h2></div>
        <div className="admin-module-header-actions"><button className="secondary" onClick={onBack}><ArrowLeft size={17} />Voltar para Command Center</button></div>
      </div>
      {error && <div className="operation-toast operation-toast-error" role="alert">{error}</div>}
      {message && <div className="operation-toast" role="status">{message}</div>}
      {temporaryPassword && <article className="panel"><p className="eyebrow">SENHA TEMPORÁRIA</p><strong>{temporaryPassword}</strong><p className="empty">Entregue esta senha por canal seguro. Ela será exigida somente no primeiro acesso.</p></article>}

      {!isNew && !selectedUser && (
        <>
          <div className="user-admin-actions"><button className="primary button-with-icon" onClick={() => { clearFeedback(); setForm({ ...emptyForm }); }}><UserPlus size={17} />Novo usuário da plataforma</button></div>
          <article className="panel table">
            <div className="panel-head"><div><p className="eyebrow">ACESSOS GLOBAIS</p><h2>Proprietários e administradores</h2></div><button className="secondary" onClick={() => void loadUsers()}>Atualizar lista</button></div>
            {isLoading ? <p className="empty">Carregando equipe...</p> : users.length === 0 ? <p className="empty">Nenhum usuário da plataforma encontrado.</p> : <>
              <div className="table-head" style={{ gridTemplateColumns: '1.6fr 1.5fr 1fr .8fr' }}><span>Nome</span><span>E-mail</span><span>Perfil</span><span>Situação</span></div>
              {users.map((user) => <div className={`table-row${user.isActive ? '' : ' is-inactive'}`} style={{ gridTemplateColumns: '1.6fr 1.5fr 1fr .8fr' }} key={user.id}>
                <div><button className="work-order-link" onClick={() => { clearFeedback(); setSelectedUser({ ...user }); }}>{user.fullName}</button></div><span>{user.email}</span><span>{roleLabel(user.role)}</span><span className={`badge ${user.isActive ? 'asset-status-active' : 'asset-status-inactive'}`}>{user.isActive ? 'Ativo' : 'Inativo'}</span>
              </div>)}
            </>}
          </article>
        </>
      )}

      {isNew && form && <form className="new-user-form panel" onSubmit={(event) => void createUser(event)}>
        <div className="panel-head"><div><p className="eyebrow">NOVO ACESSO GLOBAL</p><h2>Cadastrar usuário da plataforma</h2></div></div>
        <div className="form-grid"><label className="field"><span>Nome completo *</span><input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} disabled={isSaving} /></label><label className="field"><span>E-mail *</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={isSaving} /></label><label className="field"><span>Senha inicial *</span><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} disabled={isSaving} /></label><label className="field"><span>Perfil *</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as PlatformUser['role'] })} disabled={isSaving}><option value="operator">Administrador</option><option value="owner">Proprietário</option></select></label></div>
        <div className="form-actions"><button type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Cadastrar usuário'}</button><button type="button" className="secondary" onClick={closeDetail} disabled={isSaving}>Cancelar</button></div>
      </form>}

      {selectedUser && <article className="new-user-form panel"><div className="panel-head"><div><p className="eyebrow">USUÁRIO DA PLATAFORMA</p><h2>{selectedUser.fullName}</h2></div></div><p className="empty">{selectedUser.email}</p>
        <div className="form-grid"><label className="field"><span>Perfil</span><select value={selectedUser.role} onChange={(event) => setSelectedUser({ ...selectedUser, role: event.target.value as PlatformUser['role'] })} disabled={isSaving || selectedUser.id === currentUserId}><option value="operator">Administrador</option><option value="owner">Proprietário</option></select></label><label className="field"><span>Situação</span><select value={selectedUser.isActive ? 'active' : 'inactive'} onChange={(event) => setSelectedUser({ ...selectedUser, isActive: event.target.value === 'active' })} disabled={isSaving || selectedUser.id === currentUserId}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label></div>
        {selectedUser.id === currentUserId && <p className="empty">Você não pode alterar o próprio acesso neste painel.</p>}
        <div className="form-actions"><button type="button" disabled={isSaving || selectedUser.id === currentUserId} onClick={() => void saveAccess()}>Salvar acesso</button><button type="button" className="secondary button-with-icon" disabled={isSaving || selectedUser.id === currentUserId} onClick={() => void resetPassword()}><KeyRound size={17} />Redefinir senha</button><button type="button" className="secondary" disabled={isSaving} onClick={closeDetail}>Voltar para equipe</button></div>
      </article>}
    </section>
  );
}
