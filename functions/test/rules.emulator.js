'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds
} = require('@firebase/rules-unit-testing');

const {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs
} = require('firebase/firestore');

const projeto = process.env.GCLOUD_PROJECT || 'demo-mywebshift';
const emulador = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081';
const partes = emulador.split(':');
const host = partes[0];
const port = Number(partes[1]);

let ambiente;

function banco(contexto) {
    return contexto.firestore();
}

function plantao(uid, extra) {
    return Object.assign({
        userId: uid,
        data: '2026-10-23',
        horaInicio: '08:00',
        tempoPlantao: 12,
        local: 'Hospital Central',
        valorHora: 100,
        valorTotal: 1200
    }, extra || {});
}

test.before(async function () {
    ambiente = await initializeTestEnvironment({
        projectId: projeto,
        firestore: {
            host: host,
            port: port,
            rules: fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8')
        }
    });
});

test.beforeEach(async function () {
    await ambiente.clearFirestore();
});

test.after(async function () {
    await ambiente.cleanup();
});

test('usuário não autenticado não acessa plantões, perfis, unidades nem fiscal', async function () {
    const db = banco(ambiente.unauthenticatedContext());

    await assertFails(setDoc(doc(db, 'plantoes', 'p1'), plantao('alice')));
    await assertFails(getDoc(doc(db, 'plantoes', 'p1')));
    await assertFails(getDocs(collection(db, 'plantoes')));

    await assertFails(setDoc(doc(db, 'recorrencias', 's1'), {
        userId: 'alice',
        tipo: 'semanal',
        dataInicial: '2026-10-23',
        status: 'ativa'
    }));
    await assertFails(getDoc(doc(db, 'recorrencias', 's1')));
    await assertFails(getDocs(collection(db, 'recorrencias')));

    await assertFails(setDoc(doc(db, 'usuarios', 'alice'), { nome: 'Alice' }));
    await assertFails(getDoc(doc(db, 'usuarios', 'alice')));

    await assertFails(setDoc(doc(db, 'users', 'alice', 'unidades', 'u1'), { nome: 'Unidade' }));
    await assertFails(getDoc(doc(db, 'users', 'alice', 'unidades', 'u1')));

    await assertFails(getDoc(doc(db, 'fiscal_emissoes', 'x')));
    await assertFails(setDoc(doc(db, 'fiscal_emissoes', 'x'), { status: 'processada' }));
});

test('usuário autenticado gerencia os próprios plantões', async function () {
    const db = banco(ambiente.authenticatedContext('alice'));

    await assertSucceeds(setDoc(doc(db, 'plantoes', 'p1'), plantao('alice')));
    await assertSucceeds(getDoc(doc(db, 'plantoes', 'p1')));
    await assertSucceeds(getDocs(query(collection(db, 'plantoes'), where('userId', '==', 'alice'))));
    await assertSucceeds(updateDoc(doc(db, 'plantoes', 'p1'), { local: 'Hospital Norte' }));
    await assertSucceeds(deleteDoc(doc(db, 'plantoes', 'p1')));
});

test('usuário não cria plantão em nome de outro nem transfere autoria', async function () {
    const db = banco(ambiente.authenticatedContext('alice'));

    await assertFails(setDoc(doc(db, 'plantoes', 'p1'), plantao('bob')));
    await assertFails(setDoc(doc(db, 'plantoes', 'p2'), { local: 'Sem dono' }));

    await ambiente.withSecurityRulesDisabled(async function (contexto) {
        await setDoc(doc(banco(contexto), 'plantoes', 'p3'), plantao('alice'));
    });

    await assertFails(updateDoc(doc(db, 'plantoes', 'p3'), { userId: 'bob' }));
});

test('usuário não lê, altera nem apaga plantão de outro usuário', async function () {
    await ambiente.withSecurityRulesDisabled(async function (contexto) {
        await setDoc(doc(banco(contexto), 'plantoes', 'alice-1'), plantao('alice'));
    });

    const db = banco(ambiente.authenticatedContext('bob'));

    await assertFails(getDoc(doc(db, 'plantoes', 'alice-1')));
    await assertFails(updateDoc(doc(db, 'plantoes', 'alice-1'), { local: 'Alterado' }));
    await assertFails(deleteDoc(doc(db, 'plantoes', 'alice-1')));
    await assertFails(getDocs(query(collection(db, 'plantoes'), where('userId', '==', 'alice'))));
    await assertFails(getDocs(collection(db, 'plantoes')));
});

