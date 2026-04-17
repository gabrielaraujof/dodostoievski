import TelegramBot from "node-telegram-bot-api";
import { getState, setState, resetState } from "../lib/state.js";
import { generateResponse, shouldAdvancePhase, summarizeHistory } from "../lib/gemini.js";
import { getPhase } from "../lib/phases.js";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// ─── Emojis válidos para reação no Telegram ───────────────────────────────
const VALID_REACTION_EMOJIS = new Set([
  "👍","👎","❤️","🔥","🥰","👏","😁","🤔","🤯","😱",
  "🤬","😢","🎉","🤩","🤮","💩","🙏","👌","🕊","🤡",
  "🥱","🥴","😍","🐳","❤‍🔥","🌚","🌭","💯","🤣","⚡",
  "🍌","🏆","💔","🤨","😐","🍓","Escolha","💋","🖕","😈",
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
    console.warn("Reaction failed:", e.message);
  }
}

// ─── Envia resposta em burst de bolhas ────────────────────────────────────
async function burstToTelegram(chatId, userMessage, userMsgId, state) {
  const fullRawResponse = await generateResponse(userMessage, state);

  const bubbles = fullRawResponse
    .split(/[\s\[*]*BOLHA[\s\]*]*/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  let reactionSent = false;
  let lastSentMsgId = null;

  for (let i = 0; i < bubbles.length; i++) {
    const { emoji, text } = parseReaction(bubbles[i]);

    if (emoji && !reactionSent && userMsgId) {
      await reactToMessage(chatId, userMsgId, emoji);
      reactionSent = true;
    }

    if (!text) continue;

    await bot.sendChatAction(chatId, "typing");
    const delay = Math.min(Math.max(text.length * 12, 400), 1200);
    await new Promise((r) => setTimeout(r, delay));

    try {
      const sent = await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
      lastSentMsgId = sent.message_id;
    } catch {
      const sent = await bot.sendMessage(chatId, text);
      lastSentMsgId = sent.message_id;
    }
  }

  // Guardrail: se o Dodo esqueceu da pergunta, injeta provocação
  const lastBubble = bubbles[bubbles.length - 1] || "";
  if (!/[?!\n]$/.test(lastBubble)) {
    const fallbacks = ["Vai responder ou não?", "O silêncio dos primatas é ensurdecedor.", "Perdeu a língua?", "Responda."];
    const extra = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    await new Promise(r => setTimeout(r, 500));
    const sentExtra = await bot.sendMessage(chatId, extra).catch(() => {});
    if (sentExtra) lastSentMsgId = sentExtra.message_id;
  }

  return bubbles.map((b) => parseReaction(b).text).filter(Boolean).join(" ");
}

// ─── Handler principal ────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, message: "Dostoiévski aguarda. 🦤" });
  }

  let BASE_URL = process.env.APP_URL || "";
  if (!BASE_URL) {
    const host = req.headers.host;
    BASE_URL = host ? `https://${host}` : "";
  }
  if (BASE_URL.endsWith("/")) BASE_URL = BASE_URL.slice(0, -1);

  try {
    const update = req.body;

    // ── /reset ──────────────────────────────────────────────────────────
    if (update.message?.text === "/reset") {
      await resetState(update.message.from.id);
      await bot.sendMessage(update.message.chat.id, "✨ Memória apagada. Use /start para recomeçar.");
      return res.status(200).json({ ok: true });
    }

    // ── /start ──────────────────────────────────────────────────────────
    if (update.message?.text === "/start") {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;

      const state = await getState(userId);
      if (state.phase === 5) {
        await bot.sendMessage(chatId, "A revelação já ocorreu. O que mais você quer de mim? Apenas prossiga com a sua vida.");
        return res.status(200).json({ ok: true });
      }

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
          inline_keyboard: [[{ text: "🟠 Primeiro Enigma", web_app: { url: `${BASE_URL}/app/?phase=1` } }]],
        },
      });

      return res.status(200).json({ ok: true });
    }

    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const userMsgId = update.message.message_id;
      const userMessage = update.message.text;

      const state = await getState(userId);

      const aiResponse = await burstToTelegram(chatId, userMessage, userMsgId, state);

      const advance = await shouldAdvancePhase(userMessage, aiResponse, state);

      let history = [
        ...state.history,
        { role: "user", content: userMessage },
        { role: "assistant", content: aiResponse },
      ];

      let currentSummary = state.summary || "";

      if (history.length > 12) {
        const toSummarize = history.slice(0, 8);
        const freshHistory = history.slice(8);
        currentSummary = await summarizeHistory(toSummarize, currentSummary);
        history = freshHistory;
      }

      let newPhase = state.phase;
      let newSubstate = state.substate;

      if (advance && state.phase < 5) {
        newPhase = state.phase + 1;
        newSubstate = "puzzle";
        const nextPhase = getPhase(newPhase);

        await new Promise((r) => setTimeout(r, 1200));

        const buttonUrl = newPhase === 5 ? `${BASE_URL}/revelation/` : `${BASE_URL}/app/?phase=${newPhase}`;
        const buttonText = newPhase === 5 ? "🌈 Revelação Final" : `✨ Próximo Enigma`;

        await bot.sendMessage(chatId, "↓", {
          reply_markup: {
            inline_keyboard: [[{ text: buttonText, web_app: { url: buttonUrl } }]],
          },
        });
      } else if (state.phase === 5) {
        // Se já está na fase 5, garante que o modo de conversa é livre
        newSubstate = "free_chat";
      }

      await setState(userId, {
        phase: newPhase,
        substate: newSubstate,
        history: history,
        summary: currentSummary,
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(200).json({ ok: true });
  }
}
