# Portar Mudanças do App Android para a Versão Web

Documento de referência para aplicar na versão web (`web/`) as mesmas correções,
normalizações e novos recursos implementados no app Android (`MSAPP`). As duas
versões compartilham o mesmo Firestore (`plantoes`, `usuarios/{uid}`,
`users/{uid}/unidades/{id}`) e devem seguir **as mesmas regras de negócio**.

> Data de referência: 09/2026 — App Android na Etapa 9 + Google Sign-In.
> O web já contém: login e-mail/Google, tema claro/escuro, calendário, resumo,
> consolidado com gráficos, unidades com soft-delete e seed, recorrência e ICS.

---

## 1. Prompt pronto (copiar e colar)

> Cole este prompt em outra IA/agente ou use como briefing para um desenvolvedor:

```
Projeto: My Shift — versão web em /web/ (HTML/CSS/JS vanilla + jQuery +
FullCalendar 3.x + Moment.js + Firebase SDK compat 9.6.1, arquivos app.js,
unidades.js, styles.css, index.html). O app Android (MSAPP) já implementou
novas features e normalizou regras de negócio. Aplique AS MESMAS mudanças no
web, sem quebrar os fluxos existentes, mantendo o Firestore compartilhado.

Contexto técnico:
- Plantões ficam em coleção "plantoes" com campos: data (YYYY-MM-DD),
  horaInicio (HH:mm), tempoPlantao, local, valorHora, valorCheio, valorBonus,
  valorTotal, observacoes, userId. "local" = NOME da unidade.
- Unidades em users/{uid}/unidades/{id} com: nome, valorHora,
  valorHoraFimSemana, ativo, criadoEm, atualizadoEm, excluidoEm (soft-delete).
- Regras do Firestore repúblicadas aceitam campos numéricos de plantão como
  NÚMERO ou STRING (função isNum). Portanto TODA leitura numérica deve tolerar
  string e número (o app grava como string, o web grava como número).
- Regras de negócio: valorTotal = valorHora * tempoPlantao + valorBonus; se
  valorCheio informado: valorTotal = valorCheio + valorBonus e
  valorHora = valorCheio / tempoPlantao. No fim de semana (sáb/dom) o valor/hora
  usa valorHoraFimSemana da unidade (e o valorCalculado por local/dia).
- Recorrência (criação): semanal +7d, quinzenal +14d, mensal = mesma posição da
  semana no mês (1ª/2ª/... quarta, etc.), somente datas futuras ou hoje,
  máximo 52 repetições, respeitando dataFim quando informada. Todo plantão
  recorrente recebe " (Recorrente)" anexado às observações.
- Conta especial contador@contador.com: vê SOMENTE o Financeiro/Resumo (sem
  botões Cadastrar/Calendário/Unidades) e não pode excluir/editar plantões.
- Perfil do usuário em usuarios/{uid} deve existir/atualizar após login com
  e-mail e com Google (nome, email, criadoEm, ultimoAcesso).

Tarefas obrigatórias (na ordem):
1) NORMALIZAÇÃO DE LEITURA: crie helpers em src/utils.js — numero(v) que faz
   Number(v)||0 tolerando string/número/null, e toBRL(n) para formatação pt-BR.
   Use-os em TODOS os pontos que leem campos numéricos de plantão:
   buscarPlantoes (app.js:176 e :180), filtrarResumo (app.js:367-371),
   carregarConsolidado (app.js:1490-1491), editarPlantao (app.js:855-857),
   abrirPopupResumo (app.js:1415-1416), consulta do consolidado por unidade,
   gerarICS/adicionarAoCalendarioGoogle (valores), e o cálculo de resumo total.
2) CALCULOS CENTRALIZADOS: extraia funções únicas calcularValorHoraPara(e a
   regra de fds já usada) e calcularValorTotal(valorHora, tempo, valorCheio,
   bonus) em src/utils.js e use-as no submit do formulário (substituindo as
   duplicações em app.js:921-930 e :983-984). Gravar sempre: se valorCheio,
   valorHora = valorCheio/tempo e valorTotal = valorCheio+bonus; caso contrário
   valorTotal = valorHora*tempo+bonus. Valor/hora final recalculado por local +
   dia da semana acabou com valorHoraFimSemana.
3) RECORRENCIA: em app.js:995 normalizar a concatenação das observações para
   [observacoes, '(Recorrente)'].filter(Boolean).join(' ') (evita espaço
   inicial). Garantir contagem apenas dos plantões efetivamente criados
   (já conta via plantoesCriados) e respeito a dataFim/data<hoje. Confira
   calcularDatasRecorrencia (app.js:741-839) contra os casos: semanal/quinzenal
   partem de cloneDateOnly(dataInicial); mensal usa obterPosicaoSemanaNoMes e
   obterDataPorPosicaoSemana (src/utils.js) e pula meses sem a posição.
4) PERFIL USUARIO: crie função garantirPerfil(user) em app.js que dá
   collection("usuarios").doc(uid).set(merge) com nome (email ou displayName),
   email, criadoEm e ultimoAcesso (FieldValue.serverTimestamp). Chame-a no
   login com e-mail/senha (após signInWithEmailAndPassword), no login com Google
   (após signInWithPopup) e reutilize-a no criarContaForm (app.js:555-560,
   trocar Date() por serverTimestamp e ultimoAcesso).
5) GOOGLE / ERROS AMIGAVEIS: nos handlers login (app.js:451-471), google
   (app.js:487-499) e cadastro (app.js:571-589) adicione:
   - auth/operation-not-allowed          -> "O login com Google não está
     habilitado no Firebase."
   - auth/account-exists-with-different-credential -> "Já existe uma conta com
     este e-mail usando outro método de login."
   - auth/invalid-login-credentials (além de user-not-found/wrong-password) ->
     "E-mail ou senha inválidos."
   - auth/too-many-requests              -> "Muitas tentativas. Tente mais tarde."
   No caso account-exists: sugerir usar a tela de login e-mail/senha.
6) CONTADOR ROBUSTO: substituir a detecção por btn.title.includes('Financeiro')
   em app.js:90-99 por um atributo data-section no HTML (ex.: data-section na
   meta dos botões .main-btn em index.html:126-163) e esconder tudo exceto
   data-section='resumo'. Confirmar que abrirPopupResumo já oculta Excluir para
   o contador (app.js:1419).
7) EXPORTACAO (nova feature - equivalência ao app):
   a) Resumo mensal: botão "Exportar" no header (index.html:270-299) com menu
      CSV / PDF / ICS do mês.
      - CSV resumo: por unidade (nome; plantões; horas; valor/hora médio; valor
        total) + linha TOTAL; separador ";", vírgula decimal, BOM \uFEFF
        (Excel), arquivo resumo_YYYY-MM.csv.
      - ICS do mês: generalizar gerarICS (app.js:1131-1153) para aceitar uma
        lista de plantões (um VEVENT por plantão) e baixar
        plantoes_YYYY-MM.ics com todos os plantões do filtro.
      - PDF: usar window.print() com @media print que isola apenas a seção
        ativa (#resumo ou #consolidado), header com título + período.
   b) Consolidado anual: botão "Exportar" (index.html:316-327) com CSV e PDF do
      ano. CSV consolidado: evolução mensal (mês; plantões; horas; valor total)
      + linha TOTAL do ano (horas, valor, valor/hora médio, plantões), arquivo
      consolidado_YYYY.csv.
   c) Reaproveitar os dados já montados em filtrarResumo (app.js:388-429) e
      carregarConsolidado (app.js:1465+). Gerar via Blob + <a download>.
      NÃO usar dependências novas; código vanilla.
8) TELA INICIAL (paridade com o app Android - modernização):
   Atualize #inicio (index.html:123-183) e styles.css:
   - Header centralizado com os respiro no topo (padding maior; não colar na
     borda), monograma/logo arredondado "MS" com gradiente rosa (#FF7BB3 ->
     #FF4D94), título "My Shift" e "Bem-vindo! O que deseja fazer?" abaixo.
   - .main-btn transformados em CARDS: fundo branco/surface, cantos arrondados
     (16-20px), ícone dentro de círculo 56px com gradiente rosa e ícone branco,
     sombra sutil, área de toque maior, grid com espaçamento >=16px.
   - Manter toggle de tema e botão Sair.
9) PALETA / TEMA: padronize as cores com as do app — criar variáveis CSS em
   styles.css (:root) --primary #FF4D94, --primary-light #FF7BB3,
   --primary-dark #C2185B, --surface #FFF5F9, --bg-claro #FFFFFF, --bg-escuro
   #121212 (web usa #1e1e1e — alinhe para #121212) e troque literais
   espalhadas. Manter verde #4CAF50, azul #2196F3 e laranja #FF9800 já usados.
10) CONSOLIDADO/RESUMO - ANOS: aplicar os anos dinâmicos também no
    select #anoConsolidado (verificarAnosDisponiveis / adicionarAnoAoResumo em
    app.js:677-698 e :606-622) e garantir ano atual pré-selecionado nos dois.
11) LIMPEZA E SEGURANÇA:
    - Existe função abrirPopupResumo DUPLICADA (app.js:1172-1211 e 1398-1442);
      manter apenas a versão completa (a segunda, que busca o plantão no
      Firestore) e remover a primeira.
    - Remover o bloco comentado "Baixar PDF" (index.html:167-173) agora que há
      exportação real.
    - Sanitizar HTML: popups e listagens usam innerHTML com local, observacoes
      e nome de unidade; criar escaparHtml() e aplicar nesses pontos
      (exibirPopupSucesso, abrirPopupResumo, carregarUnidades em unidades.js,
      resumo em app.js).
    - Padronizar leitura: preferir p.valorTotal != null (não só !== undefined).

Requisitos de aceite: build sem erros; abrir o site localmente
(python3 -m http.server) e testar: login e-mail + google; criar plantão com
valorCheio e com bônus (conferir valorTotal e valorHora); criar recorrente
(semanal/quinzenal/mensal) e conferir " (Recorrente)" e datas > hoje; resumo e
consolidado com dados antigos gravados como string e como número;
exportar CSV/PDF/ICS do resumo e do consolidado abrindo no Excel;
conta contador vendo só Financeiro; tema claro/escuro. Entregar as mudanças
em diff pequeno com comentários curtos em pt-BR, sem novas dependências.
```

