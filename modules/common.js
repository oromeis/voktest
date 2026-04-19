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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\säöüß]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitVariants(answerDisplay) {
  const variants = String(answerDisplay)
    .split(/[;,/]|\bor\b/gi)
    .map((part) => part.trim())
    .filter(Boolean);

  const normalizedWholeAnswer = normalize(answerDisplay);
  const allowToPrefix = normalizedWholeAnswer.includes("to ");

  const expanded = new Set();
  variants.forEach((variant) => {
    const normalized = normalize(variant);
    if (!normalized) {
      return;
    }
    expanded.add(normalized);
    if (normalized.startsWith("to ")) {
      expanded.add(normalized.slice(3));
    } else if (allowToPrefix) {
      expanded.add(`to ${normalized}`);
    }
  });

  return [...expanded];
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
