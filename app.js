/* ================================================================
   FINANÇAS DO CASAL — app.js (v3 - Negócios & Registro Rápido)
   ----------------------------------------------------------------
   ESTRUTURA:
   1.  CONFIG & CONSTANTES
   2.  CAMADA DE DADOS (DataLayer) — Expandida para Negócios
   3.  ESTADO DA APLICAÇÃO
   4.  INICIALIZAÇÃO
   5.  NAVEGAÇÃO
   6.  HOME & SALDOS
   7.  REGISTRO RÁPIDO & NORMAL (Modais de entrada)
   8.  TRANSAÇÕES GERAIS (CRUD)
   9.  LISTA UNIFICADA (Home e Histórico)
   10. MODAL DE DETALHE
   11. METAS E ITENS DE META
   12. NEGÓCIOS E PRODUTOS (Carteiras)
   13. TRANSAÇÕES DE NEGÓCIOS
   14. RELATÓRIOS
   15. CONFIGURAÇÕES
   16. UTILITÁRIOS (formatação, datas, toast)
   ================================================================ */

'use strict';

/* ================================================================
   1. CONFIG & CONSTANTES
================================================================ */

const CATEGORIAS_PADRAO = [
  'Alimentação', 'Transporte', 'Saúde', 'Moradia',
  'Assinaturas', 'Educação', 'Lazer', 'Negócio', 'Outros'
];

const SUBTIPOS = {
  entrada: [
    { value: 'salario',      label: 'Salário Mensal' },
    { value: 'futuro',       label: 'Pagamento Futuro Prometido' },
    { value: 'transferencia',label: 'Transferência / Depósito' },
    { value: 'avulso',       label: 'Entrada Avulsa' },
  ],
  saida: [
    { value: 'fixo_mensal',  label: 'Gasto Fixo Mensal' },
    { value: 'fatura',       label: 'Fatura de Cartão' },
    { value: 'variavel',     label: 'Gasto Variável Avulso' },
  ]
};

// SVGs reutilizáveis
const SVG_ENTRADA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
const SVG_SAIDA   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
const SVG_CHECK   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

/* ================================================================
   2. CAMADA DE DADOS (DataLayer) COM SUPABASE
================================================================ */

// Vá em Project Settings -> API no Supabase e cole suas chaves aqui
const SUPABASE_URL = 'https://gzeqiohwnytoqgbxkkqi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6ZXFpb2h3bnl0b3FnYnhra3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODgwNDQsImV4cCI6MjA5NTU2NDA0NH0.oyFjultOwIAjDeFI3hhYYAkAT4CMKFd0crEtZqMpPfE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Estado centralizado em memória (Optimistic UI)
const state = {
  transacoes: [],
  metas: [],
  negocios: [],
  produtos: [],
  transCarteiras: [],
  config: { nomeU1: 'Usuário 1', nomeU2: 'Usuário 2', categoriasCustom: [] }
};

// Utilitário para log de erros assíncronos e manter o Clean Code
const handleAsync = ({ error }) => { if (error) console.error("Falha na sincronização:", error); };

const DataLayer = {
  async init() {
    try {
      // Dispara todas as requisições simultaneamente para otimizar a latência de rede
      const [resT, resM, resN, resP, resTC, resC] = await Promise.all([
        supabase.from('transacoes').select('dados'),
        supabase.from('metas').select('dados'),
        supabase.from('negocios').select('dados'),
        supabase.from('produtos').select('dados'),
        supabase.from('trans_carteiras').select('dados'),
        supabase.from('config').select('dados').eq('id', 'global').maybeSingle()
      ]);

      // Rotina de Migração: Lê o LocalStorage legado e injeta no BD
      const oldTransacoes = JSON.parse(localStorage.getItem('fc_transacoes') || '[]');
      if (resT.data && resT.data.length === 0 && oldTransacoes.length > 0) {
         console.log("Migrando registros antigos para a nuvem...");
         await this.migrarLocalStorage();
         return this.init(); // Recarrega o estado após alimentar o servidor
      }

      // Popula o estado local em memória
      if (resT.data) state.transacoes = resT.data.map(r => r.dados);
      if (resM.data) state.metas = resM.data.map(r => r.dados);
      if (resN.data) state.negocios = resN.data.map(r => r.dados);
      if (resP.data) state.produtos = resP.data.map(r => r.dados);
      if (resTC.data) state.transCarteiras = resTC.data.map(r => r.dados);
      if (resC.data && resC.data.dados) state.config = resC.data.dados;

    } catch (e) {
      console.error("Erro crítico na inicialização do backend:", e);
      document.body.style.opacity = '1'; // Garante que o app fica visível mesmo em caso de erro
    }
  },

  async migrarLocalStorage() {
    const t = JSON.parse(localStorage.getItem('fc_transacoes') || '[]');
    if (t.length) await supabase.from('transacoes').insert(t.map(x => ({id: x.id, dados: x})));

    const m = JSON.parse(localStorage.getItem('fc_metas') || '[]');
    if (m.length) await supabase.from('metas').insert(m.map(x => ({id: x.id, dados: x})));

    const n = JSON.parse(localStorage.getItem('fc_negocios') || '[]');
    if (n.length) await supabase.from('negocios').insert(n.map(x => ({id: x.id, dados: x})));

    const p = JSON.parse(localStorage.getItem('fc_produtos') || '[]');
    if (p.length) await supabase.from('produtos').insert(p.map(x => ({id: x.id, dados: x})));

    const tc = JSON.parse(localStorage.getItem('fc_trans_carteiras') || '[]');
    if (tc.length) await supabase.from('trans_carteiras').insert(tc.map(x => ({id: x.id, dados: x})));

    const c = JSON.parse(localStorage.getItem('fc_config'));
    if (c) await supabase.from('config').insert([{id: 'global', dados: c}]);
  },

  /* --- Transações Normais --- */
  getTransacoes: () => state.transacoes,
  addTransacao(t) {
    state.transacoes.unshift(t);
    supabase.from('transacoes').insert([{ id: t.id, dados: t }]).then(handleAsync);
  },
  updateTransacao(id, dados) {
    state.transacoes = state.transacoes.map(t => t.id === id ? { ...t, ...dados } : t);
    const item = state.transacoes.find(t => t.id === id);
    supabase.from('transacoes').update({ dados: item }).eq('id', id).then(handleAsync);
  },
  deleteTransacao(id) {
    state.transacoes = state.transacoes.filter(t => t.id !== id);
    supabase.from('transacoes').delete().eq('id', id).then(handleAsync);
  },

  /* --- Metas --- */
  getMetas: () => state.metas,
  addMeta(m) {
    state.metas.push(m);
    supabase.from('metas').insert([{ id: m.id, dados: m }]).then(handleAsync);
  },
  updateMeta(id, dados) {
    state.metas = state.metas.map(m => m.id === id ? { ...m, ...dados } : m);
    const item = state.metas.find(m => m.id === id);
    supabase.from('metas').update({ dados: item }).eq('id', id).then(handleAsync);
  },
  deleteMeta(id) {
    state.metas = state.metas.filter(m => m.id !== id);
    supabase.from('metas').delete().eq('id', id).then(handleAsync);
  },

  /* --- Negócios (Carteiras) --- */
  getNegocios: () => state.negocios,
  addNegocio(n) {
    state.negocios.push(n);
    supabase.from('negocios').insert([{ id: n.id, dados: n }]).then(handleAsync);
  },
  updateNegocio(id, dados) {
    state.negocios = state.negocios.map(n => n.id === id ? { ...n, ...dados } : n);
    const item = state.negocios.find(n => n.id === id);
    supabase.from('negocios').update({ dados: item }).eq('id', id).then(handleAsync);
  },
  deleteNegocio(id) {
    state.negocios = state.negocios.filter(n => n.id !== id);
    supabase.from('negocios').delete().eq('id', id).then(handleAsync);

    // Deleção em cascata (Lógica profunda baseada em chave estrangeira virtual)
    const prods = state.produtos.filter(p => p.negocioId === id);
    state.produtos = state.produtos.filter(p => p.negocioId !== id);
    prods.forEach(p => supabase.from('produtos').delete().eq('id', p.id).then(handleAsync));

    const trans = state.transCarteiras.filter(tc => tc.negocioId === id);
    state.transCarteiras = state.transCarteiras.filter(tc => tc.negocioId !== id);
    trans.forEach(tc => supabase.from('trans_carteiras').delete().eq('id', tc.id).then(handleAsync));
  },

  /* --- Produtos --- */
  getProdutos: () => state.produtos,
  addProduto(p) {
    state.produtos.push(p);
    supabase.from('produtos').insert([{ id: p.id, dados: p }]).then(handleAsync);
  },
  updateProduto(id, dados) {
    state.produtos = state.produtos.map(p => p.id === id ? { ...p, ...dados } : p);
    const item = state.produtos.find(p => p.id === id);
    supabase.from('produtos').update({ dados: item }).eq('id', id).then(handleAsync);
  },
  deleteProduto(id) {
    state.produtos = state.produtos.filter(p => p.id !== id);
    supabase.from('produtos').delete().eq('id', id).then(handleAsync);
  },

  /* --- Transações de Carteira (Negócios) --- */
  getTransCarteiras: () => state.transCarteiras,
  addTransCarteira(t) {
    state.transCarteiras.unshift(t);
    supabase.from('trans_carteiras').insert([{ id: t.id, dados: t }]).then(handleAsync);
  },
  updateTransCarteira(id, dados) {
    state.transCarteiras = state.transCarteiras.map(t => t.id === id ? { ...t, ...dados } : t);
    const item = state.transCarteiras.find(t => t.id === id);
    supabase.from('trans_carteiras').update({ dados: item }).eq('id', id).then(handleAsync);
  },
  deleteTransCarteira(id) {
    state.transCarteiras = state.transCarteiras.filter(t => t.id !== id);
    supabase.from('trans_carteiras').delete().eq('id', id).then(handleAsync);
  },

  /* --- Configurações globais --- */
  getConfig: () => state.config,
  setConfig: (config) => {
    state.config = config;
    supabase.from('config').update({ dados: config }).eq('id', 'global')
      .then(async ({ error }) => {
         // Se a atualização falhar porque o registro 'global' não existe, ele executa a inserção.
         if (error) await supabase.from('config').insert([{ id: 'global', dados: config }]);
      });
  },

  /* --- Limpar Tudo --- */
  limparTudo() {
    state.transacoes = [];
    state.metas = [];
    state.negocios = [];
    state.produtos = [];
    state.transCarteiras = [];
    
    // Purga assíncrona orientada pela desigualdade primária (atinge todos os registros dinâmicos gerados)
    supabase.from('transacoes').delete().neq('id', '0').then(handleAsync);
    supabase.from('metas').delete().neq('id', '0').then(handleAsync);
    supabase.from('negocios').delete().neq('id', '0').then(handleAsync);
    supabase.from('produtos').delete().neq('id', '0').then(handleAsync);
    supabase.from('trans_carteiras').delete().neq('id', '0').then(handleAsync);
    localStorage.clear();
  }
};

