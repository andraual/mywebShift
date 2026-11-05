'use strict';

const crypto = require('node:crypto');
const { FiscalProvider } = require('../providers/FiscalProvider');
const { NotaasClient } = require('./NotaasClient');
const { NotaasMapper } = require('./NotaasMapper');
const { FiscalError, CODIGOS } = require('../../errors');

function gerarReferencia(uid, dados) {
    const base = String(uid || '') + '|' + Date.now().toString() + '|' + Math.random().toString(36).slice(2);
    return 'MWS-' + crypto.createHash('sha256').update(base).digest('hex').slice(0, 20).toUpperCase();
}

function mapearErro(status, data) {
    const msg = (data && (data.message || data.mensagem || data.error || (data.erro && (data.erro.mensagem || data.erro.message))))) || 'Erro na API Notaas';
    if (status === 401) return new FiscalError('NOTAAS_NAO_AUTENTICADO', 'Chave API da Notaas ausente ou inválida.', 401);
    if (status === 402) return new FiscalError('NOTAAS_SEM_RECURSO', msg, 402);
    if (status === 403) return new FiscalError('NOTAAS_SEM_PERMISSAO', msg, 403);
    if (status === 404) return new FiscalError(CODIGOS.DPS_NAO_ENCONTRADA, msg, 404);
    if (status === 422) return new FiscalError(CODIGOS.VALIDACAO, msg, 422, data);
    if (status === 429) return new FiscalError(CODIGOS.LIMITE_EXCEDIDO, msg, 429, data);
    if (status === 400) return new FiscalError(CODIGOS.VALIDACAO, msg, 400, data);
    if (status === 409) return new FiscalError(CODIGOS.IDEMPOTENCIA_INVALIDA || 'NOTAAS_CONFLITO', msg, 409, data);
    if (status >= 500) return new FiscalError(CODIGOS.ERRO_SEFIN, 'Falha do serviço externo Notaas.', 502, data);
    return new FiscalError(CODIGOS.ERRO_SEFIN, msg, status || 502, data);
}

class NotaasNfseProvider extends FiscalProvider {
    constructor(dependencias) {
        super('notaas');
        this.dependencias = dependencias || {};
        this.client = this.dependencias.client || new NotaasClient(this.dependencias.config || {});
        this.mapper = this.dependencias.mapper || new NotaasMapper();
        this.store = this.dependencias.store || null;
    }

    async emitir(entrada) {
        const e = entrada || {};
        if (!e.uid) throw new FiscalError(CODIGOS.NAO_AUTENTICADO, 'Autenticação obrigatória.', 401);
        const dados = e.dados || e;
        const referencia = dados.referencia || gerarReferencia(e.uid, dados);
        const payload = this.mapper.paraEmitir(Object.assign({}, e, { dados: dados, referencia: referencia }));

        // Idempotência/registro prévio se houver store
        if (this.store && typeof this.store.reservar === 'function' && e.chaveIdempotencia) {
            try {
                const agora = new Date().toISOString();
                const reserva = await this.store.reservar(e.uid, e.chaveIdempotencia, {
                    uid: String(e.uid),
                    chaveIdempotencia: e.chaveIdempotencia,
                    provedor: 'notaas',
                    status: 'processando',
                    referencia: referencia,
                    criadoEm: agora,
                    atualizadoEm: agora
                });
                if (!reserva.reservado) {
                    const registro = reserva.registro || {};
                    if (registro.status === 'processada' && registro.invoiceId) {
                        return Object.assign({}, registro, { idempotente: true, provedor: 'notaas' });
                    }
                    if (registro.status === 'processando') {
                        throw new FiscalError(CODIGOS.EMISSAO_EM_PROCESSAMENTO, 'Já existe uma emissão em processamento para esta chave de idempotência.', 409);
                    }
                    if (registro.status === 'falhou') {
                        throw new FiscalError(CODIGOS.EMISSAO_FALHOU, 'Esta chave de idempotência já foi usada em uma tentativa que falhou. Use uma nova chave após conferir o motivo.', 409);
                    }
                }
            } catch (erro) {
                if (erro instanceof FiscalError) throw erro;
                // Se store falhar, não enviar cegamente; seguir com cuidado mas registrar erro crítico
                throw erro;
            }
        }

        const resposta = await this.client.emitir(payload);
        if (resposta.status === 202 || resposta.status === 200) {
            const data = resposta.data || {};
            const resultado = {
                provedor: 'notaas',
                invoiceId: data.invoiceId || data.id || null,
                referencia: data.referencia || referencia,
                status: data.status || 'queued',
                pollUrl: data.pollUrl || null,
                queued: data.queued === true,
                idempotente: false
            };
            if (this.store && typeof this.store.concluir === 'function' && e.chaveIdempotencia) {
                try {
                    await this.store.concluir(e.uid, e.chaveIdempotencia, Object.assign({}, resultado, { status: 'processando', atualizadoEm: new Date().toISOString() }));
                } catch (erro) {
                    // não falhar por falha de persistência
                }
            }
            return resultado;
        }
        throw mapearErro(resposta.status, resposta.data);
    }

