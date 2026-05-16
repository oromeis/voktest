const WEEKDAY_NAMES = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag"
];

export const DEFAULT_TARGET_MINUTES = 120;
export const DEFAULT_ANSWER_TIMER_SECONDS = 0;
export const MIN_ANSWER_TIMER_SECONDS = 5;
export const MAX_ANSWER_TIMER_SECONDS = 120;

export function modeGrantsPoints(mode) {
  return mode === "quiz" || mode === "test" || mode === "conjugation";
}

export const WEEKLY_REWARD_POOL = [
  { id: "flat_350", type: "flat", value: 350 },
  { id: "flat_500", type: "flat", value: 500 },
  { id: "flat_700", type: "flat", value: 700 },
  { id: "double_round", type: "double", value: 2 }
];

export function getWeekStartLocal(date = new Date()) {
  const current = new Date(date);
  const normalized = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate(),
    0,
    0,
    0,
    0
  );
  const day = normalized.getDay();
  const deltaToMonday = (day + 6) % 7;
  normalized.setDate(normalized.getDate() - deltaToMonday);
  return normalized;
}

export function getWeekEndLocal(date = new Date()) {
  const weekStart = getWeekStartLocal(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setMilliseconds(weekEnd.getMilliseconds() - 1);
  return weekEnd;
}

export function getWeekKey(date = new Date()) {
  const weekStart = getWeekStartLocal(date);
  const thursday = new Date(weekStart);
  thursday.setDate(weekStart.getDate() + 3);
  const year = thursday.getFullYear();

  const jan4 = new Date(year, 0, 4);
  const jan4Monday = getWeekStartLocal(jan4);
  const diffMs = weekStart.getTime() - jan4Monday.getTime();
  const weekNo = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;

  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

export function getWeekContext(date = new Date()) {
  const weekStart = getWeekStartLocal(date);
  const weekEnd = getWeekEndLocal(date);

  return {
    weekKey: getWeekKey(date),
    weekStart,
    weekEnd
  };
}

export function formatDynamicPassword(date = new Date()) {
  const now = new Date(date);
  const weekday = WEEKDAY_NAMES[now.getDay()];
  const mm = String(now.getMinutes()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  return `${weekday}${mm}${hh}`;
}

export function getAcceptedDynamicPasswords(date = new Date()) {
  const current = new Date(date);
  const previousMinute = new Date(current.getTime() - 60 * 1000);
  return [formatDynamicPassword(current), formatDynamicPassword(previousMinute)];
}

export function isDynamicPasswordValid(input, date = new Date()) {
  const normalized = normalizeSecret(input);
  if (!normalized) {
    return false;
  }
  return getAcceptedDynamicPasswords(date).some((candidate) => normalizeSecret(candidate) === normalized);
}

export function normalizeSecret(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLocaleLowerCase("de-DE");
}

export function pickWeeklyReward(random = Math.random) {
  const picker = typeof random === "function" ? random : Math.random;
  const index = Math.floor(Math.max(0, Math.min(0.999999, picker())) * WEEKLY_REWARD_POOL.length);
  const selected = WEEKLY_REWARD_POOL[index] || WEEKLY_REWARD_POOL[0];
  return { ...selected };
}

export function getRewardLabel(reward) {
  if (!reward || typeof reward !== "object") {
    return "+500 XP";
  }
  if (reward.type === "double") {
    return "Doppelte XP auf die Zielrunde";
  }
  return `+${Number(reward.value) || 0} XP`;
}

export function createWeeklyGoal(date = new Date(), targetMinutes = DEFAULT_TARGET_MINUTES, random = Math.random) {
  const { weekKey, weekStart, weekEnd } = getWeekContext(date);
  const timestamp = new Date().toISOString();
  return {
    weekKey,
    weekStartIso: weekStart.toISOString(),
    weekEndIso: weekEnd.toISOString(),
    targetMinutes: sanitizeTargetMinutes(targetMinutes),
    rewardDefinition: pickWeeklyReward(random),
    achieved: false,
    achievedAt: null,
    rewardGranted: false,
    rewardGrantedAt: null,
    rewardBonusPoints: 0,
    updatedAt: timestamp
  };
}

export function sanitizeTargetMinutes(value, fallback = DEFAULT_TARGET_MINUTES) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(10, Math.min(1200, Math.round(numeric)));
}

export function sanitizeAnswerTimerSeconds(value, fallback = DEFAULT_ANSWER_TIMER_SECONDS) {
  const fallbackValue = Number.isFinite(Number(fallback))
    ? Math.max(0, Math.round(Number(fallback)))
    : DEFAULT_ANSWER_TIMER_SECONDS;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallbackValue;
  }

  const rounded = Math.round(numeric);
  if (rounded <= 0) {
    return 0;
  }

  return Math.max(MIN_ANSWER_TIMER_SECONDS, Math.min(MAX_ANSWER_TIMER_SECONDS, rounded));
}

export function computeTimedAnswerPoints(basePoints, elapsedMs, limitSeconds) {
  const safeBasePoints = Math.max(0, Math.round(Number(basePoints) || 0));
  const safeLimitSeconds = sanitizeAnswerTimerSeconds(limitSeconds, DEFAULT_ANSWER_TIMER_SECONDS);
  if (!safeBasePoints || safeLimitSeconds <= 0) {
    return {
      active: false,
      basePoints: safeBasePoints,
      speedBonusPoints: 0,
      totalPoints: safeBasePoints,
      remainingMs: 0,
      remainingRatio: 0,
      limitSeconds: safeLimitSeconds
    };
  }

  const limitMs = safeLimitSeconds * 1000;
  const safeElapsedMs = Math.max(0, Math.min(limitMs, Math.round(Number(elapsedMs) || 0)));
  const remainingMs = Math.max(0, limitMs - safeElapsedMs);
  const remainingRatio = remainingMs / limitMs;
  const speedBonusPoints = Math.max(0, Math.round(safeBasePoints * 0.8 * remainingRatio));

  return {
    active: true,
    basePoints: safeBasePoints,
    speedBonusPoints,
    totalPoints: safeBasePoints + speedBonusPoints,
    remainingMs,
    remainingRatio,
    limitSeconds: safeLimitSeconds
  };
}

export function computeRewardBonusPoints(rewardDefinition, roundPoints) {
  if (!rewardDefinition || typeof rewardDefinition !== "object") {
    return 0;
  }
  if (rewardDefinition.type === "double") {
    return Math.max(0, Number(roundPoints) || 0);
  }
  return Math.max(0, Number(rewardDefinition.value) || 0);
}

export function secondsToMinutes(seconds) {
  const numeric = Math.max(0, Number(seconds) || 0);
  return numeric / 60;
}

export function formatDeadlineText(weekEndInput) {
  const value = new Date(weekEndInput);
  if (Number.isNaN(value.getTime())) {
    return "bis Sonntag 23:59";
  }
  return `bis ${value.toLocaleString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

export function isDateWithinRange(dateInput, startInput, endInput) {
  const date = new Date(dateInput);
  const start = new Date(startInput);
  const end = new Date(endInput);
  if (Number.isNaN(date.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }
  return date >= start && date <= end;
}
