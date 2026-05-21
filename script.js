/**
 * AGENDA ACADÊMICA DIGITAL IFPR
 * VERSÃO COM API REST - Eventos do servidor
 */

// =============================
// CONFIGURAÇÕES
// =============================

const API_BASE = 'http://localhost:3000';

const FERIADOS_ESTADUAIS = [
    { date: "-12-19", name: "Emancipação Política do Paraná", type: "state" }
];

const PRIORIDADES = { "prova": 1, "trabalho": 2, "tarefa": 3, "evento": 4 };

// =============================
// SISTEMA DE NOTIFICAÇÕES (Toast)
// =============================

/**
 * Exibe uma notificação toast na tela
 * @param {string} message - Mensagem a exibir
 * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duração em ms (padrão: 5000 para erro, 3000 para sucesso)
 */
function showNotification(message, type = 'info', duration = null) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    container.appendChild(toast);

    // Duração padrão por tipo
    if (duration === null) {
        duration = type === 'error' ? 5000 : 3000;
    }

    // Auto-remove após duração
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

// Aliases para facilitar uso
function showSuccess(message, duration) {
    showNotification(message, 'success', duration);
}

function showError(message, duration) {
    showNotification(message, 'error', duration);
}

function showWarning(message, duration) {
    showNotification(message, 'warning', duration);
}

function showInfo(message, duration) {
    showNotification(message, 'info', duration);
}

// =============================
// ESTADO GLOBAL
// =============================

let dataAtualDeVisualizacao = new Date();
let eventosCarregados = [];   // Eventos do servidor (turma + gerais)
let feriadosNacionais = {};
let liderLogado = localStorage.getItem('ifpr_lider_logado') === 'true';
let turmaAtual = JSON.parse(localStorage.getItem('ifpr_selected_turma_v1')) || null;
let turmasCadastradas = [];   // Turmas carregadas da API

