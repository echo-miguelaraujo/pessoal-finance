// ─── CONFIGURAÇÃO TOTALMENTE INTEGRADA COM O SEU BANCO DO SUPABASE ─────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://lfrizfbtvilggyocyewj.supabase.co";
const SUPABASE_ANON_KEY = "EyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxmcml6ZmJ0dmlsZ2d5b2N5ZXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDc3ODEsImV4cCI6MjA5NTQyMzc4MX0.lNseylQ2S-HkCsEl3qJNpXgzo6hrVHvGOwCsj4yVFa4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ESTADO CENTRAL DO APLICATIVO SPA
const appState = {
    user: null,
    profile: null,
    coupleId: null,
    mesAtual: new Date(),
    viewAtiva: 'dashboard'
};

// ─── AUTHENTICATION LOGIC ────────────────────────────────────────────

document.getElementById('tab-login-btn').addEventListener('click', () => toggleAuthTabs('login'));
document.getElementById('tab-register-btn').addEventListener('click', () => toggleAuthTabs('register'));
document.getElementById('reg-vinc').addEventListener('change', (e) => {
    const group = document.getElementById('couple-code-group');
    e.target.value === 'entrar' ? group.classList.remove('hidden') : group.classList.add('hidden');
});

function toggleAuthTabs(mode) {
    if (mode === 'login') {
        document.getElementById('tab-login-btn').classList.add('active');
        document.getElementById('tab-register-btn').classList.remove('active');
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
    } else {
        document.getElementById('tab-login-btn').classList.remove('active');
        document.getElementById('tab-register-btn').classList.add('active');
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    }
}

// Submissão do Formulário de Registro
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('reg-nome').value;
    const papel = document.getElementById('reg-papel').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const modoVinculo = document.getElementById('reg-vinc').value;

    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;

        let coupleId = null;

        if (modoVinculo === 'criar') {
            const { data: cData, error: cError } = await supabase.from('couples').insert([{}]).select().single();
            if (cError) throw cError;
            coupleId = cData.id;
        } else {
            coupleId = document.getElementById('reg-couple-id').value.trim();
            if(!coupleId) throw new Error("Por favor, cole o código de casal da sua parceria.");
        }

        const { error: profError } = await supabase.from('profiles').insert([{
            id: authData.user.id,
            couple_id: coupleId,
            nome: nome,
            papel: papel
        }]);
        if (profError) throw profError;

        showToast("Conta compartilhada criada com sucesso!", "success");
        toggleAuthTabs('login');
    } catch (err) {
        showToast(err.message, "error");
    }
});

// Submissão do Formulário de Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;

        await bootstrapSession(authData.user);
    } catch (err) {
        showToast(err.message, "error");
    }
});

// Inicialização e Carga de Sessão
async function bootstrapSession(user) {
    appState.user = user;

    const { data: profile, error: profError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profError || !profile) {
        showToast("Perfil não localizado.", "error");
        return;
    }

    appState.profile = profile;
    appState.coupleId = profile.couple_id;

    document.getElementById('txt-couple-code-display').innerText = `Código: ${appState.coupleId}`;
    document.getElementById('cfg-profile-name').innerText = profile.nome;
    document.getElementById('cfg-profile-role').innerText = profile.papel;
    document.getElementById('cfg-couple-id-input').value = appState.coupleId;

    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');

    showToast(`Bem-vindo, ${profile.nome}!`, "success");
    refreshAllViews();
}

// ─── LÓGICA DE MAPEAMENTO VISUAL (FIEL AO MOCKUP) ────────────────────

function aplicarEstiloMarca(nome) {
    const n = nome.toLowerCase();
    if (n.includes('netflix')) return { classe: 'brand-netflix', logo: 'N' };
    if (n.includes('ifood')) return { classe: 'brand-ifood', logo: 'iF' };
    if (n.includes('supermercado') || n.includes('xyz')) return { classe: 'brand-market', logo: 'XYZ' };
    if (n.includes('pix') || n.includes('transferencia') || n.includes('depósito ana')) return { classe: 'brand-pix', logo: '❖' };
    if (n.includes('salario') || n.includes('pagamento')) return { classe: 'brand-salary', logo: '💼' };
    if (n.includes('aluguel') || n.includes('fixo')) return { classe: 'brand-home', logo: '🏠' };
    return { classe: 'brand-generic', logo: '💰' };
}

