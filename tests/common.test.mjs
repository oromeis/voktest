import test from "node:test";
import assert from "node:assert/strict";
import { isAnswerCorrect, splitDisplayVariants, splitVariants } from "../modules/common.js";

test("splitVariants can add article-free German variants when enabled", () => {
  const variants = splitVariants("der Hund", { optionalGermanArticles: true });

  assert.ok(variants.includes("der hund"));
  assert.ok(variants.includes("hund"));
});

test("splitVariants keeps German articles strict when option is disabled", () => {
  const variants = splitVariants("der Hund");

  assert.ok(variants.includes("der hund"));
  assert.equal(variants.includes("hund"), false);
});

test("FR->DE free text accepts answer without German article", () => {
  const variants = splitVariants("eine Freundin", { optionalGermanArticles: true });

  assert.equal(isAnswerCorrect("Freundin", variants), true);
  assert.equal(isAnswerCorrect("eine Freundin", variants), true);
});

test("DE->FR remains strict and still requires French article", () => {
  const variants = splitVariants("un chien", { optionalGermanArticles: true });

  assert.equal(isAnswerCorrect("un chien", variants), true);
  assert.equal(isAnswerCorrect("chien", variants), false);
});

test("German umlaut variants accept ae/oe/ue input equivalents", () => {
  const variants = splitVariants("für", { optionalGermanUmlautVariants: true });

  assert.equal(isAnswerCorrect("für", variants), true);
  assert.equal(isAnswerCorrect("fur", variants), true);
  assert.equal(isAnswerCorrect("fuer", variants), true);
});

test("German sharp s variants accept ss", () => {
  const variants = splitVariants("groß", { optionalGermanUmlautVariants: true });

  assert.equal(isAnswerCorrect("groß", variants), true);
  assert.equal(isAnswerCorrect("gross", variants), true);
});

test("DE->LA accepts i/j and u/v spelling variants in latin mode", () => {
  const variants = splitVariants("Iulius iuvenis", { optionalLatinOrthography: true });

  assert.equal(isAnswerCorrect("Julius juvenis", variants), true);
});

test("Latin ligatures are normalized to ae/oe variants", () => {
  const variants = splitVariants("foedus", { optionalLatinOrthography: true });

  assert.equal(isAnswerCorrect("fœdus", variants), true);
});

test("Latin mode remains strict for grammatical endings", () => {
  const variants = splitVariants("amicus", { optionalLatinOrthography: true });

  assert.equal(isAnswerCorrect("amici", variants), false);
});

test("splitDisplayVariants keeps umlauts and original casing for UI labels", () => {
  const variants = splitDisplayVariants("Möbel; Äpfel / Öl");

  assert.deepEqual(variants, ["Möbel", "Äpfel", "Öl"]);
});
