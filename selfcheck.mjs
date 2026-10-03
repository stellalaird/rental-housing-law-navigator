#!/usr/bin/env node
// Local self-check for the Rental Housing Law Navigator submission. NOT the judges' score.py (absent from our pack).
// Usage: node selfcheck.mjs [--rules rules.json] [--lookups lookups.json] [--changes changes.json]
//        [--pack "data/starter/participant-final-no-hour16 3"] [--json report.json]
// Checks only what the pack lets us verify without an answer key: schema validity, quoted spans found in the
// cited corpus doc, lookup coverage of every address, change-test sanity (T1-T5). Scores are PROXIES.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const pack = flag("--pack", "data/starter/participant-final-no-hour16 3");
const rulesPath = flag("--rules", "rules.json"), lookupsPath = flag("--lookups", "lookups.json"), changesPath = flag("--changes", "changes.json");
const jsonOut = flag("--json", null);

const load = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch (e) { return { __error: `${p}: ${e.code === "ENOENT" ? "missing" : e.message}` }; } };
const norm = (s) => String(s).replace(/\s+/g, " ").trim().toLowerCase();
const parseCsv = (txt) => { // minimal RFC4180 reader
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...r] = rows; return r.filter((x) => x.length > 1).map((x) => Object.fromEntries(h.map((k, i) => [k, x[i] ?? ""])));
};

const schema = load(join(pack, "schema/rule_record.schema.json"));
const addresses = parseCsv(readFileSync(join(pack, "data/sample_addresses.csv"), "utf8"));
const manifest = parseCsv(readFileSync(join(pack, "corpus/corpus_manifest.csv"), "utf8"));
const docText = {};
for (const m of manifest) if (m.text_file) { try { docText[m.doc_id] = norm(readFileSync(join(pack, "corpus", m.text_file), "utf8")); } catch {} }

const report = { generated: new Date().toISOString(), note: "Local proxy; not judges' score.py. No answer key available.", inputs: { rulesPath, lookupsPath, changesPath }, sections: {} };

// ---- Module A: schema + citations
const rulesDoc = load(rulesPath);
const rules = Array.isArray(rulesDoc) ? rulesDoc : rulesDoc.rules;
const A = { present: !!rules, errors: rulesDoc.__error ? [rulesDoc.__error] : [] };
const ruleById = new Map(), ruleSpanOk = new Map();
if (rules) {
  const typeOk = (v, t) => (Array.isArray(t) ? t : [t]).some((x) => x === "null" ? v === null : x === "array" ? Array.isArray(v) : x === "number" ? typeof v === "number" : typeof v === x);
  let schemaOk = 0, spanOk = 0, spanMissingDoc = 0; const bad = [];
  for (const r of rules) {
    const e = [];
    for (const k of schema.required) if (r[k] === undefined || r[k] === null || r[k] === "") e.push(`missing ${k}`);
    for (const [k, p] of Object.entries(schema.properties)) {
      const v = r[k]; if (v === undefined) continue;
      if (p.enum && !p.enum.includes(v)) e.push(`${k}=${JSON.stringify(v)} not in enum`);
      if (p.type && !typeOk(v, p.type)) e.push(`${k} wrong type`);
      if (p.minLength && typeof v === "string" && v.length < p.minLength) e.push(`${k} shorter than ${p.minLength}`);
      if (p.pattern && typeof v === "string" && !new RegExp(p.pattern).test(v)) e.push(`${k} fails pattern`);
      if (p.minimum !== undefined && typeof v === "number" && (v < p.minimum || v > p.maximum)) e.push(`${k} out of range`);
    }
    if (ruleById.has(r.team_rule_id)) e.push("duplicate team_rule_id");
    ruleById.set(r.team_rule_id, r);
    if (!e.length) schemaOk++; else bad.push({ id: r.team_rule_id, errors: e });
    // citation: quoted span found verbatim (whitespace/case-normalised) in the cited doc
    let ok = false;
    if (r.quoted_span && r.source_doc_id && docText[r.source_doc_id]) ok = docText[r.source_doc_id].includes(norm(r.quoted_span));
    else if (r.quoted_span && r.source_doc_id && !docText[r.source_doc_id]) spanMissingDoc++;
    ruleSpanOk.set(r.team_rule_id, ok); if (ok) spanOk++;
  }
  Object.assign(A, { rules: rules.length, schemaValid: schemaOk, schemaInvalid: bad.slice(0, 20), spanFound: spanOk, spanDocMissing: spanMissingDoc,
    byCategory: Object.fromEntries([...new Set(rules.map((r) => r.category))].map((c) => [c, rules.filter((r) => r.category === c).length])),
    byJurisdiction: Object.fromEntries([...new Set(rules.map((r) => r.jurisdiction))].map((c) => [c, rules.filter((r) => r.jurisdiction === c).length])) });
}
report.sections.extraction = A;

