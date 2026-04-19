import { BASE_VOCABULARY } from "./data/vocabulary.js";
import {
  DEFAULT_TARGET_MINUTES,
  computeRewardBonusPoints,
  createWeeklyGoal,
  formatDeadlineText,
  getRewardLabel,
  getWeekContext,
  isDateWithinRange,
  isDynamicPasswordValid,
  normalizeSecret,
  sanitizeTargetMinutes,
  secondsToMinutes
} from "./modules/admin-utils.js";
import { createHistoryModule } from "./modules/history-module.js";
import { createImportModule } from "./modules/import-module.js";
import { isAnswerCorrect, labelMode, shuffle, splitVariants } from "./modules/common.js";

const STORAGE_KEYS = {
  history: "voktest_history_v1",
  mistakes: "voktest_mistakes_v1",
  customVocabulary: "voktest_custom_v1",
  settings: "voktest_settings_v1",
  admin: "voktest_admin_v1",
  weeklyGoal: "voktest_weekly_goal_v1"
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

const DEFAULT_ADMIN_CONFIG = {
  backupPin: ""
};

const remoteSync = {
  available: false,
  attempted: false,
  pendingPush: false,
  pushInFlight: false,
  connectInFlight: false,
  timerId: null,
  status: "Nur lokal gespeichert."
};

const state = {
  customVocabulary: load(STORAGE_KEYS.customVocabulary, []),
  history: load(STORAGE_KEYS.history, []),
  mistakes: load(STORAGE_KEYS.mistakes, {}),
  settings: { ...DEFAULT_SETTINGS, ...load(STORAGE_KEYS.settings, {}) },
  adminConfig: { ...DEFAULT_ADMIN_CONFIG, ...load(STORAGE_KEYS.admin, {}) },
  weeklyGoal: load(STORAGE_KEYS.weeklyGoal, null),
  adminSessionUnlocked: false,
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
  storageStatus: document.getElementById("storageStatus"),
  installBtn: document.getElementById("installBtn"),
  weeklyGoalHint: document.getElementById("weeklyGoalHint"),
  adminLoginCard: document.getElementById("adminLoginCard"),
  adminDashboardCard: document.getElementById("adminDashboardCard"),
  adminPasswordInput: document.getElementById("adminPasswordInput"),
  adminUnlockBtn: document.getElementById("adminUnlockBtn"),
  adminAuthFeedback: document.getElementById("adminAuthFeedback"),
  adminLockBtn: document.getElementById("adminLockBtn"),
  adminWeekLabel: document.getElementById("adminWeekLabel"),
  adminDeadlineLabel: document.getElementById("adminDeadlineLabel"),
  adminProgressFill: document.getElementById("adminProgressFill"),
  adminProgressText: document.getElementById("adminProgressText"),
  adminRemainingText: document.getElementById("adminRemainingText"),
  adminRewardText: document.getElementById("adminRewardText"),
  adminRewardStatus: document.getElementById("adminRewardStatus"),
  weeklyTargetInput: document.getElementById("weeklyTargetInput"),
  saveWeeklyTargetBtn: document.getElementById("saveWeeklyTargetBtn"),
  adminBackupPinInput: document.getElementById("adminBackupPinInput"),
  saveBackupPinBtn: document.getElementById("saveBackupPinBtn"),
  adminSettingsFeedback: document.getElementById("adminSettingsFeedback")
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
let sessionTickIntervalId = null;

void init();

async function init() {
  normalizeHistoryEntries();
  ensureCurrentWeeklyGoal();
  bindEvents();
  bindSectionNavigation();
  bindSessionVisibilityTracking();
  importModule.bind();
  applySettingsToControls();
  refreshUnitFilters();
  historyModule.renderHistory();
  updateGamificationWidgets(0);
  renderAdminState();
  renderWeeklyGoalHint();
  renderIdleState();
  renderStorageStatus();
  registerServiceWorker();

  await hydrateFromServer();
  startRemoteReconnectLoop();
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

  el.adminUnlockBtn.addEventListener("click", handleAdminUnlock);
  el.adminLockBtn.addEventListener("click", lockAdminSession);
  el.saveWeeklyTargetBtn.addEventListener("click", handleSaveWeeklyTarget);
  el.saveBackupPinBtn.addEventListener("click", handleSaveBackupPin);

  el.adminPasswordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAdminUnlock();
    }
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
  const allowed = ["start", "play", "history", "settings", "admin"];
  const activeSection = allowed.includes(normalizedSection) ? normalizedSection : "start";

  state.settings.section = activeSection;
  save(STORAGE_KEYS.settings, state.settings);

  el.sectionTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.sectionTarget === activeSection);
  });

  el.sectionPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.sectionPanel !== activeSection);
  });

  if (activeSection === "admin") {
    renderAdminState();
  }
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
  ensureCurrentWeeklyGoal();
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
    rewardBonusPoints: 0,
    streak: 0,
    bestStreak: 0,
    wrongItems: [],
    weekKey: state.weeklyGoal?.weekKey || getWeekContext(new Date()).weekKey,
    activeSeconds: 0,
    activeStartedAt: document.visibilityState === "visible" ? Date.now() : null
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
  const session = state.session;
  if (!session) {
    return;
  }

  finalizeSessionTiming(session);
  applyWeeklyRewardIfEligible(session);
  const entry = historyModule.recordSession(session, state.settings.direction);
  historyModule.renderSummary(entry, session.wrongItems);
  historyModule.renderHistory();
  updateGamificationWidgets(0);
  renderAdminState();
  renderWeeklyGoalHint();
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
  renderWeeklyGoalHint();
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
  ensureCurrentWeeklyGoal(true);
  save(STORAGE_KEYS.history, state.history);
  save(STORAGE_KEYS.mistakes, state.mistakes);

  el.summaryPanel.classList.add("hidden");
  el.summaryGrid.innerHTML = "";
  el.gradeText.textContent = "";
  el.mistakeList.innerHTML = "";

  historyModule.renderHistory();
  renderIdleState();
  updateGamificationWidgets(0);
  renderAdminState();
  renderWeeklyGoalHint();
  setSettingsFeedback("Lernfortschritt wurde zurückgesetzt.", true);
}

