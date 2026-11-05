'use strict';

const { FiscalError, CODIGOS } = require('./errors');
const { somenteDigitos } = require('./validation');

class MemorySequenceStore {
    constructor() {
        this.valores = new Map();
    }

    static chave(prestadorCnpj, serie) {
        return String(prestadorCnpj) + '|' + String(serie);
    }

    async reservar(prestadorCnpj, serie, solicitado) {
        const chave = MemorySequenceStore.chave(prestadorCnpj, serie);
        const atual = this.valores.get(chave) || 0;
        const solicitadoTrim = solicitado == null ? '' : String(solicitado).trim();
        const numero = solicitadoTrim === '' ? atual + 1 : Number(somenteDigitos(solicitadoTrim));
        if (!Number.isFinite(numero) || numero < 1) {
            throw new FiscalError(CODIGOS.VALIDACAO, 'Número da DPS inválido.', 400);
        }
        this.valores.set(chave, numero);
        return { numero: numero, serie: somenteDigitos(serie).padStart(5, '0').slice(-5), reservadoPorServidor: false };
    }
}

class FirestoreSequenceStore {
    constructor(db, colecao) {
        this.db = db;
        this.colecao = colecao || 'fiscal_sequencias';
    }

    static chave(prestadorCnpj, serie) {
        return String(somenteDigitos(prestadorCnpj)) + '_' + String(somenteDigitos(serie)).padStart(5, '0').slice(-5);
    }

    async reservar(prestadorCnpj, serie, solicitado) {
        const chave = FirestoreSequenceStore.chave(prestadorCnpj, serie);
        const ref = this.db.collection(this.colecao).doc(chave);
        const digitosSerie = String(somenteDigitos(serie)).padStart(5, '0').slice(-5);
        let proximo = 0;

        await this.db.runTransaction(async function (tx) {
            const snap = await tx.get(ref);
            const atual = snap.exists && snap.data() ? Number(snap.data().ultimoNumero || 0) : 0;
            const solicitadoTrim = solicitado == null ? '' : String(solicitado).trim();
            proximo = solicitadoTrim === '' ? atual + 1 : Number(somenteDigitos(solicitadoTrim));
            if (!Number.isFinite(proximo) || proximo < 1) {
                throw new FiscalError(CODIGOS.VALIDACAO, 'Número da DPS inválido.', 400);
            }
            tx.set(ref, {
                prestadorCnpj: somenteDigitos(prestadorCnpj),
                serie: digitosSerie,
                ultimoNumero: proximo,
                atualizadoEm: new Date().toISOString()
            }, { merge: true });
        });

        return { numero: proximo, serie: digitosSerie, reservadoPorServidor: true };
    }
}

module.exports = {
    MemorySequenceStore,
    FirestoreSequenceStore
};
