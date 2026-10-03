#!/usr/bin/env node
// Turns score.py output + T1-T6 results into report.html, for recording in a browser.
// Usage: node make-report.mjs [--score score.txt] [--selfcheck report.json] [--tests tests.json] [--out report.html]
//   report.json: `node selfcheck.mjs ... --json report.json` output. Rendered as a PROXY scorecard
//                (our own checks, not the judges' score) plus per-test check results; values are copied, never computed.
//   score.txt  : score.py stdout, saved verbatim and shown verbatim (format-independent;
//                nothing is parsed, so no number can be altered or invented here)
//   tests.json : [{"id":"T1","name":"...","expected":"...","result":"...","pass":true|false|null}, ...]
//                omit to show a TODO table. Real values only.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const here = dirname(fileURLToPath(import.meta.url));
const scoreFile = arg("--score"), selfFile = arg("--selfcheck"), testsFile = arg("--tests"), out = arg("--out") || join(here, "report.html");
if (!scoreFile && !selfFile) { console.error("usage: make-report.mjs [--score score.txt] [--selfcheck report.json] [--tests tests.json] [--out report.html]"); process.exit(2); }

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const score = scoreFile ? readFileSync(scoreFile, "utf8").trimEnd() : null;
const self = selfFile ? JSON.parse(readFileSync(selfFile, "utf8")) : null;
const DEFAULT = ["T1", "T2", "T3", "T4", "T5", "T6"].map((id) => ({ id, name: "TODO", expected: "", result: "TODO", pass: null }));
// Without --tests, a selfcheck report supplies T1-T5 from its own check results; T6 stays TODO (arrives at hour 16).
const fromSelf = self && ["T1", "T2", "T3", "T4", "T5"].map((id) => {
  const t = self.sections?.changes?.tests?.[id];
  if (!t) return { id, name: "not in report", expected: "", result: "—", pass: null };
  const checks = t.checks || [];
  return { id, name: "selfcheck", expected: checks.map((c) => c.name).join("; "), result: t.present ? `${checks.filter((c) => c.pass).length}/${checks.length} checks pass` : "not present in changes.json", pass: t.present ? checks.every((c) => c.pass) : null };
}).concat([{ id: "T6", name: "TODO", expected: "", result: "TODO (hour-16 ordinance)", pass: null }]);
const tests = testsFile ? JSON.parse(readFileSync(testsFile, "utf8")) : fromSelf || DEFAULT;
const sc = self?.scorecard;
const proxyRows = sc ? ["extraction", "address_coverage", "citations", "change_tracking"].filter((k) => sc[k]).map((k) => `<tr><td>${esc(k.replace("_", " "))}</td><td>${esc(sc[k].proxy)} / ${esc(sc[k].max)}</td><td>${esc(sc[k].basis)}</td></tr>`).join("\n") : "";
const proxyHtml = sc ? `<h1>Self-check scorecard (proxy)</h1>
<table><tr><th>Component</th><th>Proxy / max</th><th>Basis</th></tr>
${proxyRows}
<tr><td><b>Total</b></td><td><b>${esc(sc.total_proxy)} / ${esc(sc.total_max)}</b></td><td>${esc(sc.disclaimer)}</td></tr></table>` : "";
const mark = (p) => (p === true ? '<span class="ok">PASS</span>' : p === false ? '<span class="bad">FAIL</span>' : '<span class="mut">—</span>');
const rows = tests.map((t) => `<tr><td>${esc(t.id)}</td><td>${esc(t.name)}</td><td>${esc(t.expected)}</td><td>${esc(t.result)}</td><td>${mark(t.pass)}</td></tr>`).join("\n");

writeFileSync(out, `<!doctype html>
<meta charset="utf-8">
<title>Score report</title>
<style>
  :root{--bg:#0f1220;--fg:#f2f4ff;--mut:#9aa3c7;--acc:#6ee7b7;--bad:#f87171}
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--bg);color:var(--fg);font:20px/1.35 -apple-system,system-ui,sans-serif}
  body{padding:3vh 4vw}
  h1{font-size:34px;margin:0 0 .3em;color:var(--acc)}
  pre{background:#1b2040;border-radius:8px;padding:14px 18px;margin:0 0 1em;font:17px/1.35 ui-monospace,Menlo,monospace;white-space:pre-wrap}
  table{border-collapse:collapse;width:100%;font-size:18px}
  th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #2a3060;vertical-align:top}
  .ok{color:var(--acc);font-weight:700}.bad{color:var(--bad);font-weight:700}.mut{color:var(--mut)}
  footer{margin-top:1em;color:var(--mut);font-size:15px}
</style>
${proxyHtml}
${score ? `<h1>score.py — dev set</h1>\n<pre>${esc(score)}</pre>` : ""}
<h1>Change tests T1–T6</h1>
<table><tr><th>Test</th><th>What</th><th>Expected</th><th>Our result</th><th></th></tr>
${rows}
</table>
<footer>${score ? "score.py output is the organisers' own. " : ""}${sc ? "Proxy numbers are our own checks, not the judges' score. " : ""}Not legal advice.</footer>
`);
console.log("wrote " + out);
