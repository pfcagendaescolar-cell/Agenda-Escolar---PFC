const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Autenticação via token Bearer e headers compatíveis
const tokenStore = {};
const gerarToken = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

const autenticarToken = (req, res, next) => {
    const authValue = req.headers['authorization'] || req.headers['Authorization'];
    if (typeof authValue === 'string' && authValue.startsWith('Bearer ')) {
        const token = authValue.slice(7).trim();
        const usuario = tokenStore[token];
        if (usuario) {
            req.user = usuario;
            if (!req.headers['x-usuario-email']) req.headers['x-usuario-email'] = usuario.email;
            if (!req.headers['x-usuario-role']) req.headers['x-usuario-role'] = usuario.role;
            if (usuario.role === 'turma_admin' && !req.headers['x-usuario-turma']) req.headers['x-usuario-turma'] = usuario.turmaId;
            if (usuario.role === 'admin' && !req.headers['x-admin-auth']) req.headers['x-admin-auth'] = true;
        }
    }
    next();
};
app.use(autenticarToken);

// Servir frontend estático
app.use(express.static(path.join(__dirname, '..', 'frontend-vanilla')));

const ADMINS_FILE = path.join(__dirname, 'admins.json');
const DB_FILE = path.join(__dirname, 'eventos.json');
const CONTATOS_FILE = path.join(__dirname, 'contatos.json');
const TURMAS_FILE = path.join(__dirname, 'turmas.json');

const lerAdmins = () => {
    try {
        if (!fs.existsSync(ADMINS_FILE)) fs.writeFileSync(ADMINS_FILE, JSON.stringify([]));
        return JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    } catch (e) {
        console.error("Erro ao ler admins.json:", e);
        return [];
    }
};

const salvarAdmins = (dados) => fs.writeFileSync(ADMINS_FILE, JSON.stringify(dados, null, 2));

const lerBanco = () => {
    try {
        if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error("Erro ao ler eventos.json:", e);
        return [];
    }
};

const salvarBanco = (dados) => fs.writeFileSync(DB_FILE, JSON.stringify(dados, null, 2));

const lerContatos = () => {
    if (!fs.existsSync(CONTATOS_FILE)) fs.writeFileSync(CONTATOS_FILE, JSON.stringify([]));
    return JSON.parse(fs.readFileSync(CONTATOS_FILE, 'utf8'));
};

const salvarContatos = (dados) => fs.writeFileSync(CONTATOS_FILE, JSON.stringify(dados, null, 2));

const lerTurmas = () => {
    try {
        if (!fs.existsSync(TURMAS_FILE)) fs.writeFileSync(TURMAS_FILE, JSON.stringify([]));
        return JSON.parse(fs.readFileSync(TURMAS_FILE, 'utf8'));
    } catch (e) {
        console.error("Erro ao ler turmas.json:", e);
        return [];
    }
};

const salvarTurmas = (dados) => fs.writeFileSync(TURMAS_FILE, JSON.stringify(dados, null, 2));

// =============================
// MIDDLEWARE DE AUTORIZAÇÃO POR TURMA
// =============================

/**
 * Middleware para validar acesso à turma
 * Líder só pode acessar eventos da sua turma
 * Admin pode acessar todas as turmas
 */
