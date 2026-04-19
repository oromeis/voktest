import { BASE_VOCABULARY } from "./data/vocabulary.js";
import { createHistoryModule } from "./modules/history-module.js";
import { createImportModule } from "./modules/import-module.js";
import { isAnswerCorrect, labelMode, shuffle, splitVariants } from "./modules/common.js";

const STORAGE_KEYS = {
  history: "voktest_history_v1",
  mistakes: "voktest_mistakes_v1",
  customVocabulary: "voktest_custom_v1",
  settings: "voktest_settings_v1"
};

const DEFAULT_SETTINGS = {
  mode: "learn",
  direction: "en-de",
  size: 15,
  unit: "all",
  focus: "all",
  section: "start"
};

const LEVEL_STEP_XP = 120;
const LEVEL_TITLES = [
  "Wortstarter",
  "Satzbauer",
  "Sprachdetektiv",
  "Vokabelprofi",
  "Textmeister",
  "Klassenchampion"
];

const state = {
  customVocabulary: load(STORAGE_KEYS.customVocabulary, []),
  history: load(STORAGE_KEYS.history, []),
  mistakes: load(STORAGE_KEYS.mistakes, {}),
  settings: { ...DEFAULT_SETTINGS, ...load(STORAGE_KEYS.settings, {}) },
  session: null,
  deferredInstallPrompt: null
};

const el = {
  sectionTabs: Array.from(document.querySelectorAll("[data-section-target]")),
  sectionPanels: Array.from(document.querySelectorAll("[data-section-panel]")),
  modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
  directionButtons: Array.from(document.querySelectorAll("[data-direction]")),
  levelBadge: document.getElementById("levelBadge"),
  xpBadge: document.getElementById("xpBadge"),
  motivationLine: document.getElementById("motivationLine"),
  unitSelect: document.getElementById("unitSelect"),
  sizeSelect: document.getElementById("sizeSelect"),
  focusSelect: document.getElementById("focusSelect"),
  startBtn: document.getElementById("startBtn"),
  mistakeBtn: document.getElementById("mistakeBtn"),
  progressText: document.getElementById("progressText"),
  streakChip: document.getElementById("streakChip"),
  pointsChip: document.getElementById("pointsChip"),
  questionLabel: document.getElementById("questionLabel"),
  questionText: document.getElementById("questionText"),
  hintText: document.getElementById("hintText"),
  bigFeedback: document.getElementById("bigFeedback"),
  sparkLayer: document.getElementById("sparkLayer"),
  playLevelBadge: document.getElementById("playLevelBadge"),
  nextLevelText: document.getElementById("nextLevelText"),
  xpBarFill: document.getElementById("xpBarFill"),
  feedbackText: document.getElementById("feedbackText"),
  answerForm: document.getElementById("answerForm"),
  answerInput: document.getElementById("answerInput"),
  skipBtn: document.getElementById("skipBtn"),
  mcOptions: document.getElementById("mcOptions"),
  optionTemplate: document.getElementById("optionTemplate"),
  learnActions: document.getElementById("learnActions"),
  showAnswerBtn: document.getElementById("showAnswerBtn"),
  knowButtons: document.getElementById("knowButtons"),
  knewBtn: document.getElementById("knewBtn"),
  againBtn: document.getElementById("againBtn"),
  summaryPanel: document.getElementById("summaryPanel"),
  summaryGrid: document.getElementById("summaryGrid"),
  gradeText: document.getElementById("gradeText"),
  mistakeList: document.getElementById("mistakeList"),
  historyGrid: document.getElementById("historyGrid"),
  recentRunsList: document.getElementById("recentRunsList"),
  backToStartBtn: document.getElementById("backToStartBtn"),
  ocrFileInput: document.getElementById("ocrFileInput"),
  ocrBtn: document.getElementById("ocrBtn"),
  ocrFeedback: document.getElementById("ocrFeedback"),
  ocrRawText: document.getElementById("ocrRawText"),
  importTextarea: document.getElementById("importTextarea"),
  importBtn: document.getElementById("importBtn"),
  resetBtn: document.getElementById("resetBtn"),
  importFeedback: document.getElementById("importFeedback"),
  resetProgressBtn: document.getElementById("resetProgressBtn"),
  settingsFeedback: document.getElementById("settingsFeedback"),
  installBtn: document.getElementById("installBtn")
};

