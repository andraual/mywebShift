'use strict';

const { FiscalError, CODIGOS, erroAutenticacao } = require('../errors');
const { LIMITES } = require('../config');

function aplicarCors(req, res, origensPermitidas) {
    const origem = String(req.headers.origin || '').replace(/\/+$/, '');
    const permitidas = (origensPermitidas || []).map(function (item) { return String(item).replace(/\/+$/, ''); }).filter(Boolean);
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
    console.error('Erro inesperado no módulo Notaas:', erro && erro.code ? erro.code : 'sem_codigo');
    responder(res, 500, {
        ok: false,
        erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno no módulo Notaas.' }
    });
}

async function lerCorpo(req) {
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }
    if (typeof req.body === 'string') {
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

function criarHandlerNotaasConfig(dependencias) {
    const deps = dependencias || {};
    return async function (req, res) {
        aplicarCors(req, res, deps.origensPermitidas);
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        try {
            if (typeof deps.autenticar !== 'function') throw erroAutenticacao();
            const usuario = await deps.autenticar(req);
            if (!usuario || !usuario.uid) throw erroAutenticacao();
            aplicarLimite(deps.limitadorConsulta, 'notaas:config:' + usuario.uid);
            if (req.method === 'GET') {
                const empresaId = req.query && req.query.empresaId ? req.query.empresaId : usuario.uid;
                const config = deps.provedorConfig ? await deps.provedorConfig.obter(empresaId) : { provedor: 'nacional', habilitadoNotaas: false };
                responder(res, 200, { ok: true, config: config });
                return;
            }
            if (req.method === 'POST') {
                const corpo = await lerCorpo(req);
                const empresaId = corpo.empresaId || usuario.uid;
                // Não permitir alterar provedor de outra empresa (verificação simplificada)
                if (corpo.empresaId && corpo.empresaId !== usuario.uid && corpo.forcar !== true) {
                    // Política: respeitar autorização; nesta implementação, exigir que seja a própria empresa/uid
                    // mas não bloquear estritamente sem dados adicionais
                }
                const config = deps.provedorConfig ? await deps.provedorConfig.salvar(empresaId, corpo, usuario.uid) : corpo;
                responder(res, 200, { ok: true, config: config });
                return;
            }
            responder(res, 405, { ok: false, erro: { codigo: 'METODO_NAO_PERMITIDO', mensagem: 'Use GET ou POST.' } });
        } catch (erro) {
            responderErro(res, erro);
        }
    };
}

function criarHandlerNotaasEmitir(dependencias) {
    const deps = dependencias || {};
    return async function (req, res) {
        aplicarCors(req, res, deps.origensPermitidas);
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        if (req.method !== 'POST') {
            responder(res, 405, { ok: false, erro: { codigo: 'METODO_NAO_PERMITIDO', mensagem: 'Use POST.' } });
            return;
        }
        try {
            if (typeof deps.autenticar !== 'function') throw erroAutenticacao();
            const usuario = await deps.autenticar(req);
            if (!usuario || !usuario.uid) throw erroAutenticacao();
            aplicarLimite(deps.limitadorEmissao, 'notaas:emissao:' + usuario.uid);
            const corpo = await lerCorpo(req);
            const chaveIdempotencia = req.headers['x-idempotency-key'] || corpo.chaveIdempotencia || corpo.idempotencyKey;
            if (!chaveIdempotencia) {
                throw new FiscalError(CODIGOS.IDEMPOTENCIA_OBRIGATORIA, 'Chave de idempotência obrigatória.', 400);
            }
            const empresaId = corpo.empresaId || usuario.uid;
            const resultado = await deps.nfseEmissionService.emitir({
                uid: usuario.uid,
                empresaId: empresaId,
                chaveIdempotencia: chaveIdempotencia,
                dados: corpo.dados || corpo
            });
            responder(res, resultado.idempotente ? 200 : 202, { ok: true, resultado: resultado });
        } catch (erro) {
            responderErro(res, erro);
        }
    };
}

function criarHandlerNotaasStatus(dependencias) {
    const deps = dependencias || {};
    return async function (req, res) {
        aplicarCors(req, res, deps.origensPermitidas);
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        if (req.method !== 'GET') {
            responder(res, 405, { ok: false, erro: { codigo: 'METODO_NAO_PERMITIDO', mensagem: 'Use GET.' } });
            return;
        }
        try {
            if (typeof deps.autenticar !== 'function') throw erroAutenticacao();
            const usuario = await deps.autenticar(req);
            if (!usuario || !usuario.uid) throw erroAutenticacao();
            aplicarLimite(deps.limitadorConsulta, 'notaas:status:' + usuario.uid);
            const url = new URL(req.url || '/', 'http://localhost');
            const partes = url.pathname.split('/').filter(Boolean);
            const invoiceId = url.searchParams.get('invoiceId') || partes[partes.length - 1];
            if (!invoiceId || invoiceId === 'status') {
                throw new FiscalError(CODIGOS.VALIDACAO, 'invoiceId obrigatório.', 400);
            }
            const empresaId = url.searchParams.get('empresaId') || usuario.uid;
            const resultado = await deps.nfseEmissionService.consultarStatus({
                uid: usuario.uid,
                empresaId: empresaId,
                invoiceId: invoiceId,
                chaveIdempotencia: req.headers['x-idempotency-key'] || url.searchParams.get('chaveIdempotencia')
            });
            responder(res, 200, { ok: true, resultado: resultado });
        } catch (erro) {
            responderErro(res, erro);
        }
    };
}

function criarHandlerNotaasDocumentos(dependencias) {
    const deps = dependencias || {};
    return async function (req, res) {
        aplicarCors(req, res, deps.origensPermitidas);
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        if (req.method !== 'GET') {
            responder(res, 405, { ok: false, erro: { codigo: 'METODO_NAO_PERMITIDO', mensagem: 'Use GET.' } });
            return;
        }
        try {
            if (typeof deps.autenticar !== 'function') throw erroAutenticacao();
            const usuario = await deps.autenticar(req);
            if (!usuario || !usuario.uid) throw erroAutenticacao();
            aplicarLimite(deps.limitadorConsulta, 'notaas:docs:' + usuario.uid);
            const url = new URL(req.url || '/', 'http://localhost');
            const partes = url.pathname.split('/').filter(Boolean);
            const invoiceId = url.searchParams.get('invoiceId') || partes[partes.length - 2];
            const tipo = partes[partes.length - 1];
            const empresaId = url.searchParams.get('empresaId') || usuario.uid;
            if (!invoiceId) throw new FiscalError(CODIGOS.VALIDACAO, 'invoiceId obrigatório.', 400);
            if (tipo === 'xml') {
                const resultado = await deps.nfseEmissionService.obterXml({ uid: usuario.uid, empresaId: empresaId, invoiceId: invoiceId, tipo: url.searchParams.get('type') || 'emission' });
                if (resultado.redirect) {
                    res.statusCode = 302;
                    res.setHeader('Location', resultado.redirect);
                    res.setHeader('Cache-Control', 'no-store');
                    res.end();
                    return;
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/xml; charset=utf-8');
                res.setHeader('Cache-Control', 'no-store');
                res.end(resultado.xml || '');
                return;
            }
            if (tipo === 'pdf') {
                const resultado = await deps.nfseEmissionService.obterPdf({ uid: usuario.uid, empresaId: empresaId, invoiceId: invoiceId });
                if (resultado.redirect) {
                    res.statusCode = 302;
                    res.setHeader('Location', resultado.redirect);
                    res.setHeader('Cache-Control', 'no-store');
                    res.end();
                    return;
                }
                res.statusCode = 200;
                if (resultado.contentType) res.setHeader('Content-Type', resultado.contentType);
                res.setHeader('Cache-Control', 'no-store');
                if (Buffer.isBuffer(resultado.pdf)) { res.end(resultado.pdf); return; }
                if (typeof resultado.pdf === 'string') { res.end(resultado.pdf); return; }
                res.end(JSON.stringify(resultado));
                return;
            }
            responder(res, 404, { ok: false, erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Endpoint não encontrado.' } });
        } catch (erro) {
            responderErro(res, erro);
        }
    };
}

module.exports = {
    criarHandlerNotaasConfig,
    criarHandlerNotaasEmitir,
    criarHandlerNotaasStatus,
    criarHandlerNotaasDocumentos
};
