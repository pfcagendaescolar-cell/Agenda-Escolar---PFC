/**
 * AGENDA ACADÊMICA DIGITAL IFPR - PAINEL ADMIN
 */

// =============================
// ESTADO GLOBAL DE TURMAS
// =============================
let turmas = JSON.parse(localStorage.getItem('ifpr_turmas_v1')) || [];
const CHAVE_EVENTOS = 'ifpr_agenda_v20';

// =============================
// RENDERIZAÇÃO
// =============================
function renderizarTurmas() {
    const lista = document.getElementById('turmasList');
    lista.innerHTML = '';

    if (turmas.length === 0) {
        lista.innerHTML = '<p style="text-align:center; opacity:0.6; margin-top: 30px;">Nenhuma turma cadastrada.</p>';
        return;
    }

    turmas.forEach((turma, index) => {
        const card = document.createElement('div');
        card.className = 'turma-card';

        card.innerHTML = `
            <div class="turma-header">
                <h3>${turma.nome}</h3>
                <span style="font-size:0.8rem; background:var(--primary); color:white; padding:3px 8px; border-radius:12px;">${turma.ano}</span>
            </div>
            <div class="turma-info">
                <p><strong>Curso:</strong> ${turma.curso}</p>
                <p><strong>Líder:</strong> ${turma.lider.nome}</p>
                <p><strong>Vice-Líder:</strong> ${turma.vice.nome}</p>
            </div>
            <div class="admin-actions">
                <button class="btn-edit" onclick="abrirModalEdicao(${index})">Editar</button>
                <button class="btn-delete" onclick="excluirTurma(${index})">Excluir</button>
            </div>
        `;

        lista.appendChild(card);
    });
}

// =============================
// MODAL & FORMULÁRIO
// =============================
const modal = document.getElementById('turmaModal');
const form = document.getElementById('turmaForm');

document.getElementById('btnNovaTurma').onclick = () => {
    form.reset();
    document.getElementById('turmaId').value = '';
    document.getElementById('modalTurmaTitle').innerText = 'Nova Turma';
    modal.style.display = 'flex';
};

document.getElementById('closeTurmaModal').onclick = () => {
    modal.style.display = 'none';
};

window.abrirModalEdicao = (index) => {
    const t = turmas[index];
    document.getElementById('turmaId').value = index;
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

    modal.style.display = 'flex';
};

form.onsubmit = (e) => {
    e.preventDefault();

    const id = document.getElementById('turmaId').value;
    const turmaObj = {
        id: id !== '' ? turmas[id].id : Date.now().toString(), // Gera ID unico se novo
        nome: document.getElementById('tNome').value,
        curso: document.getElementById('tCurso').value,
        ano: document.getElementById('tAno').value,
        lider: {
            nome: document.getElementById('liderNome').value,
            email: document.getElementById('liderEmail').value,
            senha: document.getElementById('liderSenha').value
        },
        vice: {
            nome: document.getElementById('viceNome').value,
            email: document.getElementById('viceEmail').value,
            senha: document.getElementById('viceSenha').value
        }
    };

    if (id !== '') {
        // Editando
        turmas[id] = turmaObj;
    } else {
        // Criando
        turmas.push(turmaObj);
    }

    localStorage.setItem('ifpr_turmas_v1', JSON.stringify(turmas));
    modal.style.display = 'none';
    renderizarTurmas();
};

window.excluirTurma = (index) => {
    if (confirm("Tem certeza que deseja excluir esta turma? Todos os eventos atrelados também serão perdidos no futuro!")) {
        const turmaRemovida = turmas.splice(index, 1)[0];
        localStorage.setItem('ifpr_turmas_v1', JSON.stringify(turmas));

        // No futuro, aqui também deletaria do localStorage de eventos baseados no ID da turma
        // Como o app vanilla atual é de turma única, mantemos simples.

        renderizarTurmas();
    }
};

// =============================
// INICIALIZAÇÃO
// =============================
renderizarTurmas();