/* ================================================================
   3. ESTADO DA APLICAÇÃO
================================================================ */

const App = {
  telaAtual: 'tela-home',
  
  // Controle de Edições
  transacaoEditandoId: null,
  metaEditandoId: null,
  aporteMetaId: null,
  itemMetaAlvoId: null,
  negocioEditandoId: null,
  
  // Controle de Transação Normal
  tipoAtual: 'entrada',
  usuarioAtual: 'usuario1',
  
  // Controle da Home e Filtros
  filtroHistorico: 'todos',
  mostrarTodas: false,
  relatorioMes: new Date().getMonth(),
  relatorioAno: new Date().getFullYear(),

  // Registro Rápido
  rapidoTipo: 'entrada',
  rapidoValorUnitario: 0,
};

/* ================================================================
   4. INICIALIZAÇÃO
================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // Dá um sutil feedback visual escurecendo o fundo enquanto espera a montagem em memória
  document.body.style.opacity = '0.4'; 
  document.body.style.transition = 'opacity 0.3s ease';

  // Espera a resolução das requisições assíncronas do backend e efetua a alocação
  await DataLayer.init();

  document.body.style.opacity = '1';

  // O fluxo de renderização retoma suas funções de forma estritamente síncrona
  carregarConfiguracoes();
  
  renderHome();
  renderMetas();
  renderNegocios();
  renderHistorico();
  renderRelatorio();

  // Acoplamento dinâmico das datas aos campos HTML
  const hoje = new Date().toISOString().split('T')[0];
  if(document.getElementById('campo-data')) document.getElementById('campo-data').value = hoje;
  if(document.getElementById('trans-cart-data')) document.getElementById('trans-cart-data').value = hoje;
});

/* ================================================================
   5. NAVEGAÇÃO
================================================================ */

