import http from "node:http";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_TARGET_MINUTES,
  createWeeklyGoal,
  getWeekContext,
  isDateWithinRange,
  isDynamicPasswordValid,
  sanitizeTargetMinutes
} from "./modules/admin-utils.js";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 5173);
const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(__filename);
const DATA_DIR = path.join(ROOT_DIR, "server-data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const VERSION_FILE = path.join(ROOT_DIR, "VERSION");
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const APP_VERSION_INFO = resolveAppVersionInfo();
const SCRYPT = promisify(crypto.scrypt);

const STORAGE_KEYS = {
  history: "voktest_history_v1",
  mistakes: "voktest_mistakes_v1",
  customVocabulary: "voktest_custom_v1",
  settings: "voktest_settings_v1",
  admin: "voktest_admin_v1",
  weeklyGoal: "voktest_weekly_goal_v1"
};

const LEGACY_STATE_KEYS = Object.values(STORAGE_KEYS);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function createLegacyEmptyState() {
  return {
    [STORAGE_KEYS.history]: [],
    [STORAGE_KEYS.mistakes]: {},
    [STORAGE_KEYS.customVocabulary]: [],
    [STORAGE_KEYS.settings]: {},
    [STORAGE_KEYS.admin]: {},
    [STORAGE_KEYS.weeklyGoal]: null
  };
}

function createEmptyUserData() {
  return {
    [STORAGE_KEYS.history]: [],
    [STORAGE_KEYS.mistakes]: {},
    [STORAGE_KEYS.settings]: {},
    [STORAGE_KEYS.weeklyGoal]: null
  };
}

function createEmptyV2State() {
  return {
    schemaVersion: 2,
    shared: {
      customVocabulary: []
    },
    auth: {
      admin: {
        backupPinHash: "",
        backupPinSalt: ""
      },
      profiles: []
    },
    userDataById: {}
  };
}

function sanitizeName(value, fallback = "Schüler") {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return fallback;
  }
  return text.slice(0, 40);
}

function sanitizeId(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return fallback;
  }
  return text.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50);
}

function sanitizePinInput(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^\d{4,6}$/.test(text) ? text : "";
}

function sanitizeBool(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function sanitizeIsoString(value) {
  if (typeof value !== "string") {
    return "";
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return new Date(parsed).toISOString();
}

function sanitizeVocabularyEntry(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const english = typeof value.english === "string" ? value.english.trim() : "";
  const german = typeof value.german === "string" ? value.german.trim() : "";
  if (!english || !german) {
    return null;
  }

  const id = typeof value.id === "string" && value.id.trim()
    ? value.id.trim().slice(0, 120)
    : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    english: english.slice(0, 240),
    german: german.slice(0, 240),
    unit: typeof value.unit === "string" ? value.unit.trim().slice(0, 80) : "",
    lesson: typeof value.lesson === "string" ? value.lesson.trim().slice(0, 80) : "",
    page: typeof value.page === "string" ? value.page.trim().slice(0, 50) : "",
    topic: typeof value.topic === "string" ? value.topic.trim().slice(0, 80) : ""
  };
}

function sanitizeShared(input) {
  const list = Array.isArray(input?.customVocabulary) ? input.customVocabulary : [];
  return {
    customVocabulary: list.map((entry) => sanitizeVocabularyEntry(entry)).filter(Boolean)
  };
}

function sanitizeHistoryEntry(entry) {
  const value = entry && typeof entry === "object" ? entry : {};
  const total = Math.max(0, Math.round(Number(value.total) || 0));
  const correct = Math.max(0, Math.min(total, Math.round(Number(value.correct) || 0)));
  const wrong = Math.max(0, Math.round(Number(value.wrong) || Math.max(0, total - correct)));
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    date: sanitizeIsoString(value.date) || new Date().toISOString(),
    mode:
      value.mode === "learn" || value.mode === "quiz" || value.mode === "test"
        ? value.mode
        : "test",
    direction:
      value.direction === "en-de" || value.direction === "de-en" ? value.direction : "en-de",
    total,
    correct,
    wrong,
    points: Math.max(0, Math.round(Number(value.points) || 0)),
    durationSeconds: Math.max(0, Math.round(Number(value.durationSeconds) || 0)),
    rewardBonusPoints: Math.max(0, Math.round(Number(value.rewardBonusPoints) || 0)),
    weekKey: typeof value.weekKey === "string" ? value.weekKey.trim().slice(0, 24) : "",
    percent: Math.max(0, Math.min(100, Math.round(Number(value.percent) || percent))),
    grade: Math.max(1, Math.min(6, Math.round(Number(value.grade) || 6)))
  };
}

function sanitizeHistory(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.slice(0, 200).map((entry) => sanitizeHistoryEntry(entry));
}

function sanitizeMistakes(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const result = {};
  for (const [key, value] of Object.entries(input)) {
    const safeKey = typeof key === "string" ? key.trim().slice(0, 120) : "";
    if (!safeKey) {
      continue;
    }
    result[safeKey] = Math.max(0, Math.round(Number(value) || 0));
  }
  return result;
}

function sanitizeSettings(input) {
  const value = input && typeof input === "object" ? input : {};
  const mode = value.mode === "learn" || value.mode === "quiz" || value.mode === "test"
    ? value.mode
    : "learn";
  const direction = value.direction === "en-de" || value.direction === "de-en"
    ? value.direction
    : "en-de";
  const size = Math.max(5, Math.min(50, Math.round(Number(value.size) || 15)));
  const unit = typeof value.unit === "string" ? value.unit.slice(0, 80) : "all";
  const focus = value.focus === "mistakes" ? "mistakes" : "all";
  const section = typeof value.section === "string" ? value.section.slice(0, 32) : "start";

  return {
    mode,
    direction,
    size,
    unit,
    focus,
    section
  };
}

