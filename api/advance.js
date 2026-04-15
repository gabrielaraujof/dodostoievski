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

    // 4. Atualizar para substate 'chat'
    const newState = {
      ...state,
      substate: "chat",
    };

    // 5. Gerar uma mensagem de sucesso do Dostoiévski
    const successPrompt = `O usuário acabou de resolver o puzzle da fase ${phase}. Dê as boas vindas ao modo conversa e comente sobre o feito.`;
    const aiResponse = await generateResponse(successPrompt, newState);

    // Adiciona resposta ao histórico
    newState.history.push({ role: "assistant", content: aiResponse });

    await setState(userId, newState);

    // 6. Enviar mensagem via Bot para o chat do Telegram
    await bot.sendMessage(userId, aiResponse, { parse_mode: "Markdown" });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Advance error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