test('usuário autenticado gerencia as próprias séries recorrentes', async function () {
    const db = banco(ambiente.authenticatedContext('alice'));

    await assertSucceeds(setDoc(doc(db, 'recorrencias', 's1'), {
        userId: 'alice',
        tipo: 'semanal',
        dataInicial: '2026-10-23',
        dataFim: null,
        excecoes: [],
        status: 'ativa'
    }));
    await assertSucceeds(getDoc(doc(db, 'recorrencias', 's1')));
    await assertSucceeds(getDocs(query(collection(db, 'recorrencias'), where('userId', '==', 'alice'))));
    await assertSucceeds(updateDoc(doc(db, 'recorrencias', 's1'), {
        status: 'encerrada',
        dataFim: '2026-11-20'
    }));
    await assertSucceeds(deleteDoc(doc(db, 'recorrencias', 's1')));
});

test('usuário não cria nem altera série recorrente de outro usuário', async function () {
    const alice = banco(ambiente.authenticatedContext('alice'));
    const bob = banco(ambiente.authenticatedContext('bob'));

    await assertFails(setDoc(doc(bob, 'recorrencias', 's1'), {
        userId: 'alice',
        tipo: 'semanal',
        dataInicial: '2026-10-23',
        status: 'ativa'
    }));

    await ambiente.withSecurityRulesDisabled(async function (contexto) {
        await setDoc(doc(banco(contexto), 'recorrencias', 's2'), {
            userId: 'alice',
            tipo: 'semanal',
            dataInicial: '2026-10-23',
            status: 'ativa'
        });
    });

    await assertFails(getDoc(doc(bob, 'recorrencias', 's2')));
    await assertFails(updateDoc(doc(bob, 'recorrencias', 's2'), { status: 'encerrada' }));
    await assertFails(deleteDoc(doc(bob, 'recorrencias', 's2')));

    await assertSucceeds(getDoc(doc(alice, 'recorrencias', 's2')));
});

test('perfil usuarios/{uid} é restrito ao próprio usuário', async function () {
    const alice = banco(ambiente.authenticatedContext('alice'));
    const bob = banco(ambiente.authenticatedContext('bob'));

    await assertSucceeds(setDoc(doc(alice, 'usuarios', 'alice'), { nome: 'Alice', email: 'alice@example.test' }));
    await assertSucceeds(getDoc(doc(alice, 'usuarios', 'alice')));
    await assertSucceeds(updateDoc(doc(alice, 'usuarios', 'alice'), { nome: 'Alice Silva' }));

    await assertFails(getDoc(doc(bob, 'usuarios', 'alice')));
    await assertFails(setDoc(doc(bob, 'usuarios', 'alice'), { nome: 'Invasor' }));
    await assertFails(deleteDoc(doc(bob, 'usuarios', 'alice')));
});

test('unidades em users/{uid}/unidades são restritas ao próprio usuário', async function () {
    const alice = banco(ambiente.authenticatedContext('alice'));
    const bob = banco(ambiente.authenticatedContext('bob'));

    await assertSucceeds(setDoc(doc(alice, 'users', 'alice', 'unidades', 'u1'), { nome: 'Clínica A' }));
    await assertSucceeds(getDoc(doc(alice, 'users', 'alice', 'unidades', 'u1')));
    await assertSucceeds(updateDoc(doc(alice, 'users', 'alice', 'unidades', 'u1'), { nome: 'Clínica B' }));

    await assertFails(getDoc(doc(bob, 'users', 'alice', 'unidades', 'u1')));
    await assertFails(setDoc(doc(bob, 'users', 'alice', 'unidades', 'u2'), { nome: 'Invasão' }));
    await assertFails(deleteDoc(doc(bob, 'users', 'alice', 'unidades', 'u1')));
});

test('cliente autenticado não acessa fiscal_emissoes diretamente', async function () {
    const db = banco(ambiente.authenticatedContext('alice'));

    await assertFails(getDoc(doc(db, 'fiscal_emissoes', 'qualquer')));
    await assertFails(setDoc(doc(db, 'fiscal_emissoes', 'qualquer'), { status: 'processada' }));
    await assertFails(updateDoc(doc(db, 'fiscal_emissoes', 'qualquer'), { status: 'falhou' }));
    await assertFails(deleteDoc(doc(db, 'fiscal_emissoes', 'qualquer')));
    await assertFails(getDocs(collection(db, 'fiscal_emissoes')));
});

test('coleções não previstas permanecem negadas por padrão', async function () {
    const db = banco(ambiente.authenticatedContext('alice'));

    await assertFails(getDoc(doc(db, 'colecao_desconhecida', 'x')));
    await assertFails(setDoc(doc(db, 'colecao_desconhecida', 'x'), { a: 1 }));
});
