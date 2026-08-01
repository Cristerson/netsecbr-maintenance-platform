import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, ArrowRight, Bell, Box, ClipboardList, Factory, LayoutDashboard, Menu, Plus, Search, Wrench, X } from 'lucide-react';
import './styles.css';
import './brand.css';

type Asset = { id: number; name: string; code: string; location: string; criticality: 'Crítica' | 'Alta' | 'Média'; status: 'Operando' | 'Em manutenção' | 'Parado' };
type WorkOrder = { id: number; title: string; asset: string; type: string; priority: 'Crítica' | 'Alta' | 'Média'; status: 'Aberta' | 'Em execução' | 'Aguardando material'; technician: string; };

const initialAssets: Asset[] = [
  { id: 1, name: 'Robô FANUC M-20iA', code: 'RB-003', location: 'Jandira · Linha 3', criticality: 'Crítica', status: 'Em manutenção' },
  { id: 2, name: 'Esteira de alimentação', code: 'ET-014', location: 'Jandira · Linha 3', criticality: 'Alta', status: 'Operando' },
  { id: 3, name: 'CLP Siemens S7-1500', code: 'CLP-009', location: 'Jandira · Painel Linha 2', criticality: 'Crítica', status: 'Operando' },
  { id: 4, name: 'Compressor Atlas Copco', code: 'CP-002', location: 'Jandira · Utilidades', criticality: 'Alta', status: 'Parado' },
];

const initialOrders: WorkOrder[] = [
  { id: 1048, title: 'Falha no eixo 3', asset: 'Robô FANUC M-20iA', type: 'Emergencial', priority: 'Crítica', status: 'Em execução', technician: 'Carlos Silva' },
  { id: 1047, title: 'Inspeção e lubrificação mensal', asset: 'Esteira de alimentação', type: 'Preventiva', priority: 'Média', status: 'Aberta', technician: '—' },
  { id: 1045, title: 'Substituição de filtro de ar', asset: 'Compressor Atlas Copco', type: 'Corretiva', priority: 'Alta', status: 'Aguardando material', technician: 'Marina Souza' },
];

function Badge({ children }: { children: string }) { return <span className={`badge ${children.toLowerCase().replaceAll(' ', '-')}`}>{children}</span>; }