function irPara(telaId) {
  document.getElementById(App.telaAtual)?.classList.remove('ativa');
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  App.telaAtual = telaId;
  document.getElementById(telaId)?.classList.add('ativa');
  
  const navBtn = document.querySelector(`.nav-btn[data-tela="${telaId}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (telaId === 'tela-home')       renderHome();
  if (telaId === 'tela-metas')      renderMetas();
  if (telaId === 'tela-negocios')   renderNegocios();
  if (telaId === 'tela-registrar')  renderHistorico();
  if (telaId === 'tela-relatorios') renderRelatorio();
  if (telaId === 'tela-config')     renderConfig();

  window.scrollTo(0, 0);
}

/* ================================================================
   6. HOME & SALDOS
================================================================ */

function renderHome() {
  const transacoesGerais = DataLayer.getTransacoes();
  const transacoesCart   = DataLayer.getTransCarteiras();
  const negocios         = DataLayer.getNegocios();
  const metas            = DataLayer.getMetas();

  // 1. Calcula Saldo Geral (só transações do app principal)
  let saldoGeral = transacoesGerais.reduce((acc, t) => acc + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
  let saldoTotal = saldoGeral; // Começa pelo saldo da conta principal

  // 2. Monta blocos de saldos individuais (Geral + Cada Negócio)
  let htmlSaldos = `
    <div class="saldo-pessoa">
      <span class="pessoa-dot" style="background:var(--text-secondary)"></span>
      <span class="pessoa-nome">Conta Pessoal</span>
      <span class="pessoa-valor ${saldoGeral >= 0 ? 'verde' : 'vermelho'}">${formatarReais(saldoGeral)}</span>
    </div>
  `;

  negocios.forEach((neg, i) => {
    // Calcula saldo deste negócio específico
    const tcDoNegocio = transacoesCart.filter(tc => tc.negocioId === neg.id);
    let saldoNeg = tcDoNegocio.reduce((acc, tc) => acc + (tc.tipo === 'entrada' ? tc.valor : -tc.valor), 0);
    
    // Soma ao Saldo Total se tiver a opção de compensar marcada
    if (neg.compensarSaldo) {
      saldoTotal += saldoNeg;
    }

    const colorClass = `dot-n${i % 6}`;
    htmlSaldos += `
      <div class="saldo-pessoa">
        <span class="pessoa-dot ${colorClass}"></span>
        <span class="pessoa-nome">${escapeHtml(neg.nome)}</span>
        <span class="pessoa-valor ${saldoNeg >= 0 ? 'verde' : 'vermelho'}">${formatarReais(saldoNeg)}</span>
      </div>`;
  });

  // Atualiza DOM
  document.getElementById('saldo-total').textContent = formatarReais(saldoTotal);
  document.getElementById('saldo-total').style.color = saldoTotal < 0 ? 'var(--vermelho)' : 'var(--text-primary)';
  
  const saldosWrap = document.getElementById('saldo-negocios-wrap');
  saldosWrap.innerHTML = htmlSaldos;
  if (negocios.length >= 3) saldosWrap.classList.add('multi-col');
  else saldosWrap.classList.remove('multi-col');

  // Resumo do Mês (soma tudo para ter a visão geral)
  const agora = new Date();
  const resumoMes = calcularResumoMes(getTodasTransacoesUnificadas(), agora.getMonth(), agora.getFullYear());
  document.getElementById('resumo-entradas').textContent = formatarReais(resumoMes.entradas);
  document.getElementById('resumo-saidas').textContent   = formatarReais(resumoMes.saidas);

  // Metas Mini na Home
  const secaoMetas = document.getElementById('home-metas-section');
  const listaMetas = document.getElementById('home-metas-lista');
  if (metas.length > 0) {
    secaoMetas.classList.remove('hidden');
    listaMetas.innerHTML = metas.slice(0, 2).map(renderMetaMini).join('');
  } else {
    secaoMetas.classList.add('hidden');
  }

  // Lista Unificada de Transações (Gerais + Negócios)
  const todasTransacoes = getTodasTransacoesUnificadas();
  renderListaTransacoes(todasTransacoes, 'lista-transacoes', App.mostrarTodas ? 9999 : 8);
  document.getElementById('btn-ver-todas').textContent = App.mostrarTodas ? 'Ver menos' : 'Ver todas';
}

function toggleVerTodas() {
  App.mostrarTodas = !App.mostrarTodas;
  renderHome();
}

function calcularResumoMes(lista, mes, ano) {
  let entradas = 0, saidas = 0;
  lista.forEach(t => {
    const d = new Date(t.data + 'T12:00:00');
    if (d.getMonth() === mes && d.getFullYear() === ano) {
      if (t.tipo === 'entrada') entradas += t.valor;
      else saidas += t.valor;
    }
  });
  return { entradas, saidas };
}

/* ================================================================
   7. REGISTRO RÁPIDO & NORMAL
================================================================ */

function abrirEscolhaRegistro(tipo) {
  App.rapidoTipo = tipo;
  // Resetamos o dialog para o passo 1
  document.getElementById('rapido-step-1').classList.remove('hidden');
  document.getElementById('rapido-step-2').classList.add('hidden');
  mostrarModal('modal-rapido');
}

function mostrarRapidoStep1() {
  document.getElementById('rapido-step-1').classList.remove('hidden');
  document.getElementById('rapido-step-2').classList.add('hidden');
}

function escolherRegistro(modo) {
  if (modo === 'normal') {
    closeAllModals();
    abrirModalTransacao(App.rapidoTipo);
  } else if (modo === 'rapido') {
    iniciarRegistroRapido();
  }
}

// Inicia formulário expresso
function iniciarRegistroRapido() {
  document.getElementById('rapido-step-1').classList.add('hidden');
  document.getElementById('rapido-step-2').classList.remove('hidden');
  
  selectRapidoTipo(App.rapidoTipo);
  
  // Limpar e preencher Destino
  const selDestino = document.getElementById('rapido-destino');
  const negocios = DataLayer.getNegocios();
  selDestino.innerHTML = `<option value="geral">Conta Pessoal (Geral)</option>` + 
    negocios.map(n => `<option value="${n.id}">${n.nome}</option>`).join('');
  
  // Preencher Categorias
  const config = DataLayer.getConfig();
  const todasCat = [...CATEGORIAS_PADRAO, ...(config.categoriasCustom || [])];
  document.getElementById('rapido-categoria').innerHTML = 
    todasCat.map(c => `<option value="${c}">${c}</option>`).join('');
  
  // Limpar campos
  document.getElementById('rapido-valor').value = '';
  document.getElementById('rapido-obs').value = '';
  document.getElementById('rapido-qtd').value = '1';
  document.getElementById('rapido-produto-id').value = '';
  document.getElementById('rapido-produto-nome').value = '';
  App.rapidoValorUnitario = 0;

  onRapidoDestinoChange();
}

function selectRapidoTipo(tipo) {
  App.rapidoTipo = tipo;
  document.querySelectorAll('#rapido-tipo-toggle .toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === tipo);
  });
}

function onRapidoDestinoChange() {
  const destinoId = document.getElementById('rapido-destino').value;
  const wrapProdutos = document.getElementById('rapido-produtos-wrap');
  
  if (destinoId === 'geral') {
    // Se for geral, escondemos a seleção de produtos da carteira
    wrapProdutos.classList.add('hidden');
    App.rapidoValorUnitario = 0;
  } else {
    // Se selecionou uma carteira, buscamos e listamos os produtos dela
    const produtos = DataLayer.getProdutos().filter(p => p.negocioId === destinoId);
    if (produtos.length > 0) {
      wrapProdutos.classList.remove('hidden');
      const container = document.getElementById('rapido-lista-produtos');
      container.innerHTML = produtos.map(p => `
        <div class="rapido-produto-opcao" id="rapido-prod-${p.id}" onclick="selecionarRapidoProduto('${p.id}', '${escapeHtml(p.nome)}', ${p.valor})">
          <span class="rapido-prod-nome">${escapeHtml(p.nome)}</span>
          <span class="rapido-prod-val">${formatarReais(p.valor)}</span>
        </div>
      `).join('');
    } else {
      wrapProdutos.classList.add('hidden'); // Carteira sem produtos
    }
  }
}

function selecionarRapidoProduto(id, nome, valor) {
  document.querySelectorAll('.rapido-produto-opcao').forEach(el => el.classList.remove('selecionado'));
  document.getElementById(`rapido-prod-${id}`).classList.add('selecionado');
  
  document.getElementById('rapido-produto-id').value = id;
  document.getElementById('rapido-produto-nome').value = nome;
  
  App.rapidoValorUnitario = valor;
  atualizarValorRapido();
}

function atualizarValorRapido() {
  if (App.rapidoValorUnitario > 0) {
    const qtd = parseInt(document.getElementById('rapido-qtd').value) || 1;
    document.getElementById('rapido-valor').value = formatarValorInput(App.rapidoValorUnitario * qtd);
  }
}

function salvarRegistroRapido() {
  const destinoId = document.getElementById('rapido-destino').value;
  const valor = parsearValor(document.getElementById('rapido-valor').value);
  const categoria = document.getElementById('rapido-categoria').value;
  const obs = document.getElementById('rapido-obs').value.trim();
  const hoje = new Date().toISOString().split('T')[0];

  if (!valor || valor <= 0) { showToast('Informe um valor válido.'); return; }

  if (destinoId === 'geral') {
    // Registra na Conta Pessoal
    DataLayer.addTransacao({
      id: gerarId(),
      tipo: App.rapidoTipo,
      subtipo: 'avulso',
      descricao: obs || 'Registro Rápido',
      valor, categoria, usuario: 'usuario1',
      data: hoje, parcelas: 1, fixo: false, obs,
      criadoEm: new Date().toISOString()
    });
  } else {
    // Registra no Negócio/Carteira selecionada
    const produtoId = document.getElementById('rapido-produto-id').value;
    const produtoNome = document.getElementById('rapido-produto-nome').value;
    const qtd = parseInt(document.getElementById('rapido-qtd').value) || 1;
    
    DataLayer.addTransCarteira({
      id: gerarId(),
      negocioId: destinoId,
      tipo: App.rapidoTipo,
      produtoId: produtoId || null,
      qtd: produtoId ? qtd : 1,
      descricao: produtoNome ? `${qtd}x ${produtoNome}` : (obs || 'Transação de Carteira'),
      valor, categoria, data: hoje, futura: false, obs,
      criadoEm: new Date().toISOString()
    });
  }

  showToast('Registro rápido guardado com sucesso!');
  closeAllModals();
  renderHome();
  renderHistorico();
  if (destinoId !== 'geral') renderNegocios();
}

/* ================================================================
   8. TRANSAÇÕES GERAIS (Modais completos e CRUD)
================================================================ */

function abrirModalTransacao(tipo, transacaoId = null) {
  App.transacaoEditandoId = transacaoId;
  App.tipoAtual = tipo;

  const titulo = document.getElementById('modal-transacao-titulo');
  preencherCategorias('campo-categoria');

  if (transacaoId) {
    const t = DataLayer.getTransacoes().find(x => x.id === transacaoId);
    if (!t) return;
    titulo.textContent = 'Editar Transação';
    App.tipoAtual = t.tipo;
    preencherFormularioTransacao(t);
  } else {
    titulo.textContent = tipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída';
    limparFormularioTransacao();
    selectTipo(tipo);
  }

  atualizarSubtipos();
  mostrarModal('modal-transacao');
}

function selectTipo(tipo) {
  App.tipoAtual = tipo;
  document.querySelectorAll('#toggle-tipo .toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === tipo);
  });
  atualizarSubtipos();
}

function selectUsuario(usuario) {
  App.usuarioAtual = usuario;
  document.querySelectorAll('#toggle-usuario .toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === usuario);
  });
}

function atualizarSubtipos() {
  const sel = document.getElementById('campo-subtipo');
  const opcoes = SUBTIPOS[App.tipoAtual] || [];
  sel.innerHTML = opcoes.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
}

function preencherCategorias(selectId) {
  const config = DataLayer.getConfig();
  const todas = [...CATEGORIAS_PADRAO, ...(config.categoriasCustom || [])];
  document.getElementById(selectId).innerHTML = todas.map(c => `<option value="${c}">${c}</option>`).join('');
}

function toggleFixo() {
  const checked = document.getElementById('campo-fixo').checked;
  document.getElementById('grupo-vencimento').classList.toggle('hidden', !checked);
}

function limparFormularioTransacao() {
  document.getElementById('campo-descricao').value = '';
  document.getElementById('campo-valor').value = '';
  document.getElementById('campo-obs').value = '';
  document.getElementById('campo-parcelas').value = '1';
  document.getElementById('campo-fixo').checked = false;
  document.getElementById('campo-vencimento').value = '';
  document.getElementById('grupo-vencimento').classList.add('hidden');
  document.getElementById('campo-data').value = new Date().toISOString().split('T')[0];
  selectUsuario('usuario1');
}

function preencherFormularioTransacao(t) {
  selectTipo(t.tipo);
  selectUsuario(t.usuario);
  document.getElementById('campo-subtipo').value   = t.subtipo || 'avulso';
  document.getElementById('campo-descricao').value = t.descricao || '';
  document.getElementById('campo-valor').value     = formatarValorInput(t.valor);
  document.getElementById('campo-categoria').value = t.categoria || 'Outros';
  document.getElementById('campo-data').value      = t.data || '';
  document.getElementById('campo-parcelas').value  = t.parcelas || '1';
  document.getElementById('campo-obs').value       = t.obs || '';

  const fixo = !!t.fixo;
  document.getElementById('campo-fixo').checked = fixo;
  document.getElementById('grupo-vencimento').classList.toggle('hidden', !fixo);
  if (fixo) document.getElementById('campo-vencimento').value = t.diaVencimento || '';
}

function salvarTransacao() {
  const descricao = document.getElementById('campo-descricao').value.trim();
  const valor = parsearValor(document.getElementById('campo-valor').value);
  const data = document.getElementById('campo-data').value;
  const fixo = document.getElementById('campo-fixo').checked;

  if (!descricao) { showToast('Informe uma descrição.'); return; }
  if (!valor || valor <= 0) { showToast('Informe um valor válido.'); return; }
  if (!data) { showToast('Informe a data.'); return; }

  const t = {
    id: App.transacaoEditandoId || gerarId(),
    tipo: App.tipoAtual,
    subtipo: document.getElementById('campo-subtipo').value,
    descricao, valor,
    categoria: document.getElementById('campo-categoria').value,
    usuario: App.usuarioAtual,
    data,
    parcelas: parseInt(document.getElementById('campo-parcelas').value) || 1,
    fixo,
    diaVencimento: fixo ? document.getElementById('campo-vencimento').value : null,
    obs: document.getElementById('campo-obs').value.trim(),
    criadoEm: App.transacaoEditandoId ? DataLayer.getTransacoes().find(x => x.id === App.transacaoEditandoId)?.criadoEm : new Date().toISOString(),
  };

  if (App.transacaoEditandoId) {
    DataLayer.updateTransacao(t.id, t);
    showToast('Transação atualizada.');
  } else {
    DataLayer.addTransacao(t);
    showToast('Transação registrada.');
  }

  closeAllModals();
  renderHome();
  renderHistorico();
}

function excluirTransacao(id) {
  if (!confirm('Excluir esta transação geral?')) return;
  DataLayer.deleteTransacao(id);
  closeAllModals();
  showToast('Transação excluída.');
  renderHome();
  renderHistorico();
}

/* ================================================================
   9. LISTA UNIFICADA (Mistura Gerais + Carteiras)
================================================================ */

function getTodasTransacoesUnificadas() {
  // Transações Normais (marcam isCarteira = false)
  const normais = DataLayer.getTransacoes().map(t => ({ ...t, isCarteira: false }));
  
  // Transações de Negócios (marcam isCarteira = true e herdam nome do negócio)
  const negocios = DataLayer.getNegocios();
  const carteiras = DataLayer.getTransCarteiras().map(t => {
    const neg = negocios.find(n => n.id === t.negocioId);
    return {
      ...t,
      isCarteira: true,
      nomeNegocio: neg ? neg.nome : 'Carteira Removida',
      usuario: 'negocio' // Para não quebrar layout original
    };
  });

  // Une ambas e ordena por data decrescente (mais recentes primeiro)
  return [...normais, ...carteiras].sort((a, b) => new Date(b.data) - new Date(a.data));
}

function renderListaTransacoes(listaOriginal, containerId, limite = 9999, filtroTipo = 'todos') {
  const container = document.getElementById(containerId);
  if (!container) return;

  let lista = [...listaOriginal];
  if (filtroTipo !== 'todos') lista = lista.filter(t => t.tipo === filtroTipo);
  lista = lista.slice(0, limite);

  if (lista.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>Nenhuma transação encontrada.</p></div>`;
    return;
  }

  const grupos = agruparPorData(lista);
  const config = DataLayer.getConfig();

  let html = '';
  grupos.forEach(({ label, items }) => {
    html += `<div class="grupo-data-label">${label}</div>`;
    items.forEach(t => {
      html += renderTransacaoItem(t, config);
    });
  });
  container.innerHTML = html;
}

