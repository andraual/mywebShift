'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const Recurrence = require('../src/recurrence.js');
const RecurrenceService = require('../src/recurrence-service.js');
const { FakeFirestore } = require('./helpers/fake-firestore.js');

let db;

function timestamp() {
    return new Date('2026-01-01T00:00:00.000Z');
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

test.beforeEach(function () {
    db = new FakeFirestore();
});

test('cria série finita vinculada e sem ocorrências após a data limite', async function () {
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
});

test('não cria série quando nenhuma ocorrência é válida no período', async function () {
    await assert.rejects(
        criarSerie({ dataInicial: '2025-01-06', dataFim: '2025-02-03' }),
        function (erro) { return erro.code === 'SEM_OCORRENCIAS'; }
    );

    assert.deepEqual(await ocorrencias(), []);
    const series = await db.collection('recorrencias').get();
    assert.equal(series.empty, true);
});

test('série sem data de término fica limitada e não duplica ao gerar novamente', async function () {
    const resultado = await criarSerie({ dataFim: null });

    const lista = await ocorrencias();
    assert.ok(lista.length > 0);
    assert.ok(lista.length <= Recurrence.MAX_OCORRENCIAS_POR_GERACAO);
    assert.ok(lista.every(function (item) { return item.data <= resultado.geradoAte; }));

    const geracao = await RecurrenceService.garantirOcorrenciasAtivas(db, {
        userId: 'alice',
        montarOcorrencia: montarOcorrencia,
        serverTimestamp: timestamp,
        hoje: new Date(2026, 0, 1)
    });
    const depois = await ocorrencias();

    assert.equal(geracao.ocorrenciasCriadas, 0);
    assert.equal(depois.length, lista.length);
    assert.equal(new Set(depois.map(function (item) { return item.data; })).size, depois.length);
});

test('geração progressiva completa a janela sem repetir ocorrências', async function () {
    await criarSerie({}, { maxOcorrencias: 2 });

    await RecurrenceService.garantirOcorrenciasAtivas(db, {
        userId: 'alice',
        montarOcorrencia: montarOcorrencia,
        serverTimestamp: timestamp,
        hoje: new Date(2026, 0, 1),
        maxOcorrencias: 10
    });

    const lista = await ocorrencias();
    assert.deepEqual(lista.map(function (item) { return item.data; }), [
        '2026-01-05',
        '2026-01-12',
        '2026-01-19',
        '2026-01-26',
        '2026-02-02'
    ]);
});

test('excluir somente ocorrência intermediária registra exceção e preserva o restante', async function () {
    const criada = await criarSerie();
    const alvo = await ocorrenciaPorData('2026-01-19');

    await RecurrenceService.excluirSomenteOcorrencia(db, {
        plantaoId: alvo.id,
        userId: 'alice',
        serverTimestamp: timestamp
    });

    assert.deepEqual((await ocorrencias()).map(function (item) { return item.data; }), [
        '2026-01-05',
        '2026-01-12',
        '2026-01-26',
        '2026-02-02'
    ]);

    const dadosSerie = await serie(criada.serieId);
    assert.equal(dadosSerie.status, 'ativa');
    assert.deepEqual(dadosSerie.excecoes, ['2026-01-19']);
});

test('ocorrência excluída não é recriada quando o ponteiro de geração retrocede', async function () {
    const criada = await criarSerie();
    const alvo = await ocorrenciaPorData('2026-01-19');

    await RecurrenceService.excluirSomenteOcorrencia(db, {
        plantaoId: alvo.id,
        userId: 'alice',
        serverTimestamp: timestamp
    });
    await db.collection('recorrencias').doc(criada.serieId).update({ geradoAte: '2026-01-11' });

    await RecurrenceService.garantirOcorrenciasAtivas(db, {
        userId: 'alice',
        montarOcorrencia: montarOcorrencia,
        serverTimestamp: timestamp,
        hoje: new Date(2026, 0, 1),
        maxOcorrencias: 10
    });

    assert.equal(await ocorrenciaPorData('2026-01-19'), undefined);
});

test('excluir somente a primeira ou a última ocorrência preserva as demais', async function () {
    const primeira = await criarSerie();
    const alvoPrimeira = await ocorrenciaPorData('2026-01-05');
    await RecurrenceService.excluirSomenteOcorrencia(db, {
        plantaoId: alvoPrimeira.id,
        userId: 'alice',
        serverTimestamp: timestamp
    });
    assert.deepEqual((await ocorrencias()).map(function (item) { return item.data; }), [
        '2026-01-12',
        '2026-01-19',
        '2026-01-26',
        '2026-02-02'
    ]);
    assert.deepEqual((await serie(primeira.serieId)).excecoes, ['2026-01-05']);

    db.limpar();
    const ultima = await criarSerie();
    const alvoUltima = await ocorrenciaPorData('2026-02-02');
    await RecurrenceService.excluirSomenteOcorrencia(db, {
        plantaoId: alvoUltima.id,
        userId: 'alice',
        serverTimestamp: timestamp
    });
    assert.deepEqual((await ocorrencias()).map(function (item) { return item.data; }), [
        '2026-01-05',
        '2026-01-12',
        '2026-01-19',
        '2026-01-26'
    ]);
    assert.deepEqual((await serie(ultima.serieId)).excecoes, ['2026-02-02']);
});

test('excluir ocorrência e futuras encerra a série e preserva as anteriores', async function () {
    const criada = await criarSerie();
    const alvo = await ocorrenciaPorData('2026-01-19');

    const resultado = await RecurrenceService.excluirOcorrenciaEFuturas(db, {
        plantaoId: alvo.id,
        userId: 'alice',
        serverTimestamp: timestamp
    });

    assert.equal(resultado.dataFim, '2026-01-12');
    assert.deepEqual((await ocorrencias()).map(function (item) { return item.data; }), [
        '2026-01-05',
        '2026-01-12'
    ]);

    const dadosSerie = await serie(criada.serieId);
    assert.equal(dadosSerie.status, 'encerrada');
    assert.equal(dadosSerie.dataFim, '2026-01-12');

    await RecurrenceService.garantirOcorrenciasAtivas(db, {
        userId: 'alice',
        montarOcorrencia: montarOcorrencia,
        serverTimestamp: timestamp,
        hoje: new Date(2026, 5, 1)
    });
    assert.deepEqual((await ocorrencias()).map(function (item) { return item.data; }), [
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

test('evento não recorrente mantém exclusão individual', async function () {
    await db.collection('plantoes').doc('unico').set({
        userId: 'alice',
        data: '2026-01-05',
        local: 'Hospital Central'
    });

    const resultado = await RecurrenceService.excluirSomenteOcorrencia(db, {
        plantaoId: 'unico',
        userId: 'alice',
        serverTimestamp: timestamp
    });

    assert.equal(resultado.serieId, null);
    assert.deepEqual(await ocorrencias(), []);
});

test('evento não recorrente não aceita exclusão de futuros', async function () {
    await db.collection('plantoes').doc('unico').set({
        userId: 'alice',
        data: '2026-01-05',
        local: 'Hospital Central'
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

test('usuário não exclui plantão de outro usuário', async function () {
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
