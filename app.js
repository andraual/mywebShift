        (function() {
        console.log('app.js loaded. window.Utils:', !!window.Utils, 'window.CONFIG:', !!window.CONFIG);
        
        // Instead of destructuring, use window.Utils directly to avoid scope issues
        // This way, the functions are always accessed from the global namespace

        // Função para navegação entre seções
        function mostrarSecao(secao) {
            document.getElementById('inicio').style.display = (secao === 'inicio') ? 'flex' : 'none';
            document.getElementById('cadastro').style.display = (secao === 'cadastro') ? 'block' : 'none';
            document.getElementById('calendario').style.display = (secao === 'calendario') ? 'block' : 'none';
            document.getElementById('resumo').style.display = (secao === 'resumo') ? 'block' : 'none';
            document.getElementById('consolidado').style.display = (secao === 'consolidado') ? 'block' : 'none';
            // Atualiza o calendário ao entrar na tela
            if (secao === 'calendario' && window.atualizarCalendario) {
                window.atualizarCalendario();
            }
            // Atualiza o resumo ao entrar na tela
            if (secao === 'resumo') {
                verificarAnosDisponiveis(); // Verifica e adiciona novos anos
                setResumoDefaults(); // <-- define mês/ano atual antes de filtrar
                filtrarResumo();
            }
            // Carrega consolidado ao entrar na tela
            if (secao === 'consolidado') {
                carregarConsolidado();
            }
            if (secao === 'inicio') {
                plantaoEditandoId = null;
            }
            if (secao === 'cadastro' && !plantaoEditandoId) {
                // Reabilita recorrência para novo plantão
                document.getElementById('recorrenteCheck').disabled = false;
                document.querySelector('#cadastro h2').textContent = 'Cadastrar Novo Plantão';
            }
        }

        // Inicialização do Firebase usando a API compatível
        const firebaseConfig = window.firebaseConfig;
        if (!firebaseConfig) {
            console.error("Configuração do Firebase não encontrada. Crie 'firebase-config.js' a partir do template e carregue-o antes de app.js.");
            // Mostra a tela de login e oculta o app principal
            const loginEl = document.getElementById('login');
            const appContainer = document.querySelector('.container');
            if (loginEl) loginEl.style.display = 'flex';
            if (appContainer) appContainer.style.display = 'none';

            // Exibe mensagem amigável de erro
            const errEl = document.getElementById('loginErro');
            if (errEl) {
                errEl.textContent = 'Configuração do Firebase ausente. Adicione o arquivo firebase-config.js no servidor (ou publique-o) para continuar.';
                errEl.classList.add('show');
            }

            // Desativa ações de login enquanto não houver config
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', function(e) { e.preventDefault(); });
            }
            const googleBtn = document.getElementById('googleLoginBtn');
            if (googleBtn) {
                googleBtn.disabled = true;
                googleBtn.title = 'Configuração ausente';
            }
            // Interrompe a inicialização para evitar erros posteriores
            return;
        }

        firebase.initializeApp(firebaseConfig);
        firebase.analytics();
        const db = firebase.firestore();
        const auth = firebase.auth();
        
        console.log('Firebase inicializado:', {
            projectId: firebaseConfig.projectId,
            authDomain: firebaseConfig.authDomain
        });

        // Controle de exibição: só mostra o app se estiver logado
        function mostrarAppLogado(logado) {
            document.getElementById('login').style.display = logado ? 'none' : 'flex';
            document.querySelector('.container').style.display = logado ? 'block' : 'none';

            if (logado) {
                const user = firebase.auth().currentUser;
                const isContador = user.email === 'contador@contador.com';

                // Mostra apenas o botão financeiro para o contador
                if (isContador) {
                    document.querySelectorAll('.main-btn').forEach(btn => {
                        if (!btn.title.includes('Financeiro')) {
                            btn.style.display = 'none';
                        }
                    });
                } else {
                    // Mostra todos os botões para outros usuários
                    document.querySelectorAll('.main-btn').forEach(btn => {
                        btn.style.display = 'flex';
                    });
                }

                mostrarSecao('inicio');
            }
        }

        // Verifica se está logado ao carregar
        auth.onAuthStateChanged(function(user) {
            mostrarAppLogado(!!user);
        });

        // Sistema de Tema (Claro/Escuro)
        function inicializarTema() {
            // Recupera tema salvo do localStorage
            const temaSalvo = localStorage.getItem('theme') || 'light';
            aplicarTema(temaSalvo);
            
            // Marca o radio button correto
            document.getElementById('themeLight').checked = temaSalvo === 'light';
            document.getElementById('themeDark').checked = temaSalvo === 'dark';
        }

        function aplicarTema(tema) {
            if (tema === 'dark') {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }
            localStorage.setItem('theme', tema);
        }

        // Event listeners para mudar tema
        document.getElementById('themeLight').addEventListener('change', function() {
            if (this.checked) {
                aplicarTema('light');
            }
        });

        document.getElementById('themeDark').addEventListener('change', function() {
            if (this.checked) {
                aplicarTema('dark');
            }
        });

        // Inicializar tema ao carregar
        window.addEventListener('DOMContentLoaded', inicializarTema);
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', inicializarTema);
        } else {
            inicializarTema();
        }

        // Função para buscar plantões do Firestore e formatar para o calendário
        async function buscarPlantoes() {
            try {
                const user = firebase.auth().currentUser;
                if (!user) {
                    console.warn('Usuário não autenticado ao buscar plantões');
                    return [];
                }

                // Verifica cache
                if (cache.plantoes && Date.now() - cache.timestamp < cache.TTL) {
                    return cache.plantoes;
                }

                const snapshot = await db.collection("plantoes").where("userId", "==", user.uid).get();
                const eventos = [];
                
                snapshot.forEach(doc => {
                    try {
                        const p = doc.data();
                        eventos.push({
                            id: doc.id,
                            title: `Plantão - ${p.local}`,
                            start: `${p.data}T${p.horaInicio}`,
                            end: moment(`${p.data}T${p.horaInicio}`).add(Number(p.tempoPlantao), 'hours').format('YYYY-MM-DDTHH:mm'),
                            local: p.local,
                            valorHora: p.valorHora,
                            horas: p.tempoPlantao,
                            total: (Number(p.valorHora) * Number(p.tempoPlantao)).toFixed(2),
                            observacoes: p.observacoes
                        });
                    } catch (erro) {
                        console.error('Erro ao processar plantão:', erro);
                    }
                });

                // Armazena em cache
                cache.plantoes = eventos;
                cache.timestamp = Date.now();
                
                return eventos;
            } catch (erro) {
                console.error('Erro ao buscar plantões:', erro);
                mostrarErro('Erro ao buscar plantões. Tente novamente.');
                return [];
            }
        }        // Inicializa o calendário
        $(document).ready(function() {
            // Função para calcular altura do calendário baseada no dispositivo
            function getCalendarHeight() {
                const isMobile = window.innerWidth <= 768;
                if (isMobile) {
                    // Em dispositivos móveis, usa altura automática
                    return 'auto';
                } else {
                    // Em desktop, mantém altura calculada
                    return Math.max(520, $(window).height() - 220);
                }
            }

            // Inicializa o calendário com altura responsiva
            $('#calendar').fullCalendar({
                locale: 'pt-br',
                header: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'month,agendaWeek,agendaDay'
                },
                defaultView: 'month',
                editable: false,
                eventLimit: true,
                events: [],
                height: getCalendarHeight(),
                aspectRatio: window.innerWidth <= 768 ? 1.2 : 1.35,
                eventClick: function(calEvent, jsEvent, view) {
                    const confirmacao = `
                        <div style="text-align: center;">
                            <p>Plantão: ${calEvent.title}</p>
                            <p>Local: ${calEvent.local}</p>
                            <p>Valor por hora: R$ ${calEvent.valorHora}</p>
                            <p>Total: R$ ${calEvent.total}</p>
                            ${calEvent.observacoes ? `<p>Observações: ${calEvent.observacoes}</p>` : ''}
                            <button onclick="editarPlantao('${calEvent.id}')">✏️ Editar</button>
                            <button onclick="excluirPlantao('${calEvent.id}')">🗑️ Excluir</button>
                            <button onclick="fecharPopup()">Cancelar</button>
                        </div>
                    `;
                    const modal = document.createElement('div');
                    modal.style.position = 'fixed';
                    modal.style.top = '50%';
                    modal.style.left = '50%';
                    modal.style.transform = 'translate(-50%, -50%)';
                    modal.style.background = 'white';
                    modal.style.padding = '20px';
                    modal.style.borderRadius = '8px';
                    modal.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
                    modal.style.zIndex = '9999'; // Garante que o modal fique acima de outros elementos
                    modal.innerHTML = confirmacao;

                    modal.id = 'popupModal'; // Adiciona um ID ao modal para facilitar a manipulação
                    document.body.appendChild(modal);
                }
            });

            // Função global para atualizar o calendário ao entrar na tela
            window.atualizarCalendario = async function() {
                const eventos = await buscarPlantoes();
                $('#calendar').fullCalendar('removeEvents');
                $('#calendar').fullCalendar('addEventSource', eventos);
            };            // Ajusta altura do calendário ao redimensionar a janela com debounce
            $(window).on('resize', window.Utils.debounce(function() {
                const isMobile = window.innerWidth <= 768;
                try {
                    if (isMobile) {
                        // Em dispositivos móveis, usa altura automática
                        $('#calendar').fullCalendar('option', 'height', 'auto');
                        $('#calendar').fullCalendar('option', 'aspectRatio', 1.2);
                    } else {
                        // Em desktop, usa altura calculada
                        const h = Math.max(520, $(window).height() - 220);
                        $('#calendar').fullCalendar('option', 'height', h);
                        $('#calendar').fullCalendar('option', 'aspectRatio', 1.35);
                    }
                    $('#calendar').fullCalendar('render');
                } catch (e) {
                    console.warn('Erro ao ajustar altura do FullCalendar:', e);
                }
            }, CONFIG.DEBOUNCE_RESIZE)).trigger('resize');
        });

        // Função para filtrar o resumo financeiro
        async function filtrarResumo() {
            try {
                const mes = document.getElementById('mesResumo').value.padStart(2, '0');
                const ano = document.getElementById('anoResumo').value;
                const resumoContent = document.getElementById('resumoContent');
                const user = firebase.auth().currentUser;
                
                if (!user) {
                    resumoContent.innerHTML = "<p>Usuário não autenticado.</p>";
                    return;
                }

                const snapshot = await db.collection("plantoes").where("userId", "==", user.uid).get();
                const resumoPorLocal = {};

                snapshot.forEach(doc => {
                    try {
                        const p = doc.data();
                        if (p.data && p.data.startsWith(`${ano}-${mes}`)) {
                            if (!resumoPorLocal[p.local]) {
                                resumoPorLocal[p.local] = { horas: 0, valor: 0, plantoes: [] };
                            }
                            const horas = Number(p.tempoPlantao) || 0;
                            const valorHora = Number(p.valorHora) || 0;
                            const valorTotal = p.valorTotal !== undefined ? Number(p.valorTotal) : (horas * valorHora);
                            resumoPorLocal[p.local].horas += horas;
                            resumoPorLocal[p.local].valor += valorTotal;
                            resumoPorLocal[p.local].plantoes.push({
                                id: doc.id,
                                data: p.data,
                                horaInicio: p.horaInicio || '',
                                tempoPlantao: horas,
                                valorHora: valorHora,
                                valorTotal: valorTotal,
                                local: p.local,
                                observacoes: p.observacoes || ''
                            });
                        }
                    } catch (erro) {
                        console.error('Erro ao processar documento:', erro);
                    }
                });

                let html = '';
                Object.keys(resumoPorLocal).forEach(local => {
                    resumoPorLocal[local].plantoes.sort((a, b) => {
                        if (a.data !== b.data) return a.data.localeCompare(b.data);
                        return (a.horaInicio || '').localeCompare(b.horaInicio || '');
                    });

                    html += `
                        <div class="summary-item">
                            <h3>${local}</h3>
                            <div class="resumo-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th style="border-bottom:1px solid #ccc; padding:4px;">Dia</th>
                                            <th style="border-bottom:1px solid #ccc; padding:4px;">Horas</th>
                                            <th style="border-bottom:1px solid #ccc; padding:4px;">Valor Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
        ${resumoPorLocal[local].plantoes.map(p => `
            <tr onclick="abrirPopupResumo('${p.id}')" style="cursor:pointer;">
                <td style="padding:4px;">${p.data.split('-').reverse().join('/')}</td>
                <td style="padding:4px; text-align:center;">${p.tempoPlantao}</td>
                <td style="padding:4px; text-align:right;">${p.valorTotal ? 'R$ ' + Number(p.valorTotal).toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '-'}</td>
            </tr>
        `).join('')}
    </tbody>
                                </table>
                            </div>
                            <p><strong>Total de horas:</strong> ${resumoPorLocal[local].horas}</p>
                            <p><strong>Valor total:</strong> R$ ${resumoPorLocal[local].valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                        </div>
                    `;
                });

                if (!html) {
                    html = `<p>Nenhum plantão encontrado para o período selecionado.</p>`;
                }

                resumoContent.innerHTML = html;
                atualizarResumoTotal(resumoPorLocal);
            } catch (erro) {
                console.error('Erro ao filtrar resumo:', erro);
                mostrarErro('Erro ao carregar resumo financeiro. Tente novamente.');
            }
        }

        // Login com Email e Senha
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const senha = document.getElementById('loginSenha').value;
            const erroDiv = document.getElementById('loginErro');
            const sucessoDiv = document.getElementById('loginSucesso');
            erroDiv.classList.remove('show');
            sucessoDiv.classList.remove('show');
            
            try {
                console.log('Tentando login com:', email);
                await auth.signInWithEmailAndPassword(email, senha);
                console.log('Login bem-sucedido!');
                // O onAuthStateChanged já cuida da navegação
            } catch (error) {
                console.error('Erro de login:', error.code, error.message);
                
                // Mensagens de erro mais específicas
                let mensagem = 'E-mail ou senha inválidos.';
                if (error.code === 'auth/user-not-found') {
                    mensagem = 'Usuário não encontrado. Crie uma nova conta.';
                } else if (error.code === 'auth/wrong-password') {
                    mensagem = 'Senha incorreta.';
                } else if (error.code === 'auth/invalid-email') {
                    mensagem = 'E-mail inválido.';
                } else if (error.code === 'auth/user-disabled') {
                    mensagem = 'Usuário desabilitado.';
                } else {
                    // Exibe código e mensagem para diagnósticos (config/domínios/providers)
                    mensagem = `Erro (${error.code}): ${error.message}`;
                }
                
                erroDiv.textContent = mensagem;
                erroDiv.classList.add('show');
                console.log('Mensagem exibida:', mensagem);
            }
        });

        // Google Login
        document.getElementById('googleLoginBtn').addEventListener('click', async function() {
            const erroDiv = document.getElementById('loginErro');
            const sucessoDiv = document.getElementById('loginSucesso');
            erroDiv.classList.remove('show');
            sucessoDiv.classList.remove('show');
            
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                console.log('Iniciando login com Google...');
                await auth.signInWithPopup(provider);
                console.log('Login com Google bem-sucedido!');
            } catch (error) {
                console.error('Erro no login com Google:', error.code, error.message);
                let mensagem = 'Erro ao fazer login com Google.';
                if (error.code === 'auth/popup-closed-by-user') {
                    mensagem = 'Login cancelado.';
                } else if (error.code === 'auth/network-request-failed') {
                    mensagem = 'Erro de conexão.';
                } else {
                    mensagem = `Erro (${error.code}): ${error.message}`;
                }
                erroDiv.textContent = mensagem;
                erroDiv.classList.add('show');
            }
        });

        // Link para criar conta
        document.getElementById('criarContaLink').addEventListener('click', function(e) {
            e.preventDefault();
            mostrarFormularioCriaConta();
        });

        // Link para voltar ao login
        document.getElementById('voltarLoginLink').addEventListener('click', function(e) {
            e.preventDefault();
            voltarAoLogin();
        });

        // Formulário de criar conta
        document.getElementById('criarContaForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const nome = document.getElementById('criarNome').value;
            const email = document.getElementById('criarEmail').value;
            const senha = document.getElementById('criarSenha').value;
            const senhaConfirm = document.getElementById('criarSenhaConfirm').value;
            const termos = document.getElementById('criarTermos').checked;
            const erroDiv = document.getElementById('criarContaErro');
            const sucessoDiv = document.getElementById('criarContaSucesso');
            
            erroDiv.classList.remove('show');
            sucessoDiv.classList.remove('show');
            
            // Validações
            if (senha !== senhaConfirm) {
                erroDiv.textContent = 'As senhas não conferem.';
                erroDiv.classList.add('show');
                return;
            }
            
            if (senha.length < 6) {
                erroDiv.textContent = 'A senha deve ter mínimo 6 caracteres.';
                erroDiv.classList.add('show');
                return;
            }
            
            if (!termos) {
                erroDiv.textContent = 'Você deve concordar com os termos de serviço.';
                erroDiv.classList.add('show');
                return;
            }
            
            try {
                console.log('Criando conta para:', email);
                
                // Criar usuário
                const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
                const user = userCredential.user;
                
                // Salvar nome no Firestore
                await db.collection('usuarios').doc(user.uid).set({
                    nome: nome,
                    email: email,
                    criadoEm: new Date(),
                    ultimoAcesso: new Date()
                });
                
                console.log('Conta criada com sucesso!');
                sucessoDiv.textContent = 'Conta criada com sucesso! Redirecionando...';
                sucessoDiv.classList.add('show');
                
                // Aguardar um pouco antes de redirecionar
                setTimeout(() => {
                    // O onAuthStateChanged já cuida da navegação
                }, 1500);
                
            } catch (error) {
                console.error('Erro ao criar conta:', error.code, error.message);
                
                let mensagem = 'Erro ao criar conta.';
                if (error.code === 'auth/email-already-in-use') {
                    mensagem = 'Este e-mail já está registrado.';
                } else if (error.code === 'auth/invalid-email') {
                    mensagem = 'E-mail inválido.';
                } else if (error.code === 'auth/weak-password') {
                    mensagem = 'Senha muito fraca.';
                } else if (error.code === 'auth/network-request-failed') {
                    mensagem = 'Erro de conexão.';
                } else {
                    mensagem = `Erro (${error.code}): ${error.message}`;
                }
                
                erroDiv.textContent = mensagem;
                erroDiv.classList.add('show');
            }
        });

        // Funções para alternar entre login e criar conta
        function mostrarFormularioCriaConta() {
            document.getElementById('login').style.display = 'none';
            document.getElementById('criarContaModal').style.display = 'flex';
            document.getElementById('criarNome').focus();
        }

        function voltarAoLogin() {
            document.getElementById('criarContaModal').style.display = 'none';
            document.getElementById('login').style.display = 'flex';
            document.getElementById('loginEmail').focus();
        }

        // Função para adicionar anos dinamicamente ao select
        function adicionarAnoAoResumo(ano) {
            const anoSelect = document.getElementById('anoResumo');
            const anoString = String(ano);
            const exists = Array.from(anoSelect.options).some(opt => opt.value === anoString);
            
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = anoString;
                opt.text = anoString;
                anoSelect.appendChild(opt);
                // Ordena as opções numericamente
                const opcoes = Array.from(anoSelect.options);
                opcoes.sort((a, b) => Number(a.value) - Number(b.value));
                anoSelect.innerHTML = '';
                opcoes.forEach(opt => anoSelect.appendChild(opt));
            }
        }
        
        // Cache simples
        const cache = {
            plantoes: null,
            timestamp: null,
            TTL: window.CONFIG.CACHE_TTL
        };

        // Validação de plantão
        function validarPlantao(data) {
            const erros = [];
            if (!data.data) erros.push('Data é obrigatória');
            if (!data.horaInicio) erros.push('Hora de início é obrigatória');
            if (data.tempoPlantao <= 0) erros.push('Tempo deve ser maior que 0');
            if (!data.local) erros.push('Local é obrigatório');
            if (data.valorHora < 0) erros.push('Valor por hora não pode ser negativo');
            return { valido: erros.length === 0, erros };
        }

        // Mostrar erro ao usuário
        function mostrarErro(mensagem) {
            console.error(mensagem);
            alert(mensagem);
        }

        // Mostrar sucesso ao usuário
        function mostrarSucesso(mensagem) {
            console.log(mensagem);
        }

        // Verificar e adicionar anos dos plantões existentes
        async function verificarAnosDisponiveis() {
            const user = firebase.auth().currentUser;
            if (!user) return;
            
            try {
                const snapshot = await db.collection("plantoes").where("userId", "==", user.uid).get();
                const anos = new Set();
                
                snapshot.forEach(doc => {
                    const p = doc.data();
                    if (p.data) {
                        const ano = Number(p.data.split('-')[0]);
                        anos.add(ano);
                    }
                });
                
                // Adiciona cada ano encontrado
                anos.forEach(ano => adicionarAnoAoResumo(ano));
            } catch (error) {
                console.error("Erro ao verificar anos disponíveis:", error);
            }
        }
        
        // Função auxiliar para verificar e atualizar anos
        function atualizarValorHora() {
            const data = document.getElementById('data').value;
            const local = document.getElementById('local').value;
            const valorHoraInput = document.getElementById('valorHora');

            if (!data || !local) {
                valorHoraInput.value = '';
                return;
            }

            const diaSemana = window.Utils.obterDiaSemana(data);
            const valor = window.Utils.obterValorPorLocal(local, diaSemana);
            
            if (valor !== null) {
                valorHoraInput.value = valor;
            }
        }
        
        // Adiciona listeners para atualizar o valor ao mudar data ou local
        document.getElementById('data').addEventListener('change', function() {
            atualizarValorHora();
            atualizarInfoRecorrencia();
        });
        document.getElementById('local').addEventListener('change', atualizarValorHora);        // Função auxiliar para formatar data no formato brasileiro sem problemas de fuso horário
        function formatarDataBR(data) {
            const dia = String(data.getDate()).padStart(2, '0');
            const mes = String(data.getMonth() + 1).padStart(2, '0');
            const ano = data.getFullYear();
            return `${dia}/${mes}/${ano}`;
        }

        // Função auxiliar para obter a posição da semana no mês (1ª, 2ª, 3ª, 4ª, 5ª)
        // Função para calcular datas de recorrência
        function calcularDatasRecorrencia() {
            const dataInicial = new Date(document.getElementById('data').value);
            const tipo = document.getElementById('tipoRecorrencia').value;
            const quantidade = parseInt(document.getElementById('quantidadeRecorrencia').value) || 4;
            const dataFimInput = document.getElementById('dataFim').value;
            const dataFim = dataFimInput ? new Date(dataFimInput) : null;
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0); // Remove horário para comparar apenas datas
            
            const datas = [];
            const diaSemana = dataInicial.getDay(); // 0=Domingo, 1=Segunda, etc.
            
            if (tipo === 'semanal') {
                // Semanal: toda semana no mesmo dia
                let dataAtual = new Date(dataInicial);
                
                for (let i = 0; i < quantidade; i++) {
                    if (dataFim && dataAtual > dataFim) break;
                    if (dataAtual >= hoje) {
                        datas.push(new Date(dataAtual));
                    }
                    dataAtual.setDate(dataAtual.getDate() + 7);
                }
                
            } else if (tipo === 'quinzenal') {
                // Quinzenal: semana sim, semana não (a cada 14 dias)
                let dataAtual = new Date(dataInicial);
                
                for (let i = 0; i < quantidade; i++) {
                    if (dataFim && dataAtual > dataFim) break;
                    if (dataAtual >= hoje) {
                        datas.push(new Date(dataAtual));
                    }
                    dataAtual.setDate(dataAtual.getDate() + 14);
                }
                  } else if (tipo === 'mensal') {
                // Mensal: mesma posição da semana no mês (ex: toda 3ª quarta-feira)
                const posicaoSemana = window.Utils.obterPosicaoSemanaNoMes(dataInicial);
                let mesAtual = dataInicial.getMonth();
                let anoAtual = dataInicial.getFullYear();
                let plantoesCriados = 0;
                
                // Primeiro, adiciona a data inicial se for válida
                if (dataInicial >= hoje) {
                    datas.push(new Date(dataInicial));
                    plantoesCriados++;
                }
                
                // Avança para o próximo mês
                mesAtual++;
                if (mesAtual > 11) {
                    mesAtual = 0;
                    anoAtual++;
                }
                
                // Continua criando os plantões restantes
                while (plantoesCriados < quantidade) {
                    const dataCalculada = window.Utils.obterDataPorPosicaoSemana(anoAtual, mesAtual, diaSemana, posicaoSemana);
                    
                    if (!dataCalculada) {
                        // Se não existe esta posição no mês (ex: 5ª segunda), pula para o próximo mês
                        mesAtual++;
                        if (mesAtual > 11) {
                            mesAtual = 0;
                            anoAtual++;
                        }
                        continue;
                    }
                    
                    if (dataFim && dataCalculada > dataFim) break;
                    
                    datas.push(new Date(dataCalculada));
                    plantoesCriados++;
                    
                    // Avança para o próximo mês
                    mesAtual++;
                    if (mesAtual > 11) {
                        mesAtual = 0;
                        anoAtual++;
                    }
                }
            }
            
            return datas;
        }let plantaoEditandoId = null;
        let origemEdicao = null; // Variável para armazenar a origem da edição
        
        async function editarPlantao(id, origem) {
            fecharPopup();
            plantaoEditandoId = id; // Define o ID do plantão sendo editado
            origemEdicao = origem; // Define a origem da edição (calendário ou financeiro)

            const doc = await db.collection("plantoes").doc(id).get();
            const plantao = doc.data();

            if (!plantao) {
                alert("Plantão não encontrado!");
                return;
            }            document.getElementById('data').value = plantao.data;
            document.getElementById('horaInicio').value = plantao.horaInicio;
            document.getElementById('tempoPlantao').value = plantao.tempoPlantao;
            document.getElementById('local').value = plantao.local;
            document.getElementById('valorHora').value = plantao.valorHora;
            document.getElementById('observacoes').value = plantao.observacoes;

            // Carrega valor cheio se existir
            if (plantao.valorCheio) {
                document.getElementById('valorCheioCheck').checked = true;
                document.getElementById('valorCheio').value = plantao.valorCheio;
                document.getElementById('valorCheioGroup').style.display = 'block';
                document.getElementById('valorHora').disabled = true;
            }

            // Carrega bônus se existir
            if (plantao.valorBonus) {
                document.getElementById('bonusCheck').checked = true;
                document.getElementById('valorBonus').value = plantao.valorBonus;
                document.getElementById('bonusGroup').style.display = 'block';
            }

            // Desabilita recorrência no modo edição
            document.getElementById('recorrenteCheck').checked = false;
            document.getElementById('recorrenteCheck').disabled = true;
            document.getElementById('recorrenciaGroup').style.display = 'none';
            
            // Adiciona aviso sobre edição
            const formTitle = document.querySelector('#cadastro h2');
            formTitle.textContent = 'Editar Plantão';

            mostrarSecao('cadastro');
        }
        
        // Atualize a função de salvar o plantão para retornar à origem
        document.getElementById('plantaoForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const data = document.getElementById('data').value;
            const horaInicio = document.getElementById('horaInicio').value;
            const tempoPlantao = document.getElementById('tempoPlantao').value;
            const local = document.getElementById('local').value;
            const valorHora = document.getElementById('valorHora').value;
            const valorCheioCheck = document.getElementById('valorCheioCheck').checked;
            const valorCheio = document.getElementById('valorCheio').value;
            const bonusCheck = document.getElementById('bonusCheck').checked;
            const valorBonus = document.getElementById('valorBonus').value;
            const observacoes = document.getElementById('observacoes').value;
            const recorrenteCheck = document.getElementById('recorrenteCheck').checked;

            // Validação
            const validacao = validarPlantao({
                data, horaInicio, tempoPlantao, local, 
                valorHora, valorCheio: valorCheio || undefined, 
                valorBonus: valorBonus || undefined
            });
            
            if (!validacao.valido) {
                mostrarErro(validacao.erros.join('\n'));
                return;
            }

            const user = firebase.auth().currentUser;
            if (!user) {
                alert("Usuário não autenticado!");
                return;
            }

            let valorTotal;
            let valorHoraFinal = valorHora;
            let bonusValor = bonusCheck && valorBonus ? Number(valorBonus) : 0;

            if (valorCheioCheck && valorCheio) {
                valorTotal = Number(valorCheio) + bonusValor;
                valorHoraFinal = (Number(valorCheio) / Number(tempoPlantao)).toFixed(2);
            } else {
                valorTotal = (Number(valorHora) * Number(tempoPlantao)) + bonusValor;
            }

            try {                if (plantaoEditandoId) {
                    // Modo edição - não permite recorrência
                    const plantao = {
                        data,
                        horaInicio,
                        tempoPlantao,
                        local,
                        valorHora: valorHoraFinal,
                        valorCheio: valorCheioCheck && valorCheio ? Number(valorCheio) : null,
                        valorBonus: bonusCheck && valorBonus ? Number(valorBonus) : null,
                        valorTotal,
                        observacoes,
                        userId: user.uid
                    };

                    await db.collection("plantoes").doc(plantaoEditandoId).update(plantao);
                    console.log("Plantão atualizado com sucesso!");
                    plantaoEditandoId = null;
                    
                    exibirPopupSucesso("Plantão atualizado com sucesso!", 1);
                } else {
                    // Modo criação - verifica recorrência
                    if (recorrenteCheck) {
                        const datas = calcularDatasRecorrencia();
                        let plantoesCriados = 0;
                        
                        for (const dataPlantao of datas) {
                            const dataFormatada = dataPlantao.toISOString().split('T')[0];
                            
                            // Recalcula valor por hora para cada data usando função centralizada
                            const dataString = dataFormatada;
                            let valorHoraData = valorHoraFinal;
                            
                            if (!valorCheioCheck) {
                                const diaSemana = window.Utils.obterDiaSemana(dataString);
                                const valor = window.Utils.obterValorPorLocal(local, diaSemana);
                                if (valor !== null) {
                                    valorHoraData = valor;
                                }
                            }
                            
                            let valorTotalData = valorCheioCheck && valorCheio ? Number(valorCheio) : (Number(valorHoraData) * Number(tempoPlantao));
                            valorTotalData += bonusValor; // Adiciona o bônus ao valor total

                            const plantao = {
                                data: dataFormatada,
                                horaInicio,
                                tempoPlantao,
                                local,
                                valorHora: valorHoraData,
                                valorCheio: valorCheioCheck && valorCheio ? Number(valorCheio) : null,
                                valorBonus: bonusCheck && valorBonus ? Number(valorBonus) : null,
                                valorTotal: valorTotalData,
                                observacoes: observacoes + (observacoes ? ' ' : '') + '(Recorrente)',
                                userId: user.uid
                            };

                            await db.collection("plantoes").add(plantao);
                            plantoesCriados++;
                        }
                        
                        console.log(`${plantoesCriados} plantões recorrentes cadastrados!`);
                        exibirPopupSucesso(`${plantoesCriados} plantões recorrentes cadastrados com sucesso!`, plantoesCriados);
                        
                        // Adiciona ano do plantão ao resumo financeiro
                        const anoPlantao = Number(data.split('-')[0]);
                        adicionarAnoAoResumo(anoPlantao);
                    } else {
                        // Plantão único
                        const plantao = {
                            data,
                            horaInicio,
                            tempoPlantao,
                            local,
                            valorHora: valorHoraFinal,
                            valorCheio: valorCheioCheck && valorCheio ? Number(valorCheio) : null,
                            valorBonus: bonusCheck && valorBonus ? Number(valorBonus) : null,
                            valorTotal,
                            observacoes,
                            userId: user.uid
                        };

                        await db.collection("plantoes").add(plantao);
                        console.log("Plantão cadastrado com sucesso!");
                        exibirPopupSucesso("Plantão cadastrado com sucesso!", 1);
                        
                        // Adiciona ano do plantão ao resumo financeiro
                        const anoPlantao = Number(data.split('-')[0]);
                        adicionarAnoAoResumo(anoPlantao);
                    }
                }                // Limpa os campos do formulário
                this.reset();
                document.getElementById('valorCheioGroup').style.display = 'none';
                document.getElementById('bonusGroup').style.display = 'none';
                document.getElementById('recorrenciaGroup').style.display = 'none';
                document.getElementById('valorHora').disabled = false;
                const info = document.getElementById('recorrencia-info');
                if (info) info.remove();

            } catch (error) {
                console.error("Erro ao salvar plantão: ", error);
                alert("Erro ao salvar plantão. Tente novamente.");
            }
        });

        // Função para exibir popup de sucesso
        function exibirPopupSucesso(mensagem, quantidade) {
            const confirmacao = `
                <div style="text-align: center;">
                    <p>${mensagem}</p>
                    ${quantidade > 1 ? `<p style="color: #666; font-size: 14px;">Você pode ver todos os plantões no calendário</p>` : ''}
                    <button onclick="fecharPopup(); mostrarSecao('cadastro');">Novo Plantão</button>
                    <button onclick="fecharPopup(); mostrarSecao('calendario');">Ver Calendário</button>
                    <button onclick="fecharPopup(); mostrarSecao('inicio');">Início</button>
                </div>
            `;
            const modal = document.createElement('div');
            modal.style.position = 'fixed';
            modal.style.top = '50%';
            modal.style.left = '50%';
            modal.style.transform = 'translate(-50%, -50%)';
            modal.style.background = 'white';
            modal.style.padding = '20px';
            modal.style.borderRadius = '8px';
            modal.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
            modal.style.zIndex = '9999';
            modal.innerHTML = confirmacao;
            modal.id = 'popupModal';
            document.body.appendChild(modal);
        }

        // Atualize os botões de editar para passar a origem
        function abrirPopupResumo(plantaoId) {
            const confirmacao = `
                <div style="text-align: center;">
                    <button onclick="editarPlantao('${plantaoId}', 'resumo')">✏️ Editar</button>
                    <button onclick="excluirPlantao('${plantaoId}')">🗑️ Excluir</button>
                    <button onclick="fecharPopup()">Cancelar</button>
                </div>
            `;
            const modal = document.createElement('div');
            modal.style.position = 'fixed';
            modal.style.top = '50%';
            modal.style.left = '50%';
            modal.style.transform = 'translate(-50%, -50%)';
            modal.style.background = 'white';
            modal.style.padding = '20px';
            modal.style.borderRadius = '8px';
            modal.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
            modal.style.zIndex = '9999';
            modal.innerHTML = confirmacao;

            modal.id = 'popupModal';
            document.body.appendChild(modal);
        }

        // Função para fechar o popup
        function fecharPopup() {
            const modal = document.getElementById('popupModal');
            if (modal) {
                document.body.removeChild(modal);
            }
        }        // Mostrar/ocultar campo de valor cheio e calcular valorHora automaticamente
