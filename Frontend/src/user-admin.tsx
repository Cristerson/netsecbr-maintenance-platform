import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { KeyRound, LockKeyhole, Power, RefreshCw, UserPlus, X } from 'lucide-react';

type Props = {
  tenantId: string;
  currentName: string;
  currentRole: string;
};

type Profile = {
  full_name: string | null;
};

type Membership = {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  full_name: string | null;
};

type Permission = {
  code: string;
  name: string;
};

function getMemberName(member: Membership) {
  return member.full_name || 'Usuário sem nome';
}

function formatRole(role: string) {
  const roles: Record<string, string> = {
    tenant_admin: 'Administrador do cliente',
    navigation: 'Navegação',
    netsecbr_admin: 'Administrador NETSECBR',
    netsecbr_support: 'Suporte NETSECBR',
  };

  return roles[role] || role;
}

export function UserAdmin({ tenantId, currentName, currentRole }: Props) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedMember, setSelectedMember] = useState<Membership | null>(null);
  const [assignedPermissions, setAssignedPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [temporaryPasswordMode, setTemporaryPasswordMode] = useState<'generated' | 'manual'>('generated');
  const [manualTemporaryPassword, setManualTemporaryPassword] = useState('');
  const [issuedTemporaryPassword, setIssuedTemporaryPassword] = useState('');
  const isDetailView = selectedMember !== null;
const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
const [isCreatingUser, setIsCreatingUser] = useState(false);
const [newUser, setNewUser] = useState({
  fullName: '',
  email: '',
  password: '',
  role: 'navigation',
});
  const loadData = useCallback(async () => {
  setIsLoading(true);
  setErrorMessage('');

  // 1. Busca os vínculos de usuários deste cliente.
  const { data: members, error: membersError } = await supabase
    .from('tenant_memberships')
    .select('id, user_id, role, is_active')
    .eq('tenant_id', tenantId)
    .order('created_at');

  if (membersError) {
    setErrorMessage(
      `Não foi possível carregar os usuários: ${membersError.message}`,
    );
    setIsLoading(false);
    return;
  }

  // 2. Extrai os IDs para buscar os nomes na tabela profiles.
  const userIds = (members ?? []).map((member) => member.user_id);

  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)
    : { data: [], error: null };

  if (profilesError) {
    setErrorMessage(
      `Não foi possível carregar os nomes dos usuários: ${profilesError.message}`,
    );
    setIsLoading(false);
    return;
  }

  // 3. Junta os dados das duas tabelas para a tela exibir nome e perfil.
  const namesByUserId = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name]),
  );

  setMemberships(
    (members ?? []).map((member) => ({
      ...member,
      full_name: namesByUserId.get(member.user_id) ?? null,
    })) as Membership[],
  );

  // 4. Busca o catálogo de permissões.
  const { data: catalog, error: catalogError } = await supabase
    .from('permission_catalog')
    .select('code, name')
    .order('name');

  if (catalogError) {
    setErrorMessage(
      `Não foi possível carregar as permissões: ${catalogError.message}`,
    );
  } else {
    setPermissions((catalog ?? []) as Permission[]);
  }

  setIsLoading(false);
}, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function selectMember(member: Membership) {
    setSelectedMember(member);
    setMessage('');
    setErrorMessage('');
    setIsPasswordResetOpen(false);
    setIssuedTemporaryPassword('');

    const { data, error } = await supabase
      .from('membership_permissions')
      .select('permission_code')
      .eq('membership_id', member.id);

    if (error) {
      setErrorMessage(`Não foi possível carregar as permissões do usuário: ${error.message}`);
      return;
    }

    setAssignedPermissions((data ?? []).map((item) => item.permission_code));
  }

  async function toggleActive(member: Membership) {
    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('tenant_memberships')
      .update({ is_active: !member.is_active })
      .eq('id', member.id);

    if (error) {
      setErrorMessage(`Não foi possível atualizar o usuário: ${error.message}`);
    } else {
      setMessage(`Usuário ${member.is_active ? 'desativado' : 'ativado'} com sucesso.`);
      setSelectedMember((current) =>
        current?.id === member.id
          ? { ...current, is_active: !member.is_active }
          : current,
      );
      await loadData();
    }

    setIsSaving(false);
  }
  async function setTemporaryPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMember) return;

    if (temporaryPasswordMode === 'manual' && manualTemporaryPassword.length < 12) {
      setErrorMessage('A senha temporária deve ter pelo menos 12 caracteres.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');
    setIssuedTemporaryPassword('');

    const { data, error } = await supabase.functions.invoke('manage-tenant-password', {
      body: {
        action: 'set_temporary',
        tenantId,
        userId: selectedMember.user_id,
        mode: temporaryPasswordMode,
        ...(temporaryPasswordMode === 'manual' ? { password: manualTemporaryPassword } : {}),
      },
    });

    if (error) {
      let detail = error.message;

      if (error instanceof FunctionsHttpError) {
        const responseBody = await error.context.json();
        detail = responseBody.error ?? detail;
      }

      setErrorMessage(`Não foi possível redefinir a senha: ${detail}`);
    } else {
      const password = temporaryPasswordMode === 'generated'
        ? String(data?.temporaryPassword ?? '')
        : manualTemporaryPassword;

      setIssuedTemporaryPassword(password);
      setMessage(`Senha temporária definida para ${getMemberName(selectedMember)}.`);
      setManualTemporaryPassword('');
    }

    setIsSaving(false);
  }
  async function togglePermission(permissionCode: string) {
    if (!selectedMember) return;

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const alreadyAssigned = assignedPermissions.includes(permissionCode);

    const request = alreadyAssigned
      ? supabase
          .from('membership_permissions')
          .delete()
          .eq('membership_id', selectedMember.id)
          .eq('permission_code', permissionCode)
      : supabase.from('membership_permissions').insert({
          membership_id: selectedMember.id,
          permission_code: permissionCode,
        });

    const { error } = await request;

    if (error) {
      setErrorMessage(`Não foi possível salvar a permissão: ${error.message}`);
    } else {
      setAssignedPermissions((current) =>
        alreadyAssigned
          ? current.filter((code) => code !== permissionCode)
          : [...current, permissionCode],
      );
      setMessage('Permissão atualizada com sucesso.');
    }

    setIsSaving(false);
  }
