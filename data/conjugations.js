const PERSON_KEYS = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"];
const ENGLISH_PERFECT_HELPER = {
  "1sg": "have",
  "2sg": "have",
  "3sg": "has",
  "1pl": "have",
  "2pl": "have",
  "3pl": "have"
};
const FRENCH_AUXILIARIES = {
  avoir: {
    "1sg": "ai",
    "2sg": "as",
    "3sg": "a",
    "1pl": "avons",
    "2pl": "avez",
    "3pl": "ont"
  },
  etre: {
    "1sg": "suis",
    "2sg": "es",
    "3sg": "est",
    "1pl": "sommes",
    "2pl": "êtes",
    "3pl": "sont"
  }
};
const FRENCH_FUTURE_ENDINGS = {
  "1sg": "ai",
  "2sg": "as",
  "3sg": "a",
  "1pl": "ons",
  "2pl": "ez",
  "3pl": "ont"
};
const LATIN_PERFECT_ENDINGS = {
  "1sg": "i",
  "2sg": "isti",
  "3sg": "it",
  "1pl": "imus",
  "2pl": "istis",
  "3pl": "erunt"
};
const LATIN_FUTURE_FIRST_ENDINGS = {
  "1sg": "abo",
  "2sg": "abis",
  "3sg": "abit",
  "1pl": "abimus",
  "2pl": "abitis",
  "3pl": "abunt"
};
const LATIN_FUTURE_THIRD_ENDINGS = {
  "1sg": "am",
  "2sg": "es",
  "3sg": "et",
  "1pl": "emus",
  "2pl": "etis",
  "3pl": "ent"
};
const LATIN_FUTURE_FOURTH_ENDINGS = {
  "1sg": "iam",
  "2sg": "ies",
  "3sg": "iet",
  "1pl": "iemus",
  "2pl": "ietis",
  "3pl": "ient"
};

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
    id: tense === "present"
      ? `${prefix}-${String(index + 1).padStart(4, "0")}`
      : `${prefix}-${tense}-${String(index + 1).padStart(4, "0")}`,
    language,
    schoolGrade,
    unit,
    lemma,
    german,
    tense,
    forms: safeForms
  };
}

function createSimpleForms(values) {
  return {
    "1sg": values[0],
    "2sg": values[1],
    "3sg": values[2],
    "1pl": values[3],
    "2pl": values[4],
    "3pl": values[5]
  };
}

