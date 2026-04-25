const PERSON_KEYS = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"];

function createConjugationEntry(prefix, index, {
  language,
  schoolGrade = 6,
  unit,
  lemma,
  german,
  tense = "present",
  forms
}) {
  const safeForms = {};
  PERSON_KEYS.forEach((key) => {
    safeForms[key] = String(forms[key] || "").trim();
  });

  return {
    id: `${prefix}-${String(index + 1).padStart(4, "0")}`,
    language,
    schoolGrade,
    unit,
    lemma,
    german,
    tense,
    forms: safeForms
  };
}

function englishThirdPerson(verb) {
  if (/(s|sh|ch|x|z|o)$/i.test(verb)) {
    return `${verb}es`;
  }
  if (/[^aeiou]y$/i.test(verb)) {
    return `${verb.slice(0, -1)}ies`;
  }
  return `${verb}s`;
}

function conjugateEnglishPresent(lemma) {
  const base = lemma.replace(/^to\s+/i, "").trim().toLowerCase();
  return {
    "1sg": base,
    "2sg": base,
    "3sg": englishThirdPerson(base),
    "1pl": base,
    "2pl": base,
    "3pl": base
  };
}

const EN_IRREGULAR = [
  { lemma: "to be", german: "sein", forms: { "1sg": "am", "2sg": "are", "3sg": "is", "1pl": "are", "2pl": "are", "3pl": "are" } },
  { lemma: "to have", german: "haben", forms: { "1sg": "have", "2sg": "have", "3sg": "has", "1pl": "have", "2pl": "have", "3pl": "have" } },
  { lemma: "to do", german: "machen; tun", forms: { "1sg": "do", "2sg": "do", "3sg": "does", "1pl": "do", "2pl": "do", "3pl": "do" } },
  { lemma: "to go", german: "gehen", forms: { "1sg": "go", "2sg": "go", "3sg": "goes", "1pl": "go", "2pl": "go", "3pl": "go" } },
  { lemma: "to can", german: "können", forms: { "1sg": "can", "2sg": "can", "3sg": "can", "1pl": "can", "2pl": "can", "3pl": "can" } },
  { lemma: "to must", german: "müssen", forms: { "1sg": "must", "2sg": "must", "3sg": "must", "1pl": "must", "2pl": "must", "3pl": "must" } },
  { lemma: "to will", german: "werden", forms: { "1sg": "will", "2sg": "will", "3sg": "will", "1pl": "will", "2pl": "will", "3pl": "will" } },
  { lemma: "to say", german: "sagen", forms: conjugateEnglishPresent("to say") },
  { lemma: "to make", german: "machen", forms: conjugateEnglishPresent("to make") },
  { lemma: "to take", german: "nehmen", forms: conjugateEnglishPresent("to take") },
  { lemma: "to come", german: "kommen", forms: conjugateEnglishPresent("to come") },
  { lemma: "to give", german: "geben", forms: conjugateEnglishPresent("to give") },
  { lemma: "to know", german: "wissen", forms: conjugateEnglishPresent("to know") },
  { lemma: "to think", german: "denken", forms: conjugateEnglishPresent("to think") },
  { lemma: "to choose", german: "wählen", forms: conjugateEnglishPresent("to choose") },
  { lemma: "to teach", german: "unterrichten", forms: conjugateEnglishPresent("to teach") }
];

