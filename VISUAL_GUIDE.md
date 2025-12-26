# 🎯 PASSO A PASSO VISUAL: Configurar OAuth Firebase

## 🔵 PASSO 1: HABILITAR GOOGLE NO FIREBASE (2 minutos)

### Acesse Firebase Console

```
1. Abra: https://console.firebase.google.com
2. Login com sua conta Google
3. Selecione projeto "mywebShift"
```

### Ir para Authentication

```
Painel do Firebase
├─ Lado Esquerdo: Build (menu)
│  ├─ Click em "Authentication"
│  └─ Você verá tela de "Sign-in method"
```

### Ativar Google

```
Sign-in method
├─ Procure por "Google"
├─ Click no Google
├─ Na popup: Toggle ENABLE (azul)
├─ Email aparece automaticamente
└─ Click SAVE (azul)

✅ GOOGLE HABILITADO!
```

**Screenshot Esperado:**
```
┌─ Sign-in method ───────────────────┐
│                                    │
│ Google  [ENABLE TOGGLE - ON]       │
│ Project support email:             │
│ [seu-email@gmail.com]              │
│                                    │
│                    [SAVE]          │
└────────────────────────────────────┘
```

---

## 🔵 PASSO 2: ADICIONAR DOMÍNIOS AUTORIZADOS (1 minuto)

### No Firebase Console

```
Authentication → Settings (⚙️ no topo)
│
└─ Aba: "Authorized domains"
   ├─ Click em "Add domain"
   ├─ Digite: localhost
   ├─ Pressione Enter
   │
   ├─ Click em "Add domain"
   ├─ Digite: localhost:3000
   ├─ Pressione Enter
```

**Screenshot Esperado:**
```
┌─ Authorized domains ───────────────┐
│                                    │
│ [localhost]              [x]       │
│ [localhost:3000]         [x]       │
│ [seu-projeto.firebaseapp.com] [x] │
│                                    │
│ [+ Add domain]                     │
│                                    │
└────────────────────────────────────┘
```

---

## 🔵 PASSO 3: CRIAR APP NO FACEBOOK (3 minutos)

### Acesse Facebook Developers

```
1. Abra: https://developers.facebook.com
2. Login com sua conta Facebook
3. Click em "My Apps" (topo)
4. Click em "Create App"
```

### Criar Novo App

```
Create an app
├─ App Type: Consumer [Next]
│
├─ App Name: MyWebShift
├─ App Contact Email: seu@email.com
├─ Purpose: App for Pages, Business or Community
├─ App Platforms: Web
│
└─ [Create App]
```

**Screenshot Esperado:**
```
┌─ Create an App ────────────────────┐
│                                    │
│ App Name: [MyWebShift]             │
│ Contact Email: [seu@email.com]     │
│ Purpose: [App for Pages... v]      │
│                                    │
│                    [Create App]    │
└────────────────────────────────────┘
```

---

## 🔵 PASSO 4: ADICIONAR FACEBOOK LOGIN (2 minutos)

### Ir para Dashboard do App

```
Seu novo app
├─ Dashboard (você já está)
│
└─ Procure por "Facebook Login"
   ├─ Click em "Set Up"
   ├─ Escolha: Web
   ├─ Click em Next (várias vezes)
   └─ Até chegar em Settings
```

### Configurar URLs de Redirect

```
Facebook Login → Settings
│
├─ Valid OAuth Redirect URIs
│  └─ Add: https://SEU-PROJETO-ID.firebaseapp.com/__/auth/handler
│
└─ Save Changes
```

**Onde encontrar SEU-PROJETO-ID:**
```
Firebase Console
├─ Settings (⚙️)
├─ General tab
├─ Procure: "Project ID"
├─ Copie o valor (ex: mywebshift-a1b2c3)
└─ Use em: https://mywebshift-a1b2c3.firebaseapp.com/__/auth/handler
```

**Screenshot Esperado:**
```
┌─ Valid OAuth Redirect URIs ────────┐
│                                    │
│ https://mywebshift-a1b2c3.         │
│ firebaseapp.com/__/auth/handler    │
│                                    │
│ [x] (delete)                       │
│                                    │
│ [+ Add URI]                        │
│                        [Save]      │
└────────────────────────────────────┘
```

---

## 🔵 PASSO 5: OBTER APP ID E SECRET (1 minuto)

### Encontrar Credenciais

```
Facebook App Dashboard
├─ Settings (⚙️ - lado esquerdo)
├─ Basic
│
├─ App ID: 123456789012345 [Copy]
├─ App Secret: a1b2c3d4e5f6g7h8... [Copy]
│
└─ ⚠️ NÃO COMPARTILHE O APP SECRET!
```

**Screenshot Esperado:**
```
┌─ Basic Settings ────────────────────┐
│                                    │
│ App ID:                            │
│ [123456789012345]         [Copy]   │
│                                    │
│ App Secret:                        │
│ [a1b2c3d4e5f6g7h8...]    [Show]   │
│                         [Copy]    │
│                                    │
│ ⚠️ Keep this secret!               │
└────────────────────────────────────┘
```

