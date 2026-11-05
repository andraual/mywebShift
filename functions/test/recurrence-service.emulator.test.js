'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const admin = require('firebase-admin');
const Recurrence = require('../../src/recurrence.js');
const RecurrenceService = require('../../src/recurrence-service.js');

const projeto = process.env.GCLOUD_PROJECT || 'demo-mywebshift';
let db;

function timestamp() {
    return admin.firestore.FieldValue.serverTimestamp();
}

function montarOcorrencia(serie, data, userId) {
    return {
        data: data,
        horaInicio: serie.horaInicio,
        tempoPlantao: serie.tempoPlantao,
        local: serie.local,
        valorHora: serie.valorHora,
        valorTotal: 1200,
        observacoes: serie.observacoes,
        userId: userId
    };
}

async function limparBanco() {
    const colecoes = await db.listCollections();
    for (const colecao of colecoes) {
        const snapshot = await colecao.get();
        if (snapshot.empty) continue;
        const batch = db.batch();
        snapshot.docs.forEach(function (doc) { batch.delete(doc.ref); });
        await batch.commit();
    }
}

async function criarSerie(extraRegra, extraConfig) {
    return RecurrenceService.criarSerieRecorrente(db, Object.assign({
        userId: 'alice',
        dadosSerie: {
            local: 'Hospital Central',
            horaInicio: '08:00',
            tempoPlantao: 12,
            valorHora: 100,
            valorCheio: null,
            valorBonus: null,
            observacoes: 'Teste'
        },
        regra: Object.assign({
            dataInicial: '2026-01-05',
            dataFim: '2026-02-02',
            tipo: 'semanal',
            excecoes: [],
            geradoAte: null
        }, extraRegra || {}),
        montarOcorrencia: montarOcorrencia,
        serverTimestamp: timestamp,
        hoje: new Date(2026, 0, 1)
    }, extraConfig || {}));
}

async function ocorrencias() {
    const snapshot = await db.collection('plantoes').orderBy('data').get();
    return snapshot.docs.map(function (doc) {
        return Object.assign({ id: doc.id }, doc.data());
    });
}

async function ocorrenciaPorData(data) {
    const lista = await ocorrencias();
    return lista.find(function (item) {
        return (item.ocorrenciaData || item.data) === data;
    });
}

async function serie(serieId) {
    const snapshot = await db.collection('recorrencias').doc(serieId).get();
    return snapshot.exists ? snapshot.data() : null;
}

test.before(async function () {
    if (!admin.apps.length) {
        admin.initializeApp({ projectId: projeto });
    }
    db = admin.firestore();
    await limparBanco();
});

test.beforeEach(async function () {
    await limparBanco();
});

test('cria série com data limite e ocorrências vinculadas, sem passar do limite', async function () {
    const resultado = await criarSerie();

    assert.deepEqual(resultado.datas, [
        '2026-01-05',
        '2026-01-12',
        '2026-01-19',
        '2026-01-26',
        '2026-02-02'
    ]);

    const lista = await ocorrencias();
    assert.equal(lista.length, 5);
    assert.ok(lista.every(function (item) {
        return item.serieId === resultado.serieId && item.ocorrenciaData === item.data;
    }));
    assert.ok(lista.every(function (item) { return item.data <= '2026-02-02'; }));

    const dadosSerie = await serie(resultado.serieId);
    assert.equal(dadosSerie.status, 'ativa');
    assert.equal(dadosSerie.dataFim, '2026-02-02');
    assert.equal(dadosSerie.userId, 'alice');
});

test('série sem data de término gera apenas uma janela limitada', async function () {
    const resultado = await criarSerie({ dataFim: null });

    const lista = await ocorrencias();
    assert.ok(lista.length > 0);
    assert.ok(lista.length <= Recurrence.MAX_OCORRENCIAS_POR_GERACAO);
    assert.ok(lista.every(function (item) {
        return item.data <= resultado.geradoAte;
    }));

    const dadosSerie = await serie(resultado.serieId);
    assert.equal(dadosSerie.dataFim, null);
    assert.ok(dadosSerie.geradoAte);

    const antes = lista.length;
    const geracao = await RecurrenceService.garantirOcorrenciasAtivas(db, {
        userId: 'alice',
        montarOcorrencia: montarOcorrencia,
        serverTimestamp: timestamp,
        hoje: new Date(2026, 0, 1)
    });
    const depois = await ocorrencias();
    assert.equal(geracao.ocorrenciasCriadas, 0);
    assert.equal(depois.length, antes);
});

