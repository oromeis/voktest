import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ANSWER_TIMER_SECONDS,
  computeTimedAnswerPoints,
  computeRewardBonusPoints,
  createWeeklyGoal,
  formatDynamicPassword,
  getAcceptedDynamicPasswords,
  getWeekContext,
  getWeekKey,
  isDynamicPasswordValid,
  modeGrantsPoints,
  pickWeeklyReward,
  sanitizeAnswerTimerSeconds
} from "../modules/admin-utils.js";

test("dynamic password uses format weekday+MMHH", () => {
  const value = formatDynamicPassword(new Date("2026-04-19T22:05:00"));
  assert.equal(value, "Sonntag0522");
});

test("dynamic password validation accepts current and previous minute", () => {
  const now = new Date("2026-04-19T22:05:40");
  const accepted = getAcceptedDynamicPasswords(now);
  assert.deepEqual(accepted, ["Sonntag0522", "Sonntag0422"]);

  assert.equal(isDynamicPasswordValid("Sonntag0522", now), true);
  assert.equal(isDynamicPasswordValid("Sonntag0422", now), true);
  assert.equal(isDynamicPasswordValid("Sonntag0322", now), false);
});

test("week key changes with monday boundary", () => {
  const sundayLate = new Date("2026-04-19T23:59:00");
  const mondayEarly = new Date("2026-04-20T00:01:00");

  assert.notEqual(getWeekKey(sundayLate), getWeekKey(mondayEarly));

  const week = getWeekContext(mondayEarly);
  const start = new Date(week.weekStart);
  assert.equal(start.getDay(), 1);
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
});

test("weekly reward picker returns stable item shape", () => {
  const reward = pickWeeklyReward(() => 0.99);
  assert.deepEqual(reward, { id: "double_round", type: "double", value: 2 });
});

test("create weekly goal sets defaults and flags", () => {
  const goal = createWeeklyGoal(new Date("2026-04-20T12:00:00"), 120, () => 0);
  assert.equal(goal.weekKey.startsWith("2026-W"), true);
  assert.equal(goal.targetMinutes, 120);
  assert.equal(goal.achieved, false);
  assert.equal(goal.rewardGranted, false);
  assert.equal(goal.rewardBonusPoints, 0);
  assert.equal(goal.rewardDefinition.id, "flat_350");
});

test("reward bonus points handles flat and double rewards", () => {
  assert.equal(computeRewardBonusPoints({ type: "flat", value: 500 }, 42), 500);
  assert.equal(computeRewardBonusPoints({ type: "double", value: 2 }, 42), 42);
});

test("answer timer seconds allow disabling and clamp active values", () => {
  assert.equal(sanitizeAnswerTimerSeconds(0), 0);
  assert.equal(sanitizeAnswerTimerSeconds(-5), 0);
  assert.equal(sanitizeAnswerTimerSeconds(3), 5);
  assert.equal(sanitizeAnswerTimerSeconds(150), 120);
  assert.equal(sanitizeAnswerTimerSeconds("foo", DEFAULT_ANSWER_TIMER_SECONDS), 0);
});

test("learn mode grants no points while scored modes still do", () => {
  assert.equal(modeGrantsPoints("learn"), false);
  assert.equal(modeGrantsPoints("quiz"), true);
  assert.equal(modeGrantsPoints("test"), true);
  assert.equal(modeGrantsPoints("conjugation"), true);
});

test("timed answer points reward faster correct answers", () => {
  const fast = computeTimedAnswerPoints(10, 2000, 20);
  assert.equal(fast.active, true);
  assert.equal(fast.basePoints, 10);
  assert.equal(fast.speedBonusPoints, 7);
  assert.equal(fast.totalPoints, 17);
  assert.equal(fast.remainingRatio, 0.9);

  const slow = computeTimedAnswerPoints(10, 19000, 20);
  assert.equal(slow.totalPoints, 10);
  assert.equal(slow.speedBonusPoints, 0);

  const disabled = computeTimedAnswerPoints(10, 1000, 0);
  assert.equal(disabled.active, false);
  assert.equal(disabled.totalPoints, 10);
});
