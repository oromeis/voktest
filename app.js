import { BASE_VOCABULARY } from "./data/vocabulary.js";
import { BASE_VOCABULARY_FR6 } from "./data/vocabulary-fr6.js";
import {
  DEFAULT_TARGET_MINUTES,
  computeRewardBonusPoints,
  createWeeklyGoal,
  getRewardLabel,
  getWeekContext,
  isDateWithinRange,
  sanitizeTargetMinutes,
  secondsToMinutes
} from "./modules/admin-utils.js";
import { createHistoryModule } from "./modules/history-module.js";
import { createImportModule } from "./modules/import-module.js";
import { gradeFromPercent, isAnswerCorrect, labelMode, shuffle, splitVariants } from "./modules/common.js";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_SCHOOL_GRADE,
  createGradeOptions,
  getLanguageDefinition,
  getSupportedLanguages,
  getLanguagesForGrade,
  normalizeVocabularyList,
  sanitizeLanguageCode,
  sanitizeSchoolGrade
} from "./modules/catalog-utils.js";

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
  language: DEFAULT_LANGUAGE,
  size: 15,
  unit: "all",
  focus: "all",
  adminSection: "profiles",
  importLanguage: DEFAULT_LANGUAGE,
  importSchoolGrade: DEFAULT_SCHOOL_GRADE,
  section: "start"
};

const GRADE_OPTIONS = createGradeOptions();
const NORMALIZED_BASE_VOCABULARY = normalizeVocabularyList(
  [...BASE_VOCABULARY, ...BASE_VOCABULARY_FR6],
  {
  fallbackLanguage: DEFAULT_LANGUAGE,
  fallbackSchoolGrade: DEFAULT_SCHOOL_GRADE,
  idFallbackPrefix: "base"
}
);

const LEVEL_STEP_XP = 120;
const LEVEL_TITLES = [
  "Wortstarter",
  "Satzbauer",
  "Sprachdetektiv",
  "Vokabelprofi",
  "Textmeister",
  "Klassenchampion",
  "Lernrakete",
  "Wortakrobat",
  "Grammatikfuchs",
  "Sprachstratege",
  "Vokabelnavigator",
  "Quizkommandant",
  "Fehlerjäger",
  "Satzzauberer",
  "Punktemagnet",
  "Levellegende",
  "Englischheld",
  "Meisterdenker",
  "Wortkönig",
  "Champion Supreme"
];

const DEFAULT_ADMIN_CONFIG = {
  backupPinSet: false
};

const remoteSync = {
  available: false,
  attempted: false,
  pendingPush: false,
  pendingSharedPush: false,
  pushInFlight: false,
  connectInFlight: false,
  timerId: null,
  status: "Nicht angemeldet."
};

const ADMIN_SECTIONS = ["profiles", "new", "security"];

const state = {
  customVocabulary: [],
  history: [],
  mistakes: {},
  settings: { ...DEFAULT_SETTINGS },
  adminConfig: { ...DEFAULT_ADMIN_CONFIG },
  weeklyGoal: null,
  session: null,
  deferredInstallPrompt: null,
  auth: {
    token: "",
    role: "",
    user: null,
    profiles: [],
    adminProfiles: [],
    selectedProfileId: "",
    pinSetupProfileId: "",
    viewedProfileHistory: {
      profileId: "",
      profileName: "",
      entries: []
    }
  }
};

const el = {
  authGate: document.getElementById("authGate"),
  appTop: document.getElementById("appTop"),
  appMain: document.getElementById("appMain"),
  tabbar: document.getElementById("tabbar"),
  loginProfileSelect: document.getElementById("loginProfileSelect"),
  loginPinBlock: document.getElementById("loginPinBlock"),
  loginPinInput: document.getElementById("loginPinInput"),
  loginBtn: document.getElementById("loginBtn"),
  pinSetupBlock: document.getElementById("pinSetupBlock"),
  setupPinInput: document.getElementById("setupPinInput"),
  setupPinConfirmInput: document.getElementById("setupPinConfirmInput"),
  setupPinBtn: document.getElementById("setupPinBtn"),
  setupCancelBtn: document.getElementById("setupCancelBtn"),
  adminLoginCodeInput: document.getElementById("adminLoginCodeInput"),
  adminLoginBtn: document.getElementById("adminLoginBtn"),
  authFeedback: document.getElementById("authFeedback"),
  appContextBadge: document.getElementById("appContextBadge"),
  currentUserBadge: document.getElementById("currentUserBadge"),
  logoutBtn: document.getElementById("logoutBtn"),
  sectionTabs: Array.from(document.querySelectorAll("[data-section-target]")),
  sectionPanels: Array.from(document.querySelectorAll("[data-section-panel]")),
  adminSectionTabs: Array.from(document.querySelectorAll("[data-admin-section-target]")),
  adminSectionPanels: Array.from(document.querySelectorAll("[data-admin-section]")),
  modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
  directionButtons: Array.from(document.querySelectorAll("[data-direction]")),
  levelBadge: document.getElementById("levelBadge"),
  xpBadge: document.getElementById("xpBadge"),
  motivationLine: document.getElementById("motivationLine"),
  languageSelect: document.getElementById("languageSelect"),
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
  importGradeSelect: document.getElementById("importGradeSelect"),
  importLanguageSelect: document.getElementById("importLanguageSelect"),
  importBtn: document.getElementById("importBtn"),
  resetBtn: document.getElementById("resetBtn"),
  importFeedback: document.getElementById("importFeedback"),
  storageStatus: document.getElementById("storageStatus"),
  appVersion: document.getElementById("appVersion"),
  installBtn: document.getElementById("installBtn"),
  weeklyGoalHint: document.getElementById("weeklyGoalHint"),
  adminProfilesList: document.getElementById("adminProfilesList"),
  newProfileNameInput: document.getElementById("newProfileNameInput"),
  newProfileGradeSelect: document.getElementById("newProfileGradeSelect"),
  createProfileBtn: document.getElementById("createProfileBtn"),
  editProfileSelect: document.getElementById("editProfileSelect"),
  editProfileNameInput: document.getElementById("editProfileNameInput"),
  editProfileGradeSelect: document.getElementById("editProfileGradeSelect"),
  editProfilePinInput: document.getElementById("editProfilePinInput"),
  editProfileActiveInput: document.getElementById("editProfileActiveInput"),
  editProfileGoalInput: document.getElementById("editProfileGoalInput"),
  saveProfileBtn: document.getElementById("saveProfileBtn"),
  saveProfileGoalBtn: document.getElementById("saveProfileGoalBtn"),
  viewProfileHistoryBtn: document.getElementById("viewProfileHistoryBtn"),
  resetProfilePinBtn: document.getElementById("resetProfilePinBtn"),
  resetProfileProgressBtn: document.getElementById("resetProfileProgressBtn"),
  adminProfileHistoryTitle: document.getElementById("adminProfileHistoryTitle"),
  adminProfileHistoryGrid: document.getElementById("adminProfileHistoryGrid"),
  adminProfileHistoryList: document.getElementById("adminProfileHistoryList"),
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
  getImportContext: () => ({
    schoolGrade: sanitizeSchoolGrade(state.settings.importSchoolGrade, DEFAULT_SCHOOL_GRADE),
    language: sanitizeLanguageCode(state.settings.importLanguage, DEFAULT_LANGUAGE)
  }),
  onVocabularyChanged: () => {
    syncLanguageOptions();
    refreshUnitFilters();
    renderIdleState();
  }
});

let feedbackTimeoutId = null;
let sessionTickIntervalId = null;
let reconnectIntervalId = null;

void init();

async function init() {
  bindEvents();
  bindSectionNavigation();
  bindSessionVisibilityTracking();
  importModule.bind();
  resetStateForLoggedOut();
  applySettingsToControls();
  renderStorageStatus();
  void hydrateVersionInfo();
  registerServiceWorker();
  await loadLoginProfiles();
  showLoggedOutState();
}

