/**
 * Integração Notaas no frontend - preparado para uso, sem chamadas automáticas
 * Não faz chamadas reais automaticamente ao abrir telas
 */
(function (global) {
    'use strict';

    const ENDPOINTS = {
        config: '/notaasConfig',
        emitir: '/notaasEmitir',
        status: '/notaasStatus',
        documentos: '/notaasDocumentos'
    };

    async function chamarFuncao(endpoint, opcoes) {
        // Placeholder: em ambiente real deve chamar Firebase Functions com auth
        // Por segurança, não executa chamadas automáticas
        throw new Error('Integração Notaas no frontend não configurada para chamadas automáticas.');
    }

    global.NotaasIntegracao = {
        ENDPOINTS: ENDPOINTS,
        chamarFuncao: chamarFuncao
    };
})(typeof window !== 'undefined' ? window : globalThis);
