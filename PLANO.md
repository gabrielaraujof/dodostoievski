# 🦤 Projeto Dostoiévski — Plano Técnico Completo

> Bot de aniversário no Telegram com personalidade de Dodo do ARK, alimentado por Gemini, hospedado na Vercel com Redis (Upstash).

---

## Arquitetura

```
Telegram App (usuária)
        │
        ▼
Vercel Serverless — api/webhook.js
        │
        ├──► Gemini 2.0 Flash (personalidade + fases)
        └──► Upstash Redis (estado da jornada)
                │
                └──► Mini App HTML (Fase 5 — revelação visual)
```

---

## Estrutura de Arquivos

```
dosto-bot/
├── api/
│   └── webhook.js          ← Serverless function principal
├── lib/
│   ├── gemini.js            ← Client Gemini + system prompt
│   ├── phases.js            ← 5 fases com contextos e condições
│   └── state.js             ← Leitura/escrita Upstash Redis
├── public/
│   └── revelation/
│       └── index.html       ← Mini App visual da Fase Final
├── .env.example
├── package.json
├── vercel.json
└── PLANO.md                 ← Este arquivo
```

---

## Variáveis de Ambiente

Configure na Vercel → Settings → Environment Variables:

| Variável | Onde pegar |
|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather no Telegram |
| `GEMINI_API_KEY` | Google AI Studio |
| `KV_REST_API_URL` | Upstash Console → REST API |
| `KV_REST_API_TOKEN` | Upstash Console → REST API |
| `APP_URL` | URL do seu projeto na Vercel (ex: `https://dosto-bot.vercel.app`) |

---

## As 5 Fases da Jornada

### Fase 1 — A Origem 🟠
- **Idioma:** Português Brasileiro
- **Cor:** Laranja quente
- **Tema:** Primeiro encontro no restaurante Thai-Tai
- **Puzzle:** Pergunta sobre o encontro que só ela saberia responder
- **Condição de avanço:** Mencionar o Thai-Tai ou comida tailandesa

### Fase 2 — As Línguas 🔵
- **Idioma:** Francês + Espanhol (surpresa em Russo)
- **Cor:** Azul profundo
- **Tema:** Paixão pelos 5+ idiomas
- **Puzzle:** Mensagem com palavras-chave em idiomas diferentes
- **Condição de avanço:** Resolver o puzzle multilíngue

### Fase 3 — A Música 🟣
- **Idioma:** Russo
- **Cor:** Roxo carmesim
- **Tema:** "я люблю тебя до слёз"
- **Dinâmica:** Sem puzzle — ela responde o que a música significa
- **Condição de avanço:** Qualquer resposta sincera

### Fase 4 — O Silêncio 🩶
- **Idioma:** Inglês
- **Cor:** Cinza suave
- **Tema:** Os fones quebrados
- **Dinâmica:** Narrativa pura — sem puzzle, sem espera
- **Condição de avanço:** Automática após entregar a mensagem

### Fase 5 — A Revelação 🌈
- **Idioma:** Todos
- **Cor:** Arco-íris
- **Dinâmica:** Mensagem final + botão do Mini App visual
- **Mini App:** Explosão de partículas coloridas, verso em russo, confetti
- **⚠️ LEMBRETE:** Edite em `lib/phases.js` a instrução de onde está o presente físico!

---

## Personalidade do Dostoiévski

```
Nome:     Dostoiévski
Espécie:  Dodo — ARK: Survival Evolved
Tom:      Humor ácido, irônico, sarcástico — mas carinhoso nas entrelinhas
Traços:   Complexo de grandeza absurdo, referências russas levemente incorretas,
          nunca admite estar emocionado ("é poeira"), já caiu de penhasco 7x
Regra #1: JAMAIS quebra o personagem
Emoji:    🦤
```

---

## Checklist de Deploy

- [ ] `npm install` no projeto
- [ ] Variáveis configuradas na Vercel
- [ ] Primeiro `vercel deploy` feito
- [ ] Webhook registrado:
  ```
  GET https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<projeto>.vercel.app/api/webhook
  ```
- [ ] Webhook verificado:
  ```
  GET https://api.telegram.org/bot<TOKEN>/getWebhookInfo
  ```
- [ ] **Editar `lib/phases.js` Fase 5** — inserir local onde o presente está escondido
- [ ] Testar `/start` no bot
- [ ] Testar progressão completa das 5 fases

---

## Ajustes Que Você Precisa Fazer

### 1. Local do presente (OBRIGATÓRIO)
Em `lib/phases.js`, na Fase 5, substitua:
```
onde [INSERIR LOCAL DO PRESENTE AQUI]
```
pelo local real onde você vai esconder o AirPods.

### 2. Nome dela no sistema
Em `api/webhook.js`, o bot usa `first_name` do Telegram automaticamente.

### 3. Puzzle da Fase 1
O Gemini vai criar o puzzle dinamicamente, mas você pode reforçar dicas específicas
do encontro no Thai-Tai no contexto da Fase 1 em `lib/phases.js`.

### 4. Mensagem de ativação
Combine com ela que o presente começa quando ela abrir o bot e mandar `/start`.
Ou mande o link direto: `https://t.me/<nome_do_bot>?start=birthday`

---

## Registrar Webhook (após deploy)

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://SEU_PROJETO.vercel.app/api/webhook" \
  -d "allowed_updates=[\"message\",\"callback_query\"]"
```

---

## Dependências

```json
{
  "@google/generative-ai": "^0.21.0",
  "@upstash/redis": "^1.34.3",
  "node-telegram-bot-api": "^0.66.0"
}
```

---

## Notas de Desenvolvimento

- O estado (fase atual + histórico) fica no Upstash Redis com TTL de 48h
- O Gemini usa `gemini-2.0-flash` — rápido e custo baixo para este uso
- Um segundo modelo Gemini avalia se a condição de avanço foi cumprida (avaliador separado)
- O Mini App (`/revelation`) é HTML estático servido pela própria Vercel
- Serverless timeout configurado para 30s no `vercel.json` (suficiente para 2 chamadas ao Gemini)
- Sempre retorna HTTP 200 pro Telegram mesmo em erro (evita reenvio de updates)
