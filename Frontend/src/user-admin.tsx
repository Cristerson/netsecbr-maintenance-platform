import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { KeyRound, LockKeyhole, RefreshCw, UserPlus, X } from 'lucide-react';

type Props = {
  tenantId: string;
  currentUserId: string;
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
  email: string | null;
  created_at: string | null;
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

function formatMemberCreatedAt(createdAt: string | null | undefined) {
  if (!createdAt) return 'Data não disponível';

  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return 'Data não disponível';

  return parsed.toLocaleDateString('pt-BR');
}

export function UserAdmin({ tenantId, currentUserId, currentName, currentRole }: Props) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedMember, setSelectedMember] = useState<Membership | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState('navigation');
  const [editActive, setEditActive] = useState(true);
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
    .select('id, user_id, role, is_active, created_at')
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

  // 3.1 Busca o mapa de e-mails dos membros deste cliente pela Edge Function.
  const { data: emailData, error: emailsError } = await supabase.functions.invoke(
    'create-tenant-user',
    { body: { action: 'list_tenant_user_emails', tenantId } },
  );

  if (emailsError) {
    setErrorMessage(
      `Não foi possível carregar os e-mails dos usuários: ${emailsError.message}`,
    );
  }

  const emailsByUserId = new Map<string, string>(
    !emailsError && emailData?.emails && typeof emailData.emails === 'object'
      ? Object.entries(emailData.emails as Record<string, unknown>).map(
          ([userId, value]) => [userId, String(value)] as [string, string],
        )
      : [],
  );

  setMemberships(
    (members ?? []).map((member) => ({
      ...member,
      full_name: namesByUserId.get(member.user_id) ?? null,
      email: emailsByUserId.get(member.user_id) ?? null,
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
    setEditFullName(member.full_name ?? '');
    setEditRole(member.role);
    setEditActive(member.is_active);
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

  async function setTemporaryPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMember) return;

    if (selectedMember.user_id === currentUserId) {
      setErrorMessage(
        'Você não pode redefinir a sua própria senha neste painel. Use a recuperação de acesso.',
      );
      return;
    }

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
  async function saveMemberName() {
    if (!selectedMember) return;

    const nextName = editFullName.trim();
    const nextRole = editRole === 'tenant_admin' ? 'tenant_admin' : 'navigation';
    const nextActive = editActive;
    const nameChanged = nextName !== (selectedMember.full_name ?? '');
    const roleChanged = nextRole !== selectedMember.role;
    const activeChanged = nextActive !== selectedMember.is_active;

    if (!nextName) {
      setErrorMessage('Informe o nome completo.');
      return;
    }

    if (!nameChanged && !roleChanged && !activeChanged) return;

    const activeTenantAdmins = memberships.filter(
      (item) => item.role === 'tenant_admin' && item.is_active,
    ).length;
    const isLastActiveTenantAdmin =
      selectedMember.role === 'tenant_admin' &&
      selectedMember.is_active &&
      activeTenantAdmins <= 1;

    if (activeChanged && !nextActive) {
      if (selectedMember.user_id === currentUserId) {
        setErrorMessage('Você não pode desativar a sua própria conta.');
        return;
      }

      if (isLastActiveTenantAdmin) {
        setErrorMessage(
          'Este cliente precisa de pelo menos um administrador ativo. Ative outro administrador antes de desativar este.',
        );
        return;
      }
    }

    if (roleChanged && isLastActiveTenantAdmin) {
      setErrorMessage(
        'Este cliente precisa de pelo menos um administrador ativo. Ative outro administrador antes de alterar este perfil.',
      );
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    if (nameChanged) {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: nextName })
        .eq('id', selectedMember.user_id);

      if (error) {
        setErrorMessage(`Não foi possível atualizar o nome: ${error.message}`);
        setIsSaving(false);
        return;
      }
    }

    if (roleChanged || activeChanged) {
      const { error } = await supabase
        .from('tenant_memberships')
        .update({
          ...(roleChanged ? { role: nextRole } : {}),
          ...(activeChanged ? { is_active: nextActive } : {}),
        })
        .eq('id', selectedMember.id);

      if (error) {
        setErrorMessage(`Não foi possível atualizar o usuário: ${error.message}`);
        setIsSaving(false);
        return;
      }
    }

    setMessage('Dados do usuário atualizados com sucesso.');
    setSelectedMember((current) =>
      current?.id === selectedMember.id
        ? {
            ...current,
            full_name: nextName,
            role: nextRole,
            is_active: nextActive,
          }
        : current,
    );
    setEditFullName(nextName);
    setEditRole(nextRole);
    setEditActive(nextActive);
    await loadData();

    setIsSaving(false);
  }

  function closeDetail() {
    setSelectedMember(null);
    setIsPasswordResetOpen(false);
    setTemporaryPasswordMode('generated');
    setManualTemporaryPassword('');
    setIssuedTemporaryPassword('');
    setEditFullName('');
    setEditRole('navigation');
    setEditActive(true);
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
                <small>{member.email || 'E-mail não disponível'}</small>
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
              <p className="eyebrow">DETALHE DO USUÁRIO</p>
              <h2>{getMemberName(selectedMember)}</h2>
            </div>

            <button className="secondary" onClick={closeDetail}>
              Voltar para usuários
              </button>
              <button className="secondary button-with-icon" onClick={closeDetail}>
                <X size={17} />
                Cancelar
            </button>
          </div>

          <div className="panel-head">
            <div>
              <p className="eyebrow">DADOS CADASTRAIS</p>
              <h3>Dados do usuário</h3>
            </div>
          </div>

          <label className="field">
            <span>Nome completo</span>
            <input
              value={editFullName}
              disabled={isSaving}
              autoComplete="off"
              onChange={(event) => setEditFullName(event.target.value)}
            />
          </label>

          <div className="form-actions">
            <button
              type="button"
              disabled={
                isSaving ||
                !editFullName.trim() ||
                (editFullName.trim() === (selectedMember.full_name ?? '') &&
                  editRole === selectedMember.role &&
                  editActive === selectedMember.is_active)
              }
              onClick={() => void saveMemberName()}
            >
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>

          <p className="authenticated-user">
            E-mail: <strong>{selectedMember.email || 'E-mail não disponível'}</strong>
          </p>

          <label className="field">
            <span>Perfil</span>
            <select
              value={editRole}
              disabled={isSaving}
              onChange={(event) => setEditRole(event.target.value)}
            >
              <option value="navigation">Navegação</option>
              <option value="tenant_admin">Administrador do cliente</option>
            </select>
          </label>

          <label className="field">
            <span>Situação</span>
            <select
              value={editActive ? 'active' : 'inactive'}
              disabled={isSaving}
              onChange={(event) => setEditActive(event.target.value === 'active')}
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>

          <label className="field">
            <span>Data de criação</span>
            <input readOnly value={formatMemberCreatedAt(selectedMember.created_at)} />
          </label>

          <p className="authenticated-user">
            O e-mail é exibido para consulta. A alteração de e-mail não é permitida neste painel.
          </p>

          <div className="form-actions admin-record-actions">
            <button
              type="button"
              className="secondary button-with-icon"
              disabled={isSaving || !selectedMember.is_active}
              onClick={() => {
                if (selectedMember.user_id === currentUserId) {
                  setErrorMessage(
                    'Você não pode redefinir a sua própria senha neste painel. Use a recuperação de acesso.',
                  );
                  return;
                }

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

          <div className="panel-head">
            <div>
              <p className="eyebrow">PERMISSÕES DO USUÁRIO</p>
              <h3>Permissões</h3>
            </div>
          </div>

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
