#!/usr/bin/env node
// One command after any rules.json change:  npm run rebuild   (or: node rebuild.mjs)
// Runs in order: make-changes (changes.json), translate-es (public/es.json), selfcheck. Stops at the first step that fails.
// Flags: --with-lookups also runs build-lookups.mjs first (model calls, cached; owned by p-a-2); --skip-es skips the translation step.
// changes.json entries that make-changes does not produce (T6, added by ingest-doc.mjs) are kept, not dropped.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const here = (f) => new URL(f, import.meta.url).pathname;
const argv = process.argv.slice(2);
const steps = [
  ...(argv.includes("--with-lookups") ? [["build-lookups.mjs"]] : []),
  ["make-changes.mjs"],
  ...(argv.includes("--skip-es") ? [] : [["translate-es.mjs"]]),
  ["selfcheck.mjs"],
];
const keep = existsSync(here("./changes.json")) ? JSON.parse(readFileSync(here("./changes.json"), "utf8")) : {};

for (const [script, ...args] of steps) {
  console.log(`\n== ${script} ==`);
  const r = spawnSync("node", [here("./" + script), ...args], { stdio: "inherit", cwd: here("./") });
  if (r.status !== 0) { console.error(`rebuild stopped: ${script} exited ${r.status}`); process.exit(r.status || 1); }
  if (script === "make-changes.mjs") {
    const fresh = JSON.parse(readFileSync(here("./changes.json"), "utf8"));
    const kept = Object.keys(keep).filter((k) => !(k in fresh));
    for (const k of kept) fresh[k] = keep[k];
    if (kept.length) { writeFileSync(here("./changes.json"), JSON.stringify(fresh, null, 2) + "\n"); console.log(`kept from previous changes.json: ${kept.join(", ")}`); }
  }
}
console.log("\nrebuild ok");