function renderTransacaoItem(t, config) {
  let nomeSubInfo = '';
  let tagCarteira = '';

  if (t.isCarteira) {
    tagCarteira = `<span class="tag-carteira">${escapeHtml(t.nomeNegocio)}</span>`;
    nomeSubInfo = t.categoria; 
  } else {
    const nomeUsuario = t.usuario === 'usuario1' ? (config.nomeU1 || 'Usuário 1') : (config.nomeU2 || 'Usuário 2');
    nomeSubInfo = `${escapeHtml(t.categoria)} · ${escapeHtml(nomeUsuario)}`;
  }

  const svgIcone = t.tipo === 'entrada' ? SVG_ENTRADA : SVG_SAIDA;
  const classeIcone = t.tipo === 'entrada' ? 'icone-entrada' : 'icone-saida';
  const classeValor = t.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida';
  const prefixo = t.tipo === 'entrada' ? '+' : '-';

  const tagParcela = t.parcelas > 1 ? `<span class="tag-parcela">${t.parcelas}x</span>` : '';
  const tagFixo = t.fixo ? `<span class="tag-fixo">fixo</span>` : '';

  return `
    <div class="transacao-item" onclick="abrirDetalhe('${t.id}')">
      <div class="transacao-icone ${classeIcone}">${svgIcone}</div>
      <div class="transacao-info">
        <div class="transacao-desc">
          ${escapeHtml(t.descricao)} ${tagParcela} ${tagFixo} ${tagCarteira}
        </div>
        <div class="transacao-meta">${nomeSubInfo}</div>
      </div>
      <div class="transacao-valor-wrap">
        <div class="transacao-valor ${classeValor}">${prefixo}${formatarReais(t.valor)}</div>
        <div class="transacao-data">${formatarDataCurta(t.data)}</div>
      </div>
    </div>`;
}

function renderHistorico() {
  const unificadas = getTodasTransacoesUnificadas();
  renderListaTransacoes(unificadas, 'lista-historico', 9999, App.filtroHistorico);
}

function filtrarTransacoes(tipo, btnEl) {
  App.filtroHistorico = tipo;
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  renderHistorico();
}

function agruparPorData(lista) {
  const mapa = {};
  lista.forEach(t => {
    const label = labelData(t.data);
    if (!mapa[label]) mapa[label] = { label, items: [] };
    mapa[label].items.push(t);
  });
  return Object.values(mapa);
}

/* ================================================================
   10. MODAL DE DETALHE
================================================================ */