// ---- Module B: lookups
const lk = load(lookupsPath);
const B = { present: !lk.__error, errors: lk.__error ? [lk.__error] : [] };
const RESULTS = ["applies", "unknown", "superseded", "not_yet_effective", "pending"];
if (!lk.__error) {
  const L = lk.lookups || {}; const ids = addresses.map((a) => a.address_id);
  const covered = ids.filter((id) => Array.isArray(L[id])).length;
  let entries = 0, badResult = 0, unknownRule = 0, applies = 0, appliesCited = 0; const dist = {};
  for (const id of Object.keys(L)) for (const x of L[id] || []) {
    entries++; dist[x.result] = (dist[x.result] || 0) + 1;
    if (!RESULTS.includes(x.result)) badResult++;
    if (!ruleById.has(x.team_rule_id)) unknownRule++;
    if (x.result === "applies") { applies++; if (ruleSpanOk.get(x.team_rule_id)) appliesCited++; }
  }
  Object.assign(B, { as_of: lk.as_of, addresses: ids.length, addressesCovered: covered, extraIds: Object.keys(L).filter((i) => !ids.includes(i)).length,
    entries, badResult, entriesWithUnknownRuleId: unknownRule, resultCounts: dist, appliesAnswers: applies, appliesWithVerifiedSpan: appliesCited });
}
report.sections.lookups = B;

// ---- Module C: change tests (sanity only; judges hold the expected sets)
const ch = load(changesPath);
const C = { present: !ch.__error, errors: ch.__error ? [ch.__error] : [], tests: {} };
if (!ch.__error) {
  const tests = load(join(pack, "dev/change_tests.json"));
  const byState = (s) => new Set(addresses.filter((a) => a.state === s).map((a) => a.address_id));
  const byCity = (c) => new Set(addresses.filter((a) => a.postal_city.toLowerCase() === c).map((a) => a.address_id));
  const ST = { CA: byState("CA"), NJ: byState("NJ"), MA: byState("MA") };
  const sub = (a, b) => [...a].every((x) => b.has(x));
  for (const t of tests) {
    const r = ch[t.test_id]; const out = { present: !!r, checks: [] };
    if (r) {
      const aff = new Set(r.affected_address_ids || []), flg = new Set(r.conflict_flag_address_ids || []);
      const chk = (name, pass) => out.checks.push({ name, pass: !!pass });
      chk("addresses exist", [...aff].every((x) => addresses.some((a) => a.address_id === x)));
      if (t.test_id === "T1") chk("all CA addresses affected", sub(ST.CA, aff) && sub(aff, ST.CA));
      if (t.test_id === "T3") { chk("all NJ addresses affected", sub(ST.NJ, aff) && sub(aff, ST.NJ)); chk("conflict flags non-empty, within affected", flg.size > 0 && sub(flg, aff)); }
      if (t.test_id === "T4") chk("all MA addresses affected", sub(ST.MA, aff) && sub(aff, ST.MA));
      if (t.test_id === "T5") chk("affected set empty", aff.size === 0);
      if (t.test_id === "T2") { const ok = new Set([...byCity("hoboken"), ...byCity("jersey city")]); chk("only Hoboken/Jersey City postal cities (proxy for legal city)", sub(aff, ok)); chk("no Newark", ![...aff].some((x) => byCity("newark").has(x))); }
    }
    C.tests[t.test_id] = out;
  }
}
report.sections.changes = C;