const EN_REGULAR = [
  ["to play", "spielen"],
  ["to learn", "lernen"],
  ["to work", "arbeiten"],
  ["to walk", "laufen"],
  ["to read", "lesen"],
  ["to write", "schreiben"],
  ["to listen", "zuhören"],
  ["to speak", "sprechen"],
  ["to watch", "anschauen"],
  ["to help", "helfen"],
  ["to like", "mögen"],
  ["to love", "lieben"],
  ["to need", "brauchen"],
  ["to want", "wollen"],
  ["to start", "starten"],
  ["to finish", "beenden"],
  ["to open", "öffnen"],
  ["to close", "schließen"],
  ["to call", "anrufen"],
  ["to answer", "antworten"],
  ["to ask", "fragen"],
  ["to try", "versuchen"],
  ["to study", "lernen"],
  ["to train", "trainieren"],
  ["to dance", "tanzen"],
  ["to laugh", "lachen"],
  ["to smile", "lächeln"],
  ["to cry", "weinen"],
  ["to travel", "reisen"],
  ["to visit", "besuchen"],
  ["to clean", "putzen"],
  ["to cook", "kochen"],
  ["to carry", "tragen"],
  ["to draw", "zeichnen"],
  ["to paint", "malen"],
  ["to build", "bauen"],
  ["to move", "bewegen"],
  ["to turn", "drehen"],
  ["to use", "benutzen"],
  ["to change", "ändern"],
  ["to discover", "entdecken"],
  ["to imagine", "sich vorstellen"],
  ["to explain", "erklären"],
  ["to check", "prüfen"],
  ["to search", "suchen"],
  ["to find", "finden"],
  ["to lose", "verlieren"],
  ["to join", "beitreten"],
  ["to show", "zeigen"],
  ["to follow", "folgen"],
  ["to invite", "einladen"],
  ["to celebrate", "feiern"],
  ["to score", "punkten"],
  ["to kick", "treten"],
  ["to pass", "passen"],
  ["to tackle", "angreifen"],
  ["to support", "unterstützen"],
  ["to improve", "verbessern"],
  ["to complain", "sich beschweren"],
  ["to react", "reagieren"],
  ["to avoid", "vermeiden"],
  ["to focus", "sich konzentrieren"],
  ["to collect", "sammeln"],
  ["to recycle", "recyceln"],
  ["to share", "teilen"],
  ["to upload", "hochladen"],
  ["to download", "herunterladen"],
  ["to stream", "streamen"],
  ["to chat", "chatten"],
  ["to post", "posten"],
  ["to comment", "kommentieren"],
  ["to type", "tippen"],
  ["to click", "klicken"],
  ["to print", "drucken"],
  ["to research", "recherchieren"],
  ["to trust", "vertrauen"],
  ["to respect", "respektieren"],
  ["to practice", "üben"],
  ["to compete", "wetteifern"],
  ["to rescue", "retten"],
  ["to feed", "füttern"],
  ["to climb", "klettern"],
  ["to swim", "schwimmen"],
  ["to surf", "surfen"],
  ["to skate", "skaten"],
  ["to cycle", "radfahren"],
  ["to run", "rennen"],
  ["to jump", "springen"],
  ["to throw", "werfen"],
  ["to catch", "fangen"],
  ["to dribble", "dribbeln"],
  ["to miss", "verfehlen"],
  ["to defend", "verteidigen"]
];

