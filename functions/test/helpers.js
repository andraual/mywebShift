'use strict';

function dadosValidos(extra) {
    return Object.assign({
        ambiente: 'homologacao',
        producaoConfirmada: false,
        serie: '1',
        numeroDps: '1',
        dataCompetencia: '2026-10-23',
        valorServico: '100.00',
        prestador: {
            cnpj: '11222333000181',
            im: '123456',
            razaoSocial: 'Prestador de Serviços Médicos Ltda',
            nomeFantasia: 'Clínica Exemplo',
            email: 'fiscal@exemplo.com.br',
            telefone: '11999998888',
            endereco: {
                codigoMunicipio: '3550308',
                cep: '01001000',
                logradouro: 'Praça da Sé',
                numero: '1',
                complemento: 'Sala 1',
                bairro: 'Sé'
            },
            regTrib: {
                opSimpNac: '1',
                regEspTrib: '0'
            }
        },
        servico: {
            cTribNac: '040101',
            cTribMun: '097',
            cNBS: '123012200',
            descricao: 'Consulta médica em clínica',
            aliquota: '5.00',
            tribISSQN: '1',
            tpRetISSQN: '1'
        }
    }, extra || {});
}

function respostaFalsa() {
    const res = {
        statusCode: 0,
        cabecalhos: {},
        corpo: null,
        setHeader: function (nome, valor) { this.cabecalhos[nome] = valor; },
        end: function (texto) { this.corpo = texto ? JSON.parse(texto) : null; }
    };
    return res;
}

function requisicaoFalsa(opcoes) {
    const o = opcoes || {};
    return {
        method: o.method || 'POST',
        url: o.url || '/',
        headers: o.headers || {},
        body: o.body
    };
}

module.exports = {
    dadosValidos,
    respostaFalsa,
    requisicaoFalsa
};
