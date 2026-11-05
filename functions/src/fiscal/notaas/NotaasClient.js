'use strict';

const https = require('node:https');
const { URL } = require('node:url');
const { FiscalError } = require('../../errors');

const BASE_URL = 'https://platform.notaas.com.br/api/v1';

function obterChaveApi() {
    return process.env.NOTAAS_API_KEY || process.env.NOTAA_S_API_KEY || '';
}

class NotaasClient {
    constructor(opcoes) {
        const o = opcoes || {};
        this.baseUrl = o.baseUrl || BASE_URL;
        this.apiKey = o.apiKey !== undefined ? o.apiKey : obterChaveApi();
        this.timeoutMs = o.timeoutMs || 45000;
        this.userAgent = o.userAgent || 'mywebshift-notaas-client/0.1.0';
    }

    _montarHeaders() {
        if (!this.apiKey) {
            throw new FiscalError('NOTAAS_API_KEY_AUSENTE', 'Chave API da Notaas não configurada no backend.', 503);
        }
        return {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'User-Agent': this.userAgent
        };
    }

    _requisicao(metodo, caminho, corpo) {
        const url = new URL(caminho, this.baseUrl);
        const headers = this._montarHeaders();
        let payload = null;
        if (corpo !== undefined && corpo !== null) {
            payload = Buffer.from(JSON.stringify(corpo), 'utf8');
            headers['Content-Length'] = payload.length;
        }
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname + (url.search || ''),
                method: metodo,
                headers: headers,
                timeout: this.timeoutMs
            }, (res) => {
                const partes = [];
                let tamanho = 0;
                const max = 1024 * 1024;
                res.on('data', (parte) => {
                    tamanho += parte.length;
                    if (tamanho > max) {
                        res.destroy(new FiscalError('NOTAAS_RESPOSTA_GRANDE', 'Resposta da Notaas excede o limite permitido.', 502));
                        return;
                    }
                    partes.push(parte);
                });
                res.on('error', reject);
                res.on('end', () => {
                    const texto = Buffer.concat(partes).toString('utf8');
                    let json = null;
                    if (texto) {
                        try {
                            json = JSON.parse(texto);
                        } catch (erro) {
                            json = { bruto: texto };
                        }
                    }
                    resolve({
                        status: res.statusCode,
                        headers: res.headers || {},
                        data: json,
                        texto: texto
                    });
                });
            });
            req.on('timeout', () => {
                req.destroy(new FiscalError('NOTAAS_TIMEOUT', 'Tempo limite na comunicação com a API Notaas.', 504));
            });
            req.on('error', (erro) => {
                if (erro instanceof FiscalError) {
                    reject(erro);
                    return;
                }
                reject(new FiscalError('NOTAAS_ERRO_COMUNICACAO', 'Falha de comunicação com a API Notaas.', 502));
            });
            if (payload) {
                req.write(payload);
            }
            req.end();
        });
    }

    async emitir(payload) {
        return this._requisicao('POST', '/emitir', payload);
    }

    async consultarStatus(invoiceId) {
        const id = encodeURIComponent(String(invoiceId));
        return this._requisicao('GET', '/invoices/' + id + '/status');
    }

    async obterXml(invoiceId, tipo) {
        const id = encodeURIComponent(String(invoiceId));
        let caminho = '/invoices/' + id + '/xml';
        if (tipo) {
            caminho += '?type=' + encodeURIComponent(String(tipo));
        }
        return this._requisicao('GET', caminho);
    }

    async obterPdf(invoiceId) {
        const id = encodeURIComponent(String(invoiceId));
        return this._requisicao('GET', '/invoices/' + id + '/pdf');
    }

    async cancelar(payload) {
        return this._requisicao('POST', '/cancelar', payload);
    }
}

module.exports = { NotaasClient, BASE_URL };
