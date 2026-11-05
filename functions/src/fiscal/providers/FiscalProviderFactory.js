'use strict';

const { NationalNfseProvider } = require('./NationalNfseProvider');

class FiscalProviderFactory {
    constructor(dependencias) {
        this.dependencias = dependencias || {};
        this.provedores = new Map();
    }

    registrar(nome, provedor) {
        if (!nome) return;
        this.provedores.set(String(nome).toLowerCase(), provedor);
        return this;
    }

    obterProvedor(nome, contexto) {
        const chave = String(nome || 'nacional').toLowerCase();
        if (this.provedores.has(chave)) {
            return this.provedores.get(chave);
        }
        if (chave === 'nacional') {
            const provedor = new NationalNfseProvider(this.dependencias.nacional || { servico: this.dependencias.servico });
            this.provedores.set(chave, provedor);
            return provedor;
        }
        // Por padrão, sempre volta ao provedor nacional para não misturar fluxos
        const provedorPadrao = new NationalNfseProvider(this.dependencias.nacional || { servico: this.dependencias.servico });
        return provedorPadrao;
    }
}

function criarFiscalProviderFactory(dependencias) {
    return new FiscalProviderFactory(dependencias);
}

module.exports = { FiscalProviderFactory, criarFiscalProviderFactory };