const historyModule = createHistoryModule({
  state,
  elements: {
    summaryPanel: el.summaryPanel,
    summaryGrid: el.summaryGrid,
    gradeText: el.gradeText,
    mistakeList: el.mistakeList,
    historyGrid: el.historyGrid,
    recentRunsList: el.recentRunsList
  },
  persistHistory: () => save(STORAGE_KEYS.history, state.history)
});

const importModule = createImportModule({
  state,
  elements: {
    ocrFileInput: el.ocrFileInput,
    ocrBtn: el.ocrBtn,
    ocrFeedback: el.ocrFeedback,
    ocrRawText: el.ocrRawText,
    importTextarea: el.importTextarea,
    importBtn: el.importBtn,
    resetBtn: el.resetBtn,
    importFeedback: el.importFeedback
  },
  persistCustomVocabulary: () => save(STORAGE_KEYS.customVocabulary, state.customVocabulary),
  onVocabularyChanged: () => {
    refreshUnitFilters();
    renderIdleState();
  }
});

let feedbackTimeoutId = null;

init();

function init() {
  bindEvents();
  bindSectionNavigation();
  importModule.bind();
  applySettingsToControls();
  refreshUnitFilters();
  historyModule.renderHistory();
  updateGamificationWidgets(0);
  renderIdleState();
  registerServiceWorker();
}

function bindEvents() {
  el.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.mode = button.dataset.mode;
      save(STORAGE_KEYS.settings, state.settings);
      syncModeButtons();
      renderIdleState();
    });
  });

  el.directionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.direction = button.dataset.direction;
      save(STORAGE_KEYS.settings, state.settings);
      syncDirectionButtons();
      renderIdleState();
    });
  });

  el.sizeSelect.addEventListener("change", () => {
    state.settings.size = Number(el.sizeSelect.value);
    save(STORAGE_KEYS.settings, state.settings);
  });

  el.unitSelect.addEventListener("change", () => {
    state.settings.unit = el.unitSelect.value;
    save(STORAGE_KEYS.settings, state.settings);
    renderIdleState();
  });

  el.focusSelect.addEventListener("change", () => {
    state.settings.focus = el.focusSelect.value;
    save(STORAGE_KEYS.settings, state.settings);
  });

  el.startBtn.addEventListener("click", () => startSession(state.settings.focus));
  el.mistakeBtn.addEventListener("click", () => startSession("mistakes"));
  el.backToStartBtn.addEventListener("click", () => setActiveSection("start"));
  el.resetProgressBtn.addEventListener("click", handleResetProgress);

  el.answerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.session) {
      return;
    }

    const question = getCurrentQuestion();
    const answer = el.answerInput.value.trim();
    if (!answer) {
      setFeedback("Bitte zuerst eine Antwort eingeben.", false);
      return;
    }

    const valid = isAnswerCorrect(answer, question.answerVariants);
    submitQuestion(valid, answer);
  });

  el.skipBtn.addEventListener("click", () => {
    if (!state.session) {
      return;
    }
    submitQuestion(false, "(übersprungen)");
  });

  el.showAnswerBtn.addEventListener("click", () => {
    if (!state.session) {
      return;
    }
    const question = getCurrentQuestion();
    el.hintText.classList.remove("hidden");
    el.hintText.textContent = `Antwort: ${question.answerDisplay}`;
    el.knowButtons.classList.remove("hidden");
    el.showAnswerBtn.disabled = true;
  });

  el.knewBtn.addEventListener("click", () => {
    if (!state.session) {
      return;
    }
    submitQuestion(true, "(selbst bewertet)");
  });

  el.againBtn.addEventListener("click", () => {
    if (!state.session) {
      return;
    }
    submitQuestion(false, "(selbst bewertet)");
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    el.installBtn.classList.remove("hidden");
  });

  el.installBtn.addEventListener("click", async () => {
    if (!state.deferredInstallPrompt) {
      return;
    }

    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    el.installBtn.classList.add("hidden");
  });
}

function bindSectionNavigation() {
  el.sectionTabs.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveSection(button.dataset.sectionTarget);
    });
  });
}

function applySettingsToControls() {
  el.sizeSelect.value = String(state.settings.size);
  el.focusSelect.value = state.settings.focus;
  syncModeButtons();
  syncDirectionButtons();
  setActiveSection("start");
}

function setActiveSection(sectionName) {
  const legacyMap = {
    training: "play",
    importConfig: "settings",
    import: "settings"
  };
  const normalizedSection = legacyMap[sectionName] || sectionName;
  const allowed = ["start", "play", "history", "settings"];
  const activeSection = allowed.includes(normalizedSection) ? normalizedSection : "start";

  state.settings.section = activeSection;
  save(STORAGE_KEYS.settings, state.settings);

  el.sectionTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.sectionTarget === activeSection);
  });

  el.sectionPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.sectionPanel !== activeSection);
  });
}