    async consultarStatus(entrada) {
        const e = entrada || {};
        if (!e.uid) throw new FiscalError(CODIGOS.NAO_AUTENTICADO, 'Autenticação obrigatória.', 401);
        const invoiceId = e.invoiceId || e.id || e.dados && e.dados.invoiceId;
        if (!invoiceId) throw new FiscalError(CODIGOS.VALIDACAO, 'invoiceId obrigatório.', 400);
        const resposta = await this.client.consultarStatus(invoiceId);
        if (resposta.status === 200) {
            const data = resposta.data || {};
            const resultado = {
                provedor: 'notaas',
                invoiceId: data.invoiceId || invoiceId,
                referencia: data.referencia || null,
                status: data.status,
                chNFSe: data.chNFSe || null,
                numeroNfe: data.numeroNfe || null,
                emittedAt: data.emittedAt || null,
                ambiente: data.ambiente || null,
                pdfUrl: data.pdfUrl || null,
                xmlUrl: data.xmlUrl || null,
                documentsCached: data.documentsCached === true,
                cancelOutcome: data.cancelOutcome || null,
                cod_rejeicao: data.cod_rejeicao || data.errorCode || null,
                msg_rejeicao: data.msg_rejeicao || data.errorMessage || null,
                errors: data.rejection_errors || data.errors || null,
                cancelRequestedAt: data.cancelRequestedAt || null,
                cancelDecisionAt: data.cancelDecisionAt || null,
                cancelledAt: data.cancelledAt || null,
                cancelXmlUrl: data.cancelXmlUrl || null
            };
            if (resultado.status === 'issued' && this.store && typeof this.store.concluir === 'function' && e.chaveIdempotencia) {
                try {
                    await this.store.concluir(e.uid, e.chaveIdempotencia, Object.assign({}, resultado, { status: 'processada', atualizadoEm: new Date().toISOString() }));
                } catch (erro) {
                    // ignore
                }
            }
            if (resultado.status === 'error' && this.store && typeof this.store.falhar === 'function' && e.chaveIdempotencia) {
                try {
                    await this.store.falhar(e.uid, e.chaveIdempotencia, { erroCodigo: resultado.cod_rejeicao || 'NOTAAS_ERRO', mensagem: resultado.msg_rejeicao || null, atualizadoEm: new Date().toISOString() });
                } catch (erro) {
                    // ignore
                }
            }
            return resultado;
        }
        throw mapearErro(resposta.status, resposta.data);
    }

    async obterXml(entrada) {
        const e = entrada || {};
        if (!e.uid) throw new FiscalError(CODIGOS.NAO_AUTENTICADO, 'Autenticação obrigatória.', 401);
        const invoiceId = e.invoiceId || e.id;
        if (!invoiceId) throw new FiscalError(CODIGOS.VALIDACAO, 'invoiceId obrigatório.', 400);
        const tipo = e.tipo || e.type;
        const resposta = await this.client.obterXml(invoiceId, tipo);
        if (resposta.status === 200) {
            return { provedor: 'notaas', xml: resposta.texto || (typeof resposta.data === 'string' ? resposta.data : JSON.stringify(resposta.data)), tipo: tipo || 'emission' };
        }
        if (resposta.status === 302) {
            return { provedor: 'notaas', redirect: resposta.headers.location || resposta.headers.Location || null, tipo: tipo || 'emission' };
        }
        throw mapearErro(resposta.status, resposta.data);
    }

    async obterPdf(entrada) {
        const e = entrada || {};
        if (!e.uid) throw new FiscalError(CODIGOS.NAO_AUTENTICADO, 'Autenticação obrigatória.', 401);
        const invoiceId = e.invoiceId || e.id;
        if (!invoiceId) throw new FiscalError(CODIGOS.VALIDACAO, 'invoiceId obrigatório.', 400);
        const resposta = await this.client.obterPdf(invoiceId);
        if (resposta.status === 302) {
            return { provedor: 'notaas', redirect: resposta.headers.location || resposta.headers.Location || null };
        }
        if (resposta.status === 200) {
            return { provedor: 'notaas', pdf: resposta.data, contentType: resposta.headers['content-type'] || 'application/pdf' };
        }
        throw mapearErro(resposta.status, resposta.data);
    }

    async cancelar(entrada) {
        const e = entrada || {};
        if (!e.uid) throw new FiscalError(CODIGOS.NAO_AUTENTICADO, 'Autenticação obrigatória.', 401);
        const invoiceId = e.invoiceId || e.id;
        if (!invoiceId) throw new FiscalError(CODIGOS.VALIDACAO, 'invoiceId obrigatório.', 400);
        const payload = {
            invoiceId: invoiceId,
            motivo: e.motivo || e.justificativa || e.xMotivo,
            codigoMotivo: e.codigoMotivo || e.cMotivo
        };
        Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
        const resposta = await this.client.cancelar(payload);
        if (resposta.status === 200 || resposta.status === 202) {
            return Object.assign({ provedor: 'notaas' }, resposta.data || {});
        }
        throw mapearErro(resposta.status, resposta.data);
    }
}

module.exports = { NotaasNfseProvider };
