'use strict';

const { FiscalError, CODIGOS, erroValidacao } = require('./errors');
const { validarDados, validarChaveIdempotencia, somenteDigitos } = require('./validation');
const { gerarXmlDps } = require('./dps');
const { MemorySequenceStore } = require('./sequence');
const crypto = require('node:crypto');

function normalizar(dados) {
    const d = dados || {};
    const prestador = d.prestador || {};
    const endereco = prestador.endereco || {};
    const regTrib = prestador.regTrib || {};
    const servico = d.servico || {};

    return {
        ambiente: d.ambiente,
        producaoConfirmada: d.producaoConfirmada === true,
        serie: somenteDigitos(d.serie || '1'),
        numeroDps: somenteDigitos(d.numeroDps),
        dataCompetencia: String(d.dataCompetencia || '').trim(),
        valorServico: d.valorServico,
        valorRecebido: d.valorRecebido,
        descricaoServico: d.descricaoServico,
        localPrestacao: d.localPrestacao,
        tomador: d.tomador ? {
            documento: somenteDigitos(d.tomador.documento),
            nome: String(d.tomador.nome || '').trim(),
            email: String(d.tomador.email || '').trim()
        } : null,
        prestador: {
            cnpj: somenteDigitos(prestador.cnpj),
            im: String(prestador.im || '').trim(),
            razaoSocial: String(prestador.razaoSocial || '').trim(),
            nomeFantasia: String(prestador.nomeFantasia || '').trim(),
            email: String(prestador.email || '').trim(),
            telefone: somenteDigitos(prestador.telefone),
            endereco: {
                codigoMunicipio: somenteDigitos(endereco.codigoMunicipio),
                cep: somenteDigitos(endereco.cep),
                logradouro: String(endereco.logradouro || '').trim(),
                numero: String(endereco.numero || '').trim(),
                complemento: String(endereco.complemento || '').trim(),
                bairro: String(endereco.bairro || '').trim()
            },
            regTrib: {
                opSimpNac: regTrib.opSimpNac ? String(regTrib.opSimpNac) : '',
                regApTribSN: regTrib.regApTribSN ? String(regTrib.regApTribSN) : undefined,
                regEspTrib: regTrib.regEspTrib ? String(regTrib.regEspTrib) : ''
            }
        },
        servico: {
            cTribNac: somenteDigitos(servico.cTribNac),
            cTribMun: servico.cTribMun ? somenteDigitos(servico.cTribMun) : '',
            cNBS: servico.cNBS ? somenteDigitos(servico.cNBS) : '',
            descricao: String(servico.descricao || d.descricaoServico || '').trim(),
            aliquota: servico.aliquota,
            tribISSQN: servico.tribISSQN ? String(servico.tribISSQN) : '',
            tpRetISSQN: servico.tpRetISSQN ? String(servico.tpRetISSQN) : '',
            localPrestacao: servico.localPrestacao ? somenteDigitos(servico.localPrestacao) : ''
        }
    };
}

function validarContexto(dados, config) {
    if (!dados.ambiente || !['homologacao', 'producao'].includes(dados.ambiente)) {
        throw new FiscalError(CODIGOS.AMBIENTE_INVALIDO, 'Ambiente deve ser homologacao ou producao.', 400);
    }
    if (dados.ambiente === 'producao' && dados.producaoConfirmada !== true) {
        throw new FiscalError(CODIGOS.PRODUCAO_NAO_CONFIRMADA, 'Produção exige confirmação explícita.', 409);
    }
    if (config && config.transmissaoReal === false && config.modoRealSolicitado === true) {
        throw new FiscalError(CODIGOS.TRANSMISSAO_REAL_DESABILITADA, 'Transmissão real desabilitada.', 503);
    }
}

function exigirChaveIdempotencia(valor) {
    if (!valor) {
        throw new FiscalError(CODIGOS.IDEMPOTENCIA_OBRIGATORIA, 'Chave de idempotência obrigatória.', 400);
    }
    const chave = validarChaveIdempotencia(valor);
    if (!chave) {
        throw new FiscalError(
            CODIGOS.IDEMPOTENCIA_INVALIDA,
            'Chave de idempotência inválida (use até 128 caracteres: letras, números, ponto, hífen, dois-pontos ou sublinhado).',
            400
        );
    }
    return chave;
}