// =============================
// CARREGAR TURMAS DA API
// =============================
async function carregarTurmasDoServidor() {
    try {
        const res = await fetch(`${API_BASE}/turmas`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        turmasCadastradas = await res.json();
        return turmasCadastradas;
    } catch (err) {
        console.error("Erro ao carregar turmas do servidor:", err);
        turmasCadastradas = [];
        return [];
    }
}

function getTurmasCadastradas() {
    return turmasCadastradas;
}

// =============================
// RECESSOS ACADÊMICOS
// =============================

const RECESSOS_ACADEMICOS = [
    { inicio: "2024-03-28", fim: "2024-03-31", descricao: "Recesso Semana Santa" },
    { inicio: "2024-07-08", fim: "2024-07-22", descricao: "Recesso Escolar de Inverno" },
    { inicio: "2024-10-14", fim: "2024-10-15", descricao: "Recesso Dia do Professor" },
    { inicio: "2024-12-21", fim: "2025-01-31", descricao: "Férias de Verão" },
    { inicio: "2025-07-07", fim: "2025-07-21", descricao: "Recesso Escolar de Inverno 2025" },
    { inicio: "2026-07-10", fim: "2026-07-25", descricao: "Férias de Inverno 2026" }
];

function verificarRecesso(dataChave) {
    const dataAlvo = new Date(dataChave + "T12:00:00");

    const r = RECESSOS_ACADEMICOS.find(item => {
        const dataInicio = new Date(item.inicio + "T12:00:00");
        const dataFim = new Date(item.fim + "T12:00:00");
        return dataAlvo >= dataInicio && dataAlvo <= dataFim;
    });

    if (r) return r.descricao;

    const diaSemana = dataAlvo.getDay();

    if (diaSemana === 1) {
        const t = new Date(dataAlvo);
        t.setDate(t.getDate() + 1);
        const chaveAmanha = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        if (feriadosNacionais && feriadosNacionais[chaveAmanha]) {
            return `Recesso Ponte (${feriadosNacionais[chaveAmanha].name})`;
        }
    } else if (diaSemana === 5) {
        const t = new Date(dataAlvo);
        t.setDate(t.getDate() - 1);
        const chaveOntem = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        if (feriadosNacionais && feriadosNacionais[chaveOntem]) {
            return `Recesso Ponte (${feriadosNacionais[chaveOntem].name})`;
        }
    }

    return null;
}

// =============================
// INICIALIZAÇÃO
// =============================

// Inicializar contatos de exemplo no localStorage se vazio
function inicializarContatosExemplo() {
    const contatosExistentes = localStorage.getItem('ifpr_contatos_v1');
    if (!contatosExistentes || contatosExistentes === '[]') {
        const contatosExemplo = [
            {
                "_id": "1",
                "nome": "Coordenação de Ensino",
                "setor": "Coordenação",
                "descricao": "Responsável pela organização acadêmica, calendário escolar e políticas educacionais do campus",
                "email": "coordenacao@ifpr.edu.br",
                "telefone": "(44) 3232-1234"
            },
            {
                "_id": "2",
                "nome": "Secretaria Acadêmica",
                "setor": "Secretaria",
                "descricao": "Serviço de registros acadêmicos, documentação de alunos e históricos escolares",
                "email": "secretaria@ifpr.edu.br",
                "telefone": "(44) 3232-1235"
            },
            {
                "_id": "3",
                "nome": "Direção do Campus",
                "setor": "Administração",
                "descricao": "Direção geral do IFPR Campus Assis Chateaubriand, responsável pela gestão institucional",
                "email": "direcao@ifpr.edu.br",
                "telefone": "(44) 3232-1200"
            },
            {
                "_id": "4",
                "nome": "Assistência Estudantil",
                "setor": "Assistência Social",
                "descricao": "Apoio social, bolsas, benefícios e auxílios para estudantes carentes",
                "email": "assistencia@ifpr.edu.br",
                "telefone": "(44) 3232-1240"
            },
            {
                "_id": "5",
                "nome": "Orientação Educacional",
                "setor": "Pedagogia",
                "descricao": "Apoio pedagógico, orientação de estudos e acompanhamento de desempenho acadêmico",
                "email": "orientacao@ifpr.edu.br",
                "telefone": "(44) 3232-1250"
            },
            {
                "_id": "6",
                "nome": "Projeto de Desenvolvimento",
                "setor": "PFC - Agenda Acadêmica",
                "descricao": "Suporte técnico e dúvidas sobre a plataforma Agenda Acadêmica Digital",
                "email": "projeto.ifpr.assis@gmail.com",
                "telefone": ""
            }
        ];
        localStorage.setItem('ifpr_contatos_v1', JSON.stringify(contatosExemplo));
    }
}

async function inicializar() {
    await carregarTurmasDoServidor();  // ✅ Carregar turmas da API primeiro
    await carregarFeriadosNacionais(dataAtualDeVisualizacao.getFullYear());
    carregarConfiguracoesTema();
    configurarEventosInterface();
    verificarEstadoInicial();
    inicializarContatosExemplo();
}

function verificarEstadoInicial() {
    const turmasSelection = document.getElementById('turmasSelection');
    const calendarApp = document.getElementById('calendarApp');

    if (turmaAtual) {
        turmasSelection.style.display = 'none';
        calendarApp.style.display = 'block';
        document.getElementById('turmaNomeDisplay').innerText = turmaAtual.nome;
        carregarEExibirCalendario();
    } else {
        turmasSelection.style.display = 'block';
        calendarApp.style.display = 'none';
        renderizarTurmas();
    }
}

function renderizarTurmas() {
    const turmasList = document.getElementById('turmasList');
    if (!turmasList) return;
    turmasList.innerHTML = "";

    const turmas = getTurmasCadastradas();

    if (turmas.length === 0) {
        turmasList.innerHTML = "<p style='opacity:0.6; text-align:center;'>Nenhuma turma cadastrada no painel admin.</p>";
        return;
    }

    turmas.forEach(turma => {
        // ✅ Mostrar TODAS as turmas para visualização
        const btn = document.createElement('button');
        btn.className = 'turma-card';
        btn.innerHTML = `${turma.nome} <br><small style="font-size: 0.8rem; font-weight: normal; opacity: 0.8;">${turma.curso || ''}</small>`;
        
        // ✅ Todos conseguem visualizar qualquer turma
        // Restrições de edição estão no backend
        btn.onclick = () => selecionarTurma(turma);
        
        turmasList.appendChild(btn);
    });
}

function selecionarTurma(turma) {
    // ✅ Permite visualização de qualquer turma
    // Restrições de modificação estão no backend (middleware validarAcessoTurma)
    turmaAtual = turma;
    localStorage.setItem('ifpr_selected_turma_v1', JSON.stringify(turma));
    verificarEstadoInicial();
}

// =============================
// FERIADOS API
// =============================

async function carregarFeriadosNacionais(ano) {
    try {
        const resposta = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
        const lista = await resposta.json();

        feriadosNacionais = {};

        lista.forEach(f => {
            feriadosNacionais[f.date] = { name: f.name, type: "national" };
        });

        FERIADOS_ESTADUAIS.forEach(fe => {
            const chave = ano + fe.date;
            feriadosNacionais[chave] = { name: fe.name, type: "state" };
        });

    } catch (erro) {
        console.error("Erro ao carregar feriados:", erro);
    }
}

// =============================
// CARREGAR EVENTOS DO SERVIDOR
// =============================

async function carregarEventosDaAPI() {
    if (!turmaAtual) {
        eventosCarregados = [];
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/eventos/turma/${turmaAtual.id}`);
        eventosCarregados = await res.json();
    } catch (err) {
        console.error("Erro ao carregar eventos:", err);
        eventosCarregados = [];
    }
}

// Retorna eventos para uma data específica (já carregados em memória)
function getEventosPorData(chaveData) {
    return eventosCarregados.filter(e => e.data === chaveData);
}

// =============================
// RENDER CALENDÁRIO
// =============================

async function carregarEExibirCalendario() {
    await carregarEventosDaAPI();
    renderizarCalendario();
}

function renderizarCalendario() {

    const grid = document.getElementById('calendarGrid');
    const displayMes = document.getElementById('monthDisplay');
    const displayAno = document.getElementById('yearDisplay');

    grid.innerHTML = "";

    const ano = dataAtualDeVisualizacao.getFullYear();
    const mes = dataAtualDeVisualizacao.getMonth();

    const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(dataAtualDeVisualizacao);
    displayMes.innerText = nomeMes;
    displayAno.innerText = ano;

    const primeiroDiaDaSemana = new Date(ano, mes, 1).getDay();
    const totalDiasNoMes = new Date(ano, mes + 1, 0).getDate();

    for (let i = 0; i < primeiroDiaDaSemana; i++) {
        grid.appendChild(document.createElement('div'));
    }

    for (let dia = 1; dia <= totalDiasNoMes; dia++) {

        const divDia = document.createElement('div');
        divDia.className = 'day';
        divDia.innerText = dia;

        const chaveData = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const diaSemana = new Date(ano, mes, dia).getDay();

        // Fim de semana
        if (diaSemana === 0 || diaSemana === 6) {
            divDia.classList.add('day-off');
        }

        // Recesso
        const nomeRecesso = verificarRecesso(chaveData);
        if (nomeRecesso) {
            divDia.classList.add('day-recesso');
            divDia.title = nomeRecesso;
        }

        // Feriado
        if (feriadosNacionais[chaveData]) {
            const f = feriadosNacionais[chaveData];
            divDia.classList.add(f.type === "national" ? 'holiday-national' : 'holiday-state');
            divDia.title = `Feriado: ${f.name}`;
        }

        // ── Estrutura interna do dia: número + bolinhas ──────────────────
        divDia.innerText = '';

        const numSpan = document.createElement('span');
        numSpan.className = 'day-number';
        numSpan.textContent = dia;
        divDia.appendChild(numSpan);

        // ── Indicadores visuais de eventos (bolinhas coloridas) ────────────
        const eventosDoDia = getEventosPorData(chaveData);

        if (eventosDoDia.length > 0) {
            const ORDEM = ['prova', 'trabalho', 'tarefa', 'evento'];

            // ✅ CORREÇÃO: Usar 'categoria' em vez de 'tipo' para filtrar
            // Tipos únicos presentes, ordenados por prioridade
            const tiposPresentes = ORDEM.filter(t =>
                eventosDoDia.some(e => e.categoria === t)
            );

            // Cria container de bolinhas abaixo do número
            const dotsWrapper = document.createElement('div');
            dotsWrapper.className = 'day-dots';
            tiposPresentes.forEach(tipo => {
                const dot = document.createElement('span');
                dot.className = `day-dot day-dot--${tipo}`;
                dotsWrapper.appendChild(dot);
            });
            divDia.appendChild(dotsWrapper);
        }

        divDia.onclick = () => abrirPopupDetalhes(chaveData);

        grid.appendChild(divDia);
    }
}

// =============================
// MODAL
// =============================

function abrirPopupDetalhes(chaveData) {

    document.getElementById('eventDate').value = chaveData;
    document.getElementById('modalDateTitle').innerText =
        chaveData.split('-').reverse().join('/');

    const badge = document.getElementById('specialBadge');
    const txt = document.getElementById('specialText');

    const recesso = verificarRecesso(chaveData);
    const feriado = feriadosNacionais[chaveData];

    if (recesso || feriado) {
        badge.style.display = "block";

        if (feriado) {
            txt.innerText = `🚩 Feriado: ${feriado.name}`;
            badge.style.backgroundColor = "var(--color-holiday-nat)";
        } else {
            txt.innerText = `🏖️ ${recesso}`;
            badge.style.backgroundColor = "var(--color-recesso)";
        }

    } else {
        badge.style.display = "none";
    }

    renderizarListaDeEventos(chaveData);

    // EXIBIR OU OCULTAR FORMULÁRIO BASEADO NO LOGIN
    const adminFormArea = document.getElementById('adminFormArea');
    if (adminFormArea) {
        adminFormArea.style.display = liderLogado ? 'block' : 'none';
    }

    document.getElementById('eventModal').style.display = "flex";
}

function renderizarListaDeEventos(chaveData) {

    const listaHtml = document.getElementById('eventsList');
    listaHtml.innerHTML = "";

    const userLogged = JSON.parse(localStorage.getItem('ifpr_user_logged')) || {};
    const eventosDoDia = getEventosPorData(chaveData);

    if (eventosDoDia.length === 0) {
        listaHtml.innerHTML = "<p style='opacity:0.5;'>Nenhuma atividade.</p>";
    }

    eventosDoDia.forEach(ev => {

        const item = document.createElement('div');
        item.className = 'event-item';
        // ✅ CORREÇÃO: Usar 'categoria' em vez de 'tipo' para a cor
        item.style.borderLeftColor = `var(--cat-${ev.categoria})`;

        // Indica se é evento geral
        const badgeGeral = ev.tipo === 'geral'
            ? '<span style="font-size:0.65rem; background:var(--primary); color:white; padding:1px 6px; border-radius:8px; margin-left:6px;">GERAL</span>'
            : '';

        // ✅ SEGURANÇA: Validar se o LÍDER pode editar este evento
        // Líder só pode deletar eventos de sua própria turma
        const podeEditar = liderLogado && (
            (userLogged.role === 'admin') ||  // Admin sempre pode
            (userLogged.role === 'turma_admin' && userLogged._id && ev.turmaId === userLogged._id) ||  // Líder só da sua turma
            (ev.tipo === 'geral')  // Geral qualquer um pode
        );
        const btnRemover = podeEditar
            ? `<button onclick="removerAtividade('${ev._id}')">🗑️</button>` : '';

        const descHtml = ev.descricao ? `<p class="event-desc">${ev.descricao}</p>` : '';

        item.innerHTML = `
            <div style="display:flex;justify-content:space-between; align-items:flex-start;">
                <div>
                    <strong>${ev.titulo}${badgeGeral}</strong><br>
                    <small>${ev.hora || '--:--'} | ${(ev.categoria || '').toUpperCase()}</small>
                    ${descHtml}
                </div>
                ${btnRemover}
            </div>
        `;

        listaHtml.appendChild(item);
    });
}

// =============================
// NAVEGAÇÃO
// =============================

async function mudarMesCalendar(direcao) {

    const anoAnterior = dataAtualDeVisualizacao.getFullYear();
    dataAtualDeVisualizacao.setMonth(dataAtualDeVisualizacao.getMonth() + direcao);

    if (dataAtualDeVisualizacao.getFullYear() !== anoAnterior) {
        await carregarFeriadosNacionais(dataAtualDeVisualizacao.getFullYear());
    }

    renderizarCalendario();
}

// =============================
// EVENTOS (CRUD VIA API)
// =============================

// ✅ NOVO: Helper para obter headers de autenticação
function obterHeadersAutenticacao() {
    const userLogged = JSON.parse(localStorage.getItem('ifpr_user_logged')) || {};
    const headers = {
        'Content-Type': 'application/json'
    };

    // Se há usuário logado, adicionar informações de autorização
    if (userLogged.email) {
        headers['X-Usuario-Email'] = userLogged.email;
        headers['X-Usuario-Role'] = userLogged.role || 'user';
        
        // Para líderes: passar a turmaId
        if (userLogged.role === 'turma_admin' && userLogged._id) {
            headers['X-Usuario-Turma'] = userLogged._id;
        }
    }

    return headers;
}

window.removerAtividade = async (eventoId) => {
    if (!confirm("Deseja apagar?")) return;

    try {
        // ✅ SEGURANÇA: Validar antes de enviar requisição
        const userLogged = JSON.parse(localStorage.getItem('ifpr_user_logged')) || {};
        
        // Se é líder, precisar buscaro evento para validar turma
        if (userLogged.role === 'turma_admin' && userLogged._id) {
            const eventos = await fetch(`${API_BASE}/eventos`).then(r => r.json());
            const evento = eventos.find(e => e._id === eventoId);
            
            if (!evento) {
                showError('Evento não encontrado.');
                return;
            }
            
            // Líder PODE deletar apenas eventos de sua turma ou gerais
            if (evento.turmaId !== userLogged._id && evento.tipo !== 'geral') {
                console.warn(`🚫 [SEGURANÇA] Líder tentou deletar evento de outra turma:`, {
                    usuarioTurmaId: userLogged._id,
                    eventoTurmaId: evento.turmaId,
                    eventoId: eventoId,
                    email: userLogged.email
                });
                showError('Acesso Negado: Você só pode deletar eventos de sua própria turma.');
                return;
            }
        }

        const headers = obterHeadersAutenticacao();
        
        const res = await fetch(`${API_BASE}/eventos/${eventoId}`, { 
            method: 'DELETE',
            headers
        });

        if (!res.ok) {
            const erro = await res.json();
            throw new Error(erro.error || 'Erro ao deletar evento');
        }

        // Recarrega eventos e atualiza calendário
        await carregarEventosDaAPI();
        renderizarCalendario();

        // Atualiza modal se aberto
        const chave = document.getElementById('eventDate').value;
        if (chave) renderizarListaDeEventos(chave);
    } catch (err) {
        console.error(err);
        showError(`Erro ao remover evento: ${err.message}`);
    }
};

function configurarEventosInterface() {

    // =============================
    // MODAL DE LOGIN LÍDER (Novo Sistema)
    // =============================
    const loginBtn = document.getElementById('menuIcon'); // Botão da navbar
    const loginModal = document.getElementById('loginModal');
    const closeBtn = document.getElementById('closeLoginModal');

    // Abre o modal ao clicar no Login da Navbar
    if (loginBtn && loginModal && closeBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loginModal.style.display = 'flex';
        });

        // Fecha ao clicar no X
        closeBtn.addEventListener('click', () => {
            loginModal.style.display = 'none';
        });

        // Fecha ao clicar fora do card (no overlay)
        window.addEventListener('click', (e) => {
            if (e.target === loginModal) {
                loginModal.style.display = 'none';
            }
        });
    }

    // =============================
    // LOGIN LÍDER - FORM (Novo Sistema)
    // =============================
    const sidebarLoginForm = document.getElementById('sidebarLoginForm');

    // ✅ Handler para o formulário de login
    if (sidebarLoginForm) {
        sidebarLoginForm.onsubmit = async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value.trim();
            const senha = document.getElementById('loginPass').value.trim();

            if (!email || !senha) {
                showError("E-mail e senha são obrigatórios.");
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, senha })
                });

                const data = await res.json();

                if (res.ok) {
                    // ✅ Login bem-sucedido
                    liderLogado = true;
                    localStorage.setItem('ifpr_lider_logado', 'true');
                    localStorage.setItem('ifpr_user_logged', JSON.stringify(data.user));

                    // Fechar o modal
                    if (loginModal) loginModal.style.display = 'none';

                    // Limpar form
                    sidebarLoginForm.reset();

                    // Recarregar calendário se uma turma estiver selecionada
                    if (turmaAtual) renderizarCalendario();
                    
                    showSuccess("Login realizado com sucesso!");

                } else {
                    // ❌ Falha no login
                    showError(data.error || "E-mail ou senha incorretos.");
                }
            } catch (erro) {
                console.error("Erro ao fazer login:", erro);
                showError("Erro de conexão com o servidor.");
            }
        };
    }

    // ✅ LOGOUT
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            if (confirm("Tem certeza que deseja sair?")) {
                liderLogado = false;
                localStorage.setItem('ifpr_lider_logado', 'false');
                localStorage.removeItem('ifpr_user_logged');

                // Recarregar calendário
                if (turmaAtual) renderizarCalendario();
                
                showSuccess("Logout realizado com sucesso!");
            }
        };
    }

    // ✅ NOVO: Botão de alterar senha
    const btnAlterarSenha = document.getElementById('btnAlterarSenha');
    if (btnAlterarSenha) {
        btnAlterarSenha.onclick = async () => {
            const userLogged = JSON.parse(localStorage.getItem('ifpr_user_logged')) || {};
            const senhaAtual = prompt("Digite sua senha atual:");
            
            if (senhaAtual === null) return;

            const novaSenha = prompt("Digite a nova senha:");
            if (novaSenha === null) return;

            const novaSenhaConfirm = prompt("Confirme a nova senha:");
            if (novaSenhaConfirm === null) return;

            if (novaSenha !== novaSenhaConfirm) {
                showError("As senhas não coincidem!");
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/auth/lider/senha`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: userLogged.email,
                        senhaAtual,
                        novaSenha
                    })
                });

                const data = await res.json();
                if (res.ok) {
                    showSuccess("Senha alterada com sucesso!");
                } else {
                    showError(data.error || "Erro ao alterar senha.");
                }
            } catch (err) {
                console.error(err);
                showError("Erro de conexão com o servidor.");
            }
        };
    }

    // Tema
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.onchange = (e) => {
            const novoTema = e.target.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', novoTema);
            localStorage.setItem('ifpr_tema', novoTema);
        };
    }

    document.getElementById('prevMonth').onclick = () => mudarMesCalendar(-1);
    document.getElementById('nextMonth').onclick = () => mudarMesCalendar(1);

    const btnVoltarTurmas = document.getElementById('btnVoltarTurmas');
    if (btnVoltarTurmas) {
        btnVoltarTurmas.onclick = () => {
            turmaAtual = null;
            localStorage.removeItem('ifpr_selected_turma_v1');
            verificarEstadoInicial();
        };
    }

    document.querySelector('.close-modal-btn').onclick =
        () => document.getElementById('eventModal').style.display = "none";

    // Submissão de novo evento pelo líder (modal no calendário)
    document.getElementById('eventForm').onsubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const chave = document.getElementById('eventDate').value;
        const userLogged = JSON.parse(localStorage.getItem('ifpr_user_logged')) || {};

        // ✅ SEGURANÇA: Validação RIGOROSA de turma para líderes
        if (userLogged.role === 'turma_admin' && userLogged._id) {
            // Líder PRECISA estar visualizando sua própria turma para criar evento
            if (!turmaAtual || turmaAtual.id !== userLogged._id) {
                console.warn(`🚫 [SEGURANÇA] Líder tentou criar evento fora de sua turma:`, {
                    usuarioTurmaId: userLogged._id,
                    turmaSelecionada: turmaAtual?.id,
                    usuarioEmail: userLogged.email
                });
                showError('Acesso Negado: Você só pode criar eventos de sua própria turma.');
                return false;
            }
        }

        const novo = {
            titulo: document.getElementById('title').value,
            categoria: document.getElementById('type').value,
            tipo: 'turma',
            data: chave,
            hora: document.getElementById('time').value,
            descricao: document.getElementById('description').value,
            turmaId: turmaAtual.id,
            criadoPor: 'líder',
            usuarioId: userLogged.email || 'unknown'
        };

        try {
            const headers = obterHeadersAutenticacao();
            
            const res = await fetch(`${API_BASE}/eventos`, {
                method: 'POST',
                headers,
                body: JSON.stringify(novo)
            });

            if (!res.ok) {
                const erro = await res.json();
                throw new Error(erro.error || 'Erro ao salvar evento');
            }

            // Fechar modal ANTES de atualizar (para evitar resets)
            document.getElementById('eventModal').style.display = "none";

            // Agora atualizar o calendário
            await carregarEventosDaAPI();
            renderizarListaDeEventos(chave);
            renderizarCalendario();

            // Limpar formulário manualmente
            document.getElementById('title').value = '';
            document.getElementById('description').value = '';
            document.getElementById('time').value = '';
            document.getElementById('type').value = 'prova';

            return false;
        } catch (err) {
            console.error(err);
            showError(`Erro ao salvar evento: ${err.message}`);
            return false;
        }
    };
}

