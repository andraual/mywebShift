'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { transmissaoRealPermitida, AMBIENTES, TRANSMISSAO_REAL_HABILITADA } = require('../src/config');
const { validarDados, validarCnpj, somenteDigitos } = require('../src/validation');
const { gerarXmlDps, montarIdDps } = require('../src/dps');
const { normalizar, criarServico } = require('../src/service');
const { MemoryStore } = require('../src/store');
const { criarAssinadorSimulado, criarAssinadorReal } = require('../src/signer');
const { criarTransporteSimulado } = require('../src/transport-simulado');
const { criarTransporteReal } = require('../src/transport-real');
const { criarHandlerEmissao, criarHandlerStatus } = require('../src/handlers');
const { dadosValidos, respostaFalsa, requisicaoFalsa } = require('./helpers');

function criarServicoSimulado(opcoes) {
    return criarServico(Object.assign({
        store: new MemoryStore(),
        transporte: criarTransporteSimulado(),
        assinador: criarAssinadorSimulado(),
        config: { transmissaoReal: false, permitirNumeroCliente: true }
    }, opcoes || {}));
}

test('transmissão real permanece desabilitada mesmo com variável de ambiente', function () {
    assert.equal(TRANSMISSAO_REAL_HABILITADA, false);
    assert.equal(transmissaoRealPermitida({ NFS_E_TRANSMISSAO_REAL: 'true' }), false);
    assert.equal(AMBIENTES.producao.tpAmb, '1');
    assert.equal(AMBIENTES.homologacao.tpAmb, '2');
});

test('validação de CNPJ e dados fiscais', function () {
    assert.equal(validarCnpj('11.222.333/0001-81'), true);
    assert.equal(validarCnpj('11.111.111/1111-11'), false);
    const normalizado = normalizar(dadosValidos());
    assert.deepEqual(validarDados(normalizado), []);
    assert.equal(somenteDigitos('11.222.333/0001-81'), '11222333000181');
});

test('geração da DPS monta identificador de 45 caracteres e XML 1.01', function () {
    const dados = normalizar(dadosValidos());
    const dps = gerarXmlDps(dados);
    assert.equal(dps.id.length, 45);
    assert.match(dps.id, /^DPS3550308211222333000181/);
    assert.match(dps.xml, /versao="1\.01"/);
    assert.match(dps.xml, /<cTribNac>040101<\/cTribNac>/);
    assert.match(dps.xml, /<cNBS>123012200<\/cNBS>/);
    assert.equal(montarIdDps({
        codigoMunicipio: '3550308',
        inscricaoFederal: '11222333000181',
        serie: '1',
        numero: '1'
    }), dps.id);
});

test('emissão simulada retorna chave de 50 dígitos e não transmite', async function () {
    const servico = criarServicoSimulado();
    const primeira = await servico.emitir({
        uid: 'usuario-1',
        chaveIdempotencia: 'idem-1',
        dados: dadosValidos()
    });

    assert.equal(primeira.simulado, true);
    assert.equal(primeira.modo, 'simulacao');
    assert.equal(primeira.status, 'processada');
    assert.equal(primeira.chaveAcesso.length, 50);
    assert.match(primeira.chaveAcesso, /^\d+$/);
    assert.match(primeira.xmlDps, /<DPS/);

    const segunda = await servico.emitir({
        uid: 'usuario-1',
        chaveIdempotencia: 'idem-1',
        dados: dadosValidos()
    });
    assert.equal(segunda.idempotente, true);
    assert.equal(segunda.chaveAcesso, primeira.chaveAcesso);
});

test('produção exige confirmação explícita', async function () {
    const servico = criarServicoSimulado();
    await assert.rejects(
        servico.emitir({
            uid: 'usuario-1',
            chaveIdempotencia: 'idem-prod',
            dados: dadosValidos({ ambiente: 'producao' })
        }),
        function (erro) {
            assert.equal(erro.codigo, 'PRODUCAO_NAO_CONFIRMADA');
            return true;
        }
    );
});

test('dados inválidos retornam erro de validação com detalhes', async function () {
    const servico = criarServicoSimulado();
    const dados = dadosValidos();
    dados.prestador.cnpj = '00000000000000';
    dados.servico.cTribNac = '123';
    await assert.rejects(
        servico.emitir({ uid: 'usuario-1', chaveIdempotencia: 'idem-invalido', dados: dados }),
        function (erro) {
            assert.equal(erro.codigo, 'VALIDACAO');
            assert.equal(erro.status, 422);
            assert.ok(erro.detalhes.some(function (item) { return item.campo === 'prestador.cnpj'; }));
            return true;
        }
    );
});

test('assinador e transporte reais estão desabilitados', async function () {
    await assert.rejects(criarAssinadorReal().assinar('<DPS/>'), function (erro) {
        assert.equal(erro.codigo, 'ASSINATURA_REAL_DESABILITADA');
        return true;
    });
    assert.throws(function () {
        criarTransporteReal({ transmissaoRealPermitida: false });
    }, function (erro) {
        assert.equal(erro.codigo, 'TRANSMISSAO_REAL_DESABILITADA');
        return true;
    });
});

test('handler de emissão exige autenticação e responde 201 no modo simulado', async function () {
    const servico = criarServicoSimulado();
    const handler = criarHandlerEmissao({ autenticar: null, servico: servico });

    const semAuth = respostaFalsa();
    await handler(requisicaoFalsa({ body: dadosValidos() }), semAuth);
    assert.equal(semAuth.statusCode, 401);

    const handlerAutenticado = criarHandlerEmissao({
        autenticar: async function () { return { uid: 'usuario-1' }; },
        servico: servico
    });
    const resposta = respostaFalsa();
    await handlerAutenticado(requisicaoFalsa({
        headers: { 'x-idempotency-key': 'idem-handler' },
        body: dadosValidos()
    }), resposta);

    assert.equal(resposta.statusCode, 201);
    assert.equal(resposta.corpo.ok, true);
    assert.equal(resposta.corpo.resultado.simulado, true);
});

test('handler de status expõe que a transmissão real está desligada', function () {
    const handler = criarHandlerStatus({ regiao: 'southamerica-east1' });
    const res = respostaFalsa();
    handler(requisicaoFalsa({ method: 'GET', url: '/status' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.corpo.transmissaoReal, false);
    assert.equal(res.corpo.modo, 'simulacao');
    assert.equal(res.corpo.regiao, 'southamerica-east1');
});