function validarRespostaTransporte(resposta, modo) {
    if (!resposta || typeof resposta !== 'object') {
        throw new FiscalError(CODIGOS.ERRO_SEFIN, 'Resposta inválida do transporte fiscal.', 502);
    }
    if (modo === 'real' && !/^\d{50}$/.test(String(resposta.chaveAcesso || ''))) {
        throw new FiscalError(CODIGOS.ERRO_SEFIN, 'Resposta da Sefin sem chave de acesso válida.', 502);
    }
}

function idadeEmMs(iso, agora) {
    const t = Date.parse(String(iso || ''));
    if (!Number.isFinite(t)) return Infinity;
    return Math.max(0, agora.getTime() - t);
}

async function autorizarPrestadorDeServico(deps, uid, dados) {
    if (deps.transporte.modo !== 'real') return;
    if (typeof deps.autorizarPrestador !== 'function') {
        throw new FiscalError(
            CODIGOS.PRESTADOR_NAO_AUTORIZADO,
            'Vínculo entre usuário e prestador não configurado no backend.',
            503
        );
    }
    const autorizado = await deps.autorizarPrestador({
        uid: String(uid),
        cnpj: dados.prestador.cnpj,
        ambiente: dados.ambiente
    });
    if (autorizado !== true) {
        throw new FiscalError(
            CODIGOS.PRESTADOR_NAO_AUTORIZADO,
            'O prestador informado não está vinculado a este usuário.',
            403
        );
    }
}