// =============================
// TEMA
// =============================


function carregarConfiguracoesTema() {
    const t = localStorage.getItem('ifpr_tema') || 'light';
    document.documentElement.setAttribute('data-theme', t);

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = (t === 'dark');
    }
}

// =============================
// NAVEGACAO entre TELAS
// =============================

function navigateToAbout(event) {
    if (event) {
        event.preventDefault();
    }

    // Esconder todas as seções
    document.getElementById('turmasSelection').style.display = 'none';
    document.getElementById('calendarApp').style.display = 'none';
    document.getElementById('contactsScreen').style.display = 'none';

    // Mostrar Sobre
    document.getElementById('aboutScreen').style.display = 'block';

    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });

    fecharMenuMobileSeAberto();
}

function navigateToHome(event) {
    if (event) {
        event.preventDefault();
    }

    // Ao ir para home (Seleção de Turmas), resetamos a turma atual
    turmaAtual = null;
    localStorage.removeItem('ifpr_selected_turma_v1');

    // Esconder todas as seções
    document.getElementById('aboutScreen').style.display = 'none';
    document.getElementById('contactsScreen').style.display = 'none';
    document.getElementById('calendarApp').style.display = 'none';

    // Mostrar Início (Seleção de Turmas)
    document.getElementById('turmasSelection').style.display = 'block';

    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });

    fecharMenuMobileSeAberto();
}