const validarAcessoTurma = (req, res, next) => {
    // Extrai dados do request
    const turmaIdHeader = req.headers['x-turma-id'];
    const turmaIdBody = req.body?.turmaId;
    const turmaIdParam = req.params?.id;  // Para eventos específicos
    const usuarioLider = req.headers['x-usuario-role'];  // 'lider', 'turma_admin' ou 'admin'
    const usuarioTurmaId = req.headers['x-usuario-turma'];  // turmaId do usuário logado
    const usuarioEmail = req.headers['x-usuario-email'];

    console.log(`\n[AUTH] ${req.method} ${req.path}`);
    console.log(`  - Role: ${usuarioLider}, Turma do Usuário: ${usuarioTurmaId}`);
    console.log(`  - Email: ${usuarioEmail}`);

    // Pegar turmaId da requisição
    let turmaIdRequisicao = turmaIdHeader || turmaIdBody;

    // Se é DELETE/PUT, precisa validar o evento existente
    if ((req.method === 'PUT' || req.method === 'DELETE') && turmaIdParam) {
        const evs = lerBanco();
        const evento = evs.find(e => e._id === turmaIdParam);
        if (evento) {
            turmaIdRequisicao = evento.turmaId;
            console.log(`  - Turma do evento: ${evento.turmaId}`);
        }
    }

    // ✅ ADMIN sempre pode acessar
    if (usuarioLider === 'admin' || req.headers['x-admin-auth']) {
        console.log(`  ✅ Admin autorizado`);
        return next();
    }

    // ❌ LÍDER só pode acessar sua turma
    if (usuarioLider === 'turma_admin' || usuarioLider === 'lider') {
        if (!usuarioTurmaId) {
            console.warn(`🚫 [SEGURANÇA] Requisição de líder sem turmaId do usuário:`, {
                method: req.method,
                path: req.path,
                email: usuarioEmail,
                ip: req.ip
            });
            return res.status(401).json({ error: "Usuário não autenticado corretamente." });
        }

        // Se turmaId não bate, REJEITAR
        if (turmaIdRequisicao && turmaIdRequisicao !== '__geral__' && turmaIdRequisicao !== usuarioTurmaId) {
            console.warn(`🚫 [SEGURANÇA] Tentativa não autorizada de acesso à turma:`, {
                usuarioTurmaId,
                turmaIdRequisicao,
                usuarioLider,
                method: req.method,
                path: req.path,
                ip: req.ip,
                email: usuarioEmail
            });
            
            return res.status(403).json({
                error: "Você só pode acessar eventos da sua própria turma.",
                detalhe: `Sua turma: ${usuarioTurmaId}, Turma solicitada: ${turmaIdRequisicao}`
            });
        }

        console.log(`  ✅ Líder autorizado para turma ${usuarioTurmaId}`);
        return next();
    }

    // ❌ Se não é admin nem líder, rejeitar
    console.warn(`🚫 [SEGURANÇA] Acesso não autorizado:`, {
        role: usuarioLider,
        method: req.method,
        path: req.path,
        ip: req.ip,
        email: usuarioEmail
    });

    res.status(403).json({ error: "Acesso não autorizado." });
};

// =============================
app.post('/auth/login', (req, res) => {
    console.log("--- DEBUG LOGIN (v6.1 - DETALHADO) ---");
    const { email, senha, password } = req.body;
    const passInput = (senha || password || "").trim();
    const emailInput = (email || "").trim().toLowerCase();

    console.log(`Recebido: Email=[${emailInput}], Senha=[${passInput}]`);

    // 1. Tentar encontrar em ADMINS
    const admins = lerAdmins();
    console.log(`Buscando em ${admins.length} admins...`);
    const adminUser = admins.find(a => {
        const storedEmail = (a.email || "").trim().toLowerCase();
        const storedPass = (a.password || "").trim();

        const matchEmail = storedEmail === emailInput;
        const matchPass = storedPass === passInput;

        if (matchEmail) console.log(`  - Email coincide com admin: ${a.nome}`);
        if (matchEmail && matchPass) return true;
        return false;
    });

    if (adminUser) {
        console.log(`✅ Admin autenticado: ${adminUser.nome}`);
        if (adminUser.status === 'pendente') {
            return res.status(403).json({ error: "Aguardando aprovação do Administrador Principal." });
        }
        const token = gerarToken();
        tokenStore[token] = {
            _id: adminUser._id,
            nome: adminUser.nome,
            email: adminUser.email,
            cargo: adminUser.cargo || 'admin',
            role: 'admin',
            status: adminUser.status,
            issuedAt: Date.now()
        };
        return res.json({
            user: {
                _id: adminUser._id,
                nome: adminUser.nome,
                email: adminUser.email,
                cargo: adminUser.cargo || 'admin',
                role: 'admin',
                status: adminUser.status
            },
            token
        });
    }

    // 2. Se não for admin, tentar encontrar em TURMAS (Líder ou Vice)
    const turmas = lerTurmas();
    console.log(`Buscando em ${turmas.length} turmas...`);
    for (const t of turmas) {
        const storedLiderEmail = (t.lider.email || "").trim().toLowerCase();
        const storedLiderPass = (t.lider.senha || "").trim();
        const storedViceEmail = (t.vice.email || "").trim().toLowerCase();
        const storedVicePass = (t.vice.senha || "").trim();

        const matchLiderEmail = storedLiderEmail === emailInput;
        const matchLiderPass = storedLiderPass === passInput;
        const matchViceEmail = storedViceEmail === emailInput;
        const matchVicePass = storedVicePass === passInput;

        if (matchLiderEmail && matchLiderPass) {
            console.log(`✅ Líder autenticado: ${t.lider.nome} (Turma: ${t.nome})`);
            const token = gerarToken();
            tokenStore[token] = {
                _id: t.id,
                nome: t.lider.nome,
                email: emailInput,
                cargo: 'líder',
                role: 'turma_admin',
                turmaId: t.id,
                turmaNome: t.nome,
                issuedAt: Date.now()
            };
            return res.json({
                user: {
                    _id: t.id,
                    nome: t.lider.nome,
                    email: emailInput,
                    cargo: 'líder',
                    role: 'turma_admin',
                    turmaId: t.id,
                    turmaNome: t.nome
                },
                token
            });
        }
        if (matchViceEmail && matchVicePass) {
            console.log(`✅ Vice-Líder autenticado: ${t.vice.nome} (Turma: ${t.nome})`);
            const token = gerarToken();
            tokenStore[token] = {
                _id: t.id,
                nome: t.vice.nome,
                email: emailInput,
                cargo: 'vice-líder',
                role: 'turma_admin',
                turmaId: t.id,
                turmaNome: t.nome,
                issuedAt: Date.now()
            };
            return res.json({
                user: {
                    _id: t.id,
                    nome: t.vice.nome,
                    email: emailInput,
                    cargo: 'vice-líder',
                    role: 'turma_admin',
                    turmaId: t.id,
                    turmaNome: t.nome
                },
                token
            });
        }
    }

    console.log(`❌ Login falhou para: [${emailInput}]`);
    res.status(401).json({ error: "E-mail ou senha incorretos." });
});

