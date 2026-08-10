import { FormEvent, ReactNode, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from './supabase';

export type CurrentAccount = {
  userId: string;
  tenantId: string;
  fullName: string;
  email: string;
  roleLabel: string;
  tenantName: string;
  permissions: string[];
  isTenantAdmin: boolean;
  isNetsecbrAdmin: boolean;
};


type ProfileRow = {full_name: string | null;platform_role: 'netsecbr_admin' | 'netsecbr_support' | 'tenant_user';must_change_password: boolean;
};
type MembershipRow = { id: string; tenant_id: string; role: 'tenant_admin' | 'navigation'; tenants: { trade_name: string | null } | { trade_name: string | null }[] | null };

export function AuthGate({ children }: { children: (account: CurrentAccount) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<CurrentAccount | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<'sign-in' | 'forgot-password' | 'update-password'>('sign-in');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setIsChecking(false);
    };

    void loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update-password');
        setIsChecking(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || mode === 'update-password') {
      setAccount(null);
      return;
    }

    const loadAccount = async () => {
      setIsChecking(true);
      const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }] = await Promise.all([
       supabase
  .from('profiles')
  .select('full_name, platform_role, must_change_password')
  .eq('id', session.user.id)
  .single(),
        supabase.from('tenant_memberships').select('id,tenant_id, role, tenants(trade_name)').eq('user_id', session.user.id).eq('is_active', true).limit(1),
      ]);

      if (profileError || membershipError || !profile) {
        setMessage('Não foi possível carregar seu perfil. Tente entrar novamente.');
        setAccount(null);
        setIsChecking(false);
        return;
      }
      if ((profile as ProfileRow).must_change_password) {
        setMode('update-password');
        setIsChecking(false);
        return;
      }
      let membership = (memberships?.[0] ?? null) as MembershipRow | null;
      if (!membership && profile.platform_role === 'netsecbr_admin') {
        const { data: managedTenants } = await supabase.from('tenants').select('id, trade_name').order('created_at').limit(1);
        const managedTenant = managedTenants?.[0];
        if (managedTenant) {
          membership = {
            id: '',
            tenant_id: managedTenant.id,
            role: 'tenant_admin',
            tenants: [{ trade_name: managedTenant.trade_name }],
          };
        }
      }
      const { data: grantedPermissions, error: permissionsError } =
  membership?.id
    ? await supabase
        .from('membership_permissions')
        .select('permission_code')
        .eq('membership_id', membership.id)
    : { data: [], error: null };

if (permissionsError) {
  setMessage('Não foi possível carregar suas permissões.');
  setAccount(null);
  setIsChecking(false);
  return;
}

const permissions = (grantedPermissions ?? []).map(
  (item) => item.permission_code,
);
      const roleLabel = profile.platform_role === 'netsecbr_admin'
        ? 'Administrador NETSECBR'
        : membership?.role === 'tenant_admin'
          ? 'Administrador do cliente'
          : 'Usuário de navegação';
      const membershipTenant = Array.isArray(membership?.tenants) ? membership.tenants[0] : membership?.tenants;

      setAccount({
        userId: session.user.id,
        tenantId: membership?.tenant_id || '',
        fullName: (profile as ProfileRow).full_name || session.user.email?.split('@')[0] || 'Usuário',
        email: session.user.email || '',
        roleLabel,
        tenantName: membershipTenant?.trade_name || 'NETSECBR Control Center',
        permissions, isTenantAdmin: membership?.role === 'tenant_admin', isNetsecbrAdmin: profile.platform_role === 'netsecbr_admin',
      });
      setIsChecking(false);
    };

    void loadAccount();
  }, [session]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);
    if (error) setMessage('E-mail ou senha inválidos. Confira os dados e tente novamente.');
  }

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setIsSubmitting(false);
    if (error) {
      setMessage('Não foi possível enviar o link agora. Aguarde um minuto e tente novamente.');
      return;
    }
    setMessage('Se este e-mail estiver cadastrado, você receberá um link temporário para redefinir a senha.');
  }

   async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (newPassword.length < 10) {
      setMessage('Use uma nova senha com pelo menos 10 caracteres.');
      return;
    }

    if (newPassword !== passwordConfirmation) {
      setMessage('As senhas informadas não são iguais.');
      return;
    }

    setIsSubmitting(true);

    const { error: passwordError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (passwordError) {
      setIsSubmitting(false);
      setMessage(
        'Não foi possível alterar a senha. Solicite um novo link e tente novamente.',
      );
      return;
    }

    const { error: completionError } = await supabase.functions.invoke(
      'manage-tenant-password',
      {
        body: { action: 'complete' },
      },
    );

    if (completionError) {
      setIsSubmitting(false);
      setMessage(
        'A senha foi alterada, mas não foi possível concluir a validação. Tente novamente.',
      );
      return;
    }

    await supabase.auth.signOut();

    setIsSubmitting(false);
    setMode('sign-in');
    setNewPassword('');
    setPasswordConfirmation('');
    setMessage('Senha alterada. Entre novamente usando a nova senha.');
  }

  if (isChecking) return <main className="auth-screen"><p>Carregando acesso seguro…</p></main>;
  if (mode === 'update-password') return <main className="auth-screen"><form className="auth-card" onSubmit={updatePassword}>
    <img src="/brand/logo_netsecbr.png" alt="NETSECBR" />
    <p className="eyebrow">RECUPERAÇÃO DE ACESSO</p>
    <h1>Crie uma nova senha</h1>
    <p>Escolha uma senha forte, com pelo menos 10 caracteres.</p>
    <label className="field"><span>Nova senha</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required /></label>
    <label className="field"><span>Confirmar nova senha</span><input type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} autoComplete="new-password" required /></label>
    {message && <p className="auth-message" role="alert">{message}</p>}
    <button className="primary submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando…' : 'Salvar nova senha'}</button>
  </form></main>;
  if (account) return <>{children(account)}</>;

  if (mode === 'forgot-password') return <main className="auth-screen"><form className="auth-card" onSubmit={requestPasswordReset}>
    <img src="/brand/logo_netsecbr.png" alt="NETSECBR" />
    <p className="eyebrow">RECUPERAÇÃO DE ACESSO</p>
    <h1>Recupere sua senha</h1>
    <p>Informe seu e-mail corporativo. Enviaremos um link temporário e seguro.</p>
    <label className="field"><span>E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
    {message && <p className="auth-message auth-success" role="status">{message}</p>}
    <button className="primary submit" disabled={isSubmitting}>{isSubmitting ? 'Enviando…' : 'Enviar link de recuperação'}</button>
    <button type="button" className="auth-link" onClick={() => { setMode('sign-in'); setMessage(''); }}>Voltar para o login</button>
  </form></main>;

  return <main className="auth-screen"><form className="auth-card" onSubmit={signIn}>
    <img src="/brand/logo_netsecbr.png" alt="NETSECBR" />
    <p className="eyebrow">MAINTENANCE PLATFORM</p>
    <h1>Acesse sua operação</h1>
    <p>Entre com seu e-mail corporativo para continuar.</p>
    <label className="field"><span>E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
    <label className="field"><span>Senha</span><span className="password-field"><input type={isPasswordVisible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button type="button" className="password-toggle" onClick={() => setIsPasswordVisible((visible) => !visible)} aria-label={isPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}>{isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
    {message && <p className="auth-message" role="alert">{message}</p>}
    <button className="primary submit" disabled={isSubmitting}>{isSubmitting ? 'Entrando…' : 'Entrar na plataforma'}</button>
    <button type="button" className="auth-link" onClick={() => { setMode('forgot-password'); setMessage(''); }}>Esqueci minha senha</button>
  </form></main>;
}