test('geração progressiva não duplica ocorrências', async function () {
    const resultado = await criarSerie({}, { maxOcorrencias: 2 });
    assert.deepEqual(resultado.datas, ['2026-01-05', '2026-01-12']);

    await RecurrenceService.garantirOcorrenciasAtivas(db, {
        userId: 'alice',
        montarOcorrencia: montarOcorrencia,
        serverTimestamp: timestamp,
        hoje: new Date(2026, 0, 1),
        maxOcorrencias: 10
    });
    const lista = await ocorrencias();

    assert.equal(lista.length, 5);
    assert.equal(new Set(lista.map(function (item) { return item.data; })).size, 5);
    assert.deepEqual(lista.map(function (item) { return item.data; }), [
        '2026-01-05',
        '2026-01-12',
        '2026-01-19',
        '2026-01-26',
        '2026-02-02'
    ]);
});

test('excluir somente uma ocorrência intermediária preserva as demais', async function () {
    const criada = await criarSerie();
    const alvo = await ocorrenciaPorData('2026-01-19');

    await RecurrenceService.excluirSomenteOcorrencia(db, {
        plantaoId: alvo.id,
        userId: 'alice',
        serverTimestamp: timestamp
    });

    const lista = await ocorrencias();
    assert.deepEqual(lista.map(function (item) { return item.data; }), [
        '2026-01-05',
        '2026-01-12',
        '2026-01-26',
        '2026-02-02'
    ]);

    const dadosSerie = await serie(criada.serieId);
    assert.equal(dadosSerie.status, 'ativa');
    assert.deepEqual(dadosSerie.excecoes, ['2026-01-19']);
});

test('ocorrência excluída individualmente não é recriada pela geração', async function () {
    const criada = await criarSerie();
    const alvo = await ocorrenciaPorData('2026-01-19');

    await RecurrenceService.excluirSomenteOcorrencia(db, {
        plantaoId: alvo.id,
        userId: 'alice',
        serverTimestamp: timestamp
    });

    // Força o ponteiro para antes da data excluída, simulando uma nova geração
    await db.collection('recorrencias').doc(criada.serieId).update({ geradoAte: '2026-01-11' });

    await RecurrenceService.garantirOcorrenciasAtivas(db, {
        userId: 'alice',
        montarOcorrencia: montarOcorrencia,
        serverTimestamp: timestamp,
        hoje: new Date(2026, 0, 1),
        maxOcorrencias: 10
    });

    assert.equal(await ocorrenciaPorData('2026-01-19'), undefined);
    const lista = await ocorrencias();
    assert.deepEqual(lista.map(function (item) { return item.data; }), [
        '2026-01-05',
        '2026-01-12',
        '2026-01-26',
        '2026-02-02'
    ]);
});

test('excluir somente a primeira ocorrência preserva as futuras', async function () {
    const criada = await criarSerie();
    const alvo = await ocorrenciaPorData('2026-01-05');

    await RecurrenceService.excluirSomenteOcorrencia(db, {
        plantaoId: alvo.id,
        userId: 'alice',
        serverTimestamp: timestamp
    });

    const lista = await ocorrencias();
    assert.deepEqual(lista.map(function (item) { return item.data; }), [
        '2026-01-12',
        '2026-01-19',
        '2026-01-26',
        '2026-02-02'
    ]);
    assert.deepEqual((await serie(criada.serieId)).excecoes, ['2026-01-05']);
});