document.getElementById('valorCheioCheck').addEventListener('change', function() {
    const valorCheioGroup = document.getElementById('valorCheioGroup');
    const valorCheioInput = document.getElementById('valorCheio');
    const valorHoraInput = document.getElementById('valorHora');
    valorCheioGroup.style.display = this.checked ? 'block' : 'none';
    valorCheioInput.required = this.checked;
    valorHoraInput.disabled = this.checked;

    if (this.checked) {
        // Se marcar, limpa o valorHora e espera o usuário preencher o valor cheio
        valorHoraInput.value = '';
    } else {
        valorCheioInput.value = '';
        valorHoraInput.disabled = false;
    }
});

// Mostrar/ocultar campo de bônus
document.getElementById('bonusCheck').addEventListener('change', function() {
    const bonusGroup = document.getElementById('bonusGroup');
    const bonusInput = document.getElementById('valorBonus');
    bonusGroup.style.display = this.checked ? 'block' : 'none';
    bonusInput.required = this.checked;

    if (!this.checked) {
        bonusInput.value = '';
    }
});

// Mostrar/ocultar campo de recorrência
document.getElementById('recorrenteCheck').addEventListener('change', function() {
    const recorrenciaGroup = document.getElementById('recorrenciaGroup');
    recorrenciaGroup.style.display = this.checked ? 'block' : 'none';
    
    if (this.checked) {
        // Adiciona informação sobre recorrência
        if (!document.getElementById('recorrencia-info')) {
            const info = document.createElement('div');
            info.id = 'recorrencia-info';
            info.className = 'recorrencia-info';
            info.innerHTML = '<strong>📅 Plantão Recorrente:</strong> Serão criados múltiplos plantões baseados na configuração escolhida.';
            recorrenciaGroup.appendChild(info);
        }
    } else {
        const info = document.getElementById('recorrencia-info');
        if (info) info.remove();
    }
});

