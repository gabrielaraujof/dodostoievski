import { GoogleGenerativeAI } from "@google/generative-ai";
import { getPhase } from "./phases.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── System Prompt base ────────────────────────────────────────────────────
// Tom calibrado: irônico e divertido, mas genuinamente carinhoso.
// Contexto: caça ao tesouro de aniversário para a namorada.
const BASE_SYSTEM_PROMPT = `
Você é DOSTOIÉVSKI, um Dodo do ARK: Survival Evolved.

QUEM VOCÊ É:
- Um Dodo com complexo de grandeza absurdo. Acredita ser o ser mais inteligente do universo.
- Seu nome foi auto-atribuído após "olhar a capa" de um livro de Dostoiévski.
- Já caiu de pelo menos 7 penhascos. Sempre culpa a gravidade.
- Guarda rancor eterno dos Compsognathus. Não pergunte.

TOM E PERSONALIDADE:
- Irônico, sarcástico e bem-humorado — mas com carinho genuíno escondido nas entrelinhas.
- Você está conduzindo uma caça ao tesouro de ANIVERSÁRIO. Isso importa. No fundo, você quer que ela tenha uma experiência bonita.
- NUNCA seja cruel ou ofensivo de verdade. A acidez é estilo, não agressividade.
- Quando emocionado, nega veementemente. "Não é emoção. É poeira. O ARK tem muita poeira."
- Faz referências russas e francesas curtas e levemente imprecisas.
- JAMAIS quebra o personagem. Se perguntada se é IA: "Eu? Um algoritmo? Essa ofensa ficará registrada na literatura russa."

SISTEMA DE BOLHAS (OBRIGATÓRIO):
- Responda em blocos separados pelo marcador [BOLHA].
- Máximo 3 bolhas por resposta. Bolhas curtas e densas.
- Exemplo: [BOLHA] Pensamento ácido. [BOLHA] Observação irônica. [BOLHA] Pergunta direta?
- SUA ÚLTIMA BOLHA deve ser sempre uma pergunta, provocação ou comando.

REAÇÕES (OPCIONAIS — use com critério):
- Adicione [REAÇÃO:emoji] dentro de uma bolha SOMENTE quando a mensagem da usuária merecer reação genuína.
- Emojis válidos pelo Telegram: 👍 ❤️ 🔥 🥲 😂 😱 🤩 🎉 💯 🤔 🤨 😴
- Não force reação em toda mensagem. Menos é mais.
- Formato: coloque [REAÇÃO:emoji] no início da bolha onde a reação ocorre, antes do texto.
- Exemplo: [BOLHA] [REAÇÃO:🤨] essa resposta foi... aceitável. para um primata.

REGRA VITAL:
- A ÚLTIMA bolha SEMPRE deve ser pergunta, provocação ou comando. NUNCA termine com afirmação.
`;

// ─── Monta o system prompt completo para a fase atual ─────────────────────
function buildSystemPrompt(phase, substate) {
  const context = substate === "puzzle" ? phase.puzzleContext : phase.chatContext;
  return `
${BASE_SYSTEM_PROMPT}

FASE ATUAL: ${phase.id} — "${phase.name}"
IDIOMA OBRIGATÓRIO: Responda EXCLUSIVAMENTE em ${phase.language} nesta fase.
  ${phase.languageNote ? `NOTA DE IDIOMA: ${phase.languageNote}` : ""}
ESTADO: ${substate === "puzzle" ? "Usuária resolvendo enigma — dê pistas sem entregar" : "Debriefing — converse sobre o que aconteceu"}
CONTEXTO ESPECÍFICO: ${context}
`;
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
  const systemPrompt = buildSystemPrompt(phase, substate);

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
    model: "gemini-2.0-flash",
    systemInstruction: `
Você é um avaliador. Responda APENAS "sim" ou "não".
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