function sanitizeRewardDefinition(input) {
  const value = input && typeof input === "object" ? input : {};
  if (value.type === "double") {
    return {
      id: typeof value.id === "string" ? value.id : "double_round",
      type: "double",
      value: 2
    };
  }
  return {
    id: typeof value.id === "string" ? value.id : "flat_500",
    type: "flat",
    value: Math.max(0, Math.round(Number(value.value) || 500))
  };
}

function sanitizeWeeklyGoal(input) {
  if (input === null) {
    return null;
  }
  if (!input || typeof input !== "object") {
    return null;
  }

  return {
    weekKey: typeof input.weekKey === "string" ? input.weekKey.trim().slice(0, 24) : "",
    weekStartIso: sanitizeIsoString(input.weekStartIso),
    weekEndIso: sanitizeIsoString(input.weekEndIso),
    targetMinutes: sanitizeTargetMinutes(input.targetMinutes, DEFAULT_TARGET_MINUTES),
    rewardDefinition: sanitizeRewardDefinition(input.rewardDefinition),
    achieved: sanitizeBool(input.achieved, false),
    achievedAt: sanitizeIsoString(input.achievedAt) || null,
    rewardGranted: sanitizeBool(input.rewardGranted, false),
    rewardGrantedAt: sanitizeIsoString(input.rewardGrantedAt) || null,
    rewardBonusPoints: Math.max(0, Math.round(Number(input.rewardBonusPoints) || 0)),
    updatedAt: sanitizeIsoString(input.updatedAt) || new Date().toISOString()
  };
}

function sanitizeUserData(input) {
  const value = input && typeof input === "object" ? input : {};
  return {
    [STORAGE_KEYS.history]: sanitizeHistory(value[STORAGE_KEYS.history]),
    [STORAGE_KEYS.mistakes]: sanitizeMistakes(value[STORAGE_KEYS.mistakes]),
    [STORAGE_KEYS.settings]: sanitizeSettings(value[STORAGE_KEYS.settings]),
    [STORAGE_KEYS.weeklyGoal]: sanitizeWeeklyGoal(value[STORAGE_KEYS.weeklyGoal])
  };
}

function sanitizeAdminAuth(input) {
  const value = input && typeof input === "object" ? input : {};
  return {
    backupPinHash: typeof value.backupPinHash === "string" ? value.backupPinHash : "",
    backupPinSalt: typeof value.backupPinSalt === "string" ? value.backupPinSalt : ""
  };
}

function sanitizeProfile(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const id = sanitizeId(input.id);
  if (!id) {
    return null;
  }

  return {
    id,
    name: sanitizeName(input.name, "Schüler"),
    active: sanitizeBool(input.active, true),
    pinSet:
      typeof input.pinSet === "boolean"
        ? input.pinSet
        : Boolean(
            typeof input.pinHash === "string" &&
              input.pinHash &&
              typeof input.pinSalt === "string" &&
              input.pinSalt
          ),
    pinHash: typeof input.pinHash === "string" ? input.pinHash : "",
    pinSalt: typeof input.pinSalt === "string" ? input.pinSalt : "",
    createdAt: sanitizeIsoString(input.createdAt) || new Date().toISOString(),
    updatedAt: sanitizeIsoString(input.updatedAt) || new Date().toISOString()
  };
}

function sanitizeStateV2(input) {
  const safe = createEmptyV2State();
  if (!input || typeof input !== "object") {
    return safe;
  }

  safe.schemaVersion = 2;
  safe.shared = sanitizeShared(input.shared);
  safe.auth.admin = sanitizeAdminAuth(input?.auth?.admin);

  const profilesRaw = Array.isArray(input?.auth?.profiles) ? input.auth.profiles : [];
  safe.auth.profiles = profilesRaw.map((profile) => sanitizeProfile(profile)).filter(Boolean);

  const userDataByIdRaw = input.userDataById && typeof input.userDataById === "object"
    ? input.userDataById
    : {};

  for (const profile of safe.auth.profiles) {
    safe.userDataById[profile.id] = sanitizeUserData(userDataByIdRaw[profile.id]);
  }

  return safe;
}

function sanitizeLegacyState(input) {
  const safe = createLegacyEmptyState();
  if (!input || typeof input !== "object") {
    return safe;
  }

  for (const key of LEGACY_STATE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      safe[key] = input[key];
    }
  }

  safe[STORAGE_KEYS.history] = sanitizeHistory(safe[STORAGE_KEYS.history]);
  safe[STORAGE_KEYS.mistakes] = sanitizeMistakes(safe[STORAGE_KEYS.mistakes]);
  safe[STORAGE_KEYS.customVocabulary] = sanitizeShared({
    customVocabulary: safe[STORAGE_KEYS.customVocabulary]
  }).customVocabulary;
  safe[STORAGE_KEYS.settings] = sanitizeSettings(safe[STORAGE_KEYS.settings]);
  safe[STORAGE_KEYS.weeklyGoal] = sanitizeWeeklyGoal(safe[STORAGE_KEYS.weeklyGoal]);
  safe[STORAGE_KEYS.admin] = safe[STORAGE_KEYS.admin] && typeof safe[STORAGE_KEYS.admin] === "object"
    ? safe[STORAGE_KEYS.admin]
    : {};

  return safe;
}

function createProfileId() {
  return `u_${crypto.randomBytes(6).toString("hex")}`;
}

