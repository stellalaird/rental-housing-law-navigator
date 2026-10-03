// Audit log: one JSON line per lookup or ingest, appended to audit.jsonl (override with AUDIT_LOG). No deps.
//   import { audit } from "./audit.mjs"
//   audit({ kind: "lookup", input: "A0001", as_of: "2026-10-01", rule_ids: ["r-0015"] })
//   audit({ kind: "ingest", input: "D9998.txt", as_of: "2026-10-01", rule_ids: ["new-D9998-1"], detail: { dropped: 0 } })
// Every record: ts (ISO UTC), kind, input, as_of, rule_ids (what was returned or created), version
// ({ commit, rules_sha, model }). Logging never throws: a failed write is reported on stderr and the request carries on.
import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const here = (f) => new URL(f, import.meta.url).pathname;
const LOG = () => process.env.AUDIT_LOG || here("./audit.jsonl");
let cached = null;

// Computed once per process: git commit of the code, hash of rules.json, and the extraction model.
export function version() {
  if (cached) return cached;
  let commit = null, rules_sha = null;
  try { commit = execFileSync("git", ["-C", here("./"), "rev-parse", "--short", "HEAD"], { encoding: "utf8", timeout: 3000 }).trim(); } catch {}
  try { rules_sha = createHash("sha256").update(readFileSync(here("./rules.json"))).digest("hex").slice(0, 12); } catch {}
  return (cached = { commit, rules_sha, model: process.env.CLI_MODEL || "claude-opus-5-5" });
}

export function audit(rec) {
  try {
    const line = { ts: new Date().toISOString(), kind: rec.kind, input: rec.input ?? null, as_of: rec.as_of ?? null,
      rule_ids: rec.rule_ids ?? [], version: version(), ...(rec.detail ? { detail: rec.detail } : {}) };
    appendFileSync(LOG(), JSON.stringify(line) + "\n");
    return line;
  } catch (e) { console.error("audit write failed:", e.message); return null; }
}
