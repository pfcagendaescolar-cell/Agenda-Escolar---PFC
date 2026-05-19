/**
 * AGENDA ACADÊMICA DIGITAL IFPR - PAINEL ADMIN
 * Gerencia turmas + eventos (por turma e gerais)
 */

// ✅ CORREÇÃO: API_BASE sempre é localhost:3000
const API_BASE = 'http://localhost:3000';

// =============================
// ESTADO GLOBAL
// =============================
const safeParse = (key, fallback = null) => {
    const val = localStorage.getItem(key);
    if (!val || val === 'undefined') return fallback;
    try {
        return JSON.parse(val);
    } catch (e) {
        return fallback;
    }
};

let turmas = []; // Carregado via API
let turmaEditandoEventos = safeParse('admin_turma_editando', null);
let eventoEditandoId = null;
let contatos = [];
let contatoEditandoId = null;
let currentUser = safeParse('ifpr_user_logged', null);
let currentTab = localStorage.getItem('admin_current_tab') || 'turmas';

// ✅ NOVO: Helper para obter headers de autenticação
function obterHeadersAutenticacaoAdmin() {
    const headers = {
        'Content-Type': 'application/json'
    };

    const token = currentUser?.token || localStorage.getItem('ifpr_auth_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (currentUser && currentUser.email) {
        headers['X-Usuario-Email'] = currentUser.email;
        headers['X-Usuario-Role'] = currentUser.role || 'admin';
        
        // ✅ Enviar X-Usuario-Turma para líderes
        if (currentUser.role === 'turma_admin' && currentUser._id) {
            headers['X-Usuario-Turma'] = currentUser._id;
        }
        
        // Só admin precisa de X-Admin-Auth
        if (currentUser.role === 'admin') {
            headers['X-Admin-Auth'] = true;
        }
    }

    return headers;
}

// =============================
// VERIFICAÇÃO DE LOGIN E DASHBOARD
// =============================
function verificarAutenticacao() {
    const loginSection = document.getElementById('adminLoginSection');
    const dashboardSection = document.getElementById('adminDashboardSection');
    const userInfoHeader = document.getElementById('userInfoHeader');
    const adminNavBar = document.getElementById('adminNavBar');

    if (!currentUser) {
        // ✅ Sem usuario: mostrar login (não redirecionar!)
        if (loginSection) loginSection.style.display = 'block';
        if (dashboardSection) dashboardSection.style.display = 'none';
        return;
    }

    // BLOQUEIO DE SEGURANÇA: Apenas Admins reais podem ver o painel
    if (currentUser.role !== 'admin') {
        alert("Acesso Negado: Apenas administradores podem acessar o painel administrativo.");
        localStorage.removeItem('ifpr_user_logged');
        // ✅ Mostrar tela de login novamente (não redirecionar para index)
        currentUser = null;
        window.location.reload();
        return;
    }

    // ✅ Se é admin válido: mostrar dashboard
    if (loginSection) loginSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'block';
    if (userInfoHeader) userInfoHeader.style.display = 'flex';
    if (adminNavBar) adminNavBar.style.display = 'block';

    if (document.getElementById('adminUserName')) {
        document.getElementById('adminUserName').innerText = currentUser.nome;
    }
    if (document.getElementById('adminUserRole')) {
        document.getElementById('adminUserRole').innerText = currentUser.cargo === 'principal' ? 'Administrador Principal' : 'Administrador';
    }

    if (currentUser.cargo === 'principal' && document.getElementById('tabAdmins')) {
        document.getElementById('tabAdmins').style.display = 'block';
    }
}

// =============================
// INICIALIZAÇÃO E SEGURANÇA
// =============================
document.addEventListener('DOMContentLoaded', () => {
    // ✅ CORREÇÃO: NÃO redirecionar automaticamente ao abrir admin.html
    // Se o usuário estiver logado, mostrar dashboard; caso contrário, mostrar login
    if (currentUser) {
        // Se já está logado, verificar se é admin e mostrar dashboard
        verificarAutenticacao();
        
        // Restaurar estado da Aba e Turma se logado
        const tabToRestore = document.querySelector(`.admin-tab-btn[data-tab="${currentTab}"]`);
        if (tabToRestore) {
            tabToRestore.click();
        }

        // Se estava editando eventos de uma turma, restaurar essa visão
        if (currentTab === 'turmas' && turmaEditandoEventos) {
            const index = turmas.findIndex(t => t.id === turmaEditandoEventos.id);
            if (index !== -1) {
                abrirEventosDaTurma(index);
            } else {
                turmaEditandoEventos = null;
                localStorage.removeItem('admin_turma_editando');
            }
        }

        // Inicializar carregamento de dados
        carregarTurmasAdmin();
    } else {
        // Se NÃO está logado, mostrar tela de login (não redirecionar!)
        const loginSection = document.getElementById('adminLoginSection');
        const dashboardSection = document.getElementById('adminDashboardSection');
        if (loginSection) loginSection.style.display = 'block';
        if (dashboardSection) dashboardSection.style.display = 'none';
    }

    // Lógica de Log-out (Fix: Captura todos os botões de logout)
    document.querySelectorAll('.btn-logout-action').forEach(btn => {
        btn.onclick = () => {
            if (confirm('Deseja realmente sair?')) {
                currentUser = null;
                // Limpa dados de login em todos os armazenamentos
                localStorage.removeItem('admin_user');
                localStorage.removeItem('ifpr_user_logged');
                localStorage.removeItem('admin_turma_editando');
                localStorage.removeItem('admin_current_tab');

                sessionStorage.removeItem('admin_user');
                sessionStorage.removeItem('ifpr_user_logged');
                sessionStorage.removeItem('usuarioLogado');

                // Recarregar a página pra mostrar login novamente
                window.location.reload();
            }
        };
    });
});