**Salve esses valores em algum lugar seguro!**

---

## 🔵 PASSO 6: ADICIONAR FACEBOOK AO FIREBASE (1 minuto)

### Firebase Console

```
Authentication → Sign-in method
│
├─ Procure por "Facebook"
├─ Click em Facebook
├─ Toggle ENABLE (azul)
│
├─ App ID: [Cole o valor do passo 5]
├─ App Secret: [Cole o valor do passo 5]
│
└─ [SAVE]
```

**Screenshot Esperado:**
```
┌─ Sign-in method - Facebook ────────┐
│                                    │
│ Facebook [ENABLE - ON]             │
│                                    │
│ App ID: [123456789012345]          │
│ App Secret: [a1b2c3d4e5f6g7h...]  │
│                                    │
│ Authorization redirect URI         │
│ https://seu-projeto.firebaseapp.   │
│ com/__/auth/handler                │
│                                    │
│                        [SAVE]      │
└────────────────────────────────────┘
```

✅ **FACEBOOK CONFIGURADO!**

---

## 🚀 TESTE AGORA

### Iniciar Servidor Local

```bash
cd /home/andraual/CÓDIGOS/MWS/mywebShift

# Opção 1: Python
python -m http.server 3000

# Opção 2: Node.js
npx http-server -p 3000

# Depois acesse:
# http://localhost:3000
```

### Testar Google Login

```
1. Abra http://localhost:3000
2. Click no botão [Google]
3. Popup abre
4. Selecione sua conta Google
5. Click em "Permitir"

✅ ESPERADO: Login funciona!
```

### Testar Facebook Login

```
1. Click no botão [Facebook]
2. Popup abre
3. Login ou selecione conta
4. Click em "Continuar"

✅ ESPERADO: Login funciona!
```

### Testar Criar Conta

```
1. Click em "Criar uma nova conta"
2. Preencha:
   - Nome: Seu Nome
   - Email: teste@gmail.com
   - Senha: 123456
   - Confirmar: 123456
   - ☐ Marque termos
3. Click "Criar Conta"

✅ ESPERADO: Conta criada e faz login!
```

---

## ❌ PROBLEMAS COMUNS

### Erro: "Unauthorized domain"

```
❌ PROBLEMA: Página diz não autorizada

✅ SOLUÇÃO:
1. Firebase Console
2. Authentication → Settings
3. Authorized domains
4. Confirme que "localhost" está lá
5. Se usando :3000, adicione "localhost:3000"
6. Recarregue a página (Ctrl+Shift+R)
```

### Erro: "CORS" ou Popup não Abre

```
❌ PROBLEMA: Popup está bloqueado

✅ SOLUÇÃO:
1. Desabilite bloqueador de popups
2. Tente em abas de incógnito
3. Ou use Chrome em vez de Firefox
```

### Erro Facebook: "Invalid Redirect URI"

```
❌ PROBLEMA: Facebook diz URL inválida

✅ SOLUÇÃO:
1. Verifique a URL de redirect:
   https://SEU-PROJETO-ID.firebaseapp.com/__/auth/handler
2. Copie exatamente do Firebase Console
3. Cole exatamente no Facebook
4. Sem espaços extras ou erros de digitação
```

### Login não Funciona Depois de Criar Conta

```
❌ PROBLEMA: Cria conta mas não faz login

✅ SOLUÇÃO:
1. Abra Developer Console (F12)
2. Veja a aba "Console"
3. Procure por mensagens de erro
4. Verifique se onAuthStateChanged está funcionando
5. Check Firebase → Users (conta deve estar lá)
```

---

## 📊 CHECKLIST FINAL

Antes de considerar pronto:

- [ ] Google OAuth habilitado no Firebase
- [ ] Facebook App criado em developers.facebook.com
- [ ] App ID do Facebook copiado
- [ ] App Secret do Facebook copiado (e guardado com segurança!)
- [ ] Facebook OAuth habilitado no Firebase
- [ ] Domínios autorizados adicionados:
  - [ ] localhost
  - [ ] localhost:3000
- [ ] URLs de redirect configuradas no Facebook
- [ ] Testou login com Google ✅
- [ ] Testou login com Facebook ✅
- [ ] Testou criar conta ✅
- [ ] Verificou usuários no Firebase Console

---

## 📁 Arquivos de Referência

No seu repositório:
- `FIREBASE_SETUP.md` - Guia completo detalhado
- `QUICK_SETUP.md` - Referência rápida
- `TESTING_GUIDE.md` - Testes completos
- `index.html` - Código já implementado

---

**Pronto! Agora seu app tem autenticação moderna com OAuth! 🎉**

Se tiver dúvidas, consulte:
1. Este guia visual
2. `FIREBASE_SETUP.md` para detalhes
3. `TESTING_GUIDE.md` para testes