function syncModeButtons() {
  el.modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.settings.mode);
  });
}

function syncDirectionButtons() {
  el.directionButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.direction === state.settings.direction);
  });
}

function getAllVocabulary() {
  return [...BASE_VOCABULARY, ...state.customVocabulary];
}

function getEntryUnit(entry) {
  const rawUnit = entry?.unit;
  const unit = typeof rawUnit === "string" ? rawUnit.trim() : "";
  return unit || "Ohne Unit";
}

function refreshUnitFilters() {
  const units = [
    ...new Set(
      getAllVocabulary()
        .filter(Boolean)
        .map((entry) => getEntryUnit(entry))
    )
  ].sort((left, right) => left.localeCompare(right, "de", { numeric: true, sensitivity: "base" }));
  buildSelectOptions(el.unitSelect, ["all", ...units], state.settings.unit, "Alle Units");
}

function buildSelectOptions(select, values, activeValue, allLabel) {
  if (!select) {
    return;
  }

  select.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value === "all" ? allLabel : value;
    select.append(option);
  });

  if (values.includes(activeValue)) {
    select.value = activeValue;
    return;
  }

  select.value = "all";
  if (select === el.unitSelect) {
    state.settings.unit = "all";
  }
  save(STORAGE_KEYS.settings, state.settings);
}

function buildQuestion(entry) {
  const prompt = state.settings.direction === "en-de" ? entry.english : entry.german;
  const answerDisplay = state.settings.direction === "en-de" ? entry.german : entry.english;

  return {
    entry,
    prompt,
    answerDisplay,
    answerVariants: splitVariants(answerDisplay)
  };
}

function getPool(focusMode) {
  const all = getAllVocabulary();
  let pool = all.filter((entry) => {
    if (!entry) {
      return false;
    }
    if (state.settings.unit !== "all" && getEntryUnit(entry) !== state.settings.unit) {
      return false;
    }
    return true;
  });

  if (focusMode === "mistakes") {
    const ids = Object.entries(state.mistakes)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    const map = new Map(pool.map((entry) => [entry.id, entry]));
    pool = ids.map((id) => map.get(id)).filter(Boolean);
  }

  return pool;
}

function startSession(focusMode = "all") {
  const pool = getPool(focusMode);
  if (pool.length === 0) {
    setFeedback("Keine passenden Vokabeln gefunden. Prüfe Filter oder importiere neue Daten.", false);
    return;
  }

  setActiveSection("play");

  const size = Math.min(state.settings.size, pool.length);
  const selectedEntries = shuffle([...pool]).slice(0, size);
  const questions = selectedEntries.map((entry) => buildQuestion(entry));

  state.session = {
    mode: state.settings.mode,
    focus: focusMode,
    questions,
    index: 0,
    correct: 0,
    wrong: 0,
    points: 0,
    streak: 0,
    bestStreak: 0,
    wrongItems: []
  };

  el.summaryPanel.classList.add("hidden");
  hideBigFeedback();
  setFeedback("", true);
  updateGamificationWidgets(0);
  renderQuestion();
}

function getCurrentQuestion() {
  return state.session.questions[state.session.index];
}

function renderQuestion() {
  const session = state.session;
  const question = getCurrentQuestion();

  if (!question) {
    finishSession();
    return;
  }

  el.progressText.textContent = `Frage ${session.index + 1} von ${session.questions.length}`;
  el.streakChip.textContent = `Streak ${session.streak}`;
  el.pointsChip.textContent = `Punkte ${session.points}`;
  el.questionLabel.textContent =
    state.settings.direction === "en-de"
      ? "Übersetze ins Deutsche"
      : "Übersetze ins Englische";
  el.questionText.textContent = question.prompt;
  el.hintText.classList.add("hidden");
  el.hintText.textContent = "";
  setFeedback("", true);
  el.answerInput.value = "";
  el.answerInput.blur();

  el.answerForm.classList.add("hidden");
  el.learnActions.classList.add("hidden");
  el.knowButtons.classList.add("hidden");
  el.showAnswerBtn.disabled = false;
  el.mcOptions.classList.add("hidden");
  el.mcOptions.innerHTML = "";

  if (session.mode === "learn") {
    el.learnActions.classList.remove("hidden");
    return;
  }

  if (session.mode === "quiz") {
    renderMultipleChoice(question);
    return;
  }

  el.answerForm.classList.remove("hidden");
  el.answerInput.focus();
}

