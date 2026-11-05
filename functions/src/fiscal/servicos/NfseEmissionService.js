'use strict';

const { FiscalError, CODIGOS } = require('../../errors');

class NfseEmissionService {
    constructor(dependencias) {
        this.dependencias = dependencias || {};
        this.factory = this.dependencias.factory;
        this.provedorConfig = this.dependencias.provedorConfig;
        this.store = this.dependencias.store;
    }

    async _obterProvedor(ctx) {
        if (!this.factory) throw new Error('FiscalProviderFactory não configurado.');
        const empresaId = ctx.empresaId || ctx.cnpj || ctx.uid || 'default';
        let config = { provedor: 'nacional', habilitadoNotaas: false };
        if (this.provedorConfig && typeof this.provedorConfig.obter === 'function') {
            try {
                config = await this.provedorConfig.obter(empresaId);
            } catch (erro) {
                // Em caso de falha, mantém provedor padrão (nacional) por segurança
                config = { provedor: 'nacional', habilitadoNotaas: false };
            }
        }
        if (config.provedor === 'notaas' && config.habilitadoNotaas !== true) {
            // Força provedor nacional caso Notaas não esteja explicitamente habilitada/validada
            return this.factory.obterProvedor('nacional', ctx);
        }
        return this.factory.obterProvedor(config.provedor === 'notaas' ? 'notaas' : 'nacional', ctx);
    }

    async emitir(entrada) {
        const ctx = entrada || {};
        const provedor = await this._obterProvedor(ctx);
        if (!provedor || typeof provedor.emitir !== 'function') {
            throw new FiscalError(CODIGOS.ERRO_INTERNO || 'ERRO_INTERNO', 'Provedor fiscal indisponível.', 503);
        }
        return provedor.emitir(entrada);
    }

    async consultarStatus(entrada) {
        const ctx = entrada || {};
        const provedor = await this._obterProvedor(ctx);
        if (!provedor || typeof provedor.consultarStatus !== 'function') {
            throw new FiscalError(CODIGOS.ERRO_INTERNO || 'ERRO_INTERNO', 'Provedor fiscal indisponível.', 503);
        }
        return provedor.consultarStatus(entrada);
    }

    async obterXml(entrada) {
        const ctx = entrada || {};
        const provedor = await this._obterProvedor(ctx);
        if (!provedor || typeof provedor.obterXml !== 'function') {
            throw new FiscalError(CODIGOS.NAO_ENCONTRADO, 'Recuperação de XML não disponível para este provedor.', 404);
        }
        return provedor.obterXml(entrada);
    }

    async obterPdf(entrada) {
        const ctx = entrada || {};
        const provedor = await this._obterProvedor(ctx);
        if (!provedor || typeof provedor.obterPdf !== 'function') {
            throw new FiscalError(CODIGOS.NAO_ENCONTRADO, 'Recuperação de PDF não disponível para este provedor.', 404);
        }
        return provedor.obterPdf(entrada);
    }

    async cancelar(entrada) {
        const ctx = entrada || {};
        const provedor = await this._obterProvedor(ctx);
        if (!provedor || typeof provedor.cancelar !== 'function') {
            throw new FiscalError(CODIGOS.NAO_ENCONTRADO, 'Cancelamento não disponível para este provedor nesta fase.', 404);
        }
        return provedor.cancelar(entrada);
    }
}

function criarNfseEmissionService(dependencias) {
    return new NfseEmissionService(dependencias);
}

module.exports = { NfseEmissionService, criarNfseEmissionService };
