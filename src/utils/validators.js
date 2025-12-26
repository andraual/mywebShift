/**
 * Validadores de entrada
 */

/**
 * Valida dados de plantão
 * @param {Object} plantaoData 
 * @returns {Object} { valido: boolean, erros: string[] }
 */
export function validarPlantao(plantaoData) {
    const erros = [];
    
    if (!plantaoData.data) {
        erros.push('Data é obrigatória');
    } else if (!ehDataValida(plantaoData.data)) {
        erros.push('Data inválida');
    }
    
    if (!plantaoData.horaInicio) {
        erros.push('Hora de início é obrigatória');
    } else if (!/^\d{2}:\d{2}$/.test(plantaoData.horaInicio)) {
        erros.push('Hora de início inválida (HH:MM)');
    }
    
    if (!plantaoData.tempoPlantao || Number(plantaoData.tempoPlantao) <= 0) {
        erros.push('Tempo de plantão deve ser maior que 0');
    }
    
    if (!plantaoData.local) {
        erros.push('Local é obrigatório');
    }
    
    if (!plantaoData.valorHora || Number(plantaoData.valorHora) < 0) {
        erros.push('Valor por hora é inválido');
    }
    
    if (plantaoData.valorCheio && Number(plantaoData.valorCheio) < 0) {
        erros.push('Valor cheio não pode ser negativo');
    }
    
    if (plantaoData.valorBonus && Number(plantaoData.valorBonus) < 0) {
        erros.push('Bônus não pode ser negativo');
    }
    
    return {
        valido: erros.length === 0,
        erros
    };
}

/**
 * Valida credenciais de login
 * @param {string} email 
 * @param {string} senha 
 * @returns {Object}
 */
export function validarLogin(email, senha) {
    const erros = [];
    
    if (!email) {
        erros.push('E-mail é obrigatório');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        erros.push('E-mail inválido');
    }
    
    if (!senha) {
        erros.push('Senha é obrigatória');
    } else if (senha.length < 6) {
        erros.push('Senha deve ter pelo menos 6 caracteres');
    }
    
    return {
        valido: erros.length === 0,
        erros
    };
}

/**
 * Valida quantidade de recorrência
 * @param {number} quantidade 
 * @param {number} max 
 * @returns {boolean}
 */
export function validarQuantidadeRecorrencia(quantidade, max = 52) {
    const num = Number(quantidade);
    return num > 0 && num <= max && Number.isInteger(num);
}

/**
 * Validação auxiliar para datas
 * @param {string} dataString 
 * @returns {boolean}
 */
function ehDataValida(dataString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dataString)) return false;
    
    const [ano, mes, dia] = dataString.split('-');
    const date = new Date(Number(ano), Number(mes) - 1, Number(dia));
    
    return date.getFullYear() === Number(ano) &&
           date.getMonth() === Number(mes) - 1 &&
           date.getDate() === Number(dia);
}
