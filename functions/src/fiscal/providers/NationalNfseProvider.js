'use strict';

const { FiscalProvider } = require('./FiscalProvider');

class NationalNfseProvider extends FiscalProvider {
    constructor(dependencias) {
        super('nacional');
        this.dependencias = dependencias;
        this.servico = dependencias && dependencias.servico ? dependencias.servico : null;
    }

    async emitir(dados) {
        if (!this.servico || typeof this.servico.emitir !== 'function') {
            throw new Error('Serviço fiscal nacional não configurado.');
        }
        // Preserva implementação existente sem alterações
        return this.servico.emitir(dados);
    }

    async consultarStatus(idDps) {
        if (!this.servico || typeof this.servico.consultar !== 'function') {
            throw new Error('Serviço fiscal nacional não configurado.');
        }
        return this.servico.consultar(idDps);
    }

    async obterXml(invoiceId) {
        throw new Error('obterXml não suportado pelo provedor nacional nesta implementação.');
    }

    async obterPdf(invoiceId) {
        throw new Error('obterPdf não suportado pelo provedor nacional nesta implementação.');
    }

    async cancelar(invoiceId, motivo) {
        throw new Error('cancelamento não suportado pelo provedor nacional nesta implementação.');
    }
}

module.exports = { NationalNfseProvider };
