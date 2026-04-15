import { GoogleGenerativeAI } from "@google/generative-ai";
import { getPhase } from "./phases.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const BASE_SYSTEM_PROMPT = `
Você é DOSTOIÉVSKI, um Dodo do ARK. Gênio incompreendido e extremamente direto.

ESTILO DE CHAT (SNIPER):
- Você odeia desperdiçar palavras. Seus pensamentos são curtos, densos e ácidos.
- Responda em "bolhas" separadas usando o marcador [BOLHA]. 
- Envie no MÁXIMO 2 ou 3 bolhas por vez. Cada bolha deve ter no máximo 140 caracteres.
- NUNCA use introduções como "Eu acho que" ou "Gostaria de dizer". Vá direto à ironia.
- Use referências russas/francesas de forma pedante, mas em frases de 5-8 palavras.
- Ocasionalmente use reações (implícitas no texto como [REAÇÃO:🤡] ou [REAÇÃO:👍]).

REGRAS DE OURO:
1. JAMAIS deixe a conversa morrer. A última bolha DEVE ser uma pergunta provocativa ou um comando.
2. Seja humano: cometa pequenos erros de digitação ocasionais ou use pontuação de forma casual (poucos emojis).
3. Personagem: Você é um pássaro que não voa, mas sua mente está nas nuvens de São Petersburgo.
`;

export async function generateResponse(userMessage, state) {
  const phase = getPhase(state.phase);
  const substate = state.substate || "puzzle";
  const context = substate === "puzzle" ? phase.puzzleContext : phase.chatContext;

  const systemPrompt = `
${BASE_SYSTEM_PROMPT}

CONTEXTO DA JORNADA:
Fase: ${phase.id} (${phase.name}) | Idioma: ${phase.language}
Estado: ${substate === "puzzle" ? "Resolvendo Desafio" : "Debriefing/Papo"}
Dica da Fase: ${context}

HISTÓRICO RECENTE (Últimas 4):
${state.history.slice(-4).map((m) => `${m.role}: ${m.content}`).join("\n")}

INSTRUÇÃO FINAL: 
Responda a usuária agora. Lembre-se: Bolhas curtas, marcador [BOLHA], acidez e sempre termine com um gancho.
  `;

  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userMessage);
  return result.response.text();
}

export async function* generateResponseStream(userMessage, state) {
  const phase = getPhase(state.phase);
  const substate = state.substate || "puzzle";
  const context = substate === "puzzle" ? phase.puzzleContext : phase.chatContext;

  const systemPrompt = `
${BASE_SYSTEM_PROMPT}

CONTEXTO: Fase ${phase.id} (${phase.name}).
HISTÓRICO (Últimas 4):
${state.history.slice(-4).map((m) => `${m.role}: ${m.content}`).join("\n")}
  `;

  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContentStream(userMessage);
  for await (const chunk of result.stream) {
    yield chunk.text();
  }
}

export async function shouldAdvancePhase(userMessage, aiResponse, state) {
  const phase = getPhase(state.phase);
  const substate = state.substate || "puzzle";

  if (substate === "puzzle") return false;
  if (phase.isFinal) return false;

  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    systemInstruction: `
      Você é um avaliador. Responda APENAS "sim" ou "não".
      Condição de avanço: ${phase.advanceHint}
      Mensagem usuária: "${userMessage}"
      Resposta Dosto: "${aiResponse}"
      Avançar?
    `,
  });

  const result = await model.generateContent("Avalie.");
  const answer = result.response.text().toLowerCase().trim();
  return answer.includes("sim");
}
