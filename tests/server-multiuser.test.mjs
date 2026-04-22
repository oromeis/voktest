import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import {
  STORAGE_KEYS,
  hashSecret,
  migrateStateToV3,
  startServer,
  verifySecret
} from "../server.js";
import { getAcceptedDynamicPasswords } from "../modules/admin-utils.js";

async function requestJson(baseUrl, route, { method = "GET", token = "", body } = {}) {
  const headers = {
    Accept: "application/json"
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  return { status: response.status, payload };
}

async function withServer(run) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "voktest-server-"));
  const stateFile = path.join(tempRoot, "state.json");

  const started = await startServer({
    host: "127.0.0.1",
    port: 0,
    dataDir: tempRoot,
    stateFile,
    silent: true
  });

  const baseUrl = `http://127.0.0.1:${started.port}`;

  try {
    await run({ baseUrl, stateFile, tempRoot });
  } finally {
    await started.close();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

test("hashSecret + verifySecret validates PINs correctly", async () => {
  const hashed = await hashSecret("1234");

  assert.equal(Boolean(hashed.hashHex), true);
  assert.equal(Boolean(hashed.saltHex), true);
  assert.equal(await verifySecret("1234", hashed.hashHex, hashed.saltHex), true);
  assert.equal(await verifySecret("1111", hashed.hashHex, hashed.saltHex), false);
});

test("legacy state migrates to schemaVersion 3 with u_legacy, PIN 0000 and default class", async () => {
  const legacy = {
    [STORAGE_KEYS.history]: [{ total: 10, correct: 9, points: 50 }],
    [STORAGE_KEYS.mistakes]: { a: 2 },
    [STORAGE_KEYS.customVocabulary]: [{ id: "x", english: "cat", german: "Katze" }],
    [STORAGE_KEYS.settings]: { mode: "quiz", size: 12 },
    [STORAGE_KEYS.admin]: { backupPin: "9999" },
    [STORAGE_KEYS.weeklyGoal]: { weekKey: "2026-W16", targetMinutes: 90 }
  };

  const migrated = await migrateStateToV3(legacy);
  assert.equal(migrated.state.schemaVersion, 3);
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.state.auth.profiles.length, 1);

  const profile = migrated.state.auth.profiles[0];
  assert.equal(profile.id, "u_legacy");
  assert.equal(profile.name, "Schüler 1");
  assert.equal(profile.pinSet, true);
  assert.equal(profile.schoolGrade, 6);
  assert.equal(await verifySecret("0000", profile.pinHash, profile.pinSalt), true);

  const legacyData = migrated.state.userDataById.u_legacy;
  assert.equal(Array.isArray(legacyData[STORAGE_KEYS.history]), true);
  assert.equal(legacyData[STORAGE_KEYS.history].length, 1);
  assert.equal(Array.isArray(migrated.state.shared.customVocabulary), true);
  assert.equal(Boolean(migrated.state.auth.admin.backupPinHash), true);
});

test("schemaVersion 2 migrates to v3 and backfills profile class + entry language/grade", async () => {
  const hashed = await hashSecret("1234");
  const v2State = {
    schemaVersion: 2,
    shared: {
      customVocabulary: [
        { id: "c1", english: "cat", german: "Katze", unit: "Unit 1" }
      ]
    },
    auth: {
      admin: { backupPinHash: "", backupPinSalt: "" },
      profiles: [
        {
          id: "u_a",
          name: "Alice",
          active: true,
          pinSet: true,
          pinHash: hashed.hashHex,
          pinSalt: hashed.saltHex
        }
      ]
    },
    userDataById: {
      u_a: {
        [STORAGE_KEYS.history]: [],
        [STORAGE_KEYS.mistakes]: {},
        [STORAGE_KEYS.settings]: { mode: "learn" },
        [STORAGE_KEYS.weeklyGoal]: null
      }
    }
  };

  const migrated = await migrateStateToV3(v2State);
  assert.equal(migrated.state.schemaVersion, 3);
  assert.equal(migrated.state.auth.profiles[0].schoolGrade, 6);
  assert.equal(migrated.state.shared.customVocabulary[0].foreign, "cat");
  assert.equal(migrated.state.shared.customVocabulary[0].language, "en");
  assert.equal(migrated.state.shared.customVocabulary[0].schoolGrade, 6);
});

test("student login exposes only own state and blocks admin routes", async () => {
  await withServer(async ({ baseUrl }) => {
    const profilesRes = await requestJson(baseUrl, "/api/auth/profiles");
    assert.equal(profilesRes.status, 200);
    assert.equal(profilesRes.payload.ok, true);
    assert.equal(profilesRes.payload.profiles.length >= 1, true);
    assert.equal(profilesRes.payload.profiles[0].schoolGrade, 6);

    const wrongLogin = await requestJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: { profileId: profilesRes.payload.profiles[0].id, pin: "1111" }
    });
    assert.equal(wrongLogin.status, 401);

    const login = await requestJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: { profileId: profilesRes.payload.profiles[0].id, pin: "0000" }
    });
    assert.equal(login.status, 200);
    assert.equal(login.payload.ok, true);
    assert.equal(login.payload.user.schoolGrade, 6);
    const token = login.payload.token;

    const meState = await requestJson(baseUrl, "/api/me/state", {
      method: "GET",
      token
    });
    assert.equal(meState.status, 200);
    assert.equal(meState.payload.ok, true);
    assert.equal(Object.prototype.hasOwnProperty.call(meState.payload.state, STORAGE_KEYS.customVocabulary), true);

    const blockedAdmin = await requestJson(baseUrl, "/api/admin/profiles", {
      method: "GET",
      token
    });
    assert.equal(blockedAdmin.status, 403);

    const logout = await requestJson(baseUrl, "/api/auth/logout", {
      method: "POST",
      token
    });
    assert.equal(logout.status, 200);

    const expiredSession = await requestJson(baseUrl, "/api/auth/session", {
      method: "GET",
      token
    });
    assert.equal(expiredSession.status, 401);
  });
});