// Atualizar informações da recorrência quando mudar tipo ou quantidade
document.getElementById('tipoRecorrencia').addEventListener('change', atualizarInfoRecorrencia);
document.getElementById('quantidadeRecorrencia').addEventListener('input', atualizarInfoRecorrencia);
document.getElementById('dataFim').addEventListener('change', atualizarInfoRecorrencia);

// Validação da quantidade de recorrência
document.getElementById('quantidadeRecorrencia').addEventListener('input', function() {
    const valor = parseInt(this.value);
    if (valor > 52) {
        this.value = 52;
        alert('Máximo de 52 repetições permitidas (1 ano)');
    } else if (valor < 1) {
        this.value = 1;
    }
});

function atualizarInfoRecorrencia() {
    const info = document.getElementById('recorrencia-info');
    if (!info) return;
    
    const data = document.getElementById('data').value;
    const tipo = document.getElementById('tipoRecorrencia').value;
    const quantidade = document.getElementById('quantidadeRecorrencia').value;
    const dataFim = document.getElementById('dataFim').value;
    
    if (!data) {
        info.innerHTML = '<strong>📅 Plantão Recorrente:</strong> Selecione uma data primeiro.';
        return;
    }
    
    const dataInicial = new Date(data);
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const posicoes = ['', '1ª', '2ª', '3ª', '4ª', '5ª'];
    let texto = '<strong>📅 Plantão Recorrente:</strong> ';
    
    if (tipo === 'semanal') {
        texto += `Toda ${diasSemana[dataInicial.getDay()]}`;
    } else if (tipo === 'quinzenal') {
        texto += `Toda ${diasSemana[dataInicial.getDay()]} (semana sim, semana não)`;
    } else if (tipo === 'mensal') {
        const posicao = window.Utils.obterPosicaoSemanaNoMes(dataInicial);
        texto += `Toda ${posicoes[posicao]} ${diasSemana[dataInicial.getDay()]} do mês`;
    }
      const datasCalculadas = calcularDatasRecorrencia();
      if (dataFim) {
        const dataLimite = new Date(dataFim);
        texto += ` até ${window.Utils.formatarDataBR(dataLimite)} (${datasCalculadas.length} plantões)`;
    } else if (quantidade) {
        if (datasCalculadas.length > 0) {
            const ultimaData = datasCalculadas[datasCalculadas.length - 1];
            texto += ` (${datasCalculadas.length} plantões até ${window.Utils.formatarDataBR(ultimaData)})`;
        }
    }
      // Adiciona preview das próximas datas
    if (datasCalculadas.length > 0) {
        texto += '<br><small style="color: #888;">Próximas datas: ';
        const proximasDatas = datasCalculadas.slice(0, 3).map(d => window.Utils.formatarDataBR(d));
        texto += proximasDatas.join(', ');
        if (datasCalculadas.length > 3) {
            texto += `, ... (+${datasCalculadas.length - 3} mais)`;
        }
        texto += '</small>';
    }
    
    info.innerHTML = texto;
}

