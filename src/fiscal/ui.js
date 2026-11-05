/**
 * Interface da seção Fiscal: configuração, validação e prévia local da DPS.
 */
(function (global) {
    'use strict';

    const Catalog = global.FiscalCatalog || {};
    const Config = global.FiscalConfig || {};
    const Validators = global.FiscalValidators || {};
    const Dps = global.FiscalDps || {};

    let uidAtual = 'local';
    let inicializado = false;
    let ultimoXml = '';

    function porId(id) {
        return document.getElementById(id);
    }

    function valor(id) {
        const el = porId(id);
        return el ? el.value : '';
    }

    function definirValor(id, v) {
        const el = porId(id);
        if (el) el.value = v == null ? '' : v;
    }

    function preencherSelect(id, opcoes, placeholder) {
        const select = porId(id);
        if (!select) return;
        select.textContent = '';
        if (placeholder) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = placeholder;
            select.appendChild(opt);
        }
        (opcoes || []).forEach(function (item) {
            const opt = document.createElement('option');
            opt.value = item.valor;
            opt.textContent = item.label;
            select.appendChild(opt);
        });
    }

    function preencherUfs() {
        const select = porId('fiscalUf');
        if (!select) return;
        select.textContent = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Selecione';
        select.appendChild(opt);
        (Catalog.UFS || []).forEach(function (uf) {
            const o = document.createElement('option');
            o.value = uf;
            o.textContent = uf;
            select.appendChild(o);
        });
    }

    function hojeISO() {
        const d = new Date();
        const pad = function (n) { return String(n).padStart(2, '0'); };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function preencherFormulario(config) {
        const c = config || Config.configuracaoPadrao();
        const p = c.prestador || {};
        const e = p.endereco || {};
        const r = p.regTrib || {};
        const s = c.servico || {};

        definirValor('fiscalAmbiente', c.ambiente || 'homologacao');
        const confirmacao = porId('fiscalProducaoConfirmada');
        if (confirmacao) confirmacao.checked = Boolean(c.producaoConfirmada);

        definirValor('fiscalCnpj', p.cnpj);
        definirValor('fiscalIm', p.im);
        definirValor('fiscalRazaoSocial', p.razaoSocial);
        definirValor('fiscalNomeFantasia', p.nomeFantasia);
        definirValor('fiscalEmail', p.email);
        definirValor('fiscalTelefone', p.telefone);
        definirValor('fiscalLogradouro', e.logradouro);
        definirValor('fiscalNumero', e.numero);
        definirValor('fiscalComplemento', e.complemento);
        definirValor('fiscalBairro', e.bairro);
        definirValor('fiscalMunicipio', e.codigoMunicipio);
        definirValor('fiscalUf', e.uf);
        definirValor('fiscalCep', e.cep);

        definirValor('fiscalOpSimpNac', r.opSimpNac || '1');
        definirValor('fiscalRegApTribSN', r.regApTribSN || '');
        definirValor('fiscalRegEspTrib', r.regEspTrib || '0');

        definirValor('fiscalSerie', c.serie || '1');
        definirValor('fiscalNumeroDps', c.proximoNumeroDps || 1);

        definirValor('fiscalCTribNac', s.cTribNac || '040101');
        definirValor('fiscalCTribMun', s.cTribMun || '');
        definirValor('fiscalCNBS', s.cNBS || '');
        definirValor('fiscalDescricaoServico', s.descricao || '');
        definirValor('fiscalAliquota', s.aliquota);
        definirValor('fiscalTribISSQN', s.tribISSQN || '1');
        definirValor('fiscalTpRetISSQN', s.tpRetISSQN || '1');
        definirValor('fiscalLocalPrestacao', s.localPrestacao || '');

        if (!valor('fiscalDataCompetencia')) definirValor('fiscalDataCompetencia', hojeISO());
        atualizarRegimeSimples();
        atualizarAmbiente();
    }

    function lerFormulario() {
        const documento = String(valor('fiscalCnpj')).replace(/\D/g, '');
        return {
            versao: 1,
            ambiente: valor('fiscalAmbiente') || 'homologacao',
            producaoConfirmada: Boolean(porId('fiscalProducaoConfirmada') && porId('fiscalProducaoConfirmada').checked),
            serie: valor('fiscalSerie') || '1',
            proximoNumeroDps: Number(valor('fiscalNumeroDps')) || 1,
            prestador: {
                tipoInscricao: documento.length === 11 ? 'CPF' : 'CNPJ',
                cnpj: valor('fiscalCnpj'),
                im: valor('fiscalIm'),
                razaoSocial: valor('fiscalRazaoSocial'),
                nomeFantasia: valor('fiscalNomeFantasia'),
                email: valor('fiscalEmail'),
                telefone: valor('fiscalTelefone'),
                endereco: {
                    logradouro: valor('fiscalLogradouro'),
                    numero: valor('fiscalNumero'),
                    complemento: valor('fiscalComplemento'),
                    bairro: valor('fiscalBairro'),
                    codigoMunicipio: valor('fiscalMunicipio'),
                    uf: valor('fiscalUf'),
                    cep: valor('fiscalCep')
                },
                regTrib: {
                    opSimpNac: valor('fiscalOpSimpNac') || '1',
                    regApTribSN: valor('fiscalRegApTribSN'),
                    regEspTrib: valor('fiscalRegEspTrib') || '0'
                }
            },
            servico: {
                cTribNac: valor('fiscalCTribNac'),
                cTribMun: valor('fiscalCTribMun'),
                cNBS: valor('fiscalCNBS'),
                descricao: valor('fiscalDescricaoServico'),
                aliquota: valor('fiscalAliquota'),
                tribISSQN: valor('fiscalTribISSQN') || '1',
                tpRetISSQN: valor('fiscalTpRetISSQN') || '1',
                localPrestacao: valor('fiscalLocalPrestacao')
            }
        };
    }

    function lerEmissao() {
        return {
            dataCompetencia: valor('fiscalDataCompetencia'),
            valorServico: valor('fiscalValorServico'),
            localPrestacao: valor('fiscalLocalPrestacao'),
            tomador: {
                documento: valor('fiscalTomadorDocumento'),
                nome: valor('fiscalTomadorNome'),
                email: valor('fiscalTomadorEmail')
            }
        };
    }

    function mostrarMensagens(resultado) {
        const box = porId('fiscalResultado');
        if (!box) return;
        box.textContent = '';
        const erros = (resultado && resultado.erros) || [];
        const avisos = (resultado && resultado.avisos) || [];

        if (!erros.length) {
            const ok = document.createElement('p');
            ok.className = 'fiscal-ok';
            ok.textContent = 'Dados validados localmente. Nenhuma transmissão foi realizada.';
            box.appendChild(ok);
        }

        if (erros.length) {
            const titulo = document.createElement('p');
            titulo.className = 'fiscal-erro';
            titulo.textContent = 'Corrija os itens abaixo:';
            box.appendChild(titulo);
            const ul = document.createElement('ul');
            ul.className = 'fiscal-lista';
            erros.forEach(function (erro) {
                const li = document.createElement('li');
                li.textContent = erro;
                ul.appendChild(li);
            });
            box.appendChild(ul);
        }

        if (avisos.length) {
            const titulo = document.createElement('p');
            titulo.className = 'fiscal-aviso';
            titulo.textContent = 'Avisos:';
            box.appendChild(titulo);
            const ul = document.createElement('ul');
            ul.className = 'fiscal-lista';
            avisos.forEach(function (aviso) {
                const li = document.createElement('li');
                li.textContent = aviso;
                ul.appendChild(li);
            });
            box.appendChild(ul);
        }
    }

    function atualizarPreview(xml) {
        const pre = porId('fiscalPreview');
        if (!pre) return;
        ultimoXml = xml || '';
        pre.textContent = xml || 'Nenhuma prévia gerada.';
    }

    function atualizarRegimeSimples() {
        const select = porId('fiscalOpSimpNac');
        const regime = porId('fiscalRegApTribSN');
        if (!select || !regime) return;
        const aplicar = String(select.value) === '3';
        regime.disabled = !aplicar;
        regime.required = aplicar;
        if (!aplicar) regime.value = '';
    }

    function atualizarAmbiente() {
        const aviso = porId('fiscalAvisoProducao');
        if (!aviso) return;
        const producao = valor('fiscalAmbiente') === 'producao';
        aviso.style.display = producao ? 'block' : 'none';
        if (!producao) {
            const confirmacao = porId('fiscalProducaoConfirmada');
            if (confirmacao) confirmacao.checked = false;
        }
    }

    function carregarFormulario() {
        preencherFormulario(Config.carregar(uidAtual));
        mostrarMensagens({ erros: [], avisos: [] });
        atualizarPreview('');
    }

    function salvarConfiguracao(event) {
        if (event) event.preventDefault();
        const config = lerFormulario();
        const resultado = Validators.validarConfig(config);
        try {
            Config.salvar(uidAtual, config);
        } catch (erro) {
            console.error('Erro ao salvar configuração fiscal:', erro);
            mostrarMensagens({ erros: ['Não foi possível salvar a configuração neste navegador.'], avisos: [] });
            return null;
        }
        mostrarMensagens(resultado);
        return resultado.valido ? config : null;
    }

    function gerarPrevia() {
        const config = lerFormulario();
        const validacaoConfig = Validators.validarConfig(config);
        const emissao = lerEmissao();
        const validacaoEmissao = Validators.validarEmissao(config, emissao);

        if (!validacaoConfig.valido || !validacaoEmissao.valido) {
            mostrarMensagens({
                erros: validacaoConfig.erros.concat(validacaoEmissao.erros),
                avisos: validacaoConfig.avisos.concat(validacaoEmissao.avisos)
            });
            atualizarPreview('');
            return null;
        }

        try {
            const xml = Dps.gerarXmlDps({
                config: config,
                dataCompetencia: emissao.dataCompetencia,
                valorServico: emissao.valorServico,
                localPrestacao: emissao.localPrestacao,
                tomador: emissao.tomador
            });
            atualizarPreview(xml);
            mostrarMensagens(validacaoConfig);
            return xml;
        } catch (erro) {
            console.error('Erro ao gerar prévia da DPS:', erro);
            mostrarMensagens({ erros: [erro.message || 'Erro ao gerar a prévia da DPS.'], avisos: [] });
            atualizarPreview('');
            return null;
        }
    }

    function baixarXml() {
        const xml = ultimoXml || gerarPrevia();
        if (!xml) return;
        const numero = String(valor('fiscalNumeroDps') || '1').replace(/\D/g, '') || '1';
        if (global.Utils && typeof global.Utils.baixarArquivo === 'function') {
            global.Utils.baixarArquivo('dps-previa-' + numero + '.xml', xml, 'application/xml;charset=utf-8');
        }
    }

    function limparConfiguracao() {
        if (!global.confirm('Remover a configuração fiscal salva neste navegador?')) return;
        Config.limpar(uidAtual);
        preencherFormulario(Config.configuracaoPadrao());
        mostrarMensagens({ erros: [], avisos: [] });
        atualizarPreview('');
    }

    function inicializar() {
        if (inicializado) return;
        const secao = porId('fiscal');
        if (!secao) return;
        inicializado = true;

        preencherUfs();
        preencherSelect('fiscalOpSimpNac', Catalog.OP_SIMP_NAC, null);
        preencherSelect('fiscalRegApTribSN', Catalog.REG_AP_TRIB_SN, 'Selecione');
        preencherSelect('fiscalRegEspTrib', Catalog.REG_ESP_TRIB, null);
        preencherSelect('fiscalTribISSQN', Catalog.TRIB_ISSQN, null);
        preencherSelect('fiscalTpRetISSQN', Catalog.TP_RET_ISSQN, null);

        const opSimpNac = porId('fiscalOpSimpNac');
        if (opSimpNac) opSimpNac.addEventListener('change', atualizarRegimeSimples);
        const ambiente = porId('fiscalAmbiente');
        if (ambiente) ambiente.addEventListener('change', atualizarAmbiente);

        const form = porId('formFiscalConfig');
        if (form) form.addEventListener('submit', salvarConfiguracao);

        const btnPrevia = porId('fiscalGerarPrevia');
        if (btnPrevia) btnPrevia.addEventListener('click', gerarPrevia);
        const btnBaixar = porId('fiscalBaixarXml');
        if (btnBaixar) btnBaixar.addEventListener('click', baixarXml);
        const btnLimpar = porId('fiscalLimpar');
        if (btnLimpar) btnLimpar.addEventListener('click', limparConfiguracao);

        preencherFormulario(Config.carregar(uidAtual));

        if (global.firebase && global.firebase.auth) {
            global.firebase.auth().onAuthStateChanged(function (user) {
                const novoUid = user ? user.uid : 'local';
                if (novoUid !== uidAtual) {
                    uidAtual = novoUid;
                    if (porId('fiscal').style.display !== 'none') preencherFormulario(Config.carregar(uidAtual));
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }

    global.FiscalUI = {
        carregar: carregarFormulario,
        salvar: salvarConfiguracao,
        gerarPrevia: gerarPrevia,
        limpar: limparConfiguracao
    };
})(typeof window !== 'undefined' ? window : globalThis);
