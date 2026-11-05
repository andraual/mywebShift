'use strict';

const { FiscalError, CODIGOS, erroAutenticacao } = require('./errors');
const { LIMITES } = require('./config');

function normalizarOrigem(valor) {
    return String(valor == null ? '' : valor).replace(/\/+$/, '');
}

function aplicarCors(req, res, origensPermitidas) {
    const origem = normalizarOrigem(req.headers.origin);
    const permitidas = (origensPermitidas || []).map(normalizarOrigem).filter(Boolean);
    if (!origem || permitidas.length === 0) return;
    if (!permitidas.includes(origem)) return;

    res.setHeader('Access-Control-Allow-Origin', origem);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Idempotency-Key');
    res.setHeader('Access-Control-Max-Age', '600');
}

function aplicarLimite(limitador, chave) {
    if (!limitador) return;
    const resultado = limitador.consumir(chave);
    if (resultado.permitido) return;
    throw new FiscalError(CODIGOS.LIMITE_EXCEDIDO, 'Limite de requisições excedido.', 429, {
        reiniciaEm: new Date(resultado.reiniciaEm).toISOString()
    });
}

function responder(res, status, corpo) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(corpo));
}

function responderErro(res, erro) {
    if (erro instanceof FiscalError) {
        responder(res, erro.status, {
            ok: false,
            erro: { codigo: erro.codigo, mensagem: erro.message, detalhes: erro.detalhes }
        });
        return;
    }
    console.error('Erro inesperado no backend fiscal:', erro && erro.code ? erro.code : 'sem_codigo');
    responder(res, 500, {
        ok: false,
        erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno no backend fiscal.' }
    });
}

async function lerCorpo(req) {
    if (req.body && typeof req.body === 'object') {
        let tamanho = 0;
        try {
            tamanho = Buffer.byteLength(JSON.stringify(req.body));
        } catch (erro) {
            throw new FiscalError(CODIGOS.CORPO_INVALIDO, 'Corpo da requisição inválido.', 400);
        }
        if (tamanho > LIMITES.tamanhoMaximoCorpo) {
            throw new FiscalError(CODIGOS.CORPO_INVALIDO, 'Corpo da requisição excede o limite.', 413);
        }
        return req.body;
    }
    if (typeof req.body === 'string') {
        if (Buffer.byteLength(req.body) > LIMITES.tamanhoMaximoCorpo) {
            throw new FiscalError(CODIGOS.CORPO_INVALIDO, 'Corpo da requisição excede o limite.', 413);
        }
        try { return JSON.parse(req.body); } catch (erro) { throw new FiscalError(CODIGOS.CORPO_INVALIDO, 'Corpo JSON inválido.', 400); }
    }

    const partes = [];
    let tamanho = 0;
    await new Promise(function (resolve, reject) {
        req.on('data', function (parte) {
            tamanho += parte.length;
            if (tamanho > LIMITES.tamanhoMaximoCorpo) {
                reject(new FiscalError(CODIGOS.CORPO_INVALIDO, 'Corpo da requisição excede o limite.', 413));
                req.destroy();
                return;
            }
            partes.push(parte);
        });
        req.on('end', resolve);
        req.on('error', reject);
    });

    const texto = Buffer.concat(partes).toString('utf8');
    if (!texto) return {};
    try {
        return JSON.parse(texto);
    } catch (erro) {
        throw new FiscalError(CODIGOS.CORPO_INVALIDO, 'Corpo JSON inválido.', 400);
    }
}

function criarHandlerEmissao(dependencias) {
    const deps = dependencias || {};
    return async function (req, res) {
        aplicarCors(req, res, deps.origensPermitidas);
        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }
        if (req.method !== 'POST') {
            responder(res, 405, { ok: false, erro: { codigo: 'METODO_NAO_PERMITIDO', mensagem: 'Use POST.' } });
            return;
        }

        try {
            if (typeof deps.autenticar !== 'function') throw erroAutenticacao();
            const usuario = await deps.autenticar(req);
            if (!usuario || !usuario.uid) throw erroAutenticacao();
            aplicarLimite(deps.limitador, 'emissao:' + usuario.uid);

            const corpo = await lerCorpo(req);
            const chaveIdempotencia = req.headers['x-idempotency-key'] || corpo.chaveIdempotencia;
            const resultado = await deps.servico.emitir({
                uid: usuario.uid,
                chaveIdempotencia: chaveIdempotencia,
                dados: corpo
            });
            responder(res, resultado.idempotente ? 200 : 201, { ok: true, resultado: resultado });
        } catch (erro) {
            responderErro(res, erro);
        }
    };
}

function criarHandlerConsulta(dependencias) {
    const deps = dependencias || {};
    return async function (req, res) {
        aplicarCors(req, res, deps.origensPermitidas);
        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }
        if (req.method !== 'GET') {
            responder(res, 405, { ok: false, erro: { codigo: 'METODO_NAO_PERMITIDO', mensagem: 'Use GET.' } });
            return;
        }

        try {
            const raw = String(req.originalUrl || req.url || '');
            if (raw.indexOf('..') !== -1 || /%2e/i.test(raw)) {
                throw new FiscalError(CODIGOS.VALIDACAO, 'idDps inválido.', 400);
            }

            if (typeof deps.autenticar !== 'function') throw erroAutenticacao();
            const usuario = await deps.autenticar(req);
            if (!usuario || !usuario.uid) throw erroAutenticacao();
            aplicarLimite(deps.limitador, 'consulta:' + usuario.uid);

            const url = new URL(req.url || '/', 'http://localhost');
            const segmento = url.pathname.split('/').filter(Boolean).pop() || '';
            let idDps = url.searchParams.get('idDps') || segmento;
            try {
                idDps = decodeURIComponent(idDps);
            } catch (erro) {
                throw new FiscalError(CODIGOS.VALIDACAO, 'idDps inválido.', 400);
            }
            if (String(idDps).indexOf('..') !== -1 || String(idDps).indexOf('/') !== -1) {
                throw new FiscalError(CODIGOS.VALIDACAO, 'idDps inválido.', 400);
            }
            const resultado = await deps.servico.consultar({ uid: usuario.uid, idDps: idDps });
            responder(res, 200, { ok: true, resultado: resultado });
        } catch (erro) {
            responderErro(res, erro);
        }
    };
}

function criarHandlerStatus(config) {
    const cfg = config || {};
    return function (req, res) {
        aplicarCors(req, res, cfg.origensPermitidas);
        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }
        responder(res, 200, {
            ok: true,
            servico: 'mywebshift-fiscal',
            versao: '0.1.0',
            nodeMajor: process.versions.node.split('.')[0],
            modo: 'simulacao',
            transmissaoReal: false,
            ambientes: ['homologacao', 'producao'],
            regiao: cfg.regiao || null,
            aviso: 'Transmissão fiscal real desabilitada. Nenhuma NFS-e é emitida.'
        });
    };
}

module.exports = {
    aplicarCors,
    responder,
    responderErro,
    lerCorpo,
    criarHandlerEmissao,
    criarHandlerConsulta,
    criarHandlerStatus
};
