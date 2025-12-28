// Gerenciamento de Unidades com suporte a valores diferenciados
(function() {
    'use strict';
    
    // Aguardar Firebase estar disponível E inicializado
    function aguardarFirebase(callback) {
        if (typeof firebase !== 'undefined' && 
            firebase.auth && 
            firebase.firestore &&
            firebase.apps && 
            firebase.apps.length > 0) {
            callback();
        } else {
            setTimeout(() => aguardarFirebase(callback), 100);
        }
    }
    
    // Verificar se data é final de semana
    function ehFinalDeSemana(data) {
        const dia = new Date(data).getDay();
        return dia === 0 || dia === 6; // 0 = Domingo, 6 = Sábado
    }
    
    aguardarFirebase(() => {
        try {
            const auth = firebase.auth();
            const db = firebase.firestore();
        
        // Toggle para mostrar/ocultar campo de valor final de semana
        const checkboxFimSemana = document.getElementById('unidadeValorFimSemanaCheck');
        const grupoFimSemana = document.getElementById('unidadeValorFimSemanaGroup');
        
        if (checkboxFimSemana && grupoFimSemana) {
            checkboxFimSemana.addEventListener('change', function() {
                grupoFimSemana.style.display = this.checked ? 'block' : 'none';
                const inputFimSemana = document.getElementById('unidadeValorHoraFimSemana');
                if (inputFimSemana) {
                    inputFimSemana.required = this.checked;
                }
            });
        }
        
        // Abrir modal de unidade (criar ou editar)
        window.abrirModalUnidade = function(unidadeId = null) {
            const modal = document.getElementById('modalUnidade');
            const titulo = document.getElementById('modalUnidadeTitulo');
            const form = document.getElementById('formUnidade');
            const checkboxFimSemana = document.getElementById('unidadeValorFimSemanaCheck');
            const grupoFimSemana = document.getElementById('unidadeValorFimSemanaGroup');
            
            form.reset();
            document.getElementById('unidadeId').value = '';
            grupoFimSemana.style.display = 'none';
            checkboxFimSemana.checked = false;
            
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
                                
                                // Carregar valor de final de semana se existir
                                if (data.valorHoraFimSemana) {
                                    checkboxFimSemana.checked = true;
                                    grupoFimSemana.style.display = 'block';
                                    document.getElementById('unidadeValorHoraFimSemana').value = data.valorHoraFimSemana;
                                }
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
            const temValorFimSemana = document.getElementById('unidadeValorFimSemanaCheck').checked;
            
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
            
            // Adicionar valor de final de semana se checkbox estiver marcado
            if (temValorFimSemana) {
                const valorHoraFimSemana = parseFloat(document.getElementById('unidadeValorHoraFimSemana').value);
                if (isNaN(valorHoraFimSemana) || valorHoraFimSemana <= 0) {
                    alert('Preencha o valor de final de semana corretamente.');
                    return;
                }
                unidadeData.valorHoraFimSemana = valorHoraFimSemana;
            } else {
                // Remove o campo se existia antes e agora está desmarcado
                unidadeData.valorHoraFimSemana = firebase.firestore.FieldValue.delete();
            }
            
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
                // Busca sem índice composto; filtra e ordena no cliente
                const snapshot = await db.collection('users').doc(user.uid).collection('unidades').get();
                const docs = snapshot.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(d => d.ativo)
                    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
                
                if (docs.length === 0) {
                    listaDiv.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Nenhuma unidade cadastrada. Adicione a primeira!</p>';
                    return;
                }
                
                let html = '';
                docs.forEach(data => {
                    const temFimSemana = data.valorHoraFimSemana ? true : false;
                    const infoValor = temFimSemana 
                        ? `Dia útil: R$ ${data.valorHora.toFixed(2)}/h | Fim de semana: R$ ${data.valorHoraFimSemana.toFixed(2)}/h`
                        : `R$ ${data.valorHora.toFixed(2)}/hora`;
                    
                    html += `
                        <div class="unidade-item">
                            <div class="unidade-info">
                                <h4>${data.nome}</h4>
                                <p>${infoValor}</p>
                            </div>
                            <div class="unidade-acoes">
                                <button class="btn-editar" onclick="abrirModalUnidade('${data.id}')">Editar</button>
                                <button class="btn-excluir" onclick="excluirUnidade('${data.id}', '${data.nome}')">Excluir</button>
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
        
        // Carregar unidades no select com detecção de final de semana
        window.carregarUnidadesSelect = async function() {
            const user = auth.currentUser;
            if (!user) return;
            
            const select = document.getElementById('local');
            if (!select) return;
            
            try {
                // Busca sem índice composto; filtra e ordena no cliente
                const snapshot = await db.collection('users').doc(user.uid).collection('unidades').get();
                const docs = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(d => d.ativo)
                    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
                
                const valorAtual = select.value;
                select.innerHTML = '<option value="">Selecione uma unidade</option>';
                
                docs.forEach(data => {
                    const option = document.createElement('option');
                    option.value = data.nome;
                    
                    // Armazenar ambos os valores como data attributes
                    option.dataset.valorHora = data.valorHora;
                    if (data.valorHoraFimSemana) {
                        option.dataset.valorHoraFimSemana = data.valorHoraFimSemana;
                        option.textContent = `${data.nome} (Útil: R$ ${data.valorHora.toFixed(2)}/h | FDS: R$ ${data.valorHoraFimSemana.toFixed(2)}/h)`;
                    } else {
                        option.textContent = `${data.nome} - R$ ${data.valorHora.toFixed(2)}/h`;
                    }
                    
                    select.appendChild(option);
                });
                
                if (valorAtual) select.value = valorAtual;
                
                // Remove event listeners antigos
                const newSelect = select.cloneNode(true);
                select.parentNode.replaceChild(newSelect, select);
                
                // Adiciona novo listener que detecta o dia da semana
                newSelect.addEventListener('change', function() {
                    const selectedOption = this.options[this.selectedIndex];
                    const valorHora = selectedOption.dataset.valorHora;
                    const valorHoraFimSemana = selectedOption.dataset.valorHoraFimSemana;
                    const dataInput = document.getElementById('data');
                    
                    if (valorHora) {
                        let valorAplicar = parseFloat(valorHora);
                        
                        // Se tiver data selecionada, verificar se é final de semana
                        if (dataInput && dataInput.value && valorHoraFimSemana) {
                            if (ehFinalDeSemana(dataInput.value)) {
                                valorAplicar = parseFloat(valorHoraFimSemana);
                            }
                        }
                        
                        document.getElementById('valorHora').value = valorAplicar.toFixed(2);
                    }
                });
                
                // Listener para quando a data mudar, atualizar o valor se necessário
                const dataInput = document.getElementById('data');
                if (dataInput) {
                    dataInput.addEventListener('change', function() {
                        const selectLocal = document.getElementById('local');
                        if (selectLocal && selectLocal.value) {
                            const selectedOption = selectLocal.options[selectLocal.selectedIndex];
                            const valorHora = selectedOption.dataset.valorHora;
                            const valorHoraFimSemana = selectedOption.dataset.valorHoraFimSemana;
                            
                            if (valorHora) {
                                let valorAplicar = parseFloat(valorHora);
                                
                                if (valorHoraFimSemana && ehFinalDeSemana(this.value)) {
                                    valorAplicar = parseFloat(valorHoraFimSemana);
                                }
                                
                                document.getElementById('valorHora').value = valorAplicar.toFixed(2);
                            }
                        }
                    });
                }
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
        
        // Criar unidades pré-definidas (seed) para o usuário atual
        window.criarUnidadesPredefinidas = async function() {
            const user = auth.currentUser;
            if (!user) {
                alert('Você precisa estar logado.');
                return;
            }

            const confirmar = confirm('Adicionar as unidades sugeridas ao seu cadastro?');
            if (!confirmar) return;

            const lista = [
                { nome: 'Intermedica Diadema', semana: 114, fds: 125 },
                { nome: 'Beneficência Portuguesa SC', semana: 125, fds: 135 },
                { nome: 'Hospital Christóvão da Gama Diadema', semana: 125, fds: 125 },
                { nome: 'Hospital São Cristovão (Mooca)', semana: 125, fds: 125 }
            ];

            try {
                const unidadesRef = db.collection('users').doc(user.uid).collection('unidades');
                const existentesSnap = await unidadesRef.where('ativo', '==', true).get();
                const existentes = new Set();
                existentesSnap.forEach(doc => {
                    const d = doc.data();
                    if (d && d.nome) existentes.add(d.nome);
                });

                let criadas = 0;
                for (const u of lista) {
                    if (existentes.has(u.nome)) continue;
                    await unidadesRef.add({
                        nome: u.nome,
                        valorHora: Number(u.semana),
                        valorHoraFimSemana: Number(u.fds),
                        ativo: true,
                        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    criadas++;
                }

                await window.carregarUnidades();
                await window.carregarUnidadesSelect();
                alert(criadas > 0 ? `Unidades adicionadas: ${criadas}` : 'Nenhuma unidade adicionada (já existiam).');
            } catch (erro) {
                console.error('Erro ao criar unidades sugeridas:', erro);
                alert('Erro ao criar unidades sugeridas.');
            }
        };

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
                // Sempre recarrega o select ao entrar em cadastro
                if (secao === 'cadastro') {
                    window.carregarUnidadesSelect();
                }
                
                mostrarSecaoOriginal(secao);
            };
        }
        
        console.log('Módulo de unidades com valor diferencial carregado.');
        } catch (erro) {
            console.error('Erro ao inicializar módulo de unidades:', erro);
        }
    });
})();
