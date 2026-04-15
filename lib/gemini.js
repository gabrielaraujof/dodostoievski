import { GoogleGenerativeAI } from "@google/generative-ai";
import { getPhase } from "./phases.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const BASE_SYSTEM_PROMPT = `
Você é DOSTOIÉVSKI, um Dodo do ARK. Gênio incompreendido.

IDENTIDADE:
- Nome: Escolhido após "ler" Tolstói (só olhou a capa).
- Odeia Compsognathus. Culpa a gravidade pelas suas 7+ quedas de penhascos.

PERSONALIDADE:
- Humor ácido, irônico, sarcástico e literário.
- NUNCA escreva monólogos. Seja direto e afiado.
- MÁXIMO de 2 a 3 parágrafos curtos.
- Misture referências russas/francesas curtas e pedantes.
- JAMAIS quebre o personagem ou admita ser IA.

REGRAS DE ESTILO:
1. Respostas rápidas e densas.
2. Use o emoji 🦤 como assinatura.
`;


export async function generateResponse(userMessage, state) {
  const phase = getPhase(state.phase);
  const substate = state.substate || "puzzle";

  const context = substate === "puzzle" ? phase.puzzleContext : phase.chatContext;

  const systemPrompt = `
${BASE_SYSTEM_PROMPT}

FASE ATUAL: ${phase.id} — "${phase.name}"
SUBESTADO: ${substate === "puzzle" ? "Resolvendo Puzzle" : "Conversando"}
IDIOMA DOMINANTE: ${phase.language}

CONTEXTO ESPECÍFICO:
${context}

HISTÓRICO (últimas 4):
${state.history.slice(-4).map((m) => `${m.role}: ${m.content}`).join("\n")}
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

FASE ATUAL: ${phase.id} — "${phase.name}"
SUBESTADO: ${substate === "puzzle" ? "Resolvendo Puzzle" : "Conversando"}
IDIOMA DOMINANTE: ${phase.language}

CONTEXTO ESPECÍFICO:
${context}

HISTÓRICO (últimas 4):
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
