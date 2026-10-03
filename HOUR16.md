# HOUR16 runbook: the hour-16 ordinance drop

Run from the repo root. Steps 2–5 were rehearsed end to end in a scratch copy with a fake Cambridge ordinance (2026-10-03): ingest 10 s, rebuild with lookups 19 s, about 30 s total. Steps 1 and 7 were not rehearsed.

Who: **p-a-3** = ingest, rebuild, UI, changes.json. **p-a-2** = rules.json, lookups.json, server. **p-a-1** = selfcheck, recording. **p-a** = go/no-go and commits board.

| # | Who | Step | Command / check |
|---|-----|------|-----------------|
| 1 | p-a-3 | Watcher fires (exit 10, new entry printed). Tell p-a and p-a-2. Download into `data/starter/` only. | `node drive-watch.mjs` · download the file id with `gdown <id> -O data/starter/hour16/` (unrehearsed; fallback: open the file in a browser and save). Convert a PDF to text if needed, keeping the first lines `SOURCE: <url>` and `RETRIEVED: <date>` |
| 2 | p-a-2 | Freeze: no consolidation or rules.json writes while ingest runs (ingest rewrites rules.json). | message p-a-3 "clear" |
| 3 | p-a-3 | Dry run first. Check: rule count, jurisdiction, effective date, `supersedes`, `quote_unverified_dropped` 0, `T6_affected`. | `node ingest-doc.mjs data/starter/hour16/<doc>.txt --dry --today <today>` |
| 4 | p-a-3 | Real run. Writes rules.json and changes.json (T6), appends an `ingest` audit record. | `node ingest-doc.mjs data/starter/hour16/<doc>.txt --today <today>` |
| 5 | p-a-3 | Rebuild lookups, changes, Spanish, selfcheck. Stops at the first failure. Keeps T6. | `npm run rebuild -- --with-lookups` |
| 6 | p-a-1 | Confirm selfcheck is green (0 unknown rule ids, T1–T5 ok, T6 check once added). | `node selfcheck.mjs` |
| 7 | p-a-2 | Restart the server so it reloads rules.json and lookups.json. | `npm start` (port 3000) |
| 8 | p-a-3 | Verify by hand: a Cambridge address before and after the effective date. | `curl "localhost:3000/api/lookup?address=A0010&asof=<day before>"` then `asof=<effective day>`: expect `not_yet_effective`, then `applies` |
| 9 | p-a-1 | Record the hour-16 segment: doc dropped → ingest output → rebuild → lookup before/after. | `record-demo.mjs` plan in `demo-steps.json` |
| 10 | p-a-3 | Commit, one `--only` commit per owner, under the board grant (re-read the card first): `rules.json lookups.json` (p-a-2), `changes.json public/es.json` (p-a-3). Report to p-a. | `git commit --only <paths> -F <msgfile>` |

## Known behaviour to expect

- New rule ids are `new-<docname>-N`, not `r-NNNN`, until `normalize-rules.mjs` exists. Everything downstream accepts them.
- A rule whose effective date is after `--today` gets `not_yet_effective`; the lookup flips to `applies` on and after that date.
- If the new rule replaces an in-force rule in the same jurisdiction and category, ingest sets `supersedes` and the old rule stops applying. Check this in step 3: it is a heuristic and untested on a real amendment.
- Quotes that are not found verbatim in the document are dropped (`quote_unverified_dropped`). A non-zero count means the model paraphrased: say so on camera, do not hide it.
- If step 5 stops at selfcheck, read which check failed before touching anything. A red check means data out of sync, not a script bug.
- The Spanish view needs `public/es.json` regenerated (step 5 does it); a rule missing from it shows English marked "(sin traducir)".
