import test from "node:test";
import assert from "node:assert/strict";
import {
  CONJUGATION_PERSON_KEYS,
  DEFAULT_LANGUAGE,
  DEFAULT_SCHOOL_GRADE,
  getConjugationLanguagesForGrade,
  getLanguageDefinition,
  getLanguagesForGrade,
  normalizeConjugationEntry,
  normalizeVocabularyEntry,
  sanitizeLanguageCode,
  sanitizeSchoolGrade
} from "../modules/catalog-utils.js";

test("normalizeVocabularyEntry maps legacy english/german to canonical shape", () => {
  const normalized = normalizeVocabularyEntry({
    id: "a1",
    english: "cat",
    german: "Katze",
    unit: "Unit 1"
  });

  assert.equal(normalized.id, "a1");
  assert.equal(normalized.foreign, "cat");
  assert.equal(normalized.german, "Katze");
  assert.equal(normalized.language, DEFAULT_LANGUAGE);
  assert.equal(normalized.schoolGrade, DEFAULT_SCHOOL_GRADE);
  assert.equal(normalized.unit, "Unit 1");
});

test("sanitizeSchoolGrade clamps to 5-13 range", () => {
  assert.equal(sanitizeSchoolGrade(1, 6), 5);
  assert.equal(sanitizeSchoolGrade(20, 6), 13);
  assert.equal(sanitizeSchoolGrade("7", 6), 7);
  assert.equal(sanitizeSchoolGrade("x", 6), 6);
});

test("sanitizeLanguageCode only accepts known languages", () => {
  assert.equal(sanitizeLanguageCode("en", "fr"), "en");
  assert.equal(sanitizeLanguageCode("fr", "en"), "fr");
  assert.equal(sanitizeLanguageCode("la", "en"), "la");
  assert.equal(sanitizeLanguageCode("es", "fr"), "fr");
  assert.equal(sanitizeLanguageCode("", "en"), "en");
});

test("getLanguageDefinition returns labels for latin", () => {
  const language = getLanguageDefinition("la");
  assert.equal(language.code, "la");
  assert.equal(language.codeLabel, "LA");
  assert.equal(language.label, "Latein");
});

test("getLanguagesForGrade returns unique language codes for given grade", () => {
  const entries = [
    { foreign: "cat", german: "Katze", language: "en", schoolGrade: 6 },
    { foreign: "dog", german: "Hund", language: "en", schoolGrade: 6 },
    { foreign: "bonjour", german: "hallo", language: "fr", schoolGrade: 6 },
    { foreign: "amo", german: "ich liebe", language: "la", schoolGrade: 6 },
    { foreign: "merci", german: "danke", language: "fr", schoolGrade: 7 }
  ];

  assert.deepEqual(getLanguagesForGrade(entries, 6), ["en", "fr", "la"]);
  assert.deepEqual(getLanguagesForGrade(entries, 7), ["fr"]);
  assert.deepEqual(getLanguagesForGrade(entries, 8), []);
});

test("normalizeConjugationEntry validates canonical forms with 6 persons", () => {
  const entry = normalizeConjugationEntry({
    id: "cj-1",
    language: "fr",
    schoolGrade: 6,
    unit: "Unit 1",
    lemma: "parler",
    german: "sprechen",
    tense: "present",
    forms: {
      "1sg": "parle",
      "2sg": "parles",
      "3sg": "parle",
      "1pl": "parlons",
      "2pl": "parlez",
      "3pl": "parlent"
    }
  });

  assert.equal(Boolean(entry), true);
  assert.equal(entry.language, "fr");
  assert.equal(entry.schoolGrade, 6);
  assert.equal(entry.tense, "present");
  assert.deepEqual(Object.keys(entry.forms), CONJUGATION_PERSON_KEYS);
});

test("normalizeConjugationEntry rejects missing person forms", () => {
  const entry = normalizeConjugationEntry({
    lemma: "amare",
    german: "lieben",
    forms: {
      "1sg": "amo",
      "2sg": "amas"
    }
  });
  assert.equal(entry, null);
});

test("getConjugationLanguagesForGrade returns languages by class", () => {
  const entries = [
    {
      lemma: "to play",
      german: "spielen",
      language: "en",
      schoolGrade: 6,
      forms: { "1sg": "play", "2sg": "play", "3sg": "plays", "1pl": "play", "2pl": "play", "3pl": "play" }
    },
    {
      lemma: "parler",
      german: "sprechen",
      language: "fr",
      schoolGrade: 6,
      forms: { "1sg": "parle", "2sg": "parles", "3sg": "parle", "1pl": "parlons", "2pl": "parlez", "3pl": "parlent" }
    },
    {
      lemma: "amare",
      german: "lieben",
      language: "la",
      schoolGrade: 7,
      forms: { "1sg": "amo", "2sg": "amas", "3sg": "amat", "1pl": "amamus", "2pl": "amatis", "3pl": "amant" }
    }
  ];

  assert.deepEqual(getConjugationLanguagesForGrade(entries, 6), ["en", "fr"]);
  assert.deepEqual(getConjugationLanguagesForGrade(entries, 7), ["la"]);
});
