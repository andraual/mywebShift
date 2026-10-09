(function() {
        console.log('app.js loaded. window.Utils:', !!window.Utils, 'window.CONFIG:', !!window.CONFIG);

        const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        let resumoMes = new Date().getMonth() + 1;
        let resumoAno = new Date().getFullYear();
        
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
                setResumoDefaults();
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
                        if (btn.getAttribute('data-section') !== 'resumo') {
                            btn.style.display = 'none';
                        } else {
                            btn.style.display = 'flex';
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
                        const horas = window.Utils.numero(p.tempoPlantao);
                        eventos.push({
                            id: doc.id,
                            title: `Plantão - ${p.local}`,
                            start: `${p.data}T${p.horaInicio}`,
                            end: moment(`${p.data}T${p.horaInicio}`).add(horas, 'hours').format('YYYY-MM-DDTHH:mm'),
                            local: p.local,
                            valorHora: window.Utils.numero(p.valorHora),
                            horas: horas,
                            // Prefere valorTotal gravado; senão calcula (tolerante a string/número)
                            total: (p.valorTotal != null ? window.Utils.numero(p.valorTotal) : (window.Utils.numero(p.valorHora) * horas)).toFixed(2),
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
                dayClick: function(date, jsEvent, view) {
                    // Formata a data no formato YYYY-MM-DD
                    const dataFormatada = date.format('YYYY-MM-DD');
                    const dataExibicao = date.format('DD/MM/YYYY');
                    
                    // Cria o modal de confirmação
                    const confirmacao = `
                        <div class="popup-content" style="text-align: center;">
                            <p style="font-size: 18px; margin-bottom: 20px;">📅 Deseja cadastrar um plantão para o dia <strong>${dataExibicao}</strong>?</p>
                            <div class="popup-actions">
                                <button class="popup-btn" onclick="cadastrarPlantaoComData('${dataFormatada}')">✅ Sim, cadastrar</button>
                                <button class="popup-btn" onclick="fecharPopup()">❌ Cancelar</button>
                            </div>
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
                    modal.style.width = 'calc(100vw - 40px)';
                    modal.style.maxWidth = '420px';
                    modal.innerHTML = confirmacao;
                    modal.id = 'popupModal';
                    
                    // Adiciona backdrop
                    const backdrop = document.createElement('div');
                    backdrop.id = 'popupBackdrop';
                    backdrop.style.position = 'fixed';
                    backdrop.style.top = '0';
                    backdrop.style.left = '0';
                    backdrop.style.width = '100%';
                    backdrop.style.height = '100%';
                    backdrop.style.background = 'rgba(0,0,0,0.5)';
                    backdrop.style.zIndex = '9998';
                    backdrop.onclick = fecharPopup;
                    document.body.appendChild(backdrop);
                    document.body.appendChild(modal);
                },
                eventClick: function(calEvent, jsEvent, view) {
                    const esc = window.Utils.escaparHtml;
                    const confirmacao = `
                        <div class="popup-content" style="text-align: center;">
                            <p><strong>Plantão:</strong> ${esc(calEvent.title)}</p>
                            <p><strong>Local:</strong> ${esc(calEvent.local)}</p>
                            <p><strong>Hora de início:</strong> ${esc(calEvent.horaInicio || '—')}</p>
                            <p><strong>Horas trabalhadas:</strong> ${window.Utils.numero(calEvent.horas)} h</p>
                            <p><strong>Valor por hora:</strong> R$ ${window.Utils.numero(calEvent.valorHora).toFixed(2)}</p>
                            <p><strong>Total:</strong> R$ ${window.Utils.numero(calEvent.total).toFixed(2)}</p>
                            ${calEvent.observacoes ? `<p><strong>Observações:</strong> ${esc(calEvent.observacoes)}</p>` : ''}
                            <div class="popup-actions">
                                <button class="popup-btn" onclick="editarPlantao('${calEvent.id}')">✏️ Editar</button>
                                <button class="popup-btn" onclick="excluirPlantao('${calEvent.id}')">🗑️ Excluir</button>
                                <button class="popup-btn" onclick="fecharPopup()">Cancelar</button>
                            </div>
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
                    modal.style.width = 'calc(100vw - 40px)';
                    modal.style.maxWidth = '520px';
                    modal.innerHTML = confirmacao;

                    modal.id = 'popupModal'; // Adiciona um ID ao modal para facilitar a manipulação
                    
                    // Adiciona backdrop e fecha ao clicar fora
                    const backdrop = document.createElement('div');
                    backdrop.id = 'popupBackdrop';
                    backdrop.style.position = 'fixed';
                    backdrop.style.top = '0';
                    backdrop.style.left = '0';
                    backdrop.style.width = '100%';
                    backdrop.style.height = '100%';
                    backdrop.style.background = 'rgba(0,0,0,0.5)';
                    backdrop.style.zIndex = '9998';
                    backdrop.onclick = fecharPopup;
                    document.body.appendChild(backdrop);
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
                const mes = String(resumoMes).padStart(2, '0');
                const ano = String(resumoAno);
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
                            const horas = window.Utils.numero(p.tempoPlantao);
                            const valorHora = window.Utils.numero(p.valorHora);
                            const valorTotal = (p.valorTotal != null) ? window.Utils.numero(p.valorTotal) : (horas * valorHora);
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
                            horaInicio: p.horaInicio || '',
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
                            <h3>${window.Utils.escaparHtml(local)}</h3>
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
                // Guarda dados do período atual para exportação (CSV/PDF/ICS)
                window.__resumoAtual = { mes: parseInt(mes), ano: ano, resumoPorLocal };
            } catch (erro) {
                console.error('Erro ao filtrar resumo:', erro);
                mostrarErro('Erro ao carregar resumo financeiro. Tente novamente.');
            }
        }

        // Garante/atualiza o perfil em usuarios/{uid} após login (email ou Google)
        async function garantirPerfil(user) {
            if (!user) return;
            try {
                const nome = user.displayName || user.email || 'Usuário';
                await db.collection('usuarios').doc(user.uid).set({
                    nome: nome,
                    email: user.email || '',
                    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                    ultimoAcesso: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch (erro) {
                console.error('Erro ao garantir perfil do usuário:', erro);
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
                const cred = await auth.signInWithEmailAndPassword(email, senha);
                await garantirPerfil(cred.user);
                console.log('Login bem-sucedido!');
                // O onAuthStateChanged já cuida da navegação
            } catch (error) {
                console.error('Erro de login:', error.code, error.message);
                
                // Mensagens de erro mais específicas
                let mensagem = 'E-mail ou senha inválidos.';
                if (error.code === 'auth/user-not-found') {
                    mensagem = 'Usuário não encontrado. Crie uma nova conta.';
                } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-login-credentials' || error.code === 'auth/invalid-credential') {
                    mensagem = 'E-mail ou senha inválidos.';
                } else if (error.code === 'auth/invalid-email') {
                    mensagem = 'E-mail inválido.';
                } else if (error.code === 'auth/user-disabled') {
                    mensagem = 'Usuário desabilitado.';
                } else if (error.code === 'auth/operation-not-allowed') {
                    mensagem = 'O login com e-mail/senha não está habilitado no Firebase.';
                } else if (error.code === 'auth/account-exists-with-different-credential') {
                    mensagem = 'Já existe uma conta com este e-mail usando outro método de login.';
                } else if (error.code === 'auth/too-many-requests') {
                    mensagem = 'Muitas tentativas. Tente mais tarde.';
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
                const cred = await auth.signInWithPopup(provider);
                await garantirPerfil(cred.user);
                console.log('Login com Google bem-sucedido!');
            } catch (error) {
                console.error('Erro no login com Google:', error.code, error.message);
                let mensagem = 'Erro ao fazer login com Google.';
                if (error.code === 'auth/popup-closed-by-user') {
                    mensagem = 'Login cancelado.';
                } else if (error.code === 'auth/network-request-failed') {
                    mensagem = 'Erro de conexão.';
                } else if (error.code === 'auth/operation-not-allowed') {
                    mensagem = 'O login com Google não está habilitado no Firebase.';
                } else if (error.code === 'auth/account-exists-with-different-credential') {
                    mensagem = 'Já existe uma conta com este e-mail usando outro método de login. Use a tela de login com e-mail e senha.';
                } else if (error.code === 'auth/too-many-requests') {
                    mensagem = 'Muitas tentativas. Tente mais tarde.';
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

                // Atualiza o nome de exibição para refletir o cadastro
                try { await user.updateProfile({ displayName: nome }); } catch (e) { /* opcional */ }

                // Salvar nome no Firestore (timestamps do servidor)
                await db.collection('usuarios').doc(user.uid).set({
                    nome: nome,
                    email: email,
                    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                    ultimoAcesso: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                
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
                } else if (error.code === 'auth/operation-not-allowed') {
                    mensagem = 'O cadastro com e-mail/senha não está habilitado no Firebase.';
                } else if (error.code === 'auth/account-exists-with-different-credential') {
                    mensagem = 'Já existe uma conta com este e-mail usando outro método de login.';
                } else if (error.code === 'auth/too-many-requests') {
                    mensagem = 'Muitas tentativas. Tente mais tarde.';
                } else {
                    mensagem = `Erro [${error.code}]: ${error.message}`;
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

        // Função para adicionar anos dinamicamente aos selects (Resumo e Consolidado)
        function adicionarAnoAoResumo(ano) {
            const anoString = String(ano);
            ['anoResumo', 'anoConsolidado'].forEach(id => {
                const anoSelect = document.getElementById(id);
                if (!anoSelect) return;
                const exists = Array.from(anoSelect.options).some(opt => opt.value === anoString);
                if (exists) return;
                const opt = document.createElement('option');
                opt.value = anoString;
                opt.text = anoString;
                anoSelect.appendChild(opt);
                // Ordena as opções numericamente
                const opcoes = Array.from(anoSelect.options);
                opcoes.sort((a, b) => Number(a.value) - Number(b.value));
                anoSelect.innerHTML = '';
                opcoes.forEach(o => anoSelect.appendChild(o));
            });
        }
        
        // Cache simples
        const cache = {
            plantoes: null,
            timestamp: null,
            TTL: window.CONFIG.CACHE_TTL
        };

        function invalidarCachePlantoes() {
            cache.plantoes = null;
            cache.timestamp = null;
        }

        async function sincronizarDadosAposSalvar() {
            invalidarCachePlantoes();

            if (window.atualizarCalendario) {
                await window.atualizarCalendario();
            }

            const resumoEl = document.getElementById('resumo');
            if (resumoEl && resumoEl.style.display !== 'none') {
                filtrarResumo();
            }

            const consolidadoEl = document.getElementById('consolidado');
            if (consolidadoEl && consolidadoEl.style.display !== 'none') {
                carregarConsolidado();
            }
        }

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

        function formatarDataISO(data) {
            const dia = String(data.getDate()).padStart(2, '0');
            const mes = String(data.getMonth() + 1).padStart(2, '0');
            const ano = data.getFullYear();
            return `${ano}-${mes}-${dia}`;
        }

        // Função auxiliar para obter a posição da semana no mês (1ª, 2ª, 3ª, 4ª, 5ª)
        // Função para calcular datas de recorrência
        function calcularDatasRecorrencia() {
            const dataValue = document.getElementById('data').value;
            if (!dataValue) return [];

            // Parse manual para garantir criação em horário local (evita problemas com new Date('YYYY-MM-DD'))
            const [anoIni, mesIni, diaIni] = dataValue.split('-').map(Number);
            const dataInicial = new Date(anoIni, mesIni - 1, diaIni);

            const tipo = document.getElementById('tipoRecorrencia').value;
            const quantidade = parseInt(document.getElementById('quantidadeRecorrencia').value) || 4;
            const dataFimInput = document.getElementById('dataFim').value;
            let dataFim = null;
            if (dataFimInput) {
                const [anoF, mesF, diaF] = dataFimInput.split('-').map(Number);
                dataFim = new Date(anoF, mesF - 1, diaF);
            }

            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0); // Remove horário para comparar apenas datas
            
            const datas = [];
            const diaSemana = dataInicial.getDay(); // 0=Domingo, 1=Segunda, etc.

            // Helper para clonar apenas a parte da data (sem horário)
            const cloneDateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

            if (tipo === 'semanal') {
                // Semanal: toda semana no mesmo dia
                let dataAtual = cloneDateOnly(dataInicial);
                
                for (let i = 0; i < quantidade; i++) {
                    if (dataFim && dataAtual > dataFim) break;
                    if (dataAtual >= hoje) {
                        datas.push(cloneDateOnly(dataAtual));
                    }
                    dataAtual.setDate(dataAtual.getDate() + 7);
                }
                
            } else if (tipo === 'quinzenal') {
                // Quinzenal: semana sim, semana não (a cada 14 dias)
                let dataAtual = cloneDateOnly(dataInicial);
                
                for (let i = 0; i < quantidade; i++) {
                    if (dataFim && dataAtual > dataFim) break;
                    if (dataAtual >= hoje) {
                        datas.push(cloneDateOnly(dataAtual));
                    }
                    dataAtual.setDate(dataAtual.getDate() + 14);
                }
                  } else if (tipo === 'mensal') {
                // Mensal: mesma posição da semana no mês (ex: toda 3ª quarta-feira)
                const posicaoSemana = window.Utils.obterPosicaoSemanaNoMes(dataInicial);
                let mesAtual = dataInicial.getMonth();
                let anoAtual = dataInicial.getFullYear();
                let plantoesCriados = 0;
                
                // Primeiro, adiciona a data inicial se for válida e dentro do limite
                if (dataInicial >= hoje && (!dataFim || dataInicial <= dataFim)) {
                    datas.push(cloneDateOnly(dataInicial));
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
                    
                    datas.push(cloneDateOnly(dataCalculada));
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
            document.getElementById('tempoPlantao').value = window.Utils.numero(plantao.tempoPlantao);
            document.getElementById('local').value = plantao.local;
            document.getElementById('valorHora').value = window.Utils.numero(plantao.valorHora);
            document.getElementById('observacoes').value = plantao.observacoes || '';

            // Carrega valor cheio se existir
            if (plantao.valorCheio != null) {
                document.getElementById('valorCheioCheck').checked = true;
                document.getElementById('valorCheio').value = window.Utils.numero(plantao.valorCheio);
                document.getElementById('valorCheioGroup').style.display = 'block';
                document.getElementById('valorHora').disabled = true;
            }

            // Carrega bônus se existir
            if (plantao.valorBonus != null) {
                document.getElementById('bonusCheck').checked = true;
                document.getElementById('valorBonus').value = window.Utils.numero(plantao.valorBonus);
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

            // Cálculo centralizado (mesma regra do app: valorCheio tem prioridade)
            const bonusValor = bonusCheck && valorBonus ? window.Utils.numero(valorBonus) : 0;
            const calculo = window.Utils.calcularValorTotal(
                valorHora,
                tempoPlantao,
                valorCheioCheck ? valorCheio : null,
                bonusValor
            );
            let valorHoraFinal = calculo.valorHora;
            let valorTotal = calculo.valorTotal;

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
                    // Guarda última atualização para sugestão de calendário (mobile)
                    window.__ultimoPlantaoSalvo = {
                        data,
                        horaInicio,
                        tempoPlantao: Number(tempoPlantao),
                        local,
                        observacoes,
                        valorHora: Number(valorHoraFinal)
                    };
                    plantaoEditandoId = null;
                    
                    exibirPopupSucesso("Plantão atualizado com sucesso!", 1);
                    await sincronizarDadosAposSalvar();
                } else {
                    // Modo criação - verifica recorrência
                    if (recorrenteCheck) {
                        const datas = calcularDatasRecorrencia();
                        let plantoesCriados = 0;
                        
                        const localOption = document.getElementById('local').selectedOptions[0];
                        const vhFds = localOption ? localOption.dataset.valorHoraFimSemana : undefined;

                        for (const dataPlantao of datas) {
                            const dataFormatada = formatarDataISO(dataPlantao);
                            
                            // Recalcula valor por hora para cada data (regra de fds centralizada)
                            let valorHoraData = valorHoraFinal;
                            if (!valorCheioCheck) {
                                valorHoraData = window.Utils.calcularValorHoraPara(local, dataFormatada, valorHoraFinal, vhFds);
                            }

                            const calcData = window.Utils.calcularValorTotal(
                                valorHoraData,
                                tempoPlantao,
                                valorCheioCheck ? valorCheio : null,
                                bonusValor
                            );

                            const plantao = {
                                data: dataFormatada,
                                horaInicio,
                                tempoPlantao,
                                local,
                                valorHora: calcData.valorHora,
                                valorCheio: valorCheioCheck && valorCheio ? Number(valorCheio) : null,
                                valorBonus: bonusCheck && valorBonus ? Number(valorBonus) : null,
                                valorTotal: calcData.valorTotal,
                                observacoes: [observacoes, '(Recorrente)'].filter(Boolean).join(' '),
                                userId: user.uid
                            };

                            await db.collection("plantoes").add(plantao);
                            plantoesCriados++;
                        }
                        
                        console.log(`${plantoesCriados} plantões recorrentes cadastrados!`);
                        exibirPopupSucesso(`${plantoesCriados} plantões recorrentes cadastrados com sucesso!`, plantoesCriados);
                        await sincronizarDadosAposSalvar();
                        
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
                        // Guarda última criação para sugestão de calendário (mobile)
                        window.__ultimoPlantaoSalvo = {
                            data,
                            horaInicio,
                            tempoPlantao: Number(tempoPlantao),
                            local,
                            observacoes,
                            valorHora: Number(valorHoraFinal)
                        };
                        exibirPopupSucesso("Plantão cadastrado com sucesso!", 1);
                        await sincronizarDadosAposSalvar();
                        
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
                <div class="popup-content" style="text-align: center;">
                    <p>${mensagem}</p>
                    ${quantidade > 1 ? `<p style="color: #666; font-size: 14px;">Você pode ver todos os plantões no calendário</p>` : ''}
                    <div class="popup-actions">
                        <button class="popup-btn" onclick="fecharPopup(); mostrarSecao('cadastro');">Novo Plantão</button>
                        <button class="popup-btn" onclick="fecharPopup(); mostrarSecao('calendario');">Ver Calendário</button>
                        <button class="popup-btn" onclick="fecharPopup(); mostrarSecao('inicio');">Início</button>
                        ${quantidade === 1 && window.isMobileDevice && window.isMobileDevice() && window.__ultimoPlantaoSalvo ? `
                            <button class="popup-btn" onclick="adicionarAoCalendarioGoogle()">Adicionar no Google Calendar</button>
                            <button class="popup-btn" onclick="baixarICSPlantao()">Baixar .ics (Apple/Outlook)</button>
                        ` : ''}
                    </div>
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
            modal.style.width = 'calc(100vw - 40px)';
            modal.style.maxWidth = '520px';
            modal.id = 'popupModal';
            
            // Adiciona backdrop e fecha ao clicar fora
            const backdrop = document.createElement('div');
            backdrop.id = 'popupBackdrop';
            backdrop.style.position = 'fixed';
            backdrop.style.top = '0';
            backdrop.style.left = '0';
            backdrop.style.width = '100%';
            backdrop.style.height = '100%';
            backdrop.style.background = 'rgba(0,0,0,0.5)';
            backdrop.style.zIndex = '9998';
            backdrop.onclick = fecharPopup;
            document.body.appendChild(backdrop);
            document.body.appendChild(modal);
        }

        // Detecta se é dispositivo móvel
        window.isMobileDevice = function() {
            return /Mobi|Android/i.test(navigator.userAgent) || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
        };

        // Formata datas para Google Calendar (UTC)
        function formatGoogleDates(plantao) {
            const start = new Date(`${plantao.data}T${plantao.horaInicio}`);
            const end = new Date(start.getTime() + window.Utils.numero(plantao.tempoPlantao) * 60 * 60 * 1000);
            const toGoogle = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
            return { start: toGoogle(start), end: toGoogle(end) };
        }

        // Abre Google Calendar com evento pré-preenchido
        window.adicionarAoCalendarioGoogle = function() {
            const p = window.__ultimoPlantaoSalvo;
            if (!p) { alert('Nenhum plantão encontrado para adicionar.'); return; }
            const { start, end } = formatGoogleDates(p);
            const text = encodeURIComponent(`Plantão - ${p.local}`);
            const details = encodeURIComponent(`Horas: ${window.Utils.numero(p.tempoPlantao)}\nValor/hora: R$ ${window.Utils.numero(p.valorHora)}${p.observacoes ? `\nObs: ${p.observacoes}` : ''}`);
            const location = encodeURIComponent(p.local);
            const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}%2F${end}&details=${details}&location=${location}`;
            window.open(url, '_blank');
        };

        // Escapa texto para o formato ICS (vírgula, ponto e vírgula, barra e nova linha)
        function escaparICS(texto) {
            return String(texto || '')
                .replace(/\\/g, '\\\\')
                .replace(/;/g, '\\;')
                .replace(/,/g, '\\,')
                .replace(/\r?\n/g, '\\n');
        }

        // Gera conteúdo ICS para um plantão OU uma lista de plantões (um VEVENT cada)
        function gerarICSConteudo(entrada) {
            const lista = Array.isArray(entrada) ? entrada : [entrada];
            const now = new Date();
            const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
            const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//mywebShift//EN'];

            lista.forEach((plantao, idx) => {
                if (!plantao || !plantao.data || !plantao.horaInicio) return;
                const uid = `${Date.now()}-${idx}-${Math.random().toString(36).slice(2)}@mywebshift`;
                const horas = window.Utils.numero(plantao.tempoPlantao);
                const start = new Date(`${plantao.data}T${plantao.horaInicio}`);
                const end = new Date(start.getTime() + horas * 60 * 60 * 1000);
                const local = plantao.local || 'Plantão';
                const descricao = `Horas: ${horas}\nValor/hora: R$ ${window.Utils.numero(plantao.valorHora)}${plantao.observacoes ? `\nObs: ${plantao.observacoes}` : ''}`;
                lines.push(
                    'BEGIN:VEVENT',
                    `UID:${uid}`,
                    `DTSTAMP:${fmt(now)}`,
                    `DTSTART:${fmt(start)}`,
                    `DTEND:${fmt(end)}`,
                    `SUMMARY:${escaparICS('Plantão - ' + local)}`,
                    `DESCRIPTION:${escaparICS(descricao)}`,
                    `LOCATION:${escaparICS(local)}`,
                    'END:VEVENT'
                );
            });

            lines.push('END:VCALENDAR');
            return lines.join('\r\n');
        }

        // Compatibilidade: gera ICS de um único plantão
        function gerarICS(plantao) {
            return gerarICSConteudo([plantao]);
        }

        // Baixa arquivo .ics
        window.baixarICSPlantao = function() {
            const p = window.__ultimoPlantaoSalvo;
            if (!p) { alert('Nenhum plantão encontrado para adicionar.'); return; }
            const ics = gerarICS(p);
            const nome = `plantao_${p.data}_${(p.local || 'local').replace(/\s+/g, '_')}.ics`;
            window.Utils.baixarArquivo(nome, ics, 'text/calendar;charset=utf-8');
        };

        // Função para fechar o popup
        function fecharPopup() {
            const modal = document.getElementById('popupModal');
            const backdrop = document.getElementById('popupBackdrop');
            if (modal) {
                document.body.removeChild(modal);
            }
            if (backdrop) {
                document.body.removeChild(backdrop);
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
    
    const [anoI, mesI, diaI] = data.split('-').map(Number);
    const dataInicial = new Date(anoI, mesI - 1, diaI); // horário local (evita fuso)
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
        const [anoF2, mesF2, diaF2] = dataFim.split('-').map(Number);
        const dataLimite = new Date(anoF2, mesF2 - 1, diaF2); // horário local
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
function atualizarLabelResumo() {
    const el = document.getElementById('mesResumoLabel');
    if (el) el.innerHTML = window.Utils.escaparHtml(`${MESES_PT[resumoMes - 1]} ${resumoAno}`);
}

function navegarResumo(delta) {
    resumoMes += delta;
    if (resumoMes > 12) {
        resumoMes = 1;
        resumoAno++;
    } else if (resumoMes < 1) {
        resumoMes = 12;
        resumoAno--;
    }
    atualizarLabelResumo();
    filtrarResumo();
}

function setResumoDefaults() {
    const now = new Date();
    resumoMes = now.getMonth() + 1;
    resumoAno = now.getFullYear();
    atualizarLabelResumo();

    // Pré-seleciona o ano atual no select do Consolidado
    const anoSelect = document.getElementById('anoConsolidado');
    if (anoSelect) {
        const ano = String(resumoAno);
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
        const esc = window.Utils.escaparHtml;

        const confirmacao = `
            <div style="text-align: center;">
                <p><strong>Data:</strong> ${esc(plantao.data.split('-').reverse().join('/'))}</p>
                <p><strong>Local:</strong> ${esc(plantao.local)}</p>
                <p><strong>Valor por Hora:</strong> ${window.Utils.toBRL(plantao.valorHora)}</p>
                <p><strong>Valor Total:</strong> ${window.Utils.toBRL(plantao.valorTotal)}</p>
                <p><strong>Observações:</strong> ${esc(plantao.observacoes || 'Nenhuma')}</p>
                ${!isContador ? `<button onclick="editarPlantao('${plantaoId}', 'resumo')">✏️ Editar</button>
                <button onclick="excluirPlantao('${plantaoId}')">🗑️ Excluir</button>` : ''}
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

        await sincronizarDadosAposSalvar();

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
                const horas = window.Utils.numero(p.tempoPlantao);
                const valorTotal = p.valorTotal != null ? window.Utils.numero(p.valorTotal) : 0;
                
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

        // Guarda dados do ano atual para exportação (CSV/PDF)
        window.__consolidadoAtual = { ano, meses, unidades, totalHoras, totalValor, totalPlantoes, mediaHora };

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
                <td style="padding: 12px; text-align: left;">${window.Utils.escaparHtml(unidade)}</td>
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
        
        // Função para cadastrar plantão com data pré-preenchida
        function cadastrarPlantaoComData(data) {
            // Fecha o popup
            fecharPopup();
            
            // Limpa o formulário
            document.getElementById('plantaoForm').reset();
            
            // Preenche o campo de data
            document.getElementById('data').value = data;
            
            // Reseta variáveis de edição
            plantaoEditandoId = null;
            
            // Atualiza o título
            document.querySelector('#cadastro h2').textContent = 'Cadastrar Novo Plantão';
            
            // Reabilita recorrência
            document.getElementById('recorrenteCheck').disabled = false;
            
            // Navega para a seção de cadastro
            mostrarSecao('cadastro');
        }
        
        /* ==================== EXPORTAÇÃO (CSV / PDF / ICS) ==================== */

        // Exibe/oculta o menu de exportação
        window.toggleExportMenu = function(id) {
            const menu = document.getElementById(id);
            if (!menu) return;
            const aberto = menu.classList.contains('show');
            document.querySelectorAll('.export-menu.show').forEach(m => m.classList.remove('show'));
            if (!aberto) menu.classList.add('show');
        };
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.export-dropdown')) {
                document.querySelectorAll('.export-menu.show').forEach(m => m.classList.remove('show'));
            }
        });

        // Formata número para CSV pt-BR (vírgula decimal)
        function csvNumero(n, casas) {
            const c = (casas === undefined) ? 2 : casas;
            return window.Utils.numero(n).toFixed(c).replace('.', ',');
        }

        // Impressão (PDF) isolando a seção ativa
        function imprimirSecao(id, titulo, periodo) {
            const secao = document.getElementById(id);
            if (!secao) return;
            const header = document.createElement('div');
            header.className = 'print-header';
            header.innerHTML = `<h1>${window.Utils.escaparHtml(titulo)}</h1><p>${window.Utils.escaparHtml(periodo || '')}</p>`;
            secao.insertBefore(header, secao.firstChild);
            document.body.classList.add('printing');
            document.body.setAttribute('data-print', id);
            const limpar = () => {
                document.body.classList.remove('printing');
                document.body.removeAttribute('data-print');
                if (header.parentNode) header.parentNode.removeChild(header);
                window.removeEventListener('afterprint', limpar);
            };
            window.addEventListener('afterprint', limpar);
            window.print();
            setTimeout(limpar, 1500);
        }

        // --- Resumo: CSV por unidade ---
        window.exportarResumoCSV = function() {
            const dados = window.__resumoAtual;
            if (!dados) { alert('Carregue o resumo antes de exportar.'); return; }
            const linhas = [];
            linhas.push('Unidade;Plantões;Horas;Valor/Hora Médio;Valor Total');
            let totPlant = 0, totHoras = 0, totValor = 0;
            Object.keys(dados.resumoPorLocal).sort().forEach(local => {
                const r = dados.resumoPorLocal[local];
                const media = r.horas > 0 ? (r.valor / r.horas) : 0;
                linhas.push(`${local};${r.plantoes.length};${csvNumero(r.horas, 1)};${csvNumero(media)};${csvNumero(r.valor)}`);
                totPlant += r.plantoes.length;
                totHoras += r.horas;
                totValor += r.valor;
            });
            const mediaGeral = totHoras > 0 ? (totValor / totHoras) : 0;
            linhas.push(`TOTAL;${totPlant};${csvNumero(totHoras, 1)};${csvNumero(mediaGeral)};${csvNumero(totValor)}`);
            const csv = '\uFEFF' + linhas.join('\r\n');
            const nome = `resumo_${dados.ano}-${String(dados.mes).padStart(2, '0')}.csv`;
            window.Utils.baixarArquivo(nome, csv, 'text/csv;charset=utf-8');
        };

        // --- Resumo: ICS do mês (todos os plantões do filtro) ---
        window.exportarResumoICS = function() {
            const dados = window.__resumoAtual;
            if (!dados) { alert('Carregue o resumo antes de exportar.'); return; }
            const lista = [];
            Object.keys(dados.resumoPorLocal).forEach(local => {
                dados.resumoPorLocal[local].plantoes.forEach(p => lista.push(p));
            });
            if (lista.length === 0) { alert('Nenhum plantão para exportar no período.'); return; }
            const ics = gerarICSConteudo(lista);
            const nome = `plantoes_${dados.ano}-${String(dados.mes).padStart(2, '0')}.ics`;
            window.Utils.baixarArquivo(nome, ics, 'text/calendar;charset=utf-8');
        };

        // --- Resumo: PDF via window.print ---
        window.exportarResumoPDF = function() {
            const dados = window.__resumoAtual;
            const periodo = dados ? `${String(dados.mes).padStart(2, '0')}/${dados.ano}` : '';
            imprimirSecao('resumo', 'Resumo Financeiro Mensal', periodo);
        };

        // --- Consolidado: CSV (evolução mensal + total do ano) ---
        window.exportarConsolidadoCSV = function() {
            const dados = window.__consolidadoAtual;
            if (!dados) { alert('Carregue o consolidado antes de exportar.'); return; }
            const nomes = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            const linhas = [];
            linhas.push('Mês;Plantões;Horas;Valor Total;Valor/Hora Médio');
            for (let m = 1; m <= 12; m++) {
                if (!dados.meses[m]) continue;
                const mes = dados.meses[m];
                const media = mes.horas > 0 ? (mes.valor / mes.horas) : 0;
                linhas.push(`${nomes[m]};${mes.plantoes};${csvNumero(mes.horas, 1)};${csvNumero(mes.valor)};${csvNumero(media)}`);
            }
            linhas.push(`TOTAL;${dados.totalPlantoes};${csvNumero(dados.totalHoras, 1)};${csvNumero(dados.totalValor)};${csvNumero(dados.mediaHora)}`);
            const csv = '\uFEFF' + linhas.join('\r\n');
            window.Utils.baixarArquivo(`consolidado_${dados.ano}.csv`, csv, 'text/csv;charset=utf-8');
        };

        // --- Consolidado: PDF via window.print ---
        window.exportarConsolidadoPDF = function() {
            const dados = window.__consolidadoAtual;
            imprimirSecao('consolidado', 'Consolidado Anual', dados ? String(dados.ano) : '');
        };

        // Expose functions to window for onclick handlers in HTML
        window.mostrarSecao = mostrarSecao;
        window.filtrarResumo = filtrarResumo;
        window.navegarResumo = navegarResumo;
        window.setResumoDefaults = setResumoDefaults;
        window.fecharPopup = fecharPopup;
        window.editarPlantao = editarPlantao;
        window.excluirPlantao = excluirPlantao;
        window.abrirPopupResumo = abrirPopupResumo;
        window.carregarConsolidado = carregarConsolidado;
        window.cadastrarPlantaoComData = cadastrarPlantaoComData;
        // atualizarCalendario já está em window (definida na linha 251)
    })();