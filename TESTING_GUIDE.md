# 🧪 Guia de Teste - Firebase OAuth

Este arquivo contém instruções para testar os logins localmente e em produção.

## 📋 Antes de Começar

Você precisa ter:
- [ ] Firebase Console acesso
- [ ] Google Account (para testar)
- [ ] Facebook Account (para testar)
- [ ] Servidor local rodando
- [ ] Navegador com popups habilitados

---

## 🔧 Setup Local

### 1. Iniciar Servidor Local

**Opção A: Python**
```bash
cd /home/andraual/CÓDIGOS/MWS/mywebShift
python -m http.server 3000
```

**Opção B: Node.js**
```bash
npx http-server -p 3000
```

**Opção C: Live Server (VS Code)**
- Instale extensão "Live Server"
- Right-click no `index.html`
- "Open with Live Server"

### 2. Adicionar Localhost ao Firebase

1. Firebase Console
2. Authentication → Settings
3. Authorized domains → Add domain
4. Adicione: `localhost`
5. Se usando porta customizada, adicione também: `localhost:3000`

---

## ✅ Teste #1: Login com Google

### Setup
```
✓ Servidor rodando (http://localhost:3000)
✓ localhost adicionado aos domínios autorizados
✓ Você tem uma Google Account
```

### Passo a Passo

1. Abra `http://localhost:3000` no navegador
2. Você verá a tela de login com logo e botões
3. Clique no botão **"Google"**
4. Espere a popup abrir
5. Selecione sua conta Google
6. Clique **"Permitir"** quando pedir permissões
7. **Resultado esperado**: 
   - ✅ Popup fecha
   - ✅ Você é redirecionado ao app
   - ✅ Vê a tela principal (calendar)
   - ✅ Console mostra "Login bem-sucedido!"

### Se Falhar
- [ ] Erro: "Unauthorized domain"
  - Adicione `localhost` aos domínios autorizados
  
- [ ] Popup não abre
  - Verifique se bloqueador de popups está desabilitado
  - Tente em abas anônimas/incógnito
  
- [ ] Erro CORS
  - Verifique a URL (localhost vs 127.0.0.1)
  - Use sempre `http://localhost:3000`

---

## ✅ Teste #2: Login com Facebook

### Setup
```
✓ Firebase Console acesso
✓ App Facebook criado em developers.facebook.com
✓ App ID e App Secret configurados no Firebase
✓ URLs de redirect adicionadas
✓ Você tem uma Facebook Account
```

### Passo a Passo

1. Abra `http://localhost:3000` no navegador
2. Clique no botão **"Facebook"**
3. Espere a popup abrir
4. Faça login ou selecione sua conta
5. Clique **"Continuar"** quando pedir permissões
6. **Resultado esperado**: 
   - ✅ Popup fecha
   - ✅ Você é redirecionado ao app
   - ✅ Vê a tela principal (calendar)
   - ✅ Console mostra "Login bem-sucedido!"

### Se Falhar
- [ ] Erro: "Invalid OAuth redirect URI"
  - Verifique se a URL está exata em Facebook App Settings
  - Deve ser: `https://SEU-PROJETO-ID.firebaseapp.com/__/auth/handler`
  
- [ ] Erro: "App not set up"
  - Certifique-se que Facebook Login foi adicionado ao app
  - Verifique se o App ID está correto
  
- [ ] Popup não abre
  - Mesmo problema do Google, desabilite bloqueador de popups

---

## 📝 Teste #3: Criar Conta

### Passo a Passo

1. Na tela de login, clique em **"Criar uma nova conta"**
2. Preencha:
   - Nome Completo: Seu nome de teste
   - E-mail: seu-email-teste@gmail.com
   - Senha: Qualquer coisa (mín. 6 caracteres)
   - Confirmar Senha: Igual à anterior
   - Checkbox: Marque os termos
3. Clique **"Criar Conta"**
4. **Resultado esperado**:
   - ✅ Mensagem de sucesso
   - ✅ Redirecionado ao app em segundos
   - ✅ E-mail aparece no Firebase Console → Users

### Verificar no Firebase
```
Firebase Console
└─ Authentication
   └─ Users
      └─ Deve aparecer seu novo usuário com:
         ├─ Email: seu-email-teste@gmail.com
         ├─ Created: Agora
         └─ Sign-in method: Email/Senha
```

---

## 🔍 Teste #4: Verificar Console (Debug)

### Abrir Developer Tools

**Chrome/Edge/Firefox:**
1. Press `F12` ou `Ctrl+Shift+I` (Windows) / `Cmd+Shift+I` (Mac)
2. Clique na aba **Console**

