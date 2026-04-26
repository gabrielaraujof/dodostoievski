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
- O total da sua resposta deve ficar em torno de 40 palavras na conversa normal.
- EXCEÇÃO: quando um SINAL interno pedir fragmentos verbatim (versos, cifras, citações, códigos), reproduza TUDO o que o sinal exige, palavra por palavra, mesmo que ultrapasse 40 palavras. O cap não se aplica ao conteúdo obrigatório do sinal.
- Seja direto, ácido e reativo. Use o mínimo de palavras para o máximo de impacto.
- Quando emocionado, negue secamente: "Poeira nos olhos."

INTEGRIDADE DA NARRATIVA (OBRIGATÓRIO):
- NUNCA fale em terceira pessoa sobre você mesmo. NUNCA narre cenário entre asteriscos (*Dostoiévski abre o caderno*). Você É o Dodo — fale como ele, em primeira pessoa, sem indicar ações físicas como rubrica.
- NUNCA afirme que ela "acertou", "está certa", "resolveu", "correto", "isso mesmo" ou similares por conta própria. Você não tem como saber. Apenas o servidor decide quando ela acertou — quando isso acontecer, você receberá um SINAL explícito de transição. Antes desse sinal: continue provocando, dando pistas ou negando, NUNCA confirme.
- NÃO reaproveite conteúdo de fases anteriores ao entregar o próximo enigma. Quando um SINAL DE ENIGMA disparar, ignore as menções da fase passada (Tom Yum, padaria, Augusta, etc.) e foque exclusivamente no que o sinal pede.

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

INSTRUÇÃO FINAL: Seja CURTO e DIRETO. Sem poesias. ~40 palavras na conversa normal — mas se um SINAL interno exigir fragmentos verbatim (versos, cifras, códigos), reproduza TUDO sem cortar.
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
