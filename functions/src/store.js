'use strict';

const crypto = require('node:crypto');

class MemoryStore {
    constructor() {
        this.porIdempotencia = new Map();
        this.porIdDps = new Map();
    }

    static chave(uid, chaveIdempotencia) {
        return String(uid) + ':' + String(chaveIdempotencia);
    }

    async reservar(uid, chaveIdempotencia, registro) {
        const chave = MemoryStore.chave(uid, chaveIdempotencia);
        if (this.porIdempotencia.has(chave)) {
            return { registro: this.porIdempotencia.get(chave), reservado: false };
        }
        const criado = Object.assign({}, registro, {
            uid: String(uid),
            chaveIdempotencia: String(chaveIdempotencia)
        });
        this.porIdempotencia.set(chave, criado);
        return { registro: criado, reservado: true };
    }

    async concluir(uid, chaveIdempotencia, dados) {
        const chave = MemoryStore.chave(uid, chaveIdempotencia);
        const atual = this.porIdempotencia.get(chave);
        if (!atual) throw new Error('Reserva de idempotência inexistente.');
        const atualizado = Object.assign({}, atual, dados);
        this.porIdempotencia.set(chave, atualizado);
        if (atualizado.idDps) {
            this.porIdDps.set(String(uid) + ':' + atualizado.idDps, atualizado);
        }
        return atualizado;
    }

    async falhar(uid, chaveIdempotencia, dados) {
        return this.concluir(uid, chaveIdempotencia, Object.assign({ status: 'falhou' }, dados));
    }

    async obter(uid, chaveIdempotencia) {
        return this.porIdempotencia.get(MemoryStore.chave(uid, chaveIdempotencia)) || null;
    }

    async listarProcessando(limite) {
        const max = Number.isFinite(limite) && limite > 0 ? limite : 50;
        const resultado = [];
        for (const registro of this.porIdempotencia.values()) {
            if (registro.status === 'processando') resultado.push(registro);
            if (resultado.length >= max) break;
        }
        return resultado;
    }

    async obterPorIdDps(uid, idDps) {
        return this.porIdDps.get(String(uid) + ':' + String(idDps)) || null;
    }
}

class FirestoreStore {
    constructor(db, colecao) {
        this.db = db;
        this.colecao = colecao || 'fiscal_emissoes';
    }

    static id(uid, chaveIdempotencia) {
        return crypto.createHash('sha256')
            .update(String(uid) + '\n' + String(chaveIdempotencia))
            .digest('hex');
    }

    referencia(uid, chaveIdempotencia) {
        return this.db.collection(this.colecao).doc(FirestoreStore.id(uid, chaveIdempotencia));
    }

    async reservar(uid, chaveIdempotencia, registro) {
        const ref = this.referencia(uid, chaveIdempotencia);
        const criado = Object.assign({}, registro, {
            uid: String(uid),
            chaveIdempotencia: String(chaveIdempotencia)
        });
        try {
            await ref.create(criado);
            return { registro: criado, reservado: true };
        } catch (erro) {
            if (erro && (erro.code === 6 || erro.code === 'already-exists')) {
                const snap = await ref.get();
                return { registro: snap.exists ? snap.data() : null, reservado: false };
            }
            throw erro;
        }
    }

    async concluir(uid, chaveIdempotencia, dados) {
        const ref = this.referencia(uid, chaveIdempotencia);
        await ref.update(dados);
        const snap = await ref.get();
        return snap.data();
    }

    async falhar(uid, chaveIdempotencia, dados) {
        const ref = this.referencia(uid, chaveIdempotencia);
        await ref.update(Object.assign({ status: 'falhou' }, dados));
        const snap = await ref.get();
        return snap.data();
    }

    async listarProcessando(limite) {
        const snap = await this.db.collection(this.colecao)
            .where('status', '==', 'processando')
            .limit(Number.isFinite(limite) && limite > 0 ? limite : 50)
            .get();
        const resultado = [];
        snap.forEach(function (doc) {
            resultado.push(Object.assign({ _id: doc.id }, doc.data()));
        });
        return resultado;
    }

    async obter(uid, chaveIdempotencia) {
        const snap = await this.referencia(uid, chaveIdempotencia).get();
        return snap.exists ? snap.data() : null;
    }

    async obterPorIdDps(uid, idDps) {
        const snap = await this.db.collection(this.colecao)
            .where('uid', '==', String(uid))
            .where('idDps', '==', String(idDps))
            .limit(1)
            .get();
        if (snap.empty) return null;
        return snap.docs[0].data();
    }
}

module.exports = {
    MemoryStore,
    FirestoreStore
};
