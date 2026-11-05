'use strict';

class LimitadorJanela {
    constructor(opcoes) {
        const o = opcoes || {};
        this.limite = o.limite || 30;
        this.janelaMs = o.janelaMs || 60000;
        this.tamanhoMaximo = o.tamanhoMaximo || 10000;
        this.agora = o.agora || function () { return Date.now(); };
        this.registros = new Map();
    }

    consumir(chave) {
        const agora = this.agora();
        const id = String(chave || 'anonimo');
        const atual = this.registros.get(id);

        if (!atual || agora >= atual.reiniciaEm) {
            const novo = { contagem: 1, reiniciaEm: agora + this.janelaMs };
            this.registros.set(id, novo);
            this.limpar(agora);
            return { permitido: true, restante: this.limite - 1, reiniciaEm: novo.reiniciaEm };
        }

        if (atual.contagem >= this.limite) {
            return { permitido: false, restante: 0, reiniciaEm: atual.reiniciaEm };
        }

        atual.contagem += 1;
        return { permitido: true, restante: this.limite - atual.contagem, reiniciaEm: atual.reiniciaEm };
    }

    limpar(agora) {
        if (this.registros.size <= this.tamanhoMaximo) return;
        const self = this;
        this.registros.forEach(function (valor, chave) {
            if (agora >= valor.reiniciaEm) self.registros.delete(chave);
        });
        const excedente = this.registros.size - this.tamanhoMaximo;
        if (excedente <= 0) return;
        const chaves = this.registros.keys();
        for (let i = 0; i < excedente; i += 1) {
            const chave = chaves.next().value;
            if (chave === undefined) break;
            this.registros.delete(chave);
        }
    }
}

module.exports = {
    LimitadorJanela
};
