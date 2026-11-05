'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');

const { criarServico } = require('../src/service');
const { MemoryStore, FirestoreStore } = require('../src/store');
const { criarAssinadorSimulado } = require('../src/signer');
const { criarTransporteSimulado } = require('../src/transport-simulado');
const { LimitadorJanela } = require('../src/rate-limit');
const {
    criarHandlerEmissao,
    criarHandlerConsulta,
    criarHandlerStatus
} = require('../src/handlers');
const { dadosValidos, respostaFalsa, requisicaoFalsa } = require('./helpers');

function criarServicoSimulado(opcoes) {
    return criarServico(Object.assign({
        store: new MemoryStore(),
        transporte: criarTransporteSimulado(),
        assinador: criarAssinadorSimulado(),
        config: { transmissaoReal: false }
    }, opcoes || {}));
}

test('usuário não acessa DPS de outro usuário', async function () {
    const servico = criarServicoSimulado();
    const emissao = await servico.emitir({
        uid: 'usuario-a',
        chaveIdempotencia: 'idem-cruzado',
        dados: dadosValidos()
    });

    await assert.rejects(
        servico.consultar({ uid: 'usuario-b', idDps: emissao.idDps }),
        function (erro) {
            assert.equal(erro.codigo, 'DPS_NAO_ENCONTRADA');
            assert.equal(erro.status, 404);
            return true;
        }
    );

    const propria = await servico.consultar({ uid: 'usuario-a', idDps: emissao.idDps });
    assert.equal(propria.idDps, emissao.idDps);
});

test('consulta rejeita identificador de DPS malformado', async function () {
    const servico = criarServicoSimulado();
    await assert.rejects(
        servico.consultar({ uid: 'usuario-a', idDps: '../outro' }),
        function (erro) {
            assert.equal(erro.codigo, 'VALIDACAO');
            assert.equal(erro.status, 400);
            return true;
        }
    );
});

test('chave de idempotência com payload diferente é rejeitada', async function () {
    const servico = criarServicoSimulado();
    await servico.emitir({
        uid: 'usuario-a',
        chaveIdempotencia: 'idem-diff-1',
        dados: dadosValidos()
    });
    await assert.rejects(
        servico.emitir({
            uid: 'usuario-a',
            chaveIdempotencia: 'idem-diff-1',
            dados: dadosValidos({ valorServico: '200.00' })
        }),
        function (erro) {
            return erro && erro.codigo === 'IDEMPOTENCIA_INVALIDA';
        }
    );
});

test('chave de idempotência inválida é rejeitada', async function () {
    const servico = criarServicoSimulado();
    await assert.rejects(
        servico.emitir({ uid: 'usuario-a', chaveIdempotencia: 'x'.repeat(129), dados: dadosValidos() }),
        function (erro) {
            assert.equal(erro.codigo, 'IDEMPOTENCIA_INVALIDA');
            return true;
        }
    );
});

test('requisições duplicadas concorrentes não geram duas emissões', async function () {
    let chamadas = 0;
    const transporteBase = criarTransporteSimulado();
    const transporte = {
        modo: transporteBase.modo,
        async emitirDps(xml, contexto) {
            chamadas += 1;
            await new Promise(function (resolve) { setTimeout(resolve, 10); });
            return transporteBase.emitirDps(xml, contexto);
        }
    };
    const servico = criarServicoSimulado({ transporte: transporte });

    const resultados = await Promise.allSettled([
        servico.emitir({ uid: 'usuario-a', chaveIdempotencia: 'idem-concorrente', dados: dadosValidos() }),
        servico.emitir({ uid: 'usuario-a', chaveIdempotencia: 'idem-concorrente', dados: dadosValidos() })
    ]);

    assert.equal(chamadas, 1);
    assert.equal(resultados.filter(function (r) { return r.status === 'fulfilled'; }).length, 1);
    assert.equal(resultados.filter(function (r) { return r.status === 'rejected'; }).length, 1);
});

test('indisponibilidade do store impede transmissão', async function () {
    let chamadas = 0;
    const transporteBase = criarTransporteSimulado();
    const servico = criarServico({
        store: {
            async reservar() { throw new Error('Firestore indisponível'); }
        },
        transporte: {
            modo: transporteBase.modo,
            async emitirDps(xml, contexto) {
                chamadas += 1;
                return transporteBase.emitirDps(xml, contexto);
            }
        },
        assinador: criarAssinadorSimulado(),
        config: { transmissaoReal: false }
    });

    await assert.rejects(
        servico.emitir({ uid: 'usuario-a', chaveIdempotencia: 'idem-store', dados: dadosValidos() }),
        /Firestore indisponível/
    );
    assert.equal(chamadas, 0);
});