export default function App() {
  const [page, setPage] = useState<'dashboard' | 'assets' | 'orders'>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [assets, setAssets] = useState(initialAssets);
  const [orders, setOrders] = useState(initialOrders);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [search, setSearch] = useState('');

  const filteredAssets = useMemo(() => assets.filter((a) => `${a.name} ${a.code} ${a.location}`.toLowerCase().includes(search.toLowerCase())), [assets, search]);
  const filteredOrders = useMemo(() => orders.filter((o) => `${o.title} ${o.asset} ${o.id}`.toLowerCase().includes(search.toLowerCase())), [orders, search]);
  const nav = [{ id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard }, { id: 'assets', label: 'Ativos', icon: Box }, { id: 'orders', label: 'Ordens de serviço', icon: ClipboardList } ] as const;

  function addAsset(form: HTMLFormElement) {
    const data = new FormData(form);
    setAssets((current) => [...current, { id: Date.now(), name: String(data.get('name')), code: String(data.get('code')), location: String(data.get('location')), criticality: String(data.get('criticality')) as Asset['criticality'], status: 'Operando' }]);
    setShowAssetForm(false); form.reset();
  }
  function addOrder(form: HTMLFormElement) {
    const data = new FormData(form);
    setOrders((current) => [...current, { id: Math.max(...current.map((o) => o.id)) + 1, title: String(data.get('title')), asset: String(data.get('asset')), type: String(data.get('type')), priority: String(data.get('priority')) as WorkOrder['priority'], status: 'Aberta', technician: '—' }]);
    setShowOrderForm(false); form.reset();
  }

  return <div className="app-shell">
    <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><div className="brand-logo"><img src="/brand/logo_netsecbr.png" alt="NetSecBR" /></div><div><small>MAINTENANCE PLATFORM</small></div><button className="mobile-close" onClick={() => setMenuOpen(false)}><X /></button></div>
      <div className="workspace"><Factory size={17} /><span>Saint-Gobain Brasil</span><small>Jandira</small></div>
      <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); setMenuOpen(false); setSearch(''); }}><Icon size={19} />{label}</button>)}</nav>
      <div className="sidebar-bottom"><button><Bell size={18} />Notificações <span className="dot">3</span></button><div className="user"><span>CS</span><div><strong>Cristerson</strong><small>Administrador</small></div></div></div>
    </aside>
    <main>
      <header><button className="mobile-menu" onClick={() => setMenuOpen(true)}><Menu /></button><div><p className="eyebrow">{page === 'dashboard' ? 'SEXTA-FEIRA, 1 DE AGOSTO' : 'GESTÃO DE MANUTENÇÃO'}</p><h1>{page === 'dashboard' ? 'Bom dia, Cristerson.' : page === 'assets' ? 'Ativos industriais' : 'Ordens de serviço'}</h1></div><div className="header-actions"><label className="search"><Search size={18}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." /></label><button className="avatar">CS</button></div></header>
      {page === 'dashboard' && <Dashboard assets={assets} orders={orders} onOpenOrders={() => setPage('orders')} />}
      {page === 'assets' && <Assets assets={filteredAssets} onAdd={() => setShowAssetForm(true)} />}
      {page === 'orders' && <Orders orders={filteredOrders} onAdd={() => setShowOrderForm(true)} />}
    </main>
    {showAssetForm && <Modal title="Cadastrar ativo" onClose={() => setShowAssetForm(false)}><form onSubmit={(e) => { e.preventDefault(); addAsset(e.currentTarget); }}><Field name="name" label="Nome do ativo" required/><Field name="code" label="Código patrimonial" required/><Field name="location" label="Localização" placeholder="Unidade · Linha ou área" required/><Select name="criticality" label="Criticidade" options={['Crítica', 'Alta', 'Média']}/><button className="primary submit">Salvar ativo <ArrowRight size={17}/></button></form></Modal>}
    {showOrderForm && <Modal title="Nova ordem de serviço" onClose={() => setShowOrderForm(false)}><form onSubmit={(e) => { e.preventDefault(); addOrder(e.currentTarget); }}><Field name="title" label="Descrição do problema ou atividade" required/><Select name="asset" label="Ativo" options={assets.map((a) => a.name)}/><Select name="type" label="Tipo" options={['Emergencial', 'Preventiva', 'Corretiva', 'Preditiva', 'Melhoria']}/><Select name="priority" label="Prioridade" options={['Crítica', 'Alta', 'Média']}/><button className="primary submit">Criar ordem <ArrowRight size={17}/></button></form></Modal>}
  </div>;
}

