import express from "express";
import { spawn } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import config from "./config.mjs";
import { lookup, state as navState } from "./lib/navigator.mjs";
import { audit } from "./audit.mjs";

// BACKEND=api (default): SDK + ANTHROPIC_API_KEY from .env.
// BACKEND=cli: `claude -p` subprocess, no tools, prompt over stdin, streamed back.
const BACKEND = process.env.BACKEND || "api";
const PORT = Number(process.env.PORT || 3000);
const CLI_TIMEOUT_MS = Number(process.env.CLI_TIMEOUT_MS || 120000);
const CLI_BIN = process.env.CLAUDE_BIN || "claude";
const RATE_LIMIT = Number(process.env.RATE_LIMIT || 10);           // requests per IP per minute
const MAX_PROMPT_CHARS = Number(process.env.MAX_PROMPT_CHARS || 4000); // per message
const MAX_HISTORY = Number(process.env.MAX_HISTORY || 20);         // messages per request
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT || 2);    // simultaneous model calls (claude children in cli mode); extra requests get 429
const SYSTEM = process.env.SYSTEM_PROMPT || config.systemPrompt; // edit config.mjs per track

const client = BACKEND === "api" ? new Anthropic() : null; // key from env; never sent to the browser
const app = express();
if (process.env.TRUST_PROXY) app.set("trust proxy", 1); // set behind a tunnel/proxy so req.ip is the real client, not the proxy
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));
app.get("/api/config", (_req, res) => res.json({ title: config.title, tagline: config.tagline, examples: config.examples })); // systemPrompt stays server-side

