'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { dadosValidos } = require('./helpers');

const projeto = process.env.GCLOUD_PROJECT || 'demo-mywebshift';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const functionsHost = process.env.FUNCTIONS_EMULATOR_HOST || '127.0.0.1:5001';
const authBase = 'http://' + authHost + '/identitytoolkit.googleapis.com/v1';
const execucao = Date.now().toString(36);

let usuarioA;
let usuarioB;
let baseFuncoes;

function corpoJson(resposta) {
    return resposta.text().then(function (texto) {
        if (!texto) return null;
        try { return JSON.parse(texto); } catch (erro) { return { bruto: texto }; }
    });
}

async function criarUsuario(nome) {
    const resposta = await fetch(authBase + '/accounts:signUp?key=fake-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: nome + '-' + execucao + '@example.test',
            password: 'SenhaLocal123!',
            returnSecureToken: true
        })
    });
    const json = await corpoJson(resposta);
    if (!resposta.ok || !json || !json.idToken) {
        throw new Error('Falha ao criar usuário no Auth Emulator: ' + JSON.stringify(json));
    }
    return { uid: json.localId, token: json.idToken, email: json.email };
}

async function chamar(caminho, opcoes) {
    const o = opcoes || {};
    const cabecalhos = {};
    if (o.token) cabecalhos.Authorization = 'Bearer ' + o.token;
    if (o.body !== undefined) cabecalhos['Content-Type'] = 'application/json';
    const resposta = await fetch(baseFuncoes + caminho, {
        method: o.method || 'POST',
        headers: cabecalhos,
        body: o.body === undefined ? undefined : JSON.stringify(o.body)
    });
    return { status: resposta.status, body: await corpoJson(resposta) };
}

async function descobrirBase() {
    const candidatos = [
        process.env.NFS_E_REGIAO || 'us-central1',
        'us-central1',
        'southamerica-east1'
    ];
    const vistos = new Set();
    for (const regiao of candidatos) {
        if (vistos.has(regiao)) continue;
        vistos.add(regiao);
        const base = 'http://' + functionsHost + '/' + projeto + '/' + regiao;
        try {
            const resposta = await fetch(base + '/status');
            if (resposta.ok) {
                baseFuncoes = base;
                return;
            }
        } catch (erro) {
            void erro;
        }
    }
    throw new Error('Não foi possível localizar o endpoint /status no Functions Emulator.');
}

test.before(async function () {
    usuarioA = await criarUsuario('alice');
    usuarioB = await criarUsuario('bob');
    await descobrirBase();
});

test('status confirma modo simulado e transmissão real desligada', async function () {
    const resposta = await chamar('/status', { method: 'GET' });
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.ok, true);
    assert.equal(resposta.body.modo, 'simulacao');
    assert.equal(resposta.body.transmissaoReal, false);
    assert.match(String(resposta.body.nodeMajor), /^\d+$/);
    assert.equal(resposta.body.node, undefined);
});

test('emissão e consulta exigem token Firebase válido', async function () {
    const semToken = await chamar('/consulta/DPS' + '1'.repeat(42), { method: 'GET' });
    assert.equal(semToken.status, 401);
    assert.equal(semToken.body.erro.codigo, 'NAO_AUTENTICADO');

    const tokenInvalido = await chamar('/emissao', {
        token: 'token-invalido',
        body: Object.assign(dadosValidos(), { chaveIdempotencia: 'idem-' + execucao + '-invalido' })
    });
    assert.equal(tokenInvalido.status, 401);
    assert.equal(tokenInvalido.body.erro.codigo, 'NAO_AUTENTICADO');
});

test('identidade vem do token, idempotência funciona e consulta isola por UID', async function () {
    const chave = 'idem-' + execucao + '-principal';
    const dados = dadosValidos({ numeroDps: '1001', uid: usuarioB.uid });

    const primeira = await chamar('/emissao', {
        token: usuarioA.token,
        body: Object.assign({}, dados, { chaveIdempotencia: chave })
    });
    assert.equal(primeira.status, 201);
    assert.equal(primeira.body.ok, true);
    assert.equal(primeira.body.resultado.uid, usuarioA.uid);
    assert.equal(primeira.body.resultado.idempotente, false);
    assert.equal(primeira.body.resultado.simulado, true);
    assert.match(primeira.body.resultado.chaveAcesso, /^\d{50}$/);

    const idDps = primeira.body.resultado.idDps;

    const segunda = await chamar('/emissao', {
        token: usuarioA.token,
        body: Object.assign({}, dados, { chaveIdempotencia: chave })
    });
    assert.equal(segunda.status, 200);
    assert.equal(segunda.body.resultado.idempotente, true);
    assert.equal(segunda.body.resultado.idDps, idDps);

    const propria = await chamar('/consulta/' + encodeURIComponent(idDps), {
        method: 'GET',
        token: usuarioA.token
    });
    assert.equal(propria.status, 200);
    assert.equal(propria.body.resultado.idDps, idDps);
    assert.equal(propria.body.resultado.uid, usuarioA.uid);

    const alheia = await chamar('/consulta/' + encodeURIComponent(idDps), {
        method: 'GET',
        token: usuarioB.token
    });
    assert.equal(alheia.status, 404);
    assert.equal(alheia.body.erro.codigo, 'DPS_NAO_ENCONTRADA');
});

test('dados inválidos e consulta malformada retornam erros controlados', async function () {
    const invalido = dadosValidos({ numeroDps: '1002' });
    invalido.prestador.cnpj = '00000000000000';
    invalido.servico.cTribNac = '123';

    const resposta = await chamar('/emissao', {
        token: usuarioA.token,
        body: Object.assign({}, invalido, { chaveIdempotencia: 'idem-' + execucao + '-invalido-dados' })
    });
    assert.equal(resposta.status, 422);
    assert.equal(resposta.body.erro.codigo, 'VALIDACAO');

    const malformada = await chamar('/consulta/../outro', {
        method: 'GET',
        token: usuarioA.token
    });
    assert.notEqual(malformada.status, 500);
    assert.ok([400, 401, 404].includes(malformada.status));
});

test('emissão sem chave de idempotência é rejeitada', async function () {
    const resposta = await chamar('/emissao', {
        token: usuarioA.token,
        body: dadosValidos({ numeroDps: '1003' })
    });
    assert.equal(resposta.status, 400);
    assert.equal(resposta.body.erro.codigo, 'IDEMPOTENCIA_OBRIGATORIA');
});