function abrirDetalhe(id) {
  // O ID pode ser de uma transação normal ou de uma carteira
  let t = DataLayer.getTransacoes().find(x => x.id === id);
  let isCarteira = false;
  
  if (!t) {
    t = DataLayer.getTransCarteiras().find(x => x.id === id);
    isCarteira = true;
  }
  if (!t) return;

  const prefixo = t.tipo === 'entrada' ? '+' : '-';
  const classeVal = t.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida';

  let responsavel = '';
  if (isCarteira) {
    const neg = DataLayer.getNegocios().find(n => n.id === t.negocioId);
    responsavel = `Carteira: ${neg ? neg.nome : 'Desconhecida'}`;
  } else {
    const config = DataLayer.getConfig();
    responsavel = t.usuario === 'usuario1' ? (config.nomeU1 || 'U1') : (config.nomeU2 || 'U2');
  }

  const linhas = [
    { label: 'Origem', val: responsavel },
    { label: 'Tipo', val: t.tipo === 'entrada' ? '↑ Entrada' : '↓ Saída' },
    { label: 'Categoria', val: t.categoria },
    { label: 'Data', val: formatarDataLonga(t.data) },
    t.parcelas ? { label: 'Parcelas', val: t.parcelas > 1 ? `${t.parcelas}x` : 'À vista' } : null,
    t.qtd ? { label: 'Quantidade', val: t.qtd } : null,
    t.obs ? { label: 'Observação', val: t.obs } : null,
  ].filter(Boolean);

  const onclickEdit = isCarteira 
    ? `abrirModalTransCarteira('${t.negocioId}', '${t.id}')` 
    : `abrirModalTransacao('${t.tipo}', '${t.id}')`;
  
  const onclickDelete = isCarteira
    ? `excluirTransCarteira('${t.id}')`
    : `excluirTransacao('${t.id}')`;

  const html = `
    <div class="transacao-icone ${classeVal === 'valor-entrada' ? 'icone-entrada' : 'icone-saida'}"
         style="width:48px;height:48px;border-radius:50%;margin-bottom:8px">
      ${t.tipo === 'entrada' ? SVG_ENTRADA : SVG_SAIDA}
    </div>
    <div class="detalhe-valor ${classeVal}">${prefixo}${formatarReais(t.valor)}</div>
    <div style="font-size:1rem;font-weight:600;margin-bottom:4px">${escapeHtml(t.descricao)}</div>
    <div class="detalhe-data">${formatarDataLonga(t.data)}</div>

    <div class="detalhe-info-grid">
      ${linhas.map(l => `
        <div class="detalhe-info-row">
          <span class="detalhe-info-label">${l.label}</span>
          <span class="detalhe-info-val">${escapeHtml(String(l.val))}</span>
        </div>`).join('')}
    </div>

    <div class="detalhe-acoes">
      <button class="detalhe-btn btn-editar" onclick="closeAllModals(); ${onclickEdit}">Editar</button>
      <button class="detalhe-btn btn-excluir" onclick="${onclickDelete}">Excluir</button>
    </div>`;

  document.getElementById('modal-detalhe-conteudo').innerHTML = html;
  mostrarModal('modal-detalhe');
}

/* ================================================================
   11. METAS E ITENS DE META
================================================================ */

