/**
 * Montagem do identificador e da prévia XML da DPS (versão 1.01).
 * A prévia NÃO é assinada e NÃO é transmitida.
 */
(function (global) {
    'use strict';

    const Catalog = global.FiscalCatalog || {};
    const Validators = global.FiscalValidators || {};

    function somenteDigitos(valor) {
        return String(valor == null ? '' : valor).replace(/\D/g, '');
    }

    function escaparXml(valor) {
        return String(valor == null ? '' : valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function tag(nome, valor) {
        return '<' + nome + '>' + escaparXml(valor) + '</' + nome + '>';
    }

    function tagOpcional(nome, valor) {
        if (valor === null || valor === undefined || String(valor).trim() === '') return '';
        return tag(nome, valor);
    }

    function formatarValor(valor) {
        const numero = Number(String(valor == null ? '' : valor).replace(',', '.'));
        if (!isFinite(numero)) throw new Error('Valor monetário inválido.');
        return numero.toFixed(2);
    }

    function formatarDataHora(data) {
        const d = data ? new Date(data) : new Date();
        const pad = function (n) { return String(n).padStart(2, '0'); };
        const offset = -d.getTimezoneOffset();
        const sinal = offset >= 0 ? '+' : '-';
        const absoluto = Math.abs(offset);
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
            'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
            sinal + pad(Math.floor(absoluto / 60)) + ':' + pad(absoluto % 60);
    }

    function tipoInscricao(documento) {
        const digitos = somenteDigitos(documento);
        if (digitos.length === 11) return '1';
        if (digitos.length === 14) return '2';
        throw new Error('Documento do prestador deve ser CPF ou CNPJ.');
    }

    function montarIdDps(opcoes) {
        const o = opcoes || {};
        const municipio = somenteDigitos(o.codigoMunicipio);
        if (municipio.length !== 7) throw new Error('Código IBGE do município deve ter 7 dígitos.');

        const documento = somenteDigitos(o.inscricaoFederal);
        const tipo = tipoInscricao(documento);
        const serie = somenteDigitos(o.serie).padStart(5, '0').slice(-5);
        const numero = somenteDigitos(o.numero).padStart(15, '0');
        if (numero.length !== 15) throw new Error('Número da DPS inválido.');

        const id = 'DPS' + municipio + tipo + documento.padStart(14, '0') + serie + numero;
        if (id.length !== 45) throw new Error('Identificador da DPS deve ter 45 caracteres.');
        return id;
    }

    function montarEndereco(endereco) {
        const e = endereco || {};
        let xml = '<end>';
        xml += '<endNac>' + tag('cMun', e.codigoMunicipio) + tag('CEP', somenteDigitos(e.cep)) + '</endNac>';
        xml += tag('xLgr', e.logradouro);
        xml += tag('nro', e.numero);
        xml += tagOpcional('xCpl', e.complemento);
        xml += tag('xBairro', e.bairro);
        xml += '</end>';
        return xml;
    }

    function montarPrestador(prestador) {
        const p = prestador || {};
        const documento = somenteDigitos(p.cnpj);
        const tagDocumento = documento.length === 11 ? 'CPF' : 'CNPJ';
        const regTrib = p.regTrib || {};

        let xml = '<prest>';
        xml += tag(tagDocumento, documento);
        xml += tagOpcional('IM', p.im);
        xml += tagOpcional('xNome', p.razaoSocial);
        xml += montarEndereco(p.endereco);
        xml += tagOpcional('fone', somenteDigitos(p.telefone));
        xml += tagOpcional('email', p.email);
        xml += '<regTrib>';
        xml += tag('opSimpNac', regTrib.opSimpNac || '1');
        if (String(regTrib.opSimpNac) === '3') {
            xml += tag('regApTribSN', regTrib.regApTribSN);
        }
        xml += tag('regEspTrib', regTrib.regEspTrib || '0');
        xml += '</regTrib>';
        xml += '</prest>';
        return xml;
    }

    function montarTomador(tomador) {
        const t = tomador || {};
        const documento = somenteDigitos(t.documento);
        if (!documento) return '';

        const tagDocumento = documento.length === 11 ? 'CPF' : 'CNPJ';
        let xml = '<toma>';
        xml += tag(tagDocumento, documento);
        xml += tag('xNome', t.nome);
        xml += tagOpcional('email', t.email);
        xml += '</toma>';
        return xml;
    }

    function montarServico(config, dados) {
        const servico = (config && config.servico) || {};
        const endereco = (config && config.prestador && config.prestador.endereco) || {};
        const local = dados.localPrestacao || servico.localPrestacao || endereco.codigoMunicipio;
        const descricao = dados.descricaoServico || servico.descricao;

        let xml = '<serv>';
        xml += '<locPrest>' + tag('cLocPrestacao', local) + '</locPrest>';
        xml += '<cServ>';
        xml += tag('cTribNac', servico.cTribNac);
        xml += tagOpcional('cTribMun', servico.cTribMun);
        xml += tag('xDescServ', descricao);
        xml += tagOpcional('cNBS', servico.cNBS);
        xml += '</cServ>';
        xml += '</serv>';
        return xml;
    }

    function montarValores(config, dados) {
        const servico = (config && config.servico) || {};
        let xml = '<valores>';
        xml += '<vServPrest>';
        if (dados.valorRecebido !== undefined && dados.valorRecebido !== null && String(dados.valorRecebido).trim() !== '') {
            xml += tag('vReceb', formatarValor(dados.valorRecebido));
        }
        xml += tag('vServ', formatarValor(dados.valorServico));
        xml += '</vServPrest>';
        xml += '<trib>';
        xml += '<tribMun>';
        xml += tag('tribISSQN', servico.tribISSQN || '1');
        xml += tag('tpRetISSQN', servico.tpRetISSQN || '1');
        if (servico.aliquota !== undefined && servico.aliquota !== null && String(servico.aliquota).trim() !== '') {
            xml += tag('pAliq', formatarValor(servico.aliquota));
        }
        xml += '</tribMun>';
        xml += '<totTrib><indTotTrib>0</indTotTrib></totTrib>';
        xml += '</trib>';
        xml += '</valores>';
        return xml;
    }

    function gerarXmlDps(opcoes) {
        const o = opcoes || {};
        const config = o.config || {};
        const prestador = config.prestador || {};
        const endereco = prestador.endereco || {};
        const serie = somenteDigitos(o.serie || config.serie || '1').padStart(5, '0').slice(-5);
        const numero = somenteDigitos(o.numeroDps || config.proximoNumeroDps || '1').replace(/^0+(?=\d)/, '');
        const ambiente = (Catalog.AMBIENTES || {})[config.ambiente] || '2';

        const id = montarIdDps({
            codigoMunicipio: endereco.codigoMunicipio,
            inscricaoFederal: prestador.cnpj,
            serie: serie,
            numero: numero
        });

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<!-- Prévia gerada pelo MyWebShift sem assinatura digital. Não possui validade fiscal. -->\n';
        xml += '<DPS xmlns="' + Catalog.NAMESPACE_NFSE + '" versao="' + Catalog.VERSAO_LEIAUTE_DPS + '">\n';
        xml += '  <infDPS Id="' + escaparXml(id) + '">\n';
        xml += '    ' + tag('tpAmb', ambiente) + '\n';
        xml += '    ' + tag('dhEmi', formatarDataHora(o.dhEmi)) + '\n';
        xml += '    ' + tag('verAplic', 'MyWebShift-1.0') + '\n';
        xml += '    ' + tag('serie', serie) + '\n';
        xml += '    ' + tag('nDPS', numero) + '\n';
        xml += '    ' + tag('dCompet', o.dataCompetencia) + '\n';
        xml += '    ' + tag('tpEmit', '1') + '\n';
        xml += '    ' + tag('cLocEmi', endereco.codigoMunicipio) + '\n';
        xml += '    ' + montarPrestador(prestador) + '\n';
        const tomador = montarTomador(o.tomador);
        if (tomador) xml += '    ' + tomador + '\n';
        xml += '    ' + montarServico(config, o) + '\n';
        xml += '    ' + montarValores(config, o) + '\n';
        xml += '  </infDPS>\n';
        xml += '</DPS>\n';
        return xml;
    }

    global.FiscalDps = {
        escaparXml,
        formatarValor,
        formatarDataHora,
        montarIdDps,
        gerarXmlDps
    };
})(typeof window !== 'undefined' ? window : globalThis);
