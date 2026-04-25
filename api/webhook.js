import TelegramBot from "node-telegram-bot-api";
import { getState, setState, resetState } from "../lib/state.js";
import { generateResponse, shouldAdvancePhase, summarizeHistory } from "../lib/gemini.js";
import { getPhase } from "../lib/phases.js";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// IMPORTANTE: O webhook deve ser registrado com allowed_updates incluindo "poll_answer".
// Use: ["message", "callback_query", "poll_answer"]

const THAI_TAI_PHOTO = process.env.THAI_TAI_PHOTO_ID || "";

const PHASE1_CAPTION = `*Dostoiévski olha para você com um ar de superioridade.* 🦤

Ah. Finalmente chegou.

Enigmas. À altura da minha inteligência — e talvez da sua.

Há um lugar em São Paulo onde tudo começou. Aromas de um país distante. Uma reação alérgica memorável. Um plano que falhou e um que salvou a noite.

Você se lembra do nome desse lugar?`;

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

      await setState(userId, {
        phase: 1,
        substate: "puzzle",
        chatId: chatId,
        history: [{ role: "assistant", content: PHASE1_CAPTION }],
      });

      if (THAI_TAI_PHOTO) {
        await bot.sendPhoto(chatId, THAI_TAI_PHOTO, {
          caption: PHASE1_CAPTION,
          parse_mode: "Markdown",
        });
      } else {
        await bot.sendMessage(chatId, PHASE1_CAPTION, {
          parse_mode: "Markdown",
        });
      }

      return res.status(200).json({ ok: true });
    }

    // ── poll_answer (Respostas de Quiz) ─────────────────────────────────
    if (update.poll_answer) {
      const userId = update.poll_answer.user.id;
      const optionIds = update.poll_answer.option_ids;
      const state = await getState(userId);
      const phase = getPhase(state.phase);

      if (phase.advanceType !== "poll") return res.status(200).json({ ok: true });

      const isCorrect = optionIds.includes(phase.correctOptionId);

      if (!isCorrect) {
        if (state.chatId) {
          await bot.sendMessage(state.chatId, "Errado. Tente de novo — ou admita a derrota. 🦤");
        }
        return res.status(200).json({ ok: true });
      }

      const newState = { ...state, substate: "chat" };
      await setState(userId, newState);

      if (state.chatId) {
        await burstToTelegram(
          state.chatId,
          "[SINAL: A usuária acertou o quiz. Parabenize com ironia e prepare-a para o próximo passo da fase.]",
          null,
          newState
        );
      }

      return res.status(200).json({ ok: true });
    }

    // ── callback_query (Botões Inline) ───────────────────────────────
    if (update.callback_query) {
      const chatId = update.callback_query.message.chat.id;
      const userId = update.callback_query.from.id;
      const data = update.callback_query.data;

      const state = await getState(userId);

      if (data === "solve_phase_4_purse") {
        await bot.answerCallbackQuery(update.callback_query.id, { text: "Estratégia validada! 🦤" });
        await bot.editMessageText("*Estratégia da Bolsa:* Validada com sucesso. Você finalmente parou de esquecer o óbvio.", {
          chat_id: chatId,
          message_id: update.callback_query.message.message_id,
          parse_mode: "Markdown"
        });

        // Avança para o chat da fase 4
        await setState(userId, { ...state, substate: "chat" });
        await burstToTelegram(chatId, "[SINAL: O usuário escolheu a Estratégia da Bolsa]", null, { ...state, substate: "chat" });
        return res.status(200).json({ ok: true });
      }

      if (data.startsWith("wrong_phase_4")) {
        await bot.answerCallbackQuery(update.callback_query.id, { text: "Errado! Tente novamente, humano.", show_alert: true });
        return res.status(200).json({ ok: true });
      }

      return res.status(200).json({ ok: true });
    }

    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const userMsgId = update.message.message_id;
      const userMessage = update.message.text;

      const currentState = await getState(userId);
      if (!currentState.chatId) {
        await setState(userId, { ...currentState, chatId });
      }
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

        const nextPhase = getPhase(newPhase);

        if (nextPhase.advanceType === "poll") {
          await new Promise(r => setTimeout(r, 1200));
          await bot.sendPoll(chatId, nextPhase.pollQuestion, nextPhase.pollOptions, {
            type: "quiz",
            correct_option_id: nextPhase.correctOptionId,
            is_anonymous: false,
            explanation: "Dostoiévski sabia. Você deveria também. 🦤",
          });
          await setState(userId, {
            phase: newPhase,
            substate: "puzzle",
            history: state.history,
            summary: state.summary || "",
            chatId: chatId,
          });
          return res.status(200).json({ ok: true });
        }

        newSubstate = "puzzle";
        const nextPhaseObj = getPhase(newPhase);

        await new Promise((r) => setTimeout(r, 1200));

        let inline_keyboard = [];
        if (newPhase === 4) {
          // Fase 4 é resolvida no chat com botões
          inline_keyboard = [
            [{ text: "💼 Bolso da Calça", callback_data: "wrong_phase_4_pocket" }],
            [{ text: "🚗 Porta-luvas do Carro", callback_data: "wrong_phase_4_car" }],
            [{ text: "👜 Dentro da Bolsa", callback_data: "solve_phase_4_purse" }]
          ];
          await bot.sendMessage(chatId, "*Dostoiévski pergunta:* Como você finalmente garantiu que os fones estariam com você para o conserto?", {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard }
          });
        } else {
          const buttonUrl = newPhase === 5 ? `${BASE_URL}/revelation/` : `${BASE_URL}/app/?phase=${newPhase}`;
          const buttonText = newPhase === 5 ? "🌈 Revelação Final" : `✨ Próximo Enigma`;
          inline_keyboard = [[{ text: buttonText, web_app: { url: buttonUrl } }]];
          await bot.sendMessage(chatId, "↓", {
            reply_markup: { inline_keyboard }
          });
        }
      } else if (state.phase === 5) {
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
