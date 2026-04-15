import TelegramBot from "node-telegram-bot-api";
import { getState, setState, resetState } from "../lib/state.js";
import { generateResponse, shouldAdvancePhase } from "../lib/gemini.js";
import { getPhase } from "../lib/phases.js";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

/**
 * Envia mensagens em "burst" (múltiplas bolhas) para simular chat humano.
 */
async function burstToTelegram(chatId, userMessage, state) {
  const fullRawResponse = await generateResponse(userMessage, state);
  
  // Divide por [BOLHA] ou apenas BOLHA no início de linhas/frases
  const bubbles = fullRawResponse
    .split(/\[?BOLHA\]?/i)
    .map(b => b.trim())
    .filter(b => b.length > 0);

  let lastMsgId = state.lastMessageId;

  for (let i = 0; i < bubbles.length; i++) {
    let text = bubbles[i];

    // Reações nativas: [REAÇÃO:emoji] ou REAÇÃO:emoji
    const reactionMatch = text.match(/\[?REAÇÃO:(.+?)\]?/i);
    if (reactionMatch) {
      const emoji = reactionMatch[1].trim();
      text = text.replace(/\[?REAÇÃO:.+?\]?/i, "").trim();
      if (lastMsgId) {
        await bot._request("setMessageReaction", {
          form: { 
            chat_id: chatId, 
            message_id: lastMsgId, 
            reaction: [{ type: "emoji", emoji: emoji }] 
          }
        }).catch(() => {});
      }
    }

    if (text.length === 0) continue;

    // Tempo de digitação proporcional
    await bot.sendChatAction(chatId, "typing");
    const typingDelay = Math.min(Math.max(text.length * 35, 1000), 3000);
    await new Promise(r => setTimeout(r, typingDelay));

    const sent = await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
    lastMsgId = sent.message_id;
  }

  // Retorna texto limpo para o histórico
  return bubbles.map(b => b.replace(/\[REAÇÃO:.+?\]/i, "").trim()).join(" ");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, message: "Webhook ativo 🦤" });
  }

  let BASE_URL = process.env.APP_URL;
  if (!BASE_URL) {
    const host = req.headers.host;
    BASE_URL = host ? `https://${host}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  }
  if (BASE_URL.endsWith("/")) BASE_URL = BASE_URL.slice(0, -1);

  try {
    const update = req.body;

    if (update.message?.text === "/start") {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const firstName = update.message.from.first_name || "você";

      await resetState(userId);

      const welcomeMessage = `*Dostoiévski olha para você com um ar de superioridade.* 🦤\n\nAh. Finalmente. Eu já esperava. A gravidade me jogou aqui, e eu fui designado para guiá-la.\n\n5 fases. 5 desafios à altura da minha inteligência — e talvez da sua. Veremos.\n\nHá um lugar em SP onde tudo começou. Aromas de um país distante. Dois mundos se encontrando pela primeira vez.\n\nVocê se lembra?`;

      await setState(userId, {
        phase: 1,
        substate: "puzzle",
        history: [{ role: "assistant", content: welcomeMessage }],
      });

      await bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "🟠 Abrir Puzzle: A Origem", web_app: { url: `${BASE_URL}/app/?phase=1` } }]],
        },
      });

      return res.status(200).json({ ok: true });
    }

    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const userMessage = update.message.text;

      const state = await getState(userId);

      // Resposta em Bursts
      const aiResponse = await burstToTelegram(chatId, userMessage, state);

      const shouldAdvance = await shouldAdvancePhase(userMessage, aiResponse, state);

      const newHistory = [
        ...state.history,
        { role: "user", content: userMessage },
        { role: "assistant", content: aiResponse },
      ].slice(-8);

      let newPhase = state.phase;
      let newSubstate = state.substate;

      if (shouldAdvance && state.phase < 5) {
        newPhase = state.phase + 1;
        newSubstate = "puzzle";
        const nextPhase = getPhase(newPhase);

        const transitionMsg = `*— FASE ${newPhase}: ${nextPhase.name.toUpperCase()} —*`;
        await new Promise(r => setTimeout(r, 1500));
        await bot.sendMessage(chatId, transitionMsg, { parse_mode: "Markdown" });

        const buttonUrl = newPhase === 5 ? `${BASE_URL}/revelation/` : `${BASE_URL}/app/?phase=${newPhase}`;
        const buttonText = newPhase === 5 ? "🌈 Abrir Revelação Final" : `✨ Abrir Puzzle: ${nextPhase.name}`;

        await bot.sendMessage(chatId, "O próximo passo aguarda:", {
          reply_markup: {
            inline_keyboard: [[{ text: buttonText, web_app: { url: buttonUrl } }]],
          },
        });
      } else if (state.substate === "puzzle") {
        const currentPhase = getPhase(state.phase);
        await bot.sendMessage(chatId, "Ainda travada? Use o Mini App:", {
          reply_markup: {
            inline_keyboard: [[{ text: `🟠 Abrir Puzzle: ${currentPhase.name}`, web_app: { url: `${BASE_URL}/app/?phase=${state.phase}` } }]],
          },
        });
      }

      await setState(userId, { 
        phase: newPhase, 
        substate: newSubstate, 
        history: newHistory,
        lastMessageId: state.lastMessageId // Mantido pela burstToTelegram
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(200).json({ ok: true });
  }
}