function renderMetas() {
  const metas = DataLayer.getMetas();
  const container = document.getElementById('lista-metas');
  if (!container) return;

  if (metas.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>Nenhuma meta cadastrada.</p></div>`;
    return;
  }
  container.innerHTML = metas.map(renderMetaCard).join('');
}

function renderMetaCard(m) {
  const pct = Math.min(100, Math.round((m.guardado / m.total) * 100));
  const classFill = pct >= 100 ? 'concluida' : pct >= 70 ? 'quase' : '';
  const prazoTxt = m.prazo ? `Prazo: ${formatarDataCurta(m.prazo)}` : 'Sem prazo definido';

  // Renderiza sub-lista de itens caso exista
  let itensHtml = '';
  if (m.itens && m.itens.length > 0) {
    const concluidos = m.itens.filter(i => i.concluido).length;
    itensHtml = `
      <div class="meta-itens-section">
        <div class="meta-itens-header">
          <span class="meta-itens-titulo">Lista de Itens</span>
          <span class="meta-itens-stats">${concluidos} / ${m.itens.length} concluídos</span>
        </div>
        <div class="meta-itens-lista">
          ${m.itens.map(i => `
            <div class="meta-item-row ${i.concluido ? 'concluido' : ''}">
              <button class="meta-item-check ${i.concluido ? 'checked' : ''}" onclick="toggleItemMeta('${m.id}', '${i.id}')">
                ${i.concluido ? SVG_CHECK : ''}
              </button>
              <span class="meta-item-nome">${escapeHtml(i.nome)}</span>
              <span class="meta-item-valor">${formatarReais(i.valor)}</span>
              <button class="meta-item-del" onclick="excluirItemMeta('${m.id}', '${i.id}')" title="Excluir Item">✕</button>
            </div>
          `).join('')}
        </div>
      </div>`;
  }
  // Adiciona o botão para inserir novos itens
  itensHtml += `<button class="btn-add-item" style="margin-top:8px" onclick="abrirModalItemMeta('${m.id}')">+ Adicionar Item à Lista</button>`;

  return `
    <div class="meta-card">
      <div class="meta-header">
        <div>
          <div class="meta-nome">${escapeHtml(m.nome)}</div>
          <div class="meta-prazo">${prazoTxt}</div>
        </div>
        <div class="meta-acoes">
          <button class="meta-btn" onclick="abrirModalAporte('${m.id}')">+ Aporte</button>
          <button class="meta-btn" onclick="abrirModalMeta('${m.id}')">Editar</button>
          <button class="meta-btn danger" onclick="excluirMeta('${m.id}')">Excluir</button>
        </div>
      </div>
      <div class="meta-progresso-wrap">
        <div class="meta-progresso-bar">
          <div class="meta-progresso-fill ${classFill}" style="width: ${pct}%"></div>
        </div>
        <div class="meta-valores">
          <span class="meta-guardado">${formatarReais(m.guardado)}</span>
          <span class="meta-total-val">de ${formatarReais(m.total)}</span>
        </div>
        <div class="meta-pct">${pct}% concluído do valor</div>
      </div>
      ${itensHtml}
    </div>`;
}

function renderMetaMini(m) {
  const pct = Math.min(100, Math.round((m.guardado / m.total) * 100));
  const classFill = pct >= 100 ? 'concluida' : pct >= 70 ? 'quase' : '';
  return `
    <div class="meta-mini">
      <div class="meta-mini-header">
        <span>${escapeHtml(m.nome)}</span>
        <span class="meta-mini-pct">${pct}% concluída</span>
      </div>
      <div class="meta-progresso-bar">
        <div class="meta-progresso-fill ${classFill}" style="width:${pct}%"></div>
      </div>
    </div>`;
}

function abrirModalMeta(metaId = null) {
  App.metaEditandoId = metaId;
  document.getElementById('modal-meta-titulo').textContent = metaId ? 'Editar Meta' : 'Nova Meta';

  if (metaId) {
    const m = DataLayer.getMetas().find(x => x.id === metaId);
    if (!m) return;
    document.getElementById('meta-nome').value = m.nome;
    document.getElementById('meta-total').value = formatarValorInput(m.total);
    document.getElementById('meta-guardado').value = formatarValorInput(m.guardado);
    document.getElementById('meta-prazo').value = m.prazo || '';
  } else {
    document.getElementById('meta-nome').value = '';
    document.getElementById('meta-total').value = '';
    document.getElementById('meta-guardado').value = '';
    document.getElementById('meta-prazo').value = '';
  }
  mostrarModal('modal-meta');
}

function salvarMeta() {
  const nome = document.getElementById('meta-nome').value.trim();
  const total = parsearValor(document.getElementById('meta-total').value);
  const guardado = parsearValor(document.getElementById('meta-guardado').value) || 0;
  const prazo = document.getElementById('meta-prazo').value;

  if (!nome || !total) { showToast('Nome e Valor Total são obrigatórios.'); return; }

  const metaExistente = App.metaEditandoId ? DataLayer.getMetas().find(m => m.id === App.metaEditandoId) : {};

  const meta = {
    id: App.metaEditandoId || gerarId(),
    nome, total, guardado, prazo,
    aportes: metaExistente.aportes || [],
    itens: metaExistente.itens || [], // Preserva os itens já salvos
    criadoEm: metaExistente.criadoEm || new Date().toISOString()
  };

  if (App.metaEditandoId) DataLayer.updateMeta(App.metaEditandoId, meta);
  else DataLayer.addMeta(meta);

  closeAllModals();
  renderMetas();
  renderHome();
}

function excluirMeta(id) {
  if (!confirm('Excluir esta meta permanentemente?')) return;
  DataLayer.deleteMeta(id);
  renderMetas();
  renderHome();
}

// Aportes
function abrirModalAporte(metaId) {
  App.aporteMetaId = metaId;
  const m = DataLayer.getMetas().find(x => x.id === metaId);
  document.getElementById('aporte-meta-nome').textContent = m.nome;
  document.getElementById('aporte-valor').value = '';
  mostrarModal('modal-aporte');
}

function salvarAporte() {
  const valor = parsearValor(document.getElementById('aporte-valor').value);
  if (!valor) return;

  const meta = DataLayer.getMetas().find(m => m.id === App.aporteMetaId);
  if (!meta) return;

  DataLayer.updateMeta(App.aporteMetaId, {
    guardado: meta.guardado + valor,
    aportes: [...(meta.aportes || []), { valor, data: new Date().toISOString() }]
  });

  closeAllModals();
  renderMetas();
  renderHome();
}

// Itens de Meta
function abrirModalItemMeta(metaId) {
  App.itemMetaAlvoId = metaId;
  document.getElementById('item-meta-alvo-id').value = metaId;
  document.getElementById('item-meta-nome').value = '';
  document.getElementById('item-meta-valor').value = '';
  mostrarModal('modal-item-meta');
}

function salvarItemMeta() {
  const metaId = document.getElementById('item-meta-alvo-id').value;
  const nome = document.getElementById('item-meta-nome').value.trim();
  const valor = parsearValor(document.getElementById('item-meta-valor').value);

  if (!nome) { showToast('Escreva o nome do item.'); return; }

  const meta = DataLayer.getMetas().find(m => m.id === metaId);
  if (!meta) return;

  const novoItem = { id: gerarId(), nome, valor, concluido: false };
  const itens = [...(meta.itens || []), novoItem];

  DataLayer.updateMeta(metaId, { itens });
  closeAllModals();
  renderMetas();
}

function excluirItemMeta(metaId, itemId) {
  if (!confirm('Remover este item da lista?')) return;
  const meta = DataLayer.getMetas().find(m => m.id === metaId);
  if (!meta) return;

  const itens = meta.itens.filter(i => i.id !== itemId);
  DataLayer.updateMeta(metaId, { itens });
  renderMetas();
}

function toggleItemMeta(metaId, itemId) {
  const meta = DataLayer.getMetas().find(m => m.id === metaId);
  if (!meta) return;

  const itens = meta.itens.map(i => i.id === itemId ? { ...i, concluido: !i.concluido } : i);
  DataLayer.updateMeta(metaId, { itens });
  renderMetas();
}

/* ================================================================
   12. NEGÓCIOS E PRODUTOS (Carteiras Independentes)
================================================================ */

function renderNegocios() {
  const negocios = DataLayer.getNegocios();
  const produtos = DataLayer.getProdutos();
  const transacoes = DataLayer.getTransCarteiras();
  const container = document.getElementById('lista-negocios');

  if (!container) return;

  if (negocios.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>Nenhum negócio/carteira cadastrado.</p></div>`;
    return;
  }

  container.innerHTML = negocios.map((neg, i) => {
    const prodNegocio = produtos.filter(p => p.negocioId === neg.id);
    const transNegocio = transacoes.filter(t => t.negocioId === neg.id);
    
    // Calcula saldo deste negócio especificamente
    const saldo = transNegocio.reduce((acc, t) => acc + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);

    return `
      <div class="negocio-card">
        <div class="negocio-card-header" onclick="this.parentElement.classList.toggle('aberto')">
          <div class="negocio-dot dot-n${i % 6}"></div>
          <div class="negocio-info">
            <div class="negocio-nome-txt">${escapeHtml(neg.nome)}</div>
            ${neg.compensarSaldo ? '<div class="negocio-compensar-tag">Soma ao saldo global</div>' : ''}
          </div>
          <div class="negocio-saldo ${saldo >= 0 ? 'verde' : 'vermelho'}">${formatarReais(saldo)}</div>
          <div class="negocio-chevron">▼</div>
        </div>

        <div class="negocio-card-body">
          <div class="negocio-acoes">
            <button class="negocio-btn verde-btn" onclick="event.stopPropagation(); abrirModalTransCarteira('${neg.id}', null, 'entrada')">+ Entrada</button>
            <button class="negocio-btn vermelho-btn" onclick="event.stopPropagation(); abrirModalTransCarteira('${neg.id}', null, 'saida')">- Saída</button>
            <button class="negocio-btn" onclick="event.stopPropagation(); abrirModalProduto('${neg.id}')">+ Produto</button>
            <button class="negocio-btn" onclick="event.stopPropagation(); abrirModalNegocio('${neg.id}')">Editar</button>
            <button class="negocio-btn danger-btn" onclick="event.stopPropagation(); excluirNegocio('${neg.id}')">Excluir</button>
          </div>

          <div class="negocio-subsecao">
            <div class="negocio-subsecao-titulo">Produtos / Serviços</div>
            <div class="produtos-lista">
              ${prodNegocio.length === 0 ? '<div class="empty-small">Nenhum produto cadastrado.</div>' : 
                prodNegocio.map(p => `
                  <div class="produto-item">
                    <div class="produto-info">
                      <div class="produto-nome-txt">${escapeHtml(p.nome)}</div>
                      <div class="produto-cat-txt">${escapeHtml(p.categoria)}</div>
                    </div>
                    <div class="produto-valor-txt">${formatarReais(p.valor)}</div>
                    <button class="produto-del-btn" onclick="excluirProduto('${p.id}')">✕</button>
                  </div>
                `).join('')}
            </div>
          </div>

          <div class="negocio-subsecao">
            <div class="negocio-subsecao-titulo">Transações Recentes</div>
            <div class="negocio-trans-lista">
              ${transNegocio.length === 0 ? '<div class="empty-small">Nenhuma transação.</div>' : 
                transNegocio.slice(0, 5).map(t => `
                  <div class="negocio-trans-item" onclick="abrirDetalhe('${t.id}')">
                    <div class="negocio-trans-desc">
                      <div class="negocio-trans-nome">${escapeHtml(t.descricao)}</div>
                      <div class="negocio-trans-cat">${formatarDataCurta(t.data)} · ${escapeHtml(t.categoria)}</div>
                    </div>
                    <div class="negocio-trans-val-wrap">
                      <div class="negocio-trans-val ${t.tipo === 'entrada' ? 'verde' : 'vermelho'}">
                        ${t.tipo === 'entrada' ? '+' : '-'}${formatarReais(t.valor)}
                      </div>
                    </div>
                  </div>
                `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function abrirModalNegocio(id = null) {
  App.negocioEditandoId = id;
  const titulo = document.getElementById('modal-negocio-titulo');

  if (id) {
    const n = DataLayer.getNegocios().find(x => x.id === id);
    titulo.textContent = 'Editar Negócio';
    document.getElementById('negocio-nome').value = n.nome;
    document.getElementById('negocio-compensar').checked = !!n.compensarSaldo;
  } else {
    titulo.textContent = 'Novo Negócio / Carteira';
    document.getElementById('negocio-nome').value = '';
    document.getElementById('negocio-compensar').checked = true;
  }
  mostrarModal('modal-negocio');
}

function salvarNegocio() {
  const nome = document.getElementById('negocio-nome').value.trim();
  const compensarSaldo = document.getElementById('negocio-compensar').checked;

  if (!nome) { showToast('Nome é obrigatório.'); return; }

  const neg = {
    id: App.negocioEditandoId || gerarId(),
    nome, compensarSaldo,
    criadoEm: new Date().toISOString()
  };

  if (App.negocioEditandoId) DataLayer.updateNegocio(neg.id, neg);
  else DataLayer.addNegocio(neg);

  closeAllModals();
  renderNegocios();
  renderHome();
}

function excluirNegocio(id) {
  if (!confirm('ATENÇÃO: Apagar este negócio vai apagar também todos os seus produtos e transações! Confirma?')) return;
  DataLayer.deleteNegocio(id);
  renderNegocios();
  renderHome();
}

// Produtos
function abrirModalProduto(negocioId, produtoId = null) {
  document.getElementById('produto-negocio-id').value = negocioId;
  document.getElementById('produto-editando-id').value = produtoId || '';
  preencherCategorias('produto-categoria');

  if (produtoId) {
    const p = DataLayer.getProdutos().find(x => x.id === produtoId);
    document.getElementById('produto-nome').value = p.nome;
    document.getElementById('produto-valor').value = formatarValorInput(p.valor);
    document.getElementById('produto-categoria').value = p.categoria;
  } else {
    document.getElementById('produto-nome').value = '';
    document.getElementById('produto-valor').value = '';
  }
  mostrarModal('modal-produto');
}

function salvarProduto() {
  const negocioId = document.getElementById('produto-negocio-id').value;
  const editId = document.getElementById('produto-editando-id').value;
  const nome = document.getElementById('produto-nome').value.trim();
  const valor = parsearValor(document.getElementById('produto-valor').value);
  const categoria = document.getElementById('produto-categoria').value;

  if (!nome || valor <= 0) { showToast('Nome e Valor válidos são necessários.'); return; }

  const p = {
    id: editId || gerarId(),
    negocioId, nome, valor, categoria,
    criadoEm: new Date().toISOString()
  };

  if (editId) DataLayer.updateProduto(editId, p);
  else DataLayer.addProduto(p);

  closeAllModals();
  renderNegocios();
}

function excluirProduto(id) {
  if (!confirm('Apagar este produto?')) return;
  DataLayer.deleteProduto(id);
  renderNegocios();
}

/* ================================================================
   13. TRANSAÇÕES DE NEGÓCIOS (Carteiras)
================================================================ */

function abrirModalTransCarteira(negocioId, transId = null, tipoPre = 'entrada') {
  document.getElementById('trans-cart-negocio-id').value = negocioId;
  document.getElementById('trans-cart-editando-id').value = transId || '';
  preencherCategorias('trans-cart-categoria');

  // Popula o select de produtos desta carteira
  const produtos = DataLayer.getProdutos().filter(p => p.negocioId === negocioId);
  const selectProd = document.getElementById('trans-cart-produto');
  selectProd.innerHTML = '<option value="">— Valor avulso / Não se aplica —</option>' + 
    produtos.map(p => `<option value="${p.id}" data-valor="${p.valor}">${p.nome}</option>`).join('');

  if (transId) {
    const t = DataLayer.getTransCarteiras().find(x => x.id === transId);
    selectTransCartTipo(t.tipo);
    document.getElementById('trans-cart-produto').value = t.produtoId || '';
    document.getElementById('trans-cart-qtd').value = t.qtd || 1;
    document.getElementById('trans-cart-descricao').value = t.descricao;
    document.getElementById('trans-cart-valor').value = formatarValorInput(t.valor);
    document.getElementById('trans-cart-categoria').value = t.categoria;
    document.getElementById('trans-cart-data').value = t.data;
    document.getElementById('trans-cart-futura').checked = !!t.futura;
    document.getElementById('trans-cart-obs').value = t.obs || '';
    onTransCartProdutoChange(); // Ajusta visibilidade do grupo qtd
  } else {
    selectTransCartTipo(tipoPre);
    document.getElementById('trans-cart-produto').value = '';
    document.getElementById('trans-cart-qtd').value = '1';
    document.getElementById('trans-cart-descricao').value = '';
    document.getElementById('trans-cart-valor').value = '';
    document.getElementById('trans-cart-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('trans-cart-futura').checked = false;
    document.getElementById('trans-cart-obs').value = '';
    onTransCartProdutoChange();
  }
  mostrarModal('modal-trans-carteira');
}

function selectTransCartTipo(tipo) {
  document.querySelectorAll('#trans-cart-tipo-toggle .toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === tipo);
  });
}

function onTransCartProdutoChange() {
  const sel = document.getElementById('trans-cart-produto');
  const qtdGroup = document.getElementById('trans-cart-qtd-group');
  
  if (sel.value) {
    qtdGroup.classList.remove('hidden');
    calcularValorCarteira();
    // Autocompleta descrição
    const option = sel.options[sel.selectedIndex];
    if (option) {
       document.getElementById('trans-cart-descricao').value = `Venda: ${option.text}`;
    }
  } else {
    qtdGroup.classList.add('hidden');
  }
}

function calcularValorCarteira() {
  const sel = document.getElementById('trans-cart-produto');
  if (!sel.value) return;
  const option = sel.options[sel.selectedIndex];
  const unitValor = parseFloat(option.getAttribute('data-valor'));
  const qtd = parseInt(document.getElementById('trans-cart-qtd').value) || 1;
  document.getElementById('trans-cart-valor').value = formatarValorInput(unitValor * qtd);
}

function salvarTransCarteira() {
  const negocioId = document.getElementById('trans-cart-negocio-id').value;
  const id = document.getElementById('trans-cart-editando-id').value;
  
  const btnTipo = document.querySelector('#trans-cart-tipo-toggle .toggle-btn.active');
  const tipo = btnTipo ? btnTipo.dataset.value : 'entrada';
  
  const produtoId = document.getElementById('trans-cart-produto').value || null;
  const qtd = parseInt(document.getElementById('trans-cart-qtd').value) || 1;
  const descricao = document.getElementById('trans-cart-descricao').value.trim();
  const valor = parsearValor(document.getElementById('trans-cart-valor').value);
  const data = document.getElementById('trans-cart-data').value;

  if (!descricao || valor <= 0 || !data) { showToast('Preencha descrição, valor e data.'); return; }

  const t = {
    id: id || gerarId(), negocioId, tipo, produtoId, qtd, descricao, valor,
    categoria: document.getElementById('trans-cart-categoria').value,
    data, futura: document.getElementById('trans-cart-futura').checked,
    obs: document.getElementById('trans-cart-obs').value.trim(),
    criadoEm: new Date().toISOString()
  };

  if (id) DataLayer.updateTransCarteira(id, t);
  else DataLayer.addTransCarteira(t);

  closeAllModals();
  renderNegocios();
  renderHome();
  renderHistorico();
}

function excluirTransCarteira(id) {
  if (!confirm('Excluir esta transação da carteira?')) return;
  DataLayer.deleteTransCarteira(id);
  closeAllModals();
  renderNegocios();
  renderHome();
  renderHistorico();
}

/* ================================================================
   14. RELATÓRIOS
================================================================ */

function renderRelatorio() {
  atualizarLabelMes();

  // Para o relatório, unificamos todas as contas
  const todasTransacoes = getTodasTransacoesUnificadas();
  const mes = App.relatorioMes;
  const ano = App.relatorioAno;

  const doMes = todasTransacoes.filter(t => {
    const d = new Date(t.data + 'T12:00:00');
    return d.getMonth() === mes && d.getFullYear() === ano;
  });

  const { entradas, saidas } = calcularResumoMes(todasTransacoes, mes, ano);
  const saldo = entradas - saidas;

  document.getElementById('rel-entradas').textContent = formatarReais(entradas);
  document.getElementById('rel-saidas').textContent   = formatarReais(saidas);

  const elSaldo = document.getElementById('rel-saldo');
  elSaldo.textContent = formatarReais(saldo);
  elSaldo.className   = 'relatorio-card-valor ' + (saldo >= 0 ? 'verde' : 'vermelho');

  renderGastosPorCategoria(doMes);
  renderGastosPorPessoa(doMes); // Pessoas e Negócios
  renderProjecao(todasTransacoes);
}

function renderGastosPorCategoria(doMes) {
  const saidas = doMes.filter(t => t.tipo === 'saida');
  const mapa = {};
  saidas.forEach(t => { mapa[t.categoria] = (mapa[t.categoria] || 0) + t.valor; });
  
  const total = Object.values(mapa).reduce((a, b) => a + b, 0) || 1;
  const sorted = Object.entries(mapa).sort((a, b) => b[1] - a[1]);

  const container = document.getElementById('rel-categorias');
  if (sorted.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);font-size:.85rem">Nenhum gasto no período.</p>';
    return;
  }

  container.innerHTML = sorted.map(([cat, val]) => {
    const pct = Math.round((val / total) * 100);
    return `
      <div class="cat-bar-item">
        <div class="cat-bar-header">
          <span>${escapeHtml(cat)}</span>
          <span>${formatarReais(val)} (${pct}%)</span>
        </div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

function renderGastosPorPessoa(doMes) {
  const config = DataLayer.getConfig();
  const container = document.getElementById('rel-pessoas');

  // Calcula U1 e U2 do App Principal
  const calcNormal = (usuario) => {
    const trans = doMes.filter(t => !t.isCarteira && t.usuario === usuario);
    return {
      entradas: trans.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0),
      saidas:   trans.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0)
    };
  };

  const u1 = calcNormal('usuario1');
  const u2 = calcNormal('usuario2');

  let html = `
    <div class="pessoa-linha">
      <span><span class="pessoa-dot dot-1" style="display:inline-block;margin-right:6px"></span>
        ${escapeHtml(config.nomeU1 || 'Usuário 1')} — Entradas</span>
      <span class="verde">${formatarReais(u1.entradas)}</span>
    </div>
    <div class="pessoa-linha">
      <span><span class="pessoa-dot dot-1" style="display:inline-block;margin-right:6px"></span>
        ${escapeHtml(config.nomeU1 || 'Usuário 1')} — Saídas</span>
      <span class="vermelho">${formatarReais(u1.saidas)}</span>
    </div>
    <div class="pessoa-linha">
      <span><span class="pessoa-dot dot-2" style="display:inline-block;margin-right:6px"></span>
        ${escapeHtml(config.nomeU2 || 'Usuário 2')} — Entradas</span>
      <span class="verde">${formatarReais(u2.entradas)}</span>
    </div>
    <div class="pessoa-linha">
      <span><span class="pessoa-dot dot-2" style="display:inline-block;margin-right:6px"></span>
        ${escapeHtml(config.nomeU2 || 'Usuário 2')} — Saídas</span>
      <span class="vermelho">${formatarReais(u2.saidas)}</span>
    </div>`;

  // Adiciona as Carteiras de Negócios no relatório
  const negocios = DataLayer.getNegocios();
  negocios.forEach((neg, i) => {
    const tcs = doMes.filter(t => t.isCarteira && t.negocioId === neg.id);
    const ent = tcs.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0);
    const sai = tcs.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0);
    html += `
    <div class="pessoa-linha">
      <span><span class="pessoa-dot dot-n${i % 6}" style="display:inline-block;margin-right:6px"></span>
        [Carteira] ${escapeHtml(neg.nome)} — Entradas</span>
      <span class="verde">${formatarReais(ent)}</span>
    </div>
    <div class="pessoa-linha">
      <span><span class="pessoa-dot dot-n${i % 6}" style="display:inline-block;margin-right:6px"></span>
        [Carteira] ${escapeHtml(neg.nome)} — Saídas</span>
      <span class="vermelho">${formatarReais(sai)}</span>
    </div>`;
  });

  container.innerHTML = html;
}

