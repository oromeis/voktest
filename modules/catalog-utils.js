export const MIN_SCHOOL_GRADE = 5;
export const MAX_SCHOOL_GRADE = 13;
export const DEFAULT_SCHOOL_GRADE = 6;
export const DEFAULT_LANGUAGE = "en";
export const DEFAULT_CONJUGATION_TENSE = "present";
export const CONJUGATION_PERSON_KEYS = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"];

export const LANGUAGE_DEFINITIONS = {
  en: {
    code: "en",
    codeLabel: "EN",
    label: "Englisch",
    nominalized: "Englische"
  },
  fr: {
    code: "fr",
    codeLabel: "FR",
    label: "Französisch",
    nominalized: "Französische"
  },
  la: {
    code: "la",
    codeLabel: "LA",
    label: "Latein",
    nominalized: "Lateinische"
  }
};

export function getSupportedLanguages() {
  return Object.keys(LANGUAGE_DEFINITIONS);
}

export function getLanguageDefinition(languageCode, fallbackCode = DEFAULT_LANGUAGE) {
  if (typeof languageCode === "string") {
    const normalized = languageCode.trim().toLowerCase();
    if (LANGUAGE_DEFINITIONS[normalized]) {
      return LANGUAGE_DEFINITIONS[normalized];
    }
  }
  return LANGUAGE_DEFINITIONS[fallbackCode] || LANGUAGE_DEFINITIONS[DEFAULT_LANGUAGE];
}

export function sanitizeLanguageCode(value, fallback = DEFAULT_LANGUAGE) {
  const fallbackDefinition = getLanguageDefinition(fallback, DEFAULT_LANGUAGE);
  if (typeof value !== "string") {
    return fallbackDefinition.code;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallbackDefinition.code;
  }
  if (!LANGUAGE_DEFINITIONS[normalized]) {
    return fallbackDefinition.code;
  }
  return normalized;
}

export function sanitizeSchoolGrade(value, fallback = DEFAULT_SCHOOL_GRADE) {
  const fallbackValue = Number.isFinite(Number(fallback))
    ? Math.round(Number(fallback))
    : DEFAULT_SCHOOL_GRADE;
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) {
    return clampGrade(fallbackValue);
  }
  return clampGrade(parsed);
}

export function createGradeOptions(min = MIN_SCHOOL_GRADE, max = MAX_SCHOOL_GRADE) {
  const start = clampGrade(Math.min(min, max));
  const end = clampGrade(Math.max(min, max));
  const values = [];
  for (let grade = start; grade <= end; grade += 1) {
    values.push(grade);
  }
  return values;
}

export function normalizeVocabularyEntry(value, options = {}) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const foreignRaw =
    typeof value.foreign === "string" ? value.foreign : typeof value.english === "string" ? value.english : "";
  const germanRaw = typeof value.german === "string" ? value.german : "";
  const foreign = foreignRaw.trim();
  const german = germanRaw.trim();

  if (!foreign || !german) {
    return null;
  }

  const fallbackLanguage = sanitizeLanguageCode(options.fallbackLanguage, DEFAULT_LANGUAGE);
  const fallbackSchoolGrade = sanitizeSchoolGrade(
    options.fallbackSchoolGrade,
    DEFAULT_SCHOOL_GRADE
  );
  const idFallbackPrefix = typeof options.idFallbackPrefix === "string" && options.idFallbackPrefix
    ? options.idFallbackPrefix
    : "entry";

  const id = typeof value.id === "string" && value.id.trim()
    ? value.id.trim().slice(0, 120)
    : `${idFallbackPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const language = sanitizeLanguageCode(value.language, fallbackLanguage);
  const schoolGrade = sanitizeSchoolGrade(value.schoolGrade, fallbackSchoolGrade);

  return {
    id,
    foreign: foreign.slice(0, 240),
    german: german.slice(0, 240),
    language,
    schoolGrade,
    unit: sanitizeText(value.unit, "", 80),
    lesson: sanitizeText(value.lesson, "", 80),
    page: sanitizePage(value.page),
    topic: sanitizeText(value.topic, "", 80),
    example: sanitizeText(value.example, "", 300)
  };
}

export function normalizeVocabularyList(list, options = {}) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((entry) => normalizeVocabularyEntry(entry, options))
    .filter(Boolean);
}

export function normalizeConjugationEntry(value, options = {}) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const lemmaRaw = typeof value.lemma === "string" ? value.lemma : "";
  const germanRaw = typeof value.german === "string" ? value.german : "";
  const lemma = lemmaRaw.trim();
  const german = germanRaw.trim();
  if (!lemma || !german) {
    return null;
  }

  const fallbackLanguage = sanitizeLanguageCode(options.fallbackLanguage, DEFAULT_LANGUAGE);
  const fallbackSchoolGrade = sanitizeSchoolGrade(
    options.fallbackSchoolGrade,
    DEFAULT_SCHOOL_GRADE
  );
  const idFallbackPrefix = typeof options.idFallbackPrefix === "string" && options.idFallbackPrefix
    ? options.idFallbackPrefix
    : "conj";

  const id = typeof value.id === "string" && value.id.trim()
    ? value.id.trim().slice(0, 120)
    : `${idFallbackPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const language = sanitizeLanguageCode(value.language, fallbackLanguage);
  const schoolGrade = sanitizeSchoolGrade(value.schoolGrade, fallbackSchoolGrade);
  const tense = sanitizeConjugationTense(value.tense, DEFAULT_CONJUGATION_TENSE);
  const unit = sanitizeText(value.unit, "", 80);

  const formsSource = value.forms && typeof value.forms === "object" ? value.forms : value;
  const forms = {};
  for (const key of CONJUGATION_PERSON_KEYS) {
    const form = sanitizeText(formsSource[key], "", 120);
    if (!form) {
      return null;
    }
    forms[key] = form;
  }

  return {
    id,
    language,
    schoolGrade,
    unit,
    lemma: lemma.slice(0, 140),
    german: german.slice(0, 240),
    tense,
    forms
  };
}

export function normalizeConjugationList(list, options = {}) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((entry) => normalizeConjugationEntry(entry, options))
    .filter(Boolean);
}

export function getLanguagesForGrade(entries, schoolGrade) {
  const grade = sanitizeSchoolGrade(schoolGrade, DEFAULT_SCHOOL_GRADE);
  const languages = new Set();
  normalizeVocabularyList(entries).forEach((entry) => {
    if (entry.schoolGrade === grade) {
      languages.add(entry.language);
    }
  });
  return [...languages].sort((left, right) => left.localeCompare(right, "de"));
}

export function getConjugationLanguagesForGrade(entries, schoolGrade) {
  const grade = sanitizeSchoolGrade(schoolGrade, DEFAULT_SCHOOL_GRADE);
  const languages = new Set();
  normalizeConjugationList(entries).forEach((entry) => {
    if (entry.schoolGrade === grade) {
      languages.add(entry.language);
    }
  });
  return [...languages].sort((left, right) => left.localeCompare(right, "de"));
}

function sanitizeText(value, fallback = "", maxLen = 100) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.slice(0, maxLen);
}

function sanitizePage(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    return trimmed.slice(0, 50);
  }
  return "";
}

function sanitizeConjugationTense(value, fallback = DEFAULT_CONJUGATION_TENSE) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (text === "present") {
    return "present";
  }
  return fallback;
}

function clampGrade(value) {
  return Math.max(MIN_SCHOOL_GRADE, Math.min(MAX_SCHOOL_GRADE, value));
}