function renderMultipleChoice(question) {
  const all = getPool("all");
  const wrongChoices = shuffle(
    all
      .filter((entry) => entry.id !== question.entry.id)
      .map((entry) => (state.settings.direction === "en-de" ? entry.german : entry.english))
  )
    .slice(0, 3)
    .map((choice) => splitVariants(choice)[0]);

  const options = shuffle([splitVariants(question.answerDisplay)[0], ...wrongChoices]);

  el.mcOptions.classList.remove("hidden");
  options.forEach((option) => {
    const node = el.optionTemplate.content.firstElementChild.cloneNode(true);
    node.textContent = option;
    node.addEventListener("click", () => {
      const isCorrect = isAnswerCorrect(option, question.answerVariants);
      Array.from(el.mcOptions.children).forEach((btn) => {
        btn.disabled = true;
      });

      if (isCorrect) {
        node.classList.add("correct");
      } else {
        node.classList.add("wrong");
        Array.from(el.mcOptions.children).forEach((btn) => {
          if (isAnswerCorrect(btn.textContent || "", question.answerVariants)) {
            btn.classList.add("correct");
          }
        });
      }

      setTimeout(() => submitQuestion(isCorrect, option), 550);
    });

    el.mcOptions.append(node);
  });
}

function submitQuestion(isCorrect, userAnswer) {
  const session = state.session;
  const question = getCurrentQuestion();

  if (isCorrect) {
    session.correct += 1;
    session.streak += 1;
    session.bestStreak = Math.max(session.bestStreak, session.streak);
    const gained = 8 + Math.min(session.streak, 6);
    session.points += gained;
    setFeedback("Richtig.", true);
    showBigFeedback(`Stark! +${gained} Punkte`, true);
    triggerSparkles();
    safeVibrate([14]);
  } else {
    session.wrong += 1;
    session.streak = 0;
    session.points = Math.max(0, session.points - 2);
    session.wrongItems.push({
      prompt: question.prompt,
      expected: question.answerDisplay,
      answer: userAnswer
    });
    state.mistakes[question.entry.id] = (state.mistakes[question.entry.id] || 0) + 1;
    save(STORAGE_KEYS.mistakes, state.mistakes);
    setFeedback(`Nicht ganz. Richtig wäre: ${question.answerDisplay}`, false);
    showBigFeedback("Fast! Weiter geht's.", false);
    safeVibrate([25, 35, 25]);
  }

  el.streakChip.textContent = `Streak ${session.streak}`;
  el.pointsChip.textContent = `Punkte ${session.points}`;
  updateGamificationWidgets(session.points);

  session.index += 1;

  setTimeout(() => {
    if (session.index >= session.questions.length) {
      finishSession();
      return;
    }
    renderQuestion();
  }, session.mode === "test" ? 450 : 320);
}

function finishSession() {
  const entry = historyModule.recordSession(state.session, state.settings.direction);
  historyModule.renderSummary(entry, state.session.wrongItems);
  historyModule.renderHistory();
  updateGamificationWidgets(0);
  state.session = null;
  el.progressText.textContent = "Runde beendet. Du kannst direkt die nächste starten.";
}

function renderIdleState() {
  if (state.session) {
    return;
  }

  el.questionLabel.textContent =
    state.settings.direction === "en-de"
      ? "Übersetze ins Deutsche"
      : "Übersetze ins Englische";
  el.questionText.textContent = `Modus: ${labelMode(state.settings.mode)}. Starte eine neue Runde.`;
  el.answerForm.classList.add("hidden");
  el.mcOptions.classList.add("hidden");
  el.learnActions.classList.add("hidden");
  el.hintText.classList.add("hidden");
  hideBigFeedback();
  el.feedbackText.textContent = "";
  el.feedbackText.className = "feedback";
  updateGamificationWidgets(0);
}

function setFeedback(text, ok) {
  el.feedbackText.textContent = text;
  el.feedbackText.className = `feedback ${ok ? "ok" : "err"}`;
}

function setSettingsFeedback(text, ok) {
  el.settingsFeedback.textContent = text;
  el.settingsFeedback.className = `feedback ${ok ? "ok" : "err"}`;
}

