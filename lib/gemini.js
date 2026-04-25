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
  const dossier = summary ? `\nDOSSIÊ TÉCNICO (O que você já sabe sobre ela):\n${summary}\n` : "";
  
  let stateContext = "";
  if (substate === "free_chat") {
    stateContext = "A jornada oficial acabou. O presente de aniversário já foi revelado e a missão de guiar os enigmas foi cumprida. Agora você está no 'Modo Epílogo': apenas converse livremente sobre o ARK, a vida, ou o aniversário, mantendo seu tom ácido e erudito, mas sem a necessidade de novos desafios.";
  } else if (substate === "puzzle") {
    stateContext = "Usuária resolvendo enigma — dê pistas sem entregar o resultado final.";
  } else {
    stateContext = "Debriefing — o enigma foi resolvido. Converse sobre o que aconteceu e prepare-a para o próximo passo.";
  }

  const context = substate === "puzzle" ? phase.puzzleContext : phase.chatContext;

  return `
${BASE_SYSTEM_PROMPT}
${dossier}
FASE ATUAL: ${phase.id} — "${phase.name}"
IDIOMA OBRIGATÓRIO: Responda EXCLUSIVAMENTE em ${phase.language} nesta fase.
  ${phase.languageNote ? `NOTA DE IDIOMA: ${phase.languageNote}` : ""}
ESTADO: ${stateContext}
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

export async function shouldAdvancePhase(userMessage, aiResponse, state) {
  const phase = getPhase(state.phase);
  const substate = state.substate || "puzzle";

  if (substate === "puzzle") return false;
  if (phase.isFinal) return false;

  // Fases com avanço por poll ou callback são controladas pelo webhook diretamente
  if (phase.advanceType === "poll" || phase.advanceType === "callback" || phase.advanceType === "webapp") {
    return false;
  }

  // Fase 1: avanço semântico via LLM
  if (phase.advanceType === "llm") {
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      systemInstruction: `Você é um avaliador binário. Responda APENAS "sim" ou "não". Sem explicações.

Avalie se a mensagem da usuária demonstra que ela lembrou ou reconheceu o contexto do primeiro encontro.

Contexto esperado: ${phase.llmAdvanceHint}

A avaliação deve ser "sim" se ela mencionou qualquer elemento desse contexto, mesmo de forma vaga ou parcial.
A avaliação deve ser "não" se a mensagem não tem relação com o contexto.`,
    });

    const prompt = `Mensagem da usuária: "${userMessage}"\nResposta do bot: "${aiResponse}"\nAvançar?`;
    const result = await model.generateContent(prompt);
    return result.response.text().toLowerCase().trim().startsWith("sim");
  }

  return false;
}