const FR_IRREGULAR = [
  { lemma: "être", german: "sein", forms: { "1sg": "suis", "2sg": "es", "3sg": "est", "1pl": "sommes", "2pl": "êtes", "3pl": "sont" } },
  { lemma: "avoir", german: "haben", forms: { "1sg": "ai", "2sg": "as", "3sg": "a", "1pl": "avons", "2pl": "avez", "3pl": "ont" } },
  { lemma: "aller", german: "gehen", forms: { "1sg": "vais", "2sg": "vas", "3sg": "va", "1pl": "allons", "2pl": "allez", "3pl": "vont" } },
  { lemma: "faire", german: "machen", forms: { "1sg": "fais", "2sg": "fais", "3sg": "fait", "1pl": "faisons", "2pl": "faites", "3pl": "font" } },
  { lemma: "pouvoir", german: "können", forms: { "1sg": "peux", "2sg": "peux", "3sg": "peut", "1pl": "pouvons", "2pl": "pouvez", "3pl": "peuvent" } },
  { lemma: "vouloir", german: "wollen", forms: { "1sg": "veux", "2sg": "veux", "3sg": "veut", "1pl": "voulons", "2pl": "voulez", "3pl": "veulent" } },
  { lemma: "devoir", german: "müssen", forms: { "1sg": "dois", "2sg": "dois", "3sg": "doit", "1pl": "devons", "2pl": "devez", "3pl": "doivent" } },
  { lemma: "prendre", german: "nehmen", forms: { "1sg": "prends", "2sg": "prends", "3sg": "prend", "1pl": "prenons", "2pl": "prenez", "3pl": "prennent" } },
  { lemma: "venir", german: "kommen", forms: { "1sg": "viens", "2sg": "viens", "3sg": "vient", "1pl": "venons", "2pl": "venez", "3pl": "viennent" } },
  { lemma: "voir", german: "sehen", forms: { "1sg": "vois", "2sg": "vois", "3sg": "voit", "1pl": "voyons", "2pl": "voyez", "3pl": "voient" } },
  { lemma: "dire", german: "sagen", forms: { "1sg": "dis", "2sg": "dis", "3sg": "dit", "1pl": "disons", "2pl": "dites", "3pl": "disent" } },
  { lemma: "lire", german: "lesen", forms: { "1sg": "lis", "2sg": "lis", "3sg": "lit", "1pl": "lisons", "2pl": "lisez", "3pl": "lisent" } },
  { lemma: "écrire", german: "schreiben", forms: { "1sg": "écris", "2sg": "écris", "3sg": "écrit", "1pl": "écrivons", "2pl": "écrivez", "3pl": "écrivent" } },
  { lemma: "mettre", german: "setzen", forms: { "1sg": "mets", "2sg": "mets", "3sg": "met", "1pl": "mettons", "2pl": "mettez", "3pl": "mettent" } },
  { lemma: "savoir", german: "wissen", forms: { "1sg": "sais", "2sg": "sais", "3sg": "sait", "1pl": "savons", "2pl": "savez", "3pl": "savent" } },
  { lemma: "boire", german: "trinken", forms: { "1sg": "bois", "2sg": "bois", "3sg": "boit", "1pl": "buvons", "2pl": "buvez", "3pl": "boivent" } }
];

function conjugateFrenchEr(lemma) {
  const infinitive = lemma.trim().toLowerCase();
  const stem = infinitive.slice(0, -2);
  return {
    "1sg": `${stem}e`,
    "2sg": `${stem}es`,
    "3sg": `${stem}e`,
    "1pl": `${stem}ons`,
    "2pl": `${stem}ez`,
    "3pl": `${stem}ent`
  };
}

