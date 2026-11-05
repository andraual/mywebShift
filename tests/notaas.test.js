'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotaasMapper } = require('../functions/src/fiscal/notaas/NotaasMapper');
const { FiscalProvider } = require('../functions/src/fiscal/providers/FiscalProvider');
const { NationalNfseProvider } = require('../functions/src/fiscal/providers/NationalNfseProvider');
const { FiscalProviderFactory } = require('../functions/src/fiscal/providers/FiscalProviderFactory');

test('FiscalProvider é contrato base', function () {
    const p = new FiscalProvider('teste');
    assert.equal(p.getNome(), 'teste');
    assert.throws(() => { throw new Error('x'); });
});

test('NationalNfseProvider preserva serviço existente', async function () {
    const chamado = [];
    const servico = {
        emitir: async (dados) => { chamado.push(dados); return { ok: true }; },
        consultar: async (d) => { return { ok: true, idDps: d.idDps }; }
    };
    const provedor = new NationalNfseProvider({ servico: servico });
    const res = await provedor.emitir({ dados: {} });
    assert.equal(res.ok, true);
    assert.equal(chamado.length, 1);
});

test('FiscalProviderFactory usa provedor padrão seguro', function () {
    const factory = new FiscalProviderFactory({ servico: { emitir: async ()=>({}), consultar: async ()=>({}) } });
    const p = factory.obterProvedor('desconhecido');
    assert.equal(p.getNome(), 'nacional');
});

test('NotaasMapper converte dados internos para payload', function () {
    const mapper = new NotaasMapper();
    const payload = mapper.paraEmitir({
        uid: 'u1',
        dados: {
            tomador: { nome: 'Cliente', cnpj: '12.345.678/0001-90', email: 'c@c.com' },
            servico: { descricao: 'Serviço', codigo: '010700' },
            valores: { total: 1500.00, aliquotaIss: 2.0 },
            referencia: 'FAT-1'
        }
    });
    assert.equal(payload.tomador.nome, 'Cliente');
    assert.equal(payload.tomador.cnpj, '12345678000190');
    assert.equal(payload.valores.total, 1500);
    assert.equal(payload.valores.aliquotaIss, 2);
    assert.equal(payload.referencia, 'FAT-1');
});