function renderProjecao(todas) {
  const container = document.getElementById('rel-projecao');
  const fixos = todas.filter(t => t.fixo); // Somente fixos (gerais)

  if (fixos.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);font-size:.85rem">Nenhum item fixo cadastrado.</p>';
    return;
  }

  let totalFixoEntradas = 0, totalFixoSaidas = 0;
  const linhas = fixos.map(t => {
    if (t.tipo === 'entrada') totalFixoEntradas += t.valor;
    else totalFixoSaidas += t.valor;
    return `
      <div class="projecao-row">
        <span>${escapeHtml(t.descricao)}</span>
        <span class="${t.tipo === 'entrada' ? 'verde' : 'vermelho'}">
          ${t.tipo === 'entrada' ? '+' : '-'}${formatarReais(t.valor)}
        </span>
      </div>`;
  }).join('');

  const saldoProjetado = totalFixoEntradas - totalFixoSaidas;
  container.innerHTML = `
    <div class="projecao-box">
      ${linhas}
      <div class="projecao-row">
        <span>Saldo fixo projetado</span>
        <span class="${saldoProjetado >= 0 ? 'verde' : 'vermelho'}">${formatarReais(saldoProjetado)}</span>
      </div>
    </div>`;
}

function navegarMes(direcao) {
  App.relatorioMes += direcao;
  if (App.relatorioMes > 11) { App.relatorioMes = 0; App.relatorioAno++; }
  if (App.relatorioMes < 0)  { App.relatorioMes = 11; App.relatorioAno--; }
  renderRelatorio();
}

