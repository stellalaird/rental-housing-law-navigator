#!/usr/bin/env node
// Module C output: changes.json for tests T1-T5 (T6 is added by ingest-doc.mjs), computed from rules.json + jurisdictions.json.
// Usage: node make-changes.mjs [--rules rules.json] [--pack "<pack dir>"] [--jur jurisdictions.json] [--out changes.json] [--extra tests.json]
// Rule ids in dev/change_tests.json (CA-ALG-01, JC-ALG-01 ...) are the organisers' ids, not ours. Each test is resolved to OUR rules by
// jurisdiction + category (+ status), through PREFIX/CAT below. If no such rule was extracted the test falls back to its written spec and
// the note says so, so a missed extraction never silently empties an answer.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRules, statusOn, fullDate } from "./changelog.mjs";

const PREFIX = { CA: "CA", NJ: "NJ", MA: "MA", HOB: "Hoboken, NJ", JC: "Jersey City, NJ" };
const CAT = { ALG: "algorithmic_rent_setting", RENT: "rent_increase_limits" };
const parseCsv = (t) => { const [h, ...r] = t.trim().split(/\r?\n/); const k = h.split(","); return r.map((l) => { const c = []; let f = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { c.push(f); f = ""; } else f += ch; } c.push(f); return Object.fromEntries(k.map((x, i) => [x, c[i] ?? ""])); }); };

export function makeChanges({ rules, tests, addresses, jur, extra = [] }) {
  const stackOf = (a) => jur[a.address_id]?.stack || null;
  const inJ = (a, j) => (j.includes(",") ? !!stackOf(a)?.includes(j) : a.state === j);   // state: CSV state (covers unknown/state_only); city: legal stack only
  const addrIn = (j) => addresses.filter((a) => inJ(a, j)).map((a) => a.address_id);
  const ruleFor = (id) => { const [p, c] = id.split("-"); const jn = PREFIX[p], cat = CAT[c]; return rules.filter((r) => r.jurisdiction === jn && r.category === cat); };
  const out = {};
  for (const t of [...tests, ...extra]) {
    const ids = t.rule_ids || [], found = ids.map((id) => ({ id, j: PREFIX[id.split("-")[0]], rs: ruleFor(id) }));
    const missing = found.filter((f) => !f.rs.length).map((f) => f.id);
    const notes = [];
    let affected = new Set(), conflict = new Set();
    if (t.type === "as_of") {
      for (const f of found) {
        // Affected = addresses in that jurisdiction whose status differs between the two query dates (T1, T3).
        const changed = f.rs.length ? f.rs.some((r) => statusOn(annotateOne(r, rules), t.as_of_before) !== statusOn(annotateOne(r, rules), t.as_of_after)) : true;
        if (changed) addrIn(f.j).forEach((a) => affected.add(a));
        notes.push(f.rs.length ? `${f.j}: ${f.rs.map((r) => `${r.team_rule_id} ${statusOn(annotateOne(r, rules), t.as_of_before)} on ${t.as_of_before}, ${statusOn(annotateOne(r, rules), t.as_of_after)} on ${t.as_of_after}`).join("; ")}.` : `${f.j}: no extracted rule, used test spec.`);
      }
      for (const cid of t.conflict_with || []) { const cj = PREFIX[cid.split("-")[0]]; addrIn(cj).forEach((a) => affected.has(a) && conflict.add(a)); }
      if ((t.conflict_with || []).length) notes.push(`Possible preemption of ${t.conflict_with.join(", ")}: addresses in those cities flagged for human review.`);
    } else if (t.type === "boundary") {
      for (const f of found) addrIn(f.j).forEach((a) => affected.add(a));
      notes.push(`Each city rule applies only inside its own legal city (Census geocoder, not postal city): ${found.map((f) => f.j).join(", ")}.`);
    } else if (t.type === "pending") {
      for (const st of t.states || []) addrIn(st).forEach((a) => affected.add(a));
      notes.push(`Pending, not law as of ${t.as_of}. Listed set is every address in ${(t.states || []).join(", ")} that the bills would reach if enacted.`);
    } else if (t.type === "negative") {
      notes.push("Struck / failed measure: not law, so no address is affected.");
    } else if (t.type === "new_document") {
      for (const j of t.jurisdictions || []) addrIn(j).forEach((a) => affected.add(a));
    }
    if (missing.length) notes.push(`No extracted rule for ${missing.join(", ")}; those parts follow the test's written spec.`);
    out[t.test_id] = { affected_address_ids: [...affected].sort(), ...(t.type === "as_of" && (t.conflict_with || []).length ? { conflict_flag_address_ids: [...conflict].sort() } : {}), notes: notes.join(" ") };
  }
  return out;
}
function annotateOne(r, all) { // effective_to from a superseding rule, same linking as changelog.mjs
  const s = all.find((x) => [].concat(x.supersedes || []).includes(r.team_rule_id));
  return { ...r, effective_from: fullDate(r.effective_from ?? r.effective_date), effective_to: fullDate(r.effective_to) ?? (s ? fullDate(s.effective_from ?? s.effective_date) : null) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const pack = flag("--pack", "data/starter/participant-final-no-hour16 3");
  const rules = loadRules(flag("--rules", "rules.json"));
  const tests = JSON.parse(readFileSync(join(pack, "dev/change_tests.json"), "utf8"));
  const addresses = parseCsv(readFileSync(join(pack, "data/sample_addresses.csv"), "utf8"));
  const jur = JSON.parse(readFileSync(flag("--jur", "jurisdictions.json"), "utf8")).by_address;
  const extra = flag("--extra") ? JSON.parse(readFileSync(flag("--extra"), "utf8")) : [];
  const res = makeChanges({ rules, tests, addresses, jur, extra });
  writeFileSync(flag("--out", "changes.json"), JSON.stringify(res, null, 2) + "\n");
  for (const [k, v] of Object.entries(res)) console.log(k, v.affected_address_ids.length, "affected", v.conflict_flag_address_ids ? v.conflict_flag_address_ids.length + " flagged" : "");
}
