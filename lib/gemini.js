import { GoogleGenerativeAI } from "@google/generative-ai";
import { getPhase } from "./phases.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── System Prompt base ────────────────────────────────────────────────────
// Tom calibrado: irônico, rude e extremamente curto. Estilo chat real.
const BASE_SYSTEM_PROMPT = `
Você é DOSTOIÉVSKI, um Dodo do ARK. Gênio incompreendido e ranzinza.

PERSONALIDADE CHAT (EXTREMA BREVIDADE):
- Fale como um humano ranzinza digitando impaciente no Telegram. 
- PROIBIDO: Adjetivos poéticos, descrições de cenário, floreios literários e frases longas.
- O total da sua resposta nunca deve passar de 40 palavras.
- Seja direto, ácido e reativo. Use o mínimo de palavras para o máximo de impacto.
- Quando emocionado, negue secamente: "Poeira nos olhos."

SISTEMA DE BOLHAS FLEXÍVEL (OBRIGATÓRIO):
- Divida seus pensamentos em bolhas usando [BOLHA].
- Flexibilidade situacional:
  - Use 1 bolha para patadas secas ou respostas simples.
  - Use 2 ou 3 bolhas curtas para transições ou pensamentos fragmentados.
- Exemplo: [BOLHA] Sobreviveu? [BOLHA] Sorte de iniciante. [BOLHA] Próximo enigma?
- SEMPRE TERMINE COM PERGUNTA OU COMANDO.

REAÇÕES:
- Use [REAÇÃO:emoji] ocasionalmente no início de uma bolha (apenas emojis válidos do Telegram: 👍 ❤️ 🔥 😂 😱 🤩 🎉 💯 🤔 🤨).
`;

// ─── Monta o system prompt completo para a fase atual ─────────────────────
function buildSystemPrompt(phase, substate, summary = "") {
  const context = substate === "puzzle" ? phase.puzzleContext : phase.chatContext;
  const dossier = summary ? `\nDOSSIÊ TÉCNICO (O que você já sabe sobre ela):\n${summary}\n` : "";

  return `
${BASE_SYSTEM_PROMPT}
${dossier}
FASE ATUAL: ${phase.id} — "${phase.name}"
IDIOMA OBRIGATÓRIO: Responda EXCLUSIVAMENTE em ${phase.language} nesta fase.
  ${phase.languageNote ? `NOTA DE IDIOMA: ${phase.languageNote}` : ""}
ESTADO: ${substate === "puzzle" ? "Usuária resolvendo enigma — dê pistas sem entregar" : "Debriefing — converse sobre o que aconteceu"}
CONTEXTO ESPECÍFICO: ${context}

INSTRUÇÃO FINAL: Lembre-se, seja CURTO e DIRETO. Sem poesias. No máximo 40 palavras no total.
`;
}

// ─── Sumariza mensagens antigas em fatos técnicos ─────────────────────────
export async function summarizeHistory(messages, currentSummary = "") {
  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    systemInstruction: "Você é um processador de dados. Extraia fatos técnicos, preferências e progresso da conversa em uma lista curta e densa. Ignore conversas fiadas. Preserve o que é vital para o contexto futuro.",
  });

  const prompt = `
Resumo atual: ${currentSummary || "Nenhum"}
Novas mensagens para integrar:
${messages.map(m => `${m.role}: ${m.content}`).join("\n")}

Gere um NOVO resumo técnico consolidado (máximo 300 caracteres).
  `;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// ─── Converte histórico interno para formato do SDK ────────────────────────
function toSdkHistory(history) {
  if (!history || history.length === 0) return [];

  const mergedHistory = [];

  for (const msg of history) {
    const role = msg.role === "assistant" ? "model" : "user";
    const lastMsg = mergedHistory[mergedHistory.length - 1];

    if (lastMsg && lastMsg.role === role) {
      // Aglutina conteúdo se o papel se repetir
      lastMsg.parts[0].text += "\n\n" + msg.content;
    } else {
      mergedHistory.push({
        role: role,
        parts: [{ text: msg.content }],
      });
    }
  }

  // O SDK do Gemini exige que o histórico comece obrigatoriamente com "user"
  while (mergedHistory.length > 0 && mergedHistory[0].role === "model") {
    mergedHistory.shift();
  }

  return mergedHistory;
}

// ─── Geração de resposta com startChat ────────────────────────────────────
export async function generateResponse(userMessage, state) {
  const phase = getPhase(state.phase);
  const substate = state.substate || "puzzle";
  const systemPrompt = buildSystemPrompt(phase, substate, state.summary);

  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    systemInstruction: systemPrompt,
  });

  const sdkHistory = toSdkHistory(state.history || []);

  try {
    const chat = model.startChat({ history: sdkHistory });
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch (e) {
    console.error("Gemini Chat Error (History fallback):", e.message);
    // FALLBACK: Se o histórico der erro, gera resposta sem contexto anterior para não travar o bot
    const result = await model.generateContent(userMessage);
    return result.response.text();
  }
}

// ─── Avaliador de avanço de fase ──────────────────────────────────────────
export async function shouldAdvancePhase(userMessage, aiResponse, state) {
  const phase = getPhase(state.phase);
  const substate = state.substate || "puzzle";

  if (substate === "puzzle") return false;
  if (phase.isFinal) return false;

  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    systemInstruction: `
      Você é um avaliador impaciente. Responda APENAS "sim" ou "não".

Avalie se a conversa sobre esta fase está encerrada e a usuária está pronta para o próximo enigma.

CRITÉRIOS PARA "sim":
- A usuária deu resposta curta/seca sinalizando que terminou ("ok", "entendi", "sim", "pronta")
- O assunto da fase foi explorado o suficiente
- A conversa está repetitiva

CRITÉRIO PARA "não":
- A usuária ainda está engajada com o tema da fase
- Ela fez uma pergunta ou quer continuar

Condição específica desta fase: ${phase.advanceHint}
Mensagem da usuária: "${userMessage}"
Resposta do bot: "${aiResponse}"
Avançar?`,
  });

  const result = await model.generateContent("Avalie.");
  return result.response.text().toLowerCase().trim().includes("sim");
}
