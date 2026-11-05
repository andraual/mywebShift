'use strict';

class FiscalProvider {
    constructor(nome) {
        this.nome = nome;
    }

    getNome() {
        return this.nome;
    }

    async emitir(dados) {
        throw new Error('emitir deve ser implementado pelo provedor');
    }

    async consultarStatus(invoiceId) {
        throw new Error('consultarStatus deve ser implementado pelo provedor');
    }

    async obterXml(invoiceId) {
        throw new Error('obterXml deve ser implementado pelo provedor');
    }

    async obterPdf(invoiceId) {
        throw new Error('obterPdf deve ser implementado pelo provedor');
    }

    async cancelar(invoiceId, motivo) {
        throw new Error('cancelamento não implementado neste provedor');
    }
}

module.exports = { FiscalProvider };
