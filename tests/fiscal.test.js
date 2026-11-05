const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/fiscal/catalog.js');
require('../src/fiscal/config.js');
require('../src/fiscal/validators.js');
require('../src/fiscal/dps.js');

const { FiscalCatalog, FiscalConfig, FiscalValidators, FiscalDps } = globalThis;

function configValida() {
    const config = FiscalConfig.configuracaoPadrao();
    config.prestador.cnpj = '11222333000181';
    config.prestador.im = '123456';
    config.prestador.razaoSocial = 'Clínica Exemplo Ltda';
    config.prestador.email = 'fiscal@exemplo.com.br';
    config.prestador.telefone = '11999999999';
    config.prestador.endereco = {
        logradouro: 'Rua Exemplo',
        numero: '100',
        complemento: 'Sala 1',
        bairro: 'Centro',
        codigoMunicipio: '3550308',
        uf: 'SP',
        cep: '01001000'
    };
    config.servico.aliquota = '5.00';
    return config;
}

test('valida CNPJ e CPF', () => {
    assert.equal(FiscalValidators.validarCnpj('11.222.333/0001-81'), true);
    assert.equal(FiscalValidators.validarCnpj('11.222.333/0001-80'), false);
    assert.equal(FiscalValidators.validarCpf('529.982.247-25'), true);
    assert.equal(FiscalValidators.validarCpf('111.111.111-11'), false);
});

test('valida códigos fiscais básicos', () => {
    assert.equal(FiscalValidators.validarCep('01001-000'), true);
    assert.equal(FiscalValidators.validarCep('0100100'), false);
    assert.equal(FiscalValidators.validarCodigoIbge('3550308'), true);
    assert.equal(FiscalValidators.validarCodigoIbge('0000000'), false);
    assert.equal(FiscalValidators.validarAliquota('5.00'), true);
    assert.equal(FiscalValidators.validarAliquota('12.00'), false);
});

test('configuração completa é válida em homologação', () => {
    const resultado = FiscalValidators.validarConfig(configValida());
    assert.deepEqual(resultado.erros, []);
    assert.equal(resultado.valido, true);
});

test('produção exige confirmação explícita', () => {
    const config = configValida();
    config.ambiente = 'producao';
    let resultado = FiscalValidators.validarConfig(config);
    assert.equal(resultado.valido, false);
    assert.ok(resultado.erros.some((erro) => erro.includes('confirmação explícita')));

    config.producaoConfirmada = true;
    resultado = FiscalValidators.validarConfig(config);
    assert.equal(resultado.valido, true);
});

test('identificador da DPS tem 45 caracteres e composição correta', () => {
    const id = FiscalDps.montarIdDps({
        codigoMunicipio: '3550308',
        inscricaoFederal: '11222333000181',
        serie: '1',
        numero: '1'
    });
    assert.equal(id.length, 45);
    assert.equal(id, 'DPS355030821122233300018100001000000000000001');
});

test('prévia XML contém os grupos obrigatórios e não contém assinatura', () => {
    const xml = FiscalDps.gerarXmlDps({
        config: configValida(),
        dataCompetencia: '2026-11-01',
        valorServico: '100.00',
        dhEmi: new Date('2026-11-01T12:00:00-03:00'),
        tomador: {
            documento: '52998224725',
            nome: 'Paciente Exemplo'
        }
    });

    assert.match(xml, new RegExp('xmlns="' + FiscalCatalog.NAMESPACE_NFSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"'));
    assert.match(xml, /<DPS[^>]*versao="1\.01"/);
    assert.match(xml, /<infDPS Id="DPS355030821122233300018100001000000000000001">/);
    assert.match(xml, /<tpAmb>2<\/tpAmb>/);
    assert.match(xml, /<cTribNac>040101<\/cTribNac>/);
    assert.match(xml, /<cTribMun>097<\/cTribMun>/);
    assert.match(xml, /<cNBS>123012200<\/cNBS>/);
    assert.match(xml, /<vServ>100\.00<\/vServ>/);
    assert.match(xml, /<pAliq>5\.00<\/pAliq>/);
    assert.match(xml, /<indTotTrib>0<\/indTotTrib>/);
    assert.ok(!xml.includes('<Signature'));
    assert.ok(!xml.includes('ds:Signature'));
});

test('emissão rejeita tomador incompleto e valor inválido', () => {
    const resultado = FiscalValidators.validarEmissao(configValida(), {
        dataCompetencia: '2026-11-01',
        valorServico: '0',
        tomador: { documento: '52998224725' }
    });
    assert.equal(resultado.valido, false);
    assert.ok(resultado.erros.some((erro) => erro.includes('Valor do serviço')));
    assert.ok(resultado.erros.some((erro) => erro.includes('Nome do tomador')));
});