// Sempre que o valor cheio ou tempo mudar, calcula o valorHora automaticamente se o checkbox estiver marcado
document.getElementById('valorCheio').addEventListener('input', function() {
    const tempo = parseFloat(document.getElementById('tempoPlantao').value);
    const valorCheio = parseFloat(this.value);
    const valorHoraInput = document.getElementById('valorHora');
    if (!isNaN(tempo) && tempo > 0 && !isNaN(valorCheio)) {
        valorHoraInput.value = (valorCheio / tempo).toFixed(2);
    }
});
document.getElementById('tempoPlantao').addEventListener('input', function() {
    const tempo = parseFloat(this.value);
    const valorCheio = parseFloat(document.getElementById('valorCheio').value);
    const valorHoraInput = document.getElementById('valorHora');
    if (document.getElementById('valorCheioCheck').checked && !isNaN(tempo) && tempo > 0 && !isNaN(valorCheio)) {
        valorHoraInput.value = (valorCheio / tempo).toFixed(2);
    }
});

// adiciona esta função no mesmo <script> (logo após mostrarSecao ou onde ficar melhor)
function setResumoDefaults() {
    const now = new Date();
    const mes = String(now.getMonth() + 1); // valores das options: "1".."12"
    const ano = String(now.getFullYear());

    const mesSelect = document.getElementById('mesResumo');
    const anoSelect = document.getElementById('anoResumo');

    if (mesSelect) {
        mesSelect.value = mes;
    }
    if (anoSelect) {
        // adiciona o ano nas options caso não exista (ex.: ano futuro)
        const exists = Array.from(anoSelect.options).some(opt => opt.value === ano);
        if (!exists) {
            const opt = document.createElement('option');
            opt.value = ano;
            opt.text = ano;
            anoSelect.appendChild(opt);
        }
        anoSelect.value = ano;
    }
}

