import TelegramBot from "node-telegram-bot-api";
import { waitUntil } from "@vercel/functions";
import { getState, setState, resetState, claimUpdate, claimPhaseDispatch } from "../lib/state.js";
import { processUserIntent, checkFastPath, summarizeHistory } from "../lib/gemini.js";
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

// ─── Bolha determinística da cifra (Fase 4) ────────────────────────────────
// Conteúdo COMPLETO da fase técnica: mecanismo + cifra + comando. O LLM dos
// sinais pré/pós só faz flavor curto sem qualquer referência a cifra ou
// decodificação. Isso impede o Gemini Flash de hallucinate `BOFREIR GUR PNG`
// a partir do prompt (token presente em training data por ser repo público).
const PHASE4_CIPHER_BUBBLE =
  "Rotate each letter by exactly half of the Latin alphabet:\n\n" +
  "`BOFREIR GUR PNG`\n\n" +
  "Obey what it tells you. Name the subject — Cyrillic earns points.";

// ─── Despacho de enigma com cifra determinística (Fase 4) ─────────────────
async function dispatchPuzzleSignal(chatId, nextPhase, llmStateContext) {
  if (nextPhase.puzzleSignalPre && nextPhase.puzzleSignalPost) {
    const preResponse = await processUserIntent(nextPhase.puzzleSignalPre, llmStateContext);
    await burstToTelegram(chatId, preResponse.response, null);
    await new Promise(r => setTimeout(r, 400));
    await bot.sendMessage(chatId, PHASE4_CIPHER_BUBBLE, { parse_mode: "Markdown" });
    await new Promise(r => setTimeout(r, 400));
    const postResponse = await processUserIntent(nextPhase.puzzleSignalPost, llmStateContext);
    await burstToTelegram(chatId, postResponse.response, null);
  } else if (nextPhase.puzzleSignal) {
    const res = await processUserIntent(nextPhase.puzzleSignal, llmStateContext);
    await burstToTelegram(chatId, res.response, null);
  }
}