const FR_REGULAR_ER = [
  ["parler", "sprechen"],
  ["aimer", "mögen"],
  ["adorer", "lieben"],
  ["chanter", "singen"],
  ["danser", "tanzen"],
  ["jouer", "spielen"],
  ["travailler", "arbeiten"],
  ["étudier", "lernen"],
  ["écouter", "zuhören"],
  ["regarder", "anschauen"],
  ["chercher", "suchen"],
  ["trouver", "finden"],
  ["demander", "fragen"],
  ["répondre", "antworten"],
  ["habiter", "wohnen"],
  ["marcher", "gehen"],
  ["arriver", "ankommen"],
  ["rester", "bleiben"],
  ["penser", "denken"],
  ["donner", "geben"],
  ["porter", "tragen"],
  ["montrer", "zeigen"],
  ["laisser", "lassen"],
  ["aider", "helfen"],
  ["inviter", "einladen"],
  ["préparer", "vorbereiten"],
  ["nettoyer", "putzen"],
  ["ranger", "aufräumen"],
  ["fermer", "schließen"],
  ["ouvrir", "öffnen"],
  ["passer", "verbringen"],
  ["partager", "teilen"],
  ["organiser", "organisieren"],
  ["continuer", "weitermachen"],
  ["commencer", "beginnen"],
  ["terminer", "beenden"],
  ["gagner", "gewinnen"],
  ["perdre", "verlieren"],
  ["tomber", "fallen"],
  ["raconter", "erzählen"],
  ["expliquer", "erklären"],
  ["dessiner", "zeichnen"],
  ["nager", "schwimmen"],
  ["skater", "skaten"],
  ["surfer", "surfen"],
  ["grimper", "klettern"],
  ["rouler", "fahren"],
  ["courir", "rennen"],
  ["sauter", "springen"],
  ["lancer", "werfen"],
  ["attraper", "fangen"],
  ["noter", "notieren"],
  ["compter", "zählen"],
  ["réviser", "wiederholen"],
  ["corriger", "korrigieren"],
  ["bricoler", "basteln"],
  ["visiter", "besuchen"],
  ["voyager", "reisen"],
  ["recycler", "recyceln"],
  ["respecter", "respektieren"],
  ["cliquer", "klicken"],
  ["poster", "posten"],
  ["commenter", "kommentieren"],
  ["taper", "tippen"],
  ["imprimer", "drucken"],
  ["chasser", "jagen"],
  ["garder", "behalten"],
  ["préférer", "bevorzugen"],
  ["décorer", "dekorieren"],
  ["trier", "sortieren"],
  ["écarter", "wegschieben"],
  ["réparer", "reparieren"],
  ["respecter", "beachten"],
  ["aimer bien", "gern haben"],
  ["photographier", "fotografieren"],
  ["créer", "erstellen"],
  ["partir", "weggehen"],
  ["arrêter", "anhalten"],
  ["bavarder", "plaudern"],
  ["fêter", "feiern"],
  ["motiver", "motivieren"],
  ["protester", "protestieren"],
  ["informer", "informieren"],
  ["observer", "beobachten"],
  ["questionner", "befragen"],
  ["souligner", "unterstreichen"],
  ["contrôler", "kontrollieren"],
  ["voyager", "verreisen"],
  ["utiliser", "benutzen"],
  ["échanger", "austauschen"],
  ["apporter", "mitbringen"],
  ["emporter", "wegtragen"],
  ["préserver", "bewahren"],
  ["imaginer", "sich vorstellen"]
];

