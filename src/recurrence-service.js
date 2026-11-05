/**
 * Serviço Firestore das séries recorrentes.
 *
 * Mantém a regra de recorrência em `recorrencias/{serieId}` e materializa as
 * ocorrências em `plantoes` usando IDs determinísticos. Funciona com a API
 * compat do Firebase no navegador e com o Admin SDK nos testes.
 */
(function (global) {
    'use strict';

    const Recurrence = global.Recurrence || (typeof require === 'function' ? require('./recurrence.js') : null);

    function criarErro(codigo, mensagem, extra) {
        return Recurrence.criarErro(codigo, mensagem, extra);
    }

    function aplicarTimestamp(destino, serverTimestamp, campo) {
        if (typeof serverTimestamp === 'function') {
            destino[campo] = serverTimestamp();
        }
    }

    function limparUndefined(objeto) {
        Object.keys(objeto).forEach(function (chave) {
            if (objeto[chave] === undefined) delete objeto[chave];
        });
        return objeto;
    }

    function montarSerie(dadosSerie, regra, userId, geradoAte, serverTimestamp) {
        const serie = Object.assign({}, dadosSerie || {}, {
            userId: userId,
            tipo: regra.tipo,
            dataInicial: regra.dataInicial,
            dataFim: regra.dataFim || null,
            excecoes: [],
            geradoAte: geradoAte || null,
            status: 'ativa'
        });

        delete serie.id;
        aplicarTimestamp(serie, serverTimestamp, 'criadoEm');
        aplicarTimestamp(serie, serverTimestamp, 'atualizadoEm');
        return limparUndefined(serie);
    }

    function montarOcorrencia(montar, serieId, serie, data, userId) {
        const ocorrencia = montar(serie, data, userId, serieId) || {};
        ocorrencia.userId = ocorrencia.userId || userId;
        ocorrencia.serieId = serieId;
        ocorrencia.ocorrenciaData = data;
        return limparUndefined(ocorrencia);
    }

    async function criarSerieRecorrente(db, opcoes) {
        const config = opcoes || {};
        const validacao = Recurrence.validarRegra(config.regra);
        if (!validacao.valido) {
            throw criarErro('REGRA_INVALIDA', validacao.erros.join('\n'), { erros: validacao.erros });
        }
        if (typeof config.montarOcorrencia !== 'function') {
            throw criarErro('MONTAR_OCORRENCIA_AUSENTE', 'Função de montagem da ocorrência não informada');
        }

        const resultado = Recurrence.gerarOcorrencias(config.regra, {
            hoje: config.hoje,
            janelaDias: config.janelaDias,
            maxOcorrencias: config.maxOcorrencias,
            incluirPassadas: false
        });

        if (!resultado.datas.length) {
            throw criarErro(
                'SEM_OCORRENCIAS',
                'Nenhuma ocorrência pôde ser criada para o período informado. Verifique a data inicial e a data limite.'
            );
        }

        const serieRef = config.dadosSerie && config.dadosSerie.id
            ? db.collection('recorrencias').doc(String(config.dadosSerie.id))
            : db.collection('recorrencias').doc();
        const serieId = serieRef.id;
        const serie = montarSerie(
            config.dadosSerie,
            config.regra,
            config.userId,
            resultado.geradoAte,
            config.serverTimestamp
        );

        const batch = db.batch();
        batch.set(serieRef, serie);

        resultado.datas.forEach(function (data) {
            const ocorrenciaRef = db.collection('plantoes').doc(Recurrence.idOcorrencia(serieId, data));
            batch.set(ocorrenciaRef, montarOcorrencia(
                config.montarOcorrencia,
                serieId,
                serie,
                data,
                config.userId
            ));
        });

        await batch.commit();

        return {
            serieId: serieId,
            serie: serie,
            datas: resultado.datas.slice(),
            geradoAte: resultado.geradoAte
        };
    }

    async function garantirOcorrenciasDaSerie(db, opcoes) {
        const config = opcoes || {};
        if (!config.serie || config.serie.status !== 'ativa') return { criadas: 0 };
        if (typeof config.montarOcorrencia !== 'function') {
            throw criarErro('MONTAR_OCORRENCIA_AUSENTE', 'Função de montagem da ocorrência não informada');
        }

        const serieId = config.serieId;
        const regra = Recurrence.regraDaSerie(config.serie);
        const resultado = Recurrence.gerarOcorrencias(regra, {
            hoje: config.hoje,
            janelaDias: config.janelaDias,
            maxOcorrencias: config.maxOcorrencias,
            incluirPassadas: false
        });

        if (resultado.erros.length) {
            throw criarErro('REGRA_INVALIDA', resultado.erros.join('\n'), { erros: resultado.erros });
        }

        const ponteiroAtual = config.serie.geradoAte || null;
        const precisaAtualizarPonteiro = resultado.geradoAte &&
            resultado.geradoAte > (ponteiroAtual || '');
        if (!resultado.datas.length && !precisaAtualizarPonteiro) return { criadas: 0 };

        const existentes = config.existentesIds instanceof Set
            ? config.existentesIds
            : new Set(config.existentesIds || []);
        const datasNovas = resultado.datas.filter(function (data) {
            return !existentes.has(Recurrence.idOcorrencia(serieId, data));
        });

        const serieRef = db.collection('recorrencias').doc(serieId);
        let criadas = 0;

        await db.runTransaction(async function (tx) {
            const serieSnap = await tx.get(serieRef);
            if (!serieSnap.exists) return;

            const atual = serieSnap.data();
            if (atual.status !== 'ativa' || atual.userId !== config.userId) return;

            const excecoes = new Set(Recurrence.normalizarExcecoes(atual.excecoes));
            const refs = datasNovas.map(function (data) {
                return db.collection('plantoes').doc(Recurrence.idOcorrencia(serieId, data));
            });
            const snaps = [];
            for (let i = 0; i < refs.length; i++) {
                snaps.push(await tx.get(refs[i]));
            }

            let total = 0;
            refs.forEach(function (ref, indice) {
                const data = datasNovas[indice];
                if (snaps[indice].exists || excecoes.has(data)) return;
                tx.set(ref, montarOcorrencia(
                    config.montarOcorrencia,
                    serieId,
                    atual,
                    data,
                    config.userId
                ));
                total++;
            });
            criadas = total;

            const geradoAtual = atual.geradoAte || '';
            const novoPonteiro = resultado.geradoAte && resultado.geradoAte > geradoAtual
                ? resultado.geradoAte
                : (atual.geradoAte || null);
            const atualizacao = { geradoAte: novoPonteiro };
            aplicarTimestamp(atualizacao, config.serverTimestamp, 'atualizadoEm');
            tx.update(serieRef, atualizacao);
        });

        return { criadas: criadas };
    }

    async function garantirOcorrenciasAtivas(db, opcoes) {
        const config = opcoes || {};
        const seriesSnap = await db.collection('recorrencias')
            .where('userId', '==', config.userId)
            .get();

        const ativas = seriesSnap.docs.filter(function (doc) {
            const serie = doc.data();
            return !serie.status || serie.status === 'ativa';
        });
        if (!ativas.length) return { seriesProcessadas: 0, ocorrenciasCriadas: 0 };

        const plantoesSnap = await db.collection('plantoes')
            .where('userId', '==', config.userId)
            .get();
        const existentes = new Set(plantoesSnap.docs.map(function (doc) { return doc.id; }));

        let total = 0;
        for (let i = 0; i < ativas.length; i++) {
            const serieDoc = ativas[i];
            const resultado = await garantirOcorrenciasDaSerie(db, Object.assign({}, config, {
                serieId: serieDoc.id,
                serie: serieDoc.data(),
                existentesIds: existentes
            }));
            total += resultado.criadas;
        }

        return { seriesProcessadas: ativas.length, ocorrenciasCriadas: total };
    }

    async function excluirSomenteOcorrencia(db, opcoes) {
        const config = opcoes || {};
        const plantaoRef = db.collection('plantoes').doc(config.plantaoId);
        let resposta = null;

        await db.runTransaction(async function (tx) {
            const plantaoSnap = await tx.get(plantaoRef);
            if (!plantaoSnap.exists) {
                throw criarErro('NAO_ENCONTRADO', 'Plantão não encontrado');
            }

            const plantao = plantaoSnap.data();
            if (plantao.userId !== config.userId) {
                throw criarErro('SEM_PERMISSAO', 'Você não pode excluir este plantão');
            }

            let serieId = null;
            let excecoes = null;

            if (plantao.serieId) {
                const serieRef = db.collection('recorrencias').doc(plantao.serieId);
                const serieSnap = await tx.get(serieRef);
                if (serieSnap.exists) {
                    const serie = serieSnap.data();
                    if (serie.userId !== config.userId) {
                        throw criarErro('SEM_PERMISSAO', 'Você não pode alterar esta recorrência');
                    }
                    const regra = Recurrence.regraDaSerie(serie);
                    excecoes = Recurrence.planejarExcecao(
                        regra,
                        plantao.ocorrenciaData || plantao.data
                    );
                    const atualizacao = { excecoes: excecoes };
                    aplicarTimestamp(atualizacao, config.serverTimestamp, 'atualizadoEm');
                    tx.update(serieRef, atualizacao);
                    serieId = plantao.serieId;
                }
            }

            tx.delete(plantaoRef);
            resposta = { excluido: true, serieId: serieId, excecoes: excecoes };
        });

        return resposta;
    }

    async function excluirEmLotes(db, refs, tamanhoLote) {
        const tamanho = tamanhoLote || 450;
        let total = 0;

        for (let inicio = 0; inicio < refs.length; inicio += tamanho) {
            const batch = db.batch();
            const parte = refs.slice(inicio, inicio + tamanho);
            parte.forEach(function (ref) { batch.delete(ref); });
            await batch.commit();
            total += parte.length;
        }

        return total;
    }

    async function excluirOcorrenciaEFuturas(db, opcoes) {
        const config = opcoes || {};
        const maximoTransacao = config.maximoTransacao || 400;
        const plantaoRef = db.collection('plantoes').doc(config.plantaoId);
        const plantaoSnap = await plantaoRef.get();

        if (!plantaoSnap.exists) {
            throw criarErro('NAO_ENCONTRADO', 'Plantão não encontrado');
        }

        const plantao = plantaoSnap.data();
        if (plantao.userId !== config.userId) {
            throw criarErro('SEM_PERMISSAO', 'Você não pode excluir este plantão');
        }
        if (!plantao.serieId) {
            throw criarErro('NAO_RECORRENTE', 'Este plantão não pertence a uma série recorrente');
        }

        const serieId = plantao.serieId;
        const dataOcorrencia = plantao.ocorrenciaData || plantao.data;
        const serieRef = db.collection('recorrencias').doc(serieId);
        const serieSnap = await serieRef.get();

        if (!serieSnap.exists) {
            throw criarErro('SERIE_NAO_ENCONTRADA', 'Recorrência não encontrada');
        }
        if (serieSnap.data().userId !== config.userId) {
            throw criarErro('SEM_PERMISSAO', 'Você não pode alterar esta recorrência');
        }

        const plantoesSnap = await db.collection('plantoes')
            .where('userId', '==', config.userId)
            .get();
        const todas = plantoesSnap.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
        });
        const alvos = Recurrence.filtrarOcorrenciasFuturas(todas, serieId, dataOcorrencia);

        let plano = null;
        const alvosNaTransacao = alvos.length <= maximoTransacao
            ? alvos
            : alvos.filter(function (item) { return item.id === config.plantaoId; });

        await db.runTransaction(async function (tx) {
            const serieAtualSnap = await tx.get(serieRef);
            if (!serieAtualSnap.exists) {
                throw criarErro('SERIE_NAO_ENCONTRADA', 'Recorrência não encontrada');
            }

            const serieAtual = serieAtualSnap.data();
            if (serieAtual.userId !== config.userId) {
                throw criarErro('SEM_PERMISSAO', 'Você não pode alterar esta recorrência');
            }

            plano = Recurrence.planejarExclusaoFutura(
                Recurrence.regraDaSerie(serieAtual),
                dataOcorrencia
            );
            const excecoes = Recurrence.normalizarExcecoes(
                (serieAtual.excecoes || []).concat(plano.excecoesAdicionar)
            );
            const atualizacao = {
                status: 'encerrada',
                dataFim: plano.dataFim,
                excecoes: excecoes
            };
            aplicarTimestamp(atualizacao, config.serverTimestamp, 'encerradaEm');
            aplicarTimestamp(atualizacao, config.serverTimestamp, 'atualizadoEm');
            tx.update(serieRef, atualizacao);

            alvosNaTransacao.forEach(function (item) {
                tx.delete(db.collection('plantoes').doc(item.id));
            });
        });

        let excluidas = alvosNaTransacao.length;
        const idsNaTransacao = new Set(alvosNaTransacao.map(function (item) { return item.id; }));
        const restantes = alvos.filter(function (item) { return !idsNaTransacao.has(item.id); });

        if (restantes.length) {
            const refs = restantes.map(function (item) {
                return db.collection('plantoes').doc(item.id);
            });
            excluidas += await excluirEmLotes(db, refs, maximoTransacao);
        }

        return {
            serieId: serieId,
            dataOcorrencia: dataOcorrencia,
            dataFim: plano ? plano.dataFim : null,
            excluidas: excluidas
        };
    }

    const api = {
        criarSerieRecorrente: criarSerieRecorrente,
        garantirOcorrenciasDaSerie: garantirOcorrenciasDaSerie,
        garantirOcorrenciasAtivas: garantirOcorrenciasAtivas,
        excluirSomenteOcorrencia: excluirSomenteOcorrencia,
        excluirOcorrenciaEFuturas: excluirOcorrenciaEFuturas,
        excluirEmLotes: excluirEmLotes
    };

    global.RecurrenceService = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
