import { useCallback, useEffect, useState } from 'react';
import { CreditCard, HardDrive, RefreshCw, Wrench } from 'lucide-react';
import { supabase } from './supabase';

type Props = {
  tenantId: string;
};

type Subscription = {
  id: string;
  plan_name_snapshot: string;
  robot_limit_snapshot: number;
  annual_price_cents_snapshot: number;
  included_storage_bytes_snapshot: number;
  status: 'draft' | 'trial' | 'active' | 'cancelled' | 'expired';
  contract_start_date: string;
  billing_start_date: string;
  contract_end_date: string;
  trial_ends_at: string | null;
  payment_provider: string | null;
  notes: string | null;
};

type Entitlement = {
  entitlement_code: string;
  limit_value: number | null;
  is_unlimited: boolean;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
};

type EntitlementDefinition = {
  code: string;
  name: string;
  unit: 'count' | 'bytes' | 'boolean';
  default_period: 'contract' | 'monthly';
};

type Invoice = {
  id: string;
  amount_cents: number;
  due_date: string;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';
  created_at: string;
  paid_at: string | null;
};

type Payment = {
  id: string;
  invoice_id: string;
  amount_cents: number;
  method: 'pix' | 'card' | 'bank_transfer' | null;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  paid_at: string | null;
  created_at: string;
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDate(value: string | null) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function subscriptionStatusLabel(status: Subscription['status']) {
  const labels: Record<Subscription['status'], string> = {
    draft: 'Rascunho',
    trial: 'Degustação',
    active: 'Ativo',
    cancelled: 'Cancelado',
    expired: 'Expirado',
  };

  return labels[status];
}

function invoiceStatusLabel(status: Invoice['status']) {
  const labels: Record<Invoice['status'], string> = {
    draft: 'Rascunho',
    pending: 'Pendente',
    paid: 'Pago',
    overdue: 'Em atraso',
    cancelled: 'Cancelada',
  };

  return labels[status];
}

function paymentMethodLabel(method: Payment['method']) {
  const labels: Record<NonNullable<Payment['method']>, string> = {
    pix: 'PIX',
    card: 'Cartão',
    bank_transfer: 'Transferência',
  };

  return method ? labels[method] : '—';
}

export function FinanceAdmin({ tenantId }: Props) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [definitions, setDefinitions] = useState<EntitlementDefinition[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    const [{ data: subscriptionData, error: subscriptionError }, { data: invoiceData, error: invoiceError }, { data: paymentData, error: paymentError }] =
      await Promise.all([
        supabase
          .from('subscriptions')
          .select(
            'id, plan_name_snapshot, robot_limit_snapshot, annual_price_cents_snapshot, included_storage_bytes_snapshot, status, contract_start_date, billing_start_date, contract_end_date, trial_ends_at, payment_provider, notes',
          )
          .eq('tenant_id', tenantId)
          .in('status', ['draft', 'trial', 'active'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('invoices')
          .select('id, amount_cents, due_date, status, created_at, paid_at')
          .eq('tenant_id', tenantId)
          .order('due_date', { ascending: false }),

        supabase
          .from('payments')
          .select('id, invoice_id, amount_cents, method, status, paid_at, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }),
      ]);

    if (subscriptionError || invoiceError || paymentError) {
      setErrorMessage(
        `Não foi possível carregar os dados financeiros: ${
          subscriptionError?.message ?? invoiceError?.message ?? paymentError?.message
        }`,
      );
      setIsLoading(false);
      return;
    }

    const currentSubscription = subscriptionData as Subscription | null;

    setSubscription(currentSubscription);
    setInvoices((invoiceData ?? []) as Invoice[]);
    setPayments((paymentData ?? []) as Payment[]);

    if (currentSubscription) {
      const [{ data: entitlementData, error: entitlementError }, { data: definitionData, error: definitionError }] =
        await Promise.all([
          supabase
            .from('subscription_entitlements')
            .select(
              'entitlement_code, limit_value, is_unlimited, effective_from, effective_to, notes',
            )
            .eq('subscription_id', currentSubscription.id)
            .is('effective_to', null)
            .order('entitlement_code'),

          supabase
            .from('entitlement_definitions')
            .select('code, name, unit, default_period')
            .order('name'),
        ]);

      if (entitlementError || definitionError) {
        setErrorMessage(
          `Não foi possível carregar as franquias do contrato: ${
            entitlementError?.message ?? definitionError?.message
          }`,
        );
      } else {
        setEntitlements((entitlementData ?? []) as Entitlement[]);
        setDefinitions((definitionData ?? []) as EntitlementDefinition[]);
      }
    } else {
      setEntitlements([]);
      setDefinitions([]);
    }

    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function getEntitlementName(entitlement: Entitlement) {
    return (
      definitions.find((definition) => definition.code === entitlement.entitlement_code)
        ?.name ?? entitlement.entitlement_code
    );
  }

  function formatEntitlementValue(entitlement: Entitlement) {
    if (entitlement.is_unlimited) return 'Ilimitado';
    if (entitlement.limit_value === null) return '—';

    const definition = definitions.find(
      (item) => item.code === entitlement.entitlement_code,
    );

    if (definition?.unit === 'bytes') {
      return formatBytes(entitlement.limit_value);
    }

    if (definition?.unit === 'boolean') {
      return entitlement.limit_value > 0 ? 'Habilitado' : 'Não habilitado';
    }

    return String(entitlement.limit_value);
  }

  function getPaymentForInvoice(invoiceId: string) {
    return payments.find(
      (payment) => payment.invoice_id === invoiceId && payment.status === 'paid',
    );
  }

  const pendingInvoices = invoices.filter(
    (invoice) => invoice.status === 'pending' || invoice.status === 'overdue',
  );

  return (
    <div>
      <div className="user-admin-actions">
        <button
          className="secondary button-with-icon"
          onClick={() => void loadData()}
          disabled={isLoading}
        >
          <RefreshCw size={17} />
          Atualizar financeiro
        </button>
      </div>

      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {isLoading ? (
        <div className="empty-state">Carregando informações financeiras...</div>
      ) : (
        <>
          {!subscription ? (
            <article className="panel">
              <div className="empty-state">
                Nenhum contrato ativo ou em degustação foi encontrado para este cliente.
              </div>
            </article>
          ) : (
            <>
              <div className="metrics">
                <article className="metric">
                  <div className="metric-icon">
                    <CreditCard size={19} />
                  </div>
                  <p>PLANO CONTRATADO</p>
                  <h2>{subscription.plan_name_snapshot}</h2>
                  <small>{subscriptionStatusLabel(subscription.status)}</small>
                </article>

                <article className="metric">
                  <div className="metric-icon">
                    <Wrench size={19} />
                  </div>
                  <p>ROBÔS LICENCIADOS</p>
                  <h2>{subscription.robot_limit_snapshot}</h2>
                  <small>Ativos ou inativos cadastrados</small>
                </article>

                <article className="metric">
                  <div className="metric-icon">
                    <HardDrive size={19} />
                  </div>
                  <p>ARMAZENAMENTO</p>
                  <h2>{formatBytes(subscription.included_storage_bytes_snapshot)}</h2>
                  <small>Franquia contratada</small>
                </article>

                <article className="metric">
                  <div className="metric-icon">
                    <CreditCard size={19} />
                  </div>
                  <p>VALOR ANUAL</p>
                  <h2>{formatCurrency(subscription.annual_price_cents_snapshot)}</h2>
                  <small>Condições registradas no contrato</small>
                </article>
              </div>

              <article className="panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">CONTRATO</p>
                    <h2>Resumo comercial</h2>
                  </div>
                </div>

                <div className="table">
                  <div className="table-row">
                    <div>
                      <strong>Vigência</strong>
                      <small>
                        {formatDate(subscription.contract_start_date)} até{' '}
                        {formatDate(subscription.contract_end_date)}
                      </small>
                    </div>

                    <span>
                      Início de cobrança: {formatDate(subscription.billing_start_date)}
                    </span>

                    <span>
                      {subscription.trial_ends_at
                        ? `Degustação até ${formatDate(subscription.trial_ends_at)}`
                        : 'Sem período de degustação'}
                    </span>
                  </div>

                  {subscription.notes && (
                    <div className="table-row">
                      <div>
                        <strong>Observações do contrato</strong>
                        <small>{subscription.notes}</small>
                      </div>
                    </div>
                  )}
                </div>
              </article>

              <article className="panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">FRANQUIAS E LIMITES</p>
                    <h2>Recursos contratados</h2>
                  </div>
                </div>

                <div className="table">
                  {entitlements.length === 0 && (
                    <div className="empty-state">
                      Nenhuma franquia adicional foi configurada para este contrato.
                    </div>
                  )}

                  {entitlements.map((entitlement) => (
                    <div className="table-row" key={entitlement.entitlement_code}>
                      <div>
                        <strong>{getEntitlementName(entitlement)}</strong>
                        <small>
                          Vigente desde {formatDate(entitlement.effective_from)}
                        </small>
                      </div>

                      <span>{formatEntitlementValue(entitlement)}</span>
                      <span>{entitlement.notes ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </article>
            </>
          )}

          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">FATURAMENTO</p>
                <h2>Faturas</h2>
              </div>

              <span>
                {pendingInvoices.length
                  ? `${pendingInvoices.length} pendente(s)`
                  : 'Sem pendências'}
              </span>
            </div>

            <div className="table">
              {invoices.length === 0 && (
                <div className="empty-state">
                  Nenhuma fatura foi emitida para este cliente.
                </div>
              )}

              {invoices.map((invoice) => {
                const payment = getPaymentForInvoice(invoice.id);

                return (
                  <div className="table-row" key={invoice.id}>
                    <div>
                      <strong>{formatCurrency(invoice.amount_cents)}</strong>
                      <small>Vencimento: {formatDate(invoice.due_date)}</small>
                    </div>

                    <span>{invoiceStatusLabel(invoice.status)}</span>

                    <span>
                      {payment
                        ? `${paymentMethodLabel(payment.method)} em ${formatDate(payment.paid_at)}`
                        : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">PAGAMENTOS</p>
                <h2>Histórico</h2>
              </div>
            </div>

            <div className="table">
              {payments.length === 0 && (
                <div className="empty-state">
                  Nenhum pagamento foi registrado para este cliente.
                </div>
              )}

              {payments.map((payment) => (
                <div className="table-row" key={payment.id}>
                  <div>
                    <strong>{formatCurrency(payment.amount_cents)}</strong>
                    <small>{paymentMethodLabel(payment.method)}</small>
                  </div>

                  <span>{payment.status === 'paid' ? 'Pago' : payment.status}</span>
                  <span>{formatDate(payment.paid_at ?? payment.created_at)}</span>
                </div>
              ))}
            </div>
          </article>
        </>
      )}
    </div>
  );
}