// =============================
// NAVEGACAO PARA CONTATOS
// =============================

function navigateToContacts(event) {
    if (event) {
        event.preventDefault();
    }

    // Esconder todas as seções
    document.getElementById('turmasSelection').style.display = 'none';
    document.getElementById('calendarApp').style.display = 'none';
    document.getElementById('aboutScreen').style.display = 'none';

    // Mostrar Contatos
    document.getElementById('contactsScreen').style.display = 'block';

    // Carregar contatos
    carregarContatosPublico();

    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });

    fecharMenuMobileSeAberto();
}

function fecharMenuMobileSeAberto() {
    const navLinksWrapper = document.getElementById('navLinks');
    const navMobileToggle = document.getElementById('navMobileToggle');
    if (navLinksWrapper && navLinksWrapper.classList.contains('nav-open')) {
        navLinksWrapper.classList.remove('nav-open');
        if (navMobileToggle) {
            navMobileToggle.setAttribute('aria-expanded', 'false');
            navMobileToggle.classList.remove('nav-btn-active');
        }
    }
}

// Carregar e exibir contatos publicamente
async function carregarContatosPublico() {
    const container = document.getElementById('contactsContainer');

    if (!container) return;

    try {
        // Tentar carregar do servidor primeiro
        const response = await fetch(`${API_BASE}/contatos`);

        if (!response.ok) {
            throw new Error('Erro ao buscar contatos do servidor');
        }

        const contatos = await response.json();
        renderizarContatosPublico(contatos);

    } catch (err) {
        console.error("Erro ao carregar contatos:", err);

        // Fallback para localStorage
        try {
            const contatosLocal = JSON.parse(localStorage.getItem('ifpr_contatos_v1')) || [];
            renderizarContatosPublico(contatosLocal);
        } catch (e) {
            container.innerHTML = '<div class="contacts-empty">Nenhum contato disponível no momento.</div>';
        }
    }
}