function bindSessionVisibilityTracking() {
  document.addEventListener("visibilitychange", () => {
    if (!state.session) {
      return;
    }

    if (document.visibilityState === "hidden") {
      pauseSessionTimer(state.session);
    } else if (document.visibilityState === "visible") {
      resumeSessionTimer(state.session);
    }

    renderWeeklyGoalHint();
    if (state.settings.section === "admin") {
      renderAdminState();
    }
  });

  if (sessionTickIntervalId) {
    clearInterval(sessionTickIntervalId);
  }

  sessionTickIntervalId = window.setInterval(() => {
    if (!state.session) {
      return;
    }
    renderWeeklyGoalHint();
    if (state.settings.section === "admin") {
      renderAdminState();
    }
  }, 15000);
}

function pauseSessionTimer(session) {
  if (!session || session.activeStartedAt === null) {
    return;
  }
  const delta = (Date.now() - session.activeStartedAt) / 1000;
  session.activeSeconds = Math.max(0, (session.activeSeconds || 0) + delta);
  session.activeStartedAt = null;
}

function resumeSessionTimer(session) {
  if (!session || session.activeStartedAt !== null) {
    return;
  }
  if (document.visibilityState !== "visible") {
    return;
  }
  session.activeStartedAt = Date.now();
}

function getLiveSessionSeconds(session) {
  if (!session) {
    return 0;
  }

  let total = Math.max(0, Number(session.activeSeconds) || 0);
  if (session.activeStartedAt !== null && document.visibilityState === "visible") {
    total += (Date.now() - session.activeStartedAt) / 1000;
  }
  return Math.max(0, total);
}

function finalizeSessionTiming(session) {
  pauseSessionTimer(session);
  session.durationSeconds = Math.max(0, Math.round(session.activeSeconds || 0));
}

function normalizeHistoryEntries() {
  if (!Array.isArray(state.history)) {
    state.history = [];
    save(STORAGE_KEYS.history, state.history);
    return;
  }

  let changed = false;
  state.history = state.history.map((entry) => {
    const safe = { ...(entry || {}) };
    const next = {
      ...safe,
      points: Math.max(0, Number(safe.points) || 0),
      durationSeconds: Math.max(0, Math.round(Number(safe.durationSeconds) || 0)),
      rewardBonusPoints: Math.max(0, Number(safe.rewardBonusPoints) || 0),
      weekKey: typeof safe.weekKey === "string" ? safe.weekKey : ""
    };

    if (!next.weekKey && next.date) {
      const parsedDate = new Date(next.date);
      if (!Number.isNaN(parsedDate.getTime())) {
        next.weekKey = getWeekContext(parsedDate).weekKey;
        changed = true;
      }
    }

    if (
      next.points !== safe.points ||
      next.durationSeconds !== safe.durationSeconds ||
      next.rewardBonusPoints !== safe.rewardBonusPoints ||
      next.weekKey !== safe.weekKey
    ) {
      changed = true;
    }

    return next;
  });

  if (changed) {
    save(STORAGE_KEYS.history, state.history);
  }
}

