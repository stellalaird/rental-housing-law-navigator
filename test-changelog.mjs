#!/usr/bin/env node
// Cases for changelog.mjs. Run: node test-changelog.mjs   (exit 1 on any failure)
import assert from "node:assert/strict";
import { asOf, diff, statusOn } from "./changelog.mjs";

const R = (id, jurisdiction, level, status, effective_date, extra = {}) => ({ team_rule_id: id, jurisdiction, level, category: "algorithmic_rent_setting", status, effective_date, ...extra });
const rules = [
  R("ca", "CA", "state", "in_force", "2026-01-01"),
  R("nj", "NJ", "state", "not_yet_effective", "2027-07-01"),
  R("jc", "Jersey City, NJ", "city", "in_force", "2025-09-01"),
  R("ma-bill", "MA", "state", "pending", null),
  R("ma-struck", "MA", "state", "failed", null),
  R("old", "Cambridge, MA", "city", "in_force", "2020-01-01"),
  R("new", "Cambridge, MA", "city", "in_force", "2027-01-01", { supersedes: ["old"] }),
  R("undated", "Boston, MA", "city", "not_yet_effective", null),
];
const res = (stack, d) => Object.fromEntries(asOf(stack, d, rules).map((x) => [x.team_rule_id, x.result]));
const t = [];
const test = (name, fn) => { try { fn(); t.push(["ok", name]); } catch (e) { t.push(["FAIL", name + ": " + e.message]); } };

test("T1 shape: CA not yet effective before, applies after", () => {
  assert.equal(res(["CA"], "2025-12-31").ca, "not_yet_effective");
  assert.equal(res(["CA"], "2026-01-02").ca, "applies");
  assert.equal(res(["CA"], "2026-01-01").ca, "applies"); // effective date itself counts as in force
});
test("T3 shape: NJ not yet effective today, applies 2027-07-02", () => {
  assert.equal(res(["NJ"], "2026-10-01").nj, "not_yet_effective");
  assert.equal(res(["NJ"], "2027-07-02").nj, "applies");
});
test("T2 shape: city rule only in its own stack", () => {
  assert.ok(res(["NJ", "Hudson County, NJ", "Jersey City, NJ"], "2026-10-01").jc);
  assert.equal(res(["NJ", "Essex County, NJ", "Newark, NJ"], "2026-10-01").jc, undefined);
});
test("T4/T5 shape: pending is pending, failed is never reported", () => {
  const r = res(["MA", "Boston, MA"], "2026-10-01");
  assert.equal(r["ma-bill"], "pending"); assert.equal(r["ma-struck"], undefined);
});
test("supersede: old ends when the new one starts", () => {
  assert.equal(res(["MA", "Cambridge, MA"], "2026-10-01").old, "applies");
  assert.equal(res(["MA", "Cambridge, MA"], "2026-10-01").new, "not_yet_effective");
  const after = res(["MA", "Cambridge, MA"], "2027-01-01");
  assert.equal(after.old, "superseded"); assert.equal(after.new, "applies");
});
test("undated not_yet_effective is never reported in force", () => assert.equal(res(["MA", "Boston, MA"], "2030-01-01").undated, "not_yet_effective"));
test("partial dates take the first day", () => assert.equal(statusOn({ status: "in_force", effective_from: "2026-03", effective_to: null }, "2026-03-01"), "applies"));
test("diff between dates", () => {
  const d = diff(rules, "2026-10-01", "2027-07-02");
  assert.deepEqual(d.added.map((x) => x.team_rule_id).sort(), ["new", "nj"]);
  assert.deepEqual(d.ended.map((x) => x.team_rule_id), ["old"]);
  assert.deepEqual(diff(rules, "2026-10-01", "2027-07-02", ["CA"]).added, []);
});
test("bad input throws", () => { assert.throws(() => asOf("CA", "2026-10-01", rules)); assert.throws(() => asOf(["CA"], "10/01/2026", rules)); });

for (const [s, m] of t) console.log(s, m);
const bad = t.filter(([s]) => s === "FAIL").length;
console.log(`${t.length - bad}/${t.length} pass`);
process.exit(bad ? 1 : 0);
