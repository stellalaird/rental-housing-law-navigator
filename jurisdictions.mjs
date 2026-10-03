#!/usr/bin/env node
// Address -> jurisdiction stack, from the US Census geocoder (public, no key).
// Build:  node jurisdictions.mjs [--pack "data/starter/participant-final-no-hour16 3"] [--out jurisdictions.json] [--limit N]
// Use:    import { loadJurisdictions, stackFor } from "./jurisdictions.mjs"
// Raw responses are cached under cache/geocode/<address_id>.json (gitignored); reruns hit the cache.
// Never guesses: no geocode match => status "unknown". A matched address whose incorporated place is not a corpus
// jurisdiction => status "state_only" (state-level rules still apply, no city rule can).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const CORPUS_PLACES = ["Berkeley, CA", "Boston, MA", "Cambridge, MA", "Hoboken, NJ", "Jersey City, NJ", "Los Angeles, CA", "Newark, NJ", "San Diego, CA", "San Francisco, CA", "Santa Ana, CA"];

export function loadJurisdictions(path = "jurisdictions.json") { return JSON.parse(readFileSync(path, "utf8")).by_address; }
export function stackFor(addressId, by = loadJurisdictions()) { const j = by[addressId]; return j && j.status !== "unknown" ? j.stack : null; }

const parseCsv = (txt) => {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...r] = rows; return r.filter((x) => x.length > 1).map((x) => Object.fromEntries(h.map((k, i) => [k, x[i] ?? ""])));
};

const URL_BASE = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";
async function geocode(a, cacheDir) {
  const f = join(cacheDir, `${a.address_id}.json`);
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8"));
  // Attempt 1: as given. Attempt 2 (only if no match): drop the zip (some rows carry a wrong or missing one) and
  // un-pad ordinals ("05TH AV" -> "5TH AV"). The Census still has to match the result; this is cleaning, not guessing.
  const q1 = `${a.street_address}, ${a.postal_city}, ${a.state} ${a.zip}`.replace(/ $/, "");
  const q2 = `${a.street_address.replace(/\b0+(\d+(ST|ND|RD|TH))\b/i, "$1")}, ${a.postal_city}, ${a.state}`;
  const r1 = await geocodeOne(q1);
  if (r1.error || r1.result?.addressMatches?.length || q1 === q2) { if (!r1.error) writeFileSync(f, JSON.stringify(r1)); return r1; }
  const r2 = await geocodeOne(q2); r2.first_attempt = q1;
  if (!r2.error) writeFileSync(f, JSON.stringify(r2));
  return r2;
}
async function geocodeOne(q) {
  const url = `${URL_BASE}?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  let last;
  for (let t = 0; t < 4; t++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json(); return { query: q, fetched: new Date().toISOString(), result: j.result };
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500 * (t + 1))); }
  }
  return { query: q, error: String(last) }; // not cached: retried next run
}

function resolve(a, g) {
  const base = { status: "unknown", reason: null, state: a.state, county: null, place: null, stack: null, matched_address: null, year_built: a.year_built || null, units: a.units || null };
  const m = g?.result?.addressMatches?.[0];
  if (!m) return { ...base, reason: g?.error ? "geocode_error" : "geocode_no_match" };
  const geo = m.geographies, st = geo.States?.[0]?.STUSAB, cnty = geo.Counties?.[0]?.NAME;
  const placeRaw = geo["Incorporated Places"]?.[0]?.BASENAME ?? null; // null => unincorporated / CDP
  const out = { ...base, matched_address: m.matchedAddress, state: st, county: cnty ? `${cnty}, ${st}` : null, place: placeRaw };
  if (st !== a.state) return { ...out, status: "unknown", reason: "state_mismatch" };
  const placeKey = placeRaw && `${placeRaw}, ${st}`;
  if (placeKey && CORPUS_PLACES.includes(placeKey)) return { ...out, status: "ok", stack: [st, ...(cnty ? [`${cnty}, ${st}`] : []), placeKey] };
  return { ...out, status: "state_only", reason: "place_not_in_corpus", stack: [st, ...(cnty ? [`${cnty}, ${st}`] : [])] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const pack = flag("--pack", "data/starter/participant-final-no-hour16 3"), out = flag("--out", "jurisdictions.json"), limit = Number(flag("--limit", 0));
  const cacheDir = "cache/geocode"; mkdirSync(cacheDir, { recursive: true });
  let addrs = parseCsv(readFileSync(join(pack, "data/sample_addresses.csv"), "utf8")); if (limit) addrs = addrs.slice(0, limit);
  const by = {}; let i = 0;
  const worker = async () => { for (;;) { const a = addrs[i++]; if (!a) return; by[a.address_id] = resolve(a, await geocode(a, cacheDir)); } };
  await Promise.all(Array.from({ length: 6 }, worker));
  const sorted = Object.fromEntries(Object.keys(by).sort().map((k) => [k, by[k]]));
  writeFileSync(out, JSON.stringify({ as_of: new Date().toISOString().slice(0, 10), source: "US Census geocoder, Public_AR_Current benchmark", corpus_places: CORPUS_PLACES, by_address: sorted }, null, 1));
  const tally = {}; for (const j of Object.values(sorted)) { const k = `${j.status}${j.reason ? ":" + j.reason : ""}`; tally[k] = (tally[k] || 0) + 1; }
  console.log(`${out}: ${addrs.length} addresses`, tally);
}
