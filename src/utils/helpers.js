/**
 * Funções utilitárias de propósito geral
 */

/**
 * Debounce function
 * @param {Function} func 
 * @param {number} wait 
 * @returns {Function}
 */
export function debounce(func, wait) {
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

/**
 * Throttle function
 * @param {Function} func 
 * @param {number} limit 
 * @returns {Function}
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Cache simples com TTL
 */
export class CacheSimples {
    constructor(ttl = 5 * 60 * 1000) {
        this.dados = {};
        this.ttl = ttl;
    }

    set(chave, valor) {
        this.dados[chave] = {
            valor,
            timestamp: Date.now()
        };
    }

    get(chave) {
        const item = this.dados[chave];
        if (!item) return null;

        if (Date.now() - item.timestamp > this.ttl) {
            delete this.dados[chave];
            return null;
        }

        return item.valor;
    }

    limpar() {
        this.dados = {};
    }

    remover(chave) {
        delete this.dados[chave];
    }
}

/**
 * Tratamento centralizado de erros
 */
export class GerenciadorErros {
    static mostrarErro(mensagem, erro = null) {
        console.error(mensagem, erro);
        
        // Mostrar ao usuário
        const divErro = document.getElementById('erro-notificacao');
        if (divErro) {
            divErro.textContent = mensagem;
            divErro.style.display = 'block';
            
            setTimeout(() => {
                divErro.style.display = 'none';
            }, 5000);
        } else {
            alert(mensagem);
        }
    }

    static mostrarSucesso(mensagem) {
        console.log(mensagem);
        
        const divSucesso = document.getElementById('sucesso-notificacao');
        if (divSucesso) {
            divSucesso.textContent = mensagem;
            divSucesso.style.display = 'block';
            
            setTimeout(() => {
                divSucesso.style.display = 'none';
            }, 3000);
        }
    }

    static async tentarOperacao(operacao, mensagemErro = 'Erro ao executar operação') {
        try {
            return await operacao();
        } catch (erro) {
            this.mostrarErro(mensagemErro, erro);
            throw erro;
        }
    }
}

/**
 * Gerenciador de modals
 */
export class GerenciadorModals {
    static abrirModal(conteudoHTML, titulo = '') {
        // Fechar modal anterior
        this.fecharModal();

        const modal = document.createElement('div');
        modal.id = 'popupModal';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.background = 'white';
        modal.style.padding = '20px';
        modal.style.borderRadius = '8px';
        modal.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
        modal.style.zIndex = '9999';
        modal.style.maxWidth = '500px';
        modal.style.maxHeight = '80vh';
        modal.style.overflow = 'auto';

        if (titulo) {
            const tituloBkg = document.createElement('div');
            tituloBkg.style.marginBottom = '15px';
            tituloBkg.style.paddingBottom = '10px';
            tituloBkg.style.borderBottom = '1px solid #eee';
            tituloBkg.innerHTML = `<h3 style="margin: 0;">${titulo}</h3>`;
            modal.appendChild(tituloBkg);
        }

        const conteudo = document.createElement('div');
        conteudo.innerHTML = conteudoHTML;
        modal.appendChild(conteudo);

        document.body.appendChild(modal);

        // Fechar ao clicar fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.fecharModal();
            }
        });

        return modal;
    }

    static fecharModal() {
        const modal = document.getElementById('popupModal');
        if (modal) {
            modal.remove();
        }
    }
}

/**
 * Delegação de eventos
 */
export function delegarEvento(seletor, evento, callback) {
    document.addEventListener(evento, (e) => {
        if (e.target.matches(seletor)) {
            callback.call(e.target, e);
        }
    });
}
