/**
 * Configurações centralizadas do MyWebShift
 * Formato global (sem bundler). Anexa CONFIG, LOCAIS, MESES, DIAS_SEMANA, POSICOES_SEMANA em window.
 */

(function (global) {
    const CONFIG = {
        // Localização e Idioma
        MOEDA: 'pt-BR',
        FORMATO_DATA: 'YYYY-MM-DD',
        APP_VERSION: '1.2',

        // Valores por Local
        VALORES_POR_LOCAL: {
            'Intermedica Diadema': { semana: 114, fds: 125 },
            'Beneficência Portuguesa SC': { semana: 125, fds: 135 },
            'Hospital Christóvão da Gama Diadema': { semana: 125, fds: 125 },
            'Hospital São Cristovão (Mooca)': { semana: 125, fds: 125 }
        },

        // Recorrência
        MAX_RECORRENCIA: 52,
        TIPOS_RECORRENCIA: ['semanal', 'quinzenal', 'mensal'],

        // UI
        TIMEOUT_MODAL: 3000,
        DEBOUNCE_RESIZE: 300,
        CACHE_TTL: 5 * 60 * 1000 // 5 minutos
    };

    const LOCAIS = Object.keys(CONFIG.VALORES_POR_LOCAL);
    const MESES = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const POSICOES_SEMANA = ['', '1ª', '2ª', '3ª', '4ª', '5ª'];

    global.CONFIG = CONFIG;
    global.LOCAIS = LOCAIS;
    global.MESES = MESES;
    global.DIAS_SEMANA = DIAS_SEMANA;
    global.POSICOES_SEMANA = POSICOES_SEMANA;
})(window);