function ensureCurrentWeeklyGoal(forceReset = false) {
  const now = new Date();
  const week = getWeekContext(now);
  const existing = state.weeklyGoal;

  const targetMinutes = sanitizeTargetMinutes(
    existing?.targetMinutes,
    DEFAULT_TARGET_MINUTES
  );

  if (forceReset || !existing || existing.weekKey !== week.weekKey) {
    state.weeklyGoal = createWeeklyGoal(now, targetMinutes);
    save(STORAGE_KEYS.weeklyGoal, state.weeklyGoal);
  } else {
    let changed = false;
    if (existing.weekStartIso !== week.weekStart.toISOString()) {
      existing.weekStartIso = week.weekStart.toISOString();
      changed = true;
    }
    if (existing.weekEndIso !== week.weekEnd.toISOString()) {
      existing.weekEndIso = week.weekEnd.toISOString();
      changed = true;
    }
    if (existing.targetMinutes !== targetMinutes) {
      existing.targetMinutes = targetMinutes;
      changed = true;
    }
    if (!existing.rewardDefinition || typeof existing.rewardDefinition !== "object") {
      existing.rewardDefinition = createWeeklyGoal(now, targetMinutes).rewardDefinition;
      changed = true;
    }
    if (typeof existing.rewardGranted !== "boolean") {
      existing.rewardGranted = false;
      changed = true;
    }
    if (typeof existing.achieved !== "boolean") {
      existing.achieved = false;
      changed = true;
    }
    if (typeof existing.rewardBonusPoints !== "number") {
      existing.rewardBonusPoints = 0;
      changed = true;
    }

    const usedMinutes = secondsToMinutes(getWeeklyUsedSeconds(existing, false));
    if (!existing.rewardGranted && existing.achieved !== (usedMinutes >= existing.targetMinutes)) {
      existing.achieved = usedMinutes >= existing.targetMinutes;
      changed = true;
    }

    state.weeklyGoal = existing;
    if (changed) {
      save(STORAGE_KEYS.weeklyGoal, state.weeklyGoal);
    }
  }
}

function getWeeklyUsedSeconds(weeklyGoal, includeCurrentSession) {
  if (!weeklyGoal) {
    return 0;
  }

  const fromHistory = state.history.reduce((sum, entry) => {
    if (!entry) {
      return sum;
    }

    const durationSeconds = Math.max(0, Number(entry.durationSeconds) || 0);
    if (!durationSeconds) {
      return sum;
    }

    if (entry.weekKey) {
      return entry.weekKey === weeklyGoal.weekKey ? sum + durationSeconds : sum;
    }

    if (entry.date && isDateWithinRange(entry.date, weeklyGoal.weekStartIso, weeklyGoal.weekEndIso)) {
      return sum + durationSeconds;
    }

    return sum;
  }, 0);

  if (!includeCurrentSession || !state.session) {
    return fromHistory;
  }

  if (state.session.weekKey !== weeklyGoal.weekKey) {
    return fromHistory;
  }

  return fromHistory + getLiveSessionSeconds(state.session);
}

function applyWeeklyRewardIfEligible(session) {
  ensureCurrentWeeklyGoal();
  const weeklyGoal = state.weeklyGoal;
  if (!weeklyGoal || !session) {
    return;
  }

  const previousUsedSeconds = getWeeklyUsedSeconds(weeklyGoal, false);
  const sessionSeconds = Math.max(0, Number(session.durationSeconds) || 0);
  const totalUsedSeconds = previousUsedSeconds + sessionSeconds;
  const targetSeconds = Math.max(0, weeklyGoal.targetMinutes * 60);

  if (!weeklyGoal.achieved && totalUsedSeconds >= targetSeconds) {
    weeklyGoal.achieved = true;
    weeklyGoal.achievedAt = new Date().toISOString();
  }

  session.weekKey = weeklyGoal.weekKey;
  session.rewardBonusPoints = 0;

  if (!weeklyGoal.rewardGranted && totalUsedSeconds >= targetSeconds) {
    const bonusPoints = computeRewardBonusPoints(weeklyGoal.rewardDefinition, session.points);
    if (bonusPoints > 0) {
      session.points += bonusPoints;
      session.rewardBonusPoints = bonusPoints;
      weeklyGoal.rewardGranted = true;
      weeklyGoal.rewardGrantedAt = new Date().toISOString();
      weeklyGoal.rewardBonusPoints = Math.max(
        0,
        Number(weeklyGoal.rewardBonusPoints) || 0
      ) + bonusPoints;
      setFeedback(`Wochenziel erfüllt: ${getRewardLabel(weeklyGoal.rewardDefinition)}.`, true);
      showBigFeedback(`Wochenziel geschafft! +${bonusPoints} XP`, true);
    }
  }

  save(STORAGE_KEYS.weeklyGoal, weeklyGoal);
}