function Dashboard({ assets, orders, onOpenOrders }: { assets: Asset[]; orders: WorkOrder[]; onOpenOrders: () => void }) { const critical = orders.filter((o) => o.priority === 'Crítica').length; return <section className="content"><div className="quick"><button className="primary" onClick={onOpenOrders}><Plus size={18}/> Nova ordem de serviço</button><button className="secondary"><ClipboardList size={18}/> Abrir solicitação</button></div><div className="metrics"><Metric label="OS abertas" value={String(orders.length)} trend="2 emergenciais" icon={<ClipboardList/>}/><Metric label="Preventivas atrasadas" value="7" trend="Requer atenção" icon={<AlertTriangle/>} warn/><Metric label="Ativos em parada" value={String(assets.filter(a => a.status === 'Parado' || a.status === 'Em manutenção').length)} trend="de 248 ativos" icon={<Wrench/>}/><Metric label="Disponibilidade" value="98,4%" trend="Últimos 30 dias" icon={<Factory/>}/></div><div className="grid"><article className="panel orders-panel"><div className="panel-head"><div><p className="eyebrow">ATENÇÃO IMEDIATA</p><h2>Ordens prioritárias</h2></div><button onClick={onOpenOrders}>Ver todas <ArrowRight size={16}/></button></div>{orders.slice(0, 3).map(o => <div className="order-row" key={o.id}><div className="order-icon"><Wrench size={18}/></div><div><strong>OS #{o.id} · {o.title}</strong><p>{o.asset} · {o.technician}</p></div><div><Badge>{o.priority}</Badge><small>{o.status}</small></div></div>)}</article><article className="panel"><div className="panel-head"><div><p className="eyebrow">ÚLTIMOS 30 DIAS</p><h2>Ocorrências por especialidade</h2></div></div><div className="bars"><Bar label="Mecânica" value="46" width="82"/><Bar label="Elétrica" value="31" width="58"/><Bar label="Programação" value="17" width="32"/><Bar label="Outros" value="8" width="15"/></div><div className="insight"><span><AlertTriangle size={18}/></span><p><strong>{critical} ordem crítica</strong> exige acompanhamento imediato.</p></div></article></div><article className="panel asset-health"><div className="panel-head"><div><p className="eyebrow">VISÃO OPERACIONAL</p><h2>Saúde dos ativos</h2></div><button onClick={onOpenOrders}>Ver ativos <ArrowRight size={16}/></button></div><div className="health-row"><div><b className="green">{assets.filter(a => a.status === 'Operando').length}</b><span>Operando normalmente</span></div><div><b className="yellow">{assets.filter(a => a.status === 'Em manutenção').length}</b><span>Em manutenção</span></div><div><b className="red">{assets.filter(a => a.status === 'Parado').length}</b><span>Parados</span></div></div></article></section> }
function Assets({ assets, onAdd }: { assets: Asset[]; onAdd: () => void }) { return <section className="content"><div className="section-top"><p>Equipamentos, robôs, controladores e demais itens da operação.</p><button className="primary" onClick={onAdd}><Plus size={18}/> Cadastrar ativo</button></div><article className="panel table"><div className="table-head"><span>ATIVO</span><span>LOCALIZAÇÃO</span><span>CRITICIDADE</span><span>SITUAÇÃO</span></div>{assets.map(a => <div className="table-row" key={a.id}><div><strong>{a.name}</strong><small>{a.code}</small></div><span>{a.location}</span><span><Badge>{a.criticality}</Badge></span><span><Badge>{a.status}</Badge></span></div>)}{!assets.length && <p className="empty">Nenhum ativo encontrado.</p>}</article></section> }
function Orders({ orders, onAdd }: { orders: WorkOrder[]; onAdd: () => void }) { return <section className="content"><div className="section-top"><p>Planeje, acompanhe e registre todas as intervenções.</p><button className="primary" onClick={onAdd}><Plus size={18}/> Nova ordem de serviço</button></div><article className="panel table"><div className="table-head orders-table"><span>ORDEM</span><span>ATIVO</span><span>TIPO</span><span>PRIORIDADE</span><span>STATUS</span></div>{orders.map(o => <div className="table-row orders-table" key={o.id}><div><strong>#{o.id} · {o.title}</strong><small>{o.technician}</small></div><span>{o.asset}</span><span>{o.type}</span><span><Badge>{o.priority}</Badge></span><span><Badge>{o.status}</Badge></span></div>)}{!orders.length && <p className="empty">Nenhuma ordem encontrada.</p>}</article></section> }
function Metric({ label, value, trend, icon, warn }: { label: string; value: string; trend: string; icon: React.ReactNode; warn?: boolean }) { return <article className={`metric ${warn ? 'warning' : ''}`}><div className="metric-icon">{icon}</div><p>{label}</p><h2>{value}</h2><small>{trend}</small></article> }
function Bar({ label, value, width }: { label: string; value: string; width: string }) { return <div className="bar"><div><span>{label}</span><strong>{value}</strong></div><i><b style={{ width: `${width}%` }}/></i></div> }
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="overlay" role="dialog" aria-modal="true"><div className="modal"><div className="modal-head"><h2>{title}</h2><button onClick={onClose}><X/></button></div>{children}</div></div> }
function Field({ name, label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { name: string; label: string }) { return <label className="field"><span>{label}</span><input name={name} {...props}/></label> }
function Select({ name, label, options }: { name: string; label: string; options: string[] }) { return <label className="field"><span>{label}</span><select name={name}>{options.map(o => <option key={o}>{o}</option>)}</select></label> }

createRoot(document.getElementById('root')!).render(<App />);
