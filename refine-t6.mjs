// T6 coverage refinement (p-a ruling, 2026-10-03): ingest-doc.mjs picks T6's affected addresses by jurisdiction only.
// Refine with lookups.json, which already evaluates each rule's coverage conditions per address:
//   keep an address only if its lookup has an entry for a new (new-*) rule that is applies, unknown or not_yet_effective;
//   no entry = the rule's coverage excludes it (units, year built), so drop it; unknown = keep, and the notes name the condition.
// Does nothing (returns null) when there is no T6, no new-* rule, or lookups.json has no entry for any new rule (lookups not rebuilt yet),
// so a stale lookups.json can never silently empty T6.
const KEEP = new Set(["applies", "unknown", "not_yet_effective"]);
const MARK = " Coverage refinement:";

export function refineT6(changes, rules, lookups) {
  const t6 = changes?.T6, list = Array.isArray(rules) ? rules : rules?.rules || [];
  const ids = new Set(list.filter((r) => String(r.team_rule_id).startsWith("new-") && r.status !== "failed").map((r) => r.team_rule_id));
  const by = lookups?.lookups || {};
  if (!t6 || !ids.size) return null;
  const seen = Object.values(by).some((es) => es.some((e) => ids.has(e.team_rule_id)));
  if (!seen) return null;
  const before = t6.affected_address_ids.length, keep = [], unknown = new Map();
  for (const a of [...t6.affected_address_ids].sort()) { // intersect: only addresses ingest already matched by jurisdiction
    const es = (by[a] || []).filter((e) => ids.has(e.team_rule_id) && KEEP.has(e.result));
    if (!es.length) continue;
    keep.push(a);
    for (const e of es) if (e.result === "unknown") unknown.set(e.explanation, (unknown.get(e.explanation) || 0) + 1);
  }
  const set = new Set(keep);
  const out = { ...t6, affected_address_ids: keep, conflict_flag_address_ids: (t6.conflict_flag_address_ids || []).filter((a) => set.has(a)) };
  const unk = [...unknown].sort((x, y) => y[1] - x[1]);
  out.notes = String(t6.notes || "").split(MARK)[0] + `${MARK} ${keep.length} addresses kept after checking each new rule's coverage conditions (unit count, year built); jurisdiction-matched addresses outside that coverage were dropped.` +
    (unk.length ? ` ${unk.reduce((n, [, c]) => n + c, 0)} kept with an unknown coverage condition, e.g. "${unk[0][0].slice(0, 200)}".` : " None kept with an unknown condition.");
  return { t6: out, before, after: keep.length, unknownKept: unk.reduce((n, [, c]) => n + c, 0) };
}
