#!/usr/bin/env node
// Lists the public Drive folder (recursively, read-only, no auth) and reports anything new since the last run.
//   node drive-watch.mjs [folderId] [--state data/starter/.drive-listing.json]
// Uses the embeddedfolderview page, so no gdown/API key. Exit 0 = nothing new, 10 = new entries (printed), 1 = listing failed.
// State lives under data/starter/ (gitignored). Downloading is a separate, deliberate step.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const argv = process.argv.slice(2), flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const root = argv.find((a, i) => !a.startsWith("--") && !(argv[i - 1] || "").startsWith("--")) || "14TT6AEH8TStzoT5c5fZ45Bt4grODsowR";
const stateFile = flag("--state", "data/starter/.drive-listing.json");
const dec = (s) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function list(id, path = "", depth = 0) {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for folder ${id}`);
  const html = await res.text(), out = [];
  for (const m of html.matchAll(/<a href="https:\/\/drive\.google\.com\/(drive\/folders|file\/d)\/([^"/?]+)[^"]*"[\s\S]*?flip-entry-title">([^<]*)</g)) {
    const [, kind, eid, title] = m, isDir = kind === "drive/folders", name = dec(title), p = `${path}${name}${isDir ? "/" : ""}`;
    out.push({ id: eid, path: p, type: isDir ? "folder" : "file" });
    if (isDir && depth < 4) out.push(...(await list(eid, p, depth + 1)));
  }
  return out;
}

let now;
try { now = await list(root); } catch (e) { console.error("listing failed:", e.message); process.exit(1); }
const prev = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : null;
const known = new Set((prev?.entries || []).map((e) => e.id));
const fresh = prev ? now.filter((e) => !known.has(e.id)) : [];
mkdirSync(dirname(stateFile), { recursive: true });
writeFileSync(stateFile, JSON.stringify({ checked: new Date().toISOString(), folder: root, entries: now }, null, 1));
console.log(`${now.length} entries (${now.filter((e) => e.type === "folder").length} folders, ${now.filter((e) => e.type === "file").length} files) checked ${new Date().toLocaleTimeString()}`);
if (!prev) console.log("first run: baseline saved");
if (fresh.length) { console.log("NEW:\n" + fresh.map((e) => `  ${e.type} ${e.path} (${e.id})`).join("\n")); process.exit(10); }
