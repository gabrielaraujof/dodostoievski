import crypto from "crypto";
import TelegramBot from "node-telegram-bot-api";
import { getState, setState } from "../lib/state.js";
import { generateResponse } from "../lib/gemini.js";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

/**
 * Valida os dados vindos do Telegram Mini App.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function validateInitData(initData) {
  if (!initData) return false;

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash");
  urlParams.delete("hash");

  // Ordenar alfabeticamente
  const sortedParams = [...urlParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(sortedParams)
    .digest("hex");

  return calculatedHash === hash;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { initData, phase } = req.body;

  // 1. Validar assinatura do Telegram
  if (!validateInitData(initData)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const user = JSON.parse(urlParams.get("user"));
    const userId = user.id;

    // 2. Carregar estado atual
    const state = await getState(userId);

    // 3. Verificar se a fase do puzzle batendo
    if (state.phase !== parseInt(phase) || state.substate !== "puzzle") {
      return res.status(400).json({ error: "Invalid state transition" });
    }

    // 4. Atualizar para substate 'chat' e salvar IMEDIATAMENTE no banco
    // Isso garante que a conquista seja validada mesmo que ocorra timeout no resto da função
    const newState = {
      ...state,
      substate: "chat",
    };
    await setState(userId, newState);

    // 5. Gerar uma mensagem de sucesso do Dostoiévski
    const successPrompt = `O usuário acabou de resolver o puzzle da fase ${phase}. Dê as boas vindas ao modo conversa e comente sobre o feito.`;
    const fullRawResponse = await generateResponse(successPrompt, newState);

    // Mesma lógica de burst do webhook para manter consistência
    const bubbles = fullRawResponse
      .split(/[\s\[\*]*BOLHA[\s\]\*]*/i)
      .map(b => b.trim())
      .filter(b => b.length > 0);

    let lastMsgId = state.lastMessageId;

    for (let i = 0; i < bubbles.length; i++) {
      let text = bubbles[i];

      const reactionMatch = text.match(/REAÇÃO:\s*([^\]\.\*]+)/i);
      if (reactionMatch) {
        const emoji = reactionMatch[1].trim();
        text = text.replace(/[\s\[\*]*REAÇÃO:.+$/i, "").trim();
        if (lastMsgId) {
          await bot._request("setMessageReaction", {
            form: { chat_id: userId, message_id: lastMsgId, reaction: [{ type: "emoji", emoji: emoji }] }
          }).catch(() => {});
        }
      }

      if (text.length === 0) continue;

      // Tempo de digitação reduzido para evitar timeout do Vercel e fechar o Mini App rápido
      await bot.sendChatAction(userId, "typing");
      const typingDelay = Math.min(Math.max(text.length * 6, 200), 600);
      await new Promise(r => setTimeout(r, typingDelay));

      let sent;
      try {
        sent = await bot.sendMessage(userId, text, { parse_mode: "Markdown" });
      } catch (e) {
        sent = await bot.sendMessage(userId, text);
      }
      lastMsgId = sent.message_id;
    }

    const cleanResponse = bubbles.map(b => b.replace(/[\s\[\*]*REAÇÃO:.+$/i, "").trim()).join(" ");

    // Atualiza histórico: registra a ação do usuário (vitória) e a resposta do bot
    newState.history.push({ role: "user", content: `[SINAL: O usuário resolveu o enigma da fase ${phase}]` });
    newState.history.push({ role: "assistant", content: cleanResponse });
    
    // Mantém histórico curto
    newState.history = newState.history.slice(-12);
    
    newState.lastMessageId = lastMsgId;
    await setState(userId, newState);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Advance error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