function atualizarLabelMes() {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('relatorio-mes-label').textContent = `${meses[App.relatorioMes]} ${App.relatorioAno}`;
}

/* ================================================================
   15. CONFIGURAÇÕES
================================================================ */

function renderConfig() {
  const config = DataLayer.getConfig();
  document.getElementById('config-nome-u1').value = config.nomeU1 || '';
  document.getElementById('config-nome-u2').value = config.nomeU2 || '';
  renderCategoriasCustom();

  document.getElementById('btn-usuario1').textContent = `👤 ${config.nomeU1 || 'Usuário 1'}`;
  document.getElementById('btn-usuario2').textContent = `👤 ${config.nomeU2 || 'Usuário 2'}`;
}

function salvarNomes() {
  const config = DataLayer.getConfig();
  config.nomeU1 = document.getElementById('config-nome-u1').value.trim() || 'Usuário 1';
  config.nomeU2 = document.getElementById('config-nome-u2').value.trim() || 'Usuário 2';
  DataLayer.setConfig(config);
  showToast('Nomes salvos.');
  renderHome();
  renderConfig();
}

function renderCategoriasCustom() {
  const config = DataLayer.getConfig();
  const custom = config.categoriasCustom || [];
  const container = document.getElementById('lista-categorias-custom');

  if (custom.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:.82rem;margin-bottom:8px">Nenhuma categoria personalizada ainda.</p>';
    return;
  }
  container.innerHTML = custom.map(cat => `
    <span class="categoria-chip">
      ${escapeHtml(cat)}
      <button class="chip-del" onclick="removerCategoriaCustom('${escapeHtml(cat)}')" title="Remover">✕</button>
    </span>`).join('');
}

function adicionarCategoriaCustom() {
  const input = document.getElementById('nova-categoria-input');
  const nome  = input.value.trim();
  if (!nome) { showToast('Digite o nome da categoria.'); return; }

  const config = DataLayer.getConfig();
  const todas  = [...CATEGORIAS_PADRAO, ...(config.categoriasCustom || [])];
  if (todas.map(c => c.toLowerCase()).includes(nome.toLowerCase())) {
    showToast('Categoria já existe.'); return;
  }

  config.categoriasCustom = [...(config.categoriasCustom || []), nome];
  DataLayer.setConfig(config);
  input.value = '';
  showToast(`Categoria "${nome}" criada.`);
  renderCategoriasCustom();
}

function removerCategoriaCustom(nome) {
  const config = DataLayer.getConfig();
  config.categoriasCustom = (config.categoriasCustom || []).filter(c => c !== nome);
  DataLayer.setConfig(config);
  renderCategoriasCustom();
}

function carregarConfiguracoes() {
  const config = DataLayer.getConfig();
  document.getElementById('btn-usuario1').textContent = `👤 ${config.nomeU1 || 'Usuário 1'}`;
  document.getElementById('btn-usuario2').textContent = `👤 ${config.nomeU2 || 'Usuário 2'}`;
}

function confirmarLimpeza() {
  if (!confirm('Isto vai apagar TODAS as transações, negócios, metas e configurações. Tem a certeza?')) return;
  if (!confirm('Esta ação é totalmente irreversível. Confirma?')) return;
  DataLayer.limparTudo();
  showToast('Todos os dados foram apagados.');
  location.reload();
}

/* ================================================================
   16. UTILITÁRIOS & MODAIS
================================================================ */

function mostrarModal(id) {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAllModals() {
  document.getElementById('modal-overlay').classList.add('hidden');
  ['modal-transacao', 'modal-detalhe', 'modal-meta', 'modal-aporte', 
   'modal-rapido', 'modal-negocio', 'modal-produto', 'modal-trans-carteira', 'modal-item-meta'
  ].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
  document.body.style.overflow = '';
}

function formatarReais(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function formatarValorInput(valor) {
  if (!valor && valor !== 0) return '';
  return valor.toFixed(2).replace('.', ',');
}

function parsearValor(str) {
  if (!str) return 0;
  let s = String(str).trim().replace(/[^\d.,]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

function formatarDataCurta(dataStr) {
  if (!dataStr) return '—';
  const [, mes, dia] = dataStr.split('-');
  return `${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}`;
}

function formatarDataLonga(dataStr) {
  if (!dataStr) return '—';
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  return `${String(dia).padStart(2,'0')} de ${meses[mes - 1]}, ${ano}`;
}

function labelData(dataStr) {
  if (!dataStr) return 'Sem data';
  const hoje = new Date();
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);

  if (data.toDateString() === hoje.toDateString()) return 'Hoje';
  if (data.toDateString() === ontem.toDateString()) return 'Ontem';
  return formatarDataLonga(dataStr);
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