function renderWeeklyGoalHint() {
  if (!el.weeklyGoalHint) {
    return;
  }

  ensureCurrentWeeklyGoal();
  const weeklyGoal = state.weeklyGoal;
  if (!weeklyGoal) {
    el.weeklyGoalHint.textContent = "Wochenziel nicht verfügbar.";
    return;
  }

  const usedSeconds = getWeeklyUsedSeconds(weeklyGoal, true);
  const usedMinutes = Math.floor(secondsToMinutes(usedSeconds));
  const targetMinutes = weeklyGoal.targetMinutes;
  const missing = Math.max(0, targetMinutes - usedMinutes);

  let status = `Noch ${missing} Min`;
  if (usedMinutes >= targetMinutes) {
    status = weeklyGoal.rewardGranted ? "Ziel erreicht + Bonus" : "Ziel erreicht";
  }

  el.weeklyGoalHint.textContent = `${usedMinutes} / ${targetMinutes} Min · ${status}`;
}

function renderAdminState() {
  ensureCurrentWeeklyGoal();
  const weeklyGoal = state.weeklyGoal;
  if (!weeklyGoal) {
    return;
  }

  const unlocked = state.adminSessionUnlocked;
  el.adminLoginCard.classList.toggle("hidden", unlocked);
  el.adminDashboardCard.classList.toggle("hidden", !unlocked);

  if (!unlocked) {
    return;
  }

  const usedSeconds = getWeeklyUsedSeconds(weeklyGoal, true);
  const usedMinutes = Math.floor(secondsToMinutes(usedSeconds));
  const target = weeklyGoal.targetMinutes;
  const progress = target > 0 ? Math.min(100, Math.round((usedMinutes / target) * 100)) : 0;

  el.adminWeekLabel.textContent = `Woche: ${weeklyGoal.weekKey}`;
  el.adminDeadlineLabel.textContent = `Deadline: ${formatDeadlineText(weeklyGoal.weekEndIso)}`;
  el.adminProgressFill.style.width = `${progress}%`;
  el.adminProgressText.textContent = `${usedMinutes} / ${target} Min`;
  el.adminRemainingText.textContent =
    usedMinutes >= target ? "Ziel erfüllt." : `Noch ${Math.max(0, target - usedMinutes)} Min offen.`;

  el.adminRewardText.textContent = getRewardLabel(weeklyGoal.rewardDefinition);

  let rewardStatus = "offen";
  if (weeklyGoal.rewardGranted) {
    rewardStatus = `Belohnung erhalten (+${Math.max(0, weeklyGoal.rewardBonusPoints || 0)} XP)`;
  } else if (usedMinutes >= target) {
    rewardStatus = "Ziel erreicht · Bonus mit nächster Runde";
  }
  el.adminRewardStatus.textContent = rewardStatus;

  el.weeklyTargetInput.value = String(target);
  el.adminBackupPinInput.value = "";
  el.adminBackupPinInput.placeholder = state.adminConfig.backupPin ? "Bereits gesetzt" : "Neue PIN";
}

function handleAdminUnlock() {
  const input = el.adminPasswordInput.value.trim();
  if (!input) {
    setAdminAuthFeedback("Bitte Passwort oder Backup-PIN eingeben.", false);
    return;
  }

  const dynamicAccepted = isDynamicPasswordValid(input, new Date());
  const backupAccepted =
    normalizeSecret(state.adminConfig.backupPin) &&
    normalizeSecret(input) === normalizeSecret(state.adminConfig.backupPin);

  if (!dynamicAccepted && !backupAccepted) {
    setAdminAuthFeedback("Zugangscode ist ungültig.", false);
    return;
  }

  state.adminSessionUnlocked = true;
  el.adminPasswordInput.value = "";
  setAdminAuthFeedback("Admin-Bereich entsperrt.", true);
  renderAdminState();
}