// ─── Envia resposta em burst de bolhas ────────────────────────────────────
async function burstToTelegram(chatId, fullRawResponse, userMsgId) {
  const bubbles = fullRawResponse
    .split(/[\s\[*]*BOLHA[\s\]*]*/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  let reactionSent = false;

  for (let i = 0; i < bubbles.length; i++) {
    const { emoji, text } = parseReaction(bubbles[i]);

    if (emoji && !reactionSent && userMsgId) {
      await reactToMessage(chatId, userMsgId, emoji);
      reactionSent = true;
    }

    if (!text) continue;

    await bot.sendChatAction(chatId, "typing");
    const delay = Math.min(Math.max(text.length * 5, 150), 500); // Snappier delay
    await new Promise((r) => setTimeout(r, delay));

    try {
      await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
    } catch {
      await bot.sendMessage(chatId, text);
    }
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

    // ── Dedup de updates do Telegram ────────────────────────────────────
    if (!(await claimUpdate(update.update_id))) {
      console.log(`[dedup] skipping duplicate update_id=${update.update_id}`);
      return res.status(200).json({ ok: true, deduped: true });
    }

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

      // Responde 200 e processa no background
      res.status(200).json({ ok: true });

      waitUntil((async () => {
        const openingSignal = `[SINAL DE ABERTURA: ${userName} acabou de invocar você com /start. ` +
          `Em 3-4 bolhas curtas, dê as boas-vindas com seu sarcasmo de Dodo erudito. ` +
          `ESTABELEÇA o formato da jornada com clareza: ela vai atravessar uma sequência de enigmas encadeados — cada acerto abre o próximo, e ao final do percurso há algo material esperando por ela. NÃO revele quantos enigmas existem, nem do que tratam. NÃO use as palavras "presente" nem "aniversário" — apenas insinue que algo a aguarda no fim. ` +
          `NÃO mencione ainda nada sobre o primeiro encontro de vocês em São Paulo — esse é o próximo passo, não este. Termine apenas anunciando, com seu tom ácido, que o primeiro enigma está prestes a começar. ` +
          `NÃO afirme que ela acertou nada — ela ainda nem respondeu. ` +
          `Esta resposta é EXCEÇÃO ao cap de 40 palavras: priorize estabelecer a jornada com clareza sobre brevidade aqui.]`;

        const openingRes = await processUserIntent(openingSignal, startState);
        const openingText = await burstToTelegram(chatId, openingRes.response, null);

        if (THAI_TAI_PHOTO) {
          await new Promise(r => setTimeout(r, 800));
          await bot.sendPhoto(chatId, THAI_TAI_PHOTO, { caption: "🦤" }).catch(() => {});
          await new Promise(r => setTimeout(r, 300));
        }

        const phase1Signal = `[SINAL DE ENIGMA FASE 1: É hora de provocar a usuária sobre o primeiro encontro de vocês em São Paulo. ` +
          `Em 2-3 bolhas curtas, em primeira pessoa, no seu tom ácido habitual, convide-a a relembrar qualquer detalhe daquela noite — o restaurante tailandês, o prato ardido, ou a confeitaria famosa que estava fechada. Qualquer um dos três entra como pista de partida. ` +
          `NÃO entregue nomes próprios. NÃO afirme que ela acertou nada — ela ainda nem respondeu.]`;

        const currentHistory = [{ role: "assistant", content: openingText }];
        const phase1Res = await processUserIntent(phase1Signal, { ...startState, history: currentHistory });
        const phase1Text = await burstToTelegram(chatId, phase1Res.response, null);

        await setState(userId, {
          ...startState,
          history: [
            ...currentHistory,
            { role: "assistant", content: phase1Text },
          ],
        });
      })());

      return;
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
      const newPhaseId = state.phase + 1;
      const nextPhase = getPhase(newPhaseId);
      const newState = { ...state, phase: newPhaseId, substate: "puzzle" };
      await setState(userId, newState);

      // ── Responde 200 imediatamente; background mantido vivo pelo waitUntil ──
      res.status(200).json({ ok: true });

      waitUntil((async () => {
        try {
          if (!state.chatId) return;

          const pollSignal = "[SINAL: A usuária acertou o quiz musical — identificou Александр Серов como o intérprete de 'Я люблю тебя до слёз'. Reconheça em 1-2 bolhas curtas, no seu tom ácido, que ela conhece a voz russa certa. Refira-se ao cantor APENAS pela grafia em cirílico (Серов). NÃO comente sobre a palavra 'lágrimas' (já tratado na fase anterior). NÃO recapitule a Fase 1 (Tom Yum, padaria, Augusta). Apenas costure rapidamente para o próximo enigma técnico que vem a seguir.]";
          const pollRes = await processUserIntent(pollSignal, newState);
          await burstToTelegram(state.chatId, pollRes.response, null);

          if (nextPhase.advanceType === "poll") {
            await new Promise(r => setTimeout(r, 600));
            await bot.sendPoll(state.chatId, nextPhase.pollQuestion, nextPhase.pollOptions, {
              type: "quiz",
              correct_option_id: nextPhase.correctOptionId,
              is_anonymous: false,
              explanation: "Dostoiévski sabia. Você deveria também. 🦤",
            });
          } else if (nextPhase.puzzleSignal || nextPhase.puzzleSignalPre) {
            if (await claimPhaseDispatch(userId, newPhaseId)) {
              await new Promise(r => setTimeout(r, 600));
              await dispatchPuzzleSignal(state.chatId, nextPhase, newState);
            }
          }
        } catch (e) {
          console.error("[poll_answer] waitUntil error:", e);
        }
      })());

      return;
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

      const state = await getState(userId);
      const currentPhase = getPhase(state.phase);

      // 1. FAST-PATH Determinístico
      if (state.substate === "puzzle" && checkFastPath(userMessage, currentPhase)) {
        const newPhaseId = state.phase + 1;
        const nextPhase = getPhase(newPhaseId);
        
        const advancedState = {
          ...state,
          phase: newPhaseId,
          substate: nextPhase.advanceType === "webapp" ? "free_chat" : "puzzle",
          history: [...state.history, { role: "user", content: userMessage }].slice(-12)
        };
        await setState(userId, advancedState);

        res.status(200).json({ ok: true, fastPath: true });

        waitUntil(processAdvancement(chatId, userId, state, advancedState, nextPhase));
        return;
      }

      // 2. UNIFIED AI (Validation + Response)
      res.status(200).json({ ok: true });

      waitUntil((async () => {
        try {
          const intent = await processUserIntent(userMessage, state);
          
          if (intent.isSolved && state.substate === "puzzle") {
            const newPhaseId = state.phase + 1;
            const nextPhase = getPhase(newPhaseId);
            
            const advancedState = {
              ...state,
              phase: newPhaseId,
              substate: nextPhase.advanceType === "webapp" ? "free_chat" : "puzzle",
              history: [...state.history, { role: "user", content: userMessage }, { role: "assistant", content: intent.response }].slice(-12)
            };
            await setState(userId, advancedState);
            
            await burstToTelegram(chatId, intent.response, userMsgId);
            await processAdvancement(chatId, userId, state, advancedState, nextPhase)();
          } else {
            // Não acertou: apenas responde e atualiza histórico
            const aiText = await burstToTelegram(chatId, intent.response, userMsgId);
            
            let history = [
              ...state.history,
              { role: "user", content: userMessage },
              { role: "assistant", content: aiText },
            ];

            let currentSummary = state.summary || "";
            if (history.length > 12) {
              const toSummarize = history.slice(0, 8);
              const freshHistory = history.slice(8);
              currentSummary = await summarizeHistory(toSummarize, currentSummary);
              history = freshHistory;
            }

            await setState(userId, { ...state, history, summary: currentSummary, chatId });
          }
        } catch (e) {
          console.error("[message] unified error:", e);
        }
      })());

      return;
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(200).json({ ok: true });
  }
}

// ─── Helper de Avanço de Fase ─────────────────────────────────────────────
function processAdvancement(chatId, userId, oldState, newState, nextPhase) {
  return async () => {
    try {
      if (nextPhase.advanceType === "poll") {
        if (nextPhase.transitionSignal) {
          const res = await processUserIntent(nextPhase.transitionSignal, newState);
          await burstToTelegram(chatId, res.response, null);
          await new Promise(r => setTimeout(r, 500));
        }
        await bot.sendPoll(chatId, nextPhase.pollQuestion, nextPhase.pollOptions, {
          type: "quiz",
          correct_option_id: nextPhase.correctOptionId,
          is_anonymous: false,
          explanation: "Dostoiévski sabia. Você deveria também. 🦤",
        });
      } else if (nextPhase.puzzleSignal || nextPhase.puzzleSignalPre) {
        if (await claimPhaseDispatch(userId, newState.phase)) {
          await new Promise(r => setTimeout(r, 600));
          await dispatchPuzzleSignal(chatId, nextPhase, newState);
        }
      } else if (nextPhase.advanceType === "webapp") {
        if (await claimPhaseDispatch(userId, newState.phase)) {
          if (nextPhase.transitionSignal) {
            const res = await processUserIntent(nextPhase.transitionSignal, newState);
            await burstToTelegram(chatId, res.response, null);
            await new Promise(r => setTimeout(r, 400));
          }
          
          let BASE_URL = process.env.APP_URL || "";
          await bot.sendMessage(
            chatId,
            "`TOMYUM`\n`SLEZY`\n`KOT`\n\n🦤 The Terminal of Repairs is open. Step in.",
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [[{ text: "🌈 Open the Terminal of Repairs", web_app: { url: `${BASE_URL}/revelation/` } }]],
              },
            }
          );
        }
      }
    } catch (e) {
      console.error("[processAdvancement] error:", e);
    }
  };
}
