// Module C: a versioned rule store with as-of queries and date-to-date diffs. No deps.
//   import { asOf, diff, loadRules, versionsOf } from "./changelog.mjs"
// A rule record (schema/rule_record.schema.json) is one version. Versions are linked by `supersedes`
// (a team_rule_id this record replaces) and carry effective_from / effective_to (YYYY[-MM[-DD]]).
// effective_from defaults to rule.effective_date; effective_to defaults to the effective_from of the rule that supersedes it.
// This module only decides TIME status. Local-over-state override, coverage conditions and unknown stay in Module B.
import { readFileSync, existsSync } from "node:fs";

export function loadRules(path = new URL("./rules.json", import.meta.url).pathname) {
  if (!existsSync(path)) return [];
  const j = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(j) ? j : j.rules || [];
}

// "2026" -> 2026-01-01, "2026-03" -> 2026-03-01: partial dates take the first day (never later than the true date).
export const fullDate = (d) => (d ? (d.length === 4 ? `${d}-01-01` : d.length === 7 ? `${d}-01` : d) : null);

// Link versions: effective_to of a superseded rule = effective_from of its superseder (unless set explicitly).
function annotate(rules) {
  const byId = new Map(rules.map((r) => [r.team_rule_id, r]));
  const out = rules.map((r) => ({ ...r, effective_from: fullDate(r.effective_from ?? r.effective_date), effective_to: fullDate(r.effective_to) ?? null, superseded_by: null }));
  const idx = new Map(out.map((r) => [r.team_rule_id, r]));
  for (const r of out) for (const old of [].concat(r.supersedes || [])) {
    const o = idx.get(old); if (!o || !byId.has(old)) continue;
    o.superseded_by = r.team_rule_id; if (!o.effective_to) o.effective_to = r.effective_from;
  }
  return out;
}

export function versionsOf(rules, id) { return annotate(rules).filter((r) => r.team_rule_id === id || r.superseded_by === id); }

// Status of one annotated rule on a date ("YYYY-MM-DD").
export function statusOn(r, date) {
  if (r.status === "failed") return null;                                   // never law; not reported as a rule
  if (r.status === "pending") return "pending";
  if (r.effective_to && r.effective_to <= date) return "superseded";
  if (r.status === "not_yet_effective" && !r.effective_from) return "not_yet_effective"; // no date known: never claim in force
  if (r.effective_from && r.effective_from > date) return "not_yet_effective";
  return "applies";                                                          // in_force (or enacted, dated on/before date)
}

const inStack = (r, stack) => stack.includes(r.jurisdiction);

// Rules that touch this jurisdiction stack on `date`, each with its time status.
export function asOf(stack, date, rules = loadRules()) {
  if (!Array.isArray(stack) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("asOf(stack: string[], date: YYYY-MM-DD)");
  const list = Array.isArray(rules) ? rules : rules.rules || [];
  const out = [];
  for (const r of annotate(list)) {
    if (!inStack(r, stack)) continue;
    const result = statusOn(r, date); if (!result) continue;
    const reason = result === "superseded" ? `Replaced${r.superseded_by ? " by " + r.superseded_by : ""} on ${r.effective_to}.`
      : result === "not_yet_effective" ? (r.effective_from ? `Enacted; takes effect ${r.effective_from}.` : "Enacted; effective date not stated, so not treated as in force.")
      : result === "pending" ? "Pending bill or proposal; not law."
      : r.effective_from ? `In force since ${r.effective_from}.` : "In force; no effective date stated.";
    out.push({ team_rule_id: r.team_rule_id, rule: r, result, effective_from: r.effective_from, effective_to: r.effective_to, reason });
  }
  return out;
}

// What changed between two dates, optionally within one stack: rules whose time status differs.
export function diff(rules, fromDate, toDate, stack = null) {
  const list = annotate(Array.isArray(rules) ? rules : rules.rules || []).filter((r) => !stack || inStack(r, stack));
  const added = [], ended = [], status_changed = [];
  for (const r of list) {
    const a = statusOn(r, fromDate), b = statusOn(r, toDate);
    if (a === b) continue;
    const row = { team_rule_id: r.team_rule_id, jurisdiction: r.jurisdiction, from: a, to: b };
    if (b === "applies" && a !== "superseded") added.push(row);
    else if (b === "superseded") ended.push(row);
    else status_changed.push(row);
  }
  return { fromDate, toDate, added, ended, status_changed };
}