// =============================
// LÓGICA DE AUTH (LOGIN / REGISTRO)
// =============================

window.switchAuthTab = (tab) => {
    document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
    document.getElementById('tabRegister').classList.toggle('active', tab === 'register');

    document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('recoverForm').style.display = tab === 'recover' ? 'block' : 'none';

    document.getElementById('authMessage').style.display = 'none';
};

function showAuthMessage(msg, type) {
    const box = document.getElementById('authMessage');
    box.innerText = msg;
    box.className = `message-box message-${type}`;
    box.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const res = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, senha: password })
                });

                const data = await res.json();
                if (res.ok) {
                    currentUser = data.user;
                    currentUser.token = data.token;
                    // ✅ CORREÇÃO: Usar a mesma chave em todos os lugares
                    localStorage.setItem('ifpr_user_logged', JSON.stringify(currentUser));
                    localStorage.setItem('ifpr_auth_token', data.token);
                    verificarAutenticacao();
                    // Ativa a aba salva
                    const btn = document.querySelector(`.admin-tab-btn[data-tab="${currentTab}"]`);
                    if (btn) btn.click();
                } else {
                    showAuthMessage(data.error || 'Erro ao logar', 'error');
                }
            } catch (err) {
                showAuthMessage('Erro de conexão com o servidor', 'error');
            }
        };
    }
});