---

## 2. Passo a passo (checklist de execução)

### A. Leitura de dados tolerante (paridade Firestore)
- [ ] Criar em `src/utils.js`: `numero(v)` = `Number(v) || 0` (tolera string/número/null) e `toBRL(n)` (pt-BR, 2 casas).
- [ ] Aplicar nos pontos de leitura: `app.js:176,180` (calendário), `app.js:367-371` (resumo), `app.js:1490-1491` (consolidado), `app.js:855-857` (edição), `app.js:1415-1416` (popup), valores em Google Calendar/ICS, totals.
- [ ] Usar `!= null` em vez de `!== undefined` para `valorTotal`.
- [ ] **Decisão de gravação:** manter o web gravando como número (leitura é tolerante). Não reescrever dados em massa.

### B. Cálculos centralizados
- [ ] Extrair `calcularValorTotal(valorHora, tempoPlantao, valorCheio, bonus)` e replicar regra de fds (mesma de `calcularValorHora` em `unidades.js:30-48`).
- [ ] Usar no submit do `plantaoForm` (substituir `app.js:921-930` e `:983-984`).
- [ ] Gravar `valorHora`, `valorTotal`, `valorCheio`, `valorBonus` de forma consistente com o app (valorHora = valorCheio/tempo quando valorCheio presente).

