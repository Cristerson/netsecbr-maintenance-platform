import { useCallback, useEffect, useState } from 'react';
import { Activity, Building2, CreditCard, LifeBuoy, LogOut, Menu, Settings, ShieldCheck, Users, X } from 'lucide-react';
import type { CurrentAccount } from './auth-gate';
import { CommandCenter, type CommandCenterView } from './command-center';
import { supabase } from './supabase';
import './platform-app.css';

const sections: { id: CommandCenterView; label: string; icon: typeof Activity }[] = [
  { id: 'home', label: 'Visão geral da plataforma', icon: Activity },
  { id: 'clients', label: 'Clientes e tenants', icon: Building2 },
  { id: 'contracts', label: 'Planos, contratos e licenças', icon: CreditCard },
  { id: 'platform_team', label: 'Usuários e administração', icon: Users },
  { id: 'health', label: 'Saúde dos serviços', icon: ShieldCheck },
  { id: 'support', label: 'Suporte e chamados', icon: LifeBuoy },
  { id: 'settings', label: 'Configurações da plataforma', icon: Settings },
];

export function PlatformApp({ account }: { account: CurrentAccount }) {
  const navigationKey = `marv:platform-section:${account.userId}`;
  const [section, setSection] = useState<CommandCenterView>(() => {
    try {
      const stored = window.sessionStorage.getItem(navigationKey);
      return sections.some((item) => item.id === stored) ? stored as CommandCenterView : 'home';
    } catch { return 'home'; }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const onViewChange = useCallback((view: CommandCenterView) => setSection(view), []);
  useEffect(() => {
    try { window.sessionStorage.setItem(navigationKey, section); } catch { /* storage indisponível */ }
  }, [navigationKey, section]);

  async function signOut() {
    try {
      window.sessionStorage.removeItem(navigationKey);
      window.sessionStorage.removeItem(`marv:command-center:${account.userId}`);
    } catch { /* storage indisponível */ }
    await supabase.auth.signOut();
  }

  return <div className="app-shell platform-shell">
    <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><div className="brand-logo"><img src="/brand/logo_netsecbr.png" alt="NetSecBR" /></div><div><small>MARV COMMAND CENTER</small></div>
        <button className="mobile-close" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}><X /></button></div>
      <div className="workspace"><ShieldCheck size={17} /><span>NETSECBR</span><small>{account.roleLabel}</small></div>
      <nav aria-label="Administração da plataforma">{sections.map(({ id, label, icon: Icon }) => <button key={id} className={section === id ? 'active' : ''}
        onClick={() => { setSection(id); setMenuOpen(false); }}><Icon size={19} />{label}</button>)}</nav>
      <div className="sidebar-bottom"><button onClick={() => void signOut()}><LogOut size={18} />Sair / trocar usuário</button>
        <div className="user"><span>{account.fullName.slice(0, 2).toUpperCase()}</span><div><strong>{account.fullName}</strong><small>{account.roleLabel}</small></div></div></div>
    </aside>
    <main><header><button className="mobile-menu" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}><Menu /></button>
      <div><p className="eyebrow">ADMINISTRAÇÃO DA PLATAFORMA</p><h1>{sections.find((item) => item.id === section)?.label ?? 'Command Center'}</h1></div>
      <div className="header-actions"><span className="platform-session-badge">Sessão NetSecBR</span><span className="avatar" title={account.email}>{account.fullName.slice(0, 2).toUpperCase()}</span></div>
    </header>
    <CommandCenter isNetsecbrAdmin={account.isNetsecbrAdmin} currentUserId={account.userId} requestedView={section} onViewChange={onViewChange} />
    </main>
  </div>;
}