function lockAdminSession() {
  state.adminSessionUnlocked = false;
  setAdminSettingsFeedback("", true);
  renderAdminState();
}

function handleSaveWeeklyTarget() {
  if (!state.adminSessionUnlocked || !state.weeklyGoal) {
    return;
  }

  const target = sanitizeTargetMinutes(el.weeklyTargetInput.value, state.weeklyGoal.targetMinutes);
  state.weeklyGoal.targetMinutes = target;

  const usedMinutes = secondsToMinutes(getWeeklyUsedSeconds(state.weeklyGoal, true));
  if (!state.weeklyGoal.rewardGranted) {
    state.weeklyGoal.achieved = usedMinutes >= target;
  }

  save(STORAGE_KEYS.weeklyGoal, state.weeklyGoal);
  renderAdminState();
  renderWeeklyGoalHint();
  setAdminSettingsFeedback(`Wochenziel gespeichert: ${target} Minuten.`, true);
}

function handleSaveBackupPin() {
  if (!state.adminSessionUnlocked) {
    return;
  }

  const value = el.adminBackupPinInput.value.trim();
  if (value.length < 4) {
    setAdminSettingsFeedback("Backup-PIN muss mindestens 4 Zeichen haben.", false);
    return;
  }

  state.adminConfig.backupPin = value;
  save(STORAGE_KEYS.admin, state.adminConfig);
  el.adminBackupPinInput.value = "";
  renderAdminState();
  setAdminSettingsFeedback("Backup-PIN gespeichert.", true);
}

function setAdminAuthFeedback(text, ok) {
  el.adminAuthFeedback.textContent = text;
  el.adminAuthFeedback.className = `feedback ${ok ? "ok" : "err"}`;
}

function setAdminSettingsFeedback(text, ok) {
  el.adminSettingsFeedback.textContent = text;
  el.adminSettingsFeedback.className = `feedback ${ok ? "ok" : "err"}`;
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
  scheduleServerPush();
}

function saveLocalOnly(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function hydrateFromServer() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("/api/state", {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      setRemoteStatus(false, "Nur lokal gespeichert (kein API-Server).");
      return;
    }

    const payload = await response.json();
    const serverState = payload?.state;
    if (!serverState || typeof serverState !== "object") {
      setRemoteStatus(false, "Nur lokal gespeichert (ungültige Serverantwort).");
      return;
    }

    remoteSync.available = true;
    remoteSync.attempted = true;
    remoteSync.status = "Serverspeicher aktiv.";
    renderStorageStatus();

    const localSnapshot = buildServerStatePayload();
    if (isStatePayloadEmpty(serverState) && !isStatePayloadEmpty(localSnapshot)) {
      remoteSync.pendingPush = true;
      await pushStateToServer();
      return;
    }

    applyServerState(serverState);
  } catch {
    setRemoteStatus(false, "Nur lokal gespeichert (Server nicht erreichbar).");
  } finally {
    clearTimeout(timeout);
  }
}

function applyServerState(serverState) {
  const has = (key) => Object.prototype.hasOwnProperty.call(serverState, key);

  if (has(STORAGE_KEYS.history)) {
    state.history = Array.isArray(serverState[STORAGE_KEYS.history])
      ? serverState[STORAGE_KEYS.history]
      : [];
    saveLocalOnly(STORAGE_KEYS.history, state.history);
  }
  if (has(STORAGE_KEYS.mistakes)) {
    const mistakes = serverState[STORAGE_KEYS.mistakes];
    state.mistakes = mistakes && typeof mistakes === "object" ? mistakes : {};
    saveLocalOnly(STORAGE_KEYS.mistakes, state.mistakes);
  }
  if (has(STORAGE_KEYS.customVocabulary)) {
    state.customVocabulary = Array.isArray(serverState[STORAGE_KEYS.customVocabulary])
      ? serverState[STORAGE_KEYS.customVocabulary]
      : [];
    saveLocalOnly(STORAGE_KEYS.customVocabulary, state.customVocabulary);
  }
  if (has(STORAGE_KEYS.settings)) {
    state.settings = {
      ...DEFAULT_SETTINGS,
      ...state.settings,
      ...(serverState[STORAGE_KEYS.settings] || {})
    };
    saveLocalOnly(STORAGE_KEYS.settings, state.settings);
  }
  if (has(STORAGE_KEYS.admin)) {
    state.adminConfig = {
      ...DEFAULT_ADMIN_CONFIG,
      ...(serverState[STORAGE_KEYS.admin] || {})
    };
    saveLocalOnly(STORAGE_KEYS.admin, state.adminConfig);
  }
  if (has(STORAGE_KEYS.weeklyGoal)) {
    state.weeklyGoal = serverState[STORAGE_KEYS.weeklyGoal] || null;
    saveLocalOnly(STORAGE_KEYS.weeklyGoal, state.weeklyGoal);
  }

  normalizeHistoryEntries();
  ensureCurrentWeeklyGoal();
  applySettingsToControls();
  refreshUnitFilters();
  historyModule.renderHistory();
  renderAdminState();
  renderWeeklyGoalHint();
  renderIdleState();
  updateGamificationWidgets(0);
}

