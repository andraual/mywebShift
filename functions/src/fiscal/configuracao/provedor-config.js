'use strict';

const CHAVE_COLECAO = 'fiscal_provedor_config';
const NOME_PADRAO = 'nacional';

function normalizarProvedor(nome) {
    const valor = String(nome || '').trim().toLowerCase();
    if (valor === 'notaas') return 'notaas';
    if (valor === 'nacional') return 'nacional';
    return null;
}

class ProvedorConfigStore {
    constructor(db) {
        this.db = db;
        this.colecao = CHAVE_COLECAO;
    }

    chave(empresaId) {
        return String(empresaId || 'default');
    }

    async obter(empresaId) {
        if (!this.db) {
            return { provedor: NOME_PADRAO, habilitadoNotaas: false, empresaId: this.chave(empresaId) };
        }
        try {
            const ref = this.db.collection(this.colecao).doc(this.chave(empresaId));
            const snap = await ref.get();
            if (!snap.exists) {
                return { provedor: NOME_PADRAO, habilitadoNotaas: false, empresaId: this.chave(empresaId) };
            }
            const dados = snap.data() || {};
            const provedor = normalizarProvedor(dados.provedor) || NOME_PADRAO;
            return {
                provedor: provedor,
                habilitadoNotaas: provedor === 'notaas' && dados.habilitadoNotaas === true,
                empresaId: this.chave(empresaId),
                atualizadoEm: dados.atualizadoEm || null,
                configuradoPor: dados.configuradoPor || null
            };
        } catch (erro) {
            return { provedor: NOME_PADRAO, habilitadoNotaas: false, empresaId: this.chave(empresaId) };
        }
    }

    async salvar(empresaId, config, usuarioUid) {
        if (!this.db) {
            throw new Error('Banco de dados não configurado para salvar configuração de provedor.');
        }
        const provedor = normalizarProvedor(config && config.provedor);
        if (!provedor) {
            throw new Error('Provedor inválido. Use "nacional" ou "notaas".');
        }
        if (provedor === 'notaas' && (config && config.habilitadoNotaas) !== true) {
            // Mantém desabilitado até configuração validada conforme solicitado
            provedor === 'nacional';
        }
        const dados = {
            provedor: provedor,
            habilitadoNotaas: provedor === 'notaas' ? Boolean(config && config.habilitadoNotaas) : false,
            atualizadoEm: new Date().toISOString(),
            configuradoPor: usuarioUid || null
        };
        await this.db.collection(this.colecao).doc(this.chave(empresaId)).set(dados, { merge: true });
        return this.obter(empresaId);
    }
}

function criarProvedorConfigStore(db) {
    return new ProvedorConfigStore(db);
}

module.exports = {
    ProvedorConfigStore,
    criarProvedorConfigStore,
    normalizarProvedor,
    NOME_PADRAO
};
