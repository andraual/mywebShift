'use strict';

function clonar(valor) {
    if (valor === undefined) return undefined;
    return globalThis.structuredClone
        ? globalThis.structuredClone(valor)
        : JSON.parse(JSON.stringify(valor));
}

function chave(colecao, id) {
    return colecao + '/' + id;
}

class FakeDocSnapshot {
    constructor(id, dados) {
        this.id = id;
        this.exists = dados !== undefined;
        this._dados = dados;
    }

    data() {
        return clonar(this._dados);
    }
}

class FakeQuerySnapshot {
    constructor(docs) {
        this.docs = docs;
        this.empty = docs.length === 0;
        this.size = docs.length;
    }

    forEach(callback) {
        this.docs.forEach(callback);
    }
}

class FakeDocRef {
    constructor(store, colecao, id) {
        this.store = store;
        this.colecao = colecao;
        this.id = id;
    }

    async get() {
        return new FakeDocSnapshot(this.id, this.store.dados.get(chave(this.colecao, this.id)));
    }

    async set(dados) {
        this.store.dados.set(chave(this.colecao, this.id), clonar(dados));
    }

    async update(dados) {
        const atual = this.store.dados.get(chave(this.colecao, this.id));
        if (atual === undefined) throw new Error('Documento inexistente para update: ' + this.id);
        this.store.dados.set(chave(this.colecao, this.id), Object.assign({}, atual, clonar(dados)));
    }

    async delete() {
        this.store.dados.delete(chave(this.colecao, this.id));
    }
}

class FakeQuery {
    constructor(store, colecao, filtros, ordenacao) {
        this.store = store;
        this.colecao = colecao;
        this.filtros = filtros || [];
        this.ordenacao = ordenacao || null;
    }

    where(campo, operador, valor) {
        return new FakeQuery(
            this.store,
            this.colecao,
            this.filtros.concat([{ campo: campo, operador: operador, valor: valor }]),
            this.ordenacao
        );
    }

    orderBy(campo, direcao) {
        return new FakeQuery(this.store, this.colecao, this.filtros, {
            campo: campo,
            direcao: direcao || 'asc'
        });
    }

    async get() {
        const prefixo = this.colecao + '/';
        let docs = [];

        for (const entrada of this.store.dados.entries()) {
            if (!entrada[0].startsWith(prefixo)) continue;
            const id = entrada[0].slice(prefixo.length);
            const dados = entrada[1];
            const corresponde = this.filtros.every(function (filtro) {
                if (filtro.operador !== '==') {
                    throw new Error('Operador não suportado no fake: ' + filtro.operador);
                }
                return dados[filtro.campo] === filtro.valor;
            });
            if (corresponde) docs.push(new FakeDocSnapshot(id, dados));
        }

        if (this.ordenacao) {
            const campo = this.ordenacao.campo;
            const sinal = this.ordenacao.direcao === 'desc' ? -1 : 1;
            docs.sort(function (a, b) {
                if (a._dados[campo] < b._dados[campo]) return -1 * sinal;
                if (a._dados[campo] > b._dados[campo]) return 1 * sinal;
                return 0;
            });
        }

        return new FakeQuerySnapshot(docs);
    }
}

class FakeCollection extends FakeQuery {
    doc(id) {
        const docId = id || ('auto_' + (++this.store.sequencia));
        return new FakeDocRef(this.store, this.colecao, docId);
    }
}

class FakeBatch {
    constructor(store) {
        this.store = store;
        this.operacoes = [];
    }

    set(ref, dados) {
        this.operacoes.push({ tipo: 'set', ref: ref, dados: dados });
        return this;
    }

    delete(ref) {
        this.operacoes.push({ tipo: 'delete', ref: ref });
        return this;
    }

    async commit() {
        for (const operacao of this.operacoes) {
            if (operacao.tipo === 'set') {
                await operacao.ref.set(operacao.dados);
            } else {
                await operacao.ref.delete();
            }
        }
    }
}

class FakeTransaction {
    constructor(store) {
        this.store = store;
        this.overlay = new Map();
    }

    _ler(chaveDoc) {
        if (this.overlay.has(chaveDoc)) {
            const item = this.overlay.get(chaveDoc);
            if (item.tipo === 'delete') return undefined;
            return item.dados;
        }
        return this.store.dados.get(chaveDoc);
    }

    async get(ref) {
        const chaveDoc = chave(ref.colecao, ref.id);
        return new FakeDocSnapshot(ref.id, this._ler(chaveDoc));
    }

    set(ref, dados) {
        this.overlay.set(chave(ref.colecao, ref.id), {
            tipo: 'set',
            dados: clonar(dados)
        });
    }

    update(ref, dados) {
        const chaveDoc = chave(ref.colecao, ref.id);
        const atual = this._ler(chaveDoc);
        if (atual === undefined) throw new Error('Documento inexistente para update: ' + ref.id);
        this.overlay.set(chaveDoc, {
            tipo: 'set',
            dados: Object.assign({}, atual, clonar(dados))
        });
    }

    delete(ref) {
        this.overlay.set(chave(ref.colecao, ref.id), { tipo: 'delete' });
    }

    commit() {
        for (const entrada of this.overlay.entries()) {
            if (entrada[1].tipo === 'delete') {
                this.store.dados.delete(entrada[0]);
            } else {
                this.store.dados.set(entrada[0], clonar(entrada[1].dados));
            }
        }
    }
}

class FakeFirestore {
    constructor() {
        this.dados = new Map();
        this.sequencia = 0;
    }

    collection(nome) {
        return new FakeCollection(this, nome, [], null);
    }

    batch() {
        return new FakeBatch(this);
    }

    async runTransaction(callback) {
        const transacao = new FakeTransaction(this);
        const resultado = await callback(transacao);
        transacao.commit();
        return resultado;
    }

    limpar() {
        this.dados.clear();
        this.sequencia = 0;
    }
}

module.exports = { FakeFirestore: FakeFirestore };
