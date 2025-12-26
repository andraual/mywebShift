# 🔐 Configuração de Credenciais Firebase com OAuth

Este guia explica como configurar as credenciais do Firebase para habilitar login social com Google e Facebook.

## 📋 Pré-requisitos

- Conta do Firebase (https://firebase.google.com)
- Projeto Firebase já criado (mywebShift)
- Acesso de administrador ao console do Firebase
- URL do seu aplicativo (ex: http://localhost:3000 ou https://seu-dominio.com)

---

## 🔵 Parte 1: Configurar Google OAuth

### 1.1 No Console do Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Selecione seu projeto **mywebShift**
3. No menu esquerdo, vá para **Build** → **Authentication**
4. Clique na aba **Sign-in method**
5. Clique em **Google** e ativar o provider:
   - Toggle **Enable** para ON
   - Email de suporte aparecerá automaticamente
   - Clique **Save**

### 1.2 Verificar Domínios Autorizados

No Firebase Console → Authentication:

1. Vá para **Settings** (ícone de engrenagem no canto superior esquerdo)
2. Selecione a aba **Authorized domains**
3. Adicione seus domínios:
   - `localhost` (para desenvolvimento local)
   - `localhost:3000` (se usar essa porta)
   - `seu-dominio.com` (para produção)
   - `seu-dominio.com:8080` (se usar porta customizada)

### 1.3 Testar Google Login

```javascript
// No seu código, o Google login já está configurado assim:
const provider = new firebase.auth.GoogleAuthProvider();
await auth.signInWithPopup(provider);
```

✅ **Google OAuth está ativado automaticamente no Firebase!**

---

## 🔵 Parte 2: Configurar Facebook OAuth

### 2.1 Criar App no Facebook Developers

1. Acesse [Facebook Developers](https://developers.facebook.com)
2. Faça login (crie conta se necessário)
3. Clique em **My Apps** → **Create App**
4. Escolha tipo: **Consumer** (e depois avançar)
5. Preencha:
   - **App Name**: MyWebShift (ou seu nome)
   - **App Contact Email**: seu@email.com
   - **Purpose**: Selecione "App for Pages"
6. Clique **Create App**

### 2.2 Adicionar Produto Facebook Login

1. No dashboard do app, procure **Add Product**
2. Encontre **Facebook Login** e clique **Set Up**
3. Escolha **Web** como plataforma
4. Clique **Next** até chegar em configurações

### 2.3 Configurar URLs Válidas

1. Em **Facebook Login** → **Settings**
2. Na seção **Valid OAuth Redirect URIs**, adicione:
   ```
   https://<seu-projeto>.firebaseapp.com/__/auth/handler
   https://<seu-projeto>.firebaseapp.com/__/auth/handler
   ```
   
   Para encontrar seu ID do projeto Firebase:
   - Console Firebase → Configurações do Projeto
   - Copie o **ID do Projeto**

3. Salve as alterações

### 2.4 Obter App ID e App Secret

1. Em **Settings** → **Basic**, você verá:
   - **App ID** (ex: 123456789012345)
   - **App Secret** (ex: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6)

⚠️ **Não compartilhe o App Secret!**

### 2.5 Configurar Facebook no Firebase Console

1. Firebase Console → **Authentication** → **Sign-in method**
2. Clique em **Facebook** e ativar:
   - Toggle **Enable** para ON
   - Cole o **App ID**
   - Cole o **App Secret**
   - URLs de redirect aparecerão automaticamente
3. Clique **Save**

### 2.6 Testar Facebook Login

```javascript
// No seu código, o Facebook login já está configurado assim:
const provider = new firebase.auth.FacebookAuthProvider();
await auth.signInWithPopup(provider);
```

---

## 🚀 Parte 3: Testar no Ambiente Local

### 3.1 Para Desenvolvimento Local

1. Inicie um servidor local:
```bash
# Se usar Python 3
python -m http.server 3000

# Ou com Node.js
npx http-server -p 3000
```

2. Acesse `http://localhost:3000` no navegador

3. Adicione `localhost` aos domínios autorizados no Firebase

### 3.2 Teste os Botões

1. Clique em **Login com Google**
   - Deve abrir popup do Google
   - Selecione sua conta
   - Deve fazer login com sucesso

2. Clique em **Login com Facebook**
   - Deve abrir popup do Facebook
   - Faça login com sua conta Facebook
   - Deve fazer login com sucesso

---

## 📤 Parte 4: Implantação em Produção

### 4.1 Firebase Hosting (Recomendado)

1. Instale Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Faça login:
```bash
firebase login
```

3. Inicialize seu projeto:
```bash
firebase init hosting
```

4. Configure sua URL de produção:
   - Firebase Console → Configurações do Projeto
   - Copie a URL do Firebase Hosting (ex: `https://mywebshift-xxxxx.web.app`)
   - Adicione aos domínios autorizados
   - Adicione a URL de redirect do Facebook

5. Faça deploy:
```bash
firebase deploy --only hosting
```

### 4.2 Seu Domínio Customizado

Se usar domínio próprio (ex: www.mywebshift.com.br):

1. Firebase Console → **Hosting** → **Connect domain**
2. Siga as instruções para apontar DNS
3. Adicione o domínio aos domínios autorizados no Firebase
4. Adicione a URL de redirect no Facebook

---

## ⚙️ Código Necessário (Já Implementado)

Seu código já tem tudo configurado! Aqui está o que foi adicionado:

### index.html - Botões de Social Login
```html
<!-- Google Login Button -->
<button class="social-btn" id="googleLoginBtn">
    <svg>...</svg>
    Google
</button>

<!-- Facebook Login Button -->
<button class="social-btn" id="facebookLoginBtn">
    <svg>...</svg>
    Facebook
</button>
```

### JavaScript - Handlers
```javascript
// Google Login
document.getElementById('googleLoginBtn').addEventListener('click', async function() {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
});

// Facebook Login
document.getElementById('facebookLoginBtn').addEventListener('click', async function() {
    const provider = new firebase.auth.FacebookAuthProvider();
    await auth.signInWithPopup(provider);
});
```

---

## 🔧 Troubleshooting

### Erro: "Unauthorized domain"
**Solução**: Adicione seu domínio/localhost aos domínios autorizados no Firebase

### Erro: "CORS policy"
**Solução**: Certifique-se que a URL está exatamente como no navegador (incluindo porta)

### Erro no Facebook: "Invalid Oauth redirect URI"
**Solução**: Verifique se a URL exata está configurada nas Settings do app Facebook

### Popup bloqueado
**Solução**: Desative bloqueador de popups ou use clique do usuário para abrir (já fazemos isso)

### Usuário não retorna dados
**Solução**: Verifique se o email está público no perfil do Google/Facebook

---

## 📝 Checklist Final

- [ ] Google OAuth habilitado no Firebase
- [ ] Facebook App criado em developers.facebook.com
- [ ] App ID e App Secret do Facebook copiados
- [ ] Facebook OAuth habilitado no Firebase
- [ ] Domínios autorizados adicionados no Firebase:
  - [ ] localhost
  - [ ] localhost:3000 (se aplicável)
  - [ ] seu-dominio.com
- [ ] URLs de redirect do Facebook configuradas
- [ ] Testado login com Google ✅
- [ ] Testado login com Facebook ✅
- [ ] App em produção com domínio customizado

---

## 📞 Referências

- [Firebase Authentication - Google](https://firebase.google.com/docs/auth/web/google-signin)
- [Firebase Authentication - Facebook](https://firebase.google.com/docs/auth/web/facebook-login)
- [Facebook Developers - Login](https://developers.facebook.com/docs/facebook-login)
- [Firebase Console](https://console.firebase.google.com)

---

**Última atualização**: 26 de dezembro de 2025
