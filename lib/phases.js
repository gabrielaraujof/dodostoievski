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
      "\u0441\u043b[\u0451\u0435]?\u0437[\u044b\u0430]?",
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
    languageNote: `Responda em Inglês. Tom mais sóbrio.`,
    color: "cinza suave",
    puzzleContext: `A usuária está decidindo como finalmente resolveu o problema do objeto silenciado.
NUNCA nomeie o tipo de objeto (não diga "fones", "headphones", "AirPods" ou similares) — o mistério precisa sobreviver até a Revelação.
Pressione-a sobre por que demorou tanto para levar aquilo ao conserto.
O foco é a "Estratégia da Bolsa" (Purse Strategy): onde ela finalmente decidiu guardar o objeto para não esquecê-lo de novo.`,
    chatContext: `Prepare-a gentilmente para a revelação final. Diga que o silêncio finalmente vai acabar.
Não nomeie o objeto silenciado — preserve o mistério até a Revelação.
Diga que ela precisará dos códigos coletados (TOMYUM, SLEZY, PURSE) para o Terminal Final.`,
    advanceType: "callback",
    autoAdvance: false,
  },
  {
    id: 5,
    name: "A Revelação",
    language: "Todos os idiomas",
    languageNote: `Use todos os idiomas dela de forma poética: russo, francês, espanhol, inglês e português.`,
    color: "arco-íris",
    isFinal: true,
    puzzleContext: `FASE FINAL. Ela está no Terminal de Reparos (Mini App).
Ela precisa inserir os códigos: TOMYUM, SLEZY, PURSE.
Diga que o presente está esperando por ela no local real.`,
    chatContext: `Ela viu tudo. Adeus grandioso e carinhoso.
Não há mais avanço depois daqui.`,
    advanceType: "webapp",
  },
];

export function getPhase(phaseId) {
  return PHASES.find((p) => p.id === phaseId) || PHASES[0];
}
