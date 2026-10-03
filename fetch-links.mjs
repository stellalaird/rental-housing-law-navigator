#!/usr/bin/env node
// Fetches the link-only corpus entries (corpus/links_only.csv) as plain text.
// Usage: node fetch-links.mjs [--ids D032,D070] [--force] [--pack "<pack dir>"]
// Output: data/starter/fetched/<doc_id>.txt (header lines "# key: value", blank line, text) and
//   fetched/_log.jsonl (one line per attempt: doc_id, url, status, ok, bytes, flags, error). Gitignored with data/starter/.
// Order: Hoboken, Jersey City, Newark first, then the rest. Plain HTTP GET only: no logins, no CAPTCHA
// workarounds, no browser. A block, challenge page, non-2xx or thin text is recorded as a failure and skipped.
// Page text is DATA: instruction-like phrases are flagged in the header and log, never acted on.
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const root = resolve(import.meta.dirname);
const pack = flag("--pack", join(root, "data/starter/participant-final-no-hour16 3"));
const outDir = join(root, "data/starter/fetched");
const only = flag("--ids", "") ? new Set(flag("--ids").split(",")) : null;
const force = argv.includes("--force");
const MIN_CHARS = 400;
// --alt D061=<official url>[,D062=<url>] fetches that URL instead of the manifest one (alternate source);
// --cite D061="N.J.S.A. 10:5-12" records the legal citation in the header. Output is <id>.txt, or <id>.alt.txt
// when a primary <id>.txt already exists. Header gets alternate_source: true and the fetched domain.
const kv = (v) => Object.fromEntries((v || "").split("|").filter(Boolean).map((x) => [x.slice(0, x.indexOf("=")), x.slice(x.indexOf("=") + 1)]));
const alt = kv(flag("--alt")), cite = kv(flag("--cite")); // pairs separated by "|"

function parseCsv(s) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(f); f = ""; if (row.length > 1 || row[0]) rows.push(row); row = []; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...r] = rows;
  return r.map((x) => Object.fromEntries(h.map((k, i) => [k, x[i] ?? ""])));
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", sect: "§", ndash: "–", mdash: "—", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", hellip: "…" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m);

function htmlToText(h) {
  h = h.replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)\b[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const main = /<(article|main)\b[\s\S]*?<\/\1>/i.exec(h); // prefer the article body when there is one
  if (main && main[0].length > 1500) h = main[0];
  h = h.replace(/<\/(p|div|li|tr|h[1-6]|section|br)\s*>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  return decode(h).replace(/[ \t\f\v]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

const BLOCK = /(just a moment|attention required|checking your browser|enable javascript and cookies|verify you are (a )?human|captcha|access denied|request blocked|cf-chl|are you a robot|unusual traffic)/i;
const INJECT = /(ignore (all |any )?(previous|prior|above) (instructions|prompts)|disregard (the )?(above|previous)|you are (now )?(an? )?(ai|assistant|language model)|as an ai|system prompt|new instructions:|do not (tell|reveal)|<\s*\/?\s*(system|assistant)\s*>)/i;

let rows = parseCsv(readFileSync(join(pack, "corpus/links_only.csv"), "utf8"));
if (Object.keys(alt).length) { rows = rows.filter((r) => alt[r.doc_id]).map((r) => ({ ...r, manifest_url: r.url, url: alt[r.doc_id], alt: true })); }
const rank = (r) => /Hoboken/.test(r.jurisdictions) ? 0 : /Jersey City/.test(r.jurisdictions) ? 1 : /Newark/.test(r.jurisdictions) ? 2 : 3;
rows.sort((a, b) => rank(a) - rank(b) || a.doc_id.localeCompare(b.doc_id));
mkdirSync(outDir, { recursive: true });

const ok = [], failed = [];
for (const r of rows) {
  if (only && !only.has(r.doc_id)) continue;
  const dest = join(outDir, r.alt && existsSync(join(outDir, `${r.doc_id}.txt`)) ? `${r.doc_id}.alt.txt` : `${r.doc_id}.txt`);
  if (existsSync(dest) && !force) { ok.push(r.doc_id); console.error(`${r.doc_id} skip (exists)`); continue; }
  const rec = { doc_id: r.doc_id, url: r.url, at: new Date().toISOString(), status: null, ok: false, bytes: 0, flags: [] };
  try {
    const res = await fetch(r.url, { redirect: "follow", signal: AbortSignal.timeout(30000), headers: { "user-agent": "Mozilla/5.0 (compatible; hack-nation-corpus-fetch/1.0)", accept: "text/html,application/pdf,*/*" } });
    rec.status = res.status; rec.finalUrl = res.url;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer()); rec.bytes = buf.length; rec.type = type;
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
    let text;
    if (type.includes("pdf") || buf.subarray(0, 5).toString() === "%PDF-") {
      const tmp = join(tmpdir(), `fl-${process.pid}-${r.doc_id}.pdf`); writeFileSync(tmp, buf);
      let p = spawnSync("pdftotext", ["-layout", tmp, "-"], { encoding: "utf8", maxBuffer: 1 << 28 });
      if (p.error) { // no poppler: macOS PDFKit via JXA (osascript); the swift toolchain here cannot compile PDFKit
        const js = tmp + ".js"; writeFileSync(js, "ObjC.import('PDFKit');function run(a){const d=$.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(a[0]));return d.isNil()?'':ObjC.unwrap(d.string);}");
        p = spawnSync("osascript", ["-l", "JavaScript", js, tmp], { encoding: "utf8", maxBuffer: 1 << 28 }); rmSync(js, { force: true });
      }
      rmSync(tmp, { force: true });
      if (p.error || p.status !== 0) throw new Error("pdf: no pdftotext and osascript PDFKit fallback failed");
      text = p.stdout.trim();
    } else {
      const html = buf.toString("utf8");
      if (BLOCK.test(html.slice(0, 6000)) && htmlToText(html).length < 2000) throw new Error("blocked: challenge or access-denied page");
      text = htmlToText(html);
    }
    if (text.length < MIN_CHARS) throw new Error(`thin text (${text.length} chars)`);
    if (INJECT.test(text)) rec.flags.push("instruction-like text in page");
    const header = [`# doc_id: ${r.doc_id}`, `# jurisdictions: ${r.jurisdictions}`, `# source_url: ${r.url}`, `# final_url: ${res.url}`, `# retrieved_at: ${rec.at}`, `# http_status: ${res.status}`, `# content_type: ${type}`, `# source_type: ${r.source_type}`, ...(r.alt ? [`# alternate_source: true`, `# alternate_domain: ${new URL(res.url).hostname}`, `# manifest_url: ${r.manifest_url}`] : []), ...(cite[r.doc_id] ? [`# citation: ${cite[r.doc_id]}`] : []), ...(rec.flags.length ? [`# FLAG: ${rec.flags.join("; ")}`] : []), ""].join("\n");
    writeFileSync(dest, header + "\n" + text + "\n");
    rec.ok = true; rec.chars = text.length; ok.push(r.doc_id);
    console.error(`${r.doc_id} ok ${text.length} chars${rec.flags.length ? "  FLAG " + rec.flags : ""}`);
  } catch (e) {
    rec.error = String(e.message || e).slice(0, 200); failed.push(`${r.doc_id} (${rec.error})`);
    console.error(`${r.doc_id} FAIL ${rec.error}`);
  }
  appendFileSync(join(outDir, "_log.jsonl"), JSON.stringify(rec) + "\n");
}
console.log(`ok (${ok.length}): ${ok.join(",")}`);
console.log(`failed (${failed.length}): ${failed.join("; ")}`);
