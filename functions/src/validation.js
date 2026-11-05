'use strict';

const { LIMITES } = require('./config');

function somenteDigitos(valor) {
    return String(valor == null ? '' : valor).replace(/\D/g, '');
}

function validarCpfCnpj(documento) {
    const digitos = somenteDigitos(documento);
    if (digitos.length === 11) return validarCpf(digitos);
    if (digitos.length === 14) return validarCnpj(digitos);
    return false;
}

function validarCpf(cpf) {
    const digitos = somenteDigitos(cpf);
    if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i += 1) soma += Number(digitos[i]) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== Number(digitos[9])) return false;

    soma = 0;
    for (let i = 0; i < 10; i += 1) soma += Number(digitos[i]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    return resto === Number(digitos[10]);
}

function validarCnpj(cnpj) {
    const digitos = somenteDigitos(cnpj);
    if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false;

    function digito(base, pesos) {
        let soma = 0;
        for (let i = 0; i < pesos.length; i += 1) soma += Number(base[i]) * pesos[i];
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }

    const primeiro = digito(digitos, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    if (primeiro !== Number(digitos[12])) return false;
    const segundo = digito(digitos, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return segundo === Number(digitos[13]);
}

function validarIbge(codigo) {
    return /^\d{7}$/.test(somenteDigitos(codigo));
}

function validarCep(cep) {
    return /^\d{8}$/.test(somenteDigitos(cep));
}

function validarData(valor) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''))) return false;
    const data = new Date(valor + 'T00:00:00Z');
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function validarEmail(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || ''));
}

function validarTelefone(valor) {
    return /^\d{10,11}$/.test(somenteDigitos(valor));
}

function validarValor(valor) {
    const numero = Number(String(valor == null ? '' : valor).replace(',', '.'));
    return Number.isFinite(numero) && numero > 0 && numero <= LIMITES.valorMaximo;
}

function validarValorOpcional(valor) {
    if (valor === undefined || valor === null || String(valor).trim() === '') return true;
    return validarValor(valor);
}

function validarTamanho(valor, maximo) {
    return String(valor == null ? '' : valor).length <= maximo;
}

function validarChaveIdempotencia(valor) {
    const chave = String(valor == null ? '' : valor).trim();
    if (!chave) return null;
    if (chave.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(chave)) return null;
    return chave;
}

function validarAliquota(valor) {
    if (valor === undefined || valor === null || String(valor).trim() === '') return true;
    const numero = Number(String(valor).replace(',', '.'));
    return Number.isFinite(numero) && numero >= 0 && numero <= LIMITES.aliquotaMaxima;
}

function exigir(erros, campo, condicao, mensagem) {
    if (!condicao) erros.push({ campo: campo, mensagem: mensagem });
}

