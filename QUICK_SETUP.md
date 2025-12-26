# ⚡ Guia Rápido: Configurar Firebase OAuth em 5 Minutos

## 🔵 Google (Super Fácil!)

### Passo 1: Firebase Console
```
🔗 https://console.firebase.google.com
└─ Selecione "mywebShift"
   └─ Build → Authentication
      └─ Sign-in method
         └─ Google
            └─ Toggle ON
            └─ Save
```

**Pronto!** Google está ativado automaticamente.

### Passo 2: Adicionar Domínios (Importante)
```
🔗 https://console.firebase.google.com
└─ Seu Projeto
   └─ Settings (⚙️)
      └─ Authorized domains
         └─ Adicione:
            • localhost
            • localhost:3000
            • seu-dominio.com
```

---

## 🔵 Facebook (Mais Passos)

### Passo 1: Criar App no Facebook
```
🔗 https://developers.facebook.com
└─ Log in / Sign up
   └─ My Apps
      └─ Create App
         └─ Consumer
         └─ App Name: "MyWebShift"
         └─ Email: seu@email.com
         └─ Purpose: "App for Pages"
         └─ Create App
```

### Passo 2: Adicionar Facebook Login
```
Dashboard do seu app
└─ Add Product (ou encontre Facebook Login)
   └─ Facebook Login
      └─ Web
         └─ Next
         └─ Até chegar em Settings
```

### Passo 3: Configurar URLs
```
Facebook Login → Settings
└─ Valid OAuth Redirect URIs
   └─ Adicione:
      https://SEU-PROJETO-ID.firebaseapp.com/__/auth/handler
```

**Onde encontrar SEU-PROJETO-ID:**
- Firebase Console
- Seu Projeto
- Settings (⚙️)
- Copie o "Project ID"

### Passo 4: Copiar Credenciais
```
Settings → Basic
└─ Copie:
   • App ID (ex: 123456789012345)
   • App Secret (ex: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6)
   
⚠️ NUNCA compartilhe o App Secret!
```

### Passo 5: Adicionar no Firebase
```
Firebase Console
└─ Authentication
   └─ Sign-in method
      └─ Facebook
         └─ Toggle ON
            └─ Cole App ID
            └─ Cole App Secret
            └─ Save
```

---

## ✅ Testar no Navegador

1. Abra seu app: `http://localhost:3000` (ou seu domínio)
2. Clique em **"Google"** → Deve abrir popup
3. Clique em **"Facebook"** → Deve abrir popup
4. Faça login com uma conta de teste

---

## 📝 Valores Padrão (Exemplo)

```
Google:
  ├─ App ID: Automático (integrado no Firebase)
  ├─ Redirect URI: https://seu-projeto.firebaseapp.com/__/auth/handler
  └─ Status: ✅ Habilitado

Facebook:
  ├─ App ID: 123456789012345 (você cria)
  ├─ App Secret: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6 (você cria)
  ├─ Redirect URI: https://seu-projeto.firebaseapp.com/__/auth/handler
  └─ Status: ✅ Habilitado após configurar
```

---

## 🚀 Depois de Configurar

Seu app já tem tudo pronto! Os botões funcionarão automaticamente:

```javascript
// Google - Já funciona!
googleLoginBtn.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
});

// Facebook - Já funciona!
facebookLoginBtn.addEventListener('click', async () => {
    const provider = new firebase.auth.FacebookAuthProvider();
    await auth.signInWithPopup(provider);
});
```

---

## 🆘 Problemas Comuns

| Erro | Solução |
|------|---------|
| ❌ "Unauthorized domain" | Adicione seu domínio em Firebase → Authorized domains |
| ❌ "Invalid OAuth redirect" | Verifique se a URL é exata (com/sem :3000) |
| ❌ Popup não abre | Desative bloqueador de popups |
| ❌ Não faz login | Verifique Email público no Google/Facebook |
| ❌ CORS error | Certifique-se da URL (localhost vs 127.0.0.1) |

---

## 📞 Suporte Rápido

- 🟦 Google: [Google Sign-In Docs](https://firebase.google.com/docs/auth/web/google-signin)
- 🟦 Facebook: [Facebook Login Docs](https://firebase.google.com/docs/auth/web/facebook-login)
- 🟦 Firebase: [Firebase Console](https://console.firebase.google.com)

---

**Dúvidas?** Consulte `FIREBASE_SETUP.md` para mais detalhes!