// LÓGICA DE REGISTRO
document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const nome = document.getElementById('regNome').value;
            const email = document.getElementById('regEmail').value;
            const emailConfirm = document.getElementById('regEmailConfirm').value;
            const password = document.getElementById('regPassword').value;

            if (email !== emailConfirm) {
                return showAuthMessage('Os e-mails informados não coincidem.', 'error');
            }

            try {
                const res = await fetch(`${API_BASE}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome, email, senha: password })
                });

                const data = await res.json();
                if (res.ok) {
                    showAuthMessage(data.message || 'Solicitação enviada! Aguarde aprovação.', 'success');
                    registerForm.reset();
                    setTimeout(() => switchAuthTab('login'), 3000);
                } else {
                    showAuthMessage(data.error || 'Erro ao cadastrar', 'error');
                }
            } catch (err) {
                showAuthMessage('Erro de conexão com o servidor', 'error');
            }
        };
    }
});

// LÓGICA DE RECUPERAÇÃO (PRINCIPAL)
document.addEventListener('DOMContentLoaded', () => {
    const recoverForm = document.getElementById('recoverForm');
    if (recoverForm) {
        recoverForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('recoverEmail').value;
            const recoveryCode = document.getElementById('recoverCodeInput').value;
            const novaSenha = document.getElementById('recoverNewPass').value;

            try {
                const res = await fetch(`${API_BASE}/auth/recover-principal`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, recoveryCode, novaSenha })
                });

                const data = await res.json();
                if (res.ok) {
                    alert('Senha redefinida com sucesso! Você já pode logar.');
                    switchAuthTab('login');
                    recoverForm.reset();
                } else {
                    showAuthMessage(data.error || 'Erro na recuperação', 'error');
                }
            } catch (err) {
                showAuthMessage('Erro de conexão', 'error');
            }
        };
    }
});



// Lógica de navegação entre abas (re-inicializada no carregamento do DOM)
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.onclick = () => {
            const tab = btn.getAttribute('data-tab');

            // UI das abas
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // UI das seções
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));

            let secId = '';
            if (tab === 'turmas') secId = 'secTurmas';
            else if (tab === 'geral') secId = 'secGeral';
            else if (tab === 'contatos') secId = 'secContatos';
            else if (tab === 'admins') secId = 'secAdmins';
            else if (tab === 'conta') secId = 'secConta';

            const section = document.getElementById(secId);
            if (section) {
                section.classList.add('active');
            }

            currentTab = tab;
            localStorage.setItem('admin_current_tab', tab);

            if (tab === 'turmas' && !turmaEditandoEventos) {
                const subLista = document.getElementById('subListaTurmas');
                const subEventos = document.getElementById('subEventosTurma');
                if (subLista) subLista.style.display = 'block';
                if (subEventos) subEventos.style.display = 'none';
            }

            if (tab === 'geral') carregarEventosGerais();
            if (tab === 'contatos') carregarContatosAdmin();
            if (tab === 'admins') carregarAdministradores();
            if (tab === 'conta') carregarMinhaConta();
        };
    });

    // Mobile menu toggle for admin navigation
    const adminMenuButton = document.getElementById('adminMenuButton');
    const adminTabsNav = document.querySelector('.admin-tabs-nav');

    const toggleAdminMobileMenu = (open) => {
        if (!adminTabsNav || !adminMenuButton) return;
        adminTabsNav.classList.toggle('open', open);
        adminMenuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    adminMenuButton?.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleAdminMobileMenu(!adminTabsNav.classList.contains('open'));
    });

    document.addEventListener('click', (event) => {
        if (!adminTabsNav || !adminMenuButton) return;
        if (!adminTabsNav.contains(event.target) && !adminMenuButton.contains(event.target)) {
            toggleAdminMobileMenu(false);
        }
    });

    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleAdminMobileMenu(false));
    });

    // Se logado, garante que a aba correta está ativa
    if (currentUser) {
        const target = document.querySelector(`.admin-tab-btn[data-tab="${currentTab}"]`);
        if (target) target.click();
    }
});

// Código removido - redundant with earlier restoration logic

// =============================
// CARREGAR TURMAS DO SERVIDOR
// =============================
async function carregarTurmasAdmin() {
    try {
        const res = await fetch(`${API_BASE}/turmas`);
        if (!res.ok) throw new Error('Erro ao buscar turmas');
        turmas = await res.json();
        renderizarTurmas();
    } catch (err) {
        console.error("Erro ao carregar turmas:", err);
    }
}

// =============================
// RENDERIZAÇÃO DE TURMAS
// =============================
async function renderizarTurmas() {
    const lista = document.getElementById('turmasList');
    if (!lista) return;
    lista.innerHTML = '';

    if (turmas.length === 0) {
        lista.innerHTML = '<p class="empty-msg">Nenhuma turma cadastrada.</p>';
        return;
    }

    turmas.forEach((turma, index) => {
        const card = document.createElement('div');
        card.className = 'turma-card';

        const tId = turma.id || index;

        card.onclick = () => window.abrirModalVisualizarTurma(tId);

        card.innerHTML = `
            <div class="turma-header">
                <h3>${turma.nome}</h3>
                <span style="font-size:0.8rem; background:var(--primary); color:white; padding:3px 8px; border-radius:12px;">${turma.ano}</span>
            </div>
            <div class="turma-info">
                <p><strong>Curso:</strong> ${turma.curso}</p>
            </div>
        `;

        lista.appendChild(card);
    });
}

// =============================
// MODAL DE VISUALIZAÇÃO DE TURMA
// =============================
window.abrirModalVisualizarTurma = (id) => {
    const t = turmas.find(item => item.id == id);
    if (!t) return;

    const modal = document.getElementById('turmaViewModal');
    const content = document.getElementById('turmaViewContent');

    content.innerHTML = `
        <div class="info-row"><strong>Turma:</strong> ${t.nome}</div>
        <div class="info-row"><strong>Ano:</strong> ${t.ano}</div>
        <div class="info-row"><strong>Curso:</strong> ${t.curso}</div>
        <hr style="margin: 15px 0; border: none; border-top: 1px dashed var(--border);">
        <div class="info-row"><strong>Líder:</strong> ${t.lider.nome}</div>
        <div class="info-row"><strong>Vice-Líder:</strong> ${t.vice.nome}</div>
    `;

    // Configurar botões no rodapé do modal
    document.getElementById('btnViewEdit').onclick = () => {
        modal.style.display = 'none';
        window.abrirModalEdicaoTurma(id);
    };

    document.getElementById('btnViewDelete').onclick = () => {
        if (confirm(`Tem certeza que deseja excluir a turma ${t.nome}?`)) {
            modal.style.display = 'none';
            window.excluirTurma(id);
        }
    };

    document.getElementById('btnViewEventos').onclick = () => {
        modal.style.display = 'none';
        window.abrirEventosDaTurma(id);
    };

    modal.style.display = 'flex';
};

document.getElementById('closeTurmaViewModal').onclick = () => {
    document.getElementById('turmaViewModal').style.display = 'none';
};

// =============================
// MODAL DE TURMA (CRIAR / EDITAR)
// =============================
let turmaModal, turmaForm;
document.addEventListener('DOMContentLoaded', () => {
    turmaModal = document.getElementById('turmaModal');
    turmaForm = document.getElementById('turmaForm');

    const btnNovaTurma = document.getElementById('btnNovaTurma');
    if (btnNovaTurma) {
        btnNovaTurma.onclick = () => {
            if (turmaForm) turmaForm.reset();
            document.getElementById('turmaId').value = '';
            document.getElementById('modalTurmaTitle').innerText = 'Nova Turma';
            if (turmaModal) turmaModal.style.display = 'flex';
        };
    }

    const closeTurmaModal = document.getElementById('closeTurmaModal');
    if (closeTurmaModal) {
        closeTurmaModal.onclick = () => {
            if (turmaModal) turmaModal.style.display = 'none';
        };
    }
});

window.abrirModalEdicaoTurma = (id) => {
    const t = turmas.find(item => item.id == id);
    if (!t) return;

    document.getElementById('turmaId').value = id;
    document.getElementById('modalTurmaTitle').innerText = 'Editar Turma';

    document.getElementById('tNome').value = t.nome;
    document.getElementById('tCurso').value = t.curso;
    document.getElementById('tAno').value = t.ano;

    document.getElementById('liderNome').value = t.lider.nome;
    document.getElementById('liderEmail').value = t.lider.email;
    document.getElementById('liderSenha').value = t.lider.senha;

    document.getElementById('viceNome').value = t.vice.nome;
    document.getElementById('viceEmail').value = t.vice.email;
    document.getElementById('viceSenha').value = t.vice.senha;

    if (turmaModal) turmaModal.style.display = 'flex';
};

document.addEventListener('DOMContentLoaded', () => {
    const tf = document.getElementById('turmaForm');
    if (tf) {
        tf.onsubmit = async (e) => {
            e.preventDefault();

            const id = document.getElementById('turmaId').value;
            const turmaObj = {
                nome: document.getElementById('tNome').value.trim(),
                curso: document.getElementById('tCurso').value.trim(),
                ano: document.getElementById('tAno').value.trim(),
                lider: {
                    nome: document.getElementById('liderNome').value.trim(),
                    email: document.getElementById('liderEmail').value.trim().toLowerCase(),
                    senha: document.getElementById('liderSenha').value.trim()
                },
                vice: {
                    nome: document.getElementById('viceNome').value.trim(),
                    email: document.getElementById('viceEmail').value.trim().toLowerCase(),
                    senha: document.getElementById('viceSenha').value.trim()
                }
            };

            try {
                if (id !== '') {
                    // Update
                    turmaObj.id = id;
                    await fetch(`${API_BASE}/turmas/${id}`, {
                        method: 'PUT',
                        headers: obterHeadersAutenticacaoAdmin(),
                        body: JSON.stringify(turmaObj)
                    });
                } else {
                    // Create
                    await fetch(`${API_BASE}/turmas`, {
                        method: 'POST',
                        headers: obterHeadersAutenticacaoAdmin(),
                        body: JSON.stringify(turmaObj)
                    });
                }

                if (turmaModal) turmaModal.style.display = 'none';
                carregarTurmasAdmin();
            } catch (err) {
                console.error("Erro ao salvar turma:", err);
                alert("Erro ao salvar turma no servidor.");
            }
        };
    }
});

window.excluirTurma = async (id) => {
    if (confirm("Tem certeza que deseja excluir esta turma?")) {
        try {
            await fetch(`${API_BASE}/turmas/${id}`, { method: 'DELETE', headers: obterHeadersAutenticacaoAdmin() });
            carregarTurmasAdmin();
        } catch (err) {
            console.error(err);
        }
    }
};

// =============================
// EVENTOS DE TURMA
// =============================
window.abrirEventosDaTurma = (id) => {
    turmaEditandoEventos = turmas.find(t => t.id == id);
    localStorage.setItem('admin_turma_editando', JSON.stringify(turmaEditandoEventos));
    document.getElementById('eventosTurmaNome').innerText = turmaEditandoEventos.nome;

    // Alterna sub-telas
    document.getElementById('subListaTurmas').style.display = 'none';
    document.getElementById('subEventosTurma').style.display = 'block';

    carregarEventosDaTurma();
};

document.getElementById('btnVoltarListaTurmas').onclick = () => {
    turmaEditandoEventos = null;
    localStorage.removeItem('admin_turma_editando');
    document.getElementById('subListaTurmas').style.display = 'block';
    document.getElementById('subEventosTurma').style.display = 'none';
};

async function carregarEventosDaTurma() {
    const container = document.getElementById('eventosListaTurma');
    container.innerHTML = '<p class="empty-msg">Carregando...</p>';

    try {
        const res = await fetch(`${API_BASE}/eventos/turma/${turmaEditandoEventos.id}`);
        const eventos = await res.json();
        renderizarListaEventos(container, eventos);
    } catch (err) {
        container.innerHTML = '<p class="empty-msg">Erro ao carregar eventos.</p>';
        console.error(err);
    }
}

// =============================
// EVENTOS GERAIS
// =============================
async function carregarEventosGerais() {
    const container = document.getElementById('eventosListaGeral');
    container.innerHTML = '<p class="empty-msg">Carregando...</p>';

    try {
        const res = await fetch(`${API_BASE}/eventos/geral`);

        if (!res.ok) {
            console.error(`Status erro: ${res.status}`);
            throw new Error(`Erro ao buscar eventos gerais (Status: ${res.status})`);
        }

        const texto = await res.text();
        let eventos = [];
        try {
            eventos = JSON.parse(texto);
        } catch (e) {
            console.error("Servidor não retornou JSON válido:", texto.substring(0, 100));
            throw new Error("O servidor retornou um formato inválido. Tente reiniciar o node server.js.");
        }

        renderizarListaEventos(container, eventos);
    } catch (err) {
        container.innerHTML = `<p class="empty-msg" style="color:red;">❌ ${err.message}</p>`;
        console.error(err);
    }
}

// =============================
// RENDERIZAÇÃO DE LISTA DE EVENTOS
// =============================
function renderizarListaEventos(container, eventos) {
    container.innerHTML = '';

    if (eventos.length === 0) {
        container.innerHTML = '<p class="empty-msg">Nenhum evento cadastrado.</p>';
        return;
    }

    // Ordena por data
    eventos.sort((a, b) => (a.data || '').localeCompare(b.data || ''));

    eventos.forEach(ev => {
        const catLow = (ev.categoria || ev.tipo || '').toLowerCase();
        const card = document.createElement('div');
        card.className = `evento-card evento-cat-${catLow}`;

        const dataFormatada = ev.data ? ev.data.split('-').reverse().join('/') : '—';

        card.innerHTML = `
            <div class="evento-card-info">
                <strong>${ev.titulo}</strong>
                <small>${dataFormatada} · ${ev.hora || '--:--'} · ${(ev.categoria || '').toUpperCase()}</small>
                ${ev.descricao ? `<p style="font-size:0.85rem; opacity:0.8; margin-top:8px; line-height:1.4;">${ev.descricao}</p>` : ''}
            </div>
            <div class="evento-card-actions">
                <button title="Editar" onclick="abrirModalEditarEvento('${ev._id}')">✏️</button>
                <button title="Excluir" onclick="excluirEvento('${ev._id}')">🗑️</button>
            </div>
        `;

        container.appendChild(card);
    });
}

// =============================
// MODAL DE EVENTO (CRIAR / EDITAR)
// =============================
let eventoModal, eventoForm;
document.addEventListener('DOMContentLoaded', () => {
    eventoModal = document.getElementById('eventoModal');
    eventoForm = document.getElementById('eventoForm');

    // Botão "+ Novo Evento" para turma
    const btnNovoEventoTurma = document.getElementById('btnNovoEventoTurma');
    if (btnNovoEventoTurma) {
        btnNovoEventoTurma.onclick = () => {
            if (eventoForm) eventoForm.reset();
            eventoEditandoId = null;
            document.getElementById('eventoId').value = '';
            document.getElementById('eventoTurmaId').value = turmaEditandoEventos.id;
            document.getElementById('modalEventoTitle').innerText = `Novo Evento – ${turmaEditandoEventos.nome}`;
            if (eventoModal) eventoModal.style.display = 'flex';
        };
    }

    // Botão "+ Novo Evento Geral"
    const btnNovoEventoGeral = document.getElementById('btnNovoEventoGeral');
    if (btnNovoEventoGeral) {
        btnNovoEventoGeral.onclick = () => {
            if (eventoForm) eventoForm.reset();
            eventoEditandoId = null;
            document.getElementById('eventoId').value = '';
            document.getElementById('eventoTurmaId').value = '__geral__';
            document.getElementById('modalEventoTitle').innerText = 'Novo Evento Geral';
            if (eventoModal) eventoModal.style.display = 'flex';
        };
    }

    const closeEventoModal = document.getElementById('closeEventoModal');
    if (closeEventoModal) {
        closeEventoModal.onclick = () => {
            if (eventoModal) eventoModal.style.display = 'none';
        };
    }
});

// Editar evento existente
window.abrirModalEditarEvento = async (id) => {
    try {
        const res = await fetch(`${API_BASE}/eventos`);
        const todos = await res.json();
        const ev = todos.find(e => e._id === id);
        if (!ev) return alert('Evento não encontrado.');

        eventoEditandoId = id;
        document.getElementById('eventoId').value = id;
        document.getElementById('eventoTurmaId').value = ev.turmaId;
        document.getElementById('evTitulo').value = ev.titulo;
        document.getElementById('evTipo').value = ev.categoria || ev.tipo;
        document.getElementById('evData').value = ev.data;
        document.getElementById('evHora').value = ev.hora || '';
        document.getElementById('evDescricao').value = ev.descricao || '';
        document.getElementById('modalEventoTitle').innerText = 'Editar Evento';

        eventoModal.style.display = 'flex';
    } catch (err) {
        console.error(err);
        alert('Erro ao buscar evento.');
    }
};

// Submit do formulário de evento (criar ou editar)
document.addEventListener('DOMContentLoaded', () => {
    const ef = document.getElementById('eventoForm');
    if (ef) {
        ef.onsubmit = async (e) => {
            e.preventDefault();

            const turmaId = document.getElementById('eventoTurmaId').value;
            const dados = {
                titulo: document.getElementById('evTitulo').value,
                tipo: turmaId === '__geral__' ? 'geral' : 'turma',
                categoria: document.getElementById('evTipo').value,
                data: document.getElementById('evData').value,
                hora: document.getElementById('evHora').value,
                descricao: document.getElementById('evDescricao').value,
                turmaId: turmaId,
                criadoPor: 'admin',
                usuarioId: (currentUser && currentUser.email) ? currentUser.email : 'admin'
            };

            try {
                const headers = obterHeadersAutenticacaoAdmin();
                let res;

                if (eventoEditandoId) {
                    // Editar
                    res = await fetch(`${API_BASE}/eventos/${eventoEditandoId}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify(dados)
                    });
                } else {
                    // Criar
                    res = await fetch(`${API_BASE}/eventos`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(dados)
                    });
                }

                if (!res.ok) {
                    const erro = await res.json();
                    throw new Error(erro.error || 'Erro ao salvar evento');
                }

                if (eventoModal) eventoModal.style.display = 'none';
                eventoEditandoId = null;

                // Recarrega a lista correspondente
                if (turmaId === '__geral__') {
                    carregarEventosGerais();
                } else {
                    carregarEventosDaTurma();
                }
            } catch (err) {
                console.error(err);
                alert(`Erro ao salvar evento: ${err.message}`);
            }
        };
    }
});