function criarServico(dependencias) {
    const deps = dependencias || {};
    if (!deps.store) throw new Error('store obrigatório.');
    if (!deps.transporte) throw new Error('transporte obrigatório.');
    if (!deps.assinador) throw new Error('assinador obrigatório.');
    const sequenceStore = deps.sequenceStore || new MemorySequenceStore();

    async function emitir(entrada) {
        const e = entrada || {};
        if (!e.uid) throw new FiscalError(CODIGOS.NAO_AUTENTICADO, 'Autenticação obrigatória.', 401);
        const chaveIdempotencia = exigirChaveIdempotencia(e.chaveIdempotencia);

        const dados = normalizar(e.dados);
        validarContexto(dados, deps.config);
        const erros = validarDados(dados);
        if (erros.length) throw erroValidacao(erros);

        if (deps.transporte.modo === 'real' && !(deps.config && deps.config.transmissaoReal === true)) {
            throw new FiscalError(CODIGOS.TRANSMISSAO_REAL_DESABILITADA, 'Transmissão real desabilitada.', 503);
        }
        if (deps.transporte.modo === 'real' && deps.transporte.ambiente && deps.transporte.ambiente !== dados.ambiente) {
            throw new FiscalError(
                CODIGOS.AMBIENTE_INVALIDO,
                'O ambiente solicitado não corresponde ao ambiente do transporte fiscal.',
                409
            );
        }
        await autorizarPrestadorDeServico(deps, e.uid, dados);

        const dadosHashBase = crypto.createHash('sha256')
            .update(JSON.stringify({
                prestadorCnpj: dados.prestador.cnpj,
                prestadorIm: dados.prestador.im || null,
                servico: {
                    cTribNac: dados.servico.cTribNac,
                    cTribMun: dados.servico.cTribMun || null,
                    cNBS: dados.servico.cNBS || null,
                    descricao: dados.servico.descricao,
                    aliquota: dados.servico.aliquota,
                    tribISSQN: dados.servico.tribISSQN,
                    tpRetISSQN: dados.servico.tpRetISSQN,
                    localPrestacao: dados.servico.localPrestacao || null
                },
                tomadorDocumento: (dados.tomador && dados.tomador.documento) ? somenteDigitos(dados.tomador.documento) : null,
                valorServico: dados.valorServico,
                valorRecebido: dados.valorRecebido || null,
                ambiente: dados.ambiente,
                serieSolicitada: dados.serie,
                numeroDpsSolicitado: dados.numeroDps
            }))
            .digest('hex');

        let sequencia = null;
        try {
            const numeroCliente = deps.config && deps.config.permitirNumeroCliente === true ? dados.numeroDps : '';
            sequencia = await sequenceStore.reservar(dados.prestador.cnpj, dados.serie, numeroCliente);
            dados.serie = sequencia.serie;
            dados.numeroDps = String(sequencia.numero);
        } catch (erro) {
            if (erro instanceof FiscalError) throw erro;
            throw new FiscalError(CODIGOS.SEQUENCIA_INDISPONIVEL, 'Não foi possível reservar o número da DPS.', 503);
        }

        const dadosHash = crypto.createHash('sha256')
            .update(JSON.stringify({
                prestadorCnpj: dados.prestador.cnpj,
                prestadorIm: dados.prestador.im || null,
                servico: {
                    cTribNac: dados.servico.cTribNac,
                    cTribMun: dados.servico.cTribMun || null,
                    cNBS: dados.servico.cNBS || null,
                    descricao: dados.servico.descricao,
                    aliquota: dados.servico.aliquota,
                    tribISSQN: dados.servico.tribISSQN,
                    tpRetISSQN: dados.servico.tpRetISSQN,
                    localPrestacao: dados.servico.localPrestacao || null
                },
                tomadorDocumento: (dados.tomador && dados.tomador.documento) ? somenteDigitos(dados.tomador.documento) : null,
                valorServico: dados.valorServico,
                valorRecebido: dados.valorRecebido || null,
                ambiente: dados.ambiente,
                serie: dados.serie,
                numeroDps: dados.numeroDps
            }))
            .digest('hex');

        const agora = new Date().toISOString();
        const reserva = await deps.store.reservar(e.uid, chaveIdempotencia, {
            uid: String(e.uid),
            chaveIdempotencia: chaveIdempotencia,
            status: 'processando',
            ambiente: dados.ambiente,
            modo: deps.transporte.modo,
            simulado: deps.transporte.modo === 'simulacao',
            prestadorCnpj: dados.prestador.cnpj,
            serie: dados.serie,
            numeroDps: dados.numeroDps,
            dadosHash: dadosHash,
            dadosHashBase: dadosHashBase,
            criadoEm: agora,
            atualizadoEm: agora
        });

        if (!reserva.reservado) {
            const registro = reserva.registro || {};
            if ((registro.dadosHash && dadosHash && registro.dadosHash !== dadosHash) || (registro.dadosHashBase && dadosHashBase && registro.dadosHashBase !== dadosHashBase && registro.status !== 'processada')) {
                throw new FiscalError(
                    CODIGOS.IDEMPOTENCIA_INVALIDA,
                    'Chave de idempotência já utilizada com payload diferente.',
                    409
                );
            }
            if (registro.status === 'processada') {
                return Object.assign({}, registro, { idempotente: true });
            }
            if (registro.status === 'falhou') {
                throw new FiscalError(
                    CODIGOS.EMISSAO_FALHOU,
                    'Esta chave de idempotência já foi usada em uma tentativa que falhou. Use uma nova chave após conferir o motivo.',
                    409,
                    { codigoAnterior: registro.erroCodigo || null }
                );
            }
            throw new FiscalError(
                CODIGOS.EMISSAO_EM_PROCESSAMENTO,
                'Já existe uma emissão em processamento para esta chave de idempotência.',
                409
            );
        }

        sequencia = null;
        try {
            const numeroCliente = deps.config && deps.config.permitirNumeroCliente === true ? dados.numeroDps : '';
            sequencia = await sequenceStore.reservar(dados.prestador.cnpj, dados.serie, numeroCliente);
            dados.serie = sequencia.serie;
            dados.numeroDps = String(sequencia.numero);
        } catch (erro) {
            if (erro instanceof FiscalError) throw erro;
            throw new FiscalError(CODIGOS.SEQUENCIA_INDISPONIVEL, 'Não foi possível reservar o número da DPS.', 503);
        }

        let transmitido = false;
        try {
            const dps = gerarXmlDps(dados);
            const assinatura = await deps.assinador.assinar(dps.xml, { idDps: dps.id, ambiente: dados.ambiente });
            const resposta = await deps.transporte.emitirDps(assinatura.xml, { idDps: dps.id, ambiente: dados.ambiente });
            validarRespostaTransporte(resposta, deps.transporte.modo);
            transmitido = true;

            const registro = {
                idDps: dps.id,
                chaveAcesso: resposta.chaveAcesso || null,
                protocolo: resposta.protocolo || null,
                status: 'processada',
                mensagem: resposta.mensagem || null,
                atualizadoEm: new Date().toISOString(),
                xmlDps: deps.transporte.modo === 'simulacao' ? assinatura.xml : null
            };

            const salvo = await deps.store.concluir(e.uid, chaveIdempotencia, registro);
            return Object.assign({}, salvo, { idempotente: false });
        } catch (erro) {
            if (!transmitido) {
                try {
                    await deps.store.falhar(e.uid, chaveIdempotencia, {
                        erroCodigo: erro.codigo || 'ERRO_INTERNO',
                        atualizadoEm: new Date().toISOString()
                    });
                } catch (erroPersistencia) {
                    console.error('Falha ao registrar erro de emissão:', erroPersistencia && erroPersistencia.code);
                }
            }
            throw erro;
        }
    }

    async function consultar(entrada) {
        const e = entrada || {};
        if (!e.uid) throw new FiscalError(CODIGOS.NAO_AUTENTICADO, 'Autenticação obrigatória.', 401);
        if (!/^DPS\d{42}$/.test(String(e.idDps || ''))) {
            throw new FiscalError(CODIGOS.VALIDACAO, 'idDps inválido.', 400);
        }
        const registro = await deps.store.obterPorIdDps(e.uid, e.idDps);
        if (!registro) throw new FiscalError(CODIGOS.DPS_NAO_ENCONTRADA, 'DPS não encontrada para este usuário.', 404);
        return registro;
    }

    async function reconciliar(opcoes) {
        const o = opcoes || {};
        const agora = o.agora || new Date();
        const idadeMinimaMs = Number.isFinite(o.idadeMinimaMs) ? o.idadeMinimaMs : 5 * 60 * 1000;
        const limite = Number.isFinite(o.limite) && o.limite > 0 ? o.limite : 50;
        if (!deps.store.listarProcessando) {
            throw new FiscalError(CODIGOS.RECONCILIACAO_INDISPONIVEL, 'Store sem suporte à reconciliação.', 503);
        }
        if (!deps.transporte.consultarDps) {
            throw new FiscalError(CODIGOS.RECONCILIACAO_INDISPONIVEL, 'Transporte sem suporte à consulta de reconciliação.', 503);
        }

        const registros = await deps.store.listarProcessando(limite);
        const resumo = { analisados: 0, confirmados: 0, falhados: 0, mantidos: 0, erros: 0 };

        for (const registro of registros) {
            if (!registro || !registro.idDps || !registro.uid || !registro.chaveIdempotencia) {
                resumo.mantidos += 1;
                continue;
            }
            if (idadeEmMs(registro.criadoEm, agora) < idadeMinimaMs) {
                resumo.mantidos += 1;
                continue;
            }
            resumo.analisados += 1;
            try {
                const resposta = await deps.transporte.consultarDps(registro.idDps, { ambiente: registro.ambiente });
                if (resposta && resposta.encontrada === true) {
                    validarRespostaTransporte(resposta, deps.transporte.modo);
                    await deps.store.concluir(registro.uid, registro.chaveIdempotencia, {
                        idDps: registro.idDps,
                        chaveAcesso: resposta.chaveAcesso || null,
                        protocolo: resposta.protocolo || null,
                        status: 'processada',
                        mensagem: resposta.mensagem || 'Emissão confirmada por reconciliação.',
                        atualizadoEm: agora.toISOString()
                    });
                    resumo.confirmados += 1;
                } else {
                    await deps.store.falhar(registro.uid, registro.chaveIdempotencia, {
                        erroCodigo: 'RECONCILIACAO_NAO_CONFIRMADA',
                        mensagem: 'Emissão não confirmada na consulta de reconciliação.',
                        atualizadoEm: agora.toISOString()
                    });
                    resumo.falhados += 1;
                }
            } catch (erro) {
                console.error('Falha na reconciliação fiscal:', erro && erro.code);
                resumo.erros += 1;
            }
        }

        resumo.atualizadoEm = agora.toISOString();
        return resumo;
    }

    return {
        emitir,
        consultar,
        reconciliar,
        modo: deps.transporte.modo
    };
}

module.exports = {
    normalizar,
    validarContexto,
    validarRespostaTransporte,
    criarServico
};
