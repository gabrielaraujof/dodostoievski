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
1. O prato que causou uma reação alérgica (Tom Yum).
2. O lugar que estava fechado e nos obrigou a mudar o plano (Carlo's Bakery).
Não diga os nomes. Provoque-a sobre a memória falha dos humanos.`,
    chatContext: `Ela lembrou do desastre do Tom Yum e da porta na cara na Carlo's Bakery. 
Ria da "face de rubi" (reação alérgica) dela naquele dia. 
Mencione como o plano B (Augusta/Urbanóide) foi a salvação.
Transite para o próximo enigma desafiando a capacidade poliglota dela.`,
    advanceType: "llm",
    llmAdvanceHint: "A usuária mencionou o Tom Yum, a reação alérgica, a Carlo's Bakery ou o passeio na Augusta/Urbanóide",
  },
  {
    id: 2,
    name: "As Línguas",
    language: "Francês",
    languageNote: `Responda predominantemente em Francês. Ocasionalmente misture uma palavra em Espanhol ou Russo para provocar.
Português só se ela ficar completamente perdida. Ela é uma poliglota "hardcore", não facilite.`,
    color: "azul profundo",
    puzzleContext: `A usuária resolve um puzzle multilíngue complexo. 
Dê pistas misturando Francês, Espanhol e Russo. 
O foco é a palavra 'lágrimas' em Russo (слезы - slezy).`,
    chatContext: `Ela decifrou o enigma das línguas. Comente que até um Dodo ficaria impressionado (mentira).
Pergunte se ela se sente mais inteligente agora. 
Transite para a fase musical com um tom mais melancólico e misterioso.`,
    advanceType: "poll",
    pollQuestion: "Quelle est la traduction de 'lágrimas' en russe?",
    pollOptions: ["слёзы", "любовь", "сердце", "душа"],
    correctOptionId: 0,
    pollImage: "/images/polls/phase2.jpg",
    pollImageEnvVar: "POLL_PHASE_2_PHOTO",
    pollImageCaption: "*Fase II — As Línguas* 🦤\n_Uma palavra. Três idiomas. Um sentimento que escorre pelos olhos._",
    pollDescription: "Larmes. Lágrimas. Tears. Escolha a tradução russa.",
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
    pollImage: "/images/polls/phase3.jpg",
    pollImageEnvVar: "POLL_PHASE_3_PHOTO",
    pollImageCaption: "*Fase III — A Música* 🦤\n_A canção que toca quando algo importante se cala._",
    pollDescription: "Identifique a voz por trás dessa balada russa.",
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
