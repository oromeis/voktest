export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\säöüß]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitVariants(answerDisplay, options = {}) {
  const variants = splitDisplayVariants(answerDisplay);

  const normalizedWholeAnswer = normalize(answerDisplay);
  const allowToPrefix = normalizedWholeAnswer.includes("to ");

  const expanded = new Set();
  variants.forEach((variant) => {
    const normalized = normalize(variant);
    if (!normalized) {
      return;
    }
    expanded.add(normalized);
    if (options.optionalGermanUmlautVariants) {
      const transliterated = normalize(transliterateGermanUmlauts(variant));
      if (transliterated) {
        expanded.add(transliterated);
        expanded.add(foldGermanUmlautDigraphs(transliterated));
      }
      expanded.add(foldGermanUmlautDigraphs(normalized));
    }
    if (normalized.startsWith("to ")) {
      expanded.add(normalized.slice(3));
    } else if (allowToPrefix) {
      expanded.add(`to ${normalized}`);
    }
  });

  if (options.optionalGermanArticles) {
    const withOptionalArticles = [...expanded];
    withOptionalArticles.forEach((variant) => {
      const withoutArticle = stripLeadingGermanArticle(variant);
      if (withoutArticle && withoutArticle !== variant) {
        expanded.add(withoutArticle);
      }
    });
  }

  if (options.optionalLatinOrthography) {
    const latinVariants = [...expanded];
    latinVariants.forEach((variant) => {
      expandLatinOrthographyVariants(variant).forEach((candidate) => {
        const normalizedCandidate = normalize(candidate);
        if (normalizedCandidate) {
          expanded.add(normalizedCandidate);
        }
      });
    });
  }

  return [...expanded];
}

export function splitDisplayVariants(answerDisplay) {
  return String(answerDisplay)
    .split(/[;,/]|\bor\b/gi)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function isAnswerCorrect(answer, validVariants) {
  const normalizedInput = normalize(answer);
  if (!normalizedInput) {
    return false;
  }

  if (validVariants.includes(normalizedInput)) {
    return true;
  }

  return validVariants.some((variant) => isNearMatch(normalizedInput, variant));
}

export function labelMode(mode) {
  if (mode === "learn") {
    return "Lernen";
  }
  if (mode === "quiz") {
    return "Quiz";
  }
  if (mode === "conjugation") {
    return "Konjugation";
  }
  return "Test";
}

export function gradeFromPercent(percent) {
  if (percent >= 92) {
    return 1;
  }
  if (percent >= 81) {
    return 2;
  }
  if (percent >= 67) {
    return 3;
  }
  if (percent >= 50) {
    return 4;
  }
  if (percent >= 30) {
    return 5;
  }
  return 6;
}

export function gradeLabel(grade) {
  const labels = {
    1: "sehr gut",
    2: "gut",
    3: "befriedigend",
    4: "ausreichend",
    5: "mangelhaft",
    6: "ungenügend"
  };
  return labels[grade] || "";
}

function isNearMatch(a, b) {
  if (!a || !b) {
    return false;
  }
  if (Math.abs(a.length - b.length) > 1) {
    return false;
  }
  if (a.length < 5 || b.length < 5) {
    return false;
  }
  return levenshtein(a, b) <= 1;
}

function stripLeadingGermanArticle(value) {
  const parts = String(value)
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return value;
  }

  const leading = parts[0];
  if (!GERMAN_LEADING_ARTICLES.has(leading)) {
    return value;
  }
  return parts.slice(1).join(" ");
}

const GERMAN_LEADING_ARTICLES = new Set([
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einen",
  "einem",
  "einer",
  "eines",
  "kein",
  "keine",
  "keinen",
  "keinem",
  "keiner",
  "keines"
]);

function expandLatinOrthographyVariants(value) {
  const seed = String(value || "").trim();
  if (!seed) {
    return [];
  }

  const swapMap = {
    u: "v",
    v: "u",
    i: "j",
    j: "i"
  };

  const swapIndices = [];
  for (let index = 0; index < seed.length; index += 1) {
    if (swapMap[seed[index]]) {
      swapIndices.push(index);
    }
  }

  if (!swapIndices.length) {
    return [seed];
  }

  const maxPositions = Math.min(10, swapIndices.length);
  const maxVariants = 128;
  const seen = new Set([seed]);

  const totalMasks = 2 ** maxPositions;
  for (let mask = 1; mask < totalMasks && seen.size < maxVariants; mask += 1) {
    const chars = seed.split("");
    for (let bit = 0; bit < maxPositions; bit += 1) {
      if ((mask & (1 << bit)) === 0) {
        continue;
      }
      const swapIndex = swapIndices[bit];
      chars[swapIndex] = swapMap[chars[swapIndex]] || chars[swapIndex];
    }
    seen.add(chars.join(""));
  }

  return [...seen];
}

function transliterateGermanUmlauts(value) {
  return String(value)
    .replace(/[Ää]/g, "ae")
    .replace(/[Öö]/g, "oe")
    .replace(/[Üü]/g, "ue")
    .replace(/ß/g, "ss");
}

function foldGermanUmlautDigraphs(value) {
  return String(value)
    .replace(/ae/g, "a")
    .replace(/oe/g, "o")
    .replace(/(^|[^aeiouyq])ue/g, "$1u");
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, () => []);

  for (let i = 0; i <= b.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
