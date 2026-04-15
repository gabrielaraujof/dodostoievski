import TelegramBot from "node-telegram-bot-api";
import { getState, setState, resetState } from "../lib/state.js";
import { generateResponse, shouldAdvancePhase } from "../lib/gemini.js";
import { getPhase } from "../lib/phases.js";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// URL base do seu projeto na Vercel
const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.APP_URL;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, message: "Webhook ativo 🦤" });
  }

  try {
    const update = req.body;

    // Comando /start — inicia ou reinicia a jornada
    if (update.message?.text === "/start") {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const firstName = update.message.from.first_name || "você";

      await resetState(userId);

      const welcomeMessage = `
🦤 *Dostoiévski olha para você com um ar de superioridade inexplicável para um pássaro que não voa.*

Ah. Finalmente chegou. Eu já esperava. Bem... não *eu* esperava, foi a gravidade que me jogou aqui neste chat. Mas já que estamos aqui...

Meu nome é *Dostoiévski*. Sou um Dodo. Não qualquer Dodo — O Dodo. E fui designado — contra minha vontade, diga-se — para guiá-la em uma jornada hoje.

São 5 fases. Cada uma tem um desafio à altura de sua inteligência. Ou pelo menos, à altura do que eu imagino ser sua inteligência. Veremos.

Vamos começar pelo começo. E o começo, como dizia Tolstói... ou era Tchekhov?... bem, alguém disse algo sobre começos.

*Primeira questão, ${firstName}:*
Há um lugar em São Paulo onde tudo começou. Um lugar com aromas de um país distante, onde dois mundos se encontraram pela primeira vez.

Você se lembra? 🦤
      `;

      await bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
      await setState(userId, {
        phase: 1,
        history: [{ role: "assistant", content: welcomeMessage }],
      });

      return res.status(200).json({ ok: true });
    }

    // Mensagens de texto normais
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const userMessage = update.message.text;

      // Carrega estado atual
      const state = await getState(userId);

      // Gera resposta do Dostoiévski
      const aiResponse = await generateResponse(userMessage, state);

      // Verifica se deve avançar de fase
      const shouldAdvance = await shouldAdvancePhase(
        userMessage,
        aiResponse,
        state.phase
      );

      // Atualiza histórico
      const newHistory = [
        ...state.history,
        { role: "user", content: userMessage },
        { role: "assistant", content: aiResponse },
      ].slice(-20); // mantém últimas 20 mensagens

      let newPhase = state.phase;

      if (shouldAdvance && state.phase < 5) {
        newPhase = state.phase + 1;
        const nextPhase = getPhase(newPhase);

        // Mensagem de transição de fase
        const transitionMsg = `
━━━━━━━━━━━━━━━━━━━━━━
🦤 *FASE ${newPhase} DESBLOQUEADA — "${nextPhase.name}"*
━━━━━━━━━━━━━━━━━━━━━━
        `;
        await bot.sendMessage(chatId, transitionMsg, { parse_mode: "Markdown" });
      }

      // Se chegou na fase final, envia o Mini App button
      if (newPhase === 5 && state.phase !== 5) {
        await bot.sendMessage(chatId, aiResponse, { parse_mode: "Markdown" });

        // Inline keyboard com o Mini App
        await bot.sendMessage(chatId, "✨ Abra a revelação:", {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🌈 Abrir Revelação",
                  web_app: { url: `${BASE_URL}/revelation/` },
                },
              ],
            ],
          },
        });
      } else {
        await bot.sendMessage(chatId, aiResponse, { parse_mode: "Markdown" });
      }

      // Salva novo estado
      await setState(userId, { phase: newPhase, history: newHistory });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(200).json({ ok: true }); // Sempre 200 pro Telegram
  }
}