// Renderizar contatos publicamente
function renderizarContatosPublico(contatos) {
    const container = document.getElementById('contactsContainer');

    if (!container) return;

    container.innerHTML = '';

    if (!contatos || contatos.length === 0) {
        container.innerHTML = '<div class="contacts-empty">Nenhum contato disponível no momento.</div>';
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'contacts-grid';

    contatos.forEach(contato => {
        const card = document.createElement('div');
        card.className = 'contact-card';

        let telefoneHTML = '';
        if (contato.telefone) {
            telefoneHTML = `
                <div class="contact-info-item">
                    <strong>📱 Telefone:</strong>
                    <a href="tel:${contato.telefone}">${contato.telefone}</a>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="contact-card-header">
                <h3 class="contact-name">${contato.nome || 'Sem nome'}</h3>
                <p class="contact-setor">${contato.setor || 'Sem setor'}</p>
            </div>
            <div class="contact-card-body">
                ${contato.descricao ? `<p class="contact-description">${contato.descricao}</p>` : ''}
                <div class="contact-info">
                    <div class="contact-info-item">
                        <strong>📧 Email:</strong>
                        <a href="mailto:${contato.email}">${contato.email}</a>
                    </div>
                    ${telefoneHTML}
                </div>
            </div>
        `;

        grid.appendChild(card);
    });

    container.appendChild(grid);
}

// =============================
inicializar();