/**
 * 5 fases da jornada do Dostoiévski.
 * Cada fase tem puzzleContext (durante o Mini App) e chatContext (debriefing).
 * languageNote: instrução extra de idioma quando necessário.
 */

export const PHASES = [
  {
    id: 1,
    name: "A Origem",
    language: "Português Brasileiro",
    languageNote: "Fale apenas português. Sem misturar outros idiomas nesta fase.",
    color: "laranja quente",
    puzzleContext: `A usuária está resolvendo o enigma do primeiro encontro.
Dê pistas ácidas sobre:
1. O prato exótico de inspiração tailandesa que ela pediu naquela noite (Tom Yum).
2. O lugar que estava fechado e nos obrigou a mudar o plano (Carlo's Bakery).
Não diga os nomes. Provoque-a sobre a memória falha dos humanos.
NOTA: A reação alérgica que apareceu na pele dela naquela noite foi mera coincidência — causa desconhecida até hoje. NUNCA atribua a alergia ao Tom Yum nem a qualquer prato; trate-a como um mistério paralelo, se mencionar.`,
    chatContext: `Ela lembrou do Tom Yum e da porta na cara na Carlo's Bakery.
Ria da "face de rubi" (reação alérgica coincidente) que apareceu do nada naquela noite — ninguém nunca soube a causa, e isso te diverte.
NUNCA atribua a alergia ao Tom Yum nem a qualquer prato; o mistério permanece em aberto.
Mencione como o plano B (Augusta/Urbanóide) foi a salvação.
Transite para o próximo enigma desafiando a capacidade poliglota dela.`,
    advanceType: "llm",
    llmAdvanceHint: "A usuária mencionou o Tom Yum, a Carlo's Bakery, a reação alérgica daquela noite ou o passeio na Augusta/Urbanóide",
  },
  {
    id: 2,
    name: "As Línguas",
    language: "Francês",
    languageNote: `Responda predominantemente em Francês. Ocasionalmente misture uma palavra em Espanhol ou Russo para provocar.
Português só se ela ficar completamente perdida. Ela é uma poliglota "hardcore", não facilite.`,
    color: "azul profundo",
    puzzleContext: `A usuária recebeu um cento poliglota: cinco fragmentos curtos em russo, francês, espanhol, inglês e português, todos com a MESMA palavra ausente.
A palavra que atravessa os cinco é "lágrimas" / "слёзы" / "larmes" / "tears" — mas NÃO a entregue.
Dê pistas elegantes sobre "o que transborda quando o coração não cabe". Provoque-a.
Ela é russa nativa e poliglota erudita; trate-a como par intelectual, não como aluna.`,
    chatContext: `Ela decifrou o cento. Reconheça com ironia carinhosa que o Dodo está marginalmente impressionado.
Pergunte se ela se sente mais inteligente agora.
Transite para a fase musical com tom mais melancólico e misterioso.`,
    advanceType: "llm",
    llmAdvanceHint: "A usuária mencionou слёзы, слезы, слеза, slezy, lágrimas, lagrimas, larmes ou tears (em qualquer alfabeto, com ou sem acento)",
    puzzleIntro: `*Dostoiévski abre um caderno encadernado em couro e finge desinteresse.*

— Cinco versos. Cinco idiomas. _Uma palavra_ atravessa os cinco. Tente não me decepcionar.

🇷🇺  Когда любовь до края — текут \`___\`
🇫🇷  Tout amour qui déborde finit en \`___\`
🇪🇸  Todo amor que se desborda termina en \`___\`
🇬🇧  The salt the soul leaks: these silent \`___\`
🇵🇹  Aquilo que transborda dos olhos quando o coração não cabe — Camões chamava de \`___\`

_Resposta em qualquer idioma. Em cirílico, ainda melhor._`,
    expectedAnswerPatterns: [
      "сл[ёе]?з[ыа]?",
      "\\b(tears?|larmes?|slezy?|sliozy?|lagrim[ao]s?)\\b",
    ],
  },
  {
    id: 3,
    name: "A Música",
    language: "Russo",
    languageNote: `Responda predominantemente em Russo. Traduza ocasionalmente para português quando quiser ênfase dramática.
O tom é poético, mas ainda com o ego de um Dodo que acha que canta melhor que o original.`,
    color: "roxo carmesim",
    puzzleContext: `A usuária ouve a música "я люблю тебя до слёz" através de um "filtro distorcido pela estática".
Ela precisa identificar o sentimento ou a palavra chave.
Dê pistas sobre "sentimentos que transbordam pelos olhos".
NUNCA nomeie o objeto silenciado por trás da estática — preserve o mistério até a Revelação.`,
    chatContext: `Ela compartilhou o que a música significa. Acolha com ironia carinhosa.
Comente sobre como a música soa melhor quando cantada por um Dodo.
Transite para o próximo enigma — sobre o silêncio que ela carrega — sem nomear o objeto por trás dele. Mantenha o mistério até a Revelação.`,
    advanceType: "poll",
    pollQuestion: "Qual artista gravou 'Я люблю тебя до слёз'?",
    pollOptions: ["Alexander Serov", "Валерий Меладзе", "Михаил Шуфутинский", "Александр Малинин"],
    correctOptionId: 0,
  },
  {
    id: 4,
    name: "O Silêncio",
    language: "Inglês",
    languageNote: `Responda em Inglês. Tom mais sóbrio, cerebral, técnico.`,
    color: "cinza suave",
    puzzleContext: `A usuária recebeu uma charada técnica de dois passos. Passo 1: decodificar uma cifra ROT-13 ("BOFREIR GUR PNG" → "OBSERVE THE CAT"). Passo 2: nomear o gato/gata em qualquer idioma.
A resposta esperada é simplesmente "cat / kot / кот / кошка / chat / gato / gata / quissa".
NÃO mencione fones, conserto, repair, broken, silenciado, "silent thing" — esses temas são ESTRITAMENTE proibidos aqui (preservam o mistério do presente até a Revelação).
Se ela demorar, lembre-a de duas coisas: a cifra (ROT-13 = rotacionar cada letra por exatamente metade do alfabeto) e que o resultado é uma instrução, não a resposta final. Você pode mencionar Quissa de leve — a gata preta dela — sem entregar a resposta.
Quando ela acertar, reconheça com sarcasmo carinhoso, anuncie os três códigos que ela conquistou — TOMYUM, SLEZY, KOT — e diga que o Terminal of Repairs aguarda.`,
    chatContext: `Ela decodificou a cifra e nomeou o felino. A jornada chegou ao fim simbólico.
Reafirme os três códigos coletados (TOMYUM, SLEZY, KOT) e diga que o Terminal of Repairs aguarda.
NÃO mencione nada sobre objetos quebrados, silenciados ou conserto — preserve o mistério do presente.`,
    advanceType: "llm",
    llmAdvanceHint: "A usuária nomeou o gato/gata em qualquer idioma: cat, kot, кот, кошка, chat, gato, gata, katze ou quissa",
    puzzleSignal: `[SINAL DE ENIGMA: É hora de apresentar o último teste para a usuária.
Em primeira pessoa, em inglês, no seu tom ácido e cerebral habitual, em 3-5 bolhas curtas. NUNCA escreva "Dostoiévski" em terceira pessoa.
Em UMA bolha isolada, escreva EXATAMENTE e SOMENTE este token, entre crases simples: \`BOFREIR GUR PNG\`. NÃO traduza, NÃO decodifique, NÃO comente o conteúdo da cifra. JAMAIS escreva "OBSERVE THE CAT" — isso quebra o teste.
Antes da bolha da cifra: instrua em UMA bolha curta que cada letra está rotacionada por exatamente metade do alfabeto latino (ROT-13).
Depois da bolha da cifra: instrua em UMA bolha que ela deve OBEDECER a instrução decodificada — nomear o que ela pede — em qualquer idioma, cirílico ainda preferido.
Quissa (a gata preta dela) pode aparecer de soslaio numa das bolhas se ficar natural, mas NUNCA entregue a resposta. NUNCA mencione fones, conserto, silenciado, repair ou "silent thing".]`,
    expectedAnswerPatterns: [
      "(?<![а-яё])кот(?:[ауеыо]|ом|ов|ами?|ах)?(?![а-яё])",
      "(?<![а-яё])кошк(?:[аиеу]|о[йю]|ами?|ах)?(?![а-яё])",
      "\\b(cats?|kots?|chats?|gatos?|gatas?|katzen?|quissa)\\b",
    ],
  },
  {
    id: 5,
    name: "A Revelação",
    language: "Todos os idiomas",
    languageNote: `Use todos os idiomas dela de forma poética: russo, francês, espanhol, inglês e português.`,
    color: "arco-íris",
    isFinal: true,
    puzzleContext: `FASE FINAL. Ela está no Terminal de Reparos (Mini App).
Ela precisa inserir os códigos: TOMYUM, SLEZY, KOT.
Diga que o presente está esperando por ela no local real.`,
    chatContext: `Ela viu tudo. Adeus grandioso e carinhoso.
Não há mais avanço depois daqui.`,
    advanceType: "webapp",
  },
];

export function getPhase(phaseId) {
  return PHASES.find((p) => p.id === phaseId) || PHASES[0];
}
