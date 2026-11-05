'use strict';

class FiscalError extends Error {
    constructor(codigo, mensagem, status, detalhes) {
        super(mensagem);
        this.name = 'FiscalError';
        this.codigo = codigo;
        this.status = status || 400;
        this.detalhes = detalhes || null;
    }
}

const CODIGOS = {
    NAO_AUTENTICADO: 'NAO_AUTENTICADO',
    SEM_PERMISSAO: 'SEM_PERMISSAO',
    CORPO_INVALIDO: 'CORPO_INVALIDO',
    VALIDACAO: 'VALIDACAO',
    AMBIENTE_INVALIDO: 'AMBIENTE_INVALIDO',
    PRODUCAO_NAO_CONFIRMADA: 'PRODUCAO_NAO_CONFIRMADA',
    IDEMPOTENCIA_OBRIGATORIA: 'IDEMPOTENCIA_OBRIGATORIA',
    IDEMPOTENCIA_INVALIDA: 'IDEMPOTENCIA_INVALIDA',
    EMISSAO_EM_PROCESSAMENTO: 'EMISSAO_EM_PROCESSAMENTO',
    EMISSAO_FALHOU: 'EMISSAO_FALHOU',
    LIMITE_EXCEDIDO: 'LIMITE_EXCEDIDO',
    PRESTADOR_NAO_AUTORIZADO: 'PRESTADOR_NAO_AUTORIZADO',
    TRANSMISSAO_REAL_DESABILITADA: 'TRANSMISSAO_REAL_DESABILITADA',
    ASSINATURA_REAL_DESABILITADA: 'ASSINATURA_REAL_DESABILITADA',
    CERTIFICADO_INDISPONIVEL: 'CERTIFICADO_INDISPONIVEL',
    DPS_NAO_ENCONTRADA: 'DPS_NAO_ENCONTRADA',
    ERRO_SEFIN: 'ERRO_SEFIN',
    NAO_ENCONTRADO: 'NAO_ENCONTRADO',
    SEQUENCIA_INDISPONIVEL: 'SEQUENCIA_INDISPONIVEL',
    RECONCILIACAO_INDISPONIVEL: 'RECONCILIACAO_INDISPONIVEL'
};

function erroAutenticacao(mensagem) {
    return new FiscalError(CODIGOS.NAO_AUTENTICADO, mensagem || 'Autenticação obrigatória.', 401);
}

function erroValidacao(detalhes) {
    return new FiscalError(CODIGOS.VALIDACAO, 'Dados fiscais inválidos.', 422, detalhes);
}

module.exports = {
    FiscalError,
    CODIGOS,
    erroAutenticacao,
    erroValidacao
};