async function runApi(messages, send, abort) {
  const params = {
    model: "claude-opus-5-5",
    max_tokens: 64000,
    thinking: { type: "adaptive", display: "summarized" },
    output_config: { effort: "high" },
    system: SYSTEM,
    messages, // [{role, content}, ...]
  };
  const stream = process.env.USE_FALLBACKS
    ? client.beta.messages.stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
    : client.messages.stream(params);
  abort.fn = () => stream.abort();
  for await (const ev of stream) {
    if (ev.type === "content_block_delta") {
      if (ev.delta.type === "text_delta") send("text", ev.delta.text);
      if (ev.delta.type === "thinking_delta") send("thinking", ev.delta.thinking);
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") send("refusal", final.stop_details ?? null);
  send("done", final.usage);
}

// The CLI takes one prompt, so the history is flattened into it.
function flattenMsgs(messages) {
  const turns = messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`);
  return `${turns.join("\n\n")}\n\nAssistant:`;
}

function runCli(messages, send, abort) {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--output-format", "stream-json", "--verbose", "--include-partial-messages",
      "--no-session-persistence",
      "--allowedTools=", // brief: empty allow-list
      "--tools", "",     // belt and braces: no built-in tools at all
      // isolation: without these the child inherits the owner's MCP servers, hooks and ~24k tokens of context
      "--strict-mcp-config", "--disable-slash-commands", "--setting-sources", "",
      "--system-prompt", SYSTEM,
      "--model", process.env.CLI_MODEL || "claude-opus-5-5",
    ];
    const child = spawn(CLI_BIN, args, { cwd: "/", stdio: ["pipe", "pipe", "pipe"] });
    let buf = "", stderr = "", finished = false, timedOut = false;
    const timer = setTimeout(() => { timedOut = true; send("error", `claude -p timed out after ${CLI_TIMEOUT_MS}ms`); child.kill("SIGKILL"); }, CLI_TIMEOUT_MS);
    abort.fn = () => child.kill("SIGKILL");
    child.stderr.on("data", (d) => { stderr += d; });
    child.stdout.on("data", (d) => {
      buf += d;
      const lines = buf.split("\n"); buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === "stream_event" && ev.event?.type === "content_block_delta") {
          const d = ev.event.delta;
          if (d.type === "text_delta") send("text", d.text);
          if (d.type === "thinking_delta") send("thinking", d.thinking);
        } else if (ev.type === "result") {
          finished = true;
          if (ev.is_error) send("error", String(ev.result ?? "cli error"));
          else send("done", ev.usage ?? null);
        }
      }
    });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (!finished && !timedOut && code !== 0) send("error", `claude -p exited ${code}: ${stderr.slice(0, 500)}`);
      resolve();
    });
    child.stdin.end(flattenMsgs(messages));
  });
}

// Abuse guards for /api/chat. All rejections are JSON {error} with a human-readable message, sent BEFORE any SSE headers.
const hits = new Map(); // ip -> request timestamps in the last minute
let active = 0;
function guard(req, res, next) {
  const now = Date.now(), ip = req.ip || "unknown";
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= RATE_LIMIT) {
    res.set("Retry-After", "30");
    return res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
  }
  recent.push(now); hits.set(ip, recent);
  const m = req.body?.messages;
  if (!Array.isArray(m) || m.length === 0 || m.length > MAX_HISTORY)
    return res.status(400).json({ error: `Conversation too long (max ${MAX_HISTORY} messages). Start a new one.` });
  if (!m.every((x) => x && (x.role === "user" || x.role === "assistant") && typeof x.content === "string") || m[m.length - 1].role !== "user")
    return res.status(400).json({ error: "Malformed request." });
  if (m.some((x) => x.content.length > MAX_PROMPT_CHARS))
    return res.status(400).json({ error: `Message too long (max ${MAX_PROMPT_CHARS} characters).` });
  if (active >= MAX_CONCURRENT) {
    res.set("Retry-After", "10");
    return res.status(429).json({ error: "The demo is busy right now. Please try again in a few seconds." });
  }
  active++; let released = false;
  const release = () => { if (!released) { released = true; active--; } };
  res.on("close", release); res.on("finish", release);
  next();
}
setInterval(() => { const now = Date.now(); for (const [ip, ts] of hits) if (ts.every((t) => now - t >= 60000)) hits.delete(ip); }, 60000).unref();

app.post("/api/chat", guard, async (req, res) => {
  const run = BACKEND === "cli" ? runCli : runApi;
  const fail = (e) => (client && e instanceof Anthropic.APIError ? `${e.status}: ${e.message}` : String(e));
  const abort = { fn: () => {} };
  res.on("close", () => abort.fn());
  if (req.query.stream === "0") {
    // Non-streaming fallback: same backends, events collected into one JSON reply (for hosts/proxies that break SSE).
    const out = { text: "", thinking: "", usage: null, error: null, refusal: null };
    const collect = (type, data) => {
      if (type === "text") out.text += data;
      else if (type === "thinking") out.thinking += data;
      else if (type === "done") out.usage = data;
      else if (type === "error") out.error = data;
      else if (type === "refusal") out.refusal = data ?? true;
    };
    try { await run(req.body.messages, collect, abort); } catch (e) { out.error = fail(e); }
    return res.status(out.error ? 502 : 200).json(out);
  }
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const send = (type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  try {
    await run(req.body.messages, send, abort);
  } catch (e) {
    send("error", fail(e));
  }
  res.end();
});

// Rental Housing Law Navigator (read-only JSON; no model calls)
const asofOf = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : "2026-10-01");
app.get("/api/lookup", (req, res) => {
  const date = asofOf(req.query.asof), q = req.query.address;
  const out = lookup(q, date);
  if (!out) return res.status(404).json({ error: "address not found among the sample addresses; try an address_id such as A0001" });
  audit({ kind: "lookup", input: String(q), as_of: date, rule_ids: out.results.map((r) => r.team_rule_id) });
  res.json(out);
});
app.get("/api/rules", (req, res) => res.json({ rules: navState().rules }));
app.get("/api/lookups", (req, res) => res.json(navState().lk));

app.listen(PORT, () => console.log(`http://localhost:${PORT} backend=${BACKEND}`));