// ─── PROCESSAMENTO DE DADOS E RENDERIZAÇÃO ───────────────────────────

async function refreshAllViews() {
    if (!appState.coupleId) return;

    // Atualiza rótulo do mês
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    document.getElementById('current-month-label').innerText = `${meses[appState.mesAtual.getMonth()]} de ${appState.mesAtual.getFullYear()}`;

    const primeiroDia = new Date(appState.mesAtual.getFullYear(), appState.mesAtual.getMonth(), 1).toISOString();
    const ultimoDia = new Date(appState.mesAtual.getFullYear(), appState.mesAtual.getMonth() + 1, 0, 23, 59, 59).toISOString();

    try {
        // Puxar transações do mês do casal
        const { data: txList, error: txError } = await supabase
            .from('transactions')
            .select('*')
            .eq('couple_id', appState.coupleId)
            .gte('data_pagamento', primeiroDia)
            .lte('data_pagamento', ultimoDia)
            .order('created_at', { ascending: false });

        if (txError) throw txError;

        // Calcular Saldo Dinâmico
        let total = 0;
        txList.forEach(t => {
            if (t.tipo === 'entrada') total += Number(t.valor);
            else total -= Number(t.valor);
        });

        document.getElementById('dash-total-balance').innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);

        renderDashboardList(txList);
        renderFullHistoryList(txList);
        await refreshGoalsWidget();

    } catch (err) {
        showToast(err.message, "error");
    }
}

function renderDashboardList(transactions) {
    const container = document.getElementById('dash-recent-list');
    container.innerHTML = '';

    if (transactions.length === 0) {
        container.innerHTML = `<span class="widget-meta-title" style="text-align:center; display:block;">Nenhuma transação cadastrada este mês.</span>`;
        return;
    }

    // Exibe apenas as 5 primeiras no dashboard inicial
    transactions.slice(0, 5).forEach(tx => {
        const marca = aplicarEstiloMarca(tx.descricao);
        const dotClasse = tx.cadastrado_por.toLowerCase() === 'ana' ? 'dot-ana' : 'dot-marco';
        const valorSinal = tx.tipo === 'saida' ? `-R$ ${Math.abs(tx.valor).toFixed(2)}` : `+R$ ${tx.valor.toFixed(2)}`;
        const valorClasse = tx.tipo === 'entrada' ? 'amount-incoming' : 'amount-outgoing';

        const item = document.createElement('div');
        item.className = 'transaction-item';
        item.innerHTML = `
            <div class="tx-row-left">
                <div class="tx-avatar-brand ${marca.classe}">${marca.logo}</div>
                <div class="tx-info-block">
                    <span class="tx-title-name">${tx.descricao}</span>
                    <span class="tx-subtitle-meta">
                        <span class="user-dot ${dotClasse}"></span> ${tx.categoria}
                    </span>
                </div>
            </div>
            <div class="tx-row-right">
                <span class="tx-amount-value ${valorClasse}">${valorSinal}</span>
                <span class="tx-date-label">${new Date(tx.data_pagamento).toLocaleDateString('pt-BR', {day: 'numeric', month: 'short'})}</span>
            </div>
        `;
        item.addEventListener('click', () => abrirDetalhesFatura(tx));
        container.appendChild(item);
    });
}

function renderFullHistoryList(transactions) {
    const container = document.getElementById('full-transactions-list');
    container.innerHTML = '';

    transactions.forEach(tx => {
        const marca = aplicarEstiloMarca(tx.descricao);
        const dotClasse = tx.cadastrado_por.toLowerCase() === 'ana' ? 'dot-ana' : 'dot-marco';
        const valorSinal = tx.tipo === 'saida' ? `-R$ ${Math.abs(tx.valor).toFixed(2)}` : `+R$ ${tx.valor.toFixed(2)}`;
        const valorClasse = tx.tipo === 'entrada' ? 'amount-incoming' : 'amount-outgoing';

        const item = document.createElement('div');
        item.className = 'transaction-item';
        item.innerHTML = `
            <div class="tx-row-left">
                <div class="tx-avatar-brand ${marca.classe}">${marca.logo}</div>
                <div class="tx-info-block">
                    <span class="tx-title-name">${tx.descricao}</span>
                    <span class="tx-subtitle-meta">
                        <span class="user-dot ${dotClasse}"></span> ${tx.categoria} (${tx.cadastrado_por})
                    </span>
                </div>
            </div>
            <div class="tx-row-right">
                <span class="tx-amount-value ${valorClasse}">${valorSinal}</span>
                <span class="tx-date-label">${new Date(tx.data_pagamento).toLocaleDateString('pt-BR', {day:'numeric', month:'numeric'})}</span>
            </div>
        `;
        item.addEventListener('click', () => abrirDetalhesFatura(tx));
        container.appendChild(item);
    });
}