### C. Recorrência
- [ ] Ancorar a observação: `[observacoes, '(Recorrente)'].filter(Boolean).join(' ')` (`app.js:995`).
- [ ] Revisar `calcularDatasRecorrencia` (`app.js:741-839`) vs app: semanal/quinzenal a partir da data inicial; mensal por posição da semana; pular datas <= hoje; respeitar `dataFim`; limites 1–52.
- [ ] Manter contagem de criados e feedback correto no popup.

### D. Unidades
- [ ] Confirmar soft-delete (`unidades.js:313-316` já faz `ativo:false` + `excluidoEm`) e filtro `d.ativo` (`unidades.js:191,240`) — OK; nada a mudar.
- [ ] Sanitizar nome da unidade no `innerHTML` da listagem (`unidades.js:200-219`).
- [ ] Seed idêntico ao app (`unidades.js:344-349`): Intermedica Diadema 114/125, Beneficência Portuguesa SC 125/135, Hospital Christóvão da Gama Diadema 125/125, Hospital São Cristovão (Mooca) 125/125 — OK.

### E. Perfil do usuário + Google
- [ ] `garantirPerfil(user)` com serverTimestamp em `usuarios/{uid}` (nome do Google ou email).
- [ ] Chamar no login e-mail, no login Google e no cadastro (`app.js:555-560`).
- [ ] Mensagens de erro: `auth/operation-not-allowed`, `auth/account-exists-with-different-credential`, `auth/invalid-login-credentials`, `auth/too-many-requests` nos 3 handlers.

