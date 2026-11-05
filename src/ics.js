(function (global) {
    'use strict';

    const TIMEZONE = 'America/Sao_Paulo';
    const PRODID = '-//MyShift//Calendario de Plantoes//PT-BR';
    const UID_DOMAIN = 'myshift.com.br';
    const LEMBRETE_PADRAO_MINUTOS = 30;

    function pad(valor, tamanho) {
        return String(valor).padStart(tamanho || 2, '0');
    }

    function parseDataISO(valor) {
        if (typeof valor !== 'string') return null;
        const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
        if (!partes) return null;

        const ano = Number(partes[1]);
        const mes = Number(partes[2]);
        const dia = Number(partes[3]);
        const data = new Date(Date.UTC(ano, mes - 1, dia));

        if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
            return null;
        }

        return { ano: ano, mes: mes, dia: dia };
    }

    function parseHora(valor) {
        if (typeof valor !== 'string') return null;
        const partes = /^(\d{1,2}):(\d{2})$/.exec(valor);
        if (!partes) return null;

        const hora = Number(partes[1]);
        const minuto = Number(partes[2]);
        if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return null;

        return { hora: hora, minuto: minuto };
    }

    function obterOffsetMs(data, timeZone) {
        const formato = new Intl.DateTimeFormat('en-US', {
            timeZone: timeZone || TIMEZONE,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const partes = {};
        formato.formatToParts(data).forEach(function (parte) {
            if (parte.type !== 'literal') partes[parte.type] = parte.value;
        });

        const comoUTC = Date.UTC(
            Number(partes.year),
            Number(partes.month) - 1,
            Number(partes.day),
            Number(partes.hour),
            Number(partes.minute),
            Number(partes.second)
        );

        return comoUTC - data.getTime();
    }

    function converterParaUTC(dataISO, horaTexto, timeZone) {
        const data = parseDataISO(dataISO);
        const hora = parseHora(horaTexto);
        if (!data || !hora) return null;

        const alvo = Date.UTC(data.ano, data.mes - 1, data.dia, hora.hora, hora.minuto, 0, 0);
        let utc = alvo;

        for (let tentativa = 0; tentativa < 4; tentativa++) {
            const offset = obterOffsetMs(new Date(utc), timeZone || TIMEZONE);
            const ajustado = alvo - offset;
            if (ajustado === utc) break;
            utc = ajustado;
        }

        const resultado = new Date(utc);
        return isNaN(resultado.getTime()) ? null : resultado;
    }

    function formatarUTC(data) {
        return [
            data.getUTCFullYear(),
            pad(data.getUTCMonth() + 1),
            pad(data.getUTCDate()),
            'T',
            pad(data.getUTCHours()),
            pad(data.getUTCMinutes()),
            pad(data.getUTCSeconds()),
            'Z'
        ].join('');
    }

    function formatarDataHoraLocal(data) {
        return new Intl.DateTimeFormat('pt-BR', {
            timeZone: TIMEZONE,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
        }).format(data);
    }

    function escaparTexto(valor) {
        return String(valor === null || valor === undefined ? '' : valor)
            .replace(/\\/g, '\\\\')
            .replace(/\r\n|\r|\n/g, '\\n')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,');
    }

    function medirUtf8(texto) {
        if (typeof TextEncoder !== 'undefined') {
            return new TextEncoder().encode(texto).length;
        }
        return unescape(encodeURIComponent(texto)).length;
    }

    function dobrarLinha(linha) {
        const texto = String(linha);
        if (!texto) return [''];

        const partes = [];
        let atual = '';

        Array.from(texto).forEach(function (caractere) {
            if (atual && medirUtf8(atual + caractere) > 75) {
                partes.push(atual);
                atual = ' ' + caractere;
                return;
            }
            atual += caractere;
        });

        if (atual) partes.push(atual);
        return partes;
    }

    function sanitizarUid(valor) {
        return String(valor || '')
            .trim()
            .replace(/[^A-Za-z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function slug(valor) {
        const texto = String(valor || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Za-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase()
            .slice(0, 50);
        return texto || 'local';
    }

    function obterUid(plantao) {
        const dados = plantao || {};
        const id = dados.id || dados.plantaoId;
        if (id) return `${sanitizarUid(id)}@${UID_DOMAIN}`;

        if (dados.serieId && (dados.ocorrenciaData || dados.data)) {
            return `${sanitizarUid(dados.serieId)}_${String(dados.ocorrenciaData || dados.data).replace(/-/g, '')}@${UID_DOMAIN}`;
        }

        return [
            'plantao',
            sanitizarUid(dados.data),
            sanitizarUid(dados.horaInicio),
            slug(dados.local)
        ].filter(Boolean).join('_') + `@${UID_DOMAIN}`;
    }

    function obterHoras(plantao) {
        const horas = Number(plantao && plantao.tempoPlantao);
        return isFinite(horas) && horas > 0 ? horas : null;
    }

    function montarDescricao(plantao, inicioUTC, fimUTC, horas, opcoes) {
        const linhas = [];

        if (plantao.especialidade) linhas.push(`Especialidade: ${plantao.especialidade}`);
        linhas.push(`Início: ${formatarDataHoraLocal(inicioUTC)} (${TIMEZONE})`);
        linhas.push(`Término: ${formatarDataHoraLocal(fimUTC)} (${TIMEZONE})`);
        linhas.push(`Duração: ${horas} ${Number(horas) === 1 ? 'hora' : 'horas'}`);

        if (plantao.serieId) linhas.push('Ocorrência de plantão recorrente.');
        if (plantao.observacoes) linhas.push(`Observações: ${plantao.observacoes}`);
        if (opcoes && opcoes.descricaoExtra) linhas.push(String(opcoes.descricaoExtra));

        linhas.push('Gerado pelo MyShift.');
        return linhas.join('\n');
    }

    function montarLembrete(minutos) {
        if (minutos === null || minutos === false || minutos === undefined) return [];
        const valor = Math.round(Number(minutos));
        if (!isFinite(valor) || valor <= 0) return [];

        return [
            'BEGIN:VALARM',
            `TRIGGER:-PT${valor}M`,
            'ACTION:DISPLAY',
            'DESCRIPTION:Lembrete do plantão',
            'END:VALARM'
        ];
    }

    function criarEvento(plantao, opcoes) {
        const config = opcoes || {};
        const dados = plantao || {};
        const horas = obterHoras(dados);
        if (!horas) return null;

        const inicioUTC = converterParaUTC(dados.data || dados.ocorrenciaData, dados.horaInicio, config.timezone);
        if (!inicioUTC) return null;

        const fimUTC = new Date(inicioUTC.getTime() + Math.round(horas * 60) * 60000);
        const local = String(dados.local || '').trim() || 'Plantão';
        const titulo = `Plantão — ${local}`;
        const descricao = montarDescricao(dados, inicioUTC, fimUTC, horas, config);
        const agora = config.agora instanceof Date ? config.agora : new Date();
        const lembrete = config.lembreteMinutos === undefined
            ? LEMBRETE_PADRAO_MINUTOS
            : config.lembreteMinutos;
        const sequencia = Number.isFinite(Number(config.sequencia)) ? Number(config.sequencia) : 0;

        const linhas = [
            'BEGIN:VEVENT',
            `UID:${obterUid(dados)}`,
            `DTSTAMP:${formatarUTC(agora)}`,
            `DTSTART:${formatarUTC(inicioUTC)}`,
            `DTEND:${formatarUTC(fimUTC)}`,
            `SUMMARY:${escaparTexto(titulo)}`,
            `DESCRIPTION:${escaparTexto(descricao)}`,
            `LOCATION:${escaparTexto(local)}`,
            'STATUS:CONFIRMED',
            'TRANSP:OPAQUE',
            `SEQUENCE:${sequencia}`
        ];

        montarLembrete(lembrete).forEach(function (linha) { linhas.push(linha); });
        linhas.push('END:VEVENT');
        return linhas;
    }

    function gerarCalendarioICS(entrada, opcoes) {
        const config = opcoes || {};
        const lista = Array.isArray(entrada) ? entrada : [entrada];
        const agora = config.agora instanceof Date ? config.agora : new Date();
        const eventos = [];

        lista.forEach(function (plantao) {
            const evento = criarEvento(plantao, Object.assign({}, config, { agora: agora }));
            if (evento) eventos.push(evento);
        });

        const linhas = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            `PRODID:${PRODID}`,
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            `X-WR-TIMEZONE:${TIMEZONE}`
        ];

        if (config.nomeCalendario) {
            linhas.push(`X-WR-CALNAME:${escaparTexto(config.nomeCalendario)}`);
        }

        eventos.forEach(function (evento) {
            evento.forEach(function (linha) { linhas.push(linha); });
        });

        linhas.push('END:VCALENDAR');

        const resultado = [];
        linhas.forEach(function (linha) {
            dobrarLinha(linha).forEach(function (parte) { resultado.push(parte); });
        });

        return resultado.join('\r\n') + '\r\n';
    }

    function gerarICS(plantao, opcoes) {
        return gerarCalendarioICS([plantao], opcoes);
    }

    function nomeArquivoICS(plantao, prefixo) {
        const dados = plantao || {};
        const data = dados.data || dados.ocorrenciaData || 'sem-data';
        const inicio = String(dados.horaInicio || '').replace(':', '');
        const local = slug(dados.local);
        const partes = [prefixo || 'plantao', data];
        if (inicio) partes.push(inicio);
        partes.push(local);
        return `${partes.join('_')}.ics`;
    }

    const api = {
        TIMEZONE: TIMEZONE,
        LEMBRETE_PADRAO_MINUTOS: LEMBRETE_PADRAO_MINUTOS,
        parseDataISO: parseDataISO,
        parseHora: parseHora,
        converterParaUTC: converterParaUTC,
        formatarUTC: formatarUTC,
        escaparTexto: escaparTexto,
        dobrarLinha: dobrarLinha,
        obterUid: obterUid,
        criarEvento: criarEvento,
        gerarCalendarioICS: gerarCalendarioICS,
        gerarICS: gerarICS,
        nomeArquivoICS: nomeArquivoICS
    };

    global.ICS = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