// Lógica da Tela de Detalhes da Fatura (Ecrã 2 do seu Mockup)
function abrirDetalhesFatura(tx) {
    const marca = aplicarEstiloMarca(tx.descricao);
    
    // Alterna visibilidade escondendo a view ativa
    document.querySelectorAll('.spa-view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-tx-detail').classList.remove('hidden');

    document.getElementById('detail-nome-estabelecimento').innerText = tx.descricao;
    document.getElementById('detail-valor').innerText = tx.tipo === 'saida' ? `-R$ ${Math.abs(tx.valor).toFixed(2)}` : `+R$ ${tx.valor.toFixed(2)}`;
    document.getElementById('detail-avatar').className = `detail-brand-lg ${marca.classe}`;
    document.getElementById('detail-avatar').innerText = marca.logo;
    
    document.getElementById('detail-cartao').innerText = tx.cartao_info || 'Sem cartão vinculado';
    document.getElementById('detail-tipo').innerText = tx.categoria;
    document.getElementById('detail-id-tx').innerText = tx.id.split('-')[0].toUpperCase(); // Exibe pedaço do UUID como Nº ID
    document.getElementById('detail-status').innerText = tx.status || 'Confirmado';
    
    const dotColor = tx.cadastrado_por.toLowerCase() === 'ana' ? 'dot-ana' : 'dot-marco';
    document.getElementById('detail-autor').innerHTML = `<span class="user-dot ${dotColor}"></span> ${tx.cadastrado_por}`;
    document.getElementById('detail-parcelas').innerText = `${tx.parcela_atual}/${tx.parcela_total} ${tx.parcela_total > 1 ? `(Restam ${tx.parcela_total - tx.parcela_current} faturas)` : ''}`;
}

document.getElementById('btn-back-to-dash').addEventListener('click', () => {
    document.getElementById('view-tx-detail').classList.add('hidden');
    document.getElementById(`view-${appState.viewAtiva}`).classList.remove('hidden');
});

// ─── MUTATIONS (INSERÇÃO DE DADOS) ───────────────────────────────────

// Ativação do painel de Nova Transação (Plus)
document.querySelectorAll('.btn-action-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const type = e.target.getAttribute('data-type');
        abrirFormTransacao(type);
    });
});
document.getElementById('nav-direct-plus-btn').addEventListener('click', () => abrirFormTransacao('saida'));

function abrirFormTransacao(type) {
    appState.viewAtiva = 'add-tx';
    document.querySelectorAll('.spa-view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-add-tx').classList.remove('hidden');
    document.getElementById('form-tx-type').value = type;
    document.getElementById('add-tx-title').innerText = type === 'saida' ? 'Adicionar Nova Saída' : 'Adicionar Nova Entrada';
}

document.getElementById('btn-cancel-tx-form').addEventListener('click', () => {
    appState.viewAtiva = 'dashboard';
    document.getElementById('view-add-tx').classList.add('hidden');
    document.getElementById('view-dashboard').classList.remove('hidden');
});

