'use strict';

const { FiscalProvider } = require('./FiscalProvider');
const { NationalNfseProvider } = require('./NationalNfseProvider');

module.exports = {
    FiscalProvider,
    NationalNfseProvider
};

const { FiscalProviderFactory, criarFiscalProviderFactory } = require('./FiscalProviderFactory');
const { NotaasNfseProvider } = require('../notaas/NotaasNfseProvider');

module.exports = {
    FiscalProvider,
    NationalNfseProvider,
    NotaasNfseProvider,
    FiscalProviderFactory,
    criarFiscalProviderFactory
};
