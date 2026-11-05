/**
 * Configuração fiscal do prestador.
 * Persistência local por usuário; não guarda certificados, chaves ou senhas.
 */
(function (global) {
    'use strict';

    const PREFIXO_CHAVE = 'mywebshift:fiscal:config:';

    function configuracaoPadrao() {
        return {
            versao: 1,
            ambiente: 'homologacao',
            producaoConfirmada: false,
            serie: '1',
            proximoNumeroDps: 1,
            prestador: {
                tipoInscricao: 'CNPJ',
                cnpj: '',
                im: '',
                razaoSocial: '',
                nomeFantasia: '',
                email: '',
                telefone: '',
                endereco: {
                    logradouro: '',
                    numero: '',
                    complemento: '',
                    bairro: '',
                    codigoMunicipio: '',
                    uf: '',
                    cep: ''
                },
                regTrib: {
                    opSimpNac: '1',
                    regApTribSN: '',
                    regEspTrib: '0'
                }
            },
            servico: {
                cTribNac: '040101',
                cTribMun: '097',
                cNBS: '123012200',
                descricao: 'Serviços médicos especializados',
                aliquota: '',
                tribISSQN: '1',
                tpRetISSQN: '1',
                localPrestacao: ''
            }
        };
    }

    function ehObjeto(valor) {
        return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
    }

    function mesclar(base, extra) {
        const saida = Array.isArray(base) ? base.slice() : Object.assign({}, base);
        if (!ehObjeto(extra)) return saida;
        Object.keys(extra).forEach(function (chave) {
            const valor = extra[chave];
            if (ehObjeto(valor) && ehObjeto(saida[chave])) {
                saida[chave] = mesclar(saida[chave], valor);
            } else if (valor !== undefined) {
                saida[chave] = valor;
            }
        });
        return saida;
    }

    function chave(uid) {
        return PREFIXO_CHAVE + (uid || 'local');
    }

    function carregar(uid) {
        const padrao = configuracaoPadrao();
        try {
            const bruto = global.localStorage.getItem(chave(uid));
            if (!bruto) return padrao;
            const salvo = JSON.parse(bruto);
            return mesclar(padrao, salvo);
        } catch (erro) {
            console.warn('Não foi possível carregar a configuração fiscal:', erro);
            return padrao;
        }
    }

    function salvar(uid, config) {
        const normalizada = mesclar(configuracaoPadrao(), config);
        global.localStorage.setItem(chave(uid), JSON.stringify(normalizada));
        return normalizada;
    }

    function limpar(uid) {
        global.localStorage.removeItem(chave(uid));
    }

    global.FiscalConfig = {
        PREFIXO_CHAVE,
        configuracaoPadrao,
        mesclar,
        carregar,
        salvar,
        limpar
    };
})(typeof window !== 'undefined' ? window : globalThis);