// REGISTRO
app.post('/auth/register', (req, res) => {
    const admins = lerAdmins();
    const { nome, email, senha } = req.body;
    const emailInput = (email || "").trim().toLowerCase();

    if (admins.find(a => a.email.toLowerCase() === emailInput)) {
        return res.status(400).json({ error: "E-mail já existe." });
    }

    const isFirst = admins.length === 0;
    const novo = {
        _id: Date.now().toString(),
        nome,
        email: emailInput,
        password: (senha || "").trim(),
        cargo: isFirst ? 'principal' : 'secundario',
        status: isFirst ? 'ativo' : 'pendente'
    };

    admins.push(novo);
    salvarAdmins(admins);
    res.status(201).json({ message: "OK", user: novo });
});

// ATUALIZAR PERFIL (MINHA CONTA)
app.put('/auth/perfil', (req, res) => {
    const { adminId, nome, email, senhaAtual } = req.body;
    const adms = lerAdmins();
    const idx = adms.findIndex(a => a._id === adminId);

    if (idx === -1) return res.status(404).json({ error: "Usuário não encontrado." });

    // Validar senha atual por segurança
    if (adms[idx].password !== senhaAtual) {
        return res.status(401).json({ error: "Senha atual incorreta." });
    }

    // Verificar se novo e-mail já existe em outra conta
    const emailLower = email.trim().toLowerCase();
    const existe = adms.find(a => a.email.toLowerCase() === emailLower && a._id !== adminId);
    if (existe) return res.status(400).json({ error: "E-mail já está em uso por outro administrador." });

    adms[idx].nome = nome;
    adms[idx].email = emailLower;

    salvarAdmins(adms);
    res.json({ message: "Perfil atualizado!" });
});

// ALTERAR SENHA (MINHA CONTA)
app.put('/auth/senha', (req, res) => {
    const { adminId, senhaAtual, novaSenha } = req.body;
    const adms = lerAdmins();
    const idx = adms.findIndex(a => a._id === adminId);

    if (idx === -1) return res.status(404).json({ error: "Usuário não encontrado." });

    if (adms[idx].password !== senhaAtual) {
        return res.status(401).json({ error: "Senha atual incorreta." });
    }

    adms[idx].password = novaSenha.trim();
    salvarAdmins(adms);
    res.json({ message: "Senha alterada!" });
});

// ALTERAR SENHA (MINHA CONTA - LÍDER/VICE)
app.put('/auth/lider/senha', (req, res) => {
    const { email, senhaAtual, novaSenha } = req.body;
    const turmas = lerTurmas();
    let alterado = false;

    const emailInput = (email || "").trim().toLowerCase();

    for (const t of turmas) {
        if (t.lider.email.toLowerCase() === emailInput) {
            if (t.lider.senha !== senhaAtual) return res.status(401).json({ error: "Senha atual incorreta." });
            t.lider.senha = novaSenha.trim();
            alterado = true;
            break;
        }
        if (t.vice.email.toLowerCase() === emailInput) {
            if (t.vice.senha !== senhaAtual) return res.status(401).json({ error: "Senha atual incorreta." });
            t.vice.senha = novaSenha.trim();
            alterado = true;
            break;
        }
    }

    if (alterado) {
        salvarTurmas(turmas);
        return res.json({ message: "Senha alterada com sucesso!" });
    }

    res.status(404).json({ error: "Usuário não encontrado." });
});