### Esperado em Testes Bem-Sucedidos

```javascript
// Ao clicar em Google:
Iniciando login com Google...
Login com Google bem-sucedido!

// Ao clicar em Facebook:
Iniciando login com Facebook...
Login com Facebook bem-sucedido!

// Ao criar conta:
Criando conta para: seu-email@gmail.com
Conta criada com sucesso!
```

---

## 🚀 Teste #5: Em Produção

### Depois de Fazer Deploy no Firebase Hosting

```bash
firebase deploy --only hosting
```

### Adicionar Domínios em Produção

1. Firebase Console → Authentication → Settings
2. Authorized domains → Add domain
3. Adicione:
   - `seu-projeto.firebaseapp.com`
   - `seu-dominio.com` (se usando domínio customizado)

### Testar em Produção

1. Acesse `https://seu-projeto.firebaseapp.com`
2. Teste Google login
3. Teste Facebook login
4. Teste criar conta
5. Tudo deve funcionar igual ao local

---

## 📊 Checklist de Testes

### Testes Funcionais
- [ ] Google login funciona
- [ ] Facebook login funciona
- [ ] Criar conta funciona
- [ ] E-mail e senha aparecem no Firebase
- [ ] Usuário é redirecionado ao app
- [ ] Mensagens de erro aparecem (se error)

### Testes de UI
- [ ] Logo aparece na tela
- [ ] Botões estão estilizados
- [ ] Mensagens de erro são visíveis
- [ ] Popups abrem corretamente
- [ ] Transições são suaves

### Testes Responsivos
- [ ] Desktop (1920x1080): Tudo funciona ✅
- [ ] Tablet (768x1024): Tudo funciona ✅
- [ ] Mobile (375x667): Tudo funciona ✅

### Testes de Erro
- [ ] Erro de conexão é mostrado
- [ ] Popup cancelado é tratado
- [ ] Email inválido é alertado
- [ ] Senhas que não conferem são alertadas
- [ ] Terms not checked é alertado

---

## 📸 Capturas de Tela Esperadas

### Tela de Login
```
┌─────────────────────────────────┐
│                                 │
│            📋 (Logo)            │
│                                 │
│        Bem-vindo!               │
│   Controle seus plantões...     │
│                                 │
│ Email: [campo]                  │
│ Senha: [campo]                  │
│                                 │
│  [  Entrar  ]                   │
│                                 │
│           ou                    │
│                                 │
│  [Google] [Facebook]            │
│                                 │
│ Não tem conta? Criar conta      │
│                                 │
└─────────────────────────────────┘
```

### Tela de Criar Conta
```
┌─────────────────────────────────┐
│                                 │
│            📋 (Logo)            │
│                                 │
│        Criar Conta              │
│   Faça seu cadastro...          │
│                                 │
│ Nome: [campo]                   │
│ Email: [campo]                  │
│ Senha: [campo]                  │
│ Confirmar: [campo]              │
│ [☐] Concordo com termos        │
│                                 │
│  [  Criar Conta  ]              │
│                                 │
│ Já tem conta? Voltar ao login   │
│                                 │
└─────────────────────────────────┘
```

---

## 🐛 Troubleshooting Avançado

### Problema: Console Shows Error but UI Shows Nothing
**Solução**: Verifique se `mostrarErro()` está funcionando
```javascript
// Adicione ao console para debug
console.log(document.getElementById('loginErro'));
```

### Problema: Usuário Cria Conta mas Não Faz Login
**Solução**: Verifique `onAuthStateChanged`
```javascript
auth.onAuthStateChanged(function(user) {
    if (user) {
        console.log('Usuário autenticado:', user.email);
        document.getElementById('login').style.display = 'none';
    } else {
        console.log('Usuário não autenticado');
        document.getElementById('login').style.display = 'flex';
    }
});
```

### Problema: Firebase não inicializa
**Solução**: Verifique se SDK está carregado
```javascript
// No console, execute:
console.log(firebase);  // Deve retornar objeto
console.log(auth);      // Deve retornar objeto
console.log(db);        // Deve retornar objeto
```

---

## 📞 Referências Rápidas

| Tópico | Link |
|--------|------|
| Firebase Console | https://console.firebase.google.com |
| Google Dev | https://console.developers.google.com |
| Facebook Dev | https://developers.facebook.com |
| Docs Firebase Auth | https://firebase.google.com/docs/auth |

---

**Última Atualização**: 26 de dezembro de 2025

**Próxima Ação**: Execute os testes e confirme que tudo funciona! 🚀
