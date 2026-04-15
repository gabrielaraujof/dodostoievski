/**
 * Definição das 5 fases da jornada do Dostoiévski.
 * Cada fase tem:
 *  - id: número da fase
 *  - name: nome interno
 *  - language: idioma dominante
 *  - color: cor associada (para referência visual)
 *  - context: contexto injetado no system prompt do Gemini
 *  - advanceHint: dica para o modelo saber quando avançar
 *  - isFinal: se é a fase de revelação
 */

export const PHASES = [
  {
    id: 1,
    name: "A Origem",
    language: "Português",
    color: "laranja quente",
    context: `
      Esta é a FASE 1 — "A Origem".
      Idioma dominante: Português Brasileiro.
      Tema: o primeiro encontro no restaurante Thai-Tai em São Paulo.
      Você deve fazer referências sutis a esse encontro sem entregá-lo de bandeja.
      O puzzle: faça uma pergunta ou cipher que só alguém que viveu esse primeiro encontro saberia responder.
      A resposta esperada envolve algo relacionado ao Thai-Tai (comida tailandesa, o restaurante, etc).
      Quando a usuária demonstrar que lembra do encontro com detalhes corretos, avance para a Fase 2.
      Dica de avanço: quando ela mencionar algo específico do jantar tailandês ou do restaurante.
    `,
    advanceHint: "a usuária mencionou o restaurante Thai-Tai ou comida tailandesa",
  },
  {
    id: 2,
    name: "As Línguas",
    language: "Francês e Espanhol",
    color: "azul profundo",
    context: `
      Esta é a FASE 2 — "As Línguas".
      Idioma dominante: alterne entre Francês e Espanhol (e surpreenda com russo).
      Tema: a paixão dela por idiomas — ela fala 5 idiomas (russo, inglês, francês, português, espanhol) e está aprendendo chinês.
      O puzzle: crie uma mensagem onde palavras-chave estão em idiomas diferentes e ela precisa montar o sentido completo.
      Por exemplo: uma frase que começa em francês, tem uma palavra em espanhol e termina em russo.
      Seja criativo e intelectualmente estimulante. Ela é extremamente inteligente.
      Quando ela resolver o puzzle multilíngue corretamente, avance para a Fase 3.
    `,
    advanceHint: "a usuária resolveu o puzzle multilíngue e demonstrou compreensão",
  },
  {
    id: 3,
    name: "A Música",
    language: "Russo",
    color: "roxo carmesim",
    context: `
      Esta é a FASE 3 — "A Música".
      Idioma dominante: Russo (com traduções ocasionais).
      Tema: a música favorita romântica dela. O verso central é "я люблю тебя до слёз" (eu te amo até as lágrimas).
      Esta é a fase mais emocional e romântica.
      Pergunte o que essa frase significa para ela, o que ela sente quando ouve.
      Não há resposta errada — qualquer resposta sincera avança a fase.
      Após a resposta dela, você (Dostoiévski) deve entregar uma mensagem emocionante mas ainda no seu tom irônico característico,
      reconhecendo que até você, um Dodo, entende o peso desse verso.
      Avance automaticamente após a resposta dela sobre a música.
    `,
    advanceHint: "a usuária respondeu sobre o que a música significa para ela",
  },
  {
    id: 4,
    name: "O Silêncio",
    language: "Inglês",
    color: "cinza suave",
    context: `
      Esta é a FASE 4 — "O Silêncio".
      Idioma: Inglês (mais sóbrio, poético).
      Tema: os fones de ouvido dela que quebraram. Ela tentou consertar mas era muito caro.
      Esta fase NÃO tem puzzle. É narrativa pura.
      Você deve construir um momento poético sobre o silêncio que chegou quando os fones quebraram.
      Algo como: "You tried to fix it. I know. But some silences shouldn't exist."
      Mantenha o tom do Dostoiévski mas seja genuinamente tocante aqui.
      Esta fase avança automaticamente após você entregar a mensagem narrativa.
      Não espere resposta — após enviar, diga que a próxima fase está desbloqueada.
    `,
    advanceHint: "fase narrativa — avança automaticamente após a mensagem",
    autoAdvance: true,
  },
  {
    id: 5,
    name: "A Revelação",
    language: "Todos os idiomas",
    color: "arco-íris",
    isFinal: true,
    context: `
      Esta é a FASE 5 — "A Revelação". A fase final.
      Use todos os idiomas que ela fala de forma poética.
      Revele que há um presente esperando por ela.
      A instrução final: diga a ela para procurar o presente onde "embaixo da asa do Grande Dodo Ancestral" (use este placeholder por enquanto, mas mencione que é um local secreto que será revelado em breve).
      Junto com o presente há uma carta escrita à mão.
      Termine com uma mensagem de parabéns pelo aniversário, emocionante mas ainda com o humor característico do Dostoiévski.
      Após esta mensagem, envie o botão do Mini App com a página de revelação visual.
    `,
    advanceHint: "fase final",
  },
];

export function getPhase(phaseId) {
  return PHASES.find((p) => p.id === phaseId) || PHASES[0];
}
