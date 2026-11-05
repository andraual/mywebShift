'use strict';

const { FiscalError, CODIGOS } = require('./errors');

function criarAssinadorSimulado() {
    return {
        modo: 'simulacao',
        async assinar(xml) {
            return { xml: xml, simulado: true, algoritmo: null };
        }
    };
}

function criarAssinadorReal() {
    return {
        modo: 'real',
        async assinar() {
            throw new FiscalError(
                CODIGOS.ASSINATURA_REAL_DESABILITADA,
                'Assinatura XMLDSig real desabilitada. Requer certificado A1, implementação validada e homologação.',
                503
            );
        }
    };
}

module.exports = {
    criarAssinadorSimulado,
    criarAssinadorReal
};