function validarDados(dados) {
    const erros = [];
    const d = dados || {};
    const prestador = d.prestador || {};
    const endereco = prestador.endereco || {};
    const regTrib = prestador.regTrib || {};
    const servico = d.servico || {};

    exigir(erros, 'ambiente', d.ambiente === 'homologacao' || d.ambiente === 'producao', 'Ambiente deve ser homologacao ou producao.');
    exigir(erros, 'prestador.cnpj', validarCpfCnpj(prestador.cnpj), 'CNPJ/CPF do prestador inválido.');
    exigir(erros, 'prestador.razaoSocial', String(prestador.razaoSocial || '').trim().length >= 2, 'Razão social obrigatória.');
    exigir(erros, 'prestador.razaoSocial', validarTamanho(prestador.razaoSocial, 255), 'Razão social excede 255 caracteres.');
    exigir(erros, 'prestador.im', validarTamanho(prestador.im, 15), 'Inscrição municipal excede 15 caracteres.');
    exigir(erros, 'prestador.email', !prestador.email || validarEmail(prestador.email), 'E-mail do prestador inválido.');
    exigir(erros, 'prestador.email', validarTamanho(prestador.email, 255), 'E-mail do prestador excede 255 caracteres.');
    exigir(erros, 'prestador.telefone', !prestador.telefone || validarTelefone(prestador.telefone), 'Telefone do prestador inválido.');
    exigir(erros, 'prestador.endereco.codigoMunicipio', validarIbge(endereco.codigoMunicipio), 'Código IBGE do município inválido.');
    exigir(erros, 'prestador.endereco.cep', validarCep(endereco.cep), 'CEP inválido.');
    exigir(erros, 'prestador.endereco.logradouro', String(endereco.logradouro || '').trim().length >= 2, 'Logradouro obrigatório.');
    exigir(erros, 'prestador.endereco.logradouro', validarTamanho(endereco.logradouro, 255), 'Logradouro excede 255 caracteres.');
    exigir(erros, 'prestador.endereco.numero', String(endereco.numero || '').trim().length >= 1, 'Número do endereço obrigatório.');
    exigir(erros, 'prestador.endereco.numero', validarTamanho(endereco.numero, 60), 'Número do endereço excede 60 caracteres.');
    exigir(erros, 'prestador.endereco.complemento', validarTamanho(endereco.complemento, 156), 'Complemento excede 156 caracteres.');
    exigir(erros, 'prestador.endereco.bairro', String(endereco.bairro || '').trim().length >= 2, 'Bairro obrigatório.');
    exigir(erros, 'prestador.endereco.bairro', validarTamanho(endereco.bairro, 60), 'Bairro excede 60 caracteres.');
    exigir(erros, 'prestador.regTrib.opSimpNac', ['1', '2', '3'].includes(String(regTrib.opSimpNac)), 'Opção pelo Simples inválida.');
    exigir(erros, 'prestador.regTrib.regEspTrib', ['0', '1', '2', '3', '4', '5', '6', '9'].includes(String(regTrib.regEspTrib)), 'Regime especial inválido.');
    if (String(regTrib.opSimpNac) === '3') {
        exigir(erros, 'prestador.regTrib.regApTribSN', ['1', '2', '3'].includes(String(regTrib.regApTribSN)), 'Regime de apuração do Simples obrigatório.');
    }
    exigir(erros, 'servico.cTribNac', /^\d{6}$/.test(somenteDigitos(servico.cTribNac)), 'Código nacional de tributação deve ter 6 dígitos.');
    exigir(erros, 'servico.cTribMun', !servico.cTribMun || /^\d{3}$/.test(somenteDigitos(servico.cTribMun)), 'Código municipal deve ter 3 dígitos.');
    exigir(erros, 'servico.cNBS', !servico.cNBS || /^\d{9}$/.test(somenteDigitos(servico.cNBS)), 'NBS deve ter 9 dígitos.');
    exigir(erros, 'servico.descricao', String(servico.descricao || '').trim().length >= 2, 'Descrição do serviço obrigatória.');
    exigir(erros, 'servico.descricao', validarTamanho(servico.descricao, 2000), 'Descrição do serviço excede 2000 caracteres.');
    exigir(erros, 'servico.aliquota', validarAliquota(servico.aliquota), 'Alíquota deve estar entre 0 e 9,99.');
    exigir(erros, 'servico.tribISSQN', ['1', '2', '3', '4'].includes(String(servico.tribISSQN)), 'Tributação do ISSQN inválida.');
    exigir(erros, 'servico.tpRetISSQN', ['1', '2', '3'].includes(String(servico.tpRetISSQN)), 'Retenção do ISSQN inválida.');
    exigir(erros, 'servico.localPrestacao', !servico.localPrestacao || validarIbge(servico.localPrestacao), 'Local de prestação inválido.');
    exigir(erros, 'localPrestacao', !d.localPrestacao || validarIbge(d.localPrestacao), 'Local de prestação inválido.');
    exigir(erros, 'dataCompetencia', validarData(d.dataCompetencia), 'Data de competência inválida.');
    exigir(erros, 'valorServico', validarValor(d.valorServico), 'Valor do serviço inválido.');
    exigir(erros, 'valorRecebido', validarValorOpcional(d.valorRecebido), 'Valor recebido inválido.');
    exigir(erros, 'serie', /^\d{1,5}$/.test(somenteDigitos(d.serie)), 'Série inválida.');
    exigir(erros, 'numeroDps', !d.numeroDps || (/^\d{1,15}$/.test(somenteDigitos(d.numeroDps)) && Number(d.numeroDps) > 0), 'Número da DPS inválido.');

    if (d.tomador && somenteDigitos(d.tomador.documento)) {
        exigir(erros, 'tomador.documento', validarCpfCnpj(d.tomador.documento), 'Documento do tomador inválido.');
        exigir(erros, 'tomador.nome', String(d.tomador.nome || '').trim().length >= 2, 'Nome do tomador obrigatório.');
        exigir(erros, 'tomador.nome', validarTamanho(d.tomador.nome, 255), 'Nome do tomador excede 255 caracteres.');
        exigir(erros, 'tomador.email', !d.tomador.email || validarEmail(d.tomador.email), 'E-mail do tomador inválido.');
        exigir(erros, 'tomador.email', validarTamanho(d.tomador.email, 255), 'E-mail do tomador excede 255 caracteres.');
    }

    if (d.ambiente === 'producao' && d.producaoConfirmada !== true) {
        erros.push({ campo: 'producaoConfirmada', mensagem: 'Produção exige confirmação explícita.' });
    }

    return erros;
}

module.exports = {
    somenteDigitos,
    validarCpfCnpj,
    validarCpf,
    validarCnpj,
    validarIbge,
    validarCep,
    validarData,
    validarEmail,
    validarTelefone,
    validarValor,
    validarValorOpcional,
    validarAliquota,
    validarTamanho,
    validarChaveIdempotencia,
    validarDados
};
