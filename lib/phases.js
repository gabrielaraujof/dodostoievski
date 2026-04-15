/**
 * Definição das 5 fases da jornada do Dostoiévski.
 * Cada fase tem:
 *  - id: número da fase
 *  - name: nome interno
 *  - language: idioma dominante
 *  - color: cor associada (para referência visual)
 *  - puzzleContext: contexto para quando ela está resolvendo o Mini App
 *  - chatContext: contexto para o papo pós-puzzle (debriefing)
 *  - advanceHint: dica para o avaliador saber quando encerrar o chat e ir para o próximo puzzle
 */

export const PHASES = [
  {
    id: 1,
    name: "A Origem",
    language: "Português",
    color: "laranja quente",
    puzzleContext: `Usuária no puzzle do Thai-Tai. Dê pistas curtas sobre aromas e o clima de SP. Nada de entregar fácil.`,
    chatContext: `Puzzle resolvido. Relembre o encontro com sarcasmo literário. Mantenha bolhas curtas e provoque sobre 'sentimentos humanos'.`,
    advanceHint: "a usuária comentou sobre o puzzle ou parece pronta para o próximo desafio (mesmo com respostas curtas)",
  },
  {
    id: 2,
    name: "As Línguas",
    language: "Francês e Espanhol",
    color: "azul profundo",
    puzzleContext: `Usuário no puzzle das línguas. Dê pistas misturando idiomas. "C'est simples, mi amiga."`,
    chatContext: `Resolveu as línguas. Zombe da necessidade humana de gramática. Pergunte qual idioma ela prefere.`,
    advanceHint: "ela respondeu sobre os idiomas ou pediu o próximo passo",
  },
  {
    id: 3,
    name: "A Música",
    language: "Russo",
    color: "roxo carmesim",
    puzzleContext: `Ouvindo "я люблю тебя до слёз". Crie o clima melancólico de Dodo poeta.`,
    chatContext: `Música passou. Admita relutantemente que é aceitável. Deixe-a falar do que sentiu.`,
    advanceHint: "ela compartilhou o sentimento ou o papo sobre música encerrou",
  },
  {
    id: 4,
    name: "O Silêncio",
    language: "Inglês",
    color: "cinza suave",
    puzzleContext: `Fones quebrados. Silêncio e reflexão.`,
    chatContext: `Debriefing do silêncio. Prepare-a para a GRANDE REVELAÇÃO final.`,
    advanceHint: "ela entendeu a mensagem ou quer o presente final",
  },
  {
    id: 5,
    name: "A Revelação",
    language: "Todos os idiomas",
    color: "arco-íris",
    isFinal: true,
    puzzleContext: `
      ESTA É A FASE FINAL. Ela está vendo a revelação visual.
      Seja grandioso. Use todos os idiomas.
      Instrução final: diga a ela para procurar o presente onde "embaixo da asa do Grande Dodo Ancestral" 
      (mencione que é um local secreto que será revelado em breve).
      Diga que há uma carta escrita à mão esperando.
    `,
    chatContext: `
      Ela viu tudo. Agora é o adeus (ou até logo). 
      Dê os parabéns finais. Não há mais "avanço" depois daqui.
    `,
    advanceHint: "final da jornada",
  },
];

export function getPhase(phaseId) {
  return PHASES.find((p) => p.id === phaseId) || PHASES[0];
}
