# MyWebShift

Controle de plantões médicos com calendário, resumo financeiro e autenticação Firebase.

## Visão Geral
- Cadastro, edição e exclusão de plantões com valores por local, bônus e recorrência (semanal, quinzenal, mensal).
- Calendário FullCalendar com visualização mensal/semanal/diária e popups de ação.
- Resumo financeiro por local e total, com seleção de mês/ano e cálculo automático.
- Tema claro/escuro com persistência em `localStorage`.
- Autenticação via Firebase (e-mail/senha e Google OAuth), fluxo de login e criação de conta.
- Responsivo e otimizado para mobile; ajustes específicos para FullCalendar em telas pequenas.

## Stack
- Front-end: HTML, CSS, JavaScript (vanilla) + jQuery + FullCalendar 3.x + Moment.js.
- Backend as a Service: Firebase Auth + Firestore (SDK compat 9.6.1).

## Estrutura Atual
- `index.html` — markup principal (scripts externos + `app.js` e `styles.css`).
- `styles.css` — estilos globais e telas de login/cadastro.
- `app.js` — lógica da aplicação (ainda monolítico; próximo passo é quebrar em módulos).
- `firebase-config.example.js` — template de configuração do Firebase (copie para `firebase-config.js`).
- `src/` — esboço de organização futura (`config.js`, utils etc.).

## Configuração do Firebase
1. Copie `firebase-config.example.js` para `firebase-config.js` na raiz do projeto.
2. Preencha com as credenciais do seu projeto Firebase:
   ```js
   window.firebaseConfig = {
     apiKey: "...",
     authDomain: "seu-projeto.firebaseapp.com",
     projectId: "seu-projeto",
     storageBucket: "seu-projeto.appspot.com",
     messagingSenderId: "...",
     appId: "...",
     measurementId: "..."
   };
   ```
3. Não versione `firebase-config.js` (já está no `.gitignore`).

## Como Rodar Localmente
1. Instale dependências globais se precisar de serve estático (ex.: `npm i -g serve`).
2. Coloque `firebase-config.js` na raiz com suas credenciais.
3. Sirva a pasta (ex.: `serve .` ou `python3 -m http.server 8080`).
4. Acesse `http://localhost:8080`.

## Deploy Estático
- Garanta que `firebase-config.js` seja publicado junto a `index.html`, `styles.css` e `app.js` na raiz pública.
- Invalide cache/CDN quando trocar credenciais ou versões de JS/CSS.

## Segurança
- Chaves do Firebase ficam em `firebase-config.js`, fora do repositório.
- Fluxos ainda usam `innerHTML` em popups; sanitização adicional é recomendada.
- Firestore deve ter regras de segurança aplicadas ao projeto (não incluídas aqui).

## Roadmap (próximos passos)
- Quebrar `app.js` em módulos (`modules/auth`, `modules/plantoes`, `modules/financeiro`, `utils`, `config`).
- Remover handlers inline restantes e usar delegação de eventos.
- Paginação/otimização de queries do Firestore e cache mais robusto.
- Pipeline de build (Vite/Webpack), lint e testes.

## Créditos
Projeto desenvolvido para gestão de plantões médicos com foco em simplicidade e mobilidade.
