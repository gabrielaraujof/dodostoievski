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

      // Define estado inicial: Fase 1, subestado Puzzle
      await setState(userId, {
        phase: 1,
        substate: "puzzle",
        history: [{ role: "assistant", content: welcomeMessage }],
      });

      // Envia mensagem de boas vindas com o botão do primeiro puzzle
      await bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🟠 Abrir Puzzle: A Origem",
                web_app: { url: `${BASE_URL}/app/?phase=1` },
              },
            ],
          ],
        },
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

      // Verifica se deve avançar para o PRÓXIMO puzzle (só se estiver em substate 'chat')
      const shouldAdvanceToNextPuzzle = await shouldAdvancePhase(
        userMessage,
        aiResponse,
        state
      );

      // Atualiza histórico
      const newHistory = [
        ...state.history,
        { role: "user", content: userMessage },
        { role: "assistant", content: aiResponse },
      ].slice(-20);

      let newPhase = state.phase;
      let newSubstate = state.substate;

      // Se o Gemini decidir que o papo acabou, vamos para o próximo puzzle
      if (shouldAdvanceToNextPuzzle && state.phase < 5) {
        newPhase = state.phase + 1;
        newSubstate = "puzzle";
        
        const nextPhase = getPhase(newPhase);

        // Mensagem de transição dramática
        const transitionMsg = `
━━━━━━━━━━━━━━━━━━━━━━
🦤 *PRÓXIMO DESAFIO: FASE ${newPhase} — "${nextPhase.name}"*
━━━━━━━━━━━━━━━━━━━━━━
        `;
        
        await bot.sendMessage(chatId, aiResponse, { parse_mode: "Markdown" });
        await bot.sendMessage(chatId, transitionMsg, { parse_mode: "Markdown" });

        // Envia o botão para o novo puzzle
        const buttonUrl = newPhase === 5 
          ? `${BASE_URL}/revelation/` 
          : `${BASE_URL}/app/?phase=${newPhase}`;
        
        const buttonText = newPhase === 5
          ? "🌈 Abrir Revelação Final"
          : `✨ Abrir Puzzle: ${nextPhase.name}`;

        await bot.sendMessage(chatId, "Quando estiver pronta, abra o desafio:", {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: buttonText,
                  web_app: { url: buttonUrl },
                },
              ],
            ],
          },
        });

      } else {
        // Apenas responde normalmente
        // Se estiver em modo puzzle, o Gemini deve ter dado uma dica
        await bot.sendMessage(chatId, aiResponse, { parse_mode: "Markdown" });

        // Se o usuário estiver no substate puzzle e mandou msg, podemos reforçar o botão caso ele tenha perdido
        if (state.substate === "puzzle") {
          const currentPhase = getPhase(state.phase);
          await bot.sendMessage(chatId, "Ainda está travada? Use o Mini App:", {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: `🟠 Abrir Puzzle: ${currentPhase.name}`,
                    web_app: { url: `${BASE_URL}/app/?phase=${state.phase}` },
                  },
                ],
              ],
            },
          });
        }
      }

      // Salva novo estado
      await setState(userId, { 
        phase: newPhase, 
        substate: newSubstate, 
        history: newHistory 
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(200).json({ ok: true });
  }
}
