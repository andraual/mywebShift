'use strict';

const crypto = require('node:crypto');
const { AMBIENTES } = require('./config');

function chaveSimulada(idDps) {
    const hash = crypto.createHash('sha256').update(String(idDps)).digest('hex');
    let digitos = '';
    for (let i = 0; i < hash.length && digitos.length < 50; i += 1) {
        digitos += String(parseInt(hash[i], 16) % 10);
    }
    return digitos.padEnd(50, '0').slice(0, 50);
}

function criarTransporteSimulado(opcoes) {
    const o = opcoes || {};
    const agora = o.agora || function () { return new Date(); };

    return {
        modo: 'simulacao',
        async emitirDps(xml, contexto) {
            const idDps = (contexto && contexto.idDps) || '';
            const chaveAcesso = chaveSimulada(idDps);
            return {
                simulado: true,
                idDps: idDps,
                chaveAcesso: chaveAcesso,
                protocolo: 'SIM-' + chaveAcesso.slice(0, 20),
                dataProcessamento: agora().toISOString(),
                mensagem: 'Emissão simulada. Nenhum documento foi transmitido à Sefin.',
                xmlNfse: null
            };
        },
        async consultarDps(idDps) {
            const chaveAcesso = chaveSimulada(idDps);
            return {
                encontrada: true,
                simulado: true,
                idDps: idDps,
                chaveAcesso: chaveAcesso,
                protocolo: 'SIM-' + chaveAcesso.slice(0, 20),
                dataProcessamento: agora().toISOString(),
                mensagem: 'Consulta simulada. Nenhum documento foi transmitido à Sefin.',
                xmlNfse: null
            };
        },
        urlBase: AMBIENTES.homologacao.baseUrl
    };
}

module.exports = {
    chaveSimulada,
    criarTransporteSimulado
};
