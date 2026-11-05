'use strict';

const { FiscalError, CODIGOS } = require('./errors');

async function carregarCertificado(opcoes) {
    const o = opcoes || {};
    if (!o.secretName || typeof o.acessarSegredo !== 'function') {
        throw new FiscalError(
            CODIGOS.CERTIFICADO_INDISPONIVEL,
            'Certificado A1 não configurado no Secret Manager.',
            503
        );
    }

    const conteudo = await o.acessarSegredo(o.secretName);
    if (!conteudo) {
        throw new FiscalError(CODIGOS.CERTIFICADO_INDISPONIVEL, 'Segredo do certificado vazio.', 503);
    }

    return {
        pfx: Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo, 'base64'),
        passphrase: o.passphrase || ''
    };
}

module.exports = {
    carregarCertificado
};
