'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const { carregarConfig, LIMITES } = require('./src/config');
const { erroAutenticacao } = require('./src/errors');
const { FirestoreStore } = require('./src/store');
const { FirestoreSequenceStore } = require('./src/sequence');
const { criarServico } = require('./src/service');
const { criarAssinadorSimulado } = require('./src/signer');
const { criarTransporteSimulado } = require('./src/transport-simulado');
const { LimitadorJanela } = require('./src/rate-limit');
const {
    criarHandlerEmissao,
    criarHandlerConsulta,
    criarHandlerStatus
} = require('./src/handlers');

admin.initializeApp();

const config = carregarConfig();
const store = new FirestoreStore(admin.firestore());
const sequenceStore = new FirestoreSequenceStore(admin.firestore());
const transporte = criarTransporteSimulado();
const assinador = criarAssinadorSimulado();
const servico = criarServico({
    store: store,
    sequenceStore: sequenceStore,
    transporte: transporte,
    assinador: assinador,
    config: config
});

const limiteEmissao = new LimitadorJanela({ limite: LIMITES.emissoesPorMinuto, janelaMs: 60000 });
const limiteConsulta = new LimitadorJanela({ limite: LIMITES.consultasPorMinuto, janelaMs: 60000 });

async function autenticar(req) {
    const cabecalho = req.headers.authorization || '';
    const partes = cabecalho.split(' ');
    if (partes.length !== 2 || partes[0] !== 'Bearer' || !partes[1]) throw erroAutenticacao();
    try {
        const decodificado = await admin.auth().verifyIdToken(partes[1], true);
        return { uid: decodificado.uid };
    } catch (erro) {
        throw erroAutenticacao('Token inválido ou revogado.');
    }
}

const opcoes = { region: config.regiao };

exports.status = onRequest(opcoes, criarHandlerStatus(config));
exports.emissao = onRequest(opcoes, criarHandlerEmissao({
    autenticar: autenticar,
    servico: servico,
    origensPermitidas: config.origensPermitidas,
    limitador: limiteEmissao
}));
exports.consulta = onRequest(opcoes, criarHandlerConsulta({
    autenticar: autenticar,
    servico: servico,
    origensPermitidas: config.origensPermitidas,
    limitador: limiteConsulta
}));

// Módulo Notaas - integração independente
const { criarFiscalProviderFactory } = require('./src/fiscal/providers/FiscalProviderFactory');
const { NotaasNfseProvider } = require('./src/fiscal/providers/NotaasNfseProvider');
const { NationalNfseProvider } = require('./src/fiscal/providers/NationalNfseProvider');
const { criarProvedorConfigStore } = require('./src/fiscal/configuracao/provedor-config');
const { criarNfseEmissionService } = require('./src/fiscal/servicos/NfseEmissionService');
const {
    criarHandlerNotaasConfig,
    criarHandlerNotaasEmitir,
    criarHandlerNotaasStatus,
    criarHandlerNotaasDocumentos
} = require('./src/routes/notaas');
const { NotaasClient } = require('./src/fiscal/notaas/NotaasClient');

const provedorConfigStore = criarProvedorConfigStore(admin.firestore());
const notaasClient = new NotaasClient({});
const notaasProvider = new NotaasNfseProvider({ client: notaasClient, store: store });

const factoryNotaas = criarFiscalProviderFactory({ servico: servico });
factoryNotaas.registrar('nacional', new NationalNfseProvider({ servico: servico }));
factoryNotaas.registrar('notaas', notaasProvider);

const nfseEmissionServiceNotaas = criarNfseEmissionService({
    factory: factoryNotaas,
    provedorConfig: provedorConfigStore,
    store: store
});

exports.notaasConfig = onRequest(opcoes, criarHandlerNotaasConfig({
    autenticar: autenticar,
    provedorConfig: provedorConfigStore,
    origensPermitidas: config.origensPermitidas,
    limitadorConsulta: limiteConsulta
}));

exports.notaasEmitir = onRequest(opcoes, criarHandlerNotaasEmitir({
    autenticar: autenticar,
    nfseEmissionService: nfseEmissionServiceNotaas,
    origensPermitidas: config.origensPermitidas,
    limitadorEmissao: limiteEmissao
}));

exports.notaasStatus = onRequest(opcoes, criarHandlerNotaasStatus({
    autenticar: autenticar,
    nfseEmissionService: nfseEmissionServiceNotaas,
    origensPermitidas: config.origensPermitidas,
    limitadorConsulta: limiteConsulta
}));

exports.notaasDocumentos = onRequest(opcoes, criarHandlerNotaasDocumentos({
    autenticar: autenticar,
    nfseEmissionService: nfseEmissionServiceNotaas,
    origensPermitidas: config.origensPermitidas,
    limitadorConsulta: limiteConsulta
}));