function handleResetProgress() {
  const accepted = window.confirm(
    "Wirklich zurücksetzen? Verlauf, Fehlerstatistik, XP und Level werden gelöscht."
  );
  if (!accepted) {
    return;
  }

  state.session = null;
  state.history = [];
  state.mistakes = {};
  save(STORAGE_KEYS.history, state.history);
  save(STORAGE_KEYS.mistakes, state.mistakes);

  el.summaryPanel.classList.add("hidden");
  el.summaryGrid.innerHTML = "";
  el.gradeText.textContent = "";
  el.mistakeList.innerHTML = "";

  historyModule.renderHistory();
  renderIdleState();
  updateGamificationWidgets(0);
  setSettingsFeedback("Lernfortschritt wurde zurückgesetzt.", true);
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function updateGamificationWidgets(extraSessionPoints) {
  const totalXp = getTotalXp() + Math.max(0, extraSessionPoints || 0);
  const levelInfo = getLevelInfo(totalXp);
  const levelTitle = getLevelTitle(levelInfo.level);

  el.levelBadge.textContent = `Level ${levelInfo.level} · ${levelTitle}`;
  el.xpBadge.textContent = `XP ${totalXp}`;
  el.playLevelBadge.textContent = `Level ${levelInfo.level}`;
  el.xpBarFill.style.width = `${levelInfo.progressPercent}%`;
  el.nextLevelText.textContent =
    levelInfo.remainingXp > 0
      ? `Noch ${levelInfo.remainingXp} XP bis Level ${levelInfo.level + 1}`
      : "Level geschafft! Weiter so.";
  el.motivationLine.textContent = getMotivationLine(levelInfo.level);
}

function getTotalXp() {
  return state.history.reduce((sum, entry) => sum + Math.max(0, Number(entry.points) || 0), 0);
}

function getLevelInfo(totalXp) {
  const safeXp = Math.max(0, Number(totalXp) || 0);
  const level = Math.floor(safeXp / LEVEL_STEP_XP) + 1;
  const levelFloor = (level - 1) * LEVEL_STEP_XP;
  const progressInLevel = safeXp - levelFloor;
  const progressPercent = Math.round((progressInLevel / LEVEL_STEP_XP) * 100);
  const remainingXp = Math.max(0, LEVEL_STEP_XP - progressInLevel);

  return {
    level,
    progressPercent: Math.min(100, Math.max(0, progressPercent)),
    remainingXp
  };
}

function getLevelTitle(level) {
  const index = Math.max(0, Math.min(LEVEL_TITLES.length - 1, level - 1));
  if (level <= LEVEL_TITLES.length) {
    return LEVEL_TITLES[index];
  }
  return `${LEVEL_TITLES[LEVEL_TITLES.length - 1]}+`;
}

function getMotivationLine(level) {
  if (level <= 1) {
    return "Jede richtige Antwort bringt dich zum nächsten Level.";
  }
  if (level <= 3) {
    return "Du bist auf Kurs. Halte deinen Streak am Leben.";
  }
  if (level <= 5) {
    return "Starke Runde bisher. Du spielst schon sehr sicher.";
  }
  return "Top Niveau. Du arbeitest wie ein echter Sprachprofi.";
}

function showBigFeedback(text, ok) {
  if (feedbackTimeoutId) {
    clearTimeout(feedbackTimeoutId);
  }

  el.bigFeedback.textContent = text;
  el.bigFeedback.className = `big-feedback ${ok ? "ok" : "err"} show`;
  el.bigFeedback.classList.remove("hidden");
  feedbackTimeoutId = setTimeout(() => {
    hideBigFeedback();
  }, 900);
}

function hideBigFeedback() {
  if (feedbackTimeoutId) {
    clearTimeout(feedbackTimeoutId);
    feedbackTimeoutId = null;
  }
  el.bigFeedback.className = "big-feedback hidden";
  el.bigFeedback.textContent = "";
}

function triggerSparkles() {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  el.sparkLayer.innerHTML = "";
  const count = 10;

  for (let index = 0; index < count; index += 1) {
    const piece = document.createElement("span");
    piece.className = "spark";
    const angle = (Math.PI * 2 * index) / count;
    const distance = 35 + Math.random() * 60;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 22;
    piece.style.setProperty("--dx", `${dx}px`);
    piece.style.setProperty("--dy", `${dy}px`);
    piece.style.left = `${46 + Math.random() * 8}%`;
    piece.style.top = `${36 + Math.random() * 16}%`;
    piece.style.animationDelay = `${Math.random() * 90}ms`;
    el.sparkLayer.append(piece);
  }
}

function safeVibrate(pattern) {
  if (!("vibrate" in navigator)) {
    return;
  }
  try {
    navigator.vibrate(pattern);
  } catch {
    // vibration is optional
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
    return;
  }

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch {
      // Offline support is optional.
    }
  });
}
