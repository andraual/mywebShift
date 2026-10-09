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

  function numero(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  function toBRL(n) {
    return numero(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function calcularValorTotal(valorHora, tempoPlantao, valorCheio, bonus) {
    const vh = numero(valorHora);
    const tempo = numero(tempoPlantao);
    const bonusN = numero(bonus);
    const cheio = valorCheio !== null && valorCheio !== undefined && valorCheio !== '';
    if (cheio) {
      const vCheio = numero(valorCheio);
      const vhCalc = tempo > 0 ? (vCheio / tempo) : vh;
      return {
        valorHora: vhCalc,
        valorTotal: vCheio + bonusN
      };
    }
    return {
      valorHora: vh,
      valorTotal: (vh * tempo) + bonusN
    };
  }

  // Regra centralizada do valor/hora considerando final de semana.
  // valorHoraFimSemana (da unidade) tem prioridade; senão usa VALORES_POR_LOCAL.
  function calcularValorHoraPara(local, dataString, valorHora, valorHoraFimSemana) {
    const vh = numero(valorHora);
    if (!dataString) return vh;

    const diaSemana = obterDiaSemana(dataString);
    const isFds = diaSemana === 0 || diaSemana === 6;

    if (valorHoraFimSemana !== null && valorHoraFimSemana !== undefined && valorHoraFimSemana !== '') {
      return isFds ? numero(valorHoraFimSemana) : vh;
    }

    const valorConfig = obterValorPorLocal(local, diaSemana);
    if (valorConfig !== null && valorConfig !== undefined) {
      return numero(valorConfig);
    }

    return vh;
  }

  // Escapa texto para uso seguro em innerHTML (nome de local, observações etc.)
  function escaparHtml(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Gera e dispara o download de um arquivo via Blob + <a download>
  function baixarArquivo(nome, conteudo, tipo) {
    const blob = new Blob([conteudo], { type: tipo || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  global.Utils = {
    debounce,
    obterDiaSemana,
    obterValorPorLocal,
    formatarDataBR,
    obterPosicaoSemanaNoMes,
    obterDataPorPosicaoSemana,
    numero,
    toBRL,
    calcularValorTotal,
    calcularValorHoraPara,
    escaparHtml,
    baixarArquivo
  };
})(window);
