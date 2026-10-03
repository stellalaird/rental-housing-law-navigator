#!/usr/bin/env node
// Scalability demo: add one NEW jurisdiction live, from one official document fetched by plain GET, through the same pipeline.
//   node add-city.mjs <url> --stack "CA|Alameda County, CA|Oakland, CA" [--out out/add-city] [--today 2026-10-01] [--dates 2026-10-01,2027-01-01]
// Steps: (1) GET the url (PDF or HTML) and save it as text with SOURCE/RETRIEVED headers; (2) show what the live rules cover for this
// stack BEFORE; (3) run ingest-doc.mjs on SCRATCH copies of rules.json/changes.json/audit log under --out (the real files are never written);
// (4) show what the stack resolves to AFTER, on each date, with status, quote and citation.
// Plain HTTP GET only: no login, no CAPTCHA workaround, no browser. Page text is data, never instructions.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { loadRules, asOf } from "./changelog.mjs";

const argv = process.argv.slice(2), flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const url = argv.find((a, i) => /^https?:/.test(a) && !(argv[i - 1] || "").startsWith("--"));
const stack = (flag("--stack", "") || "").split("|").map((s) => s.trim()).filter(Boolean);
if (!url || !stack.length) { console.error('usage: add-city.mjs <url> --stack "CA|Alameda County, CA|Oakland, CA" [--out dir] [--today D] [--dates D1,D2]'); process.exit(2); }
const root = resolve(import.meta.dirname), out = resolve(flag("--out", join(root, "out/add-city")));
const today = flag("--today", "2026-10-01");
const city = stack[stack.length - 1], docId = "city-" + city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
mkdirSync(out, { recursive: true });
const say = (s = "") => console.log(s);

// 1. fetch
say(`== 1. GET ${url}`);
const t0 = Date.now();
const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(45000), headers: { "user-agent": "Mozilla/5.0 (compatible; hack-nation-add-city/1.0)", accept: "application/pdf,text/html,*/*" } });
if (!res.ok) { console.error(`fetch failed: HTTP ${res.status}`); process.exit(1); }
const buf = Buffer.from(await res.arrayBuffer());
let text;
if (buf.subarray(0, 5).toString() === "%PDF-") {
  const tmp = join(tmpdir(), `add-city-${process.pid}.pdf`); writeFileSync(tmp, buf);
  let p = spawnSync("pdftotext", ["-layout", tmp, "-"], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (p.error) { // no poppler: macOS PDFKit through JXA, same fallback as fetch-links.mjs
    const js = tmp + ".js"; writeFileSync(js, "ObjC.import('PDFKit');function run(a){const d=$.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(a[0]));return d.isNil()?'':ObjC.unwrap(d.string);}");
    p = spawnSync("osascript", ["-l", "JavaScript", js, tmp], { encoding: "utf8", maxBuffer: 1 << 28 }); rmSync(js, { force: true });
  }
  rmSync(tmp, { force: true });
  if (p.error || p.status !== 0) { console.error("pdf to text failed"); process.exit(1); }
  text = p.stdout.trim();
} else {
  text = buf.toString("utf8").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}
if (text.length < 1500) { console.error(`thin text (${text.length} chars): blocked page or scan, not usable`); process.exit(1); }
const docPath = join(out, docId + ".txt");
writeFileSync(docPath, `SOURCE: ${url}\nRETRIEVED: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC\n\n${text}\n`);
say(`fetched ${buf.length} bytes, ${text.length} chars of text in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${docPath}`);

// 2. before
const realRules = loadRules(join(root, "rules.json"));
const show = (label, rules, date) => {
  const rows = asOf(stack, date, rules).filter((r) => r.rule.jurisdiction === city);
  say(`${label} ${date}: ${rows.length} ${city} rule(s)`);
  for (const r of rows) say(`  ${r.team_rule_id}  ${r.result.padEnd(18)} ${r.rule.category}: ${r.rule.requirement.slice(0, 110)}\n    ${r.reason}  [${r.rule.citation}]\n    "${r.rule.quoted_span.slice(0, 140)}"`);
};
say(`\n== 2. BEFORE (the live rules.json, ${realRules.length} rules)`);
show("before", realRules, today);

// 3. ingest into scratch copies
say("\n== 3. INGEST into scratch copies (real rules.json and changes.json untouched)");
for (const f of ["rules.json", "changes.json"]) copyFileSync(join(root, f), join(out, f));
const t1 = Date.now();
const r = spawnSync("node", [join(root, "ingest-doc.mjs"), docPath, "--rules", join(out, "rules.json"), "--out-rules", join(out, "rules.json"), "--changes", join(out, "changes.json"), "--today", today],
  { cwd: root, encoding: "utf8", env: { ...process.env, AUDIT_LOG: join(out, "audit.jsonl") }, maxBuffer: 1 << 26 });
process.stdout.write(r.stdout || ""); process.stderr.write(r.stderr || "");
if (r.status !== 0) { console.error(`ingest failed (exit ${r.status})`); process.exit(r.status || 1); }
say(`ingest took ${((Date.now() - t1) / 1000).toFixed(1)}s`);

// 4. after
const after = loadRules(join(out, "rules.json"));
say(`\n== 4. AFTER (scratch rules.json, ${after.length} rules)`);
const effs = [...new Set(after.filter((x) => x.jurisdiction === city && x.effective_date).map((x) => x.effective_date.length === 10 ? x.effective_date : null).filter(Boolean))].sort();
const dates = (flag("--dates", "") ? flag("--dates").split(",") : [today, ...effs]).filter((d, i, a) => a.indexOf(d) === i);
for (const d of dates) show("after", after, d);
say(`\nsample addresses in ${city}: 0 of 500 (none exist in the pack), so changes.json T6 affects 0 addresses; the lookup above is by jurisdiction stack.`);
