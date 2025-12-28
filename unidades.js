// Gerenciamento de Unidades
(function() {
    'use strict';
    
    // Aguardar Firebase estar disponível
    function aguardarFirebase(callback) {
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.firestore) {
            callback();
        } else {
            setTimeout(() => aguardarFirebase(callback), 100);
        }
    }
    
    aguardarFirebase(() => {
        const auth = firebase.auth();
        const db = firebase.firestore();
        
        // Abrir modal de unidade (criar ou editar)
        window.abrirModalUnidade = function(unidadeId = null) {
            const modal = document.getElementById('modalUnidade');
            const titulo = document.getElementById('modalUnidadeTitulo');
            const form = document.getElementById('formUnidade');
            
            form.reset();
            document.getElementById('unidadeId').value = '';
            
            if (unidadeId) {
                titulo.textContent = 'Editar Unidade';
                const user = auth.currentUser;
                if (user) {
                    db.collection('users').doc(user.uid).collection('unidades').doc(unidadeId).get()
                        .then(doc => {
                            if (doc.exists) {
                                const data = doc.data();
                                document.getElementById('unidadeId').value = unidadeId;
                                document.getElementById('unidadeNome').value = data.nome;
                                document.getElementById('unidadeValorHora').value = data.valorHora;
                            }
                        });
                }
            } else {
                titulo.textContent = 'Adicionar Unidade';
            }
            
            modal.classList.add('show');
            modal.style.display = 'flex';
        };
        
        // Fechar modal
        window.fecharModalUnidade = function() {
            const modal = document.getElementById('modalUnidade');
            modal.classList.remove('show');
            modal.style.display = 'none';
        };
        
        // Salvar unidade
        async function salvarUnidade(event) {
            event.preventDefault();
            
            const user = auth.currentUser;
            if (!user) {
                alert('Você precisa estar logado.');
                return;
            }
            
            const unidadeId = document.getElementById('unidadeId').value;
            const nome = document.getElementById('unidadeNome').value.trim();
            const valorHora = parseFloat(document.getElementById('unidadeValorHora').value);
            
            if (!nome || isNaN(valorHora) || valorHora <= 0) {
                alert('Preencha todos os campos corretamente.');
                return;
            }
            
            const unidadeData = {
                nome: nome,
                valorHora: valorHora,
                ativo: true,
                atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            try {
                const unidadesRef = db.collection('users').doc(user.uid).collection('unidades');
                
                if (unidadeId) {
                    await unidadesRef.doc(unidadeId).update(unidadeData);
                } else {
                    unidadeData.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
                    await unidadesRef.add(unidadeData);
                }
                
                window.fecharModalUnidade();
                window.carregarUnidades();
                window.carregarUnidadesSelect();
                alert(unidadeId ? 'Unidade atualizada!' : 'Unidade cadastrada!');
            } catch (erro) {
                console.error('Erro ao salvar:', erro);
                alert('Erro ao salvar unidade.');
            }
        }
        
        // Carregar unidades na listagem
        window.carregarUnidades = async function() {
            const user = auth.currentUser;
            if (!user) return;
            
            const listaDiv = document.getElementById('listaUnidades');
            if (!listaDiv) return;
            
            try {
                const snapshot = await db.collection('users').doc(user.uid).collection('unidades')
                    .where('ativo', '==', true)
                    .orderBy('nome')
                    .get();
                
                if (snapshot.empty) {
                    listaDiv.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Nenhuma unidade cadastrada. Adicione a primeira!</p>';
                    return;
                }
                
                let html = '';
                snapshot.forEach(doc => {
                    const data = doc.data();
                    html += `
                        <div class="unidade-item">
                            <div class="unidade-info">
                                <h4>${data.nome}</h4>
                                <p>R$ ${data.valorHora.toFixed(2)}/hora</p>
                            </div>
                            <div class="unidade-acoes">
                                <button class="btn-editar" onclick="abrirModalUnidade('${doc.id}')">Editar</button>
                                <button class="btn-excluir" onclick="excluirUnidade('${doc.id}', '${data.nome}')">Excluir</button>
                            </div>
                        </div>
                    `;
                });
                
                listaDiv.innerHTML = html;
            } catch (erro) {
                console.error('Erro ao carregar:', erro);
                listaDiv.innerHTML = '<p style="color: red;">Erro ao carregar unidades.</p>';
            }
        };
        
        // Carregar unidades no select
        window.carregarUnidadesSelect = async function() {
            const user = auth.currentUser;
            if (!user) return;
            
            const select = document.getElementById('local');
            if (!select) return;
            
            try {
                const snapshot = await db.collection('users').doc(user.uid).collection('unidades')
                    .where('ativo', '==', true)
                    .orderBy('nome')
                    .get();
                
                const valorAtual = select.value;
                select.innerHTML = '<option value="">Selecione uma unidade</option>';
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const option = document.createElement('option');
                    option.value = data.nome;
                    option.textContent = `${data.nome} - R$ ${data.valorHora.toFixed(2)}/h`;
                    option.dataset.valorHora = data.valorHora;
                    select.appendChild(option);
                });
                
                if (valorAtual) select.value = valorAtual;
                
                // Remove event listeners antigos
                const newSelect = select.cloneNode(true);
                select.parentNode.replaceChild(newSelect, select);
                
                // Adiciona novo listener
                newSelect.addEventListener('change', function() {
                    const selectedOption = this.options[this.selectedIndex];
                    const valorHora = selectedOption.dataset.valorHora;
                    if (valorHora) {
                        document.getElementById('valorHora').value = parseFloat(valorHora).toFixed(2);
                    }
                });
            } catch (erro) {
                console.error('Erro:', erro);
                select.innerHTML = '<option value="">Erro ao carregar</option>';
            }
        };
        
        // Excluir unidade
        window.excluirUnidade = async function(unidadeId, nomeUnidade) {
            if (!confirm(`Tem certeza que deseja excluir "${nomeUnidade}"?`)) return;
            
            const user = auth.currentUser;
            if (!user) return;
            
            try {
                await db.collection('users').doc(user.uid).collection('unidades').doc(unidadeId).update({
                    ativo: false,
                    excluidoEm: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                window.carregarUnidades();
                window.carregarUnidadesSelect();
                alert('Unidade excluída com sucesso!');
            } catch (erro) {
                console.error('Erro:', erro);
                alert('Erro ao excluir unidade.');
            }
        };
        
        // Event listener para o formulário
        const formUnidade = document.getElementById('formUnidade');
        if (formUnidade) {
            formUnidade.addEventListener('submit', salvarUnidade);
        }
        
        // Carregar unidades quando o usuário logar
        auth.onAuthStateChanged(user => {
            if (user) {
                window.carregarUnidadesSelect();
            }
        });
        
        // Interceptar mostrarSecao para carregar unidades
        const mostrarSecaoOriginal = window.mostrarSecao;
        if (mostrarSecaoOriginal) {
            window.mostrarSecao = function(secao) {
                const unidadesDiv = document.getElementById('unidades');
                if (unidadesDiv) {
                    unidadesDiv.style.display = (secao === 'unidades') ? 'block' : 'none';
                }
                
                if (secao === 'unidades') {
                    window.carregarUnidades();
                }
                
                mostrarSecaoOriginal(secao);
            };
        }
        
        console.log('Módulo de unidades carregado.');
    });
})();
