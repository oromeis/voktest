import { normalize } from "./common.js";

const OCR_MIN_GOOD_CANDIDATES = 4;
const MAX_OCR_IMAGE_EDGE = 2200;

export function createImportModule({
  state,
  elements,
  persistCustomVocabulary,
  onVocabularyChanged
}) {
  let tesseractLoadPromise = null;
  let ocrBusy = false;

  function bind() {
    elements.importBtn.addEventListener("click", handleImport);
    elements.resetBtn.addEventListener("click", resetCustomVocabulary);
    elements.ocrBtn.addEventListener("click", handleOcrScan);
  }

  async function handleOcrScan() {
    if (ocrBusy) {
      return;
    }

    const file = elements.ocrFileInput.files?.[0];
    if (!file) {
      setOcrFeedback("Bitte zuerst ein Foto auswählen oder mit der Kamera aufnehmen.", false);
      return;
    }

    ocrBusy = true;
    elements.ocrBtn.disabled = true;
    setOcrFeedback("OCR wird vorbereitet...", true);

    try {
      const tesseract = await ensureTesseractLoaded();
      const bestResult = await runBestEffortOcr(file, tesseract);

      const rawText = bestResult.rawText;
      elements.ocrRawText.value = rawText;

      if (!rawText) {
        setOcrFeedback("Im Bild wurde kein lesbarer Text erkannt.", false);
        return;
      }

      const candidates = bestResult.candidates;
      if (candidates.length === 0) {
        setOcrFeedback(
          "Text erkannt, aber keine klaren Vokabelzeilen gefunden. Tipp: Text aus Foto (Live Text) kopieren und als CSV einfügen.",
          false
        );
        return;
      }

      const detectedPage = detectPageFromText(rawText);
      const fallbackUnit = state.settings.unit === "all" ? "OCR Unit" : state.settings.unit;
      const fallbackLesson =
        state.settings.lesson === "all" ? "OCR Lektion" : state.settings.lesson;

      const lines = candidates.map((entry) =>
        toCsvLineFromCandidate(entry, fallbackUnit, fallbackLesson, detectedPage)
      );

      const existing = elements.importTextarea.value.trim();
      elements.importTextarea.value = existing
        ? `${existing}\n${lines.join("\n")}`
        : lines.join("\n");

      const scanLabel = bestResult.attempts > 1 ? ` (${bestResult.label})` : "";
      setOcrFeedback(`${candidates.length} Vokabeln erkannt${scanLabel}.`, true);
      setImportFeedback("Bitte kurz prüfen und dann auf „Importieren“ klicken.", true);
    } catch (error) {
      setOcrFeedback(`OCR-Fehler: ${error.message}`, false);
    } finally {
      ocrBusy = false;
      elements.ocrBtn.disabled = false;
    }
  }

  async function runBestEffortOcr(file, tesseract) {
    const attempts = [];
    const originalAttempt = await runSingleOcrAttempt({
      tesseract,
      input: file,
      label: "Originalfoto"
    });
    attempts.push(originalAttempt);

    let best = originalAttempt;
    if (best.candidates.length >= OCR_MIN_GOOD_CANDIDATES) {
      return { ...best, attempts: attempts.length };
    }

    setOcrFeedback("OCR-Hinweis: Zusätzliche Bildaufbereitung wird versucht...", true);
    const preparedVariants = await buildPreparedOcrVariants(file);
    for (const variant of preparedVariants) {
      const attempt = await runSingleOcrAttempt({
        tesseract,
        input: variant.input,
        label: variant.label
      });
      attempts.push(attempt);

      if (isBetterOcrResult(attempt, best)) {
        best = attempt;
      }
      if (best.candidates.length >= OCR_MIN_GOOD_CANDIDATES) {
        break;
      }
    }

    return { ...best, attempts: attempts.length };
  }

  async function runSingleOcrAttempt({ tesseract, input, label }) {
    setOcrFeedback(`OCR läuft (${label})...`, true);
    const result = await tesseract.recognize(input, "eng+deu", {
      logger: (message) => {
        if (message.status !== "recognizing text") {
          return;
        }
        const progress = Math.max(0, Math.min(100, Math.round((message.progress || 0) * 100)));
        setOcrFeedback(`OCR läuft (${label}): ${progress}%`, true);
      }
    });

    const rawText = String(result?.data?.text || "").trim();
    const candidates = rawText ? extractVocabularyCandidatesFromOcr(rawText) : [];
    return { rawText, candidates, label };
  }

  function isBetterOcrResult(candidate, currentBest) {
    const candidateScore = getOcrResultScore(candidate);
    const currentScore = getOcrResultScore(currentBest);
    return candidateScore > currentScore;
  }

  function getOcrResultScore(result) {
    if (!result || !result.rawText) {
      return -1;
    }
    const candidateCount = result.candidates.length;
    const textBonus = Math.min(90, Math.round(result.rawText.length / 70));
    return candidateCount * 120 + textBonus;
  }

  async function buildPreparedOcrVariants(file) {
    try {
      const image = await loadImageElement(file);
      return [
        {
          label: "Kontrast",
          input: await buildEnhancedImageBlob(image, 0)
        },
        {
          label: "Kontrast + Drehung rechts",
          input: await buildEnhancedImageBlob(image, 90)
        },
        {
          label: "Kontrast + Drehung links",
          input: await buildEnhancedImageBlob(image, -90)
        }
      ];
    } catch {
      return [];
    }
  }

  function loadImageElement(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Bild konnte nicht geladen werden."));
      };
      image.src = url;
    });
  }

  async function buildEnhancedImageBlob(image, rotation) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const scale = Math.min(1, MAX_OCR_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
    const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
    const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    const swapSides = Math.abs(rotation) % 180 === 90;

    const canvas = document.createElement("canvas");
    canvas.width = swapSides ? drawHeight : drawWidth;
    canvas.height = swapSides ? drawWidth : drawHeight;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("Canvas nicht verfügbar.");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    for (let index = 0; index < pixels.length; index += 4) {
      const luminance = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
      const contrasted = (luminance - 128) * 1.45 + 128;
      const clipped = Math.max(0, Math.min(255, contrasted));
      const boosted = clipped > 165 ? 255 : clipped < 65 ? 0 : clipped;
      pixels[index] = boosted;
      pixels[index + 1] = boosted;
      pixels[index + 2] = boosted;
    }
    ctx.putImageData(imageData, 0, 0);

    return canvasToBlob(canvas);
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Bildaufbereitung fehlgeschlagen."));
            return;
          }
          resolve(blob);
        },
        "image/png",
        0.95
      );
    });
  }

  function handleImport() {
    const raw = elements.importTextarea.value.trim();
    if (!raw) {
      setImportFeedback("Bitte zuerst Daten einfügen.", false);
      return;
    }

    try {
      const parsed = raw.startsWith("[") ? parseJson(raw) : parseCsv(raw);
      if (parsed.length === 0) {
        setImportFeedback("Keine gültigen Datensätze erkannt.", false);
        return;
      }

      state.customVocabulary = [...state.customVocabulary, ...parsed];
      persistCustomVocabulary();
      elements.importTextarea.value = "";
      onVocabularyChanged();
      setImportFeedback(`${parsed.length} Vokabeln importiert.`, true);
    } catch (error) {
      setImportFeedback(`Importfehler: ${error.message}`, false);
    }
  }

  function resetCustomVocabulary() {
    state.customVocabulary = [];
    persistCustomVocabulary();
    onVocabularyChanged();
    setImportFeedback("Eigene Importe wurden entfernt. Buchdaten bleiben erhalten.", true);
  }

  function parseJson(raw) {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      throw new Error("JSON muss ein Array sein.");
    }

    const stamp = Date.now();
    return data
      .map((item, index) => toEntry(item, `json-${stamp}-${index}`))
      .filter(Boolean);
  }

  function parseCsv(raw) {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const stamp = Date.now();
    return lines
      .map((line, index) => {
        const [english, german, unit, lesson, page, topic] = line
          .split(";")
          .map((part) => part.trim());

        return toEntry(
          {
            english,
            german,
            unit,
            lesson,
            page,
            topic
          },
          `csv-${stamp}-${index}`
        );
      })
      .filter(Boolean);
  }

  function toEntry(item, id) {
    if (!item || !item.english || !item.german) {
      return null;
    }

    return {
      id,
      english: String(item.english).trim(),
      german: String(item.german).trim(),
      unit: String(item.unit || "Eigene Unit").trim(),
      lesson: String(item.lesson || "Eigene Lektion").trim(),
      page: Number(item.page || 0),
      topic: String(item.topic || "Import")
    };
  }

  function setImportFeedback(text, ok) {
    elements.importFeedback.textContent = text;
    elements.importFeedback.className = `feedback ${ok ? "ok" : "err"}`;
  }

  function setOcrFeedback(text, ok) {
    elements.ocrFeedback.textContent = text;
    elements.ocrFeedback.className = `feedback ${ok ? "ok" : "err"}`;
  }

  function ensureTesseractLoaded() {
    if (window.Tesseract && typeof window.Tesseract.recognize === "function") {
      return Promise.resolve(window.Tesseract);
    }

    if (!tesseractLoadPromise) {
      tesseractLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
        script.async = true;
        script.onload = () => {
          if (window.Tesseract && typeof window.Tesseract.recognize === "function") {
            resolve(window.Tesseract);
            return;
          }
          reject(new Error("OCR-Bibliothek geladen, aber nicht initialisiert."));
        };
        script.onerror = () => {
          reject(new Error("OCR-Bibliothek konnte nicht geladen werden (Netzwerk prüfen)."));
        };
        document.head.append(script);
      }).catch((error) => {
        tesseractLoadPromise = null;
        throw error;
      });
    }

    return tesseractLoadPromise;
  }

  function extractVocabularyCandidatesFromOcr(rawText) {
    const sourceLines = String(rawText)
      .replace(/\t/g, " ")
      .replace(/\u00a0/g, " ")
      .split(/\r?\n/)
      .map(sanitizeOcrLine)
      .filter((line) => line.length >= 3);

    const candidates = [];
    const seen = new Set();

    const pushCandidate = (entry) => {
      if (!entry) {
        return;
      }

      const english = normalizeOcrEnglish(entry.english);
      const german = normalizeOcrGerman(entry.german);
      if (!english || !german) {
        return;
      }
      if (!isLikelyEnglishWordGroup(english) || !isLikelyGermanTranslation(german)) {
        return;
      }

      const dedupeKey = `${normalize(english)}|${normalize(german)}`;
      if (seen.has(dedupeKey)) {
        return;
      }
      seen.add(dedupeKey);
      candidates.push({ english, german });
    };

    sourceLines.forEach((line) => {
      if (isIgnoredOcrLine(line)) {
        return;
      }

      const directCandidate = parseCandidateFromLine(line);
      if (directCandidate) {
        pushCandidate(directCandidate);
      }
    });

    for (let index = 0; index < sourceLines.length - 1; index += 1) {
      const first = stripLineIndex(sourceLines[index]);
      const second = stripLineIndex(sourceLines[index + 1]);

      if (isIgnoredOcrLine(first) || isIgnoredOcrLine(second)) {
        continue;
      }
      if (!looksLikeEnglishOnly(first) || !looksLikeGermanOnly(second)) {
        continue;
      }
      pushCandidate({ english: first, german: second });
    }

    return candidates;
  }

  function sanitizeOcrLine(line) {
    return String(line)
      .replace(/[|]/g, " ")
      .replace(/[“”]/g, "\"")
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stripLineIndex(line) {
    return String(line || "")
      .replace(/^\d{1,3}\s+/, "")
      .replace(/^[•*]\s*/, "")
      .trim();
  }

  function parseCandidateFromLine(line) {
    const source = stripLineIndex(line);
    if (!source || source.length < 4 || source.length > 180) {
      return null;
    }

    const csvParts = source
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);
    if (csvParts.length >= 2) {
      return { english: csvParts[0], german: csvParts[1] };
    }

    const separators = [" - ", " – ", " — ", " -> ", " => ", " : "];
    for (const separator of separators) {
      const separatorIndex = source.indexOf(separator);
      if (separatorIndex <= 1) {
        continue;
      }

      const english = source.slice(0, separatorIndex).trim();
      const german = source.slice(separatorIndex + separator.length).trim();
      if (english && german) {
        return { english, german };
      }
    }

    const noPhonetic = source.replace(/\[[^\]]{1,40}\]/g, " ").replace(/\s+/g, " ").trim();
    const fallbackMatch = noPhonetic.match(
      /^((?:to\s+)?[a-z][a-z'()\-]*(?:\s+[a-z][a-z'()\-]*){0,4})\s+(.+)$/i
    );
    if (fallbackMatch) {
      return {
        english: fallbackMatch[1],
        german: fallbackMatch[2]
      };
    }

    return null;
  }

  function isIgnoredOcrLine(line) {
    const value = String(line || "").trim();
    if (!value) {
      return true;
    }

    return (
      /^(vocabulary|unit|isbn|page)\b/i.test(value) ||
      /^(english|german|deutsch)\b/i.test(value) ||
      /^[0-9]{1,3}$/.test(value) ||
      /^lesson\b/i.test(value)
    );
  }

  function looksLikeEnglishOnly(text) {
    const english = normalizeOcrEnglish(text);
    return isLikelyEnglishWordGroup(english);
  }

  function looksLikeGermanOnly(text) {
    const german = normalizeOcrGerman(text);
    return isLikelyGermanTranslation(german);
  }

  function isLikelyEnglishWordGroup(text) {
    const value = String(text || "").trim();
    if (!value || value.length < 2 || value.length > 52) {
      return false;
    }
    if (/[äöüß]/i.test(value)) {
      return false;
    }
    if (!/^[a-z0-9'()\- ]+$/i.test(value)) {
      return false;
    }

    const words = value.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 5) {
      return false;
    }
    if (words.some((word) => word.length > 20)) {
      return false;
    }

    return true;
  }

  function isLikelyGermanTranslation(text) {
    const value = String(text || "").trim();
    if (!value || value.length < 2 || value.length > 100) {
      return false;
    }

    const words = value.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 10) {
      return false;
    }

    const englishSentenceHint =
      /\b(the|and|you|your|our|their|it|is|are|was|were|for|with|from|this|that)\b/i;
    const germanSignalHint =
      /[äöüß]|\b(der|die|das|ein|eine|und|mit|für|bei|im|am|zum|zur|ohne|gesundheit|kontrolle|note|druck)\b/i;

    if (words.length >= 6 && englishSentenceHint.test(value) && !germanSignalHint.test(value)) {
      return false;
    }
    return true;
  }

  function normalizeOcrEnglish(text) {
    return String(text)
      .replace(/^[^a-z]+/i, "")
      .replace(/\[[^\]]+\]/g, " ")
      .replace(/[^a-zA-Z'()\- ]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function normalizeOcrGerman(text) {
    let cleaned = String(text)
      .replace(/[|]/g, " ")
      .replace(/\[[^\]]+\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    cleaned = cleaned.split(/[.!?]/)[0];
    cleaned = cleaned.replace(/\s+-\s+.*/, "");

    if (cleaned.split(/\s+/).length > 6) {
      cleaned = cleaned.replace(
        /^(Ruby|Can|In|After|It's|It’s|You|What|Click|I'm|I’m|Everybody|Yesterday|Don't|Don’t|Which|For|The|A|An|She|He|We|They|It|Do|Does|Did)\b.*/i,
        ""
      );
      cleaned = cleaned.replace(
        /\s(?:Ruby|Can|In|After|It's|It’s|You|What|Click|I'm|I’m|Everybody|Yesterday|Don't|Don’t|Which|For|The|A|An|She|He|We|They|It|Do|Does|Did)\b.*/i,
        ""
      );
    }

    return cleaned
      .replace(/[^A-Za-zÄÖÜäöüß0-9,;:/()\- ]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^[,;:./-]+/, "")
      .replace(/[,;:./-]+$/, "")
      .trim();
  }

  function detectPageFromText(rawText) {
    const matches = String(rawText).match(/\b\d{3}\b/g);
    if (!matches) {
      return "";
    }

    const page = matches.map(Number).find((value) => value >= 100 && value <= 400);
    return page || "";
  }

  function toCsvLineFromCandidate(entry, unit, lesson, page) {
    const english = sanitizeCsvField(entry.english);
    const german = sanitizeCsvField(entry.german).replace(/;/g, ", ");
    const unitSafe = sanitizeCsvField(unit || "OCR Unit");
    const lessonSafe = sanitizeCsvField(lesson || "OCR Lektion");
    const pageSafe = Number.isFinite(Number(page)) && Number(page) > 0 ? String(page) : "";

    return `${english};${german};${unitSafe};${lessonSafe};${pageSafe}`;
  }

  function sanitizeCsvField(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return {
    bind
  };
}