function bindEvents() {
  el.loginBtn.addEventListener("click", () => {
    void handleStudentLogin();
  });
  el.setupPinBtn.addEventListener("click", () => {
    void handleInitialPinSetup();
  });
  el.setupCancelBtn.addEventListener("click", () => {
    cancelInitialPinSetup();
  });
  el.adminLoginBtn.addEventListener("click", () => {
    void handleAdminLogin();
  });
  el.logoutBtn.addEventListener("click", () => {
    void handleLogout();
  });
  el.loginPinInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleStudentLogin();
    }
  });
  el.setupPinInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleInitialPinSetup();
    }
  });
  el.setupPinConfirmInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleInitialPinSetup();
    }
  });
  el.loginProfileSelect.addEventListener("change", () => {
    syncLoginFlowForSelectedProfile();
  });
  el.adminLoginCodeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleAdminLogin();
    }
  });

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

  el.languageSelect.addEventListener("change", () => {
    state.settings.language = sanitizeLanguageCode(el.languageSelect.value, DEFAULT_LANGUAGE);
    state.settings.unit = "all";
    save(STORAGE_KEYS.settings, state.settings);
    refreshUnitFilters();
    syncDirectionLabels();
    updateHeaderContextBadge();
    renderIdleState();
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

  if (el.importGradeSelect) {
    el.importGradeSelect.addEventListener("change", () => {
      state.settings.importSchoolGrade = sanitizeSchoolGrade(
        el.importGradeSelect.value,
        DEFAULT_SCHOOL_GRADE
      );
    });
  }
  if (el.importLanguageSelect) {
    el.importLanguageSelect.addEventListener("change", () => {
      state.settings.importLanguage = sanitizeLanguageCode(
        el.importLanguageSelect.value,
        DEFAULT_LANGUAGE
      );
    });
  }

  el.startBtn.addEventListener("click", () => startSession(state.settings.focus));
  el.mistakeBtn.addEventListener("click", () => startSession("mistakes"));
  el.backToStartBtn.addEventListener("click", () => setActiveSection("start"));

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

  el.createProfileBtn.addEventListener("click", () => {
    void handleCreateProfile();
  });
  el.editProfileSelect.addEventListener("change", syncEditProfileFields);
  el.saveProfileBtn.addEventListener("click", () => {
    void handleSaveProfile();
  });
  el.saveProfileGoalBtn.addEventListener("click", () => {
    void handleSaveProfileGoal();
  });
  el.viewProfileHistoryBtn.addEventListener("click", () => {
    void handleViewProfileHistory();
  });
  el.resetProfilePinBtn.addEventListener("click", () => {
    void handleResetProfilePin();
  });
  el.resetProfileProgressBtn.addEventListener("click", () => {
    void handleResetProfileProgress();
  });
  el.saveBackupPinBtn.addEventListener("click", handleSaveBackupPin);
  el.adminSectionTabs.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveAdminSection(button.dataset.adminSectionTarget);
    });
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
  syncLanguageOptions();
  syncAdminGradeSelectOptions();
  syncAdminSectionView();
  el.sizeSelect.value = String(state.settings.size);
  el.focusSelect.value = state.settings.focus;
  if (el.importGradeSelect) {
    buildSelectOptions(
      el.importGradeSelect,
      GRADE_OPTIONS.map((grade) => String(grade)),
      String(state.settings.importSchoolGrade),
      ""
    );
  }
  if (el.importLanguageSelect) {
    const languageValues = getAdminImportLanguageValues();
    buildLanguageSelectOptions(
      el.importLanguageSelect,
      languageValues,
      state.settings.importLanguage
    );
  }
  syncModeButtons();
  syncDirectionLabels();
  syncDirectionButtons();
  updateHeaderContextBadge();
}

function syncAdminGradeSelectOptions() {
  const gradeValues = GRADE_OPTIONS.map((grade) => String(grade));
  if (el.newProfileGradeSelect) {
    const activeNewValue = el.newProfileGradeSelect.value || String(DEFAULT_SCHOOL_GRADE);
    buildSelectOptions(
      el.newProfileGradeSelect,
      gradeValues,
      activeNewValue,
      ""
    );
  }
  if (el.editProfileGradeSelect) {
    const activeGrade = el.editProfileGradeSelect.value || String(DEFAULT_SCHOOL_GRADE);
    buildSelectOptions(el.editProfileGradeSelect, gradeValues, activeGrade, "");
  }
}

function sanitizeAdminSection(value) {
  return ADMIN_SECTIONS.includes(value) ? value : "profiles";
}

function syncAdminSectionView() {
  const activeSection = sanitizeAdminSection(state.settings.adminSection);
  el.adminSectionTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.adminSectionTarget === activeSection);
  });
  el.adminSectionPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.adminSection !== activeSection);
  });
}

function setActiveAdminSection(sectionName, persist = true) {
  const nextSection = sanitizeAdminSection(sectionName);
  state.settings.adminSection = nextSection;
  if (persist) {
    save(STORAGE_KEYS.settings, state.settings);
  }
  syncAdminSectionView();
}

function setActiveSection(sectionName) {
  const legacyMap = {
    training: "play",
    importConfig: "settings",
    import: "settings"
  };
  const normalizedSection = legacyMap[sectionName] || sectionName;
  const activeSection = getAllowedSections().includes(normalizedSection)
    ? normalizedSection
    : getDefaultSectionForRole();

  state.settings.section = activeSection;
  save(STORAGE_KEYS.settings, state.settings);

  el.sectionTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.sectionTarget === activeSection);
  });

  el.sectionPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.sectionPanel !== activeSection);
  });

  if (activeSection === "admin") {
    setActiveAdminSection(state.settings.adminSection, false);
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
  const normalizedCustom = normalizeVocabularyList(state.customVocabulary, {
    fallbackLanguage: DEFAULT_LANGUAGE,
    fallbackSchoolGrade: DEFAULT_SCHOOL_GRADE,
    idFallbackPrefix: "custom"
  });
  return [...NORMALIZED_BASE_VOCABULARY, ...normalizedCustom];
}

function getCurrentUserSchoolGrade() {
  return sanitizeSchoolGrade(state.auth.user?.schoolGrade, DEFAULT_SCHOOL_GRADE);
}

function getAvailableLanguagesForCurrentGrade() {
  if (state.auth.role !== "student") {
    return [];
  }
  return getLanguagesForGrade(getAllVocabulary(), getCurrentUserSchoolGrade());
}

function getAdminImportLanguageValues() {
  return getSupportedLanguages();
}

function getActiveLanguageCode() {
  if (state.auth.role !== "student") {
    return sanitizeLanguageCode(state.settings.importLanguage, DEFAULT_LANGUAGE);
  }
  const available = getAvailableLanguagesForCurrentGrade();
  if (!available.length) {
    return "";
  }
  return available.includes(state.settings.language)
    ? state.settings.language
    : available[0];
}

function syncLanguageOptions() {
  if (!el.languageSelect) {
    return;
  }

  if (state.auth.role !== "student") {
    el.languageSelect.innerHTML = "";
    const option = document.createElement("option");
    option.value = DEFAULT_LANGUAGE;
    option.textContent = getLanguageDefinition(DEFAULT_LANGUAGE).label;
    el.languageSelect.append(option);
    state.settings.language = DEFAULT_LANGUAGE;
    return;
  }

  const values = getAvailableLanguagesForCurrentGrade();
  el.languageSelect.innerHTML = "";
  if (!values.length) {
    const changed = state.settings.language !== "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Keine Sprache verfügbar";
    el.languageSelect.append(option);
    state.settings.language = "";
    if (changed) {
      save(STORAGE_KEYS.settings, state.settings);
    }
    return;
  }

  values.forEach((languageCode) => {
    const option = document.createElement("option");
    option.value = languageCode;
    option.textContent = getLanguageDefinition(languageCode).label;
    el.languageSelect.append(option);
  });

  const nextLanguage = values.includes(state.settings.language) ? state.settings.language : values[0];
  const changed = nextLanguage !== state.settings.language;
  state.settings.language = nextLanguage;
  el.languageSelect.value = nextLanguage;
  if (changed) {
    save(STORAGE_KEYS.settings, state.settings);
  }
}

