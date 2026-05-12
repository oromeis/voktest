import test from "node:test";
import assert from "node:assert/strict";
import { BASE_CONJUGATIONS } from "../data/conjugations.js";
import { resolveConjugationImportTense } from "../modules/import-module.js";

test("starter conjugations contain present, perfect and future for each language", () => {
  const counts = {};
  for (const entry of BASE_CONJUGATIONS) {
    counts[entry.language] ||= {};
    counts[entry.language][entry.tense] = (counts[entry.language][entry.tense] || 0) + 1;
  }

  assert.deepEqual(counts.en, { present: 109, perfect: 109, future: 109 });
  assert.deepEqual(counts.fr, { present: 104, perfect: 104, future: 104 });
  assert.deepEqual(counts.la, { present: 106, perfect: 106, future: 106 });
});

test("starter conjugations replace the old english helper-verb placeholder", () => {
  const obsolete = BASE_CONJUGATIONS.find((entry) => entry.language === "en" && entry.lemma === "to will");
  const replacement = BASE_CONJUGATIONS.find((entry) => entry.id === "conj-en6-0007");

  assert.equal(obsolete, undefined);
  assert.equal(replacement?.lemma, "to live");
  assert.equal(replacement?.german, "leben");
});

test("french perfect starter data keeps visible agreement variants for etre verbs", () => {
  const allerPerfect = BASE_CONJUGATIONS.find(
    (entry) => entry.language === "fr" && entry.lemma === "aller" && entry.tense === "perfect"
  );

  assert.equal(Boolean(allerPerfect), true);
  assert.match(allerPerfect.forms["3sg"], /est allé \/ est allée/);
  assert.match(allerPerfect.forms["3pl"], /sont allés \/ sont allées/);
});

test("conjugation import tense validation accepts supported values and rejects unknown ones", () => {
  assert.equal(resolveConjugationImportTense("present", "Zeile 1"), "present");
  assert.equal(resolveConjugationImportTense("perfect", "Zeile 2"), "perfect");
  assert.equal(resolveConjugationImportTense("", "Zeile 3"), "present");
  assert.throws(
    () => resolveConjugationImportTense("imperfect", "Zeile 4"),
    /Unbekannte Zeitform "imperfect"/
  );
});
