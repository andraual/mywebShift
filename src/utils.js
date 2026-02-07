// Utilitários globais (sem bundler)
(function (global) {
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function obterDiaSemana(dataString) {
    // Garante que a data seja interpretada no horário local, sem problemas de timezone
    const [ano, mes, dia] = dataString.split('-').map(Number);
    const data = new Date(ano, mes - 1, dia);
    return data.getDay();
  }

  function obterValorPorLocal(local, diaSemana) {
    const config = global.CONFIG && global.CONFIG.VALORES_POR_LOCAL[local];
    if (!config) return null;
    // Sábado = 6, Domingo = 0
    return (diaSemana === 0 || diaSemana === 6) ? config.fds : config.semana;
  }

  function formatarDataBR(data) {
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  function obterPosicaoSemanaNoMes(data) {
    const diaSemana = data.getDay();
    const diaDoMes = data.getDate();
    const ano = data.getFullYear();
    const mes = data.getMonth();
    let contador = 0;
    for (let dia = 1; dia <= diaDoMes; dia++) {
      const dataAtual = new Date(ano, mes, dia);
      if (dataAtual.getDay() === diaSemana) {
        contador++;
        if (dia === diaDoMes) {
          return contador;
        }
      }
    }
    return contador;
  }

  function obterDataPorPosicaoSemana(ano, mes, diaSemana, posicao) {
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
        if (contador === posicao) {
          return data;
        }
      }
    }
    return null;
  }

  global.Utils = {
    debounce,
    obterDiaSemana,
    obterValorPorLocal,
    formatarDataBR,
    obterPosicaoSemanaNoMes,
    obterDataPorPosicaoSemana
  };
})(window);