function setRemoteStatus(available, statusText) {
  remoteSync.available = available;
  remoteSync.attempted = true;
  remoteSync.status = statusText;
  renderStorageStatus();
}

function renderStorageStatus() {
  if (!el.storageStatus) {
    return;
  }
  const prefix = remoteSync.available ? "Speicher: Server" : "Speicher: Lokal";
  const text = remoteSync.status || (remoteSync.available ? "Serverspeicher aktiv." : "Nur lokal gespeichert.");
  el.storageStatus.textContent = `${prefix} · ${text}`;
}

function startRemoteReconnectLoop() {
  window.setInterval(() => {
    if (remoteSync.available || remoteSync.connectInFlight || remoteSync.pushInFlight) {
      return;
    }
    void recoverRemoteAndPush();
  }, 20000);
}

function scheduleServerPush() {
  remoteSync.pendingPush = true;
  if (remoteSync.timerId) {
    clearTimeout(remoteSync.timerId);
  }

  remoteSync.timerId = setTimeout(() => {
    remoteSync.timerId = null;
    if (remoteSync.available) {
      void pushStateToServer();
      return;
    }
    void recoverRemoteAndPush();
  }, 700);
}

async function pushStateToServer() {
  if (!remoteSync.available || remoteSync.pushInFlight || !remoteSync.pendingPush) {
    return;
  }

  remoteSync.pushInFlight = true;
  remoteSync.pendingPush = false;

  try {
    const payload = buildServerStatePayload();
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("state_push_failed");
    }

    remoteSync.status = `Synchronisiert: ${new Date().toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
    renderStorageStatus();
  } catch {
    remoteSync.available = false;
    remoteSync.status = "Sync fehlgeschlagen. Lokal weiter gespeichert.";
    renderStorageStatus();
  } finally {
    remoteSync.pushInFlight = false;
    if (remoteSync.pendingPush) {
      void pushStateToServer();
    }
  }
}

async function recoverRemoteAndPush() {
  if (remoteSync.connectInFlight) {
    return;
  }

  remoteSync.connectInFlight = true;
  try {
    const reachable = await canReachServer();
    if (!reachable) {
      setRemoteStatus(false, "Nur lokal gespeichert (Server nicht erreichbar).");
      return;
    }

    setRemoteStatus(true, "Server wieder erreichbar. Synchronisiere …");
    remoteSync.pendingPush = true;
    await pushStateToServer();
  } finally {
    remoteSync.connectInFlight = false;
  }
}

async function canReachServer() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("/api/state", {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function buildServerStatePayload() {
  return {
    [STORAGE_KEYS.history]: state.history,
    [STORAGE_KEYS.mistakes]: state.mistakes,
    [STORAGE_KEYS.customVocabulary]: state.customVocabulary,
    [STORAGE_KEYS.settings]: state.settings,
    [STORAGE_KEYS.admin]: state.adminConfig,
    [STORAGE_KEYS.weeklyGoal]: state.weeklyGoal
  };
}

function isStatePayloadEmpty(payload) {
  if (!payload || typeof payload !== "object") {
    return true;
  }

  const history = Array.isArray(payload[STORAGE_KEYS.history]) ? payload[STORAGE_KEYS.history] : [];
  const mistakes = payload[STORAGE_KEYS.mistakes];
  const custom = Array.isArray(payload[STORAGE_KEYS.customVocabulary])
    ? payload[STORAGE_KEYS.customVocabulary]
    : [];
  const admin = payload[STORAGE_KEYS.admin];
  const weeklyGoal = payload[STORAGE_KEYS.weeklyGoal];

  return (
    history.length === 0 &&
    custom.length === 0 &&
    (!mistakes || Object.keys(mistakes).length === 0) &&
    (!admin || !admin.backupPin) &&
    !weeklyGoal
  );
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