function mapFormsByPerson(builder) {
  const result = {};
  PERSON_KEYS.forEach((key) => {
    result[key] = builder(key);
  });
  return result;
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

function normalizeEnglishBaseVerb(lemma) {
  return String(lemma || "")
    .replace(/^to\s+/i, "")
    .trim()
    .toLowerCase();
}

function conjugateEnglishPresent(lemma) {
  const base = normalizeEnglishBaseVerb(lemma);
  return {
    "1sg": base,
    "2sg": base,
    "3sg": englishThirdPerson(base),
    "1pl": base,
    "2pl": base,
    "3pl": base
  };
}

const ENGLISH_PAST_PARTICIPLES = {
  be: "been",
  do: "done",
  go: "gone",
  say: "said",
  make: "made",
  take: "taken",
  come: "come",
  give: "given",
  know: "known",
  think: "thought",
  choose: "chosen",
  teach: "taught",
  read: "read",
  write: "written",
  speak: "spoken",
  build: "built",
  find: "found",
  lose: "lost",
  show: "shown",
  feed: "fed",
  swim: "swum",
  run: "run",
  throw: "thrown",
  catch: "caught",
  chat: "chatted"
};

function englishPastParticiple(base) {
  if (ENGLISH_PAST_PARTICIPLES[base]) {
    return ENGLISH_PAST_PARTICIPLES[base];
  }
  if (base.endsWith("e")) {
    return `${base}d`;
  }
  if (/[^aeiou]y$/i.test(base)) {
    return `${base.slice(0, -1)}ied`;
  }
  return `${base}ed`;
}

function conjugateEnglishPerfect(lemma) {
  const base = normalizeEnglishBaseVerb(lemma);
  if (base === "can") {
    return mapFormsByPerson((personKey) => `${ENGLISH_PERFECT_HELPER[personKey]} been able to`);
  }
  if (base === "must") {
    return mapFormsByPerson((personKey) => `${ENGLISH_PERFECT_HELPER[personKey]} had to`);
  }
  const participle = englishPastParticiple(base);
  return mapFormsByPerson((personKey) => `${ENGLISH_PERFECT_HELPER[personKey]} ${participle}`);
}

function conjugateEnglishFuture(lemma) {
  const base = normalizeEnglishBaseVerb(lemma);
  if (base === "can") {
    return mapFormsByPerson(() => "will be able to");
  }
  if (base === "must") {
    return mapFormsByPerson(() => "will have to");
  }
  return mapFormsByPerson(() => `will ${base}`);
}

const EN_SPECIAL_PRESENT = [
  { lemma: "to be", german: "sein", forms: createSimpleForms(["am", "are", "is", "are", "are", "are"]) },
  { lemma: "to have", german: "haben", forms: createSimpleForms(["have", "have", "has", "have", "have", "have"]) },
  { lemma: "to do", german: "machen; tun", forms: createSimpleForms(["do", "do", "does", "do", "do", "do"]) },
  { lemma: "to go", german: "gehen", forms: createSimpleForms(["go", "go", "goes", "go", "go", "go"]) },
  { lemma: "to can", german: "können", forms: createSimpleForms(["can", "can", "can", "can", "can", "can"]) },
  { lemma: "to must", german: "müssen", forms: createSimpleForms(["must", "must", "must", "must", "must", "must"]) },
  { lemma: "to live", german: "leben", forms: conjugateEnglishPresent("to live") },
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

function frenchPastParticipleEr(lemma) {
  return `${String(lemma || "").trim().toLowerCase().slice(0, -2)}é`;
}

function createFrenchAgreementForms(auxiliaryForms, participle) {
  const masculineSingular = participle;
  const feminineSingular = `${participle}e`;
  const masculinePlural = `${participle}s`;
  const femininePlural = `${participle}es`;
  return {
    "1sg": `${auxiliaryForms["1sg"]} ${masculineSingular} / ${auxiliaryForms["1sg"]} ${feminineSingular}`,
    "2sg": `${auxiliaryForms["2sg"]} ${masculineSingular} / ${auxiliaryForms["2sg"]} ${feminineSingular}`,
    "3sg": `${auxiliaryForms["3sg"]} ${masculineSingular} / ${auxiliaryForms["3sg"]} ${feminineSingular}`,
    "1pl": `${auxiliaryForms["1pl"]} ${masculinePlural} / ${auxiliaryForms["1pl"]} ${femininePlural}`,
    "2pl": `${auxiliaryForms["2pl"]} ${masculinePlural} / ${auxiliaryForms["2pl"]} ${femininePlural}`,
    "3pl": `${auxiliaryForms["3pl"]} ${masculinePlural} / ${auxiliaryForms["3pl"]} ${femininePlural}`
  };
}

const FRENCH_ETRE_VERBS = new Set(["aller", "venir", "arriver", "rester", "tomber"]);
const FRENCH_PAST_PARTICIPLES = {
  être: "été",
  avoir: "eu",
  aller: "allé",
  faire: "fait",
  pouvoir: "pu",
  vouloir: "voulu",
  devoir: "dû",
  prendre: "pris",
  venir: "venu",
  voir: "vu",
  dire: "dit",
  lire: "lu",
  écrire: "écrit",
  mettre: "mis",
  savoir: "su",
  boire: "bu"
};
const FRENCH_FUTURE_STEMS = {
  être: "ser",
  avoir: "aur",
  aller: "ir",
  faire: "fer",
  pouvoir: "pourr",
  vouloir: "voudr",
  devoir: "devr",
  prendre: "prendr",
  venir: "viendr",
  voir: "verr",
  dire: "dir",
  lire: "lir",
  écrire: "écrir",
  mettre: "mettr",
  savoir: "saur",
  boire: "boir"
};

function getFrenchPastParticiple(lemma) {
  return FRENCH_PAST_PARTICIPLES[lemma] || frenchPastParticipleEr(lemma);
}

function conjugateFrenchPerfect(lemma) {
  const participle = getFrenchPastParticiple(lemma);
  if (FRENCH_ETRE_VERBS.has(lemma)) {
    return createFrenchAgreementForms(FRENCH_AUXILIARIES.etre, participle);
  }
  return mapFormsByPerson((personKey) => `${FRENCH_AUXILIARIES.avoir[personKey]} ${participle}`);
}

function conjugateFrenchFuture(lemma) {
  const stem = FRENCH_FUTURE_STEMS[lemma] || lemma;
  return mapFormsByPerson((personKey) => `${stem}${FRENCH_FUTURE_ENDINGS[personKey]}`);
}

const FR_IRREGULAR = [
  { lemma: "être", german: "sein", forms: createSimpleForms(["suis", "es", "est", "sommes", "êtes", "sont"]) },
  { lemma: "avoir", german: "haben", forms: createSimpleForms(["ai", "as", "a", "avons", "avez", "ont"]) },
  { lemma: "aller", german: "gehen", forms: createSimpleForms(["vais", "vas", "va", "allons", "allez", "vont"]) },
  { lemma: "faire", german: "machen", forms: createSimpleForms(["fais", "fais", "fait", "faisons", "faites", "font"]) },
  { lemma: "pouvoir", german: "können", forms: createSimpleForms(["peux", "peux", "peut", "pouvons", "pouvez", "peuvent"]) },
  { lemma: "vouloir", german: "wollen", forms: createSimpleForms(["veux", "veux", "veut", "voulons", "voulez", "veulent"]) },
  { lemma: "devoir", german: "müssen", forms: createSimpleForms(["dois", "dois", "doit", "devons", "devez", "doivent"]) },
  { lemma: "prendre", german: "nehmen", forms: createSimpleForms(["prends", "prends", "prend", "prenons", "prenez", "prennent"]) },
  { lemma: "venir", german: "kommen", forms: createSimpleForms(["viens", "viens", "vient", "venons", "venez", "viennent"]) },
  { lemma: "voir", german: "sehen", forms: createSimpleForms(["vois", "vois", "voit", "voyons", "voyez", "voient"]) },
  { lemma: "dire", german: "sagen", forms: createSimpleForms(["dis", "dis", "dit", "disons", "dites", "disent"]) },
  { lemma: "lire", german: "lesen", forms: createSimpleForms(["lis", "lis", "lit", "lisons", "lisez", "lisent"]) },
  { lemma: "écrire", german: "schreiben", forms: createSimpleForms(["écris", "écris", "écrit", "écrivons", "écrivez", "écrivent"]) },
  { lemma: "mettre", german: "setzen", forms: createSimpleForms(["mets", "mets", "met", "mettons", "mettez", "mettent"]) },
  { lemma: "savoir", german: "wissen", forms: createSimpleForms(["sais", "sais", "sait", "savons", "savez", "savent"]) },
  { lemma: "boire", german: "trinken", forms: createSimpleForms(["bois", "bois", "boit", "buvons", "buvez", "boivent"]) }
];

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

function conjugateLatinRegularPerfect(lemma) {
  const stem = String(lemma || "").trim().toLowerCase().replace(/are$/i, "");
  return mapFormsByPerson((personKey) => `${stem}av${LATIN_PERFECT_ENDINGS[personKey]}`);
}

function conjugateLatinRegularFuture(lemma) {
  const stem = String(lemma || "").trim().toLowerCase().replace(/are$/i, "");
  return mapFormsByPerson((personKey) => `${stem}${LATIN_FUTURE_FIRST_ENDINGS[personKey]}`);
}

const LA_IRREGULAR = [
  {
    lemma: "esse",
    german: "sein",
    presentForms: createSimpleForms(["sum", "es", "est", "sumus", "estis", "sunt"]),
    perfectForms: createSimpleForms(["fui", "fuisti", "fuit", "fuimus", "fuistis", "fuerunt"]),
    futureForms: createSimpleForms(["ero", "eris", "erit", "erimus", "eritis", "erunt"])
  },
  {
    lemma: "posse",
    german: "können",
    presentForms: createSimpleForms(["possum", "potes", "potest", "possumus", "potestis", "possunt"]),
    perfectForms: createSimpleForms(["potui", "potuisti", "potuit", "potuimus", "potuistis", "potuerunt"]),
    futureForms: createSimpleForms(["potero", "poteris", "poterit", "poterimus", "poteritis", "poterunt"])
  },
  {
    lemma: "velle",
    german: "wollen",
    presentForms: createSimpleForms(["volo", "vis", "vult", "volumus", "vultis", "volunt"]),
    perfectForms: createSimpleForms(["volui", "voluisti", "voluit", "voluimus", "voluistis", "voluerunt"]),
    futureForms: createSimpleForms(["volam", "voles", "volet", "volemus", "voletis", "volent"])
  },
  {
    lemma: "nolle",
    german: "nicht wollen",
    presentForms: createSimpleForms(["nolo", "non vis", "non vult", "nolumus", "non vultis", "nolunt"]),
    perfectForms: createSimpleForms(["nolui", "noluisti", "noluit", "noluimus", "noluistis", "noluerunt"]),
    futureForms: createSimpleForms(["nolam", "noles", "nolet", "nolemus", "noletis", "nolent"])
  },
  {
    lemma: "ferre",
    german: "tragen",
    presentForms: createSimpleForms(["fero", "fers", "fert", "ferimus", "fertis", "ferunt"]),
    perfectForms: createSimpleForms(["tuli", "tulisti", "tulit", "tulimus", "tulistis", "tulerunt"]),
    futureForms: createSimpleForms(["feram", "feres", "feret", "feremus", "feretis", "ferent"])
  },
  {
    lemma: "ire",
    german: "gehen",
    presentForms: createSimpleForms(["eo", "is", "it", "imus", "itis", "eunt"]),
    perfectForms: createSimpleForms(["ii", "isti", "iit", "iimus", "istis", "ierunt"]),
    futureForms: createSimpleForms(["ibo", "ibis", "ibit", "ibimus", "ibitis", "ibunt"])
  },
  {
    lemma: "dare",
    german: "geben",
    presentForms: createSimpleForms(["do", "das", "dat", "damus", "datis", "dant"]),
    perfectForms: createSimpleForms(["dedi", "dedisti", "dedit", "dedimus", "dedistis", "dederunt"]),
    futureForms: createSimpleForms(["dabo", "dabis", "dabit", "dabimus", "dabitis", "dabunt"])
  },
  {
    lemma: "stare",
    german: "stehen",
    presentForms: createSimpleForms(["sto", "stas", "stat", "stamus", "statis", "stant"]),
    perfectForms: createSimpleForms(["steti", "stetisti", "stetit", "stetimus", "stetistis", "steterunt"]),
    futureForms: createSimpleForms(["stabo", "stabis", "stabit", "stabimus", "stabitis", "stabunt"])
  },
  {
    lemma: "videre",
    german: "sehen",
    presentForms: createSimpleForms(["video", "vides", "videt", "videmus", "videtis", "vident"]),
    perfectForms: createSimpleForms(["vidi", "vidisti", "vidit", "vidimus", "vidistis", "viderunt"]),
    futureForms: createSimpleForms(["videbo", "videbis", "videbit", "videbimus", "videbitis", "videbunt"])
  },
  {
    lemma: "habere",
    german: "haben",
    presentForms: createSimpleForms(["habeo", "habes", "habet", "habemus", "habetis", "habent"]),
    perfectForms: createSimpleForms(["habui", "habuisti", "habuit", "habuimus", "habuistis", "habuerunt"]),
    futureForms: createSimpleForms(["habebo", "habebis", "habebit", "habebimus", "habebitis", "habebunt"])
  },
  {
    lemma: "audire",
    german: "hören",
    presentForms: createSimpleForms(["audio", "audis", "audit", "audimus", "auditis", "audiunt"]),
    perfectForms: createSimpleForms(["audivi", "audivisti", "audivit", "audivimus", "audivistis", "audiverunt"]),
    futureForms: createSimpleForms(["audiam", "audies", "audiet", "audiemus", "audietis", "audient"])
  },
  {
    lemma: "dicere",
    german: "sagen",
    presentForms: createSimpleForms(["dico", "dicis", "dicit", "dicimus", "dicitis", "dicunt"]),
    perfectForms: createSimpleForms(["dixi", "dixisti", "dixit", "diximus", "dixistis", "dixerunt"]),
    futureForms: createSimpleForms(["dicam", "dices", "dicet", "dicemus", "dicetis", "dicent"])
  },
  {
    lemma: "ducere",
    german: "führen",
    presentForms: createSimpleForms(["duco", "ducis", "ducit", "ducimus", "ducitis", "ducunt"]),
    perfectForms: createSimpleForms(["duxi", "duxisti", "duxit", "duximus", "duxistis", "duxerunt"]),
    futureForms: createSimpleForms(["ducam", "duces", "ducet", "ducemus", "ducetis", "ducent"])
  },
  {
    lemma: "facere",
    german: "machen",
    presentForms: createSimpleForms(["facio", "facis", "facit", "facimus", "facitis", "faciunt"]),
    perfectForms: createSimpleForms(["feci", "fecisti", "fecit", "fecimus", "fecistis", "fecerunt"]),
    futureForms: createSimpleForms(["faciam", "facies", "faciet", "faciemus", "facietis", "facient"])
  },
  {
    lemma: "legere",
    german: "lesen",
    presentForms: createSimpleForms(["lego", "legis", "legit", "legimus", "legitis", "legunt"]),
    perfectForms: createSimpleForms(["legi", "legisti", "legit", "legimus", "legistis", "legerunt"]),
    futureForms: createSimpleForms(["legam", "leges", "leget", "legemus", "legetis", "legent"])
  },
  {
    lemma: "scribere",
    german: "schreiben",
    presentForms: createSimpleForms(["scribo", "scribis", "scribit", "scribimus", "scribitis", "scribunt"]),
    perfectForms: createSimpleForms(["scripsi", "scripsisti", "scripsit", "scripsimus", "scripsistis", "scripserunt"]),
    futureForms: createSimpleForms(["scribam", "scribes", "scribet", "scribemus", "scribetis", "scribent"])
  }
];

const LA_REGULAR_ARE = [
  ["amare", "lieben"],
  ["clamare", "rufen"],
  ["laborare", "arbeiten"],
  ["ambulare", "gehen"],
  ["narrare", "erzählen"],
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
  ["demonstrare", "darstellen"],
  ["educare", "erziehen"],
  ["errare", "irren"],
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
  ["spare", "hoffen"],
  ["suscitare", "wecken"],
  ["triumphare", "triumphieren"],
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
  ["illustrare", "erläutern"],
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
];

function unitFor(index) {
  return `Unit ${String((index % 10) + 1)}`;
}

function expandEntries(prefix, language, lexicon) {
  return lexicon.flatMap((entry, index) => {
    const baseMeta = {
      language,
      schoolGrade: 6,
      unit: unitFor(index),
      lemma: entry.lemma,
      german: entry.german
    };
    return [
      createConjugationEntry(prefix, index, {
        ...baseMeta,
        tense: "present",
        forms: entry.presentForms
      }),
      createConjugationEntry(prefix, index, {
        ...baseMeta,
        tense: "perfect",
        forms: entry.perfectForms
      }),
      createConjugationEntry(prefix, index, {
        ...baseMeta,
        tense: "future",
        forms: entry.futureForms
      })
    ];
  });
}

const ENGLISH_LEXICON = [
  ...EN_SPECIAL_PRESENT.map((entry) => ({
    lemma: entry.lemma,
    german: entry.german,
    presentForms: entry.forms,
    perfectForms: conjugateEnglishPerfect(entry.lemma),
    futureForms: conjugateEnglishFuture(entry.lemma)
  })),
  ...EN_REGULAR.map(([lemma, german]) => ({
    lemma,
    german,
    presentForms: conjugateEnglishPresent(lemma),
    perfectForms: conjugateEnglishPerfect(lemma),
    futureForms: conjugateEnglishFuture(lemma)
  }))
];

const FRENCH_LEXICON = [
  ...FR_IRREGULAR.map((entry) => ({
    lemma: entry.lemma,
    german: entry.german,
    presentForms: entry.forms,
    perfectForms: conjugateFrenchPerfect(entry.lemma),
    futureForms: conjugateFrenchFuture(entry.lemma)
  })),
  ...FR_REGULAR_ER
    .filter(([lemma]) => /er$/i.test(lemma) && !/\s/.test(lemma))
    .map(([lemma, german]) => ({
      lemma,
      german,
      presentForms: conjugateFrenchEr(lemma),
      perfectForms: conjugateFrenchPerfect(lemma),
      futureForms: conjugateFrenchFuture(lemma)
    }))
];

const LATIN_LEXICON = [
  ...LA_IRREGULAR.map((entry) => ({
    lemma: entry.lemma,
    german: entry.german,
    presentForms: entry.presentForms,
    perfectForms: entry.perfectForms,
    futureForms: entry.futureForms
  })),
  ...LA_REGULAR_ARE.map(([lemma, german]) => ({
    lemma,
    german,
    presentForms: conjugateLatinAre(lemma),
    perfectForms: conjugateLatinRegularPerfect(lemma),
    futureForms: conjugateLatinRegularFuture(lemma)
  }))
];

export const BASE_CONJUGATIONS_EN6 = expandEntries("conj-en6", "en", ENGLISH_LEXICON);
export const BASE_CONJUGATIONS_FR6 = expandEntries("conj-fr6", "fr", FRENCH_LEXICON);
export const BASE_CONJUGATIONS_LA6 = expandEntries("conj-la6", "la", LATIN_LEXICON);

export const BASE_CONJUGATIONS = [
  ...BASE_CONJUGATIONS_EN6,
  ...BASE_CONJUGATIONS_FR6,
  ...BASE_CONJUGATIONS_LA6
];
