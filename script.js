// CONFIGURAÇÕES INICIAIS
const PRIORITIES = { "prova": 1, "trabalho": 2, "tarefa": 3, "evento": 4 };

// Simulação de Feriados e Férias (Pode ser expandido)
const HOLIDAYS = {
    "2023-10-12": "Nossa Sra Aparecida",
    "2023-11-02": "Finados",
    "2023-11-15": "Proclamação da República",
    "2023-12-25": "Natal"
};

const VACATIONS = [
    { start: "2023-07-10", end: "2023-07-24", name: "Recesso Escolar" },
    { start: "2023-12-20", end: "2023-12-31", name: "Férias de Verão" }
];

let currentViewDate = new Date();
let events = JSON.parse(localStorage.getItem('ifpr_agenda_v6')) || {};
let isLoggedIn = false;

function init() {
    renderCalendar();
    loadTheme();
    setupListeners();
}

// Verifica se uma data está no período de férias
function isVacation(dateKey) {
    const d = new Date(dateKey);
    return VACATIONS.some(v => d >= new Date(v.start) && d <= new Date(v.end));
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthDisplay = document.getElementById('monthDisplay');
    grid.innerHTML = '';
    
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    monthDisplay.innerText = `${months[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    for (let x = 0; x < firstDay; x++) grid.appendChild(document.createElement('div'));

    for (let i = 1; i <= lastDate; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        dayDiv.innerText = i;
        
        const dateKey = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const dayOfWeek = new Date(year, month, i).getDay();

        // 1. Identificar se é Final de Semana ou Férias (Sem aula básico)
        if (dayOfWeek === 0 || dayOfWeek === 6 || isVacation(dateKey)) {
            dayDiv.classList.add('day-off');
        }

        // 2. Identificar se é Feriado (Destaque maior)
        if (HOLIDAYS[dateKey]) {
            dayDiv.classList.add('day-holiday');
        }

        // 3. Sobrepor Cor de Atividade Acadêmica se existir
        if (events[dateKey] && events[dateKey].length > 0) {
            const topType = events[dateKey].reduce((p, c) => PRIORITIES[c.type] < PRIORITIES[p.type] ? c : p).type;
            dayDiv.classList.add(`has-${topType}`);
        }

        dayDiv.onclick = () => openModal(dateKey);
        grid.appendChild(dayDiv);
    }
}

function openModal(dateKey) {
    document.getElementById('eventDate').value = dateKey;
    document.getElementById('modalDateTitle').innerText = dateKey.split('-').reverse().join('/');
    
    // Mostrar nome do feriado se houver
    const holidayInfo = document.getElementById('holidayName');
    holidayInfo.innerText = HOLIDAYS[dateKey] ? `🚩 FERIADO: ${HOLIDAYS[dateKey]}` : "";
    
    renderEventsList(dateKey);
    document.getElementById('eventModal').style.display = "flex";
}

function setupListeners() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('menuOverlay');

    // Menu Hambúrguer
    document.getElementById('menuIcon').onclick = () => { sidebar.classList.add('active'); overlay.classList.add('active'); };
    const closeMenu = () => { sidebar.classList.remove('active'); overlay.classList.remove('active'); };
    document.getElementById('closeSidebar').onclick = closeMenu;
    overlay.onclick = closeMenu;

    // Login
    document.getElementById('btnLogin').onclick = () => {
        if(prompt("Senha do Líder:") === "ifpr123") {
            isLoggedIn = true;
            document.getElementById('adminStatus').style.display = 'block';
            document.getElementById('loginArea').style.display = 'none';
            document.getElementById('adminFormArea').style.display = 'block';
            document.getElementById('statusIndicator').innerText = "🛠️";
            renderCalendar();
            closeMenu();
        }
    };

    document.getElementById('btnLogout').onclick = () => location.reload();

    // Navegação e Outros...
    document.getElementById('prevMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth()-1); renderCalendar(); };
    document.getElementById('nextMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth()+1); renderCalendar(); };
    document.querySelector('.close-modal').onclick = () => document.getElementById('eventModal').style.display = "none";
    
    document.getElementById('themeToggle').onchange = (e) => {
        const t = e.target.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
    };

    // Salvar Atividade
    document.getElementById('eventForm').onsubmit = (e) => {
        e.preventDefault();
        const key = document.getElementById('eventDate').value;
        const newEv = { title: document.getElementById('title').value, type: document.getElementById('type').value, time: document.getElementById('time').value };
        if(!events[key]) events[key] = [];
        events[key].push(newEv);
        localStorage.setItem('ifpr_agenda_v6', JSON.stringify(events));
        renderEventsList(key);
        renderCalendar();
        e.target.reset();
    };
}

function renderEventsList(dateKey) {
    const list = document.getElementById('eventsList');
    list.innerHTML = "";
    (events[dateKey] || []).forEach((ev, i) => {
        const item = document.createElement('div');
        item.className = `event-item ${ev.type}`;
        item.innerHTML = `<strong>${ev.title}</strong><br><small>${ev.time || '--:--'}</small>`;
        list.appendChild(item);
    });
}

function loadTheme() {
    const t = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
    document.getElementById('themeToggle').checked = (t === 'dark');
}

init();