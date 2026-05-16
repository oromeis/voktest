import test from "node:test";
import assert from "node:assert/strict";
import { isAnswerCorrect, splitVariants } from "../modules/common.js";
import { BASE_VOCABULARY_FR7 } from "../data/vocabulary-fr7.js";
import { getLanguagesForGrade, normalizeVocabularyList } from "../modules/catalog-utils.js";

test("french class 7 starter vocabulary imports as clean normalized data", () => {
  const normalized = normalizeVocabularyList(BASE_VOCABULARY_FR7, {
    fallbackLanguage: "fr",
    fallbackSchoolGrade: 7,
    idFallbackPrefix: "fr7"
  });

  assert.equal(BASE_VOCABULARY_FR7.length, 636);
  assert.equal(normalized.length, 636);
  assert.equal(getLanguagesForGrade(normalized, 7).join(","), "fr");
  assert.equal(
    normalized.every(
      (entry) =>
        entry.language === "fr" &&
        entry.schoolGrade === 7 &&
        entry.foreign.length > 0 &&
        entry.german.length > 0
    ),
    true
  );
});

test("french class 7 starter vocabulary keeps corrected PDF edge cases", () => {
  const entries = normalizeVocabularyList(BASE_VOCABULARY_FR7, {
    fallbackLanguage: "fr",
    fallbackSchoolGrade: 7,
    idFallbackPrefix: "fr7"
  });

  const carnet = entries.find((entry) => entry.foreign === "un carnet de correspondance");
  const numerique = entries.find((entry) => entry.foreign === "numérique/numérique");
  const vandalisme = entries.find((entry) => entry.foreign === "le vandalisme");
  const viaFerrata = entries.find((entry) => entry.foreign === "une via ferrata");
  const enRoute = entries.find((entry) => entry.foreign === "en route pour ...");
  const smartphone = entries.find((entry) => entry.foreign === "un smartphone");
  const science = entries.find((entry) => entry.foreign === "la science");

  assert.equal(
    carnet?.german,
    "ein Notizbuch zum Austausch von Informationen zwischen Eltern und Lehrern"
  );
  assert.equal(numerique?.german, "digital");
  assert.equal(vandalisme?.german, "der Vandalismus; die Zerstörungswut");
  assert.equal(
    viaFerrata?.german,
    "ein Klettersteig (mit Stahlseilen gesicherter Kletterweg in den Bergen)"
  );
  assert.equal(enRoute?.german, "auf dem Weg nach ...; auf nach ...");
  assert.equal(smartphone?.german, "ein Smartphone");
  assert.equal(science?.german, "die Wissenschaft");
});

test("french class 7 starter vocabulary contains no known PDF extraction artefacts", () => {
  const content = BASE_VOCABULARY_FR7
    .map((entry) => `${entry.foreign}\n${entry.german}`)
    .join("\n");

  assert.equal(/Ldeighirtealrn|Bauefr|Zer stö rungs/.test(content), false);
});

test("french class 7 starter vocabulary uses tolerant answer matching for common annotations", () => {
  const entries = normalizeVocabularyList(BASE_VOCABULARY_FR7, {
    fallbackLanguage: "fr",
    fallbackSchoolGrade: 7,
    idFallbackPrefix: "fr7"
  });

  const nouveau = entries.find((entry) => entry.foreign === "nouveau(nouvel)/nouvelle");
  const relative = entries.find((entry) => entry.foreign === "que/qu’");
  const lunettes = entries.find((entry) => entry.foreign === "des lunettes (f.) (pl.)");

  const nouveauVariants = splitVariants(nouveau?.foreign || "", { optionalVocabularyAnnotations: true });
  const relativeVariants = splitVariants(relative?.foreign || "", { optionalVocabularyAnnotations: true });
  const lunettesVariants = splitVariants(lunettes?.foreign || "", {
    optionalVocabularyAnnotations: true
  });

  assert.equal(isAnswerCorrect("nouveau", nouveauVariants), true);
  assert.equal(isAnswerCorrect("nouvel", nouveauVariants), true);
  assert.equal(isAnswerCorrect("nouvelle", nouveauVariants), true);
  assert.equal(isAnswerCorrect("que", relativeVariants), true);
  assert.equal(isAnswerCorrect("qu'", relativeVariants), true);
  assert.equal(isAnswerCorrect("des lunettes", lunettesVariants), true);
});
