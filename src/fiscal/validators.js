/**
 * Validações locais dos dados fiscais e da DPS.
 */
(function (global) {
    'use strict';

    const Catalog = global.FiscalCatalog || {};

    function somenteDigitos(valor) {
        return String(valor == null ? '' : valor).replace(/\D/g, '');
    }

    function validarCpf(valor) {
        const cpf = somenteDigitos(valor);
        if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

        let soma = 0;
        for (let i = 0; i < 9; i++) soma += Number(cpf[i]) * (10 - i);
        let resto = (soma * 10) % 11;
        if (resto === 10) resto = 0;
        if (resto !== Number(cpf[9])) return false;

        soma = 0;
        for (let i = 0; i < 10; i++) soma += Number(cpf[i]) * (11 - i);
        resto = (soma * 10) % 11;
        if (resto === 10) resto = 0;
        return resto === Number(cpf[10]);
    }

    function validarCnpj(valor) {
        const cnpj = somenteDigitos(valor);
        if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

        const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

        function digito(base, pesos) {
            let soma = 0;
            for (let i = 0; i < pesos.length; i++) soma += Number(base[i]) * pesos[i];
            const resto = soma % 11;
            return resto < 2 ? 0 : 11 - resto;
        }

        const d1 = digito(cnpj, pesos1);
        if (d1 !== Number(cnpj[12])) return false;
        const d2 = digito(cnpj, pesos2);
        return d2 === Number(cnpj[13]);
    }

    function validarCep(valor) {
        return /^\d{8}$/.test(somenteDigitos(valor));
    }

    function validarCodigoIbge(valor) {
        return /^\d{7}$/.test(somenteDigitos(valor)) && somenteDigitos(valor) !== '0000000';
    }

    function validarEmail(valor) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || '').trim());
    }

    function validarTelefone(valor) {
        const digitos = somenteDigitos(valor);
        return digitos.length >= 10 && digitos.length <= 11;
    }

    function validarDataISO(valor) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''))) return false;
        const partes = String(valor).split('-').map(Number);
        const data = new Date(partes[0], partes[1] - 1, partes[2]);
        return data.getFullYear() === partes[0] &&
            data.getMonth() === partes[1] - 1 &&
            data.getDate() === partes[2];
    }

    function validarValorMonetario(valor) {
        const texto = String(valor == null ? '' : valor).trim().replace(',', '.');
        if (!/^(0|[1-9]\d{0,14})(\.\d{1,2})?$/.test(texto)) return false;
        return Number(texto) > 0;
    }

    function validarAliquota(valor) {
        if (valor === '' || valor === null || valor === undefined) return true;
        const texto = String(valor).trim().replace(',', '.');
        if (!/^(0|[0-9](\.\d{1,2})?)$/.test(texto)) return false;
        const numero = Number(texto);
        return numero >= 0 && numero <= 9.99;
    }

    function umaDasOpcoes(valor, opcoes) {
        return opcoes.some(function (opcao) { return opcao.valor === String(valor); });
    }

    function validarConfig(config) {
        const erros = [];
        const avisos = [];
        const c = config || {};
        const prestador = c.prestador || {};
        const endereco = prestador.endereco || {};
        const regTrib = prestador.regTrib || {};
        const servico = c.servico || {};

        if (!['homologacao', 'producao'].includes(c.ambiente)) {
            erros.push('Ambiente deve ser homologação ou produção.');
        }
        if (c.ambiente === 'producao' && !c.producaoConfirmada) {
            erros.push('A emissão em produção exige confirmação explícita.');
        }

        const tipo = String(prestador.tipoInscricao || 'CNPJ').toUpperCase();
        if (tipo !== 'CNPJ' && tipo !== 'CPF') {
            erros.push('Tipo de inscrição do prestador inválido.');
        } else if (tipo === 'CNPJ' && !validarCnpj(prestador.cnpj)) {
            erros.push('CNPJ do prestador inválido.');
        } else if (tipo === 'CPF' && !validarCpf(prestador.cnpj)) {
            erros.push('CPF do prestador inválido.');
        }

        if (!String(prestador.razaoSocial || '').trim()) {
            erros.push('Razão social do prestador é obrigatória.');
        } else if (String(prestador.razaoSocial).trim().length > 150) {
            erros.push('Razão social deve ter até 150 caracteres.');
        }
        if (!String(prestador.im || '').trim()) {
            avisos.push('Inscrição municipal não informada; alguns municípios exigem o campo.');
        } else if (String(prestador.im).trim().length > 15) {
            erros.push('Inscrição municipal deve ter até 15 caracteres.');
        }
        if (prestador.email && !validarEmail(prestador.email)) {
            erros.push('E-mail do prestador inválido.');
        }
        if (prestador.telefone && !validarTelefone(prestador.telefone)) {
            erros.push('Telefone do prestador deve ter DDD + número.');
        }

        if (!String(endereco.logradouro || '').trim()) erros.push('Logradouro do prestador é obrigatório.');
        if (!String(endereco.numero || '').trim()) erros.push('Número do endereço do prestador é obrigatório.');
        if (!String(endereco.bairro || '').trim()) erros.push('Bairro do prestador é obrigatório.');
        if (!validarCodigoIbge(endereco.codigoMunicipio)) {
            erros.push('Código IBGE do município do prestador deve ter 7 dígitos.');
        }
        if (!(Catalog.UFS || []).includes(String(endereco.uf || '').toUpperCase())) {
            erros.push('UF do prestador inválida.');
        }
        if (!validarCep(endereco.cep)) {
            erros.push('CEP do prestador deve ter 8 dígitos.');
        }

        if (!umaDasOpcoes(regTrib.opSimpNac, Catalog.OP_SIMP_NAC || [])) {
            erros.push('Opção pelo Simples Nacional inválida.');
        }
        if (String(regTrib.opSimpNac) === '3' && !umaDasOpcoes(regTrib.regApTribSN, Catalog.REG_AP_TRIB_SN || [])) {
            erros.push('Regime de apuração do Simples Nacional é obrigatório para ME/EPP.');
        }
        if (!umaDasOpcoes(regTrib.regEspTrib, Catalog.REG_ESP_TRIB || [])) {
            erros.push('Regime especial de tributação inválido.');
        }

        if (!/^\d{1,5}$/.test(String(c.serie || ''))) {
            erros.push('Série da DPS deve ter de 1 a 5 dígitos.');
        }
        const numero = Number(c.proximoNumeroDps);
        if (!Number.isInteger(numero) || numero < 1 || numero > 999999999999999) {
            erros.push('Próximo número da DPS deve estar entre 1 e 999999999999999.');
        }

        if (!/^\d{6}$/.test(String(servico.cTribNac || ''))) {
            erros.push('Código nacional de tributação deve ter 6 dígitos.');
        }
        if (servico.cTribMun && !/^\d{3}$/.test(String(servico.cTribMun))) {
            erros.push('Código municipal de tributação deve ter 3 dígitos.');
        }
        if (!servico.cTribMun) {
            avisos.push('Código municipal de tributação não informado; confirme a exigência do município.');
        }
        if (servico.cNBS && !/^\d{9}$/.test(String(servico.cNBS))) {
            erros.push('Código NBS deve ter 9 dígitos.');
        }
        if (!String(servico.descricao || '').trim()) {
            erros.push('Descrição do serviço é obrigatória.');
        } else if (String(servico.descricao).trim().length > 1000) {
            erros.push('Descrição do serviço deve ter até 1000 caracteres.');
        }
        if (!validarAliquota(servico.aliquota)) {
            erros.push('Alíquota do ISSQN deve estar entre 0 e 9,99%.');
        } else if (servico.aliquota === '' || servico.aliquota === null || servico.aliquota === undefined) {
            avisos.push('Alíquota não informada; será usada a parametrização municipal, se disponível.');
        }
        if (!umaDasOpcoes(servico.tribISSQN, Catalog.TRIB_ISSQN || [])) {
            erros.push('Tributação do ISSQN inválida.');
        }
        if (!umaDasOpcoes(servico.tpRetISSQN, Catalog.TP_RET_ISSQN || [])) {
            erros.push('Retenção do ISSQN inválida.');
        }

        return { valido: erros.length === 0, erros, avisos };
    }

    function validarEmissao(config, dados) {
        const erros = [];
        const avisos = [];
        const d = dados || {};
        const servico = (config && config.servico) || {};
        const endereco = (config && config.prestador && config.prestador.endereco) || {};

        if (!validarDataISO(d.dataCompetencia)) {
            erros.push('Data de competência inválida.');
        }
        if (!validarValorMonetario(d.valorServico)) {
            erros.push('Valor do serviço deve ser maior que zero e ter até duas casas decimais.');
        }

        const local = d.localPrestacao || servico.localPrestacao || endereco.codigoMunicipio;
        if (!validarCodigoIbge(local)) {
            erros.push('Código IBGE do local de prestação deve ter 7 dígitos.');
        }

        const tomador = d.tomador || {};
        const documento = somenteDigitos(tomador.documento);
        const temTomador = Boolean(
            documento ||
            String(tomador.nome || '').trim() ||
            String(tomador.email || '').trim()
        );
        if (temTomador) {
            if (!documento) {
                erros.push('Documento do tomador é obrigatório quando o tomador é informado.');
            } else if (documento.length === 11 && !validarCpf(documento)) {
                erros.push('CPF do tomador inválido.');
            } else if (documento.length === 14 && !validarCnpj(documento)) {
                erros.push('CNPJ do tomador inválido.');
            } else if (documento.length !== 11 && documento.length !== 14) {
                erros.push('Documento do tomador deve ser CPF ou CNPJ.');
            }
            if (!String(tomador.nome || '').trim()) {
                erros.push('Nome do tomador é obrigatório quando o tomador é informado.');
            }
            if (tomador.email && !validarEmail(tomador.email)) {
                erros.push('E-mail do tomador inválido.');
            }
        }

        if (String(servico.tribISSQN) !== '1' && String(servico.aliquota || '').trim()) {
            avisos.push('Alíquota informada para operação não tributável; confira o preenchimento.');
        }

        return { valido: erros.length === 0, erros, avisos };
    }

    global.FiscalValidators = {
        somenteDigitos,
        validarCpf,
        validarCnpj,
        validarCep,
        validarCodigoIbge,
        validarEmail,
        validarTelefone,
        validarDataISO,
        validarValorMonetario,
        validarAliquota,
        validarConfig,
        validarEmissao
    };
})(typeof window !== 'undefined' ? window : globalThis);
