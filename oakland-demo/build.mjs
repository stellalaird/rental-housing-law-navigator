// Builds oakland-demo/index.html: a timed replay of ONE real `node add-city.mjs` run (run-output.txt is its verbatim stdout),
// so record-demo.mjs can film it. The 105 s model wait is cut and captioned. Nothing here writes rules.json.
//   node oakland-demo/build.mjs && node record-demo.mjs oakland-demo/oakland-steps.json --out oakland.mp4
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
const here = import.meta.dirname, root = resolve(here, "..");
const L = readFileSync(join(here, "run-output.txt"), "utf8").split("\n");
const must = (re) => { const l = L.find((x) => re.test(x)); if (!l) throw new Error("missing in run-output: " + re); return l; };
const rules = JSON.parse(readFileSync(join(root, "rules.json"), "utf8")), arr = Array.isArray(rules) ? rules : rules.rules;
const cities = [...new Set(arr.map((r) => r.jurisdiction).filter((j) => /, [A-Z]{2}$/.test(j)))].sort();
const block = (id) => { const i = L.findIndex((x) => x.startsWith(`  ${id} `)); if (i < 0) throw new Error("no rule " + id); return L.slice(i, i + 3); };
const get = must(/^== 1\. GET/), fetched = must(/^fetched /).replace(/ -> .*/, ""), before = must(/^before /), took = must(/^ingest took/), after = must(/^after /), sample = must(/^sample addresses/);
const cmd = 'node add-city.mjs "https://cao-94612.s3.amazonaws.com/documents/TPO-Amendment-July-2020.pdf" --stack "CA|Alameda County, CA|Oakland, CA"';
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const clip = (l, k) => k === 0 && !/[.)]$/.test(l) ? l.replace(/\s+\S*$/, "") + "…" : k === 2 && !/[.]"$/.test(l) ? l.replace(/\s+\S*$/, "") + "…\"" : l;
const ruleHtml = (id) => block(id).map((l, k) => (l = clip(l, k),  `<div class="${k === 0 ? "r0" : k === 1 ? "cite" : "q"}">${esc(l)}</div>`)).join("");
const html = `<!doctype html><meta charset="utf-8"><title>Oakland live add</title>
<style>body{margin:0;background:#0f1419;color:#d6dde6;font:19px/1.45 ui-monospace,Menlo,monospace;padding:28px 40px;overflow:hidden}
h1{font:600 24px system-ui;margin:0 0 14px;color:#fff}.hide{display:none}.dim{color:#8a97a6}.ok{color:#5fd38d}.bad{color:#ff8a80}.hl{background:#243447;padding:2px 6px;border-radius:4px;color:#fff}
.cmd{color:#fff;word-break:break-all}.cap{position:fixed;left:0;right:0;bottom:0;background:#e8b04a;color:#111;font:600 26px system-ui;padding:16px 40px}
.r0{color:#fff}.cite{color:#7fc4ff;margin-left:20px}.q{color:#cfd6df;margin-left:20px;font-style:italic}.tag{display:inline-block;background:#243447;border-radius:4px;padding:1px 8px;margin:4px 6px 4px 0;font-size:16px}
.note{color:#e8b04a;margin-top:10px}.big{font:600 34px system-ui;color:#fff;margin-top:26px}pre{white-space:pre-wrap;margin:6px 0}</style>
<h1>Add a new city live: Oakland, CA</h1>
<div id="s1"><div class="dim">Cities in the live rules.json (${arr.length} rules):</div><div>${cities.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}</div>
<div class="bad" style="margin-top:8px">Oakland, CA is not one of them.</div></div>
<div id="s2" class="hide"><div class="dim">$ <span class="cmd" id="cmd"></span></div></div>
<div id="s3" class="hide"><pre>${esc(get)}\n${esc(fetched)}</pre><pre>== 2. BEFORE (the live rules.json, ${arr.length} rules)\n<span class="hl">${esc(before)}</span></pre></div>
<div id="s4" class="hide"><pre>== 3. INGEST into scratch copies (real rules.json and changes.json untouched)</pre></div>
<div id="s5" class="hide"><pre class="ok">${esc(took)}</pre><pre>== 4. AFTER (scratch rules.json)\n<span class="hl">${esc(after)}</span></pre>${ruleHtml("new-city-oakland-ca-1")}${ruleHtml("new-city-oakland-ca-10")}</div>
<div id="s6" class="hide"><div class="note">${esc(sample)}</div><div class="note">Source: a 2020 amendment ordinance, a partial text. No effective date is stated, so rules read "in force; no effective date stated".</div></div>
<div id="s7" class="hide"><div class="big">A new city: one official document, one command.<br>Same quote check and audit record as the other ten.</div></div>
<div class="cap hide" id="cap">(about 105 s of model extraction, cut)</div>
<script>
const $=(i)=>document.getElementById(i),show=(...a)=>a.forEach((i)=>$(i).classList.remove("hide")),hide=(...a)=>a.forEach((i)=>$(i).classList.add("hide")),at=(ms,f)=>setTimeout(f,ms);
const CMD=${JSON.stringify(cmd)};
at(6800,()=>{hide("s1");show("s2");let i=0;const t=setInterval(()=>{$("cmd").textContent=CMD.slice(0,i+=4);if(i>=CMD.length)clearInterval(t)},45)});
at(12500,()=>{show("s3")});
at(18500,()=>{show("s4");show("cap")});
at(23800,()=>{hide("s2","s3","s4","cap");show("s5")});
at(36300,()=>{hide("s5");show("s6")});
at(47800,()=>{hide("s6");show("s7")});
</script>`;
writeFileSync(join(here, "index.html"), html);
console.log("wrote oakland-demo/index.html,", cities.length, "cities");