async function createUser(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  setIsCreatingUser(true);
  setMessage('');
  setErrorMessage('');

  const { error } = await supabase.functions.invoke('create-tenant-user', {
    body: {
      tenantId,
      fullName: newUser.fullName,
      email: newUser.email,
      password: newUser.password,
      role: newUser.role,
    },
  });

  if (error) {
  let detail = error.message;

  if (error instanceof FunctionsHttpError) {
    const responseBody = await error.context.json();
    detail = responseBody.error ?? detail;
  }

  setErrorMessage(`Não foi possível cadastrar o usuário: ${detail}`);
} else {
    setMessage('Usuário cadastrado com sucesso.');
    setNewUser({
      fullName: '',
      email: '',
      password: '',
      role: 'navigation',
    });
    setIsCreateFormOpen(false);
    await loadData();
  }

  setIsCreatingUser(false);
}
  return (
    <div>
      {!isDetailView && <div className="user-admin-actions">
  <button
  className="button-with-icon"
  onClick={() => {
    setMessage('');
    setErrorMessage('');
    setIsCreateFormOpen(true);
  }}
>
  <UserPlus size={17} />
  Novo usuário
</button>

<button
  className="secondary button-with-icon"
  onClick={() => void loadData()}
  disabled={isLoading}
>
  <RefreshCw size={17} />
  Atualizar lista
</button>
</div>}

    

      {message && <p className="success-message">{message}</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}
{isCreateFormOpen && (
  <form
  className="new-user-form panel"
  onSubmit={createUser}
  autoComplete="off"
>
    <div className="panel-head">
      <div>
        <p className="eyebrow">NOVO USUÁRIO</p>
        <h2>Cadastrar usuário no cliente</h2>
      </div>

      <button
        type="button"
        className="secondary icon-action"
        title="Cancelar cadastro"
        aria-label="Cancelar cadastro"
        onClick={() => setIsCreateFormOpen(false)}
      >
        <X size={18} />
      </button>

    </div>

    <label className="field">
      <span>Nome completo</span>
      <input
        required
        name="new-user-full-name"
        autoComplete="off"
        value={newUser.fullName}
        onChange={(event) =>
          setNewUser({ ...newUser, fullName: event.target.value })
        }
      />
    </label>

    <label className="field">
      <span>E-mail</span>
      <input
        required
        type="email"
        name="new-user-email"
autoComplete="off"
        value={newUser.email}
        onChange={(event) =>
          setNewUser({ ...newUser, email: event.target.value })
        }
      />
    </label>

    <label className="field">
      <span>Senha inicial (mínimo de 12 caracteres)</span>
      <input
        required
        minLength={12}
        type="password"
        name="new-user-password"
autoComplete="new-password"
        value={newUser.password}
        onChange={(event) =>
          setNewUser({ ...newUser, password: event.target.value })
        }
      />
    </label>

    <label className="field">
      <span>Perfil inicial</span>
      <select
        value={newUser.role}
        onChange={(event) =>
          setNewUser({ ...newUser, role: event.target.value })
        }
      >
        <option value="navigation">Navegação</option>
        <option value="tenant_admin">Administrador do cliente</option>
      </select>
    </label>

    <div className="form-actions">
      <button type="submit" disabled={isCreatingUser}>
        {isCreatingUser ? 'Cadastrando...' : 'Cadastrar usuário'}
      </button>
    </div>
  </form>
)}
      {!isDetailView && <div className="panel table client-user-table">
        <div className="table-head client-user-table-head">
          <span>USUÁRIO</span>
          <span>PERFIL</span>
          <span>STATUS</span>
        </div>
        <p className="authenticated-user">
  Sessão atual: <strong>{currentName}</strong> — {formatRole(currentRole)}
</p>

        {isLoading && (
          <div className="empty-state">Carregando usuários e permissões...</div>
        )}

        {!isLoading && memberships.length === 0 && (
          <div className="empty-state">
            Nenhum usuário adicional foi encontrado para este cliente.
          </div>
        )}

        {!isLoading &&
          memberships.map((member) => (
            <div
  className={`table-row ${member.is_active ? '' : 'is-inactive'}`}
  key={member.id}
>
  
              <div>
                <button
                  type="button"
                  className="work-order-link"
                  onClick={() => void selectMember(member)}
                >
                  {getMemberName(member)}
                </button>
                <small>{formatRole(member.role)}</small>
              </div>
              <span>{formatRole(member.role)}</span>
              <span className={`badge ${member.is_active ? 'asset-status-active' : 'asset-status-inactive'}`}>
                {member.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          ))}
      </div>}

      {selectedMember && (
        <section className="panel admin-record-detail">
          <div className="panel-head">
            <div>
              <p className="eyebrow">PERMISSÕES DO USUÁRIO</p>
              <h2>{getMemberName(selectedMember)}</h2>
            </div>

            <button className="secondary" onClick={() => setSelectedMember(null)}>
              Voltar para usuários
            </button>
          </div>

          <div className="form-actions admin-record-actions">
            <button
              type="button"
              className="secondary button-with-icon"
              disabled={isSaving}
              onClick={() => void toggleActive(selectedMember)}
            >
              <Power size={16} />
              {selectedMember.is_active ? 'Desativar usuário' : 'Ativar usuário'}
            </button>
            <button
              type="button"
              className="secondary button-with-icon"
              disabled={isSaving || !selectedMember.is_active}
              onClick={() => {
                setIsPasswordResetOpen((current) => !current);
                setTemporaryPasswordMode('generated');
                setManualTemporaryPassword('');
                setIssuedTemporaryPassword('');
                setMessage('');
                setErrorMessage('');
              }}
            >
              <LockKeyhole size={16} />
              Redefinir senha
            </button>
            <span className="admin-record-permission-label">
              <KeyRound size={16} /> Permissões do usuário
            </span>
          </div>

          {isPasswordResetOpen && selectedMember.is_active && (
            <form className="new-user-form panel" onSubmit={setTemporaryPassword}>
              <div className="panel-head">
                <div>
                  <p className="eyebrow">SENHA TEMPORÁRIA</p>
                  <h3>Redefinir acesso de {getMemberName(selectedMember)}</h3>
                </div>
              </div>

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
                  />
                </label>
              )}

              {issuedTemporaryPassword && (
                <label className="field">
                  <span>Copie e entregue esta senha agora. Ela não será exibida novamente.</span>
                  <input type="text" readOnly value={issuedTemporaryPassword} onFocus={(event) => event.currentTarget.select()} />
                </label>
              )}

              <p className="authenticated-user">
                No próximo acesso, o usuário deverá cadastrar uma nova senha antes de usar a plataforma.
              </p>

              <div className="form-actions">
                {!issuedTemporaryPassword && (
                  <button type="submit" disabled={isSaving}>
                    {isSaving ? 'Redefinindo...' : 'Definir senha temporária'}
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
                  {issuedTemporaryPassword ? 'Concluído' : 'Cancelar'}
                </button>
              </div>
            </form>
          )}

          {permissions.map((permission) => (
            <label className="permission-option" key={permission.code}>
              <span>
                <input
                  type="checkbox"
                  disabled={isSaving}
                  checked={assignedPermissions.includes(permission.code)}
                  onChange={() => void togglePermission(permission.code)}
                />{' '}
                {permission.name}
              </span>
            </label>
          ))}
        </section>
      )}
    </div>
  );
}
