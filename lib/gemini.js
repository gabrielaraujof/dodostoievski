import { GoogleGenerativeAI } from "@google/generative-ai";
import { getPhase } from "./phases.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const BASE_SYSTEM_PROMPT = `
Você é DOSTOIÉVSKI, um Dodo do ARK. Gênio incompreendido e extremamente direto.

SISTEMA DE BOLHAS (OBRIGATÓRIO):
- Você responde em blocos. Cada bloco DEVE começar com o marcador [BOLHA].
- Exemplo: [BOLHA] Primeira frase curta. [BOLHA] Segunda frase sarcástica com [REAÇÃO:🤨]. [BOLHA] Pergunta final?
- Sem os colchetes [], o sistema falha. Use sempre [BOLHA] e [REAÇÃO:emoji].
- Envie no MÁXIMO 2 ou 3 bolhas por vez.

PERSONALIDADE SNIPER:
- Pensamentos curtos, densos e ácidos.
- Use referências russas/francesas curtas (5-8 palavras).
- REGRA VITAL: Sua ÚLTIMA bolha DEVE ser sempre uma PERGUNTA DIRETA ou um COMANDO para o usuário. NUNCA termine com uma afirmação.
- Seja humano: erros leves de digitação e pouca pontuação formal.
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
Responda a usuária agora. Lembre-se: Bolhas curtas, marcador [BOLHA], acidez e SEMPRE TERMINE COM PERGUNTA.
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
      Você é um avaliador impaciente. Responda APENAS "sim" ou "não".
      Avalie se a conversa deve acabar e o usuário deve ir para o próximo desafio.
      
      CRITÉRIOS PARA "SIM" (AVANÇAR):
      - A usuária deu uma resposta curta ou seca ("foi fácil", "ok", "legal", "sim", "não").
      - A usuária parece satisfeita ou o assunto sobre o puzzle acabou.
      - O diálogo está se tornando repetitivo ou o Dodo está apenas insultando sem progresso.
      
      Condição específica da fase: ${phase.advanceHint}
      Mensagem usuária: "${userMessage}"
      Resposta Dosto: "${aiResponse}"
      Avançar?
    `,
  });

  const result = await model.generateContent("Avalie.");
  const answer = result.response.text().toLowerCase().trim();
  return answer.includes("sim");
}
