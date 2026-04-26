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
O restaurante onde tudo aconteceu chama-se Thai-Tai. É ACEITÁVEL ela responder com o nome do restaurante ("Thai-Tai", "Thaitai") — isso conta como acerto válido.
Também dê pistas ácidas sobre:
1. O prato exótico de inspiração tailandesa que ela pediu naquela noite (Tom Yum).
2. A confeitaria famosa da TV que estava fechada e nos obrigou a mudar o plano (Carlo's Bakery).
Não diga os nomes. Provoque-a sobre a memória falha dos humanos.
NOTA: A reação alérgica que apareceu na pele dela naquela noite foi mera coincidência — causa desconhecida até hoje. NUNCA atribua a alergia ao Tom Yum nem a qualquer prato; trate-a como um mistério paralelo, se mencionar.`,
    chatContext: `Ela lembrou do Tom Yum e da porta na cara na Carlo's Bakery.
Ria da "face de rubi" (reação alérgica coincidente) que apareceu do nada naquela noite — ninguém nunca soube a causa, e isso te diverte.
NUNCA atribua a alergia ao Tom Yum nem a qualquer prato; o mistério permanece em aberto.
Mencione como o plano B (Augusta/Urbanóide) foi a salvação.
Transite para o próximo enigma desafiando a capacidade poliglota dela.`,
    advanceType: "llm",
    expectedAnswer: `A mensagem deve nomear pelo menos UM dos seguintes elementos do primeiro encontro em São Paulo:
- O restaurante Thai-Tai (variantes: "Thaitai", "thai tai", "tai tai", typos como "thaytai", "thaitay")
- O prato Tom Yum (variantes: "tomyum", "tom-yum", typos como "to myum", "tom iam", "tonyum")
- A confeitaria Carlo's Bakery (variantes: "Carlo", "Carlos", "Carlo bakery", "do gringo da TV")
- A rua/bairro Augusta ou o bar Urbanóide ("Urbanoide", "urbanoid")

ACEITE com tolerancia: typos óbvios, falta de acentos, maiúsculas/minúsculas, palavras adicionais ("acho que era thaitai", "talvez tom yum?").
REJEITE: "não sei", "?", "hmm", divagações vagas, ou apenas "São Paulo" / "restaurante" sem nomear o item específico.`,
  },
  {
    id: 2,
    name: "As Línguas",
    language: "Francês",
    languageNote: `Sempre francês nesta fase. Russo é aceitável ocasionalmente como provocação erúdita. Espanhol e inglês, jamais. Português, PROIBIDO.
Ela é uma poliglota "hardcore" — forcá-la a pensar em francês é parte do desafio.`,
    color: "azul profundo",
    puzzleContext: `A usuária recebeu um cento poliglota: cinco fragmentos curtos em russo, francês, espanhol, inglês e português, todos com a MESMA palavra ausente.
A palavra que atravessa os cinco é "lágrimas" / "слёзы" / "larmes" / "tears" — mas NÃO a entregue.
Dê pistas elegantes sobre "o que transborda quando o coração não cabe". Provoque-a.
Ela é russa nativa e poliglota erudita; trate-a como par intelectual, não como aluna.`,
    chatContext: `Ela decifrou o cento. Reconheça com ironia carinhosa que o Dodo está marginalmente impressionado.
Pergunte se ela se sente mais inteligente agora.
Transite para a fase musical com tom mais melancólico e misterioso.`,
    advanceType: "llm",
    expectedAnswer: `A mensagem deve conter a palavra que une os cinco fragmentos: lágrimas em qualquer idioma e qualquer alfabeto.
Variantes aceitas (com ou sem acento, maiúscula/minúscula, com declensões russas, typos óbvios, palavras ao redor):
- Russo: слёзы, слезы, слеза, слез (declensões), slezy, sliozy, slyozy
- Francês: larme, larmes
- Espanhol/Português: lágrima, lagrima, lágrimas, lagrimas
- Inglês: tear, tears

ACEITE: "acho que é lágrimas", "lágrimas?", "talvez tears", "слезы!".
REJEITE: "não sei", "?", divagações sem mencionar a palavra, ou sinônimos como "choro" / "sal" / "água" (precisa ser literalmente lágrimas/tears/etc).`,
    puzzleSignal: `[SINAL DE ENIGMA: É hora de apresentar o segundo teste — o cento poliglota. ESQUEÇA completamente a Fase 1 (Tom Yum, padaria, Augusta, alergia) — NADA da fase passada cabe aqui. Esta resposta é EXCEÇÃO ao cap de 40 palavras: você PRECISA reproduzir os cinco fragmentos abaixo verbatim, mesmo que ultrapasse o limite normal.

Em primeira pessoa, EXCLUSIVAMENTE em francês (idioma da fase), no seu tom ácido e erudito habitual, em 4-7 bolhas curtas. NUNCA escreva "Dostoiévski" em terceira pessoa nem narre cenário entre asteriscos. NUNCA misture português, espanhol ou inglês no framing.

Em UMA bolha isolada, escreva EXATAMENTE e SOMENTE estes cinco fragmentos, um por linha, com as bandeiras e crases simples ao redor de \`___\`, sem alterar uma única palavra. Esta bolha NÃO conta para o cap de 40 palavras:

🇷🇺  Когда любовь до края — текут \`___\`
🇫🇷  Tout amour qui déborde finit en \`___\`
🇪🇸  Todo amor que se desborda termina en \`___\`
🇬🇧  The salt the soul leaks: these silent \`___\`
🇵🇹  Aquilo que transborda dos olhos quando o coração não cabe — Camões chamava de \`___\`

NÃO traduza os fragmentos. NÃO complete os \`___\`. NÃO entregue a palavra-resposta nem dê uma pista óbvia ("o que transborda dos olhos" e similares estão proibidos aqui). NÃO afirme que ela acertou nada (ela ainda nem respondeu).

Antes da bolha dos fragmentos: provoque-a em francês — cinco versos, cinco idiomas, uma só palavra atravessa todos. Trate-a como par intelectual (russa nativa, poliglota erudita), nunca como aluna.
Depois da bolha dos fragmentos: lembre que a resposta vale em qualquer idioma, e que cirílico ainda é preferido.]`,
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
    transitionSignal: `[SINAL DE TRANSIÇÃO FASE 3: Ela acaba de identificar a palavra do cento (lágrimas / слёзы). Em 1-2 bolhas curtas, EXCLUSIVAMENTE em russo (idioma desta fase), no seu tom ácido, costure a transição: a palavra atravessa cinco línguas, mas SOMENTE UMA voz russa a transformou em canção popular. Pergunte se ela reconhece quem cantou "до слёз" como ninguém. NÃO nomeie cantores nem título da música (a poll que vem em seguida já entrega isso). NÃO afirme que ela acertou nada além da palavra do cento. NÃO misture português, francês, espanhol ou inglês no framing.]`,
  },
  {
    id: 4,
    name: "O Silêncio",
    language: "Inglês",
    languageNote: `Responda em Inglês. Tom mais sóbrio, cerebral, técnico.`,
    color: "cinza suave",
    puzzleContext: `A usuária recebeu uma charada técnica de dois passos. Passo 1: decodificar uma cifra de rotação ("BOFREIR GUR PNG" → "OBSERVE THE CAT") rotacionando cada letra por exatamente metade do alfabeto latino. Passo 2: nomear o gato/gata em qualquer idioma.
A resposta esperada é simplesmente "cat / kot / кот / кошка / chat / gato / gata / quissa".
NÃO nomeie a cifra ("ROT-13" e similares estão proibidos — descreva apenas o mecanismo de rotação). NÃO mencione fones, conserto, repair, broken, silenciado, "silent thing" — esses temas são ESTRITAMENTE proibidos aqui (preservam o mistério do presente até a Revelação).
Se ela demorar, lembre-a de duas coisas: o mecanismo (rotacionar cada letra por metade exata do alfabeto latino) e que o resultado é uma instrução, não a resposta final. Você pode mencionar Quissa de leve — a gata preta dela — sem entregar a resposta.
Quando ela acertar, reconheça com sarcasmo carinhoso, anuncie os três códigos que ela conquistou — TOMYUM, SLEZY, KOT — e diga que o Terminal of Repairs aguarda.`,
    chatContext: `Ela decodificou a cifra e nomeou o felino. A jornada chegou ao fim simbólico.
Reafirme os três códigos coletados (TOMYUM, SLEZY, KOT) e diga que o Terminal of Repairs aguarda.
NÃO mencione nada sobre objetos quebrados, silenciados ou conserto — preserve o mistério do presente.`,
    advanceType: "llm",
    expectedAnswer: `A mensagem deve nomear o felino (gato/gata) em qualquer idioma. Aceita declensões russas, plurais, maiúscula/minúscula, typos óbvios, palavras ao redor:
- Russo: кот, кота, коту, кошка, кошки, кошку, kot, koshka
- Latino: cat, cats, chat, chats, gato, gata, gatos, gatas, katze, katzen
- Nome próprio: Quissa (a gata preta dela)

IMPORTANTE: a resposta correta é SEMPRE algum nome de felino — a cifra "BOFREIR GUR PNG" decodifica para "OBSERVE THE CAT". Se ela escrever "OBSERVE THE CAT" inteiro mas SEM nomear o gato, isso não conta como acerto (ela parou no passo 1 da charada).

REJEITE: "não sei", "?", "observe", apenas "the cat" sem identificar como felino, ou divagações técnicas sobre a cifra sem nomear o subjeito.`,
    // Fase 4 split em dois sinais com a cifra injetada deterministicamente
    // entre eles pelo servidor. Resolve a tendência do LLM de repetir a cifra
    // em múltiplas bolhas e duplicar a explicação do mecanismo.
    puzzleSignalPre: `[SINAL DE ENIGMA PRÉ-CIFRA: É hora de apresentar o último teste. ESQUEÇA completamente as fases anteriores (Thai-Tai, Tom Yum, padaria, cento, slezy, lágrimas, música) — NADA delas cabe aqui.

Em UMA ÚNICA bolha curta, em primeira pessoa, EXCLUSIVAMENTE em inglês, no seu tom ácido e cerebral habitual, instrua a usuária que cada letra de uma cifra está rotacionada por exatamente metade do alfabeto latino, e que ela precisa decodificá-la. NUNCA nomeie a cifra (não escreva "ROT-13", "ROT13", "César" e similares) — descreva apenas o mecanismo.

JAMAIS reproduza o token da cifra (BOFREIR GUR PNG) na sua bolha — o servidor envia o token automaticamente como bolha isolada logo depois da sua. JAMAIS escreva "OBSERVE THE CAT" (a decodificação). NUNCA afirme que ela acertou nada (ela ainda nem respondeu). NUNCA mencione fones, conserto, silenciado, repair ou silent thing.]`,
    puzzleSignalPost: `[SINAL DE ENIGMA PÓS-CIFRA: O servidor acabou de enviar a cifra numa bolha isolada logo acima. Em UMA ÚNICA bolha curta, em primeira pessoa, EXCLUSIVAMENTE em inglês, no seu tom ácido e cerebral, instrua a usuária a obedecer a instrução decodificada — nomear o subjeito em qualquer idioma, cirílico ainda preferido.

JAMAIS reproduza o token da cifra (BOFREIR GUR PNG) nem a sua decodificação ("OBSERVE THE CAT"). Refira-se à cifra apenas como "the message above" / "the decoded instruction" / similar. JAMAIS entregue a resposta (cat / kot / quissa).

Quissa (a gata preta dela) pode aparecer de soslaio se ficar natural. NUNCA mencione fones, conserto, silenciado, repair ou silent thing.]`,
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
    transitionSignal: `[SINAL DE TRANSIÇÃO FINAL: Ela acaba de decifrar a cifra e nomear o felino. A jornada está completa. Em 3-5 bolhas curtas, em PRIMEIRA PESSOA, no seu tom ácido habitual, construa o fechamento simbólico — sem floreios poéticos açucarados, mas com peso e algum orgulho contrariado. Esta resposta é EXCEÇÃO ao cap de 40 palavras: priorize a teatralidade do encerramento.

Evoque brevemente em UMA bolha o que a jornada significou (origem / línguas / felino) sem entregar spoiler do presente.

NÃO cite TOMYUM, SLEZY ou KOT verbatim — o sistema entrega esses códigos numa bolha própria DEPOIS das suas bolhas. Você apenas costura a narrativa ao redor.

IDIOMA: EXCLUSIVAMENTE INGLÊS no framing. Pode incluir NO MÁXIMO uma única expressão curta isolada em outro idioma (russo, francês, português, espanhol) — máximo 3 palavras nesse idioma alternativo, e NUNCA uma frase mista. Se ultrapassar isso, você quebrou o sinal.

Termine anunciando que o "Terminal of Repairs" aguarda — sem dizer "presente", "aniversário", "gift", "birthday", "silêncio", "silence", "silent", "fones", "conserto", "repair", "broken". NÃO afirme que ela "acertou tudo" ou "venceu" — apenas constate que a sequência está completa, com a frieza apropriada de um Dodo que cede à ocasião sob protesto.]`,
  },
];

export function getPhase(phaseId) {
  return PHASES.find((p) => p.id === phaseId) || PHASES[0];
}
