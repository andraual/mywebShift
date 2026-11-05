'use strict';

function somenteDigitos(valor) {
    if (valor === undefined || valor === null) return '';
    return String(valor).replace(/\D/g, '');
}

function normalizarEmail(valor) {
    if (!valor) return undefined;
    const email = String(valor).trim();
    return email || undefined;
}

function normalizarTelefone(valor) {
    const digitos = somenteDigitos(valor);
    return digitos || undefined;
}

function normalizarDocumento(valor) {
    const digitos = somenteDigitos(valor);
    if (!digitos) return {};
    if (digitos.length === 11) {
        return { cpf: digitos };
    }
    if (digitos.length === 14) {
        return { cnpj: digitos };
    }
    return { cnpj: digitos.length === 14 ? digitos : undefined, cpf: digitos.length === 11 ? digitos : undefined };
}

class NotaasMapper {
    constructor() {
        this.nome = 'notaas-mapper';
    }

    paraEmitir(entrada) {
        const e = entrada || {};
        const dados = e.dados || e;
        const tomador = dados.tomador || {};
        const servico = dados.servico || {};
        const valores = dados.valores || {};
        const enderecoTomador = tomador.endereco || {};

        const payload = {};
        // referencia deve ser única e gerada pelo MyShift
        if (e.referencia) {
            payload.referencia = String(e.referencia);
        } else if (dados.referencia) {
            payload.referencia = String(dados.referencia);
        }

        // tomador
        const tomadorPayload = {};
        if (tomador.nome || dados.nomeTomador) tomadorPayload.nome = tomador.nome || dados.nomeTomador;
        const doc = normalizarDocumento(tomador.documento || tomador.cnpj || tomador.cpf || dados.tomadorDocumento);
        if (doc.cnpj) tomadorPayload.cnpj = doc.cnpj;
        if (doc.cpf) tomadorPayload.cpf = doc.cpf;
        if (tomador.nif) tomadorPayload.nif = String(tomador.nif);
        const email = normalizarEmail(tomador.email || dados.tomadorEmail);
        if (email) tomadorPayload.email = email;
        const tel = normalizarTelefone(tomador.telefone || tomador.celular);
        if (tel) tomadorPayload.telefone = tel;
        if (Object.keys(enderecoTomador).length > 0 || tomador.logradouro || tomador.cep) {
            tomadorPayload.endereco = {
                logradouro: enderecoTomador.logradouro || tomador.logradouro,
                numero: enderecoTomador.numero || tomador.numero,
                complemento: enderecoTomador.complemento || tomador.complemento,
                bairro: enderecoTomador.bairro || tomador.bairro,
                cidade: enderecoTomador.cidade || tomador.cidade,
                uf: enderecoTomador.uf || tomador.uf,
                cep: somenteDigitos(enderecoTomador.cep || tomador.cep) || undefined,
                pais: enderecoTomador.pais || tomador.pais
            };
            // remove undefined
            Object.keys(tomadorPayload.endereco).forEach(k => {
                if (tomadorPayload.endereco[k] === undefined || tomadorPayload.endereco[k] === '') delete tomadorPayload.endereco[k];
            });
            if (Object.keys(tomadorPayload.endereco).length === 0) delete tomadorPayload.endereco;
        }
        if (Object.keys(tomadorPayload).length > 0) payload.tomador = tomadorPayload;

        // servico
        const servicoPayload = {};
        if (servico.descricao || dados.descricaoServico) servicoPayload.descricao = servico.descricao || dados.descricaoServico;
        if (servico.codigo || servico.codigoServico || dados.codigoServico) {
            servicoPayload.codigo = servico.codigo || servico.codigoServico || dados.codigoServico;
        }
        if (servico.codigoTributacaoMunicipal || servico.codigoMunicipal) {
            servicoPayload.codigoTributacaoMunicipal = servico.codigoTributacaoMunicipal || servico.codigoMunicipal;
        }
        if (servico.localPrestacao || dados.localPrestacao) {
            servicoPayload.localPrestacao = somenteDigitos(servico.localPrestacao || dados.localPrestacao) || undefined;
        }
        if (servico.nbs || servico.cNBS) servicoPayload.nbs = somenteDigitos(servico.nbs || servico.cNBS) || undefined;
        if (servico.informacoesComplementares) servicoPayload.informacoesComplementares = servico.informacoesComplementares;
        if (servico.pedidoCompra) servicoPayload.pedidoCompra = servico.pedidoCompra;
        if (servico.documentoReferencia) servicoPayload.documentoReferencia = servico.documentoReferencia;
        if (Object.keys(servicoPayload).length > 0) payload.servico = servicoPayload;

        // valores
        const valoresPayload = {};
        const total = valores.total !== undefined ? valores.total : (dados.valorServico !== undefined ? dados.valorServico : dados.valor);
        if (total !== undefined) valoresPayload.total = typeof total === 'string' ? Number(total.replace(',', '.')) : Number(total);
        const aliquota = valores.aliquotaIss !== undefined ? valores.aliquotaIss : (valores.aliquota !== undefined ? valores.aliquota : (servico.aliquotaIss !== undefined ? servico.aliquotaIss : servico.aliquota));
        if (aliquota !== undefined) valoresPayload.aliquotaIss = typeof aliquota === 'string' ? Number(aliquota.replace(',', '.')) : Number(aliquota);
        if (valores.issRetido !== undefined) valoresPayload.issRetido = Boolean(valores.issRetido);
        else if (servico.tpRetISSQN) {
            valoresPayload.issRetido = String(servico.tpRetISSQN) === '2';
        }
        if (valores.descontoIncondicionado !== undefined) valoresPayload.descontoIncondicionado = Number(valores.descontoIncondicionado);
        if (valores.descontoCondicionado !== undefined) valoresPayload.descontoCondicionado = Number(valores.descontoCondicionado);
        if (valores.tribISSQN !== undefined) valoresPayload.tribISSQN = valores.tribISSQN;
        if (Object.keys(valoresPayload).length > 0) payload.valores = valoresPayload;

        // competencia
        if (dados.competencia) payload.competencia = dados.competencia;
        else if (dados.dataCompetencia) {
            const dc = String(dados.dataCompetencia);
            if (/^\d{4}-\d{2}-\d{2}$/.test(dc)) payload.competencia = dc.substring(0, 7);
            else payload.competencia = dc;
        }

        return payload;
    }
}

module.exports = { NotaasMapper };
