import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_SCHOOL_GRADE,
  getLanguagesForGrade,
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
  assert.equal(sanitizeLanguageCode("es", "fr"), "fr");
  assert.equal(sanitizeLanguageCode("", "en"), "en");
});

test("getLanguagesForGrade returns unique language codes for given grade", () => {
  const entries = [
    { foreign: "cat", german: "Katze", language: "en", schoolGrade: 6 },
    { foreign: "dog", german: "Hund", language: "en", schoolGrade: 6 },
    { foreign: "bonjour", german: "hallo", language: "fr", schoolGrade: 6 },
    { foreign: "merci", german: "danke", language: "fr", schoolGrade: 7 }
  ];

  assert.deepEqual(getLanguagesForGrade(entries, 6), ["en", "fr"]);
  assert.deepEqual(getLanguagesForGrade(entries, 7), ["fr"]);
  assert.deepEqual(getLanguagesForGrade(entries, 8), []);
});
