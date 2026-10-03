// One-shot claude -p call with a disk cache (cache/<sha256>.json) so reruns are free.
// Isolation flags match server.mjs runCli. Corpus text is passed as data, never as instructions.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const CACHE_DIR = new URL("../cache/", import.meta.url).pathname;
const MODEL = process.env.CLI_MODEL || "claude-opus-5-5";
const BIN = process.env.CLAUDE_BIN || "claude";
mkdirSync(CACHE_DIR, { recursive: true });

export function claudeText({ system, prompt, model = MODEL, timeoutMs = 300000 }) {
  const key = createHash("sha256").update(JSON.stringify({ system, prompt, model })).digest("hex");
  const file = `${CACHE_DIR}${key}.json`;
  if (existsSync(file)) return Promise.resolve({ ...JSON.parse(readFileSync(file, "utf8")), cached: true });
  return new Promise((resolve, reject) => {
    const args = ["-p", "--output-format", "json", "--no-session-persistence", "--allowedTools=", "--tools", "",
      "--strict-mcp-config", "--disable-slash-commands", "--setting-sources", "", "--system-prompt", system, "--model", model];
    const child = spawn(BIN, args, { cwd: "/", stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("claude -p timeout")); }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude exit ${code}: ${err.slice(0, 300)}`));
      try {
        const j = JSON.parse(out);
        if (j.is_error) return reject(new Error(`claude error: ${String(j.result).slice(0, 300)}`));
        const rec = { text: j.result, model, at: new Date().toISOString() };
        writeFileSync(file, JSON.stringify(rec));
        resolve({ ...rec, cached: false });
      } catch (e) { reject(new Error(`bad claude output: ${out.slice(0, 200)}`)); }
    });
    child.stdin.end(prompt);
  });
}

// Pull the first JSON value out of model text (handles ```json fences).
export function parseJson(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch {}
  const s = t.search(/[\[{]/);
  const e = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
  if (s < 0 || e < s) throw new Error("no JSON in model text");
  return JSON.parse(t.slice(s, e + 1));
}
