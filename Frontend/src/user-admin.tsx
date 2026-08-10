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
      await loadData();
    }

    setIsSaving(false);
  }
  async function requestPasswordReset(member: Membership) {
    const confirmed = window.confirm(
      `Enviar um e-mail para redefinição de senha para ${getMemberName(member)}?`,
    );

    if (!confirmed) return;

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase.functions.invoke(
      'manage-tenant-password',
      {
        body: {
          action: 'request',
          tenantId,
          userId: member.user_id,
          redirectTo: window.location.origin,
        },
      },
    );

    if (error) {
      let detail = error.message;

      if (error instanceof FunctionsHttpError) {
        const responseBody = await error.context.json();
        detail = responseBody.error ?? detail;
      }

      setErrorMessage(`Não foi possível enviar a redefinição de senha: ${detail}`);
    } else {
      setMessage(
        `E-mail de redefinição de senha enviado para ${getMemberName(member)}.`,
      );
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
      <div className="user-admin-actions">
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
</div>

    

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
      <div className="table">
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
                <strong>{getMemberName(member)}</strong>
                <small>{formatRole(member.role)}</small>
              </div>

              <button
              className="secondary icon-action"
              disabled={isSaving}
              title={member.is_active ? 'Desativar usuário' : 'Ativar usuário'}
              aria-label={member.is_active ? 'Desativar usuário' : 'Ativar usuário'}
              onClick={() => void toggleActive(member)}
            >
              <Power size={18} />
            </button>
              <button
                className="secondary icon-action"
                disabled={isSaving || !member.is_active}
                title="Enviar e-mail para redefinir senha"
                aria-label="Enviar e-mail para redefinir senha"
                onClick={() => void requestPasswordReset(member)}
              >
                <LockKeyhole  size={18} />
              </button>
              <button
                className="secondary icon-action"
                disabled={isSaving}
                title="Gerenciar permissões"
                aria-label="Gerenciar permissões"
                onClick={() => void selectMember(member)}
              >
                <KeyRound size={18} />
              </button>
            </div>
          ))}
      </div>

      {selectedMember && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">PERMISSÕES DO USUÁRIO</p>
              <h2>{getMemberName(selectedMember)}</h2>
            </div>

            <button className="secondary" onClick={() => setSelectedMember(null)}>
              Fechar
            </button>
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