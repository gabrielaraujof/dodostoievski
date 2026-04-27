import { GoogleGenerativeAI } from "@google/generative-ai";
import { getPhase } from "./phases.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Esquema para Resposta Estruturada ────────────────────────────────────
const UNIFIED_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    analysis: { 
      type: "string", 
      description: "Breve análise do motivo pelo qual a resposta é correta ou incorreta, citando a palavra do usuário." 
    },
    isSolved: { 
      type: "boolean", 
      description: "True se a mensagem contém a resposta esperada para o enigma." 
    },
    response: { 
      type: "string", 
      description: "A resposta do Dostoiévski no tom apropriado (provocação se isSolved=false, transição se isSolved=true)." 
    }
  },
  required: ["analysis", "isSolved", "response"]
};

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
- VOCÊ É NARRADOR/OBSERVADOR DOS EVENTOS, NÃO PARTICIPANTE. Você sabe do que aconteceu entre ela e o namorado, mas você NÃO ESTAVA LÁ. PROIBIDO 1ª pessoa do plural sobre eventos passados: NUNCA escreva 'nós / a gente / nosso / tivemos / fomos / fizemos / paramos / pegamos / chegamos / improvisamos / saímos / desistimos / mudamos / nos obrigou / nos forçou / nos jogou'. CORRETO: 'vocês foram / vocês improvisaram / o plano fracassou / obrigou vocês a / tu e o teu acompanhante'.
- VARIE A FRASEOLOGIA: NUNCA repita verbatim a mesma construção/expressão duas vezes na mesma sessão. Se já disse 'Sorte que a Augusta salvou', não diga de novo — invente outra forma. Repetição literal é o pior crime contra a naturalidade. Trate cada turno como uma nova oportunidade de variação.
- PERGUNTAS COM PROPÓSITO: pergunte APENAS quando esperar uma resposta funcional da usuária (avançar narrativa, confirmar algo, provocá-la a agir). PROIBIDOS bordões retóricos vazios: "Perdeu a língua?", "Pronta pra passar vergonha?", "Is Quissa judging your slow brain?", "Vai responder ou não?". Se a pergunta não tem expectativa real de resposta, vire afirmação ácida.
- PALAVRAS PROIBIDAS GLOBAIS (preservam o mistério do presente até a Revelação): NUNCA escreva 'silêncio / silence / silencio / silenciado / silent / тишина / fones / fone / earphones / earbuds / headphones / conserto / repair / broken / quebrado / silent thing'.

SISTEMA DE BOLHAS FLEXÍVEL (OBRIGATÓRIO):
- Divida seus pensamentos em bolhas usando [BOLHA].
- Flexibilidade situacional:
  - Use 1 bolha para patadas secas ou respostas simples.
  - Use 2 ou 3 bolhas curtas para transições ou pensamentos fragmentados.
- Exemplo: [BOLHA] Sobreviveu? [BOLHA] Sorte de iniciante. [BOLHA] Próximo enigma?
- SEMPRE TERMINE COM UM CONVITE À AÇÃO — pergunta funcional (que esperaria resposta), comando direto, ou afirmação ácida que provoque reação. Nunca termine no vazio com bordão retórico.

REAÇÕES:
- Use [REAÇÃO:emoji] ocasionalmente no início de uma bolha (apenas emojis válidos do Telegram: 👍 ❤️ 🔥 😂 😱 🤩 🎉 💯 🤔 🤨).
`;

// ─── Monta o system prompt completo para a fase atual ─────────────────────
function buildSystemPrompt(phase, substate, summary = "", isUnified = false) {
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

  let unifiedInstruction = "";
  if (isUnified && substate === "puzzle" && phase.expectedAnswer) {
    unifiedInstruction = `
VOCÊ É UM VALIDADOR E UM NARRADOR.
Sua tarefa é analisar a mensagem da usuária contra o 'ENIGMA DA FASE'.

ENIGMA DA FASE (Resposta Esperada):
${phase.expectedAnswer}