test("admin can manage profiles and shared vocabulary, student sees shared pool", async () => {
  await withServer(async ({ baseUrl }) => {
    const adminCode = getAcceptedDynamicPasswords(new Date())[0];
    const adminLogin = await requestJson(baseUrl, "/api/auth/admin-login", {
      method: "POST",
      body: { code: adminCode }
    });
    assert.equal(adminLogin.status, 200);
    const adminToken = adminLogin.payload.token;

    const createProfile = await requestJson(baseUrl, "/api/admin/profiles", {
      method: "POST",
      token: adminToken,
      body: { name: "Nutzer B", schoolGrade: 7 }
    });
    assert.equal(createProfile.status, 201);
    const createdId = createProfile.payload.profile.id;
    assert.equal(createProfile.payload.profile.pinSet, false);
    assert.equal(createProfile.payload.profile.schoolGrade, 7);

    const saveGoal = await requestJson(baseUrl, `/api/admin/profiles/${encodeURIComponent(createdId)}/goal`, {
      method: "PUT",
      token: adminToken,
      body: { targetMinutes: 90 }
    });
    assert.equal(saveGoal.status, 200);

    const saveShared = await requestJson(baseUrl, "/api/admin/shared", {
      method: "PUT",
      token: adminToken,
      body: {
        [STORAGE_KEYS.customVocabulary]: [
          { id: "shared-1", english: "apple", german: "Apfel", unit: "Unit 1" }
        ]
      }
    });
    assert.equal(saveShared.status, 200);

    const profilesOverview = await requestJson(baseUrl, "/api/admin/profiles", {
      method: "GET",
      token: adminToken
    });
    assert.equal(profilesOverview.status, 200);
    const editedProfile = profilesOverview.payload.profiles.find((item) => item.id === createdId);
    assert.equal(Boolean(editedProfile), true);
    assert.equal(editedProfile.kpi.weekTargetMinutes, 90);
    assert.equal(editedProfile.schoolGrade, 7);

    const studentLogin = await requestJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: { profileId: createdId, pin: "2345" }
    });
    assert.equal(studentLogin.status, 428);

    const initPinMismatch = await requestJson(baseUrl, "/api/auth/initialize-pin", {
      method: "POST",
      body: { profileId: createdId, pin: "2345", pinConfirm: "2346" }
    });
    assert.equal(initPinMismatch.status, 400);

    const initPin = await requestJson(baseUrl, "/api/auth/initialize-pin", {
      method: "POST",
      body: { profileId: createdId, pin: "2345", pinConfirm: "2345" }
    });
    assert.equal(initPin.status, 200);
    const studentToken = initPin.payload.token;
    const initSession = await requestJson(baseUrl, "/api/auth/session", {
      method: "GET",
      token: studentToken
    });
    assert.equal(initSession.status, 200);

    const studentLoginAfterInit = await requestJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: { profileId: createdId, pin: "2345" }
    });
    assert.equal(studentLoginAfterInit.status, 200);
    const studentTokenAfterInit = studentLoginAfterInit.payload.token;

    const studentState = await requestJson(baseUrl, "/api/me/state", {
      method: "GET",
      token: studentTokenAfterInit
    });
    assert.equal(studentState.status, 200);
    assert.equal(studentState.payload.user.schoolGrade, 7);
    assert.equal(Array.isArray(studentState.payload.state[STORAGE_KEYS.customVocabulary]), true);
    assert.equal(studentState.payload.state[STORAGE_KEYS.customVocabulary].length, 1);

    const blocked = await requestJson(baseUrl, "/api/admin/shared", {
      method: "GET",
      token: studentTokenAfterInit
    });
    assert.equal(blocked.status, 403);

    const resetPin = await requestJson(
      baseUrl,
      `/api/admin/profiles/${encodeURIComponent(createdId)}/reset-pin`,
      {
        method: "POST",
        token: adminToken
      }
    );
    assert.equal(resetPin.status, 200);
    assert.equal(resetPin.payload.profile.pinSet, false);

    const loginAfterReset = await requestJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: { profileId: createdId, pin: "2345" }
    });
    assert.equal(loginAfterReset.status, 428);

    const legacyView = await requestJson(baseUrl, "/api/state", { method: "GET" });
    assert.equal(legacyView.status, 200);
    assert.equal(legacyView.payload.legacy, true);

    const legacyPut = await requestJson(baseUrl, "/api/state", {
      method: "PUT",
      body: {}
    });
    assert.equal(legacyPut.status, 405);
  });
});