test('excluir somente a última ocorrência preserva as anteriores', async function () {
    const criada = await criarSerie();
    const alvo = await ocorrenciaPorData('2026-02-02');

    await RecurrenceService.excluirSomenteOcorrencia(db, {
        plantaoId: alvo.id,
        userId: 'alice',
        serverTimestamp: timestamp
    });

    const lista = await ocorrencias();
    assert.deepEqual(lista.map(function (item) { return item.data; }), [
        '2026-01-05',
        '2026-01-12',
        '2026-01-19',
        '2026-01-26'
    ]);
    assert.deepEqual((await serie(criada.serieId)).excecoes, ['2026-02-02']);
});

test('excluir ocorrência e futuras encerra a série na ocorrência anterior', async function () {
    const criada = await criarSerie();
    const alvo = await ocorrenciaPorData('2026-01-19');

    const resultado = await RecurrenceService.excluirOcorrenciaEFuturas(db, {
        plantaoId: alvo.id,
        userId: 'alice',
        serverTimestamp: timestamp
    });

    assert.equal(resultado.dataFim, '2026-01-12');

    const lista = await ocorrencias();
    assert.deepEqual(lista.map(function (item) { return item.data; }), [
        '2026-01-05',
        '2026-01-12'
    ]);

    const dadosSerie = await serie(criada.serieId);
    assert.equal(dadosSerie.status, 'encerrada');
    assert.equal(dadosSerie.dataFim, '2026-01-12');
    assert.ok(dadosSerie.excecoes.includes('2026-01-19'));

    await RecurrenceService.garantirOcorrenciasAtivas(db, {
        userId: 'alice',
        montarOcorrencia: montarOcorrencia,
        serverTimestamp: timestamp,
        hoje: new Date(2026, 5, 1)
    });
    const depois = await ocorrencias();
    assert.deepEqual(depois.map(function (item) { return item.data; }), [
        '2026-01-05',
        '2026-01-12'
    ]);
});

test('excluir a primeira ocorrência e futuras remove toda a série', async function () {
    const criada = await criarSerie();
    const alvo = await ocorrenciaPorData('2026-01-05');

    await RecurrenceService.excluirOcorrenciaEFuturas(db, {
        plantaoId: alvo.id,
        userId: 'alice',
        serverTimestamp: timestamp
    });

    assert.deepEqual(await ocorrencias(), []);
    const dadosSerie = await serie(criada.serieId);
    assert.equal(dadosSerie.status, 'encerrada');
    assert.equal(dadosSerie.dataFim, '2026-01-04');
});

test('evento não recorrente continua sendo excluído individualmente', async function () {
    await db.collection('plantoes').doc('unico').set({
        userId: 'alice',
        data: '2026-01-05',
        horaInicio: '08:00',
        tempoPlantao: 12,
        local: 'Hospital Central',
        valorHora: 100,
        valorTotal: 1200
    });

    const resultado = await RecurrenceService.excluirSomenteOcorrencia(db, {
        plantaoId: 'unico',
        userId: 'alice',
        serverTimestamp: timestamp
    });

    assert.equal(resultado.serieId, null);
    assert.deepEqual(await ocorrencias(), []);
});

test('evento não recorrente não aceita exclusão de série', async function () {
    await db.collection('plantoes').doc('unico').set({
        userId: 'alice',
        data: '2026-01-05',
        horaInicio: '08:00',
        tempoPlantao: 12,
        local: 'Hospital Central',
        valorHora: 100,
        valorTotal: 1200
    });

    await assert.rejects(
        RecurrenceService.excluirOcorrenciaEFuturas(db, {
            plantaoId: 'unico',
            userId: 'alice',
            serverTimestamp: timestamp
        }),
        function (erro) { return erro.code === 'NAO_RECORRENTE'; }
    );

    assert.equal((await ocorrencias()).length, 1);
});

test('usuário não exclui ocorrência de outro usuário', async function () {
    await criarSerie();
    const alvo = await ocorrenciaPorData('2026-01-19');

    await assert.rejects(
        RecurrenceService.excluirSomenteOcorrencia(db, {
            plantaoId: alvo.id,
            userId: 'bob',
            serverTimestamp: timestamp
        }),
        function (erro) { return erro.code === 'SEM_PERMISSAO'; }
    );

    assert.ok(await ocorrenciaPorData('2026-01-19'));
});
