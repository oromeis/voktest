import test from "node:test";
import assert from "node:assert/strict";
import { isAnswerCorrect, splitVariants } from "../modules/common.js";
import { BASE_VOCABULARY_EN7 } from "../data/vocabulary-en7.js";
import { getLanguagesForGrade, normalizeVocabularyList } from "../modules/catalog-utils.js";

test("english class 7 starter vocabulary imports as clean normalized data", () => {
  const normalized = normalizeVocabularyList(BASE_VOCABULARY_EN7, {
    fallbackLanguage: "en",
    fallbackSchoolGrade: 7,
    idFallbackPrefix: "en7"
  });

  assert.equal(BASE_VOCABULARY_EN7.length, 755);
  assert.equal(normalized.length, 755);
  assert.equal(getLanguagesForGrade(normalized, 7).join(","), "en");
  assert.equal(
    normalized.every(
      (entry) =>
        entry.language === "en" &&
        entry.schoolGrade === 7 &&
        entry.foreign.length > 0 &&
        entry.german.length > 0
    ),
    true
  );
});

test("english class 7 starter vocabulary keeps corrected PDF edge cases", () => {
  const entries = normalizeVocabularyList(BASE_VOCABULARY_EN7, {
    fallbackLanguage: "en",
    fallbackSchoolGrade: 7,
    idFallbackPrefix: "en7"
  });

  const recently = entries.find((entry) => entry.foreign === "recently");
  const specialNeeds = entries.find((entry) => entry.foreign === "with special needs");
  const mixed = entries.find((entry) => entry.foreign === "mixed");
  const black = entries.find((entry) => entry.foreign === "Black/black");
  const doYouMind = entries.find((entry) => entry.foreign === "Do you mind …?");

  assert.equal(recently?.german, "kürzlich; neulich");
  assert.equal(specialNeeds?.german, "mit Behinderung; mit besonderen Bedürfnissen");
  assert.equal(
    mixed?.german,
    "Bezeichnung für Menschen mit beispielsweise einem Schwarzen und einem weißen Elternteil"
  );
  assert.equal(black?.german, "Schwarz/schwarz (soziale Kategorie)");
  assert.equal(doYouMind?.german, "Hast du was dagegen …?; Macht es dir was aus …?");
});

test("english class 7 starter vocabulary contains no known PDF extraction artefacts", () => {
  const content = BASE_VOCABULARY_EN7
    .map((entry) => `${entry.foreign}\n${entry.german}`)
    .join("\n");

  assert.equal(/uScnhdw|pkühryzsliiscchh|…\]/.test(content), false);
});

test("english class 7 starter vocabulary uses tolerant answer matching for common PDF annotations", () => {
  const entries = normalizeVocabularyList(BASE_VOCABULARY_EN7, {
    fallbackLanguage: "en",
    fallbackSchoolGrade: 7,
    idFallbackPrefix: "en7"
  });

  const autism = entries.find((entry) => entry.foreign === "autism (no pl)");
  const pic = entries.find((entry) => entry.foreign === "pic (= picture)");
  const knowItAll = entries.find((entry) => entry.foreign === "know-it-all");

  const autismVariants = splitVariants(autism?.foreign || "", { optionalVocabularyAnnotations: true });
  const picVariants = splitVariants(pic?.foreign || "", { optionalVocabularyAnnotations: true });
  const knowItAllVariants = splitVariants(knowItAll?.german || "", {
    optionalVocabularyAnnotations: true
  });

  assert.equal(isAnswerCorrect("autism", autismVariants), true);
  assert.equal(isAnswerCorrect("picture", picVariants), true);
  assert.equal(isAnswerCorrect("Besserwisserin", knowItAllVariants), true);
});