function syncDirectionLabels() {
  const language = getLanguageDefinition(getActiveLanguageCode() || DEFAULT_LANGUAGE);
  el.directionButtons.forEach((button) => {
    if (button.dataset.direction === "en-de") {
      button.textContent = `${language.codeLabel} -> DE`;
    } else {
      button.textContent = `DE -> ${language.codeLabel}`;
    }
  });
}

function getVocabularyForCurrentSelection() {
  const schoolGrade = getCurrentUserSchoolGrade();
  const languageCode = getActiveLanguageCode();
  if (state.auth.role !== "student" || !languageCode) {
    return [];
  }

  return getAllVocabulary().filter(
    (entry) => entry.schoolGrade === schoolGrade && entry.language === languageCode
  );
}

function getEntryUnit(entry) {
  const rawUnit = entry?.unit;
  const unit = typeof rawUnit === "string" ? rawUnit.trim() : "";
  return unit || "Ohne Unit";
}

function refreshUnitFilters() {
  const units = [
    ...new Set(
      getVocabularyForCurrentSelection()
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

function buildLanguageSelectOptions(select, languageValues, activeLanguage) {
  if (!select) {
    return;
  }

  select.innerHTML = "";
  languageValues.forEach((languageCode) => {
    const option = document.createElement("option");
    option.value = languageCode;
    option.textContent = getLanguageDefinition(languageCode).label;
    select.append(option);
  });

  if (languageValues.includes(activeLanguage)) {
    select.value = activeLanguage;
    return;
  }
  if (languageValues[0]) {
    select.value = languageValues[0];
  }
}

function buildQuestion(entry) {
  const prompt = state.settings.direction === "en-de" ? entry.foreign : entry.german;
  const answerDisplay = state.settings.direction === "en-de" ? entry.german : entry.foreign;

  return {
    entry,
    prompt,
    answerDisplay,
    answerVariants: splitVariants(answerDisplay)
  };
}

function getQuestionDirectionLabel() {
  if (state.settings.direction === "en-de") {
    return "Übersetze ins Deutsche";
  }
  const language = getLanguageDefinition(getActiveLanguageCode() || DEFAULT_LANGUAGE);
  return `Übersetze ins ${language.nominalized}`;
}

function getPool(focusMode) {
  const all = getVocabularyForCurrentSelection();
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
  if (state.auth.role !== "student") {
    setFeedback("Lernrunden sind nur im Schülermodus verfügbar.", false);
    return;
  }
  const availableLanguages = getAvailableLanguagesForCurrentGrade();
  if (!availableLanguages.length) {
    setFeedback(
      `Für Klasse ${getCurrentUserSchoolGrade()} sind noch keine Sprachkataloge vorhanden.`,
      false
    );
    return;
  }
  if (!getActiveLanguageCode()) {
    setFeedback("Bitte zuerst eine Sprache auswählen.", false);
    return;
  }
  ensureCurrentWeeklyGoal();
  const pool = getPool(focusMode);
  if (pool.length === 0) {
    setFeedback(
      "Keine passenden Vokabeln gefunden. Prüfe Sprache, Unit-Filter oder importiere neue Daten.",
      false
    );
    return;
  }

  setActiveSection("play");

  const size = Math.min(state.settings.size, pool.length);
  const activeLanguage = getActiveLanguageCode() || DEFAULT_LANGUAGE;
  const activeDirection = state.settings.direction === "de-en" ? "de-en" : "en-de";
  const selectedEntries = shuffle([...pool]).slice(0, size);
  const questions = selectedEntries.map((entry) => buildQuestion(entry));

  state.session = {
    mode: state.settings.mode,
    direction: activeDirection,
    language: sanitizeLanguageCode(activeLanguage, DEFAULT_LANGUAGE),
    unit: state.settings.unit,
    size,
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
  el.questionLabel.textContent = getQuestionDirectionLabel();
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
      .map((entry) => (state.settings.direction === "en-de" ? entry.german : entry.foreign))
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
  const entry = historyModule.recordSession(session);
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

  el.questionLabel.textContent = getQuestionDirectionLabel();
  if (state.auth.role === "student") {
    const availableLanguages = getAvailableLanguagesForCurrentGrade();
    if (!availableLanguages.length) {
      el.questionText.textContent = `Für Klasse ${getCurrentUserSchoolGrade()} sind aktuell keine Sprachkataloge vorhanden.`;
    } else {
      const activeLanguage = getLanguageDefinition(getActiveLanguageCode() || DEFAULT_LANGUAGE).label;
      el.questionText.textContent = `Sprache: ${activeLanguage}. Modus: ${labelMode(state.settings.mode)}. Starte eine neue Runde.`;
    }
  } else {
    el.questionText.textContent = `Modus: ${labelMode(state.settings.mode)}. Starte eine neue Runde.`;
  }
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
    const fallbackDirection = safe.direction === "de-en" ? "de-en" : "en-de";
    const total = Math.max(0, Number(safe.total) || 0);
    const normalizedSize = Math.max(
      1,
      Math.min(50, Math.round(Number(safe.size) || total || 15))
    );
    const normalizedUnit = typeof safe.unit === "string" && safe.unit.trim()
      ? safe.unit.trim().slice(0, 80)
      : "all";
    const next = {
      ...safe,
      direction: fallbackDirection,
      language: sanitizeLanguageCode(safe.language, DEFAULT_LANGUAGE),
      unit: normalizedUnit,
      focus: safe.focus === "mistakes" ? "mistakes" : "all",
      size: normalizedSize,
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
      next.direction !== safe.direction ||
      next.language !== safe.language ||
      next.unit !== safe.unit ||
      next.focus !== safe.focus ||
      next.size !== safe.size ||
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

function touchWeeklyGoal(weeklyGoal) {
  if (!weeklyGoal || typeof weeklyGoal !== "object") {
    return weeklyGoal;
  }
  weeklyGoal.updatedAt = new Date().toISOString();
  return weeklyGoal;
}

function getWeeklyGoalUpdatedMs(weeklyGoal) {
  if (!weeklyGoal || typeof weeklyGoal !== "object") {
    return 0;
  }
  const timestamp = Date.parse(weeklyGoal.updatedAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function resolveWeeklyGoalState(localGoal, serverGoal) {
  if (!serverGoal) {
    return { value: localGoal || null, preferLocal: !!localGoal };
  }

  if (!localGoal) {
    return { value: serverGoal, preferLocal: false };
  }

  const localWeekKey = typeof localGoal.weekKey === "string" ? localGoal.weekKey : "";
  const serverWeekKey = typeof serverGoal.weekKey === "string" ? serverGoal.weekKey : "";
  if (!localWeekKey || !serverWeekKey || localWeekKey !== serverWeekKey) {
    const currentWeekKey = getWeekContext(new Date()).weekKey;
    const localIsCurrent = localWeekKey === currentWeekKey;
    const serverIsCurrent = serverWeekKey === currentWeekKey;

    if (localIsCurrent && !serverIsCurrent) {
      return { value: localGoal, preferLocal: true };
    }
    if (serverIsCurrent && !localIsCurrent) {
      return { value: serverGoal, preferLocal: false };
    }

    const localUpdatedMs = getWeeklyGoalUpdatedMs(localGoal);
    const serverUpdatedMs = getWeeklyGoalUpdatedMs(serverGoal);
    if (localUpdatedMs > serverUpdatedMs) {
      return { value: localGoal, preferLocal: true };
    }

    return { value: serverGoal, preferLocal: false };
  }

  const localUpdatedMs = getWeeklyGoalUpdatedMs(localGoal);
  const serverUpdatedMs = getWeeklyGoalUpdatedMs(serverGoal);
  if (localUpdatedMs > serverUpdatedMs) {
    return { value: localGoal, preferLocal: true };
  }

  if (localUpdatedMs > 0 && serverUpdatedMs === 0) {
    return { value: localGoal, preferLocal: true };
  }

  return { value: serverGoal, preferLocal: false };
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
    state.weeklyGoal = touchWeeklyGoal(createWeeklyGoal(now, targetMinutes));
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
      touchWeeklyGoal(state.weeklyGoal);
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

  touchWeeklyGoal(weeklyGoal);
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
  if (state.auth.role !== "admin") {
    return;
  }
  setActiveAdminSection(state.settings.adminSection, false);
  syncAdminGradeSelectOptions();

  const profiles = Array.isArray(state.auth.adminProfiles) ? state.auth.adminProfiles : [];
  el.adminProfilesList.innerHTML = "";
  if (profiles.length === 0) {
    const item = document.createElement("li");
    item.className = "recent-item";
    item.textContent = "Noch keine Profile angelegt.";
    el.adminProfilesList.append(item);
  } else {
    profiles.forEach((profile) => {
      const item = document.createElement("li");
      item.className = "recent-item";
      const weekUsed = Number(profile?.kpi?.weekUsedMinutes) || 0;
      const weekTarget = Number(profile?.kpi?.weekTargetMinutes) || 0;
      const pinStatus = profile.pinSet === false ? "PIN offen" : "PIN gesetzt";
      const schoolGrade = sanitizeSchoolGrade(profile.schoolGrade, DEFAULT_SCHOOL_GRADE);
      item.innerHTML = `
        <p class="recent-head">${profile.name} · Klasse ${schoolGrade} ${profile.active ? "" : "· (deaktiviert)"}</p>
        <p>Runden: ${Number(profile?.kpi?.rounds) || 0} · XP gesamt: ${Number(profile?.kpi?.totalXp) || 0} · ${pinStatus}</p>
        <p class="recent-sub">Woche: ${weekUsed}/${weekTarget} Min</p>
      `;
      el.adminProfilesList.append(item);
    });
  }

  el.editProfileSelect.innerHTML = "";
  profiles.forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    el.editProfileSelect.append(option);
  });

  if (profiles.length > 0) {
    if (!profiles.some((profile) => profile.id === state.auth.selectedProfileId)) {
      state.auth.selectedProfileId = profiles[0].id;
    }
  } else {
    state.auth.selectedProfileId = "";
    state.auth.viewedProfileHistory = {
      profileId: "",
      profileName: "",
      entries: []
    };
  }

  syncEditProfileFields();
  el.adminBackupPinInput.value = "";
  el.adminBackupPinInput.placeholder = state.adminConfig.backupPinSet ? "Bereits gesetzt" : "Neue PIN";
  renderAdminProfileHistory();
}

function syncEditProfileFields() {
  if (state.auth.role !== "admin") {
    return;
  }
  const selectedId = el.editProfileSelect.value || state.auth.selectedProfileId || "";
  state.auth.selectedProfileId = selectedId;
  if (el.viewProfileHistoryBtn) {
    el.viewProfileHistoryBtn.disabled = !selectedId;
  }
  if (el.resetProfileProgressBtn) {
    el.resetProfileProgressBtn.disabled = !selectedId;
  }
  const profile = state.auth.adminProfiles.find((item) => item.id === selectedId);
  if (!profile) {
    el.editProfileNameInput.value = "";
    el.editProfilePinInput.value = "";
    el.editProfileGradeSelect.value = String(DEFAULT_SCHOOL_GRADE);
    el.editProfileGoalInput.value = String(DEFAULT_TARGET_MINUTES);
    el.editProfileActiveInput.checked = true;
    renderAdminProfileHistory();
    return;
  }

  const targetMinutes = Number(profile?.kpi?.weekTargetMinutes) || DEFAULT_TARGET_MINUTES;
  el.editProfileNameInput.value = profile.name || "";
  el.editProfileGradeSelect.value = String(
    sanitizeSchoolGrade(profile.schoolGrade, DEFAULT_SCHOOL_GRADE)
  );
  el.editProfilePinInput.value = "";
  el.editProfileGoalInput.value = String(targetMinutes);
  el.editProfileActiveInput.checked = profile.active !== false;
  renderAdminProfileHistory();
}

async function handleCreateProfile() {
  if (state.auth.role !== "admin") {
    return;
  }

  const name = el.newProfileNameInput.value.trim();
  if (!name) {
    setAdminSettingsFeedback("Bitte Namen für das Profil eingeben.", false);
    return;
  }
  const schoolGrade = sanitizeSchoolGrade(el.newProfileGradeSelect.value, DEFAULT_SCHOOL_GRADE);

  const response = await apiRequest("/api/admin/profiles", {
    method: "POST",
    body: {
      name,
      schoolGrade
    }
  });
  if (!response.ok) {
    setAdminSettingsFeedback(response.error || "Profil konnte nicht angelegt werden.", false);
    return;
  }

  el.newProfileNameInput.value = "";
  el.newProfileGradeSelect.value = String(DEFAULT_SCHOOL_GRADE);
  state.auth.selectedProfileId = response?.profile?.id || state.auth.selectedProfileId;
  setActiveAdminSection("profiles");
  await refreshAdminProfiles();
  setAdminSettingsFeedback("Profil angelegt. PIN wird beim ersten Login gesetzt.", true);
}

async function handleSaveProfile() {
  if (state.auth.role !== "admin") {
    return;
  }

  const profileId = state.auth.selectedProfileId;
  if (!profileId) {
    setAdminSettingsFeedback("Bitte Profil auswählen.", false);
    return;
  }

  const payload = {
    name: el.editProfileNameInput.value.trim(),
    active: !!el.editProfileActiveInput.checked,
    schoolGrade: sanitizeSchoolGrade(el.editProfileGradeSelect.value, DEFAULT_SCHOOL_GRADE)
  };
  if (!payload.name) {
    setAdminSettingsFeedback("Profilname darf nicht leer sein.", false);
    return;
  }

  const pin = el.editProfilePinInput.value.trim();
  if (pin) {
    if (!/^\d{4,6}$/.test(pin)) {
      setAdminSettingsFeedback("Neue PIN muss aus 4-6 Ziffern bestehen.", false);
      return;
    }
    payload.pin = pin;
  }

  const response = await apiRequest(`/api/admin/profiles/${encodeURIComponent(profileId)}`, {
    method: "PUT",
    body: payload
  });
  if (!response.ok) {
    setAdminSettingsFeedback(response.error || "Profil konnte nicht gespeichert werden.", false);
    return;
  }

  el.editProfilePinInput.value = "";
  await refreshAdminProfiles();
  setAdminSettingsFeedback("Profil gespeichert.", true);
}

async function handleSaveProfileGoal() {
  if (state.auth.role !== "admin") {
    return;
  }

  const profileId = state.auth.selectedProfileId;
  if (!profileId) {
    setAdminSettingsFeedback("Bitte Profil auswählen.", false);
    return;
  }

  const targetMinutes = sanitizeTargetMinutes(el.editProfileGoalInput.value, DEFAULT_TARGET_MINUTES);
  const response = await apiRequest(`/api/admin/profiles/${encodeURIComponent(profileId)}/goal`, {
    method: "PUT",
    body: {
      targetMinutes
    }
  });
  if (!response.ok) {
    setAdminSettingsFeedback(response.error || "Wochenziel konnte nicht gespeichert werden.", false);
    return;
  }

  await refreshAdminProfiles();
  setAdminSettingsFeedback(`Wochenziel gespeichert: ${targetMinutes} Minuten.`, true);
}

async function handleResetProfilePin() {
  if (state.auth.role !== "admin") {
    return;
  }

  const profileId = state.auth.selectedProfileId;
  if (!profileId) {
    setAdminSettingsFeedback("Bitte Profil auswählen.", false);
    return;
  }

  const profile = state.auth.adminProfiles.find((item) => item.id === profileId);
  const profileName = profile?.name || "dieses Profil";
  const confirmed = window.confirm(
    `PIN für ${profileName} zurücksetzen? Beim nächsten Login muss eine neue PIN festgelegt werden.`
  );
  if (!confirmed) {
    return;
  }

  const response = await apiRequest(`/api/admin/profiles/${encodeURIComponent(profileId)}/reset-pin`, {
    method: "POST"
  });
  if (!response.ok) {
    setAdminSettingsFeedback(response.error || "PIN konnte nicht zurückgesetzt werden.", false);
    return;
  }

  await refreshAdminProfiles();
  setAdminSettingsFeedback(`PIN für ${profileName} wurde zurückgesetzt.`, true);
}

async function handleResetProfileProgress() {
  if (state.auth.role !== "admin") {
    return;
  }

  const profileId = state.auth.selectedProfileId;
  if (!profileId) {
    setAdminSettingsFeedback("Bitte Profil auswählen.", false);
    return;
  }

  const profile = state.auth.adminProfiles.find((item) => item.id === profileId);
  const profileName = profile?.name || "dieses Profil";
  const confirmed = window.confirm(
    `Fortschritt für ${profileName} zurücksetzen? Verlauf, Fehler, XP und Wochenstatus werden gelöscht.`
  );
  if (!confirmed) {
    return;
  }

  const response = await apiRequest(
    `/api/admin/profiles/${encodeURIComponent(profileId)}/reset-progress`,
    { method: "POST" }
  );
  if (!response.ok) {
    setAdminSettingsFeedback(
      response.error || "Fortschritt konnte nicht zurückgesetzt werden.",
      false
    );
    return;
  }

  state.auth.viewedProfileHistory = {
    profileId: "",
    profileName: "",
    entries: []
  };
  await refreshAdminProfiles();
  setAdminSettingsFeedback(`Fortschritt für ${profileName} wurde zurückgesetzt.`, true);
}

async function handleViewProfileHistory() {
  if (state.auth.role !== "admin") {
    return;
  }

  const profileId = state.auth.selectedProfileId;
  if (!profileId) {
    setAdminSettingsFeedback("Bitte Profil auswählen.", false);
    return;
  }

  const response = await apiRequest(
    `/api/admin/profiles/${encodeURIComponent(profileId)}/history`,
    { method: "GET" }
  );
  if (!response.ok) {
    setAdminSettingsFeedback(response.error || "Verlauf konnte nicht geladen werden.", false);
    return;
  }

  const profileName = response?.profile?.name || "Profil";
  state.auth.viewedProfileHistory = {
    profileId,
    profileName,
    entries: Array.isArray(response.history) ? response.history : []
  };
  renderAdminProfileHistory();
  setAdminSettingsFeedback(`Verlauf für ${profileName} geladen.`, true);
}

async function handleSaveBackupPin() {
  if (state.auth.role !== "admin") {
    return;
  }

  const value = el.adminBackupPinInput.value.trim();
  if (value.length < 4) {
    setAdminSettingsFeedback("Backup-PIN muss mindestens 4 Zeichen haben.", false);
    return;
  }

  const response = await apiRequest("/api/admin/settings", {
    method: "PUT",
    body: {
      backupPin: value
    }
  });
  if (!response.ok) {
    setAdminSettingsFeedback(response.error || "Backup-PIN konnte nicht gespeichert werden.", false);
    return;
  }

  state.adminConfig.backupPinSet = true;
  el.adminBackupPinInput.value = "";
  setAdminSettingsFeedback("Backup-PIN gespeichert.", true);
}

function renderAdminProfileHistory() {
  if (!el.adminProfileHistoryList || !el.adminProfileHistoryTitle || !el.adminProfileHistoryGrid) {
    return;
  }

  const selectedId = state.auth.selectedProfileId || "";
  const viewed = state.auth.viewedProfileHistory || {
    profileId: "",
    profileName: "",
    entries: []
  };
  const selectedProfile = state.auth.adminProfiles.find((item) => item.id === selectedId) || null;
  const selectedName = selectedProfile?.name || "Profil";

  el.adminProfileHistoryTitle.textContent = `Verlauf · ${selectedName}`;
  el.adminProfileHistoryGrid.innerHTML = "";
  el.adminProfileHistoryList.innerHTML = "";

  if (!selectedId) {
    renderAdminHistorySummaryCards([]);
    const item = document.createElement("li");
    item.className = "recent-item";
    item.textContent = "Bitte zuerst ein Profil auswählen.";
    el.adminProfileHistoryList.append(item);
    return;
  }

  if (viewed.profileId !== selectedId) {
    renderAdminHistorySummaryCards([]);
    const item = document.createElement("li");
    item.className = "recent-item";
    item.textContent = "Klicke auf „Verlauf anzeigen“, um die letzten Runden zu laden.";
    el.adminProfileHistoryList.append(item);
    return;
  }

  const entries = Array.isArray(viewed.entries) ? viewed.entries : [];
  const normalizedRuns = entries.map((entry) => normalizeAdminHistoryRun(entry));
  renderAdminHistorySummaryCards(normalizedRuns);
  if (!entries.length) {
    const item = document.createElement("li");
    item.className = "recent-item";
    item.textContent = "Noch keine Runden vorhanden.";
    el.adminProfileHistoryList.append(item);
    return;
  }

  normalizedRuns.slice(0, 20).forEach((run) => {
    const item = document.createElement("li");
    item.className = "recent-item";

    const head = document.createElement("p");
    head.className = "recent-head";
    head.textContent = `${formatAdminRunDate(run.date)} · ${labelMode(run.mode)} · ${Math.max(
      0,
      Number(run.correct) || 0
    )}/${Math.max(0, Number(run.total) || 0)} richtig`;

    const details = document.createElement("p");
    details.className = "recent-sub";
    details.textContent = `Richtung: ${formatAdminHistoryDirection(run.direction, run.language)} · Punkte: ${Math.max(
      0,
      Number(run.points) || 0
    )} · Zeit: ${formatRunDuration(run.durationSeconds)}`;

    const options = document.createElement("p");
    options.className = "recent-sub";
    options.textContent = `Optionen: ${formatAdminHistoryOptions(run)}`;

    item.append(head, details, options);
    el.adminProfileHistoryList.append(item);
  });
}

function renderAdminHistorySummaryCards(runs) {
  if (!el.adminProfileHistoryGrid) {
    return;
  }
  el.adminProfileHistoryGrid.innerHTML = "";

  if (!Array.isArray(runs) || runs.length === 0) {
    const box = document.createElement("article");
    box.className = "stat-box";
    box.innerHTML = `<p class="k">Verlauf</p><p class="v">Noch keine Runde</p>`;
    el.adminProfileHistoryGrid.append(box);
    return;
  }

  const rounds = runs.length;
  const avgPercent = Math.round(
    runs.reduce((sum, item) => sum + Math.max(0, Number(item.percent) || 0), 0) / rounds
  );
  const avgGrade = (
    runs.reduce((sum, item) => sum + Math.max(1, Math.min(6, Number(item.grade) || 6)), 0) / rounds
  ).toFixed(2);
  const bestRun = Math.max(0, ...runs.map((item) => Math.max(0, Number(item.correct) || 0)));
  const totalAnswered = runs.reduce((sum, item) => sum + Math.max(0, Number(item.total) || 0), 0);
  const totalDurationSeconds = runs.reduce(
    (sum, item) => sum + Math.max(0, Number(item.durationSeconds) || 0),
    0
  );

  const cards = [
    ["Runden", String(rounds)],
    ["Ø Trefferquote", `${avgPercent}%`],
    ["Ø Note", avgGrade],
    ["Bester Durchlauf", `${bestRun} richtig`],
    ["Antworten gesamt", String(totalAnswered)],
    ["Trainingszeit", formatRunDuration(totalDurationSeconds)]
  ];

  cards.forEach(([key, value]) => {
    const box = document.createElement("article");
    box.className = "stat-box";
    box.innerHTML = `<p class="k">${key}</p><p class="v">${value}</p>`;
    el.adminProfileHistoryGrid.append(box);
  });
}

function normalizeAdminHistoryRun(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  const total = Math.max(0, Number(source.total) || 0);
  const correct = Math.max(0, Math.min(total, Number(source.correct) || 0));
  const wrong = Math.max(0, Number(source.wrong) || Math.max(0, total - correct));
  const computedPercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const percent = Number.isFinite(Number(source.percent))
    ? Math.max(0, Math.min(100, Math.round(Number(source.percent))))
    : computedPercent;
  const gradeRaw = Number(source.grade);
  const grade = Number.isFinite(gradeRaw) && gradeRaw >= 1 && gradeRaw <= 6
    ? Math.round(gradeRaw)
    : gradeFromPercent(percent);

  return {
    date: typeof source.date === "string" ? source.date : "",
    mode: source.mode === "learn" || source.mode === "quiz" || source.mode === "test" ? source.mode : "test",
    direction: source.direction === "de-en" ? "de-en" : "en-de",
    language: sanitizeLanguageCode(source.language, DEFAULT_LANGUAGE),
    unit: typeof source.unit === "string" && source.unit.trim() ? source.unit.trim().slice(0, 80) : "all",
    focus: source.focus === "mistakes" ? "mistakes" : "all",
    size: Math.max(1, Math.min(50, Math.round(Number(source.size) || total || 15))),
    total,
    correct,
    wrong,
    points: Math.max(0, Number(source.points) || 0),
    durationSeconds: Math.max(0, Math.round(Number(source.durationSeconds) || 0)),
    percent,
    grade
  };
}

function setAdminSettingsFeedback(text, ok) {
  el.adminSettingsFeedback.textContent = text;
  el.adminSettingsFeedback.className = `feedback ${ok ? "ok" : "err"}`;
}

function save(key, value) {
  if (state.auth.role === "student") {
    scheduleServerPush();
    return;
  }
  if (state.auth.role === "admin" && key === STORAGE_KEYS.customVocabulary) {
    remoteSync.pendingSharedPush = true;
    scheduleServerPush();
  }
}

function resetStateForLoggedOut() {
  state.customVocabulary = [];
  state.history = [];
  state.mistakes = {};
  state.settings = { ...DEFAULT_SETTINGS };
  state.adminConfig = { ...DEFAULT_ADMIN_CONFIG };
  state.weeklyGoal = null;
  state.session = null;
  state.auth.token = "";
  state.auth.role = "";
  state.auth.user = null;
  state.auth.adminProfiles = [];
  state.auth.selectedProfileId = "";
  state.auth.pinSetupProfileId = "";
  state.auth.viewedProfileHistory = {
    profileId: "",
    profileName: "",
    entries: []
  };
}

function showLoggedOutState() {
  resetStateForLoggedOut();
  applyRoleView();
  applySettingsToControls();
  refreshUnitFilters();
  syncLoginFlowForSelectedProfile();
  setActiveSection("start");
  historyModule.renderHistory();
  renderIdleState();
  renderAdminState();
  renderStorageStatus();
  setAuthFeedback("Bitte anmelden.", true);
}

async function loadLoginProfiles() {
  try {
    const response = await fetch("/api/auth/profiles", {
      method: "GET",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      state.auth.profiles = [];
      renderLoginProfiles();
      setRemoteStatus(false, "Server nicht erreichbar.");
      return;
    }

    const payload = await response.json();
    state.auth.profiles = Array.isArray(payload?.profiles) ? payload.profiles : [];
    renderLoginProfiles();
    remoteSync.available = true;
    remoteSync.attempted = true;
    remoteSync.status = "Server erreichbar. Login erforderlich.";
    renderStorageStatus();
  } catch {
    state.auth.profiles = [];
    renderLoginProfiles();
    setRemoteStatus(false, "Server nicht erreichbar.");
  }
}

function renderLoginProfiles() {
  el.loginProfileSelect.innerHTML = "";
  if (state.auth.profiles.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Keine Profile verfügbar";
    el.loginProfileSelect.append(option);
    syncLoginFlowForSelectedProfile();
    return;
  }
  state.auth.profiles.forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    const schoolGrade = sanitizeSchoolGrade(profile.schoolGrade, DEFAULT_SCHOOL_GRADE);
    const suffix = profile.pinSet === false ? " · PIN festlegen" : "";
    option.textContent = `${profile.name} · Klasse ${schoolGrade}${suffix}`;
    el.loginProfileSelect.append(option);
  });
  syncLoginFlowForSelectedProfile();
}

function getSelectedLoginProfile() {
  const profileId = el.loginProfileSelect.value;
  if (!profileId) {
    return null;
  }
  return state.auth.profiles.find((profile) => profile.id === profileId) || null;
}

function syncLoginFlowForSelectedProfile() {
  const profile = getSelectedLoginProfile();
  const requiresSetup = Boolean(profile && profile.pinSet === false);
  state.auth.pinSetupProfileId = requiresSetup ? profile.id : "";

  el.loginPinBlock.classList.toggle("hidden", requiresSetup);
  el.pinSetupBlock.classList.toggle("hidden", !requiresSetup);

  if (requiresSetup) {
    el.loginPinInput.value = "";
    el.setupPinInput.focus();
    return;
  }
  el.setupPinInput.value = "";
  el.setupPinConfirmInput.value = "";
}

function cancelInitialPinSetup() {
  el.setupPinInput.value = "";
  el.setupPinConfirmInput.value = "";
  const profile = getSelectedLoginProfile();
  if (profile && profile.pinSet === false) {
    setAuthFeedback("Für dieses Profil muss zuerst eine PIN festgelegt werden.", false);
    return;
  }
  state.auth.pinSetupProfileId = "";
  syncLoginFlowForSelectedProfile();
  setAuthFeedback("PIN-Einrichtung abgebrochen.", true);
}

async function handleStudentLogin() {
  const profile = getSelectedLoginProfile();
  const profileId = profile?.id || "";
  const pin = el.loginPinInput.value.trim();
  if (!profileId) {
    setAuthFeedback("Bitte Profil auswählen.", false);
    return;
  }
  if (profile && profile.pinSet === false) {
    state.auth.pinSetupProfileId = profile.id;
    syncLoginFlowForSelectedProfile();
    setAuthFeedback("Für dieses Profil bitte zuerst eine PIN festlegen.", false);
    return;
  }
  if (!/^\d{4,6}$/.test(pin)) {
    setAuthFeedback("PIN muss aus 4-6 Ziffern bestehen.", false);
    return;
  }

  const result = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { profileId, pin }
  }, false);
  if (!result.ok) {
    if (result.error === "pin_setup_required") {
      state.auth.pinSetupProfileId = profileId;
      syncLoginFlowForSelectedProfile();
      setAuthFeedback("Für dieses Profil bitte zuerst eine PIN festlegen.", false);
      return;
    }
    setAuthFeedback(getAuthErrorMessage(result.error, "Anmeldung fehlgeschlagen."), false);
    return;
  }

  state.auth.token = result.token;
  state.auth.role = "student";
  state.auth.user = result.user
    ? {
        ...result.user,
        schoolGrade: sanitizeSchoolGrade(result.user.schoolGrade, DEFAULT_SCHOOL_GRADE)
      }
    : null;
  el.loginPinInput.value = "";
  await loadStateForRole();
  if (result.warning) {
    setAuthFeedback(result.warning, true);
  } else {
    setAuthFeedback("", true);
  }
}

async function handleInitialPinSetup() {
  const profile = getSelectedLoginProfile();
  const profileId = profile?.id || "";
  if (!profileId) {
    setAuthFeedback("Bitte Profil auswählen.", false);
    return;
  }

  const pin = el.setupPinInput.value.trim();
  const pinConfirm = el.setupPinConfirmInput.value.trim();
  if (!/^\d{4,6}$/.test(pin)) {
    setAuthFeedback("Neue PIN muss aus 4-6 Ziffern bestehen.", false);
    return;
  }
  if (!/^\d{4,6}$/.test(pinConfirm)) {
    setAuthFeedback("Bitte PIN-Bestätigung mit 4-6 Ziffern eingeben.", false);
    return;
  }
  if (pin !== pinConfirm) {
    setAuthFeedback("PIN und Bestätigung stimmen nicht überein.", false);
    return;
  }

  const result = await apiRequest("/api/auth/initialize-pin", {
    method: "POST",
    body: { profileId, pin, pinConfirm }
  }, false);
  if (!result.ok) {
    if (result.error === "pin_already_set") {
      await loadLoginProfiles();
      syncLoginFlowForSelectedProfile();
      setAuthFeedback("PIN wurde bereits gesetzt. Bitte normal anmelden.", false);
      return;
    }
    setAuthFeedback(getAuthErrorMessage(result.error, "PIN konnte nicht gesetzt werden."), false);
    return;
  }

  state.auth.token = result.token;
  state.auth.role = "student";
  state.auth.user = result.user
    ? {
        ...result.user,
        schoolGrade: sanitizeSchoolGrade(result.user.schoolGrade, DEFAULT_SCHOOL_GRADE)
      }
    : null;
  state.auth.pinSetupProfileId = "";
  el.setupPinInput.value = "";
  el.setupPinConfirmInput.value = "";
  await loadStateForRole();
  setAuthFeedback("PIN gesetzt und Anmeldung erfolgreich.", true);
}

async function handleAdminLogin() {
  const code = el.adminLoginCodeInput.value.trim();
  if (!code) {
    setAuthFeedback("Bitte Admin-Code eingeben.", false);
    return;
  }

  const result = await apiRequest("/api/auth/admin-login", {
    method: "POST",
    body: { code }
  }, false);
  if (!result.ok) {
    setAuthFeedback(getAuthErrorMessage(result.error, "Admin-Login fehlgeschlagen."), false);
    return;
  }

  state.auth.token = result.token;
  state.auth.role = "admin";
  state.auth.user = { id: "admin", name: "Eltern/Admin", schoolGrade: null };
  el.adminLoginCodeInput.value = "";
  await loadStateForRole();
  setAuthFeedback("", true);
}

async function handleLogout() {
  if (state.auth.token) {
    await apiRequest("/api/auth/logout", { method: "POST" }, true);
  }
  await loadLoginProfiles();
  showLoggedOutState();
}

async function loadStateForRole() {
  if (state.auth.role === "student") {
    const result = await apiRequest("/api/me/state", { method: "GET" });
    if (!result.ok) {
      await forceLogoutWithReason(result.error || "Sitzung ungültig.");
      return;
    }
    if (result.user && typeof result.user === "object") {
      state.auth.user = {
        ...state.auth.user,
        ...result.user,
        schoolGrade: sanitizeSchoolGrade(result.user.schoolGrade, DEFAULT_SCHOOL_GRADE)
      };
    }
    applyStudentState(result.state || {});
    normalizeHistoryEntries();
    ensureCurrentWeeklyGoal();
  } else if (state.auth.role === "admin") {
    state.history = [];
    state.mistakes = {};
    state.weeklyGoal = null;
    const shared = await apiRequest("/api/admin/shared", { method: "GET" });
    if (!shared.ok) {
      await forceLogoutWithReason(shared.error || "Admin-Daten konnten nicht geladen werden.");
      return;
    }
    state.customVocabulary = normalizeVocabularyList(shared.customVocabulary, {
      fallbackLanguage: DEFAULT_LANGUAGE,
      fallbackSchoolGrade: DEFAULT_SCHOOL_GRADE,
      idFallbackPrefix: "custom"
    });
    state.adminConfig = { ...DEFAULT_ADMIN_CONFIG, ...(shared.admin || {}) };
    await refreshAdminProfiles();
  }

  remoteSync.available = true;
  remoteSync.attempted = true;
  remoteSync.status = "Serverspeicher aktiv.";
  applyRoleView();
  applySettingsToControls();
  refreshUnitFilters();
  historyModule.renderHistory();
  renderWeeklyGoalHint();
  renderIdleState();
  updateGamificationWidgets(0);
  renderAdminState();
  setActiveSection(getDefaultSectionForRole());
  startRemoteReconnectLoop();
}

function applyStudentState(serverState) {
  const has = (key) => Object.prototype.hasOwnProperty.call(serverState, key);
  if (has(STORAGE_KEYS.history)) {
    state.history = Array.isArray(serverState[STORAGE_KEYS.history]) ? serverState[STORAGE_KEYS.history] : [];
  }
  if (has(STORAGE_KEYS.mistakes)) {
    const mistakes = serverState[STORAGE_KEYS.mistakes];
    state.mistakes = mistakes && typeof mistakes === "object" ? mistakes : {};
  }
  if (has(STORAGE_KEYS.customVocabulary)) {
    state.customVocabulary = normalizeVocabularyList(serverState[STORAGE_KEYS.customVocabulary], {
      fallbackLanguage: DEFAULT_LANGUAGE,
      fallbackSchoolGrade: DEFAULT_SCHOOL_GRADE,
      idFallbackPrefix: "custom"
    });
  }
  if (has(STORAGE_KEYS.settings)) {
    state.settings = { ...DEFAULT_SETTINGS, ...(serverState[STORAGE_KEYS.settings] || {}) };
    state.settings.language = sanitizeLanguageCode(state.settings.language, DEFAULT_LANGUAGE);
    state.settings.adminSection = sanitizeAdminSection(state.settings.adminSection);
    state.settings.importLanguage = sanitizeLanguageCode(
      state.settings.importLanguage,
      DEFAULT_LANGUAGE
    );
    state.settings.importSchoolGrade = sanitizeSchoolGrade(
      state.settings.importSchoolGrade,
      DEFAULT_SCHOOL_GRADE
    );
  }
  if (has(STORAGE_KEYS.weeklyGoal)) {
    state.weeklyGoal = serverState[STORAGE_KEYS.weeklyGoal] || null;
  }
}

async function refreshAdminProfiles() {
  if (state.auth.role !== "admin") {
    return;
  }
  const response = await apiRequest("/api/admin/profiles", { method: "GET" });
  if (!response.ok) {
    setAdminSettingsFeedback(response.error || "Profile konnten nicht geladen werden.", false);
    return;
  }
  state.auth.adminProfiles = Array.isArray(response.profiles) ? response.profiles : [];
  if (!state.auth.selectedProfileId && state.auth.adminProfiles[0]) {
    state.auth.selectedProfileId = state.auth.adminProfiles[0].id;
  }
  renderAdminState();
}

function getAllowedSections() {
  if (state.auth.role === "student") {
    return ["start", "play", "history"];
  }
  if (state.auth.role === "admin") {
    return ["settings", "admin"];
  }
  return [];
}

function getDefaultSectionForRole() {
  if (state.auth.role === "student") {
    return "start";
  }
  if (state.auth.role === "admin") {
    return "admin";
  }
  return "start";
}

function applyRoleView() {
  const loggedIn = !!state.auth.token;
  el.authGate.classList.toggle("hidden", loggedIn);
  el.appTop.classList.toggle("hidden", !loggedIn);
  el.appMain.classList.toggle("hidden", !loggedIn);
  el.tabbar.classList.toggle("hidden", !loggedIn);
  el.currentUserBadge.classList.toggle("hidden", !loggedIn);
  el.logoutBtn.classList.toggle("hidden", !loggedIn);
  if (loggedIn && state.auth.user) {
    const roleLabel = state.auth.role === "admin" ? "Admin" : "Schüler";
    if (state.auth.role === "student") {
      const schoolGrade = sanitizeSchoolGrade(state.auth.user.schoolGrade, DEFAULT_SCHOOL_GRADE);
      el.currentUserBadge.textContent = `${roleLabel}: ${state.auth.user.name} · Klasse ${schoolGrade}`;
    } else {
      el.currentUserBadge.textContent = `${roleLabel}: ${state.auth.user.name}`;
    }
  } else {
    el.currentUserBadge.textContent = "-";
  }
  updateHeaderContextBadge();

  const allowed = getAllowedSections();
  el.sectionTabs.forEach((button) => {
    button.classList.toggle("hidden", !allowed.includes(button.dataset.sectionTarget));
  });
  const visibleTabCount = Math.max(1, allowed.length);
  el.tabbar.style.setProperty("--tab-count", String(visibleTabCount));
}

function updateHeaderContextBadge() {
  if (!el.appContextBadge) {
    return;
  }

  if (state.auth.role === "student") {
    const schoolGrade = sanitizeSchoolGrade(state.auth.user?.schoolGrade, DEFAULT_SCHOOL_GRADE);
    const languageCode = getActiveLanguageCode();
    const language = languageCode ? getLanguageDefinition(languageCode).label : "Keine Sprache";
    el.appContextBadge.textContent = `Klasse ${schoolGrade} · ${language}`;
    return;
  }

  if (state.auth.role === "admin") {
    el.appContextBadge.textContent = "Admin · Verwaltung";
    return;
  }

  el.appContextBadge.textContent = "Klasse 6 · Englisch";
}

function setAuthFeedback(text, ok) {
  el.authFeedback.textContent = text;
  el.authFeedback.className = `feedback ${ok ? "ok" : "err"}`;
}

function getAuthErrorMessage(code, fallback) {
  const map = {
    unauthorized: "Sitzung ungültig. Bitte neu anmelden.",
    login_failed: "Anmeldung fehlgeschlagen. Bitte Daten prüfen.",
    invalid_payload: "Eingaben sind unvollständig oder ungültig.",
    pin_setup_required: "Für dieses Profil muss zuerst eine PIN vergeben werden.",
    pin_mismatch: "PIN und Bestätigung stimmen nicht überein.",
    pin_already_set: "PIN wurde bereits gesetzt. Bitte normal anmelden.",
    profile_not_found: "Profil nicht gefunden oder nicht mehr aktiv.",
    profile_inactive: "Profil ist deaktiviert."
  };
  return map[code] || fallback;
}

async function forceLogoutWithReason(reason) {
  resetStateForLoggedOut();
  applyRoleView();
  applySettingsToControls();
  refreshUnitFilters();
  historyModule.renderHistory();
  renderIdleState();
  renderAdminState();
  remoteSync.available = false;
  remoteSync.status = "Sitzung beendet.";
  renderStorageStatus();
  await loadLoginProfiles();
  setAuthFeedback(reason || "Bitte erneut anmelden.", false);
}

async function apiRequest(path, options = {}, requireAuth = true) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (requireAuth) {
    if (!state.auth.token) {
      return { ok: false, error: "Nicht angemeldet." };
    }
    headers.set("Authorization", `Bearer ${state.auth.token}`);
  }
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(path, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    if (!response.ok) {
      if (response.status === 401 && requireAuth) {
        await forceLogoutWithReason("Sitzung abgelaufen. Bitte neu anmelden.");
      }
      return { ok: false, error: payload?.error || "Anfrage fehlgeschlagen.", status: response.status };
    }
    return payload && typeof payload === "object" ? payload : { ok: true };
  } catch {
    return { ok: false, error: "Server nicht erreichbar." };
  } finally {
    clearTimeout(timeout);
  }
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
  const login = state.auth.role
    ? `Angemeldet: ${state.auth.role === "admin" ? "Admin" : "Schüler"}`
    : "Nicht angemeldet";
  const prefix = remoteSync.available ? "Speicher: Server" : "Speicher: Offline";
  const text = remoteSync.status || (remoteSync.available ? "Serverspeicher aktiv." : "Server nicht erreichbar.");
  el.storageStatus.textContent = `${prefix} · ${login} · ${text}`;
}

async function hydrateVersionInfo() {
  if (!el.appVersion) {
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch("/api/version", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error("version_fetch_failed");
    }
    const payload = await response.json();
    const version = typeof payload?.version === "string" && payload.version.trim()
      ? payload.version.trim()
      : "unknown";
    el.appVersion.textContent = `Version: ${version}`;
  } catch {
    el.appVersion.textContent = "Version: unbekannt";
  } finally {
    clearTimeout(timeout);
  }
}

function buildMeStatePayload() {
  return {
    [STORAGE_KEYS.history]: state.history,
    [STORAGE_KEYS.mistakes]: state.mistakes,
    [STORAGE_KEYS.settings]: state.settings,
    [STORAGE_KEYS.weeklyGoal]: state.weeklyGoal
  };
}

function buildSharedPayload() {
  return {
    [STORAGE_KEYS.customVocabulary]: state.customVocabulary
  };
}

function startRemoteReconnectLoop() {
  if (reconnectIntervalId) {
    return;
  }
  reconnectIntervalId = window.setInterval(() => {
    if (!state.auth.token) {
      return;
    }
    if (remoteSync.pushInFlight || remoteSync.connectInFlight) {
      return;
    }
    if (remoteSync.pendingPush || remoteSync.pendingSharedPush || !remoteSync.available) {
      void recoverRemoteAndPush();
    }
  }, 20000);
}

function scheduleServerPush() {
  if (!state.auth.token) {
    return;
  }
  if (state.auth.role === "student") {
    remoteSync.pendingPush = true;
  } else if (state.auth.role === "admin") {
    remoteSync.pendingSharedPush = true;
  } else {
    return;
  }

  if (remoteSync.timerId) {
    clearTimeout(remoteSync.timerId);
  }
  remoteSync.timerId = setTimeout(() => {
    remoteSync.timerId = null;
    void pushStateToServer();
  }, 700);
}

async function pushStateToServer() {
  if (!state.auth.token || remoteSync.pushInFlight) {
    return;
  }
  if (!remoteSync.pendingPush && !remoteSync.pendingSharedPush) {
    return;
  }

  remoteSync.pushInFlight = true;
  const shouldPushMe = remoteSync.pendingPush;
  const shouldPushShared = remoteSync.pendingSharedPush;
  remoteSync.pendingPush = false;
  remoteSync.pendingSharedPush = false;
  try {
    if (shouldPushMe && state.auth.role === "student") {
      const meResult = await apiRequest("/api/me/state", {
        method: "PUT",
        body: buildMeStatePayload()
      });
      if (!meResult.ok) {
        throw new Error(meResult.error || "student_state_push_failed");
      }
    }

    if (shouldPushShared && state.auth.role === "admin") {
      const sharedResult = await apiRequest("/api/admin/shared", {
        method: "PUT",
        body: buildSharedPayload()
      });
      if (!sharedResult.ok) {
        throw new Error(sharedResult.error || "shared_state_push_failed");
      }
    }

    remoteSync.available = true;
    remoteSync.status = `Synchronisiert: ${new Date().toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
    renderStorageStatus();
  } catch (error) {
    remoteSync.available = false;
    remoteSync.status = `Sync fehlgeschlagen: ${error.message || "Serverfehler"}`;
    if (shouldPushMe) {
      remoteSync.pendingPush = true;
    }
    if (shouldPushShared) {
      remoteSync.pendingSharedPush = true;
    }
    renderStorageStatus();
  } finally {
    remoteSync.pushInFlight = false;
  }
}

async function recoverRemoteAndPush() {
  if (!state.auth.token || remoteSync.connectInFlight) {
    return;
  }
  remoteSync.connectInFlight = true;
  try {
    const sessionState = await apiRequest("/api/auth/session", { method: "GET" });
    if (!sessionState.ok) {
      setRemoteStatus(false, "Sitzung nicht verfügbar.");
      return;
    }

    setRemoteStatus(true, "Server wieder erreichbar. Synchronisiere …");
    await pushStateToServer();
  } finally {
    remoteSync.connectInFlight = false;
  }
}

function updateGamificationWidgets(extraSessionPoints) {
  if (state.auth.role !== "student") {
    el.levelBadge.textContent = "Admin-Modus";
    el.xpBadge.textContent = "XP -";
    el.playLevelBadge.textContent = "Admin";
    el.xpBarFill.style.width = "0%";
    el.nextLevelText.textContent = "Profile und Vorgaben verwalten.";
    el.motivationLine.textContent = "Admin ist aktiv. Schüler melden sich mit PIN an.";
    return;
  }

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

function formatAdminRunDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unbekannt";
  }
  return parsed.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatRunDuration(valueSeconds) {
  const seconds = Math.max(0, Math.round(Number(valueSeconds) || 0));
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes} min`;
  }
  return `${hours} h ${minutes} min`;
}

function formatAdminHistoryDirection(direction, languageCode) {
  const language = getLanguageDefinition(sanitizeLanguageCode(languageCode, DEFAULT_LANGUAGE));
  if (direction === "de-en") {
    return `DE -> ${language.codeLabel}`;
  }
  return `${language.codeLabel} -> DE`;
}

function formatAdminHistoryOptions(entry) {
  const unitValue = typeof entry?.unit === "string" ? entry.unit.trim() : "";
  const unit = unitValue && unitValue !== "all" ? unitValue : "Alle Units";
  const focus = entry?.focus === "mistakes" ? "Fehlerfokus" : "Alle Vokabeln";
  const size = Math.max(1, Math.round(Number(entry?.size) || Number(entry?.total) || 15));
  return `Unit: ${unit} · Fokus: ${focus} · Fragen: ${size}`;
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
