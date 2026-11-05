'use strict';

const https = require('node:https');
const { AMBIENTES, LIMITES } = require('./config');
const { FiscalError, CODIGOS } = require('./errors');

function criarTransporteReal(opcoes) {
    const o = opcoes || {};
    if (o.transmissaoRealPermitida !== true) {
        throw new FiscalError(
            CODIGOS.TRANSMISSAO_REAL_DESABILITADA,
            'Transmissão real desabilitada por trava de código e variável de ambiente.',
            503
        );
    }

    const ambiente = AMBIENTES[o.ambiente];
    if (!ambiente) throw new FiscalError(CODIGOS.AMBIENTE_INVALIDO, 'Ambiente inválido.', 400);
    if (!o.pfx || !o.passphrase) {
        throw new FiscalError(CODIGOS.CERTIFICADO_INDISPONIVEL, 'Certificado A1 obrigatório.', 503);
    }

    return {
        modo: 'real',
        ambiente: o.ambiente,
        urlBase: ambiente.baseUrl,
        async emitirDps(xml) {
            const corpo = Buffer.from(xml, 'utf8');
            return new Promise(function (resolve, reject) {
                const req = https.request({
                    hostname: new URL(ambiente.baseUrl).hostname,
                    path: new URL(ambiente.baseUrl).pathname + '/nfse',
                    method: 'POST',
                    pfx: o.pfx,
                    passphrase: o.passphrase,
                    headers: {
                        'Content-Type': 'application/xml; charset=utf-8',
                        'Content-Length': corpo.length,
                        Accept: 'application/json'
                    },
                    timeout: LIMITES.timeoutMs
                }, function (res) {
                    const partes = [];
                    let tamanho = 0;
                    res.on('data', function (parte) {
                        tamanho += parte.length;
                        if (tamanho > LIMITES.tamanhoMaximoResposta) {
                            res.destroy(new FiscalError(CODIGOS.ERRO_SEFIN, 'Resposta da Sefin excede o limite.', 502));
                            return;
                        }
                        partes.push(parte);
                    });
                    res.on('error', reject);
                    res.on('end', function () {
                        const texto = Buffer.concat(partes).toString('utf8');
                        let json = null;
                        try { json = texto ? JSON.parse(texto) : null; } catch (erro) { json = null; }
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(json || { corpo: texto });
                            return;
                        }
                        reject(new FiscalError(
                            CODIGOS.ERRO_SEFIN,
                            'Sefin recusou a DPS.',
                            res.statusCode,
                            { resposta: json || texto.slice(0, 2000) }
                        ));
                    });
                });

                req.on('timeout', function () {
                    req.destroy(new FiscalError(CODIGOS.ERRO_SEFIN, 'Tempo limite na Sefin.', 504));
                });
                req.on('error', function (erro) {
                    if (erro instanceof FiscalError) {
                        reject(erro);
                        return;
                    }
                    reject(new FiscalError(CODIGOS.ERRO_SEFIN, 'Falha de comunicação com a Sefin.', 502, { causa: erro.message }));
                });
                req.write(corpo);
                req.end();
            });
        }
    };
}

module.exports = {
    criarTransporteReal
};
