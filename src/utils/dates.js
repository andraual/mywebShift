/**
 * Utilitários para datas
 */

/**
 * Obtém o dia da semana (0-6) de uma data em string YYYY-MM-DD
 * @param {string} dataString - Data em formato YYYY-MM-DD
 * @returns {number} 0=Domingo, 1=Segunda, ..., 6=Sábado
 */
export function obterDiaSemana(dataString) {
    const [ano, mes, dia] = dataString.split('-');
    return new Date(Number(ano), Number(mes) - 1, Number(dia)).getDay();
}

/**
 * Obtém a posição da semana no mês (1ª, 2ª, 3ª, etc)
 * @param {Date} data - Data
 * @returns {number} 1-5
 */
export function obterPosicaoSemanaNoMes(data) {
    const diaSemana = data.getDay();
    const diaDoMes = data.getDate();
    const ano = data.getFullYear();
    const mes = data.getMonth();
    
    let contador = 0;
    for (let dia = 1; dia <= diaDoMes; dia++) {
        const dataAtual = new Date(ano, mes, dia);
        if (dataAtual.getDay() === diaSemana) {
            contador++;
            if (dia === diaDoMes) return contador;
        }
    }
    return contador;
}

/**
 * Obtém data por posição da semana no mês
 * @param {number} ano 
 * @param {number} mes 
 * @param {number} diaSemana 
 * @param {number} posicao - 1-5
 * @returns {Date|null}
 */
export function obterDataPorPosicaoSemana(ano, mes, diaSemana, posicao) {
    let contador = 0;
    
    for (let dia = 1; dia <= 31; dia++) {
        const data = new Date(ano, mes, dia);
        
        if (data.getMonth() !== mes) {
            if (posicao >= 5 && contador > 0) {
                for (let diaReverso = 31; diaReverso >= 1; diaReverso--) {
                    const dataReversa = new Date(ano, mes, diaReverso);
                    if (dataReversa.getMonth() === mes && dataReversa.getDay() === diaSemana) {
                        return dataReversa;
                    }
                }
            }
            return null;
        }
        
        if (data.getDay() === diaSemana) {
            contador++;
            if (contador === posicao) return data;
        }
    }
    
    return null;
}

/**
 * Formata data para brasileiro (DD/MM/YYYY)
 * @param {Date} data 
 * @returns {string}
 */
export function formatarDataBR(data) {
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

/**
 * Converte string YYYY-MM-DD em Date
 * @param {string} dataString 
 * @returns {Date}
 */
export function criarDataSegura(dataString) {
    const [ano, mes, dia] = dataString.split('-');
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
}

/**
 * Valida se é uma data válida
 * @param {string} dataString 
 * @returns {boolean}
 */
export function ehDataValida(dataString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dataString)) return false;
    
    const date = criarDataSegura(dataString);
    const [ano, mes, dia] = dataString.split('-');
    
    return date.getFullYear() === parseInt(ano) &&
           date.getMonth() === parseInt(mes) - 1 &&
           date.getDate() === parseInt(dia);
}