// RESETAR SENHA DE OUTRO ADMIN (APENAS PRINCIPAL)
app.put('/auth/admins/reset-password/:id', (req, res) => {
    const { novaSenha } = req.body;
    if (!novaSenha || novaSenha.trim().length < 4) {
        return res.status(400).json({ error: "Nova senha deve ter pelo menos 4 caracteres." });
    }

    const adms = lerAdmins();
    const idx = adms.findIndex(a => a._id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Admin não encontrado." });

    adms[idx].password = novaSenha.trim();
    salvarAdmins(adms);
    res.json({ message: "Senha alterada com sucesso!" });
});

// RECUPERAR CONTA PRINCIPAL COM CÓDIGO
app.post('/auth/recover-principal', (req, res) => {
    const { email, recoveryCode, novaSenha } = req.body;
    const adms = lerAdmins();
    const idx = adms.findIndex(a => a.email.toLowerCase() === email.trim().toLowerCase() && a.cargo === 'principal');

    if (idx === -1) return res.status(404).json({ error: "Administrador Principal não encontrado." });

    if (adms[idx].recoveryCode !== recoveryCode.trim()) {
        return res.status(401).json({ error: "Código de recuperação inválido." });
    }

    adms[idx].password = novaSenha.trim();
    salvarAdmins(adms);
    res.json({ message: "Senha redefinida com sucesso!" });
});

// BUSCAR CÓDIGO DE RECUPERAÇÃO (PARA EXIBIR NO PERFIL)
app.get('/auth/recovery-info/:adminId', (req, res) => {
    const adms = lerAdmins();
    const user = adms.find(a => a._id === req.params.adminId);
    if (!user || user.cargo !== 'principal') return res.status(403).json({ error: "Acesso negado." });
    res.json({ recoveryCode: user.recoveryCode });
});

// EVENTOS
// ✅ SEGURANÇA: GET de todos os eventos - apenas admins
app.get('/eventos', (req, res) => {
    const usuarioRole = req.headers['x-usuario-role'];
    const usuarioEmail = req.headers['x-usuario-email'];
    const turmaIdSolicitada = req.query.turmaId;
    const evs = lerBanco();

    if (turmaIdSolicitada) {
        const filtrados = evs.filter(e => {
            const tipo = (e.tipo || '').toLowerCase();
            return (e.turmaId == turmaIdSolicitada && tipo === 'turma') || tipo === 'geral';
        });
        return res.json(filtrados);
    }

    // ❌ Líderes NÃO podem listar todos os eventos
    if (usuarioRole === 'turma_admin') {
        console.warn(`🚫 [SEGURANÇA] Líder tentou listar todos os eventos:`, {
            email: usuarioEmail,
            ip: req.ip
        });
        return res.status(403).json({
            error: "Você não tem permissão para listar todos os eventos. Use /eventos/turma/:id ou /eventos?turmaId=<id>"
        });
    }

    // ✅ Apenas admins podem listar todos os eventos
    res.json(evs);
});

app.get('/eventos/geral', (req, res) => {
    const evs = lerBanco();
    // Agora filtramos explicitamente pelo campo 'tipo'
    const filtrados = evs.filter(e => e.tipo === 'geral');
    res.json(filtrados);
});

app.get('/eventos/turma/:id', (req, res) => {
    // ✅ Todos podem VER eventos de qualquer turma (com seus filtros)
    // Restrições de modificação estão no middleware POST/PUT/DELETE
    const turmaIdSolicitada = req.params.id;

    const evs = lerBanco();
    // Filtra por ID da turma (tipo turma) OU eventos institucionais (tipo geral)
    const filtrados = evs.filter(e => (e.turmaId == turmaIdSolicitada && e.tipo === 'turma') || e.tipo === 'geral');
    res.json(filtrados);
});

// ✅ POST eventos - COM VALIDAÇÃO DE TURMA
app.post('/eventos', validarAcessoTurma, (req, res) => {
    const evs = lerBanco();
    const usuarioRole = req.headers['x-usuario-role'];
    const usuarioTurmaId = req.headers['x-usuario-turma'];
    const usuarioEmail = req.headers['x-usuario-email'];

    // ❌ Líder NÃO pode criar eventos gerais
    if (usuarioRole === 'turma_admin' && req.body.tipo === 'geral') {
        console.warn(`🚫 [SEGURANÇA] Líder tentou criar evento GERAL:`, {
            email: usuarioEmail,
            turma: usuarioTurmaId
        });
        return res.status(403).json({
            error: "Líderes não podem criar eventos gerais. Entre em contato com o administrador."
        });
    }

    // ❌ Líder NÃO pode especificar turmaId diferente da sua
    if (usuarioRole === 'turma_admin' && req.body.turmaId !== usuarioTurmaId) {
        console.warn(`🚫 [SEGURANÇA] Líder tentou criar evento em outra turma:`, {
            email: usuarioEmail,
            turmaSua: usuarioTurmaId,
            turmaRequisitada: req.body.turmaId
        });
        return res.status(403).json({
            error: "Você só pode criar eventos da sua própria turma."
        });
    }

    // ✅ Garantir que o turmaId está correto
    const novoEvento = {
        _id: Date.now().toString(),
        ...req.body,
        turmaId: usuarioRole === 'turma_admin' ? usuarioTurmaId : req.body.turmaId,
        criadoPor: usuarioRole,
        usuarioId: usuarioEmail || 'unknown',
        criadoEm: new Date().toISOString()
    };

    console.log(`✅ [EVENTO] Novo evento criado:`, {
        id: novoEvento._id,
        turma: novoEvento.turmaId,
        tipo: novoEvento.tipo,
        criador: usuarioRole
    });

    evs.push(novoEvento);
    salvarBanco(evs);
    res.json(novoEvento);
});

// ✅ PUT eventos - COM VALIDAÇÃO DE TURMA
app.put('/eventos/:id', validarAcessoTurma, (req, res) => {
    const evs = lerBanco();
    const i = evs.findIndex(e => e._id === req.params.id);
    const usuarioRole = req.headers['x-usuario-role'];
    const usuarioTurmaId = req.headers['x-usuario-turma'];
    const usuarioEmail = req.headers['x-usuario-email'];

    if (i === -1) {
        return res.status(404).json({ error: "Evento não encontrado." });
    }

    const eventoAntigo = evs[i];

    // ❌ Não permitir mudar tipo de evento (turma → geral ou vice-versa)
    if (req.body.tipo && req.body.tipo !== eventoAntigo.tipo) {
        console.warn(`🚫 [SEGURANÇA] Tentativa de mudar tipo de evento:`, {
            eventoId: req.params.id,
            tipoAntigo: eventoAntigo.tipo,
            tipoNovo: req.body.tipo,
            usuario: usuarioEmail
        });
        return res.status(403).json({
            error: "Não é permitido mudar o tipo de evento."
        });
    }

    // ❌ Não permitir mudar turmaId do evento
    if (req.body.turmaId && req.body.turmaId !== eventoAntigo.turmaId) {
        console.warn(`🚫 [SEGURANÇA] Tentativa de mudar turmaId do evento:`, {
            eventoId: req.params.id,
            turmaAntiga: eventoAntigo.turmaId,
            turmaNova: req.body.turmaId,
            usuario: usuarioEmail
        });
        return res.status(403).json({
            error: "Não é permitido mudar a turma do evento."
        });
    }

    evs[i] = { ...evs[i], ...req.body, updatedAt: new Date().toISOString() };

    console.log(`✅ [EVENTO] Evento atualizado:`, {
        id: req.params.id,
        turma: evs[i].turmaId,
        atualizadoPor: usuarioRole
    });

    salvarBanco(evs);
    res.json(evs[i]);
});

// ✅ DELETE eventos - COM VALIDAÇÃO DE TURMA
app.delete('/eventos/:id', validarAcessoTurma, (req, res) => {
    const evs = lerBanco();
    const eventoParaDeleter = evs.find(e => e._id === req.params.id);
    const usuarioRole = req.headers['x-usuario-role'];
    const usuarioEmail = req.headers['x-usuario-email'];

    if (!eventoParaDeleter) {
        return res.status(404).json({ error: "Evento não encontrado." });
    }

    console.log(`✅ [EVENTO] Evento deletado:`, {
        id: req.params.id,
        turma: eventoParaDeleter.turmaId,
        deletadoPor: usuarioRole
    });

    const filtrados = evs.filter(e => e._id !== req.params.id);
    salvarBanco(filtrados);
    res.json({ ok: true, removido: req.params.id });
});

// CONTATOS
app.get('/contatos', (req, res) => res.json(lerContatos()));
app.post('/contatos', (req, res) => {
    const c = lerContatos();
    const novo = { _id: Date.now().toString(), ...req.body };
    c.push(novo);
    salvarContatos(c);
    res.json(novo);
});
app.delete('/contatos/:id', (req, res) => {
    const filtrados = lerContatos().filter(c => c._id !== req.params.id);
    salvarContatos(filtrados);
    res.json({ ok: true });
});

// ADMINS LIST
app.get('/admins', (req, res) => res.json(lerAdmins().map(({ password, recoveryCode, ...rest }) => rest)));

// TURMAS CRUD - ✅ Apenas admins podem gerenciar turmas
app.get('/turmas', (req, res) => {
    // ✅ Qualquer um pode VER turmas (para login e seleção)
    res.json(lerTurmas());
});

app.post('/turmas', (req, res) => {
    // ❌ Apenas admins podem criar turmas
    const usuarioRole = req.headers['x-usuario-role'];
    if (usuarioRole !== 'admin' && !req.headers['x-admin-auth']) {
        return res.status(403).json({ error: "Apenas administradores podem criar turmas." });
    }

    const t = lerTurmas();
    const novo = { ...req.body };
    if (!novo.id) novo.id = Date.now().toString();
    t.push(novo);
    salvarTurmas(t);
    res.status(201).json(novo);
});

app.put('/turmas/:id', (req, res) => {
    // ❌ Apenas admins podem editar turmas
    const usuarioRole = req.headers['x-usuario-role'];
    if (usuarioRole !== 'admin' && !req.headers['x-admin-auth']) {
        return res.status(403).json({ error: "Apenas administradores podem editar turmas." });
    }

    const t = lerTurmas();
    const idx = t.findIndex(item => item.id == req.params.id);
    if (idx !== -1) {
        t[idx] = { ...t[idx], ...req.body };
        salvarTurmas(t);
        res.json(t[idx]);
    } else {
        res.status(404).json({ error: "Turma não encontrada" });
    }
});

app.delete('/turmas/:id', (req, res) => {
    // ❌ Apenas admins podem deletar turmas
    const usuarioRole = req.headers['x-usuario-role'];
    if (usuarioRole !== 'admin' && !req.headers['x-admin-auth']) {
        return res.status(403).json({ error: "Apenas administradores podem deletar turmas." });
    }

    const t = lerTurmas();
    const filtrados = t.filter(item => item.id != req.params.id);
    salvarTurmas(filtrados);

    // Cascade delete: remover eventos desta turma
    const evs = lerBanco();
    const evsRestantes = evs.filter(e => e.turmaId != req.params.id);
    salvarBanco(evsRestantes);

    res.json({ ok: true, removedEvents: evs.length - evsRestantes.length });
});

// 🧪 ROTA DE DEBUG - VALIDAR HEADERS
app.post('/debug/validar-headers', (req, res) => {
    res.json({
        headers: {
            'x-usuario-email': req.headers['x-usuario-email'],
            'x-usuario-role': req.headers['x-usuario-role'],
            'x-usuario-turma': req.headers['x-usuario-turma'],
            'x-admin-auth': req.headers['x-admin-auth']
        },
        body: req.body,
        method: req.method,
        ip: req.ip
    });
});

app.put('/admins/aprovar/:id', (req, res) => {
    const adms = lerAdmins();
    const i = adms.findIndex(a => a._id === req.params.id);
    if (i !== -1) { adms[i].status = 'ativo'; salvarAdmins(adms); res.json(adms[i]); }
    else res.status(404).json({ error: "N/A" });
});
app.delete('/admins/:id', (req, res) => {
    const adms = lerAdmins();
    const novos = adms.filter(a => a._id !== req.params.id);
    salvarAdmins(novos);
    res.json({ ok: true });
});

const PORT = 3000;
const server = app.listen(PORT, () => {
    console.log(`--- SERVIDOR v5 REPARADO NA PORTA ${PORT} ---`);
    console.log(`--- Acesso local: http://localhost:${PORT} ---`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`!!! ERRO: A porta ${PORT} já está em uso por outro programa. !!!`);
        console.error(`Certifique-se de fechar outras janelas do terminal que estejam rodando o servidor.`);
    } else {
        console.error("Erro ao iniciar o servidor:", err);
    }
});