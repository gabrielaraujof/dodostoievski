import TelegramBot from "node-telegram-bot-api";
import { getState, setState, resetState } from "../lib/state.js";
import { generateResponse, shouldAdvancePhase } from "../lib/gemini.js";
import { getPhase } from "../lib/phases.js";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// ─── Emojis válidos para reação no Telegram ───────────────────────────────
const VALID_REACTION_EMOJIS = new Set([
  "👍","👎","❤️","🔥","🥰","👏","😁","🤔","🤯","😱",
  "🤬","😢","🎉","🤩","🤮","💩","🙏","👌","🕊","🤡",
  "🥱","🥴","😍","🐳","❤‍🔥","🌚","🌭","💯","🤣","⚡",
  "🍌","🏆","💔","🤨","😐","🍓","🍾","💋","🖕","😈",
  "😴","😭","🤓","👻","👨‍💻","👀","🎃","🙈","😇","😂",
  "🥲","🤝","🎁"
]);

// ─── Extrai reação e texto limpo de uma bolha ─────────────────────────────
function parseReaction(bubbleText) {
  const match = bubbleText.match(/\[REAÇÃO:\s*([^\]]+)\]/i);
  if (!match) return { emoji: null, text: bubbleText.trim() };

  const emoji = match[1].trim();
  const text = bubbleText.replace(/\[REAÇÃO:[^\]]+\]/i, "").trim();
  const validEmoji = VALID_REACTION_EMOJIS.has(emoji) ? emoji : null;

  return { emoji: validEmoji, text };
}

// ─── Reage à mensagem do usuário ──────────────────────────────────────────
async function reactToMessage(chatId, messageId, emoji) {
  if (!emoji || !messageId) return;
  try {
    await bot._request("setMessageReaction", {
      form: {
        chat_id: chatId,
        message_id: messageId,
        reaction: JSON.stringify([{ type: "emoji", emoji }]),
      },
    });
  } catch (e) {
    // Reações podem falhar silenciosamente (emoji inválido, msg antiga, etc.)
    console.warn("Reaction failed:", e.message);
  }
}

// ─── Envia resposta em burst de bolhas ────────────────────────────────────
async function burstToTelegram(chatId, userMessage, userMsgId, state) {
  const fullRawResponse = await generateResponse(userMessage, state);

  // Divide em bolhas pelo marcador [BOLHA]
  const bubbles = fullRawResponse
    .split(/[\s\[*]*BOLHA[\s\]*]*/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  let reactionSent = false; // Garante no máximo 1 reação por burst

  for (let i = 0; i < bubbles.length; i++) {
    const { emoji, text } = parseReaction(bubbles[i]);

    // Reage à mensagem do usuário durante o burst (antes desta bolha)
    // Só dispara se houver emoji válido e ainda não tiver reagido
    if (emoji && !reactionSent && userMsgId) {
      await reactToMessage(chatId, userMsgId, emoji);
      reactionSent = true;
    }

    if (!text) continue;

    // Delay de digitação proporcional ao texto (máx 1.5s para não estourar timeout)
    await bot.sendChatAction(chatId, "typing");
    const delay = Math.min(Math.max(text.length * 12, 400), 1500);
    await new Promise((r) => setTimeout(r, delay));

    try {
      await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
    } catch {
      // Fallback se o Markdown estiver malformado
      await bot.sendMessage(chatId, text);
    }
  }

  // Retorna texto limpo (sem marcadores) para salvar no histórico
  return bubbles
    .map((b) => parseReaction(b).text)
    .filter(Boolean)
    .join(" ");
}

// ─── Handler principal ────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, message: "Dostoiévski aguarda. 🦤" });
  }

  // Resolve BASE_URL
  let BASE_URL = process.env.APP_URL || "";
  if (!BASE_URL) {
    const host = req.headers.host;
    BASE_URL = host ? `https://${host}` : "";
  }
  if (BASE_URL.endsWith("/")) BASE_URL = BASE_URL.slice(0, -1);

  try {
    const update = req.body;

    // ── /start ──────────────────────────────────────────────────────────
    if (update.message?.text === "/start") {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;

      await resetState(userId);

      const welcome = `*Dostoiévski olha para você com um ar de superioridade.* 🦤\n\nAh. Finalmente chegou. Eu já esperava — a gravidade me arremessou aqui e fui designado para guiá-la.\n\nCinco enigmas. À altura da minha inteligência, e talvez da sua. Veremos.\n\nHá um lugar em São Paulo onde tudo começou. Aromas de um país distante. Dois mundos se encontrando pela primeira vez.\n\nVocê se lembra?`;

      await setState(userId, {
        phase: 1,
        substate: "puzzle",
        history: [{ role: "assistant", content: welcome }],
      });

      await bot.sendMessage(chatId, welcome, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "🟠 Primeiro Enigma", web_app: { url: `${BASE_URL}/app/?phase=1` } },
          ]],
        },
      });

      return res.status(200).json({ ok: true });
    }

    // ── Mensagem de texto normal ─────────────────────────────────────────
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const userMsgId = update.message.message_id;
      const userMessage = update.message.text;

      const state = await getState(userId);

      // Gera e envia resposta em burst
      const aiResponse = await burstToTelegram(chatId, userMessage, userMsgId, state);

      // Avalia se deve avançar de fase
      const advance = await shouldAdvancePhase(userMessage, aiResponse, state);

      const newHistory = [
        ...state.history,
        { role: "user", content: userMessage },
        { role: "assistant", content: aiResponse },
      ].slice(-10); // mantém últimas 10 mensagens

      let newPhase = state.phase;
      let newSubstate = state.substate;

      if (advance && state.phase < 5) {
        newPhase = state.phase + 1;
        newSubstate = "puzzle";
        const nextPhase = getPhase(newPhase);

        // Pequena pausa dramática antes do botão
        await new Promise((r) => setTimeout(r, 1200));

        const buttonUrl = newPhase === 5
          ? `${BASE_URL}/revelation/`
          : `${BASE_URL}/app/?phase=${newPhase}`;

        const buttonText = newPhase === 5
          ? "🌈 Revelação Final"
          : `✨ Próximo Enigma`;

        // Botão sem anunciar "fase X" — o Dostoiévski já anunciou no texto
        await bot.sendMessage(chatId, "↓", {
          reply_markup: {
            inline_keyboard: [[{ text: buttonText, web_app: { url: buttonUrl } }]],
          },
        });
      }

      await setState(userId, {
        phase: newPhase,
        substate: newSubstate,
        history: newHistory,
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(200).json({ ok: true }); // Sempre 200 pro Telegram
  }
}