const LA_IRREGULAR = [
  { lemma: "esse", german: "sein", forms: { "1sg": "sum", "2sg": "es", "3sg": "est", "1pl": "sumus", "2pl": "estis", "3pl": "sunt" } },
  { lemma: "posse", german: "können", forms: { "1sg": "possum", "2sg": "potes", "3sg": "potest", "1pl": "possumus", "2pl": "potestis", "3pl": "possunt" } },
  { lemma: "velle", german: "wollen", forms: { "1sg": "volo", "2sg": "vis", "3sg": "vult", "1pl": "volumus", "2pl": "vultis", "3pl": "volunt" } },
  { lemma: "nolle", german: "nicht wollen", forms: { "1sg": "nolo", "2sg": "non vis", "3sg": "non vult", "1pl": "nolumus", "2pl": "non vultis", "3pl": "nolunt" } },
  { lemma: "ferre", german: "tragen", forms: { "1sg": "fero", "2sg": "fers", "3sg": "fert", "1pl": "ferimus", "2pl": "fertis", "3pl": "ferunt" } },
  { lemma: "ire", german: "gehen", forms: { "1sg": "eo", "2sg": "is", "3sg": "it", "1pl": "imus", "2pl": "itis", "3pl": "eunt" } },
  { lemma: "dare", german: "geben", forms: { "1sg": "do", "2sg": "das", "3sg": "dat", "1pl": "damus", "2pl": "datis", "3pl": "dant" } },
  { lemma: "stare", german: "stehen", forms: { "1sg": "sto", "2sg": "stas", "3sg": "stat", "1pl": "stamus", "2pl": "statis", "3pl": "stant" } },
  { lemma: "videre", german: "sehen", forms: { "1sg": "video", "2sg": "vides", "3sg": "videt", "1pl": "videmus", "2pl": "videtis", "3pl": "vident" } },
  { lemma: "habere", german: "haben", forms: { "1sg": "habeo", "2sg": "habes", "3sg": "habet", "1pl": "habemus", "2pl": "habetis", "3pl": "habent" } },
  { lemma: "audire", german: "hören", forms: { "1sg": "audio", "2sg": "audis", "3sg": "audit", "1pl": "audimus", "2pl": "auditis", "3pl": "audiunt" } },
  { lemma: "dicere", german: "sagen", forms: { "1sg": "dico", "2sg": "dicis", "3sg": "dicit", "1pl": "dicimus", "2pl": "dicitis", "3pl": "dicunt" } },
  { lemma: "ducere", german: "führen", forms: { "1sg": "duco", "2sg": "ducis", "3sg": "ducit", "1pl": "ducimus", "2pl": "ducitis", "3pl": "ducunt" } },
  { lemma: "facere", german: "machen", forms: { "1sg": "facio", "2sg": "facis", "3sg": "facit", "1pl": "facimus", "2pl": "facitis", "3pl": "faciunt" } },
  { lemma: "legere", german: "lesen", forms: { "1sg": "lego", "2sg": "legis", "3sg": "legit", "1pl": "legimus", "2pl": "legitis", "3pl": "legunt" } },
  { lemma: "scribere", german: "schreiben", forms: { "1sg": "scribo", "2sg": "scribis", "3sg": "scribit", "1pl": "scribimus", "2pl": "scribitis", "3pl": "scribunt" } }
];

function conjugateLatinAre(lemma) {
  const infinitive = lemma.trim().toLowerCase();
  const stem = infinitive.replace(/are$/i, "");
  return {
    "1sg": `${stem}o`,
    "2sg": `${stem}as`,
    "3sg": `${stem}at`,
    "1pl": `${stem}amus`,
    "2pl": `${stem}atis`,
    "3pl": `${stem}ant`
  };
}