// Envio do formulário de transação para o Supabase
document.getElementById('tx-mutation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const descricao = document.getElementById('form-tx-desc').value;
    const valor = Number(document.getElementById('form-tx-value').value);
    const categoria = document.getElementById('form-tx-cat').value;
    const tipo = document.getElementById('form-tx-type').value;
    const cartao_info = document.getElementById('form-tx-card').value;
    const parcela_atual = Number(document.getElementById('form-tx-part-current').value);
    const parcela_total = Number(document.getElementById('form-tx-part-total').value);

    try {
        const { error } = await supabase.from('transactions').insert([{
            couple_id: appState.coupleId,
            cadastrado_por: appState.profile.nome,
            descricao,
            categoria,
            tipo,
            valor,
            cartao_info,
            parcela_current: parcela_atual,
            parcela_total
        }]);

        if (error) throw error;

        showToast("Transação lançada!", "success");
        document.getElementById('tx-mutation-form').reset();
        
        // Retorna ao Dashboard
        appState.viewAtiva = 'dashboard';
        document.getElementById('view-add-tx').classList.add('hidden');
        document.getElementById('view-dashboard').classList.remove('hidden');
        refreshAllViews();
    } catch (err) {
        showToast(err.message, "error");
    }
});

// ─── GESTÃO DE METAS ─────────────────────────────────────────────────

document.getElementById('goal-creation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('goal-name-input').value;
    const valor_total = Number(document.getElementById('goal-value-input').value);

    try {
        const { error } = await supabase.from('goals').insert([{
            couple_id: appState.coupleId,
            nome,
            valor_total,
            valor_guardado: 0
        }]);
        if (error) throw error;

        showToast("Meta criada!", "success");
        document.getElementById('goal-creation-form').reset();
        refreshAllViews();
    } catch (err) {
        showToast(err.message, "error");
    }
});

async function refreshGoalsWidget() {
    try {
        const { data: metas, error } = await supabase.from('goals').select('*').eq('couple_id', appState.coupleId).limit(1);
        if (error) throw error;

        if (metas && metas.length > 0) {
            const m = metas[0];
            const pct = m.valor_total > 0 ? Math.min(Math.round((m.valor_guardado / m.valor_total) * 100), 100) : 0;
            
            document.getElementById('lbl-widget-goal-name').innerText = m.nome;
            document.getElementById('lbl-widget-goal-percent').innerText = `${pct}% concluída`;
            document.getElementById('bar-widget-goal-fill').style.width = `${pct}%`;
            
            // Renderiza também na aba interna de metas
            const containerAb = document.getElementById('main-goals-container');
            containerAb.innerHTML = `
                <div class="goals-widget-card" style="background:var(--bg-card)">
                    <div class="goal-progress-row">
                        <span>🎯 ${m.nome}</span>
                        <span>${m.valor_guardado} / ${m.valor_total} Pts</span>
                    </div>
                    <div class="goal-progress-bar-bg" style="margin-top:8px; height:8px;"><div class="goal-progress-bar-fill" style="width:${pct}%;"></div></div>
                </div>
            `;
        }
    } catch (err) {
        console.log("Erro ao carregar widget de metas:", err.message);
    }
}

// ─── COMPONENTES AUXILIARES & NAVEGAÇÃO ──────────────────────────────

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerText = message;
    container.appendChild(t);
    setTimeout(() => { t.remove(); }, 3500);
}

// Controle de cliques nas abas inferiores (Bottom Nav)
document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (e.currentTarget.id === 'nav-direct-plus-btn') return; // Ignora o plus que já tem lógica própria

        const targetView = e.currentTarget.getAttribute('data-view');
        appState.viewAtiva = targetView;
        
        document.querySelectorAll('.bottom-nav .nav-item').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        document.querySelectorAll('.spa-view').forEach(view => view.classList.add('hidden'));
        document.getElementById(`view-${targetView}`).classList.remove('hidden');
    });
});

// Navegação de Meses
document.getElementById('prev-month-btn').addEventListener('click', () => {
    appState.mesAtual.setMonth(appState.mesAtual.getMonth() - 1);
    refreshAllViews();
});
document.getElementById('next-month-btn').addEventListener('click', () => {
    appState.mesAtual.setMonth(appState.mesAtual.getMonth() + 1);
    refreshAllViews();
});

// Botão de Logout
document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    appState.user = null;
    appState.coupleId = null;
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    showToast("Sessão encerrada.", "info");
});

// INIT VERIFICATION (Auto-Login se houver sessão ativa)
async function verificarSessaoAtiva() {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
        bootstrapSession(data.session.user);
    }
}
verificarSessaoAtiva();