### F. Contador
- [ ] Trocar detecção por `title` por `data-section` nos `.main-btn` (`index.html:126-163`), esconder exceto `data-section="resumo"` (`app.js:89-100`).
- [ ] Manter bloqueio de excluir/editar no popup para contador (`app.js:1419`).

### G. Exportação (novo)
- [ ] Resumo: botão Exportar (CSV `;` + vírgula + BOM; ICS do mês com lista; PDF via `window.print()`/`@media print`). Arquivos: `resumo_YYYY-MM.csv`, `plantoes_YYYY-MM.ics`.
- [ ] Consolidado: Exportar CSV (evolução mensal + total do ano) e PDF do ano. `consolidado_YYYY.csv`.
- [ ] Vanilla JS (Blob + `<a download>`), sem libs novas.

### H. Tela inicial
- [ ] Header com monograma "MS" gradiente rosa + título centralizado, boas-vindas, maior padding no topo.
- [ ] `.main-btn` como cards (círculo de ícone rosa, cantos 16–20px, sombra, altura ≥150px, espaçamento ≥16px).
- [ ] Toggle de tema e Sair preservados.

### I. Temas / paleta
- [ ] Variáveis CSS `:root`: `--primary #FF4D94`, `--primary-light #FF7BB3`, `--primary-dark #C2185B`, `--surface #FFF5F9`, `--bg-escuro #121212`.
- [ ] Trocar literais espalhadas; alinhar dark-theme a `#121212`. Mantém verde/azul/laranja do consolidado.

### J. Consolidado/anos
- [ ] Anos dinâmicos também no `#anoConsolidado`; pré-selecionar ano atual nos dois selects.

### K. Limpeza e segurança
- [ ] Remover `abrirPopupResumo` duplicada (manter `app.js:1398-1442`).
- [ ] Remover bloco comentado "Baixar PDF" (`index.html:167-173`).
- [ ] `escaparHtml()` aplicado em popups e listagens (usuário digita local/observações/nome).
- [ ] Certificar que `firebase-config.js` está publicado e cache invalidado.

---

## 3. Ordem sugerida de execução

1. `src/utils.js`: helpers `numero`/`toBRL` + cálculos centralizados (itens B, A).
2. Aplicar helpers na leitura (A) — base para resumo/consolidado/edição.
3. Recorrência + observações (C).
4. Perfil/Google/erros (E), contador (F).
5. Exportação (G).
6. Tela inicial + paleta/tema (H, I).
7. Anos (J) e limpeza/segurança (K).

## 4. Como verificar (aceite)

- Rodar local: `python3 -m http.server 8080` em `web/`.
- Login e-mail + Google; conta nova cria perfil em `usuarios/{uid}`.
- Plantão único e recorrente (3 tipos) — conferir no Firestore: valores,
  `valorHora` derivado do valorCheio, `(Recorrente)` sem espaço inicial, datas
  futuras.
- Resumo e consolidado abrindo com dados legados (string E número); anos
  dinâmicos.
- Exportar CSV (abre no Excel com acento OK e números com vírgula), PDF e ICS
  (baixável e importável no Agenda/Google).
- `contador@contador.com` vê apenas Financeiro e não consegue editar/excluir.
- Tema claro/escuro e layout novo da home em mobile (>=360px).