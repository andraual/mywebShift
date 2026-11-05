/**
 * Regras puras de recorrência de plantões.
 *
 * Formato global (sem bundler) e também exportável via CommonJS para testes.
 * Não depende de DOM, Firebase ou de outros módulos da aplicação.
 */
(function (global) {
    'use strict';

    const TIPOS = Object.freeze(['semanal', 'quinzenal', 'mensal']);
    const JANELA_DIAS_PADRAO = 366;
    const MAX_OCORRENCIAS_POR_GERACAO = 200;
    const MS_POR_DIA = 24 * 60 * 60 * 1000;

    function criarErro(codigo, mensagem, extra) {
        const erro = new Error(mensagem || codigo);
        erro.code = codigo;
        if (extra) Object.assign(erro, extra);
        return erro;
    }

    function parseDataISO(valor) {
        if (typeof valor !== 'string') return null;
        const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
        if (!partes) return null;

        const ano = Number(partes[1]);
        const mes = Number(partes[2]);
        const dia = Number(partes[3]);
        const data = new Date(ano, mes - 1, dia);

        if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
            return null;
        }

        data.setHours(0, 0, 0, 0);
        return data;
    }

    function normalizarData(data) {
        if (data instanceof Date) {
            return new Date(data.getFullYear(), data.getMonth(), data.getDate());
        }
        return parseDataISO(data);
    }

    function formatarISO(data) {
        const normalizada = normalizarData(data);
        if (!normalizada) return null;
        const dia = String(normalizada.getDate()).padStart(2, '0');
        const mes = String(normalizada.getMonth() + 1).padStart(2, '0');
        const ano = normalizada.getFullYear();
        return `${ano}-${mes}-${dia}`;
    }

    function adicionarDias(data, dias) {
        const normalizada = normalizarData(data);
        if (!normalizada) return null;
        normalizada.setDate(normalizada.getDate() + Number(dias || 0));
        return normalizada;
    }

    function obterPosicaoSemanaNoMes(data) {
        const diaSemana = data.getDay();
        const diaDoMes = data.getDate();
        const ano = data.getFullYear();
        const mes = data.getMonth();
        let contador = 0;

        for (let dia = 1; dia <= diaDoMes; dia++) {
            const dataAtual = new Date(ano, mes, dia);
            if (dataAtual.getDay() === diaSemana) {
                contador++;
                if (dia === diaDoMes) return contador;
            }
        }

        return contador;
    }

    function obterDataPorPosicaoSemana(ano, mes, diaSemana, posicao) {
        let contador = 0;

        for (let dia = 1; dia <= 31; dia++) {
            const data = new Date(ano, mes, dia);

            if (data.getMonth() !== mes) {
                if (posicao >= 5 && contador > 0) {
                    for (let diaReverso = 31; diaReverso >= 1; diaReverso--) {
                        const dataReversa = new Date(ano, mes, diaReverso);
                        if (dataReversa.getMonth() === mes && dataReversa.getDay() === diaSemana) {
                            return dataReversa;
                        }
                    }
                }
                return null;
            }

            if (data.getDay() === diaSemana) {
                contador++;
                if (contador === posicao) return data;
            }
        }

        return null;
    }

    function obterContexto(dataInicial) {
        const data = normalizarData(dataInicial);
        if (!data) return null;
        return {
            diaSemana: data.getDay(),
            posicaoSemana: obterPosicaoSemanaNoMes(data)
        };
    }

    function proximaOcorrencia(dataAtual, tipo, contexto) {
        const data = normalizarData(dataAtual);
        if (!data || TIPOS.indexOf(tipo) === -1) return null;

        if (tipo === 'semanal') {
            return adicionarDias(data, 7);
        }

        if (tipo === 'quinzenal') {
            return adicionarDias(data, 14);
        }

        let mes = data.getMonth();
        let ano = data.getFullYear();

        for (let tentativa = 0; tentativa < 24; tentativa++) {
            mes++;
            if (mes > 11) {
                mes = 0;
                ano++;
            }

            const calculada = obterDataPorPosicaoSemana(
                ano,
                mes,
                contexto.diaSemana,
                contexto.posicaoSemana
            );

            if (calculada) {
                calculada.setHours(0, 0, 0, 0);
                return calculada;
            }
        }

        return null;
    }

    function normalizarExcecoes(excecoes) {
        if (!Array.isArray(excecoes)) return [];
        return Array.from(new Set(
            excecoes
                .map(function (data) { return formatarISO(data); })
                .filter(Boolean)
        )).sort();
    }

    function validarRegra(regra) {
        const erros = [];
        const dados = regra || {};
        const dataInicial = parseDataISO(dados.dataInicial);

        if (!dados.dataInicial) {
            erros.push('Data inicial é obrigatória');
        } else if (!dataInicial) {
            erros.push('Data inicial inválida');
        }

        if (TIPOS.indexOf(dados.tipo) === -1) {
            erros.push('Tipo de recorrência inválido');
        }

        if (dados.dataFim === '') {
            erros.push('Informe a data limite da recorrência ou selecione "Sem data de término"');
        } else if (dados.dataFim) {
            const dataFim = parseDataISO(dados.dataFim);
            if (!dataFim) {
                erros.push('Data limite inválida');
            } else if (dataInicial && dataFim < dataInicial) {
                erros.push('A data limite deve ser posterior ou igual à data inicial');
            }
        }

        if (dados.excecoes !== undefined && dados.excecoes !== null && !Array.isArray(dados.excecoes)) {
            erros.push('Lista de exceções inválida');
        }

        if (dados.geradoAte && !parseDataISO(dados.geradoAte)) {
            erros.push('Data de geração inválida');
        }

        return { valido: erros.length === 0, erros: erros };
    }

    function regraDaSerie(serie) {
        const dados = serie || {};
        return {
            dataInicial: dados.dataInicial,
            dataFim: dados.dataFim || null,
            tipo: dados.tipo,
            excecoes: normalizarExcecoes(dados.excecoes),
            geradoAte: dados.geradoAte || null
        };
    }

    /**
     * Gera somente as datas que ainda precisam ser materializadas.
     *
     * A série guarda `geradoAte` para que a próxima geração continue de onde parou.
     * Para séries sem data de término, o limite é uma janela móvel de antecedência
     * (por padrão, 366 dias). Assim nunca há geração ilimitada de documentos.
     */
    function gerarOcorrencias(regra, opcoes) {
        const validacao = validarRegra(regra);
        const config = opcoes || {};
        const resultado = {
            datas: [],
            geradoAte: regra && regra.geradoAte ? regra.geradoAte : null,
            limite: null,
            processadas: 0,
            atingiuLimiteMaximo: false,
            erros: validacao.erros.slice()
        };

        if (!validacao.valido) return resultado;

        const hoje = normalizarData(config.hoje || new Date());
        const janelaDias = config.janelaDias === undefined ? JANELA_DIAS_PADRAO : Number(config.janelaDias);
        const maxOcorrencias = config.maxOcorrencias === undefined
            ? MAX_OCORRENCIAS_POR_GERACAO
            : Number(config.maxOcorrencias);
        const incluirPassadas = config.incluirPassadas === true;

        const dataInicial = parseDataISO(regra.dataInicial);
        const dataFim = regra.dataFim ? parseDataISO(regra.dataFim) : null;
        const contexto = obterContexto(dataInicial);
        const excecoes = new Set(normalizarExcecoes(regra.excecoes));
        const geradoAte = regra.geradoAte ? parseDataISO(regra.geradoAte) : null;

        let limite = adicionarDias(hoje, Number.isFinite(janelaDias) ? janelaDias : JANELA_DIAS_PADRAO);
        if (dataInicial > limite) limite = dataInicial;
        if (dataFim && dataFim < limite) limite = dataFim;

        const inicioGeracao = geradoAte || (incluirPassadas ? null : adicionarDias(hoje, -1));
        const limiteMaximo = Number.isFinite(maxOcorrencias) && maxOcorrencias > 0
            ? maxOcorrencias
            : MAX_OCORRENCIAS_POR_GERACAO;

        let dataAtual = dataInicial;
        let ultimaConsiderada = null;
        let totalProcessadas = 0;

        while (dataAtual && dataAtual <= limite) {
            if (!inicioGeracao || dataAtual > inicioGeracao) {
                const dataISO = formatarISO(dataAtual);
                if (!excecoes.has(dataISO)) {
                    resultado.datas.push(dataISO);
                }
                ultimaConsiderada = dataISO;
                totalProcessadas++;

                if (totalProcessadas >= limiteMaximo) {
                    resultado.atingiuLimiteMaximo = true;
                    break;
                }
            }

            const proxima = proximaOcorrencia(dataAtual, regra.tipo, contexto);
            if (!proxima || proxima <= dataAtual) break;
            dataAtual = proxima;
        }

        resultado.processadas = totalProcessadas;
        resultado.limite = formatarISO(limite);

        if (ultimaConsiderada) {
            resultado.geradoAte = resultado.atingiuLimiteMaximo
                ? ultimaConsiderada
                : formatarISO(limite);
        } else if (geradoAte && geradoAte > limite) {
            resultado.geradoAte = regra.geradoAte;
        } else {
            resultado.geradoAte = formatarISO(limite);
        }

        return resultado;
    }

    function idOcorrencia(serieId, dataISO) {
        if (!serieId || !dataISO) return null;
        return `${serieId}_${String(dataISO).replace(/-/g, '')}`;
    }

    /**
     * Retorna a última ocorrência programada antes da data informada,
     * ignorando datas que já foram excluídas individualmente.
     */
    function ocorrenciaAnterior(regra, dataISO) {
        const validacao = validarRegra(regra);
        if (!validacao.valido) return null;

        const dataInicial = parseDataISO(regra.dataInicial);
        const alvo = parseDataISO(dataISO);
        if (!dataInicial || !alvo || alvo <= dataInicial) return null;

        const contexto = obterContexto(dataInicial);
        const excecoes = new Set(normalizarExcecoes(regra.excecoes));
        let atual = dataInicial;
        let anterior = null;

        while (atual && atual < alvo) {
            const atualISO = formatarISO(atual);
            if (!excecoes.has(atualISO)) anterior = atualISO;
            const proxima = proximaOcorrencia(atual, regra.tipo, contexto);
            if (!proxima || proxima >= alvo) break;
            atual = proxima;
        }

        return anterior;
    }

    function planejarExcecao(regra, dataOcorrencia) {
        const excecoes = normalizarExcecoes(regra && regra.excecoes);
        const dataISO = formatarISO(dataOcorrencia);
        if (dataISO && excecoes.indexOf(dataISO) === -1) excecoes.push(dataISO);
        return excecoes.sort();
    }

    function planejarExclusaoFutura(regra, dataOcorrencia) {
        const dataISO = formatarISO(dataOcorrencia);
        const anterior = ocorrenciaAnterior(regra, dataISO);
        const data = parseDataISO(dataISO);
        const dataFim = anterior || (data ? formatarISO(adicionarDias(data, -1)) : null);

        return {
            status: 'encerrada',
            dataFim: dataFim,
            excecoesAdicionar: dataISO ? [dataISO] : []
        };
    }

    function filtrarOcorrenciasFuturas(ocorrencias, serieId, dataOcorrencia) {
        const dataISO = formatarISO(dataOcorrencia);
        if (!serieId || !dataISO || !Array.isArray(ocorrencias)) return [];
        return ocorrencias.filter(function (ocorrencia) {
            if (!ocorrencia || ocorrencia.serieId !== serieId) return false;
            const data = formatarISO(ocorrencia.ocorrenciaData || ocorrencia.data);
            return Boolean(data && data >= dataISO);
        });
    }

    function ehOcorrenciaDeSerie(plantao) {
        return Boolean(plantao && plantao.serieId);
    }

    const api = {
        TIPOS: TIPOS,
        JANELA_DIAS_PADRAO: JANELA_DIAS_PADRAO,
        MAX_OCORRENCIAS_POR_GERACAO: MAX_OCORRENCIAS_POR_GERACAO,
        MS_POR_DIA: MS_POR_DIA,
        criarErro: criarErro,
        parseDataISO: parseDataISO,
        formatarISO: formatarISO,
        adicionarDias: adicionarDias,
        obterPosicaoSemanaNoMes: obterPosicaoSemanaNoMes,
        obterContexto: obterContexto,
        proximaOcorrencia: proximaOcorrencia,
        normalizarExcecoes: normalizarExcecoes,
        validarRegra: validarRegra,
        regraDaSerie: regraDaSerie,
        gerarOcorrencias: gerarOcorrencias,
        idOcorrencia: idOcorrencia,
        ocorrenciaAnterior: ocorrenciaAnterior,
        planejarExcecao: planejarExcecao,
        planejarExclusaoFutura: planejarExclusaoFutura,
        filtrarOcorrenciasFuturas: filtrarOcorrenciasFuturas,
        ehOcorrenciaDeSerie: ehOcorrenciaDeSerie
    };

    global.Recurrence = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