// ---- Referential integrity: every rule id in lookups.json and changes.json must exist in rules.json.
// A dangling id is a broken join (e.g. a rules.json consolidation that renumbered ids), not a citation shortfall.
const dangling = { lookups: {}, changes: {} };
if (!lk.__error) for (const [aid, es] of Object.entries(lk.lookups || {})) for (const x of es || [])
  if (!ruleById.has(x.team_rule_id)) (dangling.lookups[x.team_rule_id] ??= []).push(aid);
const walkIds = (v, path, fn) => { if (Array.isArray(v)) v.forEach((x, i) => walkIds(x, `${path}[${i}]`, fn)); else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
  if (/^(team_)?rule_ids?$/.test(k)) [].concat(x).forEach((id) => typeof id === "string" && fn(id, `${path}.${k}`)); else walkIds(x, `${path}.${k}`, fn); } };
if (!ch.__error) walkIds(ch, "changes", (id, where) => { if (!ruleById.has(id)) (dangling.changes[id] ??= []).push(where); });
const nDangling = Object.keys(dangling.lookups).length + Object.keys(dangling.changes).length;
report.sections.referentialIntegrity = { ok: nDangling === 0, danglingLookupRuleIds: Object.fromEntries(Object.entries(dangling.lookups).map(([id, a]) => [id, a.length])), danglingChangeRuleIds: dangling.changes };

// ---- T6 (hour-16 ordinance): skipped while changes.json has no T6; once it does, every check below must pass.
// changes.json T6 carries no rule id of its own (ingest-doc.mjs), so the rule is the id(s) it names if any, else the
// new-* rules (Cambridge ones if any, else every new-* rule). The affected set is checked against each rule's own
// jurisdiction ("City, ST" = postal city + state, a proxy for legal city; bare "ST" = state). "Today" is --today YYYY-MM-DD or the local date.
const today = flag("--today", new Date().toLocaleDateString("en-CA"));
const T6 = { present: !ch.__error && !!ch.T6, skipped: true, today, checks: [] };
if (T6.present) {
  T6.skipped = false;
  const t6 = ch.T6, named = []; walkIds(t6, "T6", (id) => named.push(id));
  const cands = named.length ? named.map((id) => ruleById.get(id)).filter(Boolean)
    : (() => { const nw = rules.filter((r) => /^new-/.test(r.team_rule_id)), cam = nw.filter((r) => /cambridge/i.test(r.jurisdiction)); return cam.length ? cam : nw; })();
  T6.ruleSource = named.length ? "named in T6" : "new-* rules (T6 names none)";
  T6.ruleIds = cands.map((r) => r.team_rule_id);
  const chk6 = (name, pass, detail) => T6.checks.push({ name, pass: !!pass, ...(detail ? { detail } : {}) });
  chk6("T6 rule id exists in rules.json", cands.length > 0 && cands.length >= named.length, named.length ? `named ${named.join(", ")}` : "no new-* rule in rules.json");
  const full = (r) => /^\d{4}-\d{2}-\d{2}/.test(String(r.effective_date || "")) ? String(r.effective_date).slice(0, 10) : null;
  chk6("status is not_yet_effective", cands.length > 0 && cands.every((r) => r.status === "not_yet_effective"), cands.map((r) => `${r.team_rule_id}=${r.status}`).join(", "));
  chk6(`effective date is a full date after ${today}`, cands.length > 0 && cands.every((r) => full(r) && full(r) > today), cands.map((r) => `${r.team_rule_id}=${r.effective_date}`).join(", "));
  const aff6 = t6.affected_address_ids || [], byId = new Map(addresses.map((a) => [a.address_id, a]));
  const inJur = (a, j) => { const m = /^(.+),\s*([A-Z]{2})$/.exec(String(j || "").trim()); if (m) return !!a && a.postal_city.toLowerCase() === m[1].toLowerCase() && a.state === m[2]; return /^[A-Z]{2}$/.test(String(j || "").trim()) && !!a && a.state === j.trim(); };
  const outside = aff6.filter((id) => !cands.some((r) => inJur(byId.get(id), r.jurisdiction)));
  const jurs = [...new Set(cands.map((r) => r.jurisdiction))].join(" / ");
  chk6("affected set non-empty", aff6.length > 0, `${aff6.length} addresses`);
  chk6(`affected set limited to the rule's jurisdiction (${jurs || "none"}; postal city, proxy for legal city)`, cands.length > 0 && outside.length === 0, outside.slice(0, 5).join(", "));
}
report.sections.t6 = T6;

