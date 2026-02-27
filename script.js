/**
 * AGENDA ACADÊMICA DIGITAL IFPR
 * VERSÃO FINAL ESTÁVEL - COM RECESSOS AUTOMÁTICOS
 */

// =============================
// CONFIGURAÇÕES
// =============================

const FERIADOS_ESTADUAIS = [
    { date: "-12-19", name: "Emancipação Política do Paraná", type: "state" }
];

const PRIORIDADES = { "prova": 1, "trabalho": 2, "tarefa": 3, "evento": 4 };

// =============================
// ESTADO GLOBAL
// =============================

let dataAtualDeVisualizacao = new Date();
let dadosEventos = JSON.parse(localStorage.getItem('ifpr_agenda_v20')) || {};
let feriadosNacionais = {};
let liderLogado = false;

// =============================
// RECESSOS ACADÊMICOS
// Definição manual com intervalo de datas (inicio, fim e descricao)
// =============================

const RECESSOS_ACADEMICOS = [
    { inicio: "2024-03-28", fim: "2024-03-31", descricao: "Recesso Semana Santa" },
    { inicio: "2024-07-08", fim: "2024-07-22", descricao: "Recesso Escolar de Inverno" },
    { inicio: "2024-10-14", fim: "2024-10-15", descricao: "Recesso Dia do Professor" },
    { inicio: "2024-12-21", fim: "2025-01-31", descricao: "Férias de Verão" },
    { inicio: "2025-07-07", fim: "2025-07-21", descricao: "Recesso Escolar de Inverno 2025" },

    // Deixando apenas as Férias de 2026 para demonstração, o resto será dinâmico por ponte
    { inicio: "2026-07-10", fim: "2026-07-25", descricao: "Férias de Inverno 2026" }
];

function verificarRecesso(dataChave) {
    const dataAlvo = new Date(dataChave + "T12:00:00");

    // 1. Verifica recessos fixos (férias, semana santa, etc)
    const r = RECESSOS_ACADEMICOS.find(item => {
        const dataInicio = new Date(item.inicio + "T12:00:00");
        const dataFim = new Date(item.fim + "T12:00:00");
        return dataAlvo >= dataInicio && dataAlvo <= dataFim;
    });

    if (r) return r.descricao;

    // 2. Lógica automática de Ponte / Emenda de Feriado
    const diaSemana = dataAlvo.getDay();

    if (diaSemana === 1) { // Se for Segunda-feira
        const t = new Date(dataAlvo);
        t.setDate(t.getDate() + 1); // Checa o dia seguinte (Terça)
        const chaveAmanha = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

        if (feriadosNacionais && feriadosNacionais[chaveAmanha]) {
            return `Recesso Ponte (${feriadosNacionais[chaveAmanha].name})`;
        }
    } else if (diaSemana === 5) { // Se for Sexta-feira
        const t = new Date(dataAlvo);
        t.setDate(t.getDate() - 1); // Checa o dia anterior (Quinta)
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

async function inicializar() {
    await carregarFeriadosNacionais(dataAtualDeVisualizacao.getFullYear());
    renderizarCalendario();
    carregarConfiguracoesTema();
    configurarEventosInterface();
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
// RENDER CALENDÁRIO
// =============================

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

        // Eventos
        if (dadosEventos[chaveData]) {
            const prioritario = dadosEventos[chaveData].reduce((p, c) =>
                PRIORIDADES[c.type] < PRIORIDADES[p.type] ? c : p
            );
            divDia.classList.add(`has-${prioritario.type}`);
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

    const lista = dadosEventos[chaveData] || [];

    if (lista.length === 0) {
        listaHtml.innerHTML = "<p style='opacity:0.5;'>Nenhuma atividade.</p>";
    }

    lista.forEach((ev, idx) => {

        const item = document.createElement('div');
        item.className = 'event-item';
        item.style.borderLeftColor = `var(--cat-${ev.type})`;

        const btnRemover = liderLogado ?
            `<button onclick="removerAtividade('${chaveData}',${idx})">🗑️</button>` : '';

        const descHtml = ev.descricao ? `<p class="event-desc">${ev.descricao}</p>` : '';

        item.innerHTML = `
            <div style="display:flex;justify-content:space-between; align-items:flex-start;">
                <div>
                    <strong>${ev.titulo}</strong><br>
                    <small>${ev.hora || '--:--'} | ${ev.type.toUpperCase()}</small>
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
// EVENTOS
// =============================

window.removerAtividade = (chave, index) => {
    if (confirm("Deseja apagar?")) {
        dadosEventos[chave].splice(index, 1);
        if (dadosEventos[chave].length === 0) delete dadosEventos[chave];
        localStorage.setItem('ifpr_agenda_v20', JSON.stringify(dadosEventos));
        renderizarListaDeEventos(chave);
        renderizarCalendario();
    }
};

function configurarEventosInterface() {

    // Sidebar
    const sidebar = document.getElementById('sidebar');
    const menuIcon = document.getElementById('menuIcon');
    const closeSidebar = document.getElementById('closeSidebar');
    const menuOverlay = document.getElementById('menuOverlay');

    if (menuIcon && sidebar && closeSidebar && menuOverlay) {
        menuIcon.onclick = () => {
            sidebar.classList.add('active');
            menuOverlay.classList.add('active');
        };
        const fecharMenu = () => {
            sidebar.classList.remove('active');
            menuOverlay.classList.remove('active');
        };
        closeSidebar.onclick = fecharMenu;
        menuOverlay.onclick = fecharMenu;
    }

    // Login/Logout Líder
    const btnLogin = document.getElementById('btnLogin');
    const btnLogout = document.getElementById('btnLogout');
    const loginArea = document.getElementById('loginArea');
    const adminStatus = document.getElementById('adminStatus');

    if (localStorage.getItem('ifpr_lider_logado') === 'true') {
        liderLogado = true;
        if (loginArea) loginArea.style.display = 'none';
        if (adminStatus) adminStatus.style.display = 'block';
    }

    if (btnLogin && btnLogout) {
        btnLogin.onclick = () => {
            const senha = prompt("Digite a senha do Líder:");
            if (senha === "ifpr123") {
                liderLogado = true;
                localStorage.setItem('ifpr_lider_logado', 'true');
                loginArea.style.display = 'none';
                adminStatus.style.display = 'block';
                renderizarCalendario();
                alert("Login efetuado com sucesso!");
            } else if (senha !== null) {
                alert("Senha incorreta!");
            }
        };

        btnLogout.onclick = () => {
            liderLogado = false;
            localStorage.setItem('ifpr_lider_logado', 'false');
            loginArea.style.display = 'block';
            adminStatus.style.display = 'none';
            renderizarCalendario();
            alert("Logout efetuado!");
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

    document.querySelector('.close-modal-btn').onclick =
        () => document.getElementById('eventModal').style.display = "none";

    document.getElementById('eventForm').onsubmit = (e) => {
        e.preventDefault();

        const chave = document.getElementById('eventDate').value;

        const novo = {
            titulo: document.getElementById('title').value,
            type: document.getElementById('type').value,
            hora: document.getElementById('time').value,
            descricao: document.getElementById('description').value // <-- Novo campo
        };

        if (!dadosEventos[chave]) dadosEventos[chave] = [];
        dadosEventos[chave].push(novo);

        localStorage.setItem('ifpr_agenda_v20', JSON.stringify(dadosEventos));

        renderizarListaDeEventos(chave);
        renderizarCalendario();

        e.target.reset();
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
inicializar();