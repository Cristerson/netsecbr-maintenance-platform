import { useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';

type HelpSection = {
  id: string;
  title: string;
  purpose: string;
  steps: string[];
  attention?: string[];
};

const helpSections: HelpSection[] = [
  {
    id: 'acesso-senha',
    title: 'Acesso e senha',
    purpose: 'Entrar no MARV com segurança e criar sua própria senha.',
    steps: [
      'Entre com seu e-mail corporativo e a senha recebida do administrador.',
      'No primeiro acesso, o MARV pede uma senha nova (mínimo de 10 caracteres). Troque e entre novamente.',
      'Esqueceu a senha? Use "Esqueci minha senha" na tela de entrada e siga o link enviado por e-mail.',
      'Ao terminar o turno, use "Sair / trocar usuário" no menu lateral.',
    ],
    attention: [
      'Sua senha é individual. Nunca compartilhe, nem por mensagem.',
      'A senha temporária deixa de funcionar depois que você cria a senha nova.',
    ],
  },
  {
    id: 'perfis-permissoes',
    title: 'Perfis e permissões',
    purpose: 'Entender o que cada perfil pode ver e fazer.',
    steps: [
      'Administrador NETSECBR: vê todos os menus, inclusive o Control Center NETSECBR.',
      'Administrador do cliente: vê tudo do dia a dia e as Configurações; não vê o Control Center.',
      'Usuário de navegação: vê apenas os menus liberados pelo administrador.',
      'Seu perfil aparece no menu lateral, abaixo do nome do cliente.',
    ],
    attention: [
      'Menu que não aparece é menu bloqueado para o seu perfil — fale com o administrador se precisar de acesso.',
      'Em telas de consulta, os campos aparecem preenchidos, porém desabilitados. É proposital.',
    ],
  },
  {
    id: 'usuarios',
    title: 'Usuários',
    purpose: 'Criar acessos, liberar permissões e entregar senha temporária (administradores).',
    steps: [
      'Vá em Configurações › Usuários e permissões › "Novo usuário".',
      'Informe nome, e-mail do domínio autorizado, senha inicial com 12+ caracteres e o perfil (Navegação ou Administrador do cliente).',
      'Para permissões, abra o usuário e marque o que ele precisa.',
      'Para senha temporária, abra o usuário, clique em "Redefinir senha" e entregue a senha mostrada (ela não aparece de novo).',
      'Ativar/Desativar usuário fica no detalhe dele.',
    ],
    attention: [
      'Não é possível desativar a própria conta nem o último administrador ativo do cliente.',
      'O usuário novo troca a senha no primeiro acesso.',
    ],
  },
  {
    id: 'unidades-cc',
    title: 'Unidades e centros de custo',
    purpose: 'Organizar onde o trabalho acontece e para qual setor vão os custos.',
    steps: [
      'Vá em Configurações › Cadastros › "Unidades e centros de custo".',
      'Crie primeiro o centro de custo (código e nome).',
      'Depois crie a unidade vinculada a um centro de custo (código, nome, cidade, estado).',
      'Use o botão de energia para ativar/desativar; para editar, clique no lápis.',
    ],
    attention: [
      'Itens inativos não aparecem nas novas OS, chamados e ativos.',
    ],
  },
  {
    id: 'fornecedores',
    title: 'Fornecedores',
    purpose: 'Manter o cadastro das empresas que fornecem peças e serviços.',
    steps: [
      'Para cadastrar: clique em "Novo fornecedor" (o formulário abre vazio) e preencha os dados.',
      'Para editar: clique no nome do fornecedor na lista — o detalhe abre preenchido.',
      'No detalhe, ajuste os dados e clique em "Salvar alterações".',
      'Ativar/Desativar fornecedor fica somente no detalhe.',
      'Use "Voltar para fornecedores" ou "Cancelar" para sair.',
    ],
    attention: [
      'CNPJ é opcional: informe vazio ou válido. Um CNPJ inválido impede o salvamento.',
      'Fornecedor inativo aparece acinzentado na lista.',
      'Para corrigir dados, basta editar no detalhe — não é preciso desativar e recadastrar.',
    ],
  },
  {
    id: 'ativos',
    title: 'Ativos',
    purpose: 'Cadastrar os robôs e equipamentos que o MARV acompanha.',
    steps: [
      'No menu Ativos, clique em "Novo ativo".',
      'Preencha código, nome, categoria, unidade e centro de custo (obrigatórios).',
      'Complete fabricante, modelo, número de série, criticidade e status quando tiver os dados.',
      'Para editar, clique no nome do ativo.',
      'Use "Desativar ativo" para tirá-lo do uso e "Excluir ativo" para removê-lo (o histórico é mantido).',
    ],
    attention: [
      'Ativo inativo não aparece nas novas OS, chamados e preventivas.',
    ],
  },
  {
    id: 'solicitacoes',
    title: 'Solicitações',
    purpose:
      'Registrar um problema observado no equipamento antes de existir uma OS. É o pedido formal de manutenção.',
    steps: [
      'Abra o menu Solicitações e clique em "Nova solicitação".',
      'Escreva um título claro (ex.: "Vazamento de ar na garra do ROB-001").',
      'Escolha a categoria (Mecânica, Elétrica, Software/Controlador etc.) e a prioridade.',
      'Selecione a unidade — o centro de custo aparece junto — e, se souber, o ativo.',
      'Descreva o que aconteceu, quando aconteceu e com que frequência.',
      'Clique em "Abrir solicitação".',
      'Para conferir depois, clique no número da solicitação na lista.',
    ],
    attention: [
      'A unidade é obrigatória e o título precisa ter pelo menos 3 caracteres.',
      'O botão "Nova solicitação" só aparece para quem tem a permissão de abrir chamados.',
      'Toda solicitação guarda quem abriu e quando: o chamado nunca é anônimo.',
    ],
  },
  {
    id: 'triagem-aprovacao',
    title: 'Triagem e aprovação',
    purpose:
      'O supervisor analisa o chamado, estima o custo e decide se ele vira uma Ordem de Serviço. É o filtro que evita trabalho sem prioridade.',
    steps: [
      'Abra o menu Solicitações e clique no número da solicitação.',
      'Na seção "Triagem do supervisor", escreva sua avaliação, o impacto e a justificativa.',
      'Preencha as estimativas de serviços (R$) e materiais (R$). O total estimado aparece na tela.',
      'Em "Status da solicitação", escolha "Encaminhar para aprovação" e clique em "Salvar alterações".',
      'Com a solicitação "Em triagem", clique em "Aprovar e criar OS".',
      'Confirme: o MARV mostra o número da OS gerada.',
    ],
    attention: [
      'A triagem é obrigatória para encaminhar: é ela que documenta a decisão.',
      'Somente administradores do cliente fazem triagem e aprovação.',
      'Depois de aprovada, a solicitação fica vinculada à OS gerada.',
    ],
  },
  {
    id: 'ordens-servico',
    title: 'Ordens de serviço',
    purpose:
      'Registrar o trabalho de manutenção: o que foi feito, por quê e qual foi a causa do problema. Esses apontamentos são o histórico técnico da empresa.',
    steps: [
      'Abra o menu Ordens de serviço e clique no número da OS (ou use "Nova OS" para abrir sem chamado).',
      'Ao iniciar o trabalho, altere o status para "Em execução".',
      'Preencha a classificação técnica: tipo de falha, diagnóstico técnico e causa principal (causa raiz).',
      'Descreva a ação realizada e a recomendação para o futuro.',
      'Se a OS causou parada do equipamento, marque a caixa e informe o início e o fim da parada.',
      'Clique em "Salvar alterações".',
    ],
    attention: [
      'Unidade e centro de custo são obrigatórios: é para onde o custo vai.',
      'A parada só aparece quando há ativo vinculado à OS.',
      'Para quem não é administrador, a OS abre em detalhe somente leitura: os campos aparecem preenchidos, porém desabilitados.',
    ],
  },
  {
    id: 'custos-conclusao',
    title: 'Custos e conclusão',
    purpose:
      'Fechar o atendimento com os valores reais e proteger o histórico: OS concluída ou cancelada não muda mais.',
    steps: [
      'Abra a OS em andamento e, no campo "Status", escolha "Concluída".',
      'Clique em "Salvar alterações" e confirme a conclusão.',
      'Se faltar classificação técnica ou o fim da parada, o MARV avisa antes de concluir.',
      'Com a OS concluída, preencha a seção "Validação do supervisor — Custos da OS": serviços (R$) e materiais (R$).',
      'Clique em "Salvar alterações". O "Total da OS" aparece na tela.',
      'Para cancelar, escolha o status "Cancelada" e informe o motivo — sem motivo, o MARV não cancela.',
    ],
    attention: [
      'Custos e conclusão são do administrador do cliente; usuários de navegação não veem valores.',
      'OS concluída ou cancelada não pode ser alterada nem reaberta: o seletor de status fica bloqueado.',
      'Precisa corrigir algo depois do fechamento? Abra uma nova OS citando o número antigo.',
      'Nos valores, use números normais (ex.: 1500,50), sem letras ou símbolos.',
    ],
  },
  {
    id: 'planos-preventivos',
    title: 'Planos preventivos',
    purpose:
      'Programar tarefas que se repetem (ex.: lubrificação a cada 30 dias) e gerar as Ordens de Serviço na hora certa. Prevenir custa menos que quebrar.',
    steps: [
      'Abra o menu Preventivas e clique em "Nova preventiva".',
      'Selecione o ativo e escreva a atividade (ex.: "Lubrificação dos redutores do eixo 3").',
      'Informe a periodicidade em dias (1 a 3650) e a data da próxima execução.',
      'Se quiser, defina o responsável e as observações (instruções, EPIs, itens de inspeção).',
      'Confira a situação (Ativo ou Inativo) e salve.',
      'Para ativar ou desativar, clique no nome do plano e use "Ativar plano" ou "Desativar plano".',
      'Para gerar a OS, abra um plano ativo e clique em "Gerar OS preventiva": o MARV cria a OS e avança a próxima execução automaticamente.',
    ],
    attention: [
      'Somente plano ativo gera OS: o botão não aparece em plano inativo.',
      'A situação "Atrasada" é um cálculo do dia: aparece quando a data passou e o plano está ativo.',
      'A próxima execução é sempre calculada pela periodicidade do plano, sem edição manual escondida.',
      'Usuário de navegação apenas consulta a lista: clicar no nome não abre edição.',
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    purpose:
      'Ver num só lugar o que precisa de atenção no dia: OS abertas, preventivas atrasadas e próximas preventivas.',
    steps: [
      'A Visão geral abre automaticamente depois do login.',
      'Confira primeiro os cards "OS abertas" e "Preventivas atrasadas".',
      'Use "Próximas preventivas" para planejar a semana: aparecem até 3 planos ativos mais próximos.',
      'Os atalhos "Ver ordens de serviço", "Ver todas" e "Ver preventivas" só aparecem se você tiver acesso ao menu correspondente.',
      'Depois de concluir uma OS ou gerar uma preventiva, volte à Visão geral: os dados se atualizam sozinhos, sem apertar F5.',
    ],
    attention: [
      'Plano inativo não entra na contagem de preventivas atrasadas.',
      'Os indicadores mostram apenas dados do seu cliente: ninguém vê dados de outra empresa.',
      'O Dashboard é somente leitura: ele mostra, mas não altera registros.',
    ],
  },
  {
    id: 'regras-seguranca',
    title: 'Regras de segurança',
    purpose:
      'Entender as regras que protegem o histórico do MARV e a confiança nos relatórios.',
    steps: [
      'Use sempre a sua própria conta e saia no fim do turno ("Sair / trocar usuário").',
      'Troque a senha temporária no primeiro acesso.',
      'Siga o fluxo chamado, triagem, aprovação e OS, sem pular etapas.',
      'Registre as decisões por escrito: triagem, causa raiz, ação realizada e motivo do cancelamento.',
      'Depois de concluída ou cancelada, trate a OS como registro fechado: correções entram em uma nova OS.',
    ],
    attention: [
      'Nunca compartilhe a sua senha, nem por mensagem: a conta é de pessoa, não de setor.',
      'Cada um no seu papel: o menu mostra só o que o seu perfil pode fazer, e o banco de dados confirma.',
      'Tudo fica registrado: quem abriu, quem aprovou, quem executou, quando e por quê.',
      'O histórico nunca é apagado.',
    ],
  },
];

export function HelpCenterPage() {
  const [query, setQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return helpSections;

    return helpSections.filter((section) => {
      const content = [
        section.title,
        section.purpose,
        ...section.steps,
        ...(section.attention ?? []),
      ]
        .join(' ')
        .toLowerCase();

      return content.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  const activeSection =
    helpSections.find((section) => section.id === activeSectionId) ?? null;

  return (
    <section className="content">
      <div className="panel" style={{ marginBottom: 18 }}>
        <p className="eyebrow">MANUAL DE OPERAÇÃO · MVP V1</p>
        <h2 style={{ margin: '0 0 6px' }}>Ajuda e Manual de Operação</h2>
        <p style={{ color: '#5b6e88', margin: '0 0 14px' }}>
          Encontre orientações simples para usar o MARV no dia a dia.
        </p>

        <div
          className="asset-search"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar assunto (ex.: senha, CNPJ, preventiva)"
            aria-label="Buscar assunto na Ajuda"
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr)',
          gap: 18,
          alignItems: 'start',
        }}
      >
        <aside className="panel" style={{ padding: 16 }}>
          <p className="eyebrow">ASSUNTOS</p>

          {filteredSections.length === 0 ? (
            <p className="empty">
              Nenhum assunto encontrado. Tente outra palavra.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {filteredSections.map((section) => {
                const isActive = section.id === activeSectionId;

                return (
                  <li key={section.id} style={{ marginBottom: 4 }}>
                    <button
                      type="button"
                      className={isActive ? 'work-order-link' : 'secondary'}
                      onClick={() => setActiveSectionId(section.id)}
                      aria-pressed={isActive}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        font: 'inherit',
                        fontWeight: isActive ? 700 : 500,
                        padding: '6px 4px',
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      {section.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className="panel">
          {activeSection ? (
            <article>
              <div className="panel-head">
                <div>
                  <p className="eyebrow">PASSO A PASSO</p>
                  <h3 style={{ margin: 0 }}>{activeSection.title}</h3>
                </div>

                <button
                  type="button"
                  className="secondary button-with-icon"
                  onClick={() => setActiveSectionId(null)}
                >
                  Voltar
                </button>
              </div>

              <h4 style={{ margin: '4px 0' }}>Para que serve</h4>
              <p style={{ color: '#3f5372' }}>{activeSection.purpose}</p>

              <h4 style={{ margin: '18px 0 4px' }}>Como fazer</h4>
              <ol style={{ margin: 0, paddingLeft: 20, color: '#3f5372' }}>
                {activeSection.steps.map((step, index) => (
                  <li key={index} style={{ marginBottom: 6 }}>
                    {step}
                  </li>
                ))}
              </ol>

              {activeSection.attention && (
                <div
                  style={{
                    background: '#fff7e8',
                    border: '1px solid #f0d9ae',
                    borderRadius: 8,
                    marginTop: 18,
                    padding: '12px 14px',
                  }}
                >
                  <strong style={{ color: '#8a5a10' }}>Atenção</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 20, color: '#6b4d16' }}>
                    {activeSection.attention.map((item, index) => (
                      <li key={index} style={{ marginBottom: 4 }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ) : (
            <div className="empty">
              <BookOpen size={26} style={{ marginBottom: 8 }} />
              <p style={{ margin: 0 }}>
                Selecione um assunto para ver o passo a passo.
              </p>
            </div>
          )}
        </div>
      </div>

      <p
        style={{
          color: '#7b8da3',
          fontSize: 12,
          marginTop: 18,
          textAlign: 'center',
        }}
      >
        A versão para impressão será disponibilizada em breve.
      </p>
    </section>
  );
}
