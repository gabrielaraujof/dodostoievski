import TelegramBot from "node-telegram-bot-api";
import { getState, setState, resetState, claimUpdate } from "../lib/state.js";
import { generateResponse, shouldAdvancePhase, summarizeHistory, validateAnswer } from "../lib/gemini.js";
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

// ─── Filtra cifra/decodificação que o LLM possa ter colocado inline ─────
// Mesmo com instruções explícitas no signal, o LLM às vezes reproduz
// `BOFREIR GUR PNG` ou `OBSERVE THE CAT` no texto. Filtragem garante que
// essas strings nunca cheguem ao usuário fora da bolha determinística.
function filterCipherTokens(text) {
  return text
    .replace(/\bBOFREIR\s+GUR\s+PNG\b/gi, "the message above")
    .replace(/\bOBSERVE\s+THE\s+CAT\b/gi, "what it tells you to do");
}

// ─── Envia UMA ÚNICA bolha gerada pelo LLM (com filtragem) ──────────────
// Usado nos sinais pré/pós-cifra da Fase 4. Mesmo se o LLM gerar múltiplas
// bolhas, só a primeira é enviada — garante 1 bolha + sem token vazado.
async function sendSingleFilteredBubble(chatId, signal, llmStateContext) {
  const fullRawResponse = await generateResponse(signal, llmStateContext);

  const bubbles = fullRawResponse
    .split(/[\s\[*]*BOLHA[\s\]*]*/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  if (bubbles.length === 0) return "";

  const { emoji: _emoji, text: rawText } = parseReaction(bubbles[0]);
  if (!rawText) return "";

  const filtered = filterCipherTokens(rawText);
  if (!filtered.trim()) return "";

  await bot.sendChatAction(chatId, "typing");
  const delay = Math.min(Math.max(filtered.length * 6, 200), 600);
  await new Promise((r) => setTimeout(r, delay));

  try {
    await bot.sendMessage(chatId, filtered, { parse_mode: "Markdown" });
  } catch {
    await bot.sendMessage(chatId, filtered);
  }

  return filtered;
}

// ─── Despacho de enigma com cifra determinística (Fase 4) ─────────────────
// Phase 4 splits the puzzle signal in two: pre-cipher framing, then a
// deterministic cipher bubble injected by the server, then post-cipher
// command. Pre/post bubbles are forced to single-bubble and filtered to
// prevent the cipher/decoded token from leaking inline.
async function dispatchPuzzleSignal(chatId, nextPhase, llmStateContext) {
  if (nextPhase.puzzleSignalPre && nextPhase.puzzleSignalPost) {
    await sendSingleFilteredBubble(chatId, nextPhase.puzzleSignalPre, llmStateContext);
    await new Promise(r => setTimeout(r, 400));
    await bot.sendMessage(chatId, "`BOFREIR GUR PNG`", { parse_mode: "Markdown" });
    await new Promise(r => setTimeout(r, 400));
    await sendSingleFilteredBubble(chatId, nextPhase.puzzleSignalPost, llmStateContext);
  } else if (nextPhase.puzzleSignal) {
    await burstToTelegram(chatId, nextPhase.puzzleSignal, null, llmStateContext);
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
    const delay = Math.min(Math.max(text.length * 6, 200), 600);
    await new Promise((r) => setTimeout(r, delay));

    try {
      const sent = await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
      lastSentMsgId = sent.message_id;
    } catch {
      const sent = await bot.sendMessage(chatId, text);
      lastSentMsgId = sent.message_id;
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
    // Telegram reentrega o mesmo update se a resposta passa do timeout (~10s).
    // Cada update traz um update_id único; usamos Upstash com SETNX+TTL para
    // garantir que cada update seja processado exatamente uma vez na janela
    // de retry (~5 min). Se for um retry, retorna 200 imediatamente para o
    // Telegram parar de tentar.
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
      await setState(userId, startState);

      // Abertura dinâmica em duas partes:
      // 1) Boas-vindas + apresentação da jornada (sem mencionar o primeiro encontro)
      // 2) Foto do Thai-Tai como cenário do primeiro enigma
      // 3) Provocação do primeiro enigma (Fase 1)
      const openingSignal = `[SINAL DE ABERTURA: ${userName} acabou de invocar você com /start. ` +
        `Em 3-4 bolhas curtas, dê as boas-vindas com seu sarcasmo de Dodo erudito. ` +
        `ESTABELEÇA o formato da jornada com clareza: ela vai atravessar uma sequência de enigmas encadeados — cada acerto abre o próximo, e ao final do percurso há algo material esperando por ela. NÃO revele quantos enigmas existem, nem do que tratam. NÃO use as palavras "presente" nem "aniversário" — apenas insinue que algo a aguarda no fim. ` +
        `NÃO mencione ainda nada sobre o primeiro encontro de vocês em São Paulo — esse é o próximo passo, não este. Termine apenas anunciando, com seu tom ácido, que o primeiro enigma está prestes a começar. ` +
        `NÃO afirme que ela acertou nada — ela ainda nem respondeu. ` +
        `Esta resposta é EXCEÇÃO ao cap de 40 palavras: priorize estabelecer a jornada com clareza sobre brevidade aqui.]`;

      const openingResponse = await burstToTelegram(chatId, openingSignal, null, startState);

      // Foto define o cenário do primeiro enigma — entra DEPOIS das boas-vindas.
      if (THAI_TAI_PHOTO) {
        await new Promise(r => setTimeout(r, 800));
        await bot.sendPhoto(chatId, THAI_TAI_PHOTO, { caption: "🦤" }).catch(() => {});
        await new Promise(r => setTimeout(r, 300));
      }

      // Sinal do primeiro enigma: a Fase 1 começa aqui, não no opener.
      const phase1Signal = `[SINAL DE ENIGMA FASE 1: É hora de provocar a usuária sobre o primeiro encontro de vocês em São Paulo. ` +
        `Em 2-3 bolhas curtas, em primeira pessoa, no seu tom ácido habitual, convide-a a relembrar qualquer detalhe daquela noite — o restaurante tailandês, o prato ardido, ou a confeitaria famosa que estava fechada. Qualquer um dos três entra como pista de partida. ` +
        `NÃO entregue nomes próprios. NÃO afirme que ela acertou nada — ela ainda nem respondeu.]`;

      const phase1Response = await burstToTelegram(chatId, phase1Signal, null, {
        ...startState,
        history: [{ role: "assistant", content: openingResponse }],
      });

      // Persiste as duas falas para manter continuidade nos próximos turnos.
      await setState(userId, {
        ...startState,
        history: [
          { role: "assistant", content: openingResponse },
          { role: "assistant", content: phase1Response },
        ],
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
        // Dodo parabeniza pelo conhecimento musical russo (Alexander Serov) e transiciona.
        await burstToTelegram(
          state.chatId,
          "[SINAL: A usuária acertou o quiz musical — identificou Alexander Serov como o intérprete de 'Я люблю тебя до слёз'. Reconheça em 1-2 bolhas curtas, no seu tom ácido, que ela conhece a voz russa certa. NÃO comente sobre a palavra 'lágrimas' (já tratado na fase anterior). NÃO recapitule a Fase 1 (Tom Yum, padaria, Augusta). Apenas costure rapidamente para o próximo enigma técnico que vem a seguir.]",
          null,
          newState
        );

        // Se a próxima fase tem poll, dispara imediatamente
        if (nextPhase.advanceType === "poll") {
          await new Promise(r => setTimeout(r, 600));
          await bot.sendPoll(state.chatId, nextPhase.pollQuestion, nextPhase.pollOptions, {
            type: "quiz",
            correct_option_id: nextPhase.correctOptionId,
            is_anonymous: false,
            explanation: "Dostoiévski sabia. Você deveria também. 🦤",
          });
        } else if (nextPhase.puzzleSignal || nextPhase.puzzleSignalPre) {
          // Fase com enigma gerado pelo LLM via SINAL (Fase 2 cento, Fase 4 cifra)
          await new Promise(r => setTimeout(r, 600));
          await dispatchPuzzleSignal(state.chatId, nextPhase, newState);
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

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // Validação via LLM ANTES do conversacional. Para qualquer fase em
      // substate "puzzle" com expectedAnswer definida, um modelo robusto
      // (gemini-pro-latest) decide se a mensagem contém a resposta esperada.
      // Se sim, avançamos no mesmo turno sem chamar o LLM conversacional —
      // assim evitamos rejeições alucinadas e re-entrega de fases passadas.
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const currentPhase = getPhase(state.phase);
      if (state.substate === "puzzle" && currentPhase.expectedAnswer) {
        const solved = await validateAnswer(userMessage, currentPhase);
        if (solved) {
          const newPhase = state.phase + 1;
          const nextPhase = getPhase(newPhase);

          const updatedHistory = [
            ...state.history,
            { role: "user", content: userMessage },
          ].slice(-12);

          if (nextPhase.advanceType === "poll") {
            // Bridge LLM antes da poll pra costurar a transição (cento → cantor).
            if (nextPhase.transitionSignal) {
              await burstToTelegram(chatId, nextPhase.transitionSignal, null, { ...state, phase: newPhase, substate: "puzzle" });
              await new Promise(r => setTimeout(r, 500));
            } else {
              await new Promise(r => setTimeout(r, 600));
            }
            await bot.sendPoll(chatId, nextPhase.pollQuestion, nextPhase.pollOptions, {
              type: "quiz",
              correct_option_id: nextPhase.correctOptionId,
              is_anonymous: false,
              explanation: "Dostoiévski sabia. Você deveria também. 🦤",
            });
          } else if (nextPhase.puzzleSignal || nextPhase.puzzleSignalPre) {
            await new Promise(r => setTimeout(r, 600));
            await dispatchPuzzleSignal(chatId, nextPhase, { ...state, phase: newPhase, substate: "puzzle" });
          } else if (nextPhase.advanceType === "webapp") {
            // Fechamento simbólico LLM antes do botão do Terminal de Reparações.
            if (nextPhase.transitionSignal) {
              await burstToTelegram(chatId, nextPhase.transitionSignal, null, { ...state, phase: newPhase, substate: "chat" });
              await new Promise(r => setTimeout(r, 500));
            } else {
              await new Promise(r => setTimeout(r, 600));
            }
            // Bolha determinística com os 3 códigos verbatim, formato Markdown
            // garantido pelo servidor — não dependemos do LLM acertar crases.
            await bot.sendMessage(chatId, "`TOMYUM`\n`SLEZY`\n`KOT`", { parse_mode: "Markdown" });
            await new Promise(r => setTimeout(r, 500));
            await bot.sendMessage(chatId, "🦤 The Terminal of Repairs is open. Step in.", {
              reply_markup: {
                inline_keyboard: [[{ text: "🌈 Open the Terminal of Repairs", web_app: { url: `${BASE_URL}/revelation/` } }]],
              },
            });
          }

          await setState(userId, {
            phase: newPhase,
            substate: nextPhase.advanceType === "webapp" ? "free_chat" : "puzzle",
            chatId,
            history: updatedHistory,
            summary: state.summary || "",
          });
          return res.status(200).json({ ok: true });
        }
      }

      // Não acertou (ou fase sem expectedAnswer): roda LLM conversacional pra
      // dar pistas, provocar, ou conversar livremente.
      const aiResponse = await burstToTelegram(chatId, userMessage, userMsgId, state);

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

      await setState(userId, {
        phase: state.phase,
        substate: state.substate,
        history: history,
        summary: currentSummary,
        chatId,
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(200).json({ ok: true });
  }
}
