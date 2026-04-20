import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 5173);
const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(__filename);
const DATA_DIR = path.join(ROOT_DIR, "server-data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const APP_VERSION_INFO = resolveAppVersionInfo();

const STATE_KEYS = [
  "voktest_history_v1",
  "voktest_mistakes_v1",
  "voktest_custom_v1",
  "voktest_settings_v1",
  "voktest_admin_v1",
  "voktest_weekly_goal_v1"
];

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

async function ensureStateFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STATE_FILE);
  } catch {
    await writeState(createEmptyState());
  }
}

function createEmptyState() {
  return {
    voktest_history_v1: [],
    voktest_mistakes_v1: {},
    voktest_custom_v1: [],
    voktest_settings_v1: {},
    voktest_admin_v1: {},
    voktest_weekly_goal_v1: null
  };
}

function sanitizeState(input) {
  const safe = createEmptyState();
  if (!input || typeof input !== "object") {
    return safe;
  }

  for (const key of STATE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      safe[key] = input[key];
    }
  }
  return safe;
}

async function readState() {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    return sanitizeState(JSON.parse(raw));
  } catch {
    const fallback = createEmptyState();
    await writeState(fallback);
    return fallback;
  }
}

async function writeState(state) {
  const tmp = `${STATE_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(sanitizeState(state), null, 2), "utf8");
  await fs.rename(tmp, STATE_FILE);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
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

async function handleApi(request, response, pathname) {
  if (pathname === "/api/version") {
    if (request.method !== "GET") {
      sendJson(response, 405, { ok: false, error: "method_not_allowed" });
      return;
    }
    sendJson(response, 200, {
      ok: true,
      version: APP_VERSION_INFO.version,
      source: APP_VERSION_INFO.source
    });
    return;
  }

  if (pathname !== "/api/state") {
    sendJson(response, 404, { ok: false, error: "not_found" });
    return;
  }

  if (request.method === "GET") {
    const state = await readState();
    sendJson(response, 200, { ok: true, state, serverTime: new Date().toISOString() });
    return;
  }

  if (request.method === "PUT") {
    try {
      const rawBody = await readRequestBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const nextState = sanitizeState(payload);
      await writeState(nextState);
      sendJson(response, 200, { ok: true, savedAt: new Date().toISOString() });
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
}

function resolveAppVersionInfo() {
  const fromEnv = sanitizeVersion(process.env.APP_VERSION);
  if (fromEnv) {
    return { version: fromEnv, source: "env" };
  }

  const fromGit = readGitCommitShort();
  if (fromGit) {
    return { version: fromGit, source: "git" };
  }

  const fromPackage = sanitizeVersion(process.env.npm_package_version);
  if (fromPackage) {
    return { version: `v${fromPackage}`, source: "package" };
  }

  return { version: "unknown", source: "fallback" };
}

function readGitCommitShort() {
  try {
    const result = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      cwd: ROOT_DIR,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8"
    }).trim();
    return sanitizeVersion(result);
  } catch {
    return "";
  }
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

async function serveStatic(response, pathname) {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(ROOT_DIR, normalizedPath);
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(ROOT_DIR)) {
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

async function start() {
  await ensureStateFile();

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
      const pathname = decodeURIComponent(url.pathname);

      if (pathname.startsWith("/api/")) {
        await handleApi(request, response, pathname);
        return;
      }

      await serveStatic(response, pathname);
    } catch {
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: "internal_error" }));
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`VokTest server running on http://${HOST}:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
