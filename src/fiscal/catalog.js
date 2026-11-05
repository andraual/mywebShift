/**
 * Catálogo fiscal da NFS-e Nacional.
 * Formato global (sem bundler), seguindo o padrão de src/config.js.
 */
(function (global) {
    'use strict';

    const VERSAO_LEIAUTE_DPS = '1.01';
    const NAMESPACE_NFSE = 'http://www.sped.fazenda.gov.br/nfse';

    const SERVICO_PADRAO = Object.freeze({
        cTribNac: '040101',
        cTribMun: '097',
        cNBS: '123012200',
        descricao: 'Serviços médicos especializados'
    });

    const AMBIENTES = Object.freeze({
        producao: '1',
        homologacao: '2'
    });

    const TIPO_INSCRICAO = Object.freeze({
        CPF: '1',
        CNPJ: '2'
    });

    const OP_SIMP_NAC = Object.freeze([
        { valor: '1', label: 'Não optante' },
        { valor: '2', label: 'Optante — MEI' },
        { valor: '3', label: 'Optante — ME/EPP' }
    ]);

    const REG_AP_TRIB_SN = Object.freeze([
        { valor: '1', label: 'Tributos federais e municipal pelo Simples Nacional' },
        { valor: '2', label: 'Tributos federais pelo Simples Nacional e ISSQN pela NFS-e' },
        { valor: '3', label: 'Tributos federais e municipal pela NFS-e' }
    ]);

    const REG_ESP_TRIB = Object.freeze([
        { valor: '0', label: 'Nenhum' },
        { valor: '1', label: 'Ato Cooperado (Cooperativa)' },
        { valor: '2', label: 'Estimativa' },
        { valor: '3', label: 'Microempresa Municipal' },
        { valor: '4', label: 'Notário ou Registrador' },
        { valor: '5', label: 'Profissional Autônomo' },
        { valor: '6', label: 'Sociedade de Profissionais' },
        { valor: '9', label: 'Outros' }
    ]);

    const TRIB_ISSQN = Object.freeze([
        { valor: '1', label: 'Operação tributável' },
        { valor: '2', label: 'Imunidade' },
        { valor: '3', label: 'Exportação de serviço' },
        { valor: '4', label: 'Não incidência' }
    ]);

    const TP_RET_ISSQN = Object.freeze([
        { valor: '1', label: 'Não retido' },
        { valor: '2', label: 'Retido pelo tomador' },
        { valor: '3', label: 'Retido pelo intermediário' }
    ]);

    const UFS = Object.freeze([
        'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
        'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
    ]);

    function somenteDigitos(valor) {
        return String(valor == null ? '' : valor).replace(/\D/g, '');
    }

    global.FiscalCatalog = {
        VERSAO_LEIAUTE_DPS,
        NAMESPACE_NFSE,
        SERVICO_PADRAO,
        AMBIENTES,
        TIPO_INSCRICAO,
        OP_SIMP_NAC,
        REG_AP_TRIB_SN,
        REG_ESP_TRIB,
        TRIB_ISSQN,
        TP_RET_ISSQN,
        UFS,
        somenteDigitos
    };
})(typeof window !== 'undefined' ? window : globalThis);