async function hashSecret(secret, saltHex = "") {
  const normalized = typeof secret === "string" ? secret : "";
  const saltBuffer = saltHex
    ? Buffer.from(saltHex, "hex")
    : crypto.randomBytes(16);
  const derived = await SCRYPT(normalized, saltBuffer, 64);
  return {
    hashHex: Buffer.from(derived).toString("hex"),
    saltHex: saltBuffer.toString("hex")
  };
}

async function verifySecret(secret, hashHex, saltHex) {
  if (!hashHex || !saltHex) {
    return false;
  }
  try {
    const expected = Buffer.from(hashHex, "hex");
    const derived = Buffer.from(await SCRYPT(secret, Buffer.from(saltHex, "hex"), 64));
    if (expected.length !== derived.length) {
      return false;
    }
    return crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

function hasBackupPin(state) {
  return Boolean(state?.auth?.admin?.backupPinHash && state?.auth?.admin?.backupPinSalt);
}

async function migrateStateToV2(rawState) {
  if (rawState && typeof rawState === "object" && rawState.schemaVersion === 2) {
    const v2 = sanitizeStateV2(rawState);
    const changed = await ensureProfilesAndPins(v2);
    return { state: v2, migrated: changed };
  }

  const legacy = sanitizeLegacyState(rawState);
  const migrated = createEmptyV2State();
  migrated.shared.customVocabulary = legacy[STORAGE_KEYS.customVocabulary];

  const defaultProfile = await createProfileWithPin({
    id: "u_legacy",
    name: "Schüler 1",
    pin: "0000",
    active: true
  });
  migrated.auth.profiles.push(defaultProfile);

  const adminBackup = typeof legacy[STORAGE_KEYS.admin]?.backupPin === "string"
    ? legacy[STORAGE_KEYS.admin].backupPin.trim()
    : "";
  if (adminBackup && adminBackup.length >= 4) {
    const backupSecret = await hashSecret(adminBackup);
    migrated.auth.admin.backupPinHash = backupSecret.hashHex;
    migrated.auth.admin.backupPinSalt = backupSecret.saltHex;
  }

  migrated.userDataById.u_legacy = sanitizeUserData({
    [STORAGE_KEYS.history]: legacy[STORAGE_KEYS.history],
    [STORAGE_KEYS.mistakes]: legacy[STORAGE_KEYS.mistakes],
    [STORAGE_KEYS.settings]: legacy[STORAGE_KEYS.settings],
    [STORAGE_KEYS.weeklyGoal]: legacy[STORAGE_KEYS.weeklyGoal]
  });

  return { state: migrated, migrated: true };
}

async function createProfileWithPin({ id, name, pin, active = true }) {
  const hashed = await hashSecret(pin);
  const timestamp = new Date().toISOString();
  return {
    id,
    name: sanitizeName(name, "Schüler"),
    active: !!active,
    pinSet: true,
    pinHash: hashed.hashHex,
    pinSalt: hashed.saltHex,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createProfileWithoutPin({ id, name, active = true }) {
  const timestamp = new Date().toISOString();
  return {
    id,
    name: sanitizeName(name, "Schüler"),
    active: !!active,
    pinSet: false,
    pinHash: "",
    pinSalt: "",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

async function ensureProfilesAndPins(v2State) {
  let changed = false;

  if (!Array.isArray(v2State.auth.profiles)) {
    v2State.auth.profiles = [];
    changed = true;
  }

  if (v2State.auth.profiles.length === 0) {
    v2State.auth.profiles.push(await createProfileWithPin({
      id: "u_legacy",
      name: "Schüler 1",
      pin: "0000",
      active: true
    }));
    changed = true;
  }

  const seenIds = new Set();
  const nextProfiles = [];

  for (const profile of v2State.auth.profiles) {
    const safe = sanitizeProfile(profile);
    if (!safe) {
      changed = true;
      continue;
    }

    if (seenIds.has(safe.id)) {
      changed = true;
      continue;
    }
    seenIds.add(safe.id);

    if (safe.pinSet) {
      if (!safe.pinHash || !safe.pinSalt) {
        const hashed = await hashSecret("0000");
        safe.pinHash = hashed.hashHex;
        safe.pinSalt = hashed.saltHex;
        safe.updatedAt = new Date().toISOString();
        changed = true;
      }
    } else {
      if (safe.pinHash || safe.pinSalt) {
        safe.pinHash = "";
        safe.pinSalt = "";
        safe.updatedAt = new Date().toISOString();
        changed = true;
      }
    }

    if (!v2State.userDataById[safe.id]) {
      v2State.userDataById[safe.id] = createEmptyUserData();
      changed = true;
    } else {
      const sanitizedData = sanitizeUserData(v2State.userDataById[safe.id]);
      if (JSON.stringify(sanitizedData) !== JSON.stringify(v2State.userDataById[safe.id])) {
        changed = true;
      }
      v2State.userDataById[safe.id] = sanitizedData;
    }

    nextProfiles.push(safe);
  }

  v2State.auth.profiles = nextProfiles;
  v2State.shared = sanitizeShared(v2State.shared);
  v2State.auth.admin = sanitizeAdminAuth(v2State.auth.admin);

  return changed;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("payload_too_large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    request.on("error", (error) => reject(error));
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function resolveBearerToken(request) {
  const auth = request.headers.authorization;
  if (!auth || typeof auth !== "string") {
    return "";
  }
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }
  return token.trim();
}

function resolveAppVersionInfo() {
  const fromGit = readGitCommitShortFromGitDir();
  if (fromGit) {
    return { version: fromGit, source: "git" };
  }

  const fromVersionFile = readVersionFile();
  if (fromVersionFile) {
    return { version: fromVersionFile, source: "file" };
  }

  const fromEnv = sanitizeVersion(process.env.APP_VERSION);
  if (fromEnv) {
    return { version: fromEnv, source: "env" };
  }

  const fromPackage = sanitizeVersion(process.env.npm_package_version);
  if (fromPackage) {
    return { version: `v${fromPackage}`, source: "package" };
  }

  return { version: "unknown", source: "fallback" };
}

function readGitCommitShortFromGitDir() {
  try {
    const gitDir = path.join(ROOT_DIR, ".git");
    const headRaw = readText(path.join(gitDir, "HEAD"));
    if (!headRaw) {
      return "";
    }

    const head = headRaw.trim();
    let commit = "";

    if (head.startsWith("ref:")) {
      const ref = head.slice(4).trim();
      commit = readText(path.join(gitDir, ref)).trim();
      if (!commit) {
        commit = readPackedRef(gitDir, ref);
      }
    } else {
      commit = head;
    }

    const sanitized = sanitizeVersion(commit);
    if (!/^[0-9a-fA-F]{7,40}$/.test(sanitized)) {
      return "";
    }
    return sanitized.slice(0, 7).toLowerCase();
  } catch {
    return "";
  }
}

function readVersionFile() {
  const raw = readText(VERSION_FILE);
  if (!raw) {
    return "";
  }
  return sanitizeVersion(raw.trim());
}

function readText(filePath) {
  try {
    return fsSync.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function readPackedRef(gitDir, refName) {
  const content = readText(path.join(gitDir, "packed-refs"));
  if (!content) {
    return "";
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("^")) {
      continue;
    }
    const [hash, ref] = trimmed.split(" ");
    if (ref === refName) {
      return hash || "";
    }
  }
  return "";
}

function sanitizeVersion(value) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "");
}

function buildLegacyStateView(v2State) {
  const profile = v2State.auth.profiles.find((item) => item.id === "u_legacy") || v2State.auth.profiles[0];
  const userData = profile ? v2State.userDataById[profile.id] || createEmptyUserData() : createEmptyUserData();
  return {
    [STORAGE_KEYS.history]: userData[STORAGE_KEYS.history],
    [STORAGE_KEYS.mistakes]: userData[STORAGE_KEYS.mistakes],
    [STORAGE_KEYS.customVocabulary]: v2State.shared.customVocabulary,
    [STORAGE_KEYS.settings]: userData[STORAGE_KEYS.settings],
    [STORAGE_KEYS.admin]: {},
    [STORAGE_KEYS.weeklyGoal]: userData[STORAGE_KEYS.weeklyGoal]
  };
}

function computeWeekUsedSeconds(history, weekContext) {
  const list = Array.isArray(history) ? history : [];
  return list.reduce((sum, entry) => {
    if (!entry || typeof entry !== "object") {
      return sum;
    }

    const durationSeconds = Math.max(0, Math.round(Number(entry.durationSeconds) || 0));
    if (!durationSeconds) {
      return sum;
    }

    if (typeof entry.weekKey === "string" && entry.weekKey) {
      return entry.weekKey === weekContext.weekKey ? sum + durationSeconds : sum;
    }

    if (entry.date && isDateWithinRange(entry.date, weekContext.weekStart.toISOString(), weekContext.weekEnd.toISOString())) {
      return sum + durationSeconds;
    }

    return sum;
  }, 0);
}

function getProfileKpi(v2State, profileId) {
  const userData = v2State.userDataById[profileId] || createEmptyUserData();
  const history = sanitizeHistory(userData[STORAGE_KEYS.history]);
  const rounds = history.length;
  const totalXp = history.reduce((sum, entry) => sum + Math.max(0, Number(entry.points) || 0), 0);

  const currentWeek = getWeekContext(new Date());
  const weekUsedSeconds = computeWeekUsedSeconds(history, currentWeek);
  const weekGoal = sanitizeWeeklyGoal(userData[STORAGE_KEYS.weeklyGoal]);
  const weekTargetMinutes = sanitizeTargetMinutes(weekGoal?.targetMinutes, DEFAULT_TARGET_MINUTES);

  return {
    rounds,
    totalXp,
    weekUsedMinutes: Math.floor(weekUsedSeconds / 60),
    weekTargetMinutes
  };
}

function buildStudentStateResponse(v2State, profileId) {
  const userData = v2State.userDataById[profileId] || createEmptyUserData();
  return {
    [STORAGE_KEYS.history]: userData[STORAGE_KEYS.history],
    [STORAGE_KEYS.mistakes]: userData[STORAGE_KEYS.mistakes],
    [STORAGE_KEYS.settings]: userData[STORAGE_KEYS.settings],
    [STORAGE_KEYS.weeklyGoal]: userData[STORAGE_KEYS.weeklyGoal],
    [STORAGE_KEYS.customVocabulary]: v2State.shared.customVocabulary
  };
}

function buildPublicProfile(profile, kpi) {
  return {
    id: profile.id,
    name: profile.name,
    active: profile.active !== false,
    pinSet: profile.pinSet !== false,
    kpi
  };
}

function buildSessionUser(v2State, session) {
  if (!session || session.role !== "student") {
    return { id: "admin", name: "Eltern/Admin" };
  }
  const profile = v2State.auth.profiles.find((item) => item.id === session.profileId);
  if (!profile) {
    return { id: session.profileId, name: "Schüler" };
  }
  return { id: profile.id, name: profile.name };
}

async function serveStatic(response, pathname, rootDir) {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(rootDir, normalizedPath);
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(rootDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(resolvedPath);
    if (!stat.isFile()) {
      throw new Error("not_file");
    }
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
    const data = await fs.readFile(resolvedPath);
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=120"
    });
    response.end(data);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
  }
}

async function ensureFile(pathToFile, fallbackValue) {
  const dir = path.dirname(pathToFile);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(pathToFile);
  } catch {
    await fs.writeFile(pathToFile, JSON.stringify(fallbackValue, null, 2), "utf8");
  }
}

async function writeJsonAtomic(filePath, payload) {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

function nowIso() {
  return new Date().toISOString();
}

export async function createRuntime({
  rootDir = ROOT_DIR,
  dataDir = DATA_DIR,
  stateFile = STATE_FILE,
  appVersionInfo = APP_VERSION_INFO,
  sessionTtlMs = SESSION_TTL_MS
} = {}) {
  await fs.mkdir(dataDir, { recursive: true });
  await ensureFile(stateFile, createEmptyV2State());

  let state;
  try {
    const rawText = await fs.readFile(stateFile, "utf8");
    const rawState = JSON.parse(rawText);
    const migration = await migrateStateToV2(rawState);
    state = migration.state;
    if (migration.migrated) {
      await writeJsonAtomic(stateFile, state);
    }
  } catch {
    state = createEmptyV2State();
    await ensureProfilesAndPins(state);
    await writeJsonAtomic(stateFile, state);
  }

  const sessions = new Map();
  let writeChain = Promise.resolve();

  const persistState = async () => {
    const snapshot = JSON.parse(JSON.stringify(state));
    writeChain = writeChain.then(() => writeJsonAtomic(stateFile, snapshot));
    await writeChain;
  };

  const clearExpiredSessions = () => {
    const now = Date.now();
    for (const [token, session] of sessions.entries()) {
      if (!session || session.expiresAt <= now) {
        sessions.delete(token);
      }
    }
  };

  const createSessionToken = (role, profileId = "") => {
    clearExpiredSessions();
    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, {
      token,
      role,
      profileId,
      createdAt: Date.now(),
      expiresAt: Date.now() + sessionTtlMs
    });
    return token;
  };

  const resolveSession = (request) => {
    clearExpiredSessions();
    const token = resolveBearerToken(request);
    if (!token) {
      return null;
    }
    const session = sessions.get(token);
    if (!session) {
      return null;
    }
    if (session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return null;
    }
    session.expiresAt = Date.now() + sessionTtlMs;
    sessions.set(token, session);
    return session;
  };

  const requireRole = (request, response, role) => {
    const session = resolveSession(request);
    if (!session) {
      sendJson(response, 401, { ok: false, error: "unauthorized" });
      return null;
    }
    if (role && session.role !== role) {
      sendJson(response, 403, { ok: false, error: "forbidden" });
      return null;
    }
    return session;
  };

  const getProfileById = (profileId) => state.auth.profiles.find((item) => item.id === profileId) || null;
  const invalidateProfileSessions = (profileId) => {
    for (const [token, session] of sessions.entries()) {
      if (session?.role === "student" && session.profileId === profileId) {
        sessions.delete(token);
      }
    }
  };

  const ensureUserDataById = (profileId) => {
    if (!state.userDataById[profileId]) {
      state.userDataById[profileId] = createEmptyUserData();
    }
    state.userDataById[profileId] = sanitizeUserData(state.userDataById[profileId]);
    return state.userDataById[profileId];
  };

  const handleVersion = (request, response) => {
    if (request.method !== "GET") {
      sendJson(response, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      version: appVersionInfo.version,
      source: appVersionInfo.source
    });
  };

  const handleAuthProfiles = (request, response) => {
    if (request.method !== "GET") {
      sendJson(response, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    const profiles = state.auth.profiles
      .filter((profile) => profile.active !== false)
      .map((profile) => ({
        id: profile.id,
        name: profile.name,
        pinSet: profile.pinSet !== false
      }));

    sendJson(response, 200, { ok: true, profiles });
  };

  const handleAuthLogin = async (request, response) => {
    if (request.method !== "POST") {
      sendJson(response, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    try {
      const rawBody = await readRequestBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const profileId = sanitizeId(payload.profileId);
      if (!profileId) {
        sendJson(response, 400, { ok: false, error: "invalid_payload" });
        return;
      }

      const profile = getProfileById(profileId);
      if (!profile || profile.active === false) {
        sendJson(response, 401, { ok: false, error: "login_failed" });
        return;
      }

      if (profile.pinSet === false) {
        sendJson(response, 428, { ok: false, error: "pin_setup_required" });
        return;
      }

      const pin = sanitizePinInput(payload.pin);
      if (!pin) {
        sendJson(response, 400, { ok: false, error: "invalid_payload" });
        return;
      }

      const valid = await verifySecret(pin, profile.pinHash, profile.pinSalt);
      if (!valid) {
        sendJson(response, 401, { ok: false, error: "login_failed" });
        return;
      }

      const token = createSessionToken("student", profile.id);
      const warning = profile.id === "u_legacy" && pin === "0000"
        ? "Standard-PIN 0000 aktiv. Bitte im Admin-Bereich ändern."
        : "";
      sendJson(response, 200, {
        ok: true,
        token,
        user: { id: profile.id, name: profile.name },
        warning
      });
    } catch (error) {
      if (error.message === "payload_too_large") {
        sendJson(response, 413, { ok: false, error: "payload_too_large" });
        return;
      }
      sendJson(response, 400, { ok: false, error: "invalid_payload" });
    }
  };

  const handleAuthInitializePin = async (request, response) => {
    if (request.method !== "POST") {
      sendJson(response, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    try {
      const rawBody = await readRequestBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const profileId = sanitizeId(payload.profileId);
      const pin = sanitizePinInput(payload.pin);
      const pinConfirm = sanitizePinInput(payload.pinConfirm);
      if (!profileId || !pin || !pinConfirm) {
        sendJson(response, 400, { ok: false, error: "invalid_payload" });
        return;
      }
      if (pin !== pinConfirm) {
        sendJson(response, 400, { ok: false, error: "pin_mismatch" });
        return;
      }

      const profile = getProfileById(profileId);
      if (!profile || profile.active === false) {
        sendJson(response, 404, { ok: false, error: "profile_not_found" });
        return;
      }
      if (profile.pinSet !== false) {
        sendJson(response, 409, { ok: false, error: "pin_already_set" });
        return;
      }

      const hashed = await hashSecret(pin);
      profile.pinHash = hashed.hashHex;
      profile.pinSalt = hashed.saltHex;
      profile.pinSet = true;
      profile.updatedAt = nowIso();
      await persistState();

      const token = createSessionToken("student", profile.id);
      sendJson(response, 200, {
        ok: true,
        token,
        user: { id: profile.id, name: profile.name }
      });
    } catch (error) {
      if (error.message === "payload_too_large") {
        sendJson(response, 413, { ok: false, error: "payload_too_large" });
        return;
      }
      sendJson(response, 400, { ok: false, error: "invalid_payload" });
    }
  };

  const handleAdminLogin = async (request, response) => {
    if (request.method !== "POST") {
      sendJson(response, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    try {
      const rawBody = await readRequestBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const code = typeof payload.code === "string" ? payload.code.trim() : "";
      if (!code) {
        sendJson(response, 400, { ok: false, error: "invalid_payload" });
        return;
      }

      const dynamicValid = isDynamicPasswordValid(code, new Date());
      const backupValid = hasBackupPin(state)
        ? await verifySecret(code, state.auth.admin.backupPinHash, state.auth.admin.backupPinSalt)
        : false;
      if (!dynamicValid && !backupValid) {
        sendJson(response, 401, { ok: false, error: "login_failed" });
        return;
      }

      const token = createSessionToken("admin", "");
      sendJson(response, 200, { ok: true, token, role: "admin" });
    } catch (error) {
      if (error.message === "payload_too_large") {
        sendJson(response, 413, { ok: false, error: "payload_too_large" });
        return;
      }
      sendJson(response, 400, { ok: false, error: "invalid_payload" });
    }
  };

  const handleLogout = (request, response) => {
    if (request.method !== "POST") {
      sendJson(response, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    const token = resolveBearerToken(request);
    if (token) {
      sessions.delete(token);
    }
    sendJson(response, 200, { ok: true });
  };

  const handleAuthSession = (request, response) => {
    if (request.method !== "GET") {
      sendJson(response, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    const session = requireRole(request, response);
    if (!session) {
      return;
    }

    sendJson(response, 200, {
      ok: true,
      session: {
        role: session.role,
        user: buildSessionUser(state, session),
        expiresAt: new Date(session.expiresAt).toISOString()
      }
    });
  };

  const handleMeState = async (request, response) => {
    const session = requireRole(request, response, "student");
    if (!session) {
      return;
    }

    const profile = getProfileById(session.profileId);
    if (!profile || profile.active === false) {
      sendJson(response, 401, { ok: false, error: "profile_inactive" });
      return;
    }

    const userData = ensureUserDataById(profile.id);

    if (request.method === "GET") {
      sendJson(response, 200, {
        ok: true,
        state: buildStudentStateResponse(state, profile.id),
        user: { id: profile.id, name: profile.name }
      });
      return;
    }

    if (request.method === "PUT") {
      try {
        const rawBody = await readRequestBody(request);
        const payload = rawBody ? JSON.parse(rawBody) : {};

        if (Object.prototype.hasOwnProperty.call(payload, STORAGE_KEYS.history)) {
          userData[STORAGE_KEYS.history] = sanitizeHistory(payload[STORAGE_KEYS.history]);
        }
        if (Object.prototype.hasOwnProperty.call(payload, STORAGE_KEYS.mistakes)) {
          userData[STORAGE_KEYS.mistakes] = sanitizeMistakes(payload[STORAGE_KEYS.mistakes]);
        }
        if (Object.prototype.hasOwnProperty.call(payload, STORAGE_KEYS.settings)) {
          userData[STORAGE_KEYS.settings] = sanitizeSettings(payload[STORAGE_KEYS.settings]);
        }
        if (Object.prototype.hasOwnProperty.call(payload, STORAGE_KEYS.weeklyGoal)) {
          userData[STORAGE_KEYS.weeklyGoal] = sanitizeWeeklyGoal(payload[STORAGE_KEYS.weeklyGoal]);
        }

        state.userDataById[profile.id] = sanitizeUserData(userData);
        await persistState();
        sendJson(response, 200, { ok: true, savedAt: nowIso() });
      } catch (error) {
        if (error.message === "payload_too_large") {
          sendJson(response, 413, { ok: false, error: "payload_too_large" });
          return;
        }
        sendJson(response, 400, { ok: false, error: "invalid_payload" });
      }
      return;
    }

    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
  };

  const handleAdminShared = async (request, response) => {
    const session = requireRole(request, response, "admin");
    if (!session) {
      return;
    }

    if (request.method === "GET") {
      sendJson(response, 200, {
        ok: true,
        customVocabulary: state.shared.customVocabulary,
        admin: {
          backupPinSet: hasBackupPin(state)
        }
      });
      return;
    }

    if (request.method === "PUT") {
      try {
        const rawBody = await readRequestBody(request);
        const payload = rawBody ? JSON.parse(rawBody) : {};
        const incomingCustom = Object.prototype.hasOwnProperty.call(payload, STORAGE_KEYS.customVocabulary)
          ? payload[STORAGE_KEYS.customVocabulary]
          : payload.customVocabulary;

        state.shared = sanitizeShared({ customVocabulary: incomingCustom });
        await persistState();
        sendJson(response, 200, { ok: true, savedAt: nowIso() });
      } catch (error) {
        if (error.message === "payload_too_large") {
          sendJson(response, 413, { ok: false, error: "payload_too_large" });
          return;
        }
        sendJson(response, 400, { ok: false, error: "invalid_payload" });
      }
      return;
    }

    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
  };

  const handleAdminSettings = async (request, response) => {
    const session = requireRole(request, response, "admin");
    if (!session) {
      return;
    }

    if (request.method !== "PUT") {
      sendJson(response, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    try {
      const rawBody = await readRequestBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const backupPin = typeof payload.backupPin === "string" ? payload.backupPin.trim() : "";
      if (!backupPin || backupPin.length < 4) {
        sendJson(response, 400, { ok: false, error: "invalid_backup_pin" });
        return;
      }

      const hashed = await hashSecret(backupPin);
      state.auth.admin.backupPinHash = hashed.hashHex;
      state.auth.admin.backupPinSalt = hashed.saltHex;
      await persistState();
      sendJson(response, 200, { ok: true, savedAt: nowIso() });
    } catch (error) {
      if (error.message === "payload_too_large") {
        sendJson(response, 413, { ok: false, error: "payload_too_large" });
        return;
      }
      sendJson(response, 400, { ok: false, error: "invalid_payload" });
    }
  };

  const handleAdminProfiles = async (request, response, pathname) => {
    const session = requireRole(request, response, "admin");
    if (!session) {
      return;
    }

    if (pathname === "/api/admin/profiles") {
      if (request.method === "GET") {
        const profiles = state.auth.profiles
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }))
          .map((profile) => buildPublicProfile(profile, getProfileKpi(state, profile.id)));
        sendJson(response, 200, { ok: true, profiles });
        return;
      }

      if (request.method === "POST") {
        try {
          const rawBody = await readRequestBody(request);
          const payload = rawBody ? JSON.parse(rawBody) : {};
          const name = sanitizeName(payload.name, "");
          if (!name) {
            sendJson(response, 400, { ok: false, error: "invalid_payload" });
            return;
          }

          const pin = typeof payload.pin === "string" ? sanitizePinInput(payload.pin) : "";
          let profile;
          if (pin) {
            profile = await createProfileWithPin({
              id: createProfileId(),
              name,
              pin,
              active: true
            });
          } else {
            profile = createProfileWithoutPin({
              id: createProfileId(),
              name,
              active: true
            });
          }

          state.auth.profiles.push(profile);
          state.userDataById[profile.id] = createEmptyUserData();
          await persistState();

          sendJson(response, 201, {
            ok: true,
            profile: buildPublicProfile(profile, getProfileKpi(state, profile.id))
          });
        } catch (error) {
          if (error.message === "payload_too_large") {
            sendJson(response, 413, { ok: false, error: "payload_too_large" });
            return;
          }
          sendJson(response, 400, { ok: false, error: "invalid_payload" });
        }
        return;
      }

      sendJson(response, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    const resetPinMatch = pathname.match(/^\/api\/admin\/profiles\/([^/]+)\/reset-pin$/);
    if (resetPinMatch) {
      if (request.method !== "POST") {
        sendJson(response, 405, { ok: false, error: "method_not_allowed" });
        return;
      }

      const profileId = sanitizeId(decodeURIComponent(resetPinMatch[1]));
      const profile = getProfileById(profileId);
      if (!profile) {
        sendJson(response, 404, { ok: false, error: "profile_not_found" });
        return;
      }

      profile.pinSet = false;
      profile.pinHash = "";
      profile.pinSalt = "";
      profile.updatedAt = nowIso();
      invalidateProfileSessions(profile.id);
      await persistState();

      sendJson(response, 200, {
        ok: true,
        profile: buildPublicProfile(profile, getProfileKpi(state, profile.id))
      });
      return;
    }

    const goalMatch = pathname.match(/^\/api\/admin\/profiles\/([^/]+)\/goal$/);
    if (goalMatch) {
      if (request.method !== "PUT") {
        sendJson(response, 405, { ok: false, error: "method_not_allowed" });
        return;
      }

      try {
        const profileId = sanitizeId(decodeURIComponent(goalMatch[1]));
        const profile = getProfileById(profileId);
        if (!profile) {
          sendJson(response, 404, { ok: false, error: "profile_not_found" });
          return;
        }

        const rawBody = await readRequestBody(request);
        const payload = rawBody ? JSON.parse(rawBody) : {};
        const targetMinutes = sanitizeTargetMinutes(payload.targetMinutes, DEFAULT_TARGET_MINUTES);

        const userData = ensureUserDataById(profile.id);
        const now = new Date();
        const week = getWeekContext(now);
        const existingGoal = sanitizeWeeklyGoal(userData[STORAGE_KEYS.weeklyGoal]);

        let weeklyGoal;
        if (!existingGoal || existingGoal.weekKey !== week.weekKey) {
          weeklyGoal = createWeeklyGoal(now, targetMinutes);
        } else {
          weeklyGoal = {
            ...existingGoal,
            targetMinutes,
            updatedAt: nowIso()
          };
        }

        const usedMinutes = Math.floor(
          computeWeekUsedSeconds(userData[STORAGE_KEYS.history], week) / 60
        );
        if (!weeklyGoal.rewardGranted) {
          weeklyGoal.achieved = usedMinutes >= weeklyGoal.targetMinutes;
          if (weeklyGoal.achieved && !weeklyGoal.achievedAt) {
            weeklyGoal.achievedAt = nowIso();
          }
        }

        userData[STORAGE_KEYS.weeklyGoal] = sanitizeWeeklyGoal(weeklyGoal);
        state.userDataById[profile.id] = sanitizeUserData(userData);
        await persistState();
        sendJson(response, 200, { ok: true, goal: userData[STORAGE_KEYS.weeklyGoal] });
      } catch (error) {
        if (error.message === "payload_too_large") {
          sendJson(response, 413, { ok: false, error: "payload_too_large" });
          return;
        }
        sendJson(response, 400, { ok: false, error: "invalid_payload" });
      }
      return;
    }

    const profileMatch = pathname.match(/^\/api\/admin\/profiles\/([^/]+)$/);
    if (!profileMatch) {
      sendJson(response, 404, { ok: false, error: "not_found" });
      return;
    }

    if (request.method !== "PUT") {
      sendJson(response, 405, { ok: false, error: "method_not_allowed" });
      return;
    }

    try {
      const profileId = sanitizeId(decodeURIComponent(profileMatch[1]));
      const profile = getProfileById(profileId);
      if (!profile) {
        sendJson(response, 404, { ok: false, error: "profile_not_found" });
        return;
      }

      const rawBody = await readRequestBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const nextName = sanitizeName(payload.name, "");
      if (!nextName) {
        sendJson(response, 400, { ok: false, error: "invalid_name" });
        return;
      }

      const nextActive = typeof payload.active === "boolean" ? payload.active : profile.active;
      const nextPin = typeof payload.pin === "string" ? sanitizePinInput(payload.pin) : "";
      if (typeof payload.pin === "string" && !nextPin) {
        sendJson(response, 400, { ok: false, error: "invalid_pin" });
        return;
      }

      profile.name = nextName;
      profile.active = !!nextActive;
      profile.updatedAt = nowIso();

      if (nextPin) {
        const hashed = await hashSecret(nextPin);
        profile.pinHash = hashed.hashHex;
        profile.pinSalt = hashed.saltHex;
        profile.pinSet = true;
      }

      await persistState();
      sendJson(response, 200, {
        ok: true,
        profile: buildPublicProfile(profile, getProfileKpi(state, profile.id))
      });
    } catch (error) {
      if (error.message === "payload_too_large") {
        sendJson(response, 413, { ok: false, error: "payload_too_large" });
        return;
      }
      sendJson(response, 400, { ok: false, error: "invalid_payload" });
    }
  };

  const handleLegacyState = (request, response) => {
    if (request.method === "GET") {
      sendJson(response, 200, {
        ok: true,
        state: buildLegacyStateView(state),
        serverTime: nowIso(),
        legacy: true
      });
      return;
    }

    sendJson(response, 405, {
      ok: false,
      error: "legacy_read_only",
      message: "Bitte /api/me/state und /api/admin/* verwenden."
    });
  };

  const handleApi = async (request, response, pathname) => {
    if (pathname === "/api/version") {
      handleVersion(request, response);
      return;
    }

    if (pathname === "/api/auth/profiles") {
      handleAuthProfiles(request, response);
      return;
    }
    if (pathname === "/api/auth/login") {
      await handleAuthLogin(request, response);
      return;
    }
    if (pathname === "/api/auth/initialize-pin") {
      await handleAuthInitializePin(request, response);
      return;
    }
    if (pathname === "/api/auth/admin-login") {
      await handleAdminLogin(request, response);
      return;
    }
    if (pathname === "/api/auth/logout") {
      handleLogout(request, response);
      return;
    }
    if (pathname === "/api/auth/session") {
      handleAuthSession(request, response);
      return;
    }

    if (pathname === "/api/me/state") {
      await handleMeState(request, response);
      return;
    }

    if (pathname === "/api/admin/shared") {
      await handleAdminShared(request, response);
      return;
    }

    if (pathname === "/api/admin/settings") {
      await handleAdminSettings(request, response);
      return;
    }

    if (pathname === "/api/admin/profiles" || pathname.startsWith("/api/admin/profiles/")) {
      await handleAdminProfiles(request, response, pathname);
      return;
    }

    if (pathname === "/api/state") {
      handleLegacyState(request, response);
      return;
    }

    sendJson(response, 404, { ok: false, error: "not_found" });
  };

  return {
    getState: () => state,
    clearSessions: () => sessions.clear(),
    async handleRequest(request, response) {
      try {
        const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
        const pathname = decodeURIComponent(url.pathname);

        if (pathname.startsWith("/api/")) {
          await handleApi(request, response, pathname);
          return;
        }

        await serveStatic(response, pathname, rootDir);
      } catch {
        sendJson(response, 500, { ok: false, error: "internal_error" });
      }
    }
  };
}

export async function startServer({
  host = HOST,
  port = PORT,
  rootDir = ROOT_DIR,
  dataDir = DATA_DIR,
  stateFile = STATE_FILE,
  appVersionInfo = APP_VERSION_INFO,
  silent = false
} = {}) {
  const runtime = await createRuntime({ rootDir, dataDir, stateFile, appVersionInfo });

  const server = http.createServer((request, response) => {
    void runtime.handleRequest(request, response);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  if (!silent) {
    console.log(`VokTest server running on http://${host}:${actualPort}`);
  }

  return {
    server,
    runtime,
    port: actualPort,
    host,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
}

function isMainModule() {
  if (!process.argv[1]) {
    return false;
  }
  return path.resolve(process.argv[1]) === __filename;
}

if (isMainModule()) {
  startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}

export {
  APP_VERSION_INFO,
  STORAGE_KEYS,
  createEmptyUserData,
  createEmptyV2State,
  hashSecret,
  migrateStateToV2,
  sanitizePinInput,
  verifySecret
};
