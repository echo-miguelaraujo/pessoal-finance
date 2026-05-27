// ─── GERENCIAMENTO DE DADOS LOCAL ─────────────────────────────────────────
const storage = {
    get: (key) => JSON.parse(localStorage.getItem(key) || '[]'),
    set: (key, data) => localStorage.setItem(key, JSON.stringify(data))
};

const appState = {
    mesAtual: new Date(),
    viewAtiva: 'dashboard'
};

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    refreshAllViews();
});

// ─── VISUAL DE MARCAS (Mantido) ───────────────────────────────────────────
function aplicarEstiloMarca(nome) {
    const n = nome.toLowerCase();
    if (n.includes('netflix')) return { classe: 'brand-netflix', logo: 'N' };
    if (n.includes('ifood')) return { classe: 'brand-ifood', logo: 'iF' };
    if (n.includes('supermercado')) return { classe: 'brand-market', logo: 'XYZ' };
    return { classe: 'brand-generic', logo: '💰' };
}

// ─── RENDERIZAÇÃO E DADOS ────────────────────────────────────────────────
async function refreshAllViews() {
    const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    document.getElementById('current-month-label').innerText = `${meses[appState.mesAtual.getMonth()]} de ${appState.mesAtual.getFullYear()}`;

    // Filtra transações pelo mês selecionado
    const allTx = storage.get('transactions');
    const txList = allTx.filter(t => {
        const d = new Date(t.data_pagamento);
        return d.getMonth() === appState.mesAtual.getMonth() && 
               d.getFullYear() === appState.mesAtual.getFullYear();
    }).sort((a, b) => new Date(b.data_pagamento) - new Date(a.data_pagamento));

    let total = 0;
    txList.forEach(t => {
        if (t.tipo === 'entrada') total += Number(t.valor);
        else total -= Number(t.valor);
    });

    document.getElementById('dash-total-balance').innerText =
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);

    renderDashboardList(txList);
    renderFullHistoryList(txList);
    refreshGoalsWidget();
}

// Lógica de Renderização (Dash/Histórico/Forms) permanece a mesma, 
// apenas removendo dependência de 'appState.coupleId' ou 'appState.user'.

// ─── INSERÇÃO DE TRANSAÇÃO (Local) ────────────────────────────────────────
document.getElementById('tx-mutation-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newTx = {
        id: Date.now().toString(),
        descricao: document.getElementById('form-tx-desc').value,
        valor: Number(document.getElementById('form-tx-value').value),
        categoria: document.getElementById('form-tx-cat').value,
        tipo: document.getElementById('form-tx-type').value,
        cartao_info: document.getElementById('form-tx-card').value,
        parcela_atual: Number(document.getElementById('form-tx-part-current').value),
        parcela_total: Number(document.getElementById('form-tx-part-total').value),
        data_pagamento: new Date().toISOString()
    };

    const txs = storage.get('transactions');
    txs.push(newTx);
    storage.set('transactions', txs);

    showToast("Transação salva localmente!", "success");
    document.getElementById('tx-mutation-form').reset();
    document.getElementById('view-add-tx').classList.add('hidden');
    refreshAllViews();
});

// ─── METAS (Local) ────────────────────────────────────────────────────────
document.getElementById('goal-creation-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const meta = {
        nome: document.getElementById('goal-name-input').value,
        valor_total: Number(document.getElementById('goal-value-input').value),
        valor_guardado: 0
    };
    storage.set('goals', [meta]); // Sobrescreve a meta atual
    refreshGoalsWidget();
});

function refreshGoalsWidget() {
    const goals = storage.get('goals');
    const containerAb = document.getElementById('main-goals-container');
    
    if (goals.length > 0) {
        const m = goals[0];
        const pct = m.valor_total > 0 ? Math.min(Math.round((m.valor_guardado / m.valor_total) * 100), 100) : 0;
        document.getElementById('lbl-widget-goal-name').innerText = m.nome;
        document.getElementById('lbl-widget-goal-percent').innerText = `${pct}%`;
        document.getElementById('bar-widget-goal-fill').style.width = `${pct}%`;
        // Adicione o HTML do widget aqui conforme seu original...
    }
}

// ─── NAVEGAÇÃO E UTILS ────────────────────────────────────────────────────
// (Remova chamadas de logout e verificarSessaoAtiva)
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerText = message;
    container.appendChild(t);
    setTimeout(() => { t.remove(); }, 3000);
}

// Mantive os EventListeners de navegação inferior...