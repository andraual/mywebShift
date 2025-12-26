/**
 * Funções auxiliares de formatação
 */

import { CONFIG } from '../config.js';

/**
 * Formata valor monetário
 * @param {number} valor 
 * @returns {string}
 */
export function formatarMoeda(valor) {
    return Number(valor).toLocaleString(CONFIG.MOEDA, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Formata horas
 * @param {number} horas 
 * @returns {string}
 */
export function formatarHoras(horas) {
    return Number(horas).toLocaleString(CONFIG.MOEDA, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2
    });
}

/**
 * Sanitiza texto para HTML seguro
 * @param {string} texto 
 * @returns {string}
 */
export function sanitizarHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

/**
 * Trunca texto com elipsis
 * @param {string} texto 
 * @param {number} limite 
 * @returns {string}
 */
export function truncarTexto(texto, limite = 50) {
    if (texto.length <= limite) return texto;
    return texto.substring(0, limite) + '...';
}

/**
 * Capitaliza primeira letra
 * @param {string} texto 
 * @returns {string}
 */
export function capitalizarPrimeira(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}