test('valorRecebido inválido retorna 422, não erro interno', async function () {
    const servico = criarServicoSimulado();
    const dados = dadosValidos({ valorRecebido: 'abc' });
    await assert.rejects(
        servico.emitir({ uid: 'usuario-a', chaveIdempotencia: 'idem-valor', dados: dados }),
        function (erro) {
            assert.equal(erro.codigo, 'VALIDACAO');
            assert.equal(erro.status, 422);
            assert.ok(erro.detalhes.some(function (item) { return item.campo === 'valorRecebido'; }));
            return true;
        }
    );
});

test('limitador em memória não cresce sem limite', function () {
    const limitador = new LimitadorJanela({ limite: 1, janelaMs: 60000, tamanhoMaximo: 2 });
    limitador.consumir('a');
    limitador.consumir('b');
    limitador.consumir('c');
    assert.equal(limitador.registros.size, 2);
});

test('handler de consulta exige autenticação', async function () {
    const servico = criarServicoSimulado();
    const handler = criarHandlerConsulta({ autenticar: null, servico: servico });
    const res = respostaFalsa();
    await handler(requisicaoFalsa({ method: 'GET', url: '/consulta/DPS123' }), res);
    assert.equal(res.statusCode, 401);
});

test('handler de consulta rejeita percent-encoding inválido sem erro interno', async function () {
    const servico = criarServicoSimulado();
    const handler = criarHandlerConsulta({
        autenticar: async function () { return { uid: 'usuario-a' }; },
        servico: servico
    });
    const res = respostaFalsa();
    await handler(requisicaoFalsa({ method: 'GET', url: '/consulta/%E0%A4%A' }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.corpo.erro.codigo, 'VALIDACAO');
});

test('handler rejeita corpo em string acima do limite', async function () {
    const servico = criarServicoSimulado();
    const handler = criarHandlerEmissao({
        autenticar: async function () { return { uid: 'usuario-a' }; },
        servico: servico
    });
    const res = respostaFalsa();
    await handler(requisicaoFalsa({
        headers: { 'x-idempotency-key': 'idem-corpo-grande' },
        body: 'x'.repeat(70000)
    }), res);
    assert.equal(res.statusCode, 413);
    assert.equal(res.corpo.erro.codigo, 'CORPO_INVALIDO');
});

test('numeração da DPS é reservada no servidor e não aceita valor arbitrário', async function () {
    let chamadas = 0;
    const transporteBase = criarTransporteSimulado();
    const transporte = {
        modo: transporteBase.modo,
        async emitirDps(xml, contexto) {
            chamadas += 1;
            return transporteBase.emitirDps(xml, contexto);
        }
    };
    const { MemorySequenceStore } = require('../src/sequence');
    const servico = criarServicoSimulado({ transporte: transporte, sequenceStore: new MemorySequenceStore() });

    const primeira = await servico.emitir({
        uid: 'usuario-a',
        chaveIdempotencia: 'idem-num-1',
        dados: dadosValidos({ numeroDps: '9999' })
    });
    assert.equal(primeira.numeroDps, '1');

    const segunda = await servico.emitir({
        uid: 'usuario-b',
        chaveIdempotencia: 'idem-num-2',
        dados: dadosValidos({ numeroDps: '1' })
    });
    assert.equal(segunda.numeroDps, '2');
    assert.equal(chamadas, 2);
});

test('reconciliação confirma emissão presa em processando', async function () {
    const store = new MemoryStore();
    const idDps = 'DPS' + '1'.repeat(42);
    const criadoEm = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await store.reservar('usuario-a', 'idem-recon-1', {
        uid: 'usuario-a',
        chaveIdempotencia: 'idem-recon-1',
        status: 'processando',
        idDps: idDps,
        ambiente: 'homologacao',
        criadoEm: criadoEm
    });

    const servico = criarServicoSimulado({ store: store });
    const resumo = await servico.reconciliar({ idadeMinimaMs: 60 * 1000 });

    assert.equal(resumo.analisados, 1);
    assert.equal(resumo.confirmados, 1);
    assert.equal(resumo.falhados, 0);
    const registro = await store.obter('usuario-a', 'idem-recon-1');
    assert.equal(registro.status, 'processada');
    assert.match(registro.chaveAcesso, /^\d{50}$/);
});

test('choices tributárias ausentes não recebem defaults silenciosos', async function () {
    const servico = criarServicoSimulado();
    const dados = dadosValidos();
    delete dados.prestador.regTrib.opSimpNac;
    delete dados.prestador.regTrib.regEspTrib;
    delete dados.servico.tribISSQN;
    delete dados.servico.tpRetISSQN;

    await assert.rejects(
        servico.emitir({ uid: 'usuario-a', chaveIdempotencia: 'idem-sem-regime', dados: dados }),
        function (erro) {
            assert.equal(erro.codigo, 'VALIDACAO');
            assert.equal(erro.status, 422);
            const campos = erro.detalhes.map(function (item) { return item.campo; });
            assert.ok(campos.includes('prestador.regTrib.opSimpNac'));
            assert.ok(campos.includes('prestador.regTrib.regEspTrib'));
            assert.ok(campos.includes('servico.tribISSQN'));
            assert.ok(campos.includes('servico.tpRetISSQN'));
            return true;
        }
    );
});

test('resposta real com chave de acesso inválida não é aceita', async function () {
    const servico = criarServico({
        store: new MemoryStore(),
        transporte: {
            modo: 'real',
            async emitirDps() {
                return { chaveAcesso: '123' };
            }
        },
        assinador: criarAssinadorSimulado(),
        autorizarPrestador: async function () { return true; },
        config: { transmissaoReal: true }
    });

    await assert.rejects(
        servico.emitir({ uid: 'usuario-a', chaveIdempotencia: 'idem-chave-curta', dados: dadosValidos() }),
        function (erro) {
            assert.equal(erro.codigo, 'ERRO_SEFIN');
            assert.equal(erro.status, 502);
            return true;
        }
    );
});

test('rate limit bloqueia excesso de emissões por usuário', async function () {
    const servico = criarServicoSimulado();
    const handler = criarHandlerEmissao({
        autenticar: async function () { return { uid: 'usuario-a' }; },
        servico: servico,
        limitador: new LimitadorJanela({ limite: 1, janelaMs: 60000 })
    });

    const primeira = respostaFalsa();
    await handler(requisicaoFalsa({
        headers: { 'x-idempotency-key': 'idem-rate-1' },
        body: dadosValidos()
    }), primeira);
    assert.equal(primeira.statusCode, 201);

    const segunda = respostaFalsa();
    await handler(requisicaoFalsa({
        headers: { 'x-idempotency-key': 'idem-rate-2' },
        body: dadosValidos()
    }), segunda);
    assert.equal(segunda.statusCode, 429);
    assert.equal(segunda.corpo.erro.codigo, 'LIMITE_EXCEDIDO');
});

test('CORS fica fechado por padrão e abre apenas para origem permitida', async function () {
    const servico = criarServicoSimulado();
    const handler = criarHandlerEmissao({
        autenticar: async function () { return { uid: 'usuario-a' }; },
        servico: servico,
        origensPermitidas: ['https://app.mywebshift.com.br']
    });

    const negada = respostaFalsa();
    await handler(requisicaoFalsa({
        headers: { origin: 'https://malicioso.example', 'x-idempotency-key': 'idem-cors-1' },
        body: dadosValidos()
    }), negada);
    assert.equal(negada.cabecalhos['Access-Control-Allow-Origin'], undefined);

    const permitida = respostaFalsa();
    await handler(requisicaoFalsa({
        method: 'OPTIONS',
        headers: { origin: 'https://app.mywebshift.com.br' }
    }), permitida);
    assert.equal(permitida.cabecalhos['Access-Control-Allow-Origin'], 'https://app.mywebshift.com.br');
});

test('modo simulado não faz nenhuma requisição de rede', async function () {
    const original = https.request;
    let chamadasHttps = 0;
    https.request = function () {
        chamadasHttps += 1;
        throw new Error('Requisição de rede inesperada no modo simulado');
    };

    try {
        const servico = criarServicoSimulado();
        const resultado = await servico.emitir({
            uid: 'usuario-a',
            chaveIdempotencia: 'idem-sem-rede',
            dados: dadosValidos()
        });
        assert.equal(resultado.simulado, true);
        assert.equal(chamadasHttps, 0);
    } finally {
        https.request = original;
    }
});

test('status não expõe versão exata do Node', function () {
    const handler = criarHandlerStatus({ regiao: 'southamerica-east1' });
    const res = respostaFalsa();
    handler(requisicaoFalsa({ method: 'GET', url: '/status' }), res);
    assert.equal(res.corpo.node, undefined);
    assert.match(String(res.corpo.nodeMajor), /^\d+$/);
});

test('id de documento do Firestore não usa a chave bruta', function () {
    const id = FirestoreStore.id('usuario-a', 'chave/com:caracteres*estranhos');
    assert.equal(id.length, 64);
    assert.doesNotMatch(id, /usuario-a|chave/);
});

test('modo real exige vínculo usuário-prestador antes de transmitir', async function () {
    let chamadas = 0;
    const servico = criarServico({
        store: new MemoryStore(),
        transporte: {
            modo: 'real',
            async emitirDps() {
                chamadas += 1;
                return { chaveAcesso: '1'.repeat(50) };
            }
        },
        assinador: criarAssinadorSimulado(),
        config: { transmissaoReal: true }
    });

    await assert.rejects(
        servico.emitir({ uid: 'usuario-a', chaveIdempotencia: 'idem-real-sem-vinculo', dados: dadosValidos() }),
        function (erro) {
            assert.equal(erro.codigo, 'PRESTADOR_NAO_AUTORIZADO');
            assert.equal(erro.status, 503);
            return true;
        }
    );
    assert.equal(chamadas, 0);
});

test('CNPJ não vinculado ao usuário é bloqueado e não transmite', async function () {
    let chamadas = 0;
    let recebido = null;
    const servico = criarServico({
        store: new MemoryStore(),
        transporte: {
            modo: 'real',
            async emitirDps() {
                chamadas += 1;
                return { chaveAcesso: '1'.repeat(50) };
            }
        },
        assinador: criarAssinadorSimulado(),
        autorizarPrestador: async function (contexto) {
            recebido = contexto;
            return false;
        },
        config: { transmissaoReal: true }
    });

    await assert.rejects(
        servico.emitir({ uid: 'usuario-a', chaveIdempotencia: 'idem-real-negado', dados: dadosValidos() }),
        function (erro) {
            assert.equal(erro.codigo, 'PRESTADOR_NAO_AUTORIZADO');
            assert.equal(erro.status, 403);
            return true;
        }
    );
    assert.equal(chamadas, 0);
    assert.equal(recebido.uid, 'usuario-a');
    assert.equal(recebido.cnpj, '11222333000181');
});

test('transporte real recusa ambiente diferente do solicitado', async function () {
    let chamadas = 0;
    const servico = criarServico({
        store: new MemoryStore(),
        transporte: {
            modo: 'real',
            ambiente: 'homologacao',
            async emitirDps() {
                chamadas += 1;
                return { chaveAcesso: '1'.repeat(50) };
            }
        },
        assinador: criarAssinadorSimulado(),
        autorizarPrestador: async function () { return true; },
        config: { transmissaoReal: true }
    });

    await assert.rejects(
        servico.emitir({
            uid: 'usuario-a',
            chaveIdempotencia: 'idem-ambiente',
            dados: dadosValidos({ ambiente: 'producao', producaoConfirmada: true })
        }),
        function (erro) {
            assert.equal(erro.codigo, 'AMBIENTE_INVALIDO');
            assert.equal(erro.status, 409);
            return true;
        }
    );
    assert.equal(chamadas, 0);
});

test('prestador vinculado permite seguir no modo real simulado', async function () {
    let autorizacoes = 0;
    const servico = criarServico({
        store: new MemoryStore(),
        transporte: {
            modo: 'real',
            async emitirDps() {
                return { chaveAcesso: '9'.repeat(50), protocolo: 'PROTOCOLO-TESTE' };
            }
        },
        assinador: criarAssinadorSimulado(),
        autorizarPrestador: async function () {
            autorizacoes += 1;
            return true;
        },
        config: { transmissaoReal: true }
    });

    const resultado = await servico.emitir({
        uid: 'usuario-a',
        chaveIdempotencia: 'idem-real-autorizado',
        dados: dadosValidos()
    });
    assert.equal(autorizacoes, 1);
    assert.equal(resultado.chaveAcesso, '9'.repeat(50));
    assert.equal(resultado.xmlDps, null);
});