// ---- Module D (opt-in, --gold gold.json): compare against the hand-made mini gold set. Not part of the proxy total.
const goldPath = flag("--gold", null);
if (goldPath) {
  const gold = load(goldPath), D = { rules: [], addresses: [] };
  if (gold.__error) D.error = gold.__error;
  else {
    const jur = existsSync("jurisdictions.json") ? load("jurisdictions.json").by_address || {} : {};
    const L = lk.lookups || {}, cand = {};
    for (const g of gold.rules) {
      const c = (rules || []).filter((r) => r.source_doc_id === g.doc && r.jurisdiction === g.jurisdiction && r.category === g.category);
      cand[g.id] = c.map((r) => r.team_rule_id);
      const r = c.find((x) => g.effective_date && x.effective_date === g.effective_date) || c[0];
      D.rules.push({ id: g.id, found: !!r, status: r ? r.status === g.status : false, effective_date: r ? (g.effective_date ? r.effective_date === g.effective_date : true) : false,
        key_value: r ? (g.key_value ? norm(r.key_value ?? "").includes(norm(g.key_value).replace(/\.0%$/, "")) : true) : false, span_in_doc: r ? !!ruleSpanOk.get(r.team_rule_id) : false });
    }
    for (const a of gold.addresses) {
      const j = jur[a.id], row = { id: a.id, jurisdiction: j ? (a.jurisdiction.status === "unknown" ? j.status !== "ok" : j.status === "ok" && j.stack?.at(-1) === a.jurisdiction.place) : false, rules: {} };
      for (const [gid, want] of Object.entries(a.expect)) {
        const got = (L[a.id] || []).filter((x) => cand[gid]?.includes(x.team_rule_id)).map((x) => x.result);
        row.rules[gid] = { want, got: got.join("|") || "(none)", pass: want === "not_applicable" ? !got.includes("applies") : want === "unknown" ? !got.includes("applies") && !got.includes("not_yet_effective") : got.includes(want) };
      }
      D.addresses.push(row);
    }
    const rc = D.rules.length, ap = D.addresses.flatMap((x) => Object.values(x.rules));
    D.summary = { rulesFound: `${D.rules.filter((x) => x.found).length}/${rc}`, status: `${D.rules.filter((x) => x.status).length}/${rc}`, effective_date: `${D.rules.filter((x) => x.effective_date).length}/${rc}`, key_value: `${D.rules.filter((x) => x.key_value).length}/${rc}`,
      jurisdiction: `${D.addresses.filter((x) => x.jurisdiction).length}/${D.addresses.length}`, lookups: `${ap.filter((x) => x.pass).length}/${ap.length}` };
  }
  report.sections.gold = D;
  console.log(`GOLD (${goldPath}): ${D.error || JSON.stringify(D.summary)}`);
  for (const a of D.addresses || []) for (const [g, x] of Object.entries(a.rules)) if (!x.pass) console.log(`  MISS ${a.id} ${g}: want ${x.want}, got ${x.got}`);
  for (const r of D.rules || []) if (!(r.found && r.status && r.effective_date && r.key_value && r.span_in_doc)) console.log(`  RULE ${r.id}: ${JSON.stringify(r)}`);
}