const LA_REGULAR_ARE = [
  ["amare", "lieben"],
  ["clamare", "rufen"],
  ["laborare", "arbeiten"],
  ["ambulare", "gehen"],
  ["narr are", "erzählen"],
  ["rogare", "fragen"],
  ["spectare", "anschauen"],
  ["portare", "tragen"],
  ["laudare", "loben"],
  ["vocare", "rufen"],
  ["monstrare", "zeigen"],
  ["cantare", "singen"],
  ["saltare", "tanzen"],
  ["pugnare", "kämpfen"],
  ["parare", "vorbereiten"],
  ["ornare", "schmücken"],
  ["mutare", "ändern"],
  ["servare", "bewahren"],
  ["iuvare", "helfen"],
  ["visitare", "besuchen"],
  ["habitare", "wohnen"],
  ["festinare", "eilen"],
  ["explicare", "erklären"],
  ["confirmare", "bestätigen"],
  ["comparare", "vergleichen"],
  ["delectare", "erfreuen"],
  ["desiderare", "wünschen"],
  ["dubitare", "zweifeln"],
  ["navigare", "segeln"],
  ["numerare", "zählen"],
  ["occupare", "besetzen"],
  ["pensare", "nachdenken"],
  ["probare", "prüfen"],
  ["reparare", "reparieren"],
  ["separare", "trennen"],
  ["studiare", "lernen"],
  ["superare", "überwinden"],
  ["temptare", "versuchen"],
  ["timare", "fürchten"],
  ["tolerare", "ertragen"],
  ["tractare", "behandeln"],
  ["admirare", "bewundern"],
  ["approbare", "gutheißen"],
  ["celebrare", "feiern"],
  ["conservare", "erhalten"],
  ["demonstr are", "darstellen"],
  ["educare", "erziehen"],
  ["err are", "irren"],
  ["expectare", "erwarten"],
  ["figurare", "gestalten"],
  ["imaginare", "vorstellen"],
  ["invitare", "einladen"],
  ["iterare", "wiederholen"],
  ["memorare", "erinnern"],
  ["observare", "beobachten"],
  ["ostentare", "zeigen"],
  ["praeparare", "vorbereiten"],
  ["pronuntiare", "aussprechen"],
  ["pulsare", "klopfen"],
  ["recitare", "vortragen"],
  ["reportare", "zurückbringen"],
  ["salutare", "grüßen"],
  ["significare", "bedeuten"],
  ["sonare", "klingen"],
  ["sp are", "hoffen"],
  ["suscitare", "wecken"],
  ["triumphare", "triumphieren"],
  ["valere", "gesund sein"],
  ["vexare", "quälen"],
  ["visitare", "besichtigen"],
  ["vitare", "vermeiden"],
  ["cantare", "musizieren"],
  ["curare", "sorgen"],
  ["decorare", "dekorieren"],
  ["donare", "schenken"],
  ["frustrare", "täuschen"],
  ["gubernare", "steuern"],
  ["habitare", "sich aufhalten"],
  ["illustr are", "erläutern"],
  ["insulare", "isolieren"],
  ["luctare", "ringen"],
  ["meditare", "nachsinnen"],
  ["negare", "verneinen"],
  ["nuntiare", "melden"],
  ["parcare", "schonen"],
  ["reclamare", "widersprechen"],
  ["resonare", "widerhallen"],
  ["segnare", "markieren"],
  ["spirare", "atmen"],
  ["terminare", "beenden"],
  ["vigilare", "wachen"]
].map(([lemma, german]) => [lemma.replace(/\s+/g, ""), german]);

function unitFor(index) {
  return `Unit ${String((index % 10) + 1)}`;
}

export const BASE_CONJUGATIONS_EN6 = [
  ...EN_IRREGULAR,
  ...EN_REGULAR.map(([lemma, german]) => ({ lemma, german, forms: conjugateEnglishPresent(lemma) }))
].map((entry, index) =>
  createConjugationEntry("conj-en6", index, {
    language: "en",
    schoolGrade: 6,
    unit: unitFor(index),
    lemma: entry.lemma,
    german: entry.german,
    tense: "present",
    forms: entry.forms
  })
);

export const BASE_CONJUGATIONS_FR6 = [
  ...FR_IRREGULAR,
  ...FR_REGULAR_ER
    .filter(([lemma]) => /er$/i.test(lemma) && !/\s/.test(lemma))
    .map(([lemma, german]) => ({ lemma, german, forms: conjugateFrenchEr(lemma) }))
].map((entry, index) =>
  createConjugationEntry("conj-fr6", index, {
    language: "fr",
    schoolGrade: 6,
    unit: unitFor(index),
    lemma: entry.lemma,
    german: entry.german,
    tense: "present",
    forms: entry.forms
  })
);

export const BASE_CONJUGATIONS_LA6 = [
  ...LA_IRREGULAR,
  ...LA_REGULAR_ARE
    .filter(([lemma]) => /are$/i.test(lemma))
    .map(([lemma, german]) => ({ lemma, german, forms: conjugateLatinAre(lemma) }))
].map((entry, index) =>
  createConjugationEntry("conj-la6", index, {
    language: "la",
    schoolGrade: 6,
    unit: unitFor(index),
    lemma: entry.lemma,
    german: entry.german,
    tense: "present",
    forms: entry.forms
  })
);

export const BASE_CONJUGATIONS = [
  ...BASE_CONJUGATIONS_EN6,
  ...BASE_CONJUGATIONS_FR6,
  ...BASE_CONJUGATIONS_LA6
];
