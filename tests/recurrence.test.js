'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const Recurrence = require('../src/recurrence.js');

function regra(extra) {
    return Object.assign({
        dataInicial: '2026-01-05',
        dataFim: '2026-02-02',
        tipo: 'semanal',
        excecoes: [],
        geradoAte: null
    }, extra || {});
}

function hoje() {
    return new Date(2026, 0, 1);
}

test('valida data limite anterior à data inicial', () => {
    const resultado = Recurrence.validarRegra(regra({
        dataInicial: '2026-02-10',
        dataFim: '2026-02-01'
    }));

    assert.equal(resultado.valido, false);
    assert.ok(resultado.erros.some((erro) => erro.includes('posterior ou igual')));
});

test('exige data limite quando o término com data foi selecionado', () => {
    const resultado = Recurrence.validarRegra(regra({
        dataInicial: '2026-02-10',
        dataFim: ''
    }));

    assert.equal(resultado.valido, false);
    assert.ok(resultado.erros.some((erro) => erro.includes('Informe a data limite')));
});

test('aceita data limite igual à data inicial', () => {
    const resultado = Recurrence.validarRegra(regra({
        dataInicial: '2026-02-10',
        dataFim: '2026-02-10'
    }));

    assert.equal(resultado.valido, true);
});

test('recorrência com data limite não cria ocorrências depois do limite', () => {
    const resultado = Recurrence.gerarOcorrencias(regra(), { hoje: hoje() });

    assert.deepEqual(resultado.datas, [
        '2026-01-05',
        '2026-01-12',
        '2026-01-19',
        '2026-01-26',
        '2026-02-02'
    ]);
    assert.ok(resultado.datas.every((data) => data <= '2026-02-02'));
    assert.equal(resultado.geradoAte, '2026-02-02');
});

test('progressão semanal, quinzenal e mensal preserva a periodicidade', () => {
    const semanal = Recurrence.gerarOcorrencias(regra({ dataFim: '2026-01-19' }), { hoje: hoje() });
    assert.deepEqual(semanal.datas, ['2026-01-05', '2026-01-12', '2026-01-19']);

    const quinzenal = Recurrence.gerarOcorrencias(regra({
        dataFim: '2026-02-02',
        tipo: 'quinzenal'
    }), { hoje: hoje() });
    assert.deepEqual(quinzenal.datas, ['2026-01-05', '2026-01-19', '2026-02-02']);

    const mensal = Recurrence.gerarOcorrencias(regra({
        dataFim: '2026-04-10',
        tipo: 'mensal'
    }), { hoje: hoje() });
    assert.equal(mensal.datas.length, 4);
    mensal.datas.forEach((data) => {
        assert.equal(Recurrence.parseDataISO(data).getDay(), Recurrence.parseDataISO('2026-01-05').getDay());
    });
});

test('recorrência sem data de término usa janela limitada e não gera infinitamente', () => {
    const resultado = Recurrence.gerarOcorrencias(regra({
        dataFim: null
    }), {
        hoje: new Date(2026, 0, 5),
        janelaDias: 30
    });

    assert.equal(resultado.datas.length, 5);
    assert.equal(resultado.limite, '2026-02-04');
    assert.equal(resultado.geradoAte, '2026-02-04');
    assert.ok(resultado.datas.every((data) => data <= '2026-02-04'));

    const segundaExecucao = Recurrence.gerarOcorrencias(regra({
        dataFim: null,
        geradoAte: resultado.geradoAte
    }), {
        hoje: new Date(2026, 0, 5),
        janelaDias: 30
    });
    assert.deepEqual(segundaExecucao.datas, []);
});

test('limite máximo por geração evita explosão de documentos', () => {
    const resultado = Recurrence.gerarOcorrencias(regra({
        dataFim: null
    }), {
        hoje: new Date(2026, 0, 5),
        janelaDias: 3650,
        maxOcorrencias: 10
    });

    assert.equal(resultado.datas.length, 10);
    assert.equal(resultado.atingiuLimiteMaximo, true);
    assert.equal(resultado.geradoAte, resultado.datas[resultado.datas.length - 1]);
});

test('recorrência não duplica ocorrências entre gerações', () => {
    const primeira = Recurrence.gerarOcorrencias(regra({
        dataFim: null
    }), {
        hoje: new Date(2026, 0, 5),
        janelaDias: 30
    });

    const segunda = Recurrence.gerarOcorrencias(regra({
        dataFim: null,
        geradoAte: primeira.geradoAte
    }), {
        hoje: new Date(2026, 0, 5),
        janelaDias: 90
    });

    const sobrepostas = segunda.datas.filter((data) => primeira.datas.includes(data));
    assert.deepEqual(sobrepostas, []);
    assert.ok(segunda.datas.every((data) => data > primeira.geradoAte));
});

