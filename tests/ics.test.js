'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ICS = require('../src/ics.js');

function plantao(extra) {
    return Object.assign({
        id: 'plantao123',
        data: '2026-06-01',
        horaInicio: '19:00',
        tempoPlantao: 12,
        local: 'Hospital São Paulo',
        observacoes: 'Levar carimbo'
    }, extra || {});
}

function eventoDoConteudo(conteudo) {
    const inicio = conteudo.indexOf('BEGIN:VEVENT');
    const fim = conteudo.indexOf('END:VEVENT');
    assert.ok(inicio >= 0 && fim > inicio);
    return conteudo.slice(inicio, fim + 'END:VEVENT'.length);
}

test('converte horário de São Paulo para UTC', () => {
    const inicio = ICS.converterParaUTC('2026-06-01', '19:00');
    const fim = new Date(inicio.getTime() + 12 * 60 * 60 * 1000);

    assert.equal(ICS.formatarUTC(inicio), '20260601T220000Z');
    assert.equal(ICS.formatarUTC(fim), '20260602T100000Z');
});

test('rejeita datas e horários inválidos', () => {
    assert.equal(ICS.parseDataISO('2026-02-29'), null);
    assert.equal(ICS.parseDataISO('2026-13-01'), null);
    assert.equal(ICS.parseHora('24:00'), null);
    assert.equal(ICS.parseHora('19:60'), null);
    assert.equal(ICS.converterParaUTC('2026-02-29', '19:00'), null);
});

test('aceita 29 de fevereiro em ano bissexto', () => {
    assert.deepEqual(ICS.parseDataISO('2024-02-29'), { ano: 2024, mes: 2, dia: 29 });
});

test('escapa caracteres especiais do formato ICS', () => {
    assert.equal(
        ICS.escaparTexto('A, B; C\\D\nE'),
        'A\\, B\\; C\\\\D\\nE'
    );
});

test('gera UID estável a partir do ID do plantão', () => {
    const a = ICS.obterUid(plantao());
    const b = ICS.obterUid(plantao());

    assert.equal(a, b);
    assert.match(a, /^plantao123@myshift\.com\.br$/);
    assert.notEqual(a, ICS.obterUid(plantao({ id: 'outro' })));
});

test('gera UID estável para ocorrência de série', () => {
    const a = ICS.obterUid({
        serieId: 'serie abc',
        ocorrenciaData: '2026-06-01',
        data: '2026-06-01'
    });
    const b = ICS.obterUid({
        serieId: 'serie abc',
        ocorrenciaData: '2026-06-01',
        data: '2026-06-01'
    });

    assert.equal(a, b);
    assert.match(a, /^serie-abc_20260601@myshift\.com\.br$/);
});

test('gera VCALENDAR RFC 5545 com evento, fuso e lembrete', () => {
    const conteudo = ICS.gerarCalendarioICS([plantao()], {
        agora: new Date('2026-05-01T12:00:00Z'),
        nomeCalendario: 'MyShift - Plantões'
    });
    const evento = eventoDoConteudo(conteudo);

    assert.ok(conteudo.startsWith('BEGIN:VCALENDAR\r\n'));
    assert.ok(conteudo.endsWith('END:VCALENDAR\r\n'));
    assert.ok(conteudo.includes('VERSION:2.0'));
    assert.ok(conteudo.includes('X-WR-TIMEZONE:America/Sao_Paulo'));
    assert.ok(evento.includes('DTSTAMP:20260501T120000Z'));
    assert.ok(evento.includes('DTSTART:20260601T220000Z'));
    assert.ok(evento.includes('DTEND:20260602T100000Z'));
    assert.ok(evento.includes('SUMMARY:Plantão — Hospital São Paulo'));
    assert.ok(evento.includes('LOCATION:Hospital São Paulo'));
    assert.ok(evento.includes('TRIGGER:-PT30M'));
    assert.ok(evento.includes('UID:plantao123@myshift.com.br'));
});

test('permite desativar o lembrete', () => {
    const conteudo = ICS.gerarCalendarioICS([plantao()], { lembreteMinutos: null });

    assert.equal(conteudo.includes('BEGIN:VALARM'), false);
    assert.equal(conteudo.includes('TRIGGER:'), false);
});

test('gera um VEVENT para cada ocorrência válida', () => {
    const conteudo = ICS.gerarCalendarioICS([
        plantao({ id: 'a', data: '2026-06-01' }),
        plantao({ id: 'b', data: '2026-06-03' }),
        { id: 'invalido', data: '2026-06-04', horaInicio: '25:00', tempoPlantao: 12 }
    ]);

    assert.equal((conteudo.match(/BEGIN:VEVENT/g) || []).length, 2);
    assert.ok(conteudo.includes('UID:a@myshift.com.br'));
    assert.ok(conteudo.includes('UID:b@myshift.com.br'));
});

test('dobra linhas longas sem ultrapassar 75 bytes', () => {
    const conteudo = ICS.gerarCalendarioICS([plantao({
        local: 'Hospital com um nome muito longo para forçar a dobra de linha no padrão ICS',
        observacoes: 'Observação longa com acentuação: ação, coração e informação. '.repeat(4)
    })]);
    const linhas = conteudo.split('\r\n').filter(Boolean);

    linhas.forEach(function (linha) {
        assert.ok(Buffer.byteLength(linha, 'utf8') <= 75, `Linha longa: ${linha}`);
    });
});

test('gera nome de arquivo seguro e previsível', () => {
    assert.equal(
        ICS.nomeArquivoICS(plantao()),
        'plantao_2026-06-01_1900_hospital-sao-paulo.ics'
    );
    assert.equal(
        ICS.nomeArquivoICS(plantao(), 'serie'),
        'serie_2026-06-01_1900_hospital-sao-paulo.ics'
    );
});
