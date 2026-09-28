import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus, RefreshCw, X } from 'lucide-react';
import { supabase } from './supabase';
import type { CurrentAccount } from './auth-gate';

type Props = {
  tenantId: string;
  account: CurrentAccount;
};

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

type SupportTicket = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  service_area: string | null;
  service_category: string | null;
  service_topic: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
};

const statusLabels: Record<TicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em atendimento',
  resolved: 'Resolvido',
  closed: 'Encerrado',
};

const priorityLabels: Record<TicketPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

const serviceCatalog: Record<string, Record<string, string[]>> = {
  'Acesso e usuários': {
    'Login e senha': ['Não consigo entrar', 'Redefinição de senha', 'Troca de e-mail'],
    'Usuários e permissões': ['Criar usuário', 'Alterar perfil ou permissão', 'Desativar usuário'],
  },
  'Cobrança e contrato': {
    Fatura: ['Segunda via', 'Valor ou vencimento', 'Fatura não recebida'],
    Pagamento: ['Pagamento não identificado', 'Comprovante', 'Reembolso'],
    'Plano e contrato': ['Dúvida sobre plano', 'Renovação', 'Alteração contratual'],
  },
  'Cadastro e configurações': {
    'Dados do cliente': ['Razão social ou CNPJ', 'Unidade ou centro de custo'],
    'Configuração do MARV': ['Identidade visual', 'Outro cadastro'],
  },
  'Problema técnico no MARV': {
    'Erro na tela': ['Tela não abre', 'Mensagem de erro', 'Dados não carregam'],
    Desempenho: ['Lentidão', 'Página travada'],
    'Comportamento inesperado': ['Informação incorreta', 'Outro comportamento'],
  },
  'Dúvida sobre operação': {
    'Ativos e preventivas': ['Cadastro', 'Plano preventivo'],
    'Solicitações e OS': ['Abrir solicitação', 'Triagem', 'Execução ou conclusão'],
    'Usuários e permissões': ['Perfil', 'Acesso'],
  },
  'Solicitação comercial': {
    'Demonstração e treinamento': ['Demonstração', 'Treinamento'],
    'Expansão': ['Novo cliente', 'Ampliação de licenças'],
    Parceria: ['Comercial', 'Técnica'],
  },
  Outro: {
    'Outro assunto': ['Preciso explicar outro caso'],
  },
};

function formatTicketDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function getTicketClassification(ticket: SupportTicket) {
  const parts = [ticket.service_area, ticket.service_category, ticket.service_topic].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  );

  if (parts.length > 0) return parts.join(' · ');

  return ticket.title;
}
export function SupportTicketAdmin({ tenantId, account }: Props) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [serviceArea, setServiceArea] = useState('');
  const [serviceCategory, setServiceCategory] = useState('');
  const [serviceTopic, setServiceTopic] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const isTenantAdmin = account.isTenantAdmin === true;

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('support_tickets')
      .select('id, title, description, status, priority, service_area, service_category, service_topic, resolution_note, resolved_at, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage(`Não foi possível carregar os chamados: ${error.message}`);
      setIsLoading(false);
      return;
    }

    setTickets((data ?? []) as SupportTicket[]);
    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (!isTenantAdmin) {
      setIsLoading(false);
      return;
    }

    void loadTickets();
  }, [isTenantAdmin, loadTickets]);

  if (!isTenantAdmin) {
    return (
      <div className="insight">
        <p>Este módulo está disponível somente para o administrador do cliente.</p>
      </div>
    );
  }

  function openNewTicket() {
    setServiceArea('');
    setServiceCategory('');
    setServiceTopic('');
    setDescription('');
    setMessage('');
    setErrorMessage('');
    setIsFormOpen(true);
  }

  function handleAreaChange(value: string) {
    setServiceArea(value);
    setServiceCategory('');
    setServiceTopic('');
  }

  function handleCategoryChange(value: string) {
    setServiceCategory(value);
    setServiceTopic('');
  }

  function backToList() {
    setIsFormOpen(false);
    setMessage('');
    setErrorMessage('');
  }

  async function saveTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!serviceArea) {
      setErrorMessage('Selecione o assunto principal.');
      return;
    }

    if (!serviceCategory) {
      setErrorMessage('Selecione a categoria específica.');
      return;
    }

    if (!serviceTopic) {
      setErrorMessage('Selecione o detalhe do caso.');
      return;
    }

    const normalizedDescription = description.trim();

    if (normalizedDescription.length < 10 || normalizedDescription.length > 3000) {
      setErrorMessage('Descreva o que aconteceu com 10 a 3000 caracteres.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase.rpc('create_tenant_support_ticket', {
      target_tenant_id: tenantId,
      target_service_area: serviceArea,
      target_service_category: serviceCategory,
      target_service_topic: serviceTopic,
      target_description: normalizedDescription,
    });

    if (error) {
      setErrorMessage(`Não foi possível abrir o chamado: ${error.message}`);
      setIsSaving(false);
      return;
    }

    setMessage('Chamado aberto com sucesso. A NETSECBR vai atender e atualizar a situação por aqui.');
    setIsFormOpen(false);
    setServiceArea('');
    setServiceCategory('');
    setServiceTopic('');
    setDescription('');
    setIsSaving(false);
    await loadTickets();
  }

  const availableCategories = serviceArea ? Object.keys(serviceCatalog[serviceArea] ?? {}) : [];
  const availableTopics =
    serviceArea && serviceCategory ? (serviceCatalog[serviceArea]?.[serviceCategory] ?? []) : [];

  return (
    <div>
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

      {!isFormOpen && (
        <div className="user-admin-actions">
          <button className="button-with-icon" onClick={openNewTicket} disabled={isLoading || isSaving}>
            <Plus size={17} />
            Abrir chamado
          </button>

          <button
            className="secondary button-with-icon"
            onClick={() => void loadTickets()}
            disabled={isLoading || isSaving}
          >
            <RefreshCw size={17} />
            Atualizar lista
          </button>
        </div>
      )}

      {isFormOpen ? (
        <form className="new-user-form panel" onSubmit={saveTicket}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">SUPORTE NETSECBR</p>
              <h2>Abrir chamado</h2>
            </div>

            <button type="button" className="secondary button-with-icon" onClick={backToList} disabled={isSaving}>
              <ArrowLeft size={17} />
              Voltar para chamados
            </button>
          </div>

          <label className="field">
            <span>Assunto principal</span>
            <select value={serviceArea} onChange={(event) => handleAreaChange(event.target.value)} required>
              <option value="">Selecione o assunto</option>
              {Object.keys(serviceCatalog).map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>

          {serviceArea && (
            <label className="field">
              <span>Categoria específica</span>
              <select value={serviceCategory} onChange={(event) => handleCategoryChange(event.target.value)} required>
                <option value="">Selecione a categoria</option>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          )}

          {serviceCategory && (
            <label className="field">
              <span>Detalhe do caso</span>
              <select value={serviceTopic} onChange={(event) => setServiceTopic(event.target.value)} required>
                <option value="">Selecione o detalhe</option>
                {availableTopics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="field support-ticket-description">
            <span>Descreva o que aconteceu</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={8}
              minLength={10}
              maxLength={3000}
              placeholder="Conte o que aconteceu com o máximo de detalhes possível."
              required
            />
            <small>
              {description.trim().length} de 3000 caracteres (mínimo 10).
            </small>
          </label>

          <div className="user-admin-actions">
            <button type="submit" className="button-with-icon" disabled={isSaving}>
              <Plus size={17} />
              {isSaving ? 'Abrindo chamado…' : 'Abrir chamado'}
            </button>
          </div>
        </form>
      ) : (
        <article className="panel table">
          <div className="table-head">
            <span>ASSUNTO / CLASSIFICAÇÃO</span>
            <span>SITUAÇÃO</span>
            <span>PRIORIDADE NETSECBR</span>
            <span>ABERTURA</span>
          </div>

          {isLoading && <div className="empty-state">Carregando chamados...</div>}

          {!isLoading &&
            tickets.map((ticket) => (
              <div className="table-row" key={ticket.id}>
                <div>
                  <strong>{getTicketClassification(ticket)}</strong>
                  {ticket.description && <p>{ticket.description}</p>}
                  {ticket.resolution_note && (
                    <p>
                      <strong>
                        Resposta NETSECBR{ticket.resolved_at ? ` em ${formatTicketDate(ticket.resolved_at)}` : ''}:
                      </strong>{' '}
                      {ticket.resolution_note}
                    </p>
                  )}
                </div>
                <div>
                  <span>{statusLabels[ticket.status] ?? ticket.status}</span>
                </div>
                <div>
                  <span>{priorityLabels[ticket.priority] ?? ticket.priority}</span>
                </div>
                <div>
                  <span>{formatTicketDate(ticket.created_at)}</span>
                </div>
              </div>
            ))}

          {!isLoading && tickets.length === 0 && (
            <div className="empty-state">Nenhum chamado aberto para a NETSECBR.</div>
          )}
        </article>
      )}
    </div>
  );
}
