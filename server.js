import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

import { profileRoles, searchPublicSummaries } from "./src/roleProfiler.js";
import { generateQuestions } from "./src/questionAgent.js";
import { matchRoles } from "./src/matchAgent.js";
import { chat, initAgent } from "./src/agent/orchestrator.js";
import * as ragVs from "./src/rag/vectorStore.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const dataDir = join(root, "data");
const personaFile = join(dataDir, "persona.json");
const recordsFile = join(dataDir, "records.json");
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

// -- Rate limiting --
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 30;
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, reset: now + RATE_LIMIT_WINDOW };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + RATE_LIMIT_WINDOW; }
  entry.count++;
  rateLimitMap.set(ip, entry);
  if (entry.count > RATE_LIMIT_MAX) {
    if (rateLimitMap.size > 1000) {
      for (const [k, v] of rateLimitMap) { if (now > v.reset) rateLimitMap.delete(k); }
    }
    return false;
  }
  return true;
}

// -- Security headers --
function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
}

// -- Data helpers --
async function loadJson(file) {
  try { const raw = await readFile(file, "utf8"); return JSON.parse(raw); }
  catch { return null; }
}

async function saveJson(file, data) {
  if (!existsSync(dataDir)) await mkdir(dataDir, { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

const server = createServer(async (req, res) => {
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "Too many requests" }));
  }

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // -- Persona API --
    if (req.method === "GET" && url.pathname === "/api/persona") {
      const data = await loadJson(personaFile);
      if (data) {
        const { describePersona, extractPersonaSignals } = await import("./src/personaMapper.js");
        return json(res, { persona: data, summary: describePersona(data) });
      }
      return json(res, { persona: null, summary: null });
    }

    if (req.method === "POST" && url.pathname === "/api/persona") {
      const body = await readBody(req);
      await saveJson(personaFile, body);
      const { describePersona } = await import("./src/personaMapper.js");
      return json(res, { message: "画像已保存", summary: describePersona(body) });
    }

    // -- Role Records API --
    if (req.method === "GET" && url.pathname === "/api/records") {
      const data = await loadJson(recordsFile);
      return json(res, { records: data?.records || [] });
    }

    if (req.method === "POST" && url.pathname === "/api/records") {
      const body = await readBody(req);
      const data = (await loadJson(recordsFile)) || { records: [], nextId: 1 };
      const record = { ...body, id: String(data.nextId++), createdAt: new Date().toISOString() };
      data.records.push(record);
      await saveJson(recordsFile, data);
      return json(res, { message: "记录已添加", record });
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/records/")) {
      const id = url.pathname.split("/").pop();
      const body = await readBody(req);
      const data = (await loadJson(recordsFile)) || { records: [], nextId: 1 };
      const idx = data.records.findIndex(r => r.id === id);
      if (idx < 0) { res.writeHead(404); res.end("Not found"); return; }
      data.records[idx] = { ...data.records[idx], ...body, id, updatedAt: new Date().toISOString() };
      await saveJson(recordsFile, data);
      return json(res, { message: "记录已更新", record: data.records[idx] });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/records/")) {
      const id = url.pathname.split("/").pop();
      const data = (await loadJson(recordsFile)) || { records: [], nextId: 1 };
      data.records = data.records.filter(r => r.id !== id);
      await saveJson(recordsFile, data);
      return json(res, { message: "记录已删除" });
    }

    // -- Legacy APIs --
    if (req.method === "POST" && url.pathname === "/api/research") {
      const body = await readBody(req);
      const { scriptName } = body;
      const sources = await searchPublicSummaries(scriptName);
      const profile = await profileRoles(scriptName, sources);
      return json(res, { sources, profile });
    }

    if (req.method === "POST" && url.pathname === "/api/questions") {
      const body = await readBody(req);
      return json(res, { questions: generateQuestions(body.profile, body.userProfile) });
    }

    if (req.method === "POST" && url.pathname === "/api/match") {
      const body = await readBody(req);
      return json(res, matchRoles(body.profile, body.userProfile, body.answers));
    }

    if (req.method === "POST" && url.pathname === "/api/agent") {
      const body = await readBody(req);
      const result = await chat(body.message, {
        userProfile: body.userProfile,
        roleRecords: body.roleRecords,
        history: body.history
      });
      return json(res, result);
    }

    if (req.method === "GET" && url.pathname === "/api/rag/stats") {
      return json(res, ragVs.getStats());
    }

    if (req.method !== "GET") return notFound(res);

    // -- Static files --
    const safePath = normalize(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^(\.\.[/\\])+/, "");
    const filePath = join(publicDir, safePath);
    if (!filePath.startsWith(publicDir)) return notFound(res);

    const fileBody = await readFile(filePath);
    setSecurityHeaders(res);
    res.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    res.end(fileBody);
  } catch (error) {
    if (error.code === "ENOENT") return notFound(res);
    if (error.code === "BODY_TOO_LARGE") {
      res.writeHead(413, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "Request body too large" }));
    }
    console.error("Server error:", error);
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "服务器处理失败" }));
  }
});

// -- Request body reader with size limit --
const MAX_BODY_SIZE = 256 * 1024;
async function readBody(req) {
  const contentLen = parseInt(req.headers["content-length"] || "0", 10);
  if (contentLen > MAX_BODY_SIZE) {
    const err = new Error("Request body too large");
    err.code = "BODY_TOO_LARGE";
    throw err;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_SIZE) {
      const err = new Error("Request body too large");
      err.code = "BODY_TOO_LARGE";
      throw err;
    }
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function json(res, payload) {
  setSecurityHeaders(res);
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  setSecurityHeaders(res);
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

server.listen(port, async () => {
  console.log(`剧本杀 AI 选角助手已启动 http://localhost:${port}`);
  const hasLLM = !!process.env.OPENROUTER_API_KEY;
  if (hasLLM) console.log("  LLM 模式 - 使用 OpenRouter 智能对话");
  else console.log("  配置 OPENROUTER_API_KEY 启用 AI 对话功能");
});