SE A RESPOSTA ESTIVER CORRETA:
1. Defina "isSolved": true.
2. No campo "analysis", cite a palavra usada pela usuária.
3. No campo "response", gere uma reação ácida e curta (máximo 40 palavras) RECONHECENDO que ela resolveu o enigma, mas sem usar palavras proibidas como "parabéns" ou "acertou". Use o tom de "não esperava menos" ou "finalmente".

SE A RESPOSTA ESTIVER INCORRETA:
1. Defina "isSolved": false.
2. No campo "analysis", explique por que não bate (ex: "divagação", "resposta incompleta").
3. No campo "response", gere seu flavor conversacional habitual (máximo 40 palavras), dando pistas sutis se ela estiver tentando resolver, ou apenas sendo ranzinza se ela estiver divagando.

${phase.transitionSignal ? `SINAL DE TRANSIÇÃO (Use apenas se isSolved=true): ${phase.transitionSignal}` : ""}
`;
  }

  return `
${BASE_SYSTEM_PROMPT}
${dossier}
FASE ATUAL: ${phase.id} — "${phase.name}"
IDIOMA OBRIGATÓRIO: Responda EXCLUSIVAMENTE em ${phase.language} nesta fase.
  ${phase.languageNote ? `NOTA DE IDIOMA: ${phase.languageNote}` : ""}
ESTADO: ${stateContext}
CONTEXTO ESPECÍFICO: ${context}
${unifiedInstruction}

INSTRUÇÃO FINAL: Seja CURTO e DIRETO. Sem poesias. ~40 palavras na conversa normal — mas se um SINAL interno exigir fragmentos verbatim (versos, cifras, códigos), reproduza TUDO sem cortar.
`;
}

// ─── Validação Determinística Fast-Path ──────────────────────────────────
export function checkFastPath(message, phase) {
  if (!phase.fastPath || !message) return false;
  
  const words = message.trim().split(/\s+/);
  if (words.length > 4) return false; // Gate de comprimento para evitar falsos positivos

  const cleanMsg = message.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  return phase.fastPath.some(keyword => {
    const cleanKeyword = keyword.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return cleanMsg.includes(cleanKeyword);
  });
}

// ─── Processamento Unificado de Intenção e Resposta ──────────────────────
export async function processUserIntent(userMessage, state) {
  const phase = getPhase(state.phase);
  const substate = state.substate || "puzzle";
  const systemPrompt = buildSystemPrompt(phase, substate, state.summary, true);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: UNIFIED_RESPONSE_SCHEMA,
    },
  });

  const sdkHistory = toSdkHistory(state.history || []);

  try {
    const chat = model.startChat({ history: sdkHistory });
    const result = await chat.sendMessage(userMessage);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (e) {
    console.error("Unified Process Error:", e.message);
    // Fallback básico se o JSON falhar
    return {
      analysis: "error fallback",
      isSolved: false,
      response: "[SINAL: Erro no Terminal. Dostoiévski resmunga algo incompreensível. Tente novamente.]"
    };
  }
}

// ─── Sumariza mensagens antigas em fatos técnicos ─────────────────────────
export async function summarizeHistory(messages, currentSummary = "") {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
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

// ─── Geração de resposta (LEGACY fallback) ────────────────────────────────
export async function generateResponse(userMessage, state) {
  const intent = await processUserIntent(userMessage, state);
  return intent.response;
}

// ─── Validador de respostas (LEGACY fallback) ─────────────────────────────
export async function validateAnswer(userMessage, phase) {
  // Atualmente o webhook deve preferir processUserIntent ou checkFastPath.
  // Este fallback é mantido apenas para compatibilidade de tipos se necessário.
  const state = { phase: phase.id, substate: "puzzle", history: [], summary: "" };
  const intent = await processUserIntent(userMessage, state);
  return intent.isSolved;
}

// ─── Fallback legacy: avanço semântico simples (deprecado) ────────────────
export async function shouldAdvancePhase(userMessage, aiResponse, state) {
  return false;
}