/* --- Adicionado: função para atualizar o resumo total --- */
function atualizarResumoTotal(resumoPorLocal) {
    let totalHoras = 0;
    let totalValor = 0;

    Object.keys(resumoPorLocal).forEach(local => {
        totalHoras += resumoPorLocal[local].horas;
        totalValor += resumoPorLocal[local].valor;
    });

    document.getElementById('totalHoras').textContent = totalHoras;
    document.getElementById('totalValor').textContent = totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

/* --- Modificação da função abrirPopupResumo --- */
async function abrirPopupResumo(plantaoId) {
    try {
        const doc = await db.collection("plantoes").doc(plantaoId).get();
        const plantao = doc.data();

        if (!plantao) {
            alert("Plantão não encontrado!");
            return;
        }

        const user = firebase.auth().currentUser;
        const isContador = user.email === 'contador@contador.com';

        const confirmacao = `
            <div style="text-align: center;">
                <p><strong>Data:</strong> ${plantao.data.split('-').reverse().join('/')}</p>
                <p><strong>Local:</strong> ${plantao.local}</p>
                <p><strong>Valor por Hora:</strong> R$ ${plantao.valorHora}</p>
                <p><strong>Valor Total:</strong> R$ ${plantao.valorTotal}</p>
                <p><strong>Observações:</strong> ${plantao.observacoes || 'Nenhuma'}</p>
                <button onclick="editarPlantao('${plantaoId}', 'resumo')">✏️ Editar</button>
                ${!isContador ? `<button onclick="excluirPlantao('${plantaoId}')">🗑️ Excluir</button>` : ''}
                <button onclick="fecharPopup()">Cancelar</button>
            </div>
        `;

        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.background = 'white';
        modal.style.padding = '20px';
        modal.style.borderRadius = '8px';
        modal.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
        modal.style.zIndex = '9999'; // Garante que o modal fique acima de outros elementos
        modal.innerHTML = confirmacao;

        modal.id = 'popupModal'; // Adiciona um ID ao modal para facilitar a manipulação
        document.body.appendChild(modal);
    } catch (error) {
        console.error("Erro ao buscar plantão:", error);
        alert("Erro ao buscar informações do plantão.");
    }
}

/* --- Adicionada função excluirPlantao --- */
async function excluirPlantao(plantaoId) {
    try {
        const confirmacao = confirm("Tem certeza que deseja excluir este plantão?");
        if (!confirmacao) return;

        await db.collection("plantoes").doc(plantaoId).delete();

        // Remove o popup após exclusão
        fecharPopup();

        // Redireciona para a tela de bem-vindo
        mostrarSecao('inicio');
    } catch (error) {
        console.error("Erro ao excluir plantão:", error);
    }
}

/* --- Função para Carregar Consolidado Anual --- */
async function carregarConsolidado() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            alert('Você precisa estar logado.');
            return;
        }

        const anoSelect = document.getElementById('anoConsolidado');
        const ano = anoSelect ? anoSelect.value : new Date().getFullYear().toString();
        
        const snapshot = await db.collection("plantoes").where("userId", "==", user.uid).get();
        const plantoes = [];
        const meses = {};
        const unidades = {};
        
        // Processar plantões do ano selecionado
        snapshot.forEach(doc => {
            const p = doc.data();
            if (p.data && p.data.startsWith(ano)) {
                plantoes.push(p);
                
                const mesStr = p.data.substring(5, 7);
                const mes = parseInt(mesStr);
                const local = p.local || 'Sem local';
                const horas = Number(p.tempoPlantao) || 0;
                const valorTotal = p.valorTotal !== undefined ? Number(p.valorTotal) : 0;
                
                // Agregação por mês
                if (!meses[mes]) {
                    meses[mes] = { plantoes: 0, horas: 0, valor: 0 };
                }
                meses[mes].plantoes++;
                meses[mes].horas += horas;
                meses[mes].valor += valorTotal;
                
                // Agregação por unidade
                if (!unidades[local]) {
                    unidades[local] = { plantoes: 0, horas: 0, valor: 0 };
                }
                unidades[local].plantoes++;
                unidades[local].horas += horas;
                unidades[local].valor += valorTotal;
            }
        });
        
        // Calcular totais
        let totalHoras = 0, totalValor = 0, totalPlantoes = 0;
        Object.values(meses).forEach(m => {
            totalHoras += m.horas;
            totalValor += m.valor;
            totalPlantoes += m.plantoes;
        });
        
        const mediaHora = totalHoras > 0 ? (totalValor / totalHoras).toFixed(2) : '0.00';
        
        // Atualizar resumo total
        document.getElementById('consolidadoTotalHoras').textContent = totalHoras.toFixed(1);
        document.getElementById('consolidadoTotalValor').textContent = totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        document.getElementById('consolidadoMediaHora').textContent = mediaHora;
        document.getElementById('consolidadoPlantoes').textContent = totalPlantoes;
        
        // Renderizar tabela de unidades
        renderizarTabelaUnidades(unidades);
        
        // Renderizar tabela de meses
        renderizarTabelaMeses(meses);
        
        // Renderizar gráficos
        renderizarGraficos(meses, unidades);
        
    } catch (erro) {
        console.error('Erro ao carregar consolidado:', erro);
        alert('Erro ao carregar consolidado.');
    }
}

