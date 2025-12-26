/**
 * Configurações centralizadas do MyWebShift
 */

export const CONFIG = {
    // Localização e Idioma
    MOEDA: 'pt-BR',
    FORMATO_DATA: 'YYYY-MM-DD',
    
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
    CACHE_TTL: 5 * 60 * 1000, // 5 minutos
    
    // Firebase
    FIREBASE_CONFIG: {
        apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCPCsCD_UwBk_c4weCgTi8r0JyhdQThrZQ",
        authDomain: "mywebshift.firebaseapp.com",
        projectId: "mywebshift",
        storageBucket: "mywebshift.appspot.com",
        messagingSenderId: "994220258656",
        appId: "1:994220258656:web:4686ab749f948e3ae19a05",
        measurementId: "G-LF8XYGQ7M2"
    }
};

// Locais disponíveis
export const LOCAIS = Object.keys(CONFIG.VALORES_POR_LOCAL);

// Meses
export const MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Dias da semana
export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Posições de semana
export const POSICOES_SEMANA = ['', '1ª', '2ª', '3ª', '4ª', '5ª'];
