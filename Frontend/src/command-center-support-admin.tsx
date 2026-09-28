import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, LifeBuoy, RefreshCw, X } from 'lucide-react';
import { supabase } from './supabase';
import type { CommandCenterTenant } from './use-command-center-data';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
type SupportStatusFilter = 'all' | TicketStatus;
type SupportPriorityFilter = 'all' | TicketPriority;

type SupportAgent = { userId: string; fullName: string; role: string };

type CommandCenterSupportTicket = {
  id: string;
  tenantId: string;
  tenantName: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo: string | null;
  assigneeName: string | null;
  openerName: string | null;
  serviceArea: string | null;
  serviceCategory: string | null;
  serviceTopic: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Props = { tenants: CommandCenterTenant[]; onBack: () => void };

const statusLabels: Record<TicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

const priorityLabels: Record<TicketPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

const priorityBadge: Record<TicketPriority, string> = {
  low: 'asset-status-inactive',
  medium: 'asset-status-active',
  high: 'request-status-pending',
  critical: 'request-status-rejected',
};

const statusBadge: Record<TicketStatus, string> = {
  open: 'request-status-pending',
  in_progress: 'request-status-approved',
  resolved: 'asset-status-active',
  closed: 'asset-status-inactive',
};

function SupportMetric({ label, value, icon, warn }: { label: string; value: string; icon: ReactNode; warn?: boolean }) {
  return (
    <article className={`metric ${warn ? 'warning' : ''}`}>
      <div className="metric-icon">{icon}</div>
      <p>{label}</p>
      <h2>{value}</h2>
    </article>
  );
}

function formatSupportDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getClassification(ticket: CommandCenterSupportTicket) {
  const parts = [ticket.serviceArea, ticket.serviceCategory, ticket.serviceTopic].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  );
  if (parts.length > 0) return parts.join(' · ');
  return ticket.title;
}

const supportTableGrid = { gridTemplateColumns: '1.2fr 1.6fr .8fr .8fr 1fr .9fr .9fr' };


