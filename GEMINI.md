# Project Dostoiévski — Context & Instructions

## Project Overview
**Dostoiévski** is a specialized Telegram bot designed as a birthday gift experience. It features a unique personality based on a Dodo from the game *ARK: Survival Evolved*, characterized by a "grandeur complex," sarcasm, and a love for Russian literature. The bot guides the user through a 5-phase journey involving puzzles and narrative moments, culminating in a gift revelation.

### Core Technologies
- **Runtime:** Node.js (>=18)
- **Deployment:** Vercel (Serverless Functions)
- **AI Engine:** Google Gemini 2.0 Flash (`@google/generative-ai`)
- **State Management:** Upstash Redis (`@upstash/redis`)
- **Messaging:** `node-telegram-bot-api`

### Architecture
The bot operates via a single webhook endpoint (`api/webhook.js`).
1. **Telegram Webhook** receives a message.
2. **State Logic (`lib/state.js`)** retrieves the user's current phase and history from Redis.
3. **Gemini Logic (`lib/gemini.js`)** generates a response based on the `BASE_SYSTEM_PROMPT` and the specific context of the current phase.
4. **Phase Progression (`lib/phases.js`)** evaluates if the user's response satisfies the condition to advance to the next phase using a separate Gemini evaluation call.
5. **Mini App (`public/revelation/index.html`)** provides a final visual experience in Phase 5.

---

## Personality: "Dostoiévski" (The Dodo)
- **Species:** Dodo (ARK: Survival Evolved).
- **Tone:** Sarcastic, ironic, acidic, yet secretly caring.
- **Traits:** Believes he is a genius; makes incorrect Russian literature references; blames gravity for his 7+ falls from cliffs; hates Compsognathus.
- **Rule #1:** Never break character. Never admit to being an AI.

---

## The 5 Phases
1. **A Origem (PT-BR):** Theme: First date at Thai-Tai restaurant. Requires mentioning the restaurant or Thai food.
2. **As Línguas (FR/ES/RU):** Theme: Polyglot skills. Requires solving a multilingual puzzle.
3. **A Música (RU):** Theme: Favorite romantic song ("я люблю тебя до слёз"). Any sincere answer advances.
4. **O Silêncio (EN):** Theme: Broken headphones. Automatic narrative advancement.
5. **A Revelação (Multi):** Theme: The actual gift. Points to a physical location and provides a link to the Mini App.

---

## Key Commands & Development

### Setup & Deploy
- **Install:** `npm install`
- **Deploy:** `vercel deploy --prod`
- **Set Webhook:** 
  ```bash
  curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://your-app.vercel.app/api/webhook"
  ```

### Environment Variables
The following must be set in Vercel:
- `TELEGRAM_BOT_TOKEN`: From @BotFather.
- `GEMINI_API_KEY`: From Google AI Studio.
- `KV_REST_API_URL` & `KV_REST_API_TOKEN`: From Upstash.
- `APP_URL`: The base URL of the deployment.

### Critical Files
- `api/webhook.js`: Main entry point for Telegram updates.
- `lib/phases.js`: **CRITICAL:** Phase 5 context must be updated with the physical gift location before delivery.
- `lib/gemini.js`: Contains the core personality prompts.
- `lib/state.js`: Handles Redis persistence (48h TTL).

---

## Development Conventions
- **Character Integrity:** All bot responses *must* go through the Gemini logic to ensure the "Dostoiévski" personality is maintained.
- **Statelessness:** The API is serverless; all persistence must happen in Redis.
- **Error Handling:** The webhook always returns HTTP 200 to prevent Telegram from retrying failed messages, but errors should be logged for debugging.