function renderizarTabelaUnidades(unidades) {
    const tbody = document.getElementById('consolidadoTabelaCorpo');
    let html = '';
    
    Object.keys(unidades).sort().forEach(unidade => {
        const u = unidades[unidade];
        const mediaHora = u.horas > 0 ? (u.valor / u.horas).toFixed(2) : '0.00';
        html += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px; text-align: left;">${unidade}</td>
                <td style="padding: 12px; text-align: center;">${u.plantoes}</td>
                <td style="padding: 12px; text-align: center;">${u.horas.toFixed(1)}</td>
                <td style="padding: 12px; text-align: right;">R$ ${u.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td style="padding: 12px; text-align: right;">R$ ${mediaHora}</td>
            </tr>
        `;
    });
    
    if (html === '') {
        html = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #999;">Nenhum dado</td></tr>';
    }
    
    tbody.innerHTML = html;
}

function renderizarTabelaMeses(meses) {
    const tbody = document.getElementById('consolidadoTabelaMeses');
    const mesesNomes = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    let html = '';
    
    for (let mes = 1; mes <= 12; mes++) {
        if (meses[mes]) {
            const m = meses[mes];
            html += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 12px; text-align: left;">${mesesNomes[mes]}</td>
                    <td style="padding: 12px; text-align: center;">${m.plantoes}</td>
                    <td style="padding: 12px; text-align: center;">${m.horas.toFixed(1)}</td>
                    <td style="padding: 12px; text-align: right;">R$ ${m.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
            `;
        }
    }
    
    if (html === '') {
        html = '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #999;">Nenhum dado</td></tr>';
    }
    
    tbody.innerHTML = html;
}

function renderizarGraficos(meses, unidades) {
    // Gráfico de evolução mensal
    const mesesLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const mesesData = [];
    for (let i = 1; i <= 12; i++) {
        mesesData.push(meses[i] ? meses[i].valor : 0);
    }
    
    const ctxEvolucao = document.getElementById('chartEvolucao');
    if (window.chartEvolucaoInstance) {
        window.chartEvolucaoInstance.destroy();
    }
    window.chartEvolucaoInstance = new Chart(ctxEvolucao, {
        type: 'line',
        data: {
            labels: mesesLabels,
            datasets: [{
                label: 'Valor Mensal (R$)',
                data: mesesData,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
    
    // Gráfico de unidades (pie chart - valor)
    const unidadesLabels = Object.keys(unidades).sort();
    const unidadesData = unidadesLabels.map(u => unidades[u].valor);
    
    const ctxUnidades = document.getElementById('chartUnidades');
    if (window.chartUnidadesInstance) {
        window.chartUnidadesInstance.destroy();
    }
    window.chartUnidadesInstance = new Chart(ctxUnidades, {
        type: 'doughnut',
        data: {
            labels: unidadesLabels,
            datasets: [{
                data: unidadesData,
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
    
    // Gráfico de horas por unidade (bar chart)
    const horasData = unidadesLabels.map(u => unidades[u].horas);
    
    const ctxHoras = document.getElementById('chartHoras');
    if (window.chartHorasInstance) {
        window.chartHorasInstance.destroy();
    }
    window.chartHorasInstance = new Chart(ctxHoras, {
        type: 'bar',
        data: {
            labels: unidadesLabels,
            datasets: [{
                label: 'Horas Trabalhadas',
                data: horasData,
                backgroundColor: '#2196F3'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            }
        }
    });
}
    

        function isMobileDevice() {
            return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }

        function ajustarCalendarioMobile() {
            if (!isMobileDevice()) return;
            
            try {
                // Em dispositivos móveis, força altura automática sem barras de rolagem
                $('#calendar').fullCalendar('option', 'height', 'auto');
                $('#calendar').fullCalendar('option', 'aspectRatio', 1.1);
                $('#calendar').fullCalendar('render');
                
                // Remove qualquer overflow dos containers do FullCalendar
                $('.fc-view-container, .fc-view, .fc-month-view').css({
                    'overflow': 'visible',
                    'height': 'auto'
                });
            } catch (e) {
                console.warn('Não foi possível ajustar calendário mobile:', e);
            }
        }

        // Aguarda orientação e redimensionamento
        window.addEventListener('orientationchange', function(){ 
            setTimeout(ajustarCalendarioMobile, 600); 
        });
        
        window.addEventListener('resize', function(){ 
            setTimeout(ajustarCalendarioMobile, 300); 
        });

        // Executa após carregamento completo do calendário
        $(document).ready(function(){
            setTimeout(ajustarCalendarioMobile, 800);
        });
        
        // Expose functions to window for onclick handlers in HTML
        window.mostrarSecao = mostrarSecao;
        window.filtrarResumo = filtrarResumo;
        window.fecharPopup = fecharPopup;
        window.editarPlantao = editarPlantao;
        window.excluirPlantao = excluirPlantao;
        window.abrirPopupResumo = abrirPopupResumo;
        // atualizarCalendario já está em window (definida na linha 251)
    })();