// Excluir evento
window.excluirEvento = async (id) => {
    if (!confirm('Deseja realmente excluir este evento?')) return;

    try {
        const headers = obterHeadersAutenticacaoAdmin();
        
        const res = await fetch(`${API_BASE}/eventos/${id}`, { 
            method: 'DELETE',
            headers
        });

        if (!res.ok) {
            const erro = await res.json();
            throw new Error(erro.error || 'Erro ao deletar evento');
        }

        // Recarrega a lista ativa
        if (turmaEditandoEventos) {
            carregarEventosDaTurma();
        } else {
            carregarEventosGerais();
        }

        // Se estiver na aba geral, recarrega também
        const secGeral = document.getElementById('secGeral');
        if (secGeral.classList.contains('active')) {
            carregarEventosGerais();
        }
    } catch (err) {
        console.error(err);
        alert(`Erro ao excluir evento: ${err.message}`);
    }
};

// =============================
// GERENCIAMENTO DE CONTATOS
// =============================

// Carregar contatos do servidor ou localStorage
async function carregarContatosAdmin() {
    try {
        const response = await fetch(`${API_BASE}/contatos`);
        if (!response.ok) throw new Error('Erro ao buscar contatos');
        contatos = await response.json();
        // Sincronizar com localStorage
        localStorage.setItem('ifpr_contatos_v1', JSON.stringify(contatos));
        renderizarContatosAdmin();
    } catch (err) {
        console.error("Erro ao carregar contatos do servidor, usando localStorage:", err);
        // Fallback para localStorage
        try {
            contatos = JSON.parse(localStorage.getItem('ifpr_contatos_v1')) || [];
            renderizarContatosAdmin();
        } catch (e) {
            console.error("Erro ao carregar contatos do localStorage:", e);
            contatos = [];
            renderizarContatosAdmin();
        }
    }
}

// Renderizar lista de contatos
function renderizarContatosAdmin() {
    const lista = document.getElementById('contatosList');
    if (!lista) return;

    lista.innerHTML = '';

    if (contatos.length === 0) {
        lista.innerHTML = '<p class="empty-msg">Nenhum contato cadastrado.</p>';
        return;
    }

    contatos.forEach((contato, index) => {
        const contatoId = contato._id || contato.id || `contato_${index}`;
        const card = document.createElement('div');
        card.className = 'contato-card contato-card-style';

        const telefone = contato.telefone ? `<small style="display:block; margin-top:2px;">📱 ${contato.telefone}</small>` : '';

        card.innerHTML = `
            <div class="evento-card-info">
                <strong>${contato.nome || 'Sem nome'}</strong>
                <small style="display:block; margin-bottom:4px;">${contato.setor || 'Sem setor'}</small>
                <small style="display:block;">📧 ${contato.email || 'Sem email'}</small>
                ${telefone}
                ${contato.descricao ? `<p style="font-size:0.85rem; opacity:0.8; margin-top:8px; line-height:1.4;">${contato.descricao}</p>` : ''}
            </div>
            <div class="evento-card-actions">
                <button onclick="window.editarContatoAdmin('${contatoId}')">✏️</button>
                <button onclick="window.excluirContatoAdmin('${contatoId}')">🗑️</button>
            </div>
        `;

        lista.appendChild(card);
    });
}

// Modal de contato
let contatoModal, contatoForm;
document.addEventListener('DOMContentLoaded', () => {
    contatoModal = document.getElementById('contatoModal');
    contatoForm = document.getElementById('contatoForm');

    const btnNovoContato = document.getElementById('btnNovoContato');
    if (btnNovoContato) {
        btnNovoContato.onclick = () => {
            if (contatoForm) contatoForm.reset();
            document.getElementById('contatoId').value = '';
            document.getElementById('modalContatoTitle').innerText = 'Novo Contato';
            contatoEditandoId = null;
            if (contatoModal) contatoModal.style.display = 'flex';
        };
    }

    const closeContatoModal = document.getElementById('closeContatoModal');
    if (closeContatoModal) {
        closeContatoModal.onclick = () => {
            if (contatoModal) contatoModal.style.display = 'none';
        };
    }
});

// Editar contato
window.editarContatoAdmin = (id) => {
    const contato = contatos.find(c => (c._id === id || c.id === id));
    if (!contato) {
        alert('Contato não encontrado.');
        return;
    }

    document.getElementById('contatoId').value = id;
    document.getElementById('ctNome').value = contato.nome || '';
    document.getElementById('ctSetor').value = contato.setor || '';
    document.getElementById('ctDescricao').value = contato.descricao || '';
    document.getElementById('ctEmail').value = contato.email || '';
    document.getElementById('ctTelefone').value = contato.telefone || '';

    document.getElementById('modalContatoTitle').innerText = 'Editar Contato';
    contatoEditandoId = id;
    contatoModal.style.display = 'flex';
};

// Salvar contato
document.addEventListener('DOMContentLoaded', () => {
    const cf = document.getElementById('contatoForm');
    if (cf) {
        cf.onsubmit = async (e) => {
            e.preventDefault();

            const dados = {
                nome: document.getElementById('ctNome').value,
                setor: document.getElementById('ctSetor').value,
                descricao: document.getElementById('ctDescricao').value,
                email: document.getElementById('ctEmail').value,
                telefone: document.getElementById('ctTelefone').value
            };

            let usandoLocalStorage = false;

            try {
                let url = `${API_BASE}/contatos`;
                let method = 'POST';

                if (contatoEditandoId) {
                    url += `/${contatoEditandoId}`;
                    method = 'PUT';
                }

                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });

                if (!response.ok) throw new Error('Erro ao salvar');

            } catch (err) {
                console.warn("Erro ao salvar no servidor, usando localStorage:", err);
                usandoLocalStorage = true;

                // Fallback para localStorage
                try {
                    if (contatoEditandoId) {
                        // Atualizar contato existente
                        const index = contatos.findIndex(c => c._id === contatoEditandoId);
                        if (index !== -1) {
                            contatos[index] = { ...contatos[index], ...dados };
                        }
                    } else {
                        // Novo contato
                        const novoContato = {
                            _id: 'local_' + Date.now(),
                            ...dados
                        };
                        contatos.push(novoContato);
                    }
                    localStorage.setItem('ifpr_contatos_v1', JSON.stringify(contatos));
                } catch (e) {
                    alert('Erro ao salvar contato no armazenamento local.');
                    console.error(e);
                    return;
                }
            }

            if (contatoModal) contatoModal.style.display = 'none';
            if (cf) cf.reset();
            contatoEditandoId = null;
            carregarContatosAdmin();
            alert(usandoLocalStorage ? 'Contato salvo localmente!' : 'Contato salvo com sucesso!');
        };
    }
});

