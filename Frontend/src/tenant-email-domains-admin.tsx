import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type Domain = { id: string; domain: string; is_active: boolean };

export function TenantEmailDomainsAdmin({ tenantId }: { tenantId: string }) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: readError } = await supabase
      .from('tenant_email_domains')
      .select('id, domain, is_active')
      .eq('tenant_id', tenantId)
      .order('domain');
    if (readError) setError(`Não foi possível carregar os domínios: ${readError.message}`);
    else setDomains(data ?? []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  async function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const domain = newDomain.trim().toLowerCase();
    setError('');
    setMessage('');
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
      setError('Informe um domínio válido, sem @. Ex.: empresa.com.br');
      return;
    }
    if (domains.some((item) => item.domain === domain)) {
      setError('Este domínio já está cadastrado. Use o botão de ativação, se necessário.');
      return;
    }
    setSaving(true);
    const { data, error: writeError } = await supabase
      .from('tenant_email_domains')
      .insert({ tenant_id: tenantId, domain, is_active: true })
      .select('id')
      .single();
    if (writeError || !data) setError(`Não foi possível adicionar o domínio: ${writeError?.message ?? 'gravação não confirmada'}`);
    else {
      setNewDomain('');
      setMessage(`@${domain} autorizado para novos usuários deste cliente.`);
      await load();
    }
    setSaving(false);
  }

  async function setActive(item: Domain) {
    if (item.is_active && !window.confirm(`Desativar @${item.domain}? Novos usuários com esse domínio não poderão ser cadastrados.`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    const { data, error: writeError } = await supabase
      .from('tenant_email_domains')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
      .eq('tenant_id', tenantId)
      .select('id')
      .maybeSingle();
    if (writeError || !data) setError(`Não foi possível alterar o domínio: ${writeError?.message ?? 'gravação não confirmada'}`);
    else {
      setMessage(`@${item.domain} ${item.is_active ? 'desativado' : 'ativado'}.`);
      await load();
    }
    setSaving(false);
  }

  return (
    <article className="panel">
      <div className="panel-head">
        <div><p className="eyebrow">ACESSO POR E-MAIL</p><h2>Domínios autorizados</h2></div>
        <button type="button" className="secondary" onClick={() => void load()} disabled={loading || saving}>Atualizar</button>
      </div>
      <p>Somente administradores NETSECBR podem alterar estes domínios. A regra vale para o cadastro de novos usuários; não encerra sessões existentes.</p>
      {error && <p className="error-message" role="alert">{error}</p>}
      {message && <p className="success-message">{message}</p>}
      {loading ? <p>Carregando domínios...</p> : domains.length === 0 ? <p>Nenhum domínio cadastrado.</p> : (
        <ul>{domains.map((item) => <li key={item.id}>
          @{item.domain} — {item.is_active ? 'Ativo' : 'Inativo'}{' '}
          <button type="button" className="secondary" disabled={saving} onClick={() => void setActive(item)}>
            {item.is_active ? 'Desativar' : 'Ativar'}
          </button>
        </li>)}</ul>
      )}
      <form onSubmit={(event) => void addDomain(event)}>
        <label className="field"><span>Adicionar domínio</span>
          <input value={newDomain} onChange={(event) => setNewDomain(event.target.value)} placeholder="empresa.com.br" required />
        </label>
        <button type="submit" disabled={saving || loading}>Adicionar e ativar</button>
      </form>
    </article>
  );
}
