/* ================================================================
   FINANÇAS DO CASAL — app.js
   Fase 1: localStorage
   ----------------------------------------------------------------
   ESTRUTURA:
   1.  CONFIG & CONSTANTES
   2.  CAMADA DE DADOS (DataLayer) — isolada para fácil migração
   3.  ESTADO DA APLICAÇÃO
   4.  INICIALIZAÇÃO
   5.  NAVEGAÇÃO
   6.  HOME
   7.  MODAL DE TRANSAÇÃO
   8.  SALVAR / EDITAR / EXCLUIR TRANSAÇÃO
   9.  LISTA DE TRANSAÇÕES
   10. MODAL DE DETALHE
   11. METAS
   12. RELATÓRIOS
   13. CONFIGURAÇÕES
   14. UTILITÁRIOS (formatação, datas, toast)
   ================================================================ */

'use strict';

/* ================================================================
   1. CONFIG & CONSTANTES
================================================================ */

const CATEGORIAS_PADRAO = [
  'Alimentação', 'Transporte', 'Saúde', 'Moradia',
  'Assinaturas', 'Educação', 'Lazer', 'Outros'
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

// SVG de seta para cima (entrada) e para baixo (saída)
const SVG_ENTRADA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
const SVG_SAIDA   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;

/* ================================================================
   2. CAMADA DE DADOS (DataLayer)
   ----------------------------------------------------------------
   Toda leitura/escrita passa por aqui.
   Na Fase 3, substitua apenas estas funções pelo Supabase.
================================================================ */

const DataLayer = {

  /* --- Transações --- */
  getTransacoes() {
    return JSON.parse(localStorage.getItem('fc_transacoes') || '[]');
  },
  setTransacoes(lista) {
    localStorage.setItem('fc_transacoes', JSON.stringify(lista));
  },
  addTransacao(transacao) {
    const lista = this.getTransacoes();
    lista.unshift(transacao); // mais recente primeiro
    this.setTransacoes(lista);
  },
  updateTransacao(id, dados) {
    const lista = this.getTransacoes().map(t => t.id === id ? { ...t, ...dados } : t);
    this.setTransacoes(lista);
  },
  deleteTransacao(id) {
    const lista = this.getTransacoes().filter(t => t.id !== id);
    this.setTransacoes(lista);
  },

  /* --- Metas --- */
  getMetas() {
    return JSON.parse(localStorage.getItem('fc_metas') || '[]');
  },
  setMetas(lista) {
    localStorage.setItem('fc_metas', JSON.stringify(lista));
  },
  addMeta(meta) {
    const lista = this.getMetas();
    lista.push(meta);
    this.setMetas(lista);
  },
  updateMeta(id, dados) {
    const lista = this.getMetas().map(m => m.id === id ? { ...m, ...dados } : m);
    this.setMetas(lista);
  },
  deleteMeta(id) {
    const lista = this.getMetas().filter(m => m.id !== id);
    this.setMetas(lista);
  },

  /* --- Configurações --- */
  getConfig() {
    return JSON.parse(localStorage.getItem('fc_config') || JSON.stringify({
      nomeU1: 'Usuário 1',
      nomeU2: 'Usuário 2',
      categoriasCustom: []
    }));
  },
  setConfig(config) {
    localStorage.setItem('fc_config', JSON.stringify(config));
  },

  /* --- Limpar tudo --- */
  limparTudo() {
    localStorage.removeItem('fc_transacoes');
    localStorage.removeItem('fc_metas');
    localStorage.removeItem('fc_config');
  }
};

/* ================================================================
   3. ESTADO DA APLICAÇÃO
================================================================ */

const App = {
  telaAtual: 'tela-home',
  transacaoEditandoId: null,  // null = nova, string = editando
  metaEditandoId: null,
  aporteMetaId: null,
  tipoAtual: 'entrada',       // 'entrada' | 'saida'
  usuarioAtual: 'usuario1',   // 'usuario1' | 'usuario2'
  filtroHistorico: 'todos',
  mostrarTodas: false,        // home: mostrar todas ou só 8
  relatorioMes: new Date().getMonth(),
  relatorioAno: new Date().getFullYear(),
};

/* ================================================================
   4. INICIALIZAÇÃO
================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  carregarConfiguracoes();
  renderHome();
  renderMetas();
  renderHistorico();
  renderRelatorio();

  // Define data padrão do formulário como hoje
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('campo-data').value = hoje;
});

/* ================================================================
   5. NAVEGAÇÃO
================================================================ */

function irPara(telaId) {
  // Remove classe ativa da tela e botão atual
  document.getElementById(App.telaAtual)?.classList.remove('ativa');
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  // Ativa nova tela
  App.telaAtual = telaId;
  document.getElementById(telaId)?.classList.add('ativa');

  // Ativa botão da nav correspondente
  const navBtn = document.querySelector(`.nav-btn[data-tela="${telaId}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Atualiza conteúdo dinâmico ao mudar de aba
  if (telaId === 'tela-home')       renderHome();
  if (telaId === 'tela-metas')      renderMetas();
  if (telaId === 'tela-registrar')  renderHistorico();
  if (telaId === 'tela-relatorios') renderRelatorio();
  if (telaId === 'tela-config')     renderConfig();

  // Volta ao topo
  window.scrollTo(0, 0);
}

/* ================================================================
   6. HOME
================================================================ */

function renderHome() {
  const config = DataLayer.getConfig();
  const transacoes = DataLayer.getTransacoes();
  const metas = DataLayer.getMetas();

  // Nomes
  document.getElementById('home-nome-u1').textContent = config.nomeU1 || 'Usuário 1';
  document.getElementById('home-nome-u2').textContent = config.nomeU2 || 'Usuário 2';

  // Saldos
  const { totalGeral, saldoU1, saldoU2 } = calcularSaldos(transacoes);
  document.getElementById('saldo-total').textContent = formatarReais(totalGeral);
  document.getElementById('home-saldo-u1').textContent = formatarReais(saldoU1);
  document.getElementById('home-saldo-u2').textContent = formatarReais(saldoU2);

  // Cor do saldo total
  const elTotal = document.getElementById('saldo-total');
  elTotal.style.color = totalGeral < 0 ? 'var(--vermelho)' : 'var(--text-primary)';

  // Resumo do mês atual
  const agora = new Date();
  const { entradas, saidas } = calcularResumoMes(transacoes, agora.getMonth(), agora.getFullYear());
  document.getElementById('resumo-entradas').textContent = formatarReais(entradas);
  document.getElementById('resumo-saidas').textContent   = formatarReais(saidas);

  // Metas mini na home
  const secaoMetas = document.getElementById('home-metas-section');
  const listaMetas  = document.getElementById('home-metas-lista');
  if (metas.length > 0) {
    secaoMetas.classList.remove('hidden');
    listaMetas.innerHTML = metas.slice(0, 2).map(renderMetaMini).join('');
  } else {
    secaoMetas.classList.add('hidden');
  }

  // Transações recentes
  renderListaTransacoes(transacoes, 'lista-transacoes', App.mostrarTodas ? 9999 : 8);
  document.getElementById('btn-ver-todas').textContent =
    App.mostrarTodas ? 'Ver menos' : 'Ver todas';
}

function toggleVerTodas() {
  App.mostrarTodas = !App.mostrarTodas;
  renderHome();
}

function calcularSaldos(transacoes) {
  let saldoU1 = 0, saldoU2 = 0;
  transacoes.forEach(t => {
    const val = t.tipo === 'entrada' ? t.valor : -t.valor;
    if (t.usuario === 'usuario1') saldoU1 += val;
    else saldoU2 += val;
  });
  return { totalGeral: saldoU1 + saldoU2, saldoU1, saldoU2 };
}

function calcularResumoMes(transacoes, mes, ano) {
  let entradas = 0, saidas = 0;
  transacoes.forEach(t => {
    const d = new Date(t.data + 'T12:00:00');
    if (d.getMonth() === mes && d.getFullYear() === ano) {
      if (t.tipo === 'entrada') entradas += t.valor;
      else saidas += t.valor;
    }
  });
  return { entradas, saidas };
}

/* ================================================================
   7. MODAL DE TRANSAÇÃO (abrir / campos dinâmicos)
================================================================ */

function abrirModalTransacao(tipo, transacaoId = null) {
  App.transacaoEditandoId = transacaoId;
  App.tipoAtual = tipo;

  const titulo = document.getElementById('modal-transacao-titulo');

  if (transacaoId) {
    // Modo edição: carrega dados existentes
    titulo.textContent = 'Editar Transação';
    const t = DataLayer.getTransacoes().find(x => x.id === transacaoId);
    if (!t) return;
    App.tipoAtual = t.tipo;
    preencherFormulario(t);
  } else {
    // Modo criação
    titulo.textContent = tipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída';
    limparFormulario();
    selectTipo(tipo);
  }

  atualizarSubtipos();
  preencherCategorias();
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

function preencherCategorias() {
  const config = DataLayer.getConfig();
  const todas = [...CATEGORIAS_PADRAO, ...(config.categoriasCustom || [])];
  const sel = document.getElementById('campo-categoria');
  sel.innerHTML = todas.map(c => `<option value="${c}">${c}</option>`).join('');
}

function toggleFixo() {
  const checked = document.getElementById('campo-fixo').checked;
  document.getElementById('grupo-vencimento').classList.toggle('hidden', !checked);
}

function limparFormulario() {
  document.getElementById('campo-descricao').value = '';
  document.getElementById('campo-valor').value = '';
  document.getElementById('campo-obs').value = '';
  document.getElementById('campo-parcelas').value = '1';
  document.getElementById('campo-fixo').checked = false;
  document.getElementById('campo-vencimento').value = '';
  document.getElementById('grupo-vencimento').classList.add('hidden');

  // Data = hoje
  document.getElementById('campo-data').value = new Date().toISOString().split('T')[0];

  // Usuário padrão = usuario1
  selectUsuario('usuario1');
}

function preencherFormulario(t) {
  preencherCategorias();
  atualizarSubtipos();

  selectTipo(t.tipo);
  selectUsuario(t.usuario);

  document.getElementById('campo-subtipo').value    = t.subtipo   || 'avulso';
  document.getElementById('campo-descricao').value  = t.descricao || '';
  document.getElementById('campo-valor').value      = formatarValorInput(t.valor);
  document.getElementById('campo-categoria').value  = t.categoria || 'Outros';
  document.getElementById('campo-data').value       = t.data      || '';
  document.getElementById('campo-parcelas').value   = t.parcelas  || '1';
  document.getElementById('campo-obs').value        = t.obs       || '';

  const fixo = !!t.fixo;
  document.getElementById('campo-fixo').checked = fixo;
  document.getElementById('grupo-vencimento').classList.toggle('hidden', !fixo);
  if (fixo) document.getElementById('campo-vencimento').value = t.diaVencimento || '';
}

/* ================================================================
   8. SALVAR / EDITAR / EXCLUIR TRANSAÇÃO
================================================================ */

function salvarTransacao() {
  // Coleta dados do formulário
  const descricao  = document.getElementById('campo-descricao').value.trim();
  const valorRaw   = document.getElementById('campo-valor').value;
  const categoria  = document.getElementById('campo-categoria').value;
  const data       = document.getElementById('campo-data').value;
  const subtipo    = document.getElementById('campo-subtipo').value;
  const parcelas   = parseInt(document.getElementById('campo-parcelas').value) || 1;
  const obs        = document.getElementById('campo-obs').value.trim();
  const fixo       = document.getElementById('campo-fixo').checked;
  const diaVenc    = document.getElementById('campo-vencimento').value;

  // Validações
  if (!descricao) { showToast('Informe uma descrição.'); return; }
  const valor = parsearValor(valorRaw);
  if (!valor || valor <= 0) { showToast('Informe um valor válido.'); return; }
  if (!data) { showToast('Informe a data.'); return; }

  const transacao = {
    id:          App.transacaoEditandoId || gerarId(),
    tipo:        App.tipoAtual,
    subtipo,
    descricao,
    valor,
    categoria,
    usuario:     App.usuarioAtual,
    data,
    parcelas,
    fixo,
    diaVencimento: fixo ? diaVenc : null,
    obs,
    criadoEm:   App.transacaoEditandoId
                  ? DataLayer.getTransacoes().find(t => t.id === App.transacaoEditandoId)?.criadoEm
                  : new Date().toISOString(),
  };

  if (App.transacaoEditandoId) {
    DataLayer.updateTransacao(App.transacaoEditandoId, transacao);
    showToast('Transação atualizada.');
  } else {
    DataLayer.addTransacao(transacao);
    showToast(transacao.tipo === 'entrada' ? 'Entrada registrada.' : 'Saída registrada.');
  }

  closeAllModals();
  renderHome();
  renderHistorico();
}

function excluirTransacao(id) {
  if (!confirm('Excluir esta transação?')) return;
  DataLayer.deleteTransacao(id);
  closeAllModals();
  showToast('Transação excluída.');
  renderHome();
  renderHistorico();
}

/* ================================================================
   9. LISTA DE TRANSAÇÕES (Home e Histórico)
================================================================ */

function renderListaTransacoes(transacoes, containerId, limite = 9999, filtroTipo = 'todos') {
  const container = document.getElementById(containerId);
  if (!container) return;

  let lista = [...transacoes];
  if (filtroTipo !== 'todos') lista = lista.filter(t => t.tipo === filtroTipo);
  lista = lista.slice(0, limite);

  if (lista.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>Nenhuma transação encontrada.</p></div>`;
    return;
  }

  // Agrupa por data
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
  const nomeUsuario = t.usuario === 'usuario1'
    ? (config.nomeU1 || 'Usuário 1')
    : (config.nomeU2 || 'Usuário 2');

  const svgIcone   = t.tipo === 'entrada' ? SVG_ENTRADA : SVG_SAIDA;
  const classeIcone = t.tipo === 'entrada' ? 'icone-entrada' : 'icone-saida';
  const classeValor = t.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida';
  const prefixo     = t.tipo === 'entrada' ? '+' : '-';

  const tagParcela = t.parcelas > 1
    ? `<span class="tag-parcela">${t.parcelas}x</span>` : '';
  const tagFixo = t.fixo
    ? `<span class="tag-fixo">fixo</span>` : '';

  return `
    <div class="transacao-item" onclick="abrirDetalhe('${t.id}')">
      <div class="transacao-icone ${classeIcone}">${svgIcone}</div>
      <div class="transacao-info">
        <div class="transacao-desc">
          ${escapeHtml(t.descricao)}${tagParcela}${tagFixo}
        </div>
        <div class="transacao-meta">
          ${escapeHtml(t.categoria)} · ${escapeHtml(nomeUsuario)}
        </div>
      </div>
      <div class="transacao-valor-wrap">
        <div class="transacao-valor ${classeValor}">
          ${prefixo}${formatarReais(t.valor)}
        </div>
        <div class="transacao-data">${formatarDataCurta(t.data)}</div>
      </div>
    </div>`;
}

function renderHistorico() {
  const transacoes = DataLayer.getTransacoes();
  renderListaTransacoes(transacoes, 'lista-historico', 9999, App.filtroHistorico);
}

function filtrarTransacoes(tipo, btnEl) {
  App.filtroHistorico = tipo;
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  renderHistorico();
}

function agruparPorData(transacoes) {
  const mapa = {};
  transacoes.forEach(t => {
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
  const t = DataLayer.getTransacoes().find(x => x.id === id);
  if (!t) return;

  const config = DataLayer.getConfig();
  const nomeUsuario = t.usuario === 'usuario1'
    ? (config.nomeU1 || 'Usuário 1')
    : (config.nomeU2 || 'Usuário 2');

  const prefixo   = t.tipo === 'entrada' ? '+' : '-';
  const classeVal = t.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida';

  const linhas = [
    { label: 'Tipo',       val: t.tipo === 'entrada' ? '↑ Entrada' : '↓ Saída' },
    { label: 'Subtipo',    val: labelSubtipo(t.subtipo) },
    { label: 'Categoria',  val: t.categoria },
    { label: 'Registrado por', val: nomeUsuario },
    { label: 'Data',       val: formatarDataLonga(t.data) },
    { label: 'Parcelas',   val: t.parcelas > 1 ? `${t.parcelas}x` : 'À vista' },
    { label: 'Fixo',       val: t.fixo ? `Sim (dia ${t.diaVencimento || '—'})` : 'Não' },
    t.obs ? { label: 'Obs.', val: t.obs } : null,
  ].filter(Boolean);

  const svgDetalhe = t.tipo === 'entrada' ? SVG_ENTRADA : SVG_SAIDA;
  const html = `
    <div class="transacao-icone ${t.tipo === 'entrada' ? 'icone-entrada' : 'icone-saida'}"
         style="width:48px;height:48px;border-radius:50%;margin-bottom:8px">
      ${svgDetalhe}
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
      <button class="detalhe-btn btn-editar"
        onclick="closeAllModals(); abrirModalTransacao('${t.tipo}', '${t.id}')">
        Editar
      </button>
      <button class="detalhe-btn btn-excluir"
        onclick="excluirTransacao('${t.id}')">
        Excluir
      </button>
    </div>`;

  document.getElementById('modal-detalhe-conteudo').innerHTML = html;
  mostrarModal('modal-detalhe');
}

/* ================================================================
   11. METAS
================================================================ */

function abrirModalMeta(metaId = null) {
  App.metaEditandoId = metaId;
  document.getElementById('modal-meta-titulo').textContent =
    metaId ? 'Editar Meta' : 'Nova Meta';

  if (metaId) {
    const m = DataLayer.getMetas().find(x => x.id === metaId);
    if (!m) return;
    document.getElementById('meta-nome').value     = m.nome;
    document.getElementById('meta-total').value    = formatarValorInput(m.total);
    document.getElementById('meta-guardado').value = formatarValorInput(m.guardado);
    document.getElementById('meta-prazo').value    = m.prazo || '';
  } else {
    document.getElementById('meta-nome').value     = '';
    document.getElementById('meta-total').value    = '';
    document.getElementById('meta-guardado').value = '';
    document.getElementById('meta-prazo').value    = '';
  }

  mostrarModal('modal-meta');
}

function salvarMeta() {
  const nome     = document.getElementById('meta-nome').value.trim();
  const total    = parsearValor(document.getElementById('meta-total').value);
  const guardado = parsearValor(document.getElementById('meta-guardado').value) || 0;
  const prazo    = document.getElementById('meta-prazo').value;

  if (!nome)           { showToast('Informe o nome da meta.'); return; }
  if (!total || total <= 0) { showToast('Informe o valor total.'); return; }

  const meta = {
    id:       App.metaEditandoId || gerarId(),
    nome,
    total,
    guardado,
    prazo,
    aportes:  App.metaEditandoId
                ? DataLayer.getMetas().find(m => m.id === App.metaEditandoId)?.aportes || []
                : [],
    criadoEm: new Date().toISOString(),
  };

  if (App.metaEditandoId) {
    DataLayer.updateMeta(App.metaEditandoId, meta);
    showToast('Meta atualizada.');
  } else {
    DataLayer.addMeta(meta);
    showToast('Meta criada.');
  }

  closeAllModals();
  renderMetas();
  renderHome();
}

function excluirMeta(id) {
  if (!confirm('Excluir esta meta?')) return;
  DataLayer.deleteMeta(id);
  showToast('Meta excluída.');
  renderMetas();
  renderHome();
}

function abrirModalAporte(metaId) {
  App.aporteMetaId = metaId;
  const m = DataLayer.getMetas().find(x => x.id === metaId);
  if (!m) return;
  document.getElementById('aporte-meta-nome').textContent = m.nome;
  document.getElementById('aporte-valor').value = '';
  mostrarModal('modal-aporte');
}

function salvarAporte() {
  const valor = parsearValor(document.getElementById('aporte-valor').value);
  if (!valor || valor <= 0) { showToast('Informe um valor válido.'); return; }

  const metas = DataLayer.getMetas();
  const meta  = metas.find(m => m.id === App.aporteMetaId);
  if (!meta) return;

  const novoGuardado = meta.guardado + valor;
  const aporte = { valor, data: new Date().toISOString() };

  DataLayer.updateMeta(App.aporteMetaId, {
    guardado: novoGuardado,
    aportes: [...(meta.aportes || []), aporte]
  });

  showToast(`Aporte de ${formatarReais(valor)} adicionado.`);
  closeAllModals();
  renderMetas();
  renderHome();
}

function renderMetas() {
  const metas = DataLayer.getMetas();
  const container = document.getElementById('lista-metas');
  if (!container) return;

  if (metas.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Nenhuma meta cadastrada.</p>
        <p>Crie uma meta para começar a poupar.</p>
      </div>`;
    return;
  }

  container.innerHTML = metas.map(renderMetaCard).join('');
}

function renderMetaCard(m) {
  const pct        = Math.min(100, Math.round((m.guardado / m.total) * 100));
  const classFill  = pct >= 100 ? 'concluida' : pct >= 70 ? 'quase' : '';
  const prazoTxt   = m.prazo ? `Prazo: ${formatarDataCurta(m.prazo)}` : 'Sem prazo definido';

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
          <div class="meta-progresso-fill ${classFill}"
               style="width: ${pct}%"></div>
        </div>
        <div class="meta-valores">
          <span class="meta-guardado">${formatarReais(m.guardado)}</span>
          <span class="meta-total-val">de ${formatarReais(m.total)}</span>
        </div>
        <div class="meta-pct">${pct}% concluído</div>
      </div>
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

/* ================================================================
   12. RELATÓRIOS
================================================================ */

function renderRelatorio() {
  atualizarLabelMes();

  const transacoes = DataLayer.getTransacoes();
  const mes = App.relatorioMes;
  const ano = App.relatorioAno;

  const doMes = transacoes.filter(t => {
    const d = new Date(t.data + 'T12:00:00');
    return d.getMonth() === mes && d.getFullYear() === ano;
  });

  const { entradas, saidas } = calcularResumoMes(transacoes, mes, ano);
  const saldo = entradas - saidas;

  document.getElementById('rel-entradas').textContent = formatarReais(entradas);
  document.getElementById('rel-saidas').textContent   = formatarReais(saidas);

  const elSaldo = document.getElementById('rel-saldo');
  elSaldo.textContent = formatarReais(saldo);
  elSaldo.className   = 'relatorio-card-valor ' + (saldo >= 0 ? 'verde' : 'vermelho');

  renderGastosPorCategoria(doMes);
  renderGastosPorPessoa(doMes);
  renderProjecao(transacoes);
}

function renderGastosPorCategoria(doMes) {
  const saidas = doMes.filter(t => t.tipo === 'saida');
  const mapa = {};
  saidas.forEach(t => {
    mapa[t.categoria] = (mapa[t.categoria] || 0) + t.valor;
  });
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

  const calcPessoa = (usuario) => {
    const entradas = doMes.filter(t => t.usuario === usuario && t.tipo === 'entrada')
                          .reduce((s, t) => s + t.valor, 0);
    const saidas   = doMes.filter(t => t.usuario === usuario && t.tipo === 'saida')
                          .reduce((s, t) => s + t.valor, 0);
    return { entradas, saidas };
  };

  const u1 = calcPessoa('usuario1');
  const u2 = calcPessoa('usuario2');

  container.innerHTML = `
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
}

function renderProjecao(transacoes) {
  const container = document.getElementById('rel-projecao');
  const fixos = transacoes.filter(t => t.fixo);

  if (fixos.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);font-size:.85rem">Nenhum item fixo cadastrado.</p>';
    return;
  }

  let totalFixoEntradas = 0, totalFixoSaidas = 0;
  const linhas = fixos.map(t => {
    const val = t.tipo === 'entrada' ? t.valor : -t.valor;
    if (t.tipo === 'entrada') totalFixoEntradas += t.valor;
    else totalFixoSaidas += t.valor;
    const classe = t.tipo === 'entrada' ? 'verde' : 'vermelho';
    const prefixo = t.tipo === 'entrada' ? '+' : '-';
    return `
      <div class="projecao-row">
        <span>${escapeHtml(t.descricao)}</span>
        <span class="${classe}">${prefixo}${formatarReais(t.valor)}</span>
      </div>`;
  }).join('');

  const saldoProjetado = totalFixoEntradas - totalFixoSaidas;
  const classeSaldo = saldoProjetado >= 0 ? 'verde' : 'vermelho';

  container.innerHTML = `
    <div class="projecao-box">
      ${linhas}
      <div class="projecao-row">
        <span>Saldo fixo projetado</span>
        <span class="${classeSaldo}">${formatarReais(saldoProjetado)}</span>
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
  document.getElementById('relatorio-mes-label').textContent =
    `${meses[App.relatorioMes]} ${App.relatorioAno}`;
}

/* ================================================================
   13. CONFIGURAÇÕES
================================================================ */

function renderConfig() {
  const config = DataLayer.getConfig();
  document.getElementById('config-nome-u1').value = config.nomeU1 || '';
  document.getElementById('config-nome-u2').value = config.nomeU2 || '';
  renderCategoriasCustom();

  // Atualiza nomes nos botões de usuário do modal
  document.getElementById('btn-usuario1').textContent =
    `👤 ${config.nomeU1 || 'Usuário 1'}`;
  document.getElementById('btn-usuario2').textContent =
    `👤 ${config.nomeU2 || 'Usuário 2'}`;
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
    showToast('Categoria já existe.');
    return;
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
  // Atualiza labels dos usuários nos botões do modal ao iniciar
  document.getElementById('btn-usuario1').textContent =
    `👤 ${config.nomeU1 || 'Usuário 1'}`;
  document.getElementById('btn-usuario2').textContent =
    `👤 ${config.nomeU2 || 'Usuário 2'}`;
}

function confirmarLimpeza() {
  if (!confirm('Isso vai apagar TODAS as transações, metas e configurações. Tem certeza?')) return;
  if (!confirm('Essa ação é irreversível. Confirma?')) return;
  DataLayer.limparTudo();
  showToast('Todos os dados foram apagados.');
  location.reload();
}

/* ================================================================
   14. MODAIS (controle de abertura/fechamento)
================================================================ */

function mostrarModal(id) {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAllModals() {
  document.getElementById('modal-overlay').classList.add('hidden');
  ['modal-transacao', 'modal-detalhe', 'modal-meta', 'modal-aporte'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
  document.body.style.overflow = '';
}

/* ================================================================
   15. UTILITÁRIOS
================================================================ */

/* --- Formatação monetária --- */
function formatarReais(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor || 0);
}

/* Formata número para exibir no input (ex: 1500 -> "1.500,00") */
function formatarValorInput(valor) {
  if (!valor && valor !== 0) return '';
  return valor.toFixed(2).replace('.', ',');
}

/* Converte string de valor digitada para número (aceita 1.500,00 ou 1500.00 ou 1500,00) */
function parsearValor(str) {
  if (!str) return 0;
  // Remove tudo exceto dígitos, vírgula e ponto
  let s = String(str).trim().replace(/[^\d.,]/g, '');
  // Se tem vírgula como separador decimal (pt-BR)
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

/* --- Formatação de datas --- */
function formatarDataCurta(dataStr) {
  if (!dataStr) return '—';
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  return `${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}`;
}

function formatarDataLonga(dataStr) {
  if (!dataStr) return '—';
  const meses = ['jan','fev','mar','abr','mai','jun',
                 'jul','ago','set','out','nov','dez'];
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  return `${String(dia).padStart(2,'0')} de ${meses[mes - 1]}, ${ano}`;
}

function labelData(dataStr) {
  if (!dataStr) return 'Sem data';
  const hoje = new Date();
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);

  if (data.toDateString() === hoje.toDateString())   return 'Hoje';
  if (data.toDateString() === ontem.toDateString())  return 'Ontem';
  return formatarDataLonga(dataStr);
}

/* --- Label do subtipo --- */
function labelSubtipo(subtipo) {
  const todos = [...SUBTIPOS.entrada, ...SUBTIPOS.saida];
  return todos.find(s => s.value === subtipo)?.label || subtipo || '—';
}

/* --- ID único simples --- */
function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* --- Escape HTML para prevenir XSS --- */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* --- Toast de feedback --- */
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}