// Excluir contato
window.excluirContatoAdmin = async (id) => {
    if (!confirm('Deseja realmente excluir este contato?')) return;

    let usandoLocalStorage = false;

    try {
        const response = await fetch(`${API_BASE}/contatos/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Erro ao deletar');

    } catch (err) {
        console.warn("Erro ao excluir do servidor, usando localStorage:", err);
        usandoLocalStorage = true;

        // Fallback para localStorage
        try {
            contatos = contatos.filter(c => c._id !== id);
            localStorage.setItem('ifpr_contatos_v1', JSON.stringify(contatos));
        } catch (e) {
            alert('Erro ao excluir contato do armazenamento local.');
            console.error(e);
            return;
        }
    }

    carregarContatosAdmin();
    alert(usandoLocalStorage ? 'Contato removido do armazenamento local!' : 'Contato removido com sucesso!');
};

// Removido da chamada global - movido para DOMContentLoaded

// =============================
// NAVEGACAO entre TELAS
// =============================

function navigateToAbout(event) {
    if (event) {
        event.preventDefault();
    }

    const adminContainer = document.querySelector('.admin-container');
    const aboutScreen = document.getElementById('aboutScreen');

    if (adminContainer) adminContainer.style.display = 'none';
    if (aboutScreen) aboutScreen.style.display = 'block';

    // Scroll para o topo
    window.scrollTo(0, 0);
}

// =============================
// GERENCIAMENTO DE ADMINS
// =============================

// =============================
// GERENCIAMENTO DE ADMINS
// =============================

async function carregarAdministradores() {
    if (currentUser.cargo !== 'principal') return;

    try {
        const res = await fetch(`${API_BASE}/admins`);
        const admins = await res.json();
        renderizarAdmins(admins);
    } catch (err) {
        console.error('Erro ao carregar admins:', err);
    }
}

function renderizarAdmins(admins) {
    const listAtivos = document.getElementById('adminsAtivosList');
    const listSolicitacoes = document.getElementById('adminsSolicitacoesList');
    const areaSolicitacoes = document.getElementById('areaSolicitacoes');

    if (!listAtivos || !listSolicitacoes) return;

    listAtivos.innerHTML = '';
    listSolicitacoes.innerHTML = '';

    const ativos = admins.filter(a => a.status === 'ativo');
    const pendentes = admins.filter(a => a.status === 'pendente');

    // Renderizar Ativos
    ativos.forEach(admin => {
        const card = document.createElement('div');
        card.className = 'admin-card'; // Usando estilo de card padrão
        card.style.borderLeft = (admin.cargo === 'principal' || admin.role === 'principal') ? '5px solid #ef4444' : '5px solid #32a041';
        card.style.marginBottom = '10px';
        card.style.padding = '15px';

        const cargoLabel = (admin.cargo === 'principal' || admin.role === 'principal') ? 'PRINCIPAL' : 'SECUNDÁRIO';
        const isPrincipal = admin.cargo === 'principal' || admin.role === 'principal';
        const isSelf = admin._id === currentUser._id;

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${admin.nome} ${isSelf ? '(Você)' : ''}</strong><br>
                    <small>${admin.email} · <span style="color: ${isPrincipal ? '#ef4444' : '#32a041'}">${cargoLabel}</span></small>
                </div>
                <div class="evento-card-actions">
                    ${!isPrincipal ? `
                        <button title="Alterar Senha" class="btn-save" style="padding: 5px 8px; font-size: 0.8rem; background: #ed8936;" onclick="resetarSenhaAdmin('${admin._id}', '${admin.nome}')">🔄</button>
                        <button title="Tornar Principal" class="btn-new-turma" style="padding: 5px 8px; font-size: 0.8rem;" onclick="transferirCargoPrincipal('${admin._id}')">👑</button>
                        <button title="Remover" class="btn-delete" style="padding: 5px 8px; font-size: 0.8rem;" onclick="removerAdmin('${admin._id}')">🗑️</button>
                    ` : ''}
                </div>
            </div>
        `;
        listAtivos.appendChild(card);
    });

    // Renderizar Pendentes
    if (pendentes.length > 0) {
        areaSolicitacoes.style.display = 'block';
        pendentes.forEach(admin => {
            const card = document.createElement('div');
            card.className = 'admin-card';
            card.style.borderLeft = '5px solid #f59e0b';
            card.style.marginBottom = '10px';
            card.style.padding = '15px';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${admin.nome}</strong><br>
                        <small>${admin.email} · Aguardando Aprovação</small>
                    </div>
                    <div class="evento-card-actions">
                        <button title="Aprovar" class="btn-save" style="padding: 5px 8px; font-size: 0.8rem;" onclick="aprovarAdmin('${admin._id}')">✅</button>
                        <button title="Recusar" class="btn-delete" style="padding: 5px 8px; font-size: 0.8rem;" onclick="removerAdmin('${admin._id}')">❌</button>
                    </div>
                </div>
            `;
            listSolicitacoes.appendChild(card);
        });
    } else {
        areaSolicitacoes.style.display = 'none';
    }
}

async function aprovarAdmin(id) {
    if (!confirm('Deseja aprovar este administrador?')) return;
    try {
        const res = await fetch(`${API_BASE}/admins/aprovar/${id}`, { method: 'PUT' });
        if (res.ok) {
            alert('Administrador aprovado!');
            carregarAdministradores();
        } else {
            const data = await res.json();
            alert(data.error || 'Erro ao aprovar');
        }
    } catch (err) {
        alert('Erro de conexão');
    }
}

async function removerAdmin(id) {
    if (!confirm('Deseja realmente remover/recusar este administrador?')) return;
    try {
        const res = await fetch(`${API_BASE}/admins/${id}`, { method: 'DELETE' });
        if (res.ok) {
            alert('Removido com sucesso!');
            carregarAdministradores();
        } else {
            const data = await res.json();
            alert(data.error || 'Erro ao remover');
        }
    } catch (err) {
        alert('Erro de conexão');
    }
}

async function transferirCargoPrincipal(id) {
    if (!confirm('Deseja transferir o cargo de Principal para este administrador? Você se tornará um administrador secundário.')) return;
    try {
        const res = await fetch(`${API_BASE}/admins/transferir/${id}`, { method: 'PUT' });
        if (res.ok) {
            alert('Cargo transferido com sucesso!');
            // Atualiza sessão local pois o cargo mudou
            currentUser.cargo = 'secundario';
            localStorage.setItem('admin_user', JSON.stringify(currentUser));
            location.reload(); // Recarrega para aplicar mudanças de permissão
        } else {
            const data = await res.json();
            alert(data.error || 'Erro ao transferir');
        }
    } catch (err) {
        alert('Erro de conexão');
    }
}

function resetarSenhaAdmin(id, nome) {
    const modal = document.getElementById('changeAdminPassModal');
    if (!modal) return;

    document.getElementById('changePassAdminId').value = id;
    document.getElementById('changePassAdminNome').innerText = nome;
    document.getElementById('adminNovaSenha').value = '';

    modal.style.display = 'block';
}

// Lógica para confirmar a troca de senha de outro admin pelo Principal
const formChangeAdminPass = document.getElementById('formChangeAdminPass');
if (formChangeAdminPass) {
    formChangeAdminPass.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('changePassAdminId').value;
        const novaSenha = document.getElementById('adminNovaSenha').value;

        try {
            const res = await fetch(`${API_BASE}/auth/admins/reset-password/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ novaSenha })
            });

            const data = await res.json();
            if (res.ok) {
                alert(data.message || 'Senha alterada com sucesso!');
                document.getElementById('changeAdminPassModal').style.display = 'none';
                formChangeAdminPass.reset();
            } else {
                alert(data.error || 'Erro ao alterar senha');
            }
        } catch (err) {
            alert('Erro de conexão ao alterar senha');
        }
    };
}

