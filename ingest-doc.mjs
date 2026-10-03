#!/usr/bin/env node
// T6 path: one command takes a NEW document, extracts its rules, supersedes the rules it replaces, regenerates changes.json.
//   node ingest-doc.mjs <doc.txt> [--rules rules.json] [--out-rules rules.json] [--changes changes.json] [--today 2026-10-01]
//        [--pack "<pack dir>"] [--jur jurisdictions.json] [--raw raw.json] [--no-supersede] [--dry]
// Extraction reuses extract-rules.mjs's prompt and lib/llm.mjs (claude -p, cached). --raw skips the model and takes an array in the
// extractor's raw shape (for tests). Writes only the paths given; use scratch paths when testing.
// Mapping raw -> schema below is a stopgap until normalize-rules.mjs exists; swap it for that function then.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { claudeText, parseJson } from "./lib/llm.mjs";
import { SYSTEM, promptFor } from "./extract-rules.mjs";
import { loadRules, fullDate } from "./changelog.mjs";
import { makeChanges } from "./make-changes.mjs";
import { audit } from "./audit.mjs";

const argv = process.argv.slice(2), flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const docPath = argv.find((a, i) => !a.startsWith("--") && !(argv[i - 1] || "").startsWith("--"));
if (!docPath) { console.error("usage: ingest-doc.mjs <doc.txt> [flags, see header]"); process.exit(2); }
const today = flag("--today", "2026-10-01"), pack = flag("--pack", "data/starter/participant-final-no-hour16 3");
const rulesIn = flag("--rules", "rules.json"), rulesOut = flag("--out-rules", rulesIn), changesOut = flag("--changes", "changes.json");

const raw = readFileSync(docPath, "utf8"), docId = basename(docPath).replace(/\.\w+$/, "");
const header = raw.split("\n").slice(0, 3).filter((l) => /^(SOURCE|RETRIEVED):/.test(l)).join("\n");
const norm = (s) => String(s).replace(/\s+/g, " ").trim().toLowerCase();

let extracted;
if (flag("--raw")) extracted = JSON.parse(readFileSync(flag("--raw"), "utf8"));
else extracted = parseJson((await claudeText({ system: SYSTEM, prompt: promptFor(docId, header, raw.slice(0, 150000)) })).text);
extracted = (Array.isArray(extracted) ? extracted : []).map((x) => ({ ...x, quote_verified: !!x.quote && norm(raw).includes(norm(x.quote)) }));
const dropped = extracted.filter((x) => !x.quote_verified), kept = extracted.filter((x) => x.quote_verified);

const STATUS = { enacted: "in_force", pending: "pending", struck: "failed", repealed: "failed" };
const toRule = (x, i) => {
  const j = x.jurisdiction || {}, ST = j.state || "";
  const jurisdiction = j.level === "state" ? ST : `${j.name}, ${ST}`;
  const eff = x.effective_date || null;
  let status = STATUS[x.status] || "pending";
  if (status === "in_force" && eff && fullDate(eff) > today) status = "not_yet_effective";
  return { team_rule_id: `new-${docId}-${i + 1}`, jurisdiction, level: j.level === "state" ? "state" : "city", category: x.category, status,
    title: x.citation || x.requirement.slice(0, 80), requirement: x.requirement, key_value: x.key_value ?? null, coverage_conditions: x.coverage ?? null,
    exemptions: x.exemptions ?? null, overrides: [], interaction: x.preemption_note ?? null, effective_date: eff, citation: x.citation || "",
    source_doc_id: docId, source_url: x.source_url || (header.match(/SOURCE: (\S+)/) || [])[1] || "", quoted_span: x.quote, confidence: null, conflict_flag: !!x.preemption_note, conflict_note: x.preemption_note ?? null };
};
const fresh = kept.map(toRule);

const existing = loadRules(rulesIn), superseded = [];
if (!argv.includes("--no-supersede")) for (const n of fresh) {
  if (n.status === "failed" || n.status === "pending") continue;           // a bill or a struck measure replaces nothing
  const olds = existing.filter((o) => o.jurisdiction === n.jurisdiction && o.category === n.category && ["in_force", "not_yet_effective"].includes(o.status) && !superseded.includes(o.team_rule_id));
  if (olds.length) { n.supersedes = olds.map((o) => o.team_rule_id); superseded.push(...n.supersedes); }
}
const merged = [...existing, ...fresh];

// T6: affected = addresses inside the new rules' jurisdictions (legal stack, not postal city).
const tests = JSON.parse(readFileSync(join(pack, "dev/change_tests.json"), "utf8"));
const parseCsv = (t) => { const [h, ...r] = t.trim().split(/\r?\n/); const k = h.split(","); return r.map((l) => { const c = []; let f = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { c.push(f); f = ""; } else f += ch; } c.push(f); return Object.fromEntries(k.map((x, i) => [x, c[i] ?? ""])); }); };
const addresses = parseCsv(readFileSync(join(pack, "data/sample_addresses.csv"), "utf8"));
const jur = JSON.parse(readFileSync(flag("--jur", "jurisdictions.json"), "utf8")).by_address;
const t6 = { test_id: "T6", type: "new_document", jurisdictions: [...new Set(fresh.filter((n) => n.status !== "failed").map((n) => n.jurisdiction))] };
const changes = existsSync(changesOut) ? JSON.parse(readFileSync(changesOut, "utf8")) : makeChanges({ rules: merged, tests, addresses, jur });
const t6res = makeChanges({ rules: merged, tests: [], addresses, jur, extra: [t6] }).T6;
const dates = fresh.map((n) => n.effective_date).filter(Boolean);
t6res.notes = `New document ${docId}: ${fresh.length} rule(s) in ${t6.jurisdictions.join(", ") || "no jurisdiction"}; effective ${dates.join(", ") || "date not stated"}; supersedes ${superseded.join(", ") || "nothing"}. Affected = addresses inside those jurisdictions; a future effective date means not yet in force.`;
changes.T6 = t6res;

if (!argv.includes("--dry")) { writeFileSync(rulesOut, JSON.stringify({ rules: merged }, null, 2) + "\n"); writeFileSync(changesOut, JSON.stringify(changes, null, 2) + "\n"); }
if (!argv.includes("--dry")) audit({ kind: "ingest", input: docPath, as_of: today, rule_ids: fresh.map((n) => n.team_rule_id), detail: { extracted: extracted.length, dropped_unverified: dropped.length, superseded } });
console.log(JSON.stringify({ doc: docId, extracted: extracted.length, quote_unverified_dropped: dropped.length, new_rules: fresh.map((n) => ({ id: n.team_rule_id, jurisdiction: n.jurisdiction, category: n.category, status: n.status, effective_date: n.effective_date, supersedes: n.supersedes || [] })), superseded, T6_affected: t6res.affected_address_ids.length, dry: argv.includes("--dry") }, null, 1));
