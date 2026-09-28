import {
  consumptionMetrics,
  formatConsumptionValue,
  formatEntitlementLimit,
  getConsumptionSituation,
  getWorstConsumptionSituation,
  type CommandCenterConsumptionItem,
  type CommandCenterEntitlement,
} from './use-command-center-data';

/* Mesma malha usada no detalhe do módulo de franquias: métrica, consumo e situação. */
const franchiseRowGrid = { gridTemplateColumns: '1.6fr .9fr 1fr' };

function consumptionSubLabel(code: string) {
  return code === 'work_orders.monthly' ? 'Uso no mês atual' : 'Uso acumulado no contrato';
}

function entitlementSubLabel(code: string) {
  return code === 'work_orders.monthly' ? 'Limite mensal' : 'Limite do contrato';
}

/* Franquias contratadas x consumo real do cliente aberto no Command Center.
   Recebe o que o módulo de Clientes já carregou (uma única leitura por visita); as
   franquias do contrato (fallbackEntitlements) entram quando o consumo não carrega. */
export function TenantFranchisePanel({
  itemsByCode,
  isLoading,
  error,
  fallbackEntitlements,
}: {
  itemsByCode: Map<string, CommandCenterConsumptionItem> | undefined;
  isLoading: boolean;
  error: string;
  fallbackEntitlements: CommandCenterEntitlement[];
}) {
  const tenantItems = consumptionMetrics
    .map((metric) => itemsByCode?.get(metric.code))
    .filter((item): item is CommandCenterConsumptionItem => Boolean(item));

  const worst = tenantItems.length > 0 ? getWorstConsumptionSituation(tenantItems) : null;
  const showFallback = !isLoading && tenantItems.length === 0 && fallbackEntitlements.length > 0;

  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">FRANQUIAS E CONSUMO</p>
          <h2>Franquias e consumo do cliente</h2>
        </div>
        {worst ? <span className={`badge ${worst.className}`}>{worst.label}</span> : null}
      </div>

      <p style={{ margin: '0 0 14px', color: '#6680a8', fontSize: 13 }}>
        Consumo real comparado às franquias do contrato vigente.
      </p>

      {error && <p className="data-error" role="alert">{error}</p>}

      {isLoading && tenantItems.length === 0 && !error ? (
        <p className="empty">Carregando franquias e consumo…</p>
      ) : null}

      {tenantItems.length > 0 && (
        <div className="table">
          {tenantItems.map((item) => {
            const situation = getConsumptionSituation(item);
            const consumedLabel = formatConsumptionValue(item.consumedValue, item.unit);
            const limitLabel = item.isUnlimited
              ? 'Ilimitado'
              : item.isConfigured && item.limitValue !== null && item.limitValue > 0
                ? formatConsumptionValue(item.limitValue, item.unit)
                : null;

            return (
              <div className="table-row" style={franchiseRowGrid} key={item.code}>
                <div>
                  <strong>{item.name}</strong>
                  <small>{consumptionSubLabel(item.code)}</small>
                </div>
                <span>{limitLabel ? consumedLabel + ' de ' + limitLabel : consumedLabel}</span>
                <span className={`badge ${situation.className}`}>{situation.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {showFallback && (
        <div className="table">
          {fallbackEntitlements.map((entitlement) => (
            <div className="table-row" style={franchiseRowGrid} key={entitlement.code}>
              <div>
                <strong>{entitlement.name}</strong>
                <small>{entitlementSubLabel(entitlement.code)}</small>
              </div>
              <span>{formatEntitlementLimit(entitlement)}</span>
              <span className="badge asset-status-inactive">Consumo indisponível</span>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && tenantItems.length === 0 && fallbackEntitlements.length === 0 && (
        <p className="empty">Nenhuma franquia cadastrada para o contrato vigente.</p>
      )}

      <p className="empty">
        Armazenamento considera atualmente apenas arquivos do bucket de identidade visual do tenant. Anexos operacionais entrarão na medição quando esse recurso existir.
      </p>
    </article>
  );
}