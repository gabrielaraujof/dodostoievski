import TelegramBot from "node-telegram-bot-api";
import { getState, setState, resetState } from "../lib/state.js";
import { generateResponse, shouldAdvancePhase, summarizeHistory } from "../lib/gemini.js";
import { getPhase } from "../lib/phases.js";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// IMPORTANTE: O webhook deve ser registrado com allowed_updates incluindo "poll_answer".
// Use: ["message", "callback_query", "poll_answer"]

const THAI_TAI_PHOTO = process.env.THAI_TAI_PHOTO_ID || "";

// ─── Emojis válidos para reação no Telegram ───────────────────────────────
const VALID_REACTION_EMOJIS = new Set([
  "👍","👎","❤️","🔥","🥰","👏","😁","🤔","🤯","😱",
  "🤬","😢","🎉","🤩","🤮","💩","🙏","👌","🕊","🤡",
  "🥱","🥴","😍","🐳","❤‍🔥","🌚","🌭","💯","🤣","⚡",
  "🍌","🏆","💔","🤨","😐","🍓","Escolha","💋","🖕","😈",
  "😴","😭","🤓","👻","👨‍💻","👀","🎃","🙈","😇","😂",
  "🥲","🤝","🎁"
]);

// ─── Normaliza string para casamento de respostas (lowercase + sem diacríticos) ───
function normalizeAnswer(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ─── Verifica se a mensagem da usuária bate com algum padrão esperado da fase ───
function matchesExpectedAnswer(message, patterns) {
  if (!patterns || patterns.length === 0) return false;
  const cyrillic = (message || "").toLowerCase();
  const stripped = normalizeAnswer(message);
  for (const raw of patterns) {
    const re = new RegExp(raw, "i");
    if (re.test(cyrillic) || re.test(stripped)) return true;
  }
  return false;
}

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
      const userName = update.message.from.first_name || "humana";

      const state = await getState(userId);
      if (state.phase === 5) {
        await bot.sendMessage(chatId, "A revelação já ocorreu. O que mais você quer de mim? Apenas prossiga com a sua vida.");
        return res.status(200).json({ ok: true });
      }

      await resetState(userId);

      const startState = {
        phase: 1,
        substate: "puzzle",
        chatId,
        history: [],
        summary: "",
      };
      await setState(userId, startState);

      // Foto define o cenário (sem texto fixo — a abertura vem do Dodo)
      if (THAI_TAI_PHOTO) {
        await bot.sendPhoto(chatId, THAI_TAI_PHOTO, { caption: "🦤" }).catch(() => {});
      }

      // Abertura dinâmica: o LLM escreve as boas-vindas em bolhas, usando o
      // contexto da Fase 1 (system prompt) para provocar sobre o primeiro encontro.
      const openingSignal = `[SINAL DE ABERTURA: ${userName} acabou de invocar você com /start. ` +
        `Dê as boas-vindas com seu sarcasmo de Dodo erudito. ` +
        `Anuncie que os enigmas começaram. ` +
        `Provoque-a sobre o primeiro encontro de vocês em São Paulo (sem entregar nomes). ` +
        `Termine convidando-a a relembrar aquela noite — qualquer detalhe basta para começar: o restaurante tailandês, o prato ardido, ou a confeitaria famosa que estava fechada. NÃO afirme que ela acertou nada — ela ainda nem respondeu.]`;

      const openingResponse = await burstToTelegram(chatId, openingSignal, null, startState);

      // Persiste a abertura gerada para manter continuidade nos próximos turnos.
      await setState(userId, {
        ...startState,
        history: [{ role: "assistant", content: openingResponse }],
      });

      return res.status(200).json({ ok: true });
    }

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

      // Acertou: avança para a próxima fase
      const newPhase = state.phase + 1;
      const nextPhase = getPhase(newPhase);
      const newState = { ...state, phase: newPhase, substate: "puzzle" };
      await setState(userId, newState);

      if (state.chatId) {
        // Dodo parabeniza e faz a transição narrativa
        await burstToTelegram(
          state.chatId,
          "[SINAL: A usuária acertou o quiz. Parabenize com ironia e transicione para a próxima fase da narrativa.]",
          null,
          newState
        );

        // Se a próxima fase tem poll, dispara imediatamente
        if (nextPhase.advanceType === "poll") {
          await new Promise(r => setTimeout(r, 2000));
          await bot.sendPoll(state.chatId, nextPhase.pollQuestion, nextPhase.pollOptions, {
            type: "quiz",
            correct_option_id: nextPhase.correctOptionId,
            is_anonymous: false,
            explanation: "Dostoiévski sabia. Você deveria também. 🦤",
          });
        } else if (nextPhase.puzzleSignal) {
          // Fase com enigma gerado pelo LLM via SINAL (Fase 2 cento, Fase 4 cifra)
          await new Promise(r => setTimeout(r, 2000));
          await burstToTelegram(state.chatId, nextPhase.puzzleSignal, null, newState);
        }
      }

      return res.status(200).json({ ok: true });
    }

    // ── callback_query (Botões Inline) ───────────────────────────────
    if (update.callback_query) {
      await bot.answerCallbackQuery(update.callback_query.id).catch(() => {});
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

      // Fase 1 no substate puzzle: valida semanticamente se ela reconheceu o contexto
      // Se sim, transiciona para chat e salva. O avanço para Fase 2 acontece no próximo turno.
      if (state.phase === 1 && state.substate === "puzzle") {
        const solved = await shouldAdvancePhase(userMessage, aiResponse, { ...state, substate: "chat" });
        const newSubstate = solved ? "chat" : "puzzle";
        await setState(userId, {
          ...state,
          substate: newSubstate,
          chatId,
          history: [
            ...state.history,
            { role: "user", content: userMessage },
            { role: "assistant", content: aiResponse },
          ],
          summary: state.summary || "",
        });
        return res.status(200).json({ ok: true });
      }

      // Fases com puzzle baseado em casamento determinístico de resposta
      // (Fase 2 = cento poliglota / Fase 4 = charada da bolsa). Se ela acertar,
      // avança no mesmo turno; senão, fica em puzzle.
      if (state.substate === "puzzle" && getPhase(state.phase).expectedAnswerPatterns) {
        const phase = getPhase(state.phase);
        const solved = matchesExpectedAnswer(userMessage, phase.expectedAnswerPatterns);

        const updatedHistory = [
          ...state.history,
          { role: "user", content: userMessage },
          { role: "assistant", content: aiResponse },
        ].slice(-12);

        if (!solved) {
          await setState(userId, {
            ...state,
            chatId,
            history: updatedHistory,
            summary: state.summary || "",
          });
          return res.status(200).json({ ok: true });
        }

        // Acertou: avança para a próxima fase e dispara o próximo enigma
        const newPhase = state.phase + 1;
        const nextPhase = getPhase(newPhase);

        if (nextPhase.advanceType === "poll") {
          await new Promise(r => setTimeout(r, 1500));
          await bot.sendPoll(chatId, nextPhase.pollQuestion, nextPhase.pollOptions, {
            type: "quiz",
            correct_option_id: nextPhase.correctOptionId,
            is_anonymous: false,
            explanation: "Dostoiévski sabia. Você deveria também. 🦤",
          });
        } else if (nextPhase.puzzleSignal) {
          await new Promise(r => setTimeout(r, 1500));
          await burstToTelegram(chatId, nextPhase.puzzleSignal, null, { ...state, phase: newPhase, substate: "puzzle" });
        } else if (nextPhase.advanceType === "webapp") {
          // Fase final: botão do Terminal de Reparações
          await new Promise(r => setTimeout(r, 1500));
          await bot.sendMessage(chatId, "↓", {
            reply_markup: {
              inline_keyboard: [[{ text: "🌈 Revelação Final", web_app: { url: `${BASE_URL}/revelation/` } }]],
            },
          });
        }

        await setState(userId, {
          phase: newPhase,
          substate: "puzzle",
          chatId,
          history: updatedHistory,
          summary: state.summary || "",
        });
        return res.status(200).json({ ok: true });
      }

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

        // Próxima fase tem um enigma gerado pelo LLM via SINAL (Fase 2 cento, Fase 4 cifra)
        if (nextPhase.puzzleSignal) {
          await new Promise(r => setTimeout(r, 1500));
          await burstToTelegram(chatId, nextPhase.puzzleSignal, null, { ...state, phase: newPhase, substate: "puzzle" });
          await setState(userId, {
            phase: newPhase,
            substate: "puzzle",
            history: history,
            summary: currentSummary,
            chatId: chatId,
          });
          return res.status(200).json({ ok: true });
        }

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
            history: history,
            summary: currentSummary,
            chatId: chatId,
          });
          return res.status(200).json({ ok: true });
        }

        newSubstate = "puzzle";

        await new Promise((r) => setTimeout(r, 1200));

        const buttonUrl = newPhase === 5 ? `${BASE_URL}/revelation/` : `${BASE_URL}/app/?phase=${newPhase}`;
        const buttonText = newPhase === 5 ? "🌈 Revelação Final" : `✨ Próximo Enigma`;
        await bot.sendMessage(chatId, "↓", {
          reply_markup: { inline_keyboard: [[{ text: buttonText, web_app: { url: buttonUrl } }]] },
        });
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