test('IDs determinísticos identificam cada ocorrência da série', () => {
    const a = Recurrence.idOcorrencia('serie123', '2026-01-19');
    const b = Recurrence.idOcorrencia('serie123', '2026-01-19');
    const c = Recurrence.idOcorrencia('serie123', '2026-01-26');

    assert.equal(a, b);
    assert.notEqual(a, c);
});

test('exceção impede que a ocorrência individual seja recriada', () => {
    const resultado = Recurrence.gerarOcorrencias(regra({
        dataFim: '2026-02-02',
        geradoAte: '2026-01-11',
        excecoes: ['2026-01-19']
    }), {
        hoje: new Date(2026, 0, 5)
    });

    assert.deepEqual(resultado.datas, ['2026-01-12', '2026-01-26', '2026-02-02']);
    assert.equal(resultado.datas.includes('2026-01-19'), false);
});

test('excluir somente ocorrência intermediária preserva anteriores e futuras', () => {
    const base = regra({ dataFim: null, geradoAte: null });
    const excecoes = Recurrence.planejarExcecao(base, '2026-01-19');

    assert.deepEqual(excecoes, ['2026-01-19']);

    const resultado = Recurrence.gerarOcorrencias(regra({
        dataFim: '2026-02-16',
        excecoes: excecoes
    }), { hoje: hoje() });

    assert.equal(resultado.datas.includes('2026-01-19'), false);
    assert.ok(resultado.datas.includes('2026-01-05'));
    assert.ok(resultado.datas.includes('2026-01-12'));
    assert.ok(resultado.datas.includes('2026-01-26'));
    assert.ok(resultado.datas.includes('2026-02-02'));
});

test('excluir somente a primeira ou a última ocorrência registra apenas a exceção', () => {
    const base = regra({ dataFim: null });

    assert.deepEqual(Recurrence.planejarExcecao(base, '2026-01-05'), ['2026-01-05']);
    assert.deepEqual(Recurrence.planejarExcecao(base, '2026-02-02'), ['2026-02-02']);
});

test('excluir ocorrência intermediária e futuras encerra a série na anterior', () => {
    const plano = Recurrence.planejarExclusaoFutura(regra({ dataFim: null }), '2026-01-19');

    assert.equal(plano.status, 'encerrada');
    assert.equal(plano.dataFim, '2026-01-12');
    assert.deepEqual(plano.excecoesAdicionar, ['2026-01-19']);
});

test('excluir a primeira ocorrência e futuras não deixa ocorrências anteriores', () => {
    const plano = Recurrence.planejarExclusaoFutura(regra({ dataFim: null }), '2026-01-05');

    assert.equal(plano.dataFim, '2026-01-04');
});

test('excluir a última ocorrência e futuras preserva todas as anteriores', () => {
    const plano = Recurrence.planejarExclusaoFutura(regra({ dataFim: null }), '2026-02-02');

    assert.equal(plano.dataFim, '2026-01-26');
});

test('filtro de exclusão futura considera a data original da ocorrência', () => {
    const ocorrencias = [
        { id: 'a', serieId: 's1', data: '2026-01-05', ocorrenciaData: '2026-01-05' },
        { id: 'b', serieId: 's1', data: '2026-01-12', ocorrenciaData: '2026-01-12' },
        { id: 'c', serieId: 's1', data: '2026-01-15', ocorrenciaData: '2026-01-19' },
        { id: 'd', serieId: 's1', data: '2026-02-02', ocorrenciaData: '2026-02-02' },
        { id: 'e', serieId: 's2', data: '2026-01-19', ocorrenciaData: '2026-01-19' },
        { id: 'f', data: '2026-01-19' }
    ];

    const futuras = Recurrence.filtrarOcorrenciasFuturas(ocorrencias, 's1', '2026-01-19');

    assert.deepEqual(futuras.map((item) => item.id), ['c', 'd']);
});

test('eventos não recorrentes não são tratados como série', () => {
    assert.equal(Recurrence.ehOcorrenciaDeSerie({ data: '2026-01-05' }), false);
    assert.equal(Recurrence.ehOcorrenciaDeSerie({ serieId: 's1', data: '2026-01-05' }), true);
});
