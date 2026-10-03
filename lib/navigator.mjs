// Navigator lookup: address (id or free text, resolved only against the 500 sample addresses) + as-of date -> rule results.
// Reads lookups.json (precomputed by build-lookups.mjs for its as_of) and re-derives time status for other dates.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { asOf, loadRules } from "../changelog.mjs";
import { loadJurisdictions } from "../jurisdictions.mjs";

const root = (f) => fileURLToPath(new URL(`../${f}`, import.meta.url));
const PACK_DEFAULT = root("data/starter/participant-final-no-hour16 3/data/sample_addresses.csv");
export class AddressDataMissing extends Error { constructor(path) { super("address data not installed"); this.path = path; } }
const csv = (txt) => { // minimal RFC4180 parser
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < txt.length; i++) { const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c; }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...r] = rows; return r.filter((x) => x.length > 1).map((x) => Object.fromEntries(h.map((k, i) => [k, x[i] ?? ""])));
};
let S = null;
export function load() {
  const rules = loadRules();
  const lk = JSON.parse(readFileSync(root("lookups.json"), "utf8"));
  const pack = process.env.ADDRESSES_CSV || PACK_DEFAULT; // override for hosts without data/starter/
  let txt; try { txt = readFileSync(pack, "utf8"); } catch (e) { if (e.code === "ENOENT") throw new AddressDataMissing(pack); throw e; }
  const addrs = csv(txt);
  S = { rules, byId: new Map(rules.map((r) => [r.team_rule_id, r])), lk, addrs, j: loadJurisdictions(root("jurisdictions.json")) };
  S.key = new Map(addrs.map((a) => [norm(`${a.street_address} ${a.postal_city} ${a.state} ${a.zip}`), a]));
  return S;
}
const norm = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
export const state = () => S || load();

export function resolve(q) {
  const s = state(); const t = String(q || "").trim();
  if (!t) return null;
  const id = s.addrs.find((a) => a.address_id.toLowerCase() === t.toLowerCase());
  if (id) return id;
  const n = norm(t);
  if (s.key.has(n)) return s.key.get(n);
  const hits = s.addrs.filter((a) => norm(a.street_address) === n || norm(`${a.street_address} ${a.postal_city}`) === n || norm(`${a.street_address} ${a.postal_city} ${a.state}`) === n);
  return hits.length === 1 ? hits[0] : null;
}

export function lookup(q, date) {
  const s = state(); const a = resolve(q);
  if (!a) return null;
  const j = s.j[a.address_id] || {};
  const known = j.status !== "unknown" && j.stack;
  const stack = known ? j.stack : [a.state];
  const base = s.lk.lookups[a.address_id] || [];
  let results = base;
  if (date !== s.lk.as_of) { // recompute time status, then re-apply the same coverage/superseded gate that the base pass used
    const t = new Map(asOf(stack, date, s.rules).map((x) => [x.team_rule_id, x]));
    const TIME = ["applies", "not_yet_effective", "pending"];
    results = base.flatMap((e) => {
      const x = t.get(e.team_rule_id), r = s.byId.get(e.team_rule_id);
      if (TIME.includes(e.result) && !x) return [];                         // not in force on this date at all
      if (!x) return [e];                                                    // e.g. unmatched-city unknowns: no time status to recompute
      if (x.result === "applies") {
        if (e.result === "superseded" || e.result === "unknown") return [e];     // gate holds once in force
        if (e.if_in_force) { const { if_in_force, source_doc_id, quoted_span, ...rest } = e; return [{ ...rest, ...e.if_in_force }]; }
        if (e.result === "applies") return [e];
        const { source_doc_id, quoted_span, if_in_force, ...rest } = e;
        return [{ ...rest, result: "applies", explanation: `${r.title}: ${x.reason}`, source_doc_id: r.source_doc_id, quoted_span: r.quoted_span }];
      }
      // not yet in force or pending on this date: show the time status, keep the gate for when it is in force
      const wasGate = e.if_in_force || (["unknown", "superseded"].includes(e.result) ? { result: e.result, explanation: e.explanation } : null);
      const { source_doc_id, quoted_span, ...rest } = e;
      if (x.result === e.result && !wasGate) return [e];
      return [{ ...rest, result: x.result, explanation: `${r.title}: ${x.reason}`, ...(wasGate ? { if_in_force: wasGate } : {}) }];
    });
  }
  const level = (n) => (n.includes(",") && !n.includes("County") ? "city" : n.includes("County") ? "county" : "state");
  return {
    as_of: date,
    address: { address_id: a.address_id, street_address: a.street_address, postal_city: a.postal_city, state: a.state, zip: a.zip, year_built: a.year_built || null, units: a.units || null },
    resolved: known ? { city: j.place || null, county: j.county || null, state: j.state } : null,
    stack: stack.map((n) => ({ level: level(n), name: n, note: null })),
    results: results.map((e) => ({ ...e, rule: s.byId.get(e.team_rule_id) || null })),
    not_covered: known ? null : ["city and county rules: address could not be matched to a place"],
    message: known ? "Informational only; not legal advice. Rules shown as of the date above; enacted law and pending bills are labelled separately." : "Address could not be matched to a city; state-level rules are shown and local rules are marked unknown. Not legal advice.",
  };
}