// ---- scorecard (PROXY points mirroring rubric weights)
const frac = (n, d) => (d ? n / d : 0);
const aPts = A.rules ? 25 * frac(A.schemaValid, A.rules) : 0;
const bPts = B.addresses ? 20 * frac(B.addressesCovered, B.addresses) * (B.entries ? 1 - frac(B.badResult + B.entriesWithUnknownRuleId, B.entries) : 0) : 0;
const cPts = B.appliesAnswers ? 15 * frac(B.appliesWithVerifiedSpan, B.appliesAnswers) : 0;
const checks = Object.values(C.tests || {}).flatMap((t) => (t.present ? t.checks : [{ pass: false }]));
const dPts = checks.length ? 15 * frac(checks.filter((x) => x.pass).length, checks.length) : 0;
report.scorecard = {
  disclaimer: "PROXY points. Real scoring uses a held-out key we do not have: extraction accuracy vs key, applies/unknown correctness, and affected-set overlap are NOT measured here.",
  extraction: { max: 25, proxy: +aPts.toFixed(1), basis: "share of rule records passing schema" },
  address_coverage: { max: 20, proxy: +bPts.toFixed(1), basis: "share of addresses with a lookup list, minus invalid entries" },
  citations: { max: 15, proxy: +cPts.toFixed(1), basis: "share of 'applies' answers whose rule quoted_span is found verbatim in its source doc" },
  change_tracking: { max: 15, proxy: +dPts.toFixed(1), basis: "share of T1-T5 sanity checks passed" },
  total_proxy: +(aPts + bPts + cPts + dPts).toFixed(1), total_max: 75,
};

if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 2));
const S = report.scorecard;
console.log(`SELF-CHECK (proxy, not judges' score.py)  ${report.generated}`);
console.log(`rules:    ${A.present ? `${A.rules} records, ${A.schemaValid} schema-valid, ${A.spanFound} quoted spans found in corpus` : (A.errors[0] || "absent")}`);
console.log(`lookups:  ${B.present ? `${B.addressesCovered}/${B.addresses} addresses, ${B.entries} entries, ${B.badResult} bad result values, ${B.entriesWithUnknownRuleId} unknown rule ids; ${B.appliesWithVerifiedSpan}/${B.appliesAnswers} applies cited` : (B.errors[0] || "absent")}`);
for (const [id, t] of Object.entries(C.tests || {})) console.log(`  ${id}: ${t.present ? t.checks.map((c) => `${c.pass ? "ok" : "FAIL"} ${c.name}`).join("; ") : "MISSING"}`);
console.log(`Extraction        ${S.extraction.proxy} / 25`);
console.log(`Address coverage  ${S.address_coverage.proxy} / 20`);
console.log(`Citations         ${S.citations.proxy} / 15`);
console.log(`Change tracking   ${S.change_tracking.proxy} / 15`);
console.log(`TOTAL (proxy)     ${S.total_proxy} / 75   (judged 25 not scored)`);
if (nDangling) {
  console.log(`\n!!! REFERENTIAL INTEGRITY FAILED: ${nDangling} rule id(s) in lookups/changes are not in ${rulesPath} (broken join, not a citation shortfall)`);
  for (const [id, a] of Object.entries(dangling.lookups)) console.log(`  lookups: ${id} dangling in ${a.length} entries (e.g. ${a.slice(0, 3).join(", ")})`);
  for (const [id, w] of Object.entries(dangling.changes)) console.log(`  changes: ${id} at ${w.slice(0, 3).join(", ")}`);
  process.exitCode = 1;
}
if (T6.skipped) console.log("\nT6 check: skipped (no T6 entry in " + changesPath + ")");
else {
  const bad = T6.checks.filter((c) => !c.pass);
  console.log(`\nT6 check (as of ${T6.today}; rule via ${T6.ruleSource}): ${bad.length ? "FAILED" : "ok"}`);
  for (const c of T6.checks) console.log(`  ${c.pass ? "pass" : "FAIL"}  ${c.name}${c.pass || !c.detail ? "" : "  [" + c.detail + "]"}`);
  if (bad.length) process.exitCode = 1;
}
