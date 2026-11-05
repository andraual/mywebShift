'use strict';

const TRANSMISSAO_REAL_HABILITADA = false;

const AMBIENTES = {
    homologacao: {
        nome: 'homologacao',
        tpAmb: '2',
        baseUrl: 'https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional'
    },
    producao: {
        nome: 'producao',
        tpAmb: '1',
        baseUrl: 'https://sefin.nfse.gov.br/API/SefinNacional'
    }
};

const LIMITES = {
    valorMaximo: 999999999.99,
    aliquotaMaxima: 9.99,
    timeoutMs: 45000,
    tamanhoMaximoCorpo: 64 * 1024,
    tamanhoMaximoResposta: 1024 * 1024,
    emissoesPorMinuto: 10,
    consultasPorMinuto: 60
};

function transmissaoRealPermitida(env) {
    const ambiente = env || process.env;
    if (TRANSMISSAO_REAL_HABILITADA !== true) return false;
    return ambiente.NFS_E_TRANSMISSAO_REAL === 'true';
}

function carregarConfig(env) {
    const ambiente = env || process.env;
    return {
        regiao: ambiente.NFS_E_REGIAO || 'southamerica-east1',
        origensPermitidas: (ambiente.NFS_E_ORIGENS || '')
            .split(',')
            .map(function (item) { return item.trim(); })
            .filter(Boolean),
        transmissaoReal: transmissaoRealPermitida(ambiente),
        certificadoSecret: ambiente.NFS_E_CERTIFICADO_SECRET || '',
        certificadoSenhaSecret: ambiente.NFS_E_CERTIFICADO_SENHA_SECRET || '',
        projeto: ambiente.GCLOUD_PROJECT || ambiente.GCP_PROJECT || ''
    };
}

module.exports = {
    TRANSMISSAO_REAL_HABILITADA,
    AMBIENTES,
    LIMITES,
    transmissaoRealPermitida,
    carregarConfig
};


// Configurações Notaas (adicionais)
const NOTAAS_CONFIG = {
    habilitado: process.env.NOTAAS_HABILITADO === 'true',
    apiKeyEnv: 'NOTAAS_API_KEY',
    baseUrl: 'https://platform.notaas.com.br/api/v1'
};

function notaasHabilitado() {
    return NOTAAS_CONFIG.habilitado === true;
}

module.exports.NOTAAS_CONFIG = NOTAAS_CONFIG;
module.exports.notaasHabilitado = notaasHabilitado;