export function CommandCenterSupportAdmin({ tenants, onBack }: Props) {
  const [tickets, setTickets] = useState<CommandCenterSupportTicket[]>([]);
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SupportStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<SupportPriorityFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<TicketStatus>('open');
  const [editPriority, setEditPriority] = useState<TicketPriority>('medium');
  const [editAssignee, setEditAssignee] = useState('');
  const [editResponse, setEditResponse] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const tenantNameById = useMemo(() => {
    const map = new Map<string, string>();
    tenants.forEach((tenant) => {
      const name = tenant.tradeName?.trim() || tenant.legalName?.trim() || 'Cliente';
      map.set(tenant.tenantId, name);
    });
    return map;
  }, [tenants]);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id, tenant_id, title, description, status, priority, assigned_to, opened_by, service_area, service_category, service_topic, resolution_note, resolved_at, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) {
      setErrorMessage(`Não foi possível carregar os chamados: ${error.message}`);
      setIsLoading(false);
      return;
    }
    const rows = (data ?? []) as Array<Record<string, string | null>>;
    const assigneeIds = Array.from(new Set(rows.map((row) => row.assigned_to).filter((value): value is string => typeof value === 'string' && value.length > 0)));
    const openerIds = Array.from(new Set(rows.map((row) => row.opened_by).filter((value): value is string => typeof value === 'string' && value.length > 0)));
    const profileIds = Array.from(new Set([...assigneeIds, ...openerIds]));
    let profileNameById = new Map<string, string>();
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', profileIds);
      profileNameById = new Map((profiles ?? []).map((profile) => [String(profile.id), String(profile.full_name ?? 'Equipe NETSECBR')]));
    }
    setTickets(rows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      tenantName: tenantNameById.get(String(row.tenant_id)) ?? 'Cliente',
      title: String(row.title ?? 'Chamado'),
      description: typeof row.description === 'string' ? row.description : null,
      status: (row.status as TicketStatus) ?? 'open',
      priority: (row.priority as TicketPriority) ?? 'medium',
      assignedTo: typeof row.assigned_to === 'string' ? row.assigned_to : null,
      assigneeName: typeof row.assigned_to === 'string' ? (profileNameById.get(row.assigned_to) ?? null) : null,
      openerName: typeof row.opened_by === 'string' ? (profileNameById.get(row.opened_by) ?? null) : null,
      serviceArea: typeof row.service_area === 'string' ? row.service_area : null,
      serviceCategory: typeof row.service_category === 'string' ? row.service_category : null,
      serviceTopic: typeof row.service_topic === 'string' ? row.service_topic : null,
      resolutionNote: typeof row.resolution_note === 'string' ? row.resolution_note : null,
      resolvedAt: typeof row.resolved_at === 'string' ? row.resolved_at : null,
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? row.created_at ?? ''),
    })));
    setIsLoading(false);
  }, [tenantNameById]);

  const loadAgents = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_command_center_support_agents');
    if (error) {
      setErrorMessage(`Não foi possível carregar os responsáveis: ${error.message}`);
      return;
    }
    setAgents(((data ?? []) as Array<Record<string, string>>).map((row) => ({
      userId: String(row.user_id),
      fullName: String(row.full_name ?? 'Equipe NETSECBR'),
      role: String(row.role ?? ''),
    })));
  }, []);

  useEffect(() => {
    void loadTickets();
    void loadAgents();
  }, [loadAgents, loadTickets]);

  const filteredTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;
      if (!term) return true;
      const haystack = [ticket.tenantName, ticket.title, ticket.serviceArea, ticket.serviceCategory, ticket.serviceTopic]
        .filter((part): part is string => typeof part === 'string')
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [priorityFilter, search, statusFilter, tickets]);

  const openCount = tickets.filter((t) => t.status === 'open').length;
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length;
  const urgentCount = tickets.filter((t) => t.priority === 'high' || t.priority === 'critical').length;
  const selectedTicket = tickets.find((t) => t.id === selectedId) ?? null;

  function openTicketDetail(ticket: CommandCenterSupportTicket) {
    setSelectedId(ticket.id);
    setEditStatus(ticket.status);
    setEditPriority(ticket.priority);
    setEditAssignee(ticket.assignedTo ?? '');
    setEditResponse(ticket.resolutionNote ?? '');
    setMessage('');
    setErrorMessage('');
  }

  function backToList() {
    setSelectedId(null);
    setMessage('');
    setErrorMessage('');
  }

  async function saveTreatment() {
    if (!selectedTicket) return;
    const normalizedResponse = editResponse.trim();
    if ((editStatus === 'resolved' || editStatus === 'closed') && normalizedResponse.length < 10) {
      setErrorMessage('Informe a resposta/orientação ao cliente com pelo menos 10 caracteres para concluir o chamado.');
      return;
    }
    setIsSaving(true);
    setMessage('');
    setErrorMessage('');
    const { error } = await supabase.rpc('update_command_center_support_ticket', {
      target_ticket_id: selectedTicket.id,
      target_status: editStatus,
      target_priority: editPriority,
      target_assigned_to: editAssignee === '' ? null : editAssignee,
      target_resolution_note: normalizedResponse === '' ? null : normalizedResponse,
    });
    if (error) {
      setErrorMessage(`Não foi possível salvar o tratamento: ${error.message}`);
      setIsSaving(false);
      return;
    }
    setMessage('Tratamento do chamado salvo com sucesso.');
    setIsSaving(false);
    await loadTickets();
  }

  return (
    <section className="content admin-panel">
      <div className="admin-module-header">
        <div>
          <p className="eyebrow">SUPORTE</p>
          <h2>Atendimento e exceções</h2>
        </div>
        <div className="admin-module-header-actions">
          <button className="secondary button-with-icon" onClick={() => { void loadTickets(); void loadAgents(); }} disabled={isLoading || isSaving}>
            <RefreshCw size={17} />
            Atualizar dados
          </button>
          <button className="secondary button-with-icon" onClick={onBack}>
            <ArrowLeft size={17} />
            Voltar para Command Center
          </button>
        </div>
      </div>

      {message && (
        <div className="operation-toast operation-toast-success" role="status">
          <span>{message}</span>
          <button type="button" aria-label="Fechar mensagem" title="Fechar" onClick={() => setMessage('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="operation-toast operation-toast-error" role="alert">
          <span>{errorMessage}</span>
          <button type="button" aria-label="Fechar aviso" title="Fechar" onClick={() => setErrorMessage('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {selectedTicket ? (
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">CHAMADO</p>
              <h2>{selectedTicket.title}</h2>
            </div>
            <button type="button" className="secondary button-with-icon" onClick={backToList} disabled={isSaving}>
              <ArrowLeft size={17} />
              Voltar para chamados
            </button>
          </div>
          <p><strong>Cliente:</strong> {selectedTicket.tenantName}</p>
          <p><strong>Classificação:</strong> {getClassification(selectedTicket)}</p>
          {selectedTicket.description && <p><strong>Descrição original:</strong> {selectedTicket.description}</p>}
          {selectedTicket.openerName && <p><strong>Solicitante:</strong> {selectedTicket.openerName}</p>}
          <p><strong>Abertura:</strong> {formatSupportDate(selectedTicket.createdAt)}</p>
          <p><strong>Última atualização:</strong> {formatSupportDate(selectedTicket.updatedAt)}</p>
          <div className="form-grid">
            <label className="field">
              <span>Situação</span>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as TicketStatus)} disabled={isSaving}>
                <option value="open">Aberto</option>
                <option value="in_progress">Em andamento</option>
                <option value="resolved">Resolvido</option>
                <option value="closed">Fechado</option>
              </select>
            </label>
            <label className="field">
              <span>Prioridade</span>
              <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as TicketPriority)} disabled={isSaving}>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </label>
            <label className="field">
              <span>Responsável</span>
              <select value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)} disabled={isSaving}>
                <option value="">Sem responsável</option>
                {agents.map((a) => (
                  <option key={a.userId} value={a.userId}>{a.fullName}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field support-ticket-description">
            <span>Resposta / orientação ao cliente</span>
            <textarea
              value={editResponse}
              onChange={(event) => setEditResponse(event.target.value)}
              rows={8}
              maxLength={3000}
              placeholder="Registre a resposta ou orientação enviada ao cliente."
              disabled={isSaving}
            />
            <small>{editResponse.trim().length} de 3000 caracteres (mínimo 10 para Resolvido/Fechado).</small>
          </label>
          <div className="user-admin-actions">
            <button type="button" className="button-with-icon" onClick={() => void saveTreatment()} disabled={isSaving}>
              <LifeBuoy size={17} />
              {isSaving ? 'Salvando…' : 'Salvar tratamento'}
            </button>
          </div>
        </article>
      ) : (
        <>
          <div className="metrics">
            <SupportMetric label="Abertos" value={String(openCount)} icon={<LifeBuoy size={17} />} warn={openCount > 0} />
            <SupportMetric label="Em andamento" value={String(inProgressCount)} icon={<RefreshCw size={17} />} />
            <SupportMetric label="Alta/Crítica" value={String(urgentCount)} icon={<AlertTriangle size={17} />} warn={urgentCount > 0} />
          </div>

          {isLoading && <div className="empty-state">Carregando chamados...</div>}
          <div className="user-admin-actions">
            <label className="field">
              <span>Buscar</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por cliente, título, assunto, categoria ou detalhe"
              />
            </label>
            <label className="field">
              <span>Situação</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as SupportStatusFilter)}>
                <option value="all">Todos</option>
                <option value="open">Aberto</option>
                <option value="in_progress">Em andamento</option>
                <option value="resolved">Resolvido</option>
                <option value="closed">Fechado</option>
              </select>
            </label>
            <label className="field">
              <span>Prioridade</span>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as SupportPriorityFilter)}>
                <option value="all">Todas</option>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </label>
          </div>
          <article className="panel table">
            <div className="table-head" style={supportTableGrid}>
              <span>CLIENTE</span>
              <span>CHAMADO E CLASSIFICAÇÃO</span>
              <span>SITUAÇÃO</span>
              <span>PRIORIDADE</span>
              <span>RESPONSÁVEL</span>
              <span>ABERTURA</span>
              <span>ATUALIZAÇÃO</span>
            </div>
            {!isLoading &&
              filteredTickets.map((ticket) => (
                <div className="table-row" style={supportTableGrid} key={ticket.id}>
                  <div><span>{ticket.tenantName}</span></div>
                  <div>
                    <button type="button" className="work-order-link" onClick={() => openTicketDetail(ticket)}>
                      {getClassification(ticket)}
                    </button>
                  </div>
                  <div><span className={`badge ${statusBadge[ticket.status]}`}>{statusLabels[ticket.status] ?? ticket.status}</span></div>
                  <div><span className={`badge ${priorityBadge[ticket.priority]}`}>{priorityLabels[ticket.priority] ?? ticket.priority}</span></div>
                  <div><span>{ticket.assigneeName ?? '—'}</span></div>
                  <div><span>{formatSupportDate(ticket.createdAt)}</span></div>
                  <div><span>{formatSupportDate(ticket.updatedAt)}</span></div>
                </div>
              ))}
            {!isLoading && filteredTickets.length === 0 && (
              <div className="empty-state">Nenhum chamado encontrado com a busca e os filtros atuais.</div>
            )}
          </article>
        </>
      )}
    </section>
  );
}