// Exportar para o escopo global para uso em onclick
window.aprovarAdmin = aprovarAdmin;
window.removerAdmin = removerAdmin;
window.transferirCargoPrincipal = transferirCargoPrincipal;
window.resetarSenhaAdmin = resetarSenhaAdmin;

function navigateToHome(event) {
    if (event) {
        event.preventDefault();
    }

    const adminContainer = document.querySelector('.admin-container');
    const aboutScreen = document.getElementById('aboutScreen');

    if (aboutScreen) aboutScreen.style.display = 'none';
    if (adminContainer) adminContainer.style.display = 'block';

    // Scroll para o topo
    window.scrollTo(0, 0);
}

// =============================
// LÓGICA: MINHA CONTA
// =============================
function carregarMinhaConta() {
    if (!currentUser) return;

    // Preenche dados informativos
    document.getElementById('infoNome').innerText = currentUser.nome;
    document.getElementById('infoEmail').innerText = currentUser.email;
    document.getElementById('infoCargo').innerText = currentUser.cargo === 'principal' ? 'Admin. Principal' : 'Administrador';

    // Preenche formulário de edição
    document.getElementById('editNome').value = currentUser.nome;
    document.getElementById('editEmail').value = currentUser.email;
    document.getElementById('editPassConfirm').value = '';
    document.getElementById('accountMessage').style.display = 'none';

    // Se for principal, busca o código de recuperação
    if (currentUser.cargo === 'principal') {
        const recoveryArea = document.getElementById('recoveryCodeArea');
        if (recoveryArea) {
            recoveryArea.style.display = 'block';
            fetch(`${API_BASE}/auth/recovery-info/${currentUser._id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.recoveryCode) {
                        document.getElementById('infoRecoveryCode').innerText = data.recoveryCode;
                    }
                })
                .catch(err => console.error("Erro ao carregar código master:", err));
        }
    } else {
        const recoveryArea = document.getElementById('recoveryCodeArea');
        if (recoveryArea) recoveryArea.style.display = 'none';
    }
}

function showAccountMessage(text, type) {
    const box = document.getElementById('accountMessage');
    box.innerText = text;
    box.className = `message-box message-${type}`;
    box.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    const formEditPerfil = document.getElementById('formEditPerfil');
    if (formEditPerfil) {
        formEditPerfil.onsubmit = async (e) => {
            e.preventDefault();
            const nome = document.getElementById('editNome').value;
            const email = document.getElementById('editEmail').value;
            const senhaAtual = document.getElementById('editPassConfirm').value;

            try {
                const res = await fetch(`${API_BASE}/auth/perfil`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        adminId: currentUser._id,
                        nome,
                        email,
                        senhaAtual
                    })
                });

                const data = await res.json();
                if (res.ok) {
                    // Atualiza sessão local
                    currentUser.nome = nome;
                    currentUser.email = email;
                    localStorage.setItem('admin_user', JSON.stringify(currentUser));

                    // Atualiza UI
                    document.getElementById('adminUserName').innerText = nome;
                    carregarMinhaConta();
                    showAccountMessage('Perfil atualizado com sucesso!', 'success');
                } else {
                    showAccountMessage(data.error || 'Erro ao atualizar perfil', 'error');
                }
            } catch (err) {
                showAccountMessage('Erro de conexão', 'error');
            }
        };
    }

    const formEditSenha = document.getElementById('formEditSenha');
    if (formEditSenha) {
        formEditSenha.onsubmit = async (e) => {
            e.preventDefault();
            const senhaAtual = document.getElementById('passAtual').value;
            const novaSenha = document.getElementById('passNova').value;
            const confirmaSenha = document.getElementById('passConfirma').value;

            if (novaSenha !== confirmaSenha) {
                return showAccountMessage('As novas senhas não coincidem.', 'error');
            }

            try {
                const res = await fetch(`${API_BASE}/auth/senha`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        adminId: currentUser._id,
                        senhaAtual,
                        novaSenha
                    })
                });

                const data = await res.json();
                if (res.ok) {
                    formEditSenha.reset();
                    showAccountMessage('Senha alterada com sucesso!', 'success');
                } else {
                    showAccountMessage(data.error || 'Erro ao alterar senha', 'error');
                }
            } catch (err) {
                showAccountMessage('Erro de conexão', 'error');
            }
        };
    }
});

// Inicialização
window.addEventListener('load', () => {
    if (typeof carregarTurmas === 'function') carregarTurmas();
    if (currentUser && currentTab === 'conta') carregarMinhaConta();
});