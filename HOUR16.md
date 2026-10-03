# HOUR16 runbook: the hour-16 ordinance drop

Run from the repo root. Steps 2–5 were rehearsed end to end in a scratch copy with a fake Cambridge ordinance (2026-10-03): ingest 10 s, rebuild with lookups 19 s, about 30 s total. **That is the warm-cache figure; budget for cold: about 5 min** (p-a-2's measurement: `build-lookups` 147 s, `translate-es` 162 s). **Cache:** `cache/<sha256>.json` in the repo root, one directory for every `claude -p` call (`lib/llm.mjs`), 400 files / 6.1 MB at 1:30 PM CDT. **Do not delete `cache/` before hour 16.** It is gitignored and untracked, so a fresh clone or a different machine runs cold. **Since `a73c944`, `build-lookups` makes zero model calls for existing rules:** it reads the tracked `cov-pins.json` and `supersession-pins.json` (keyed by prompt hash) and calls the model only for a new or edited rule, so the T6 rule costs a few calls (log line `pins: N pinned, M model calls`). Verified cold (p-a-2, fresh clone of `654ed8a`, no `cache/`, `CLAUDE_BIN=/usr/bin/false`): 0 model calls, output byte-identical to the live `lookups.json`. **`translate-es` still needs the cache or a working `claude` login:** cold, it fails on its first model call and `rebuild` stops there before selfcheck (`--skip-es` gives selfcheck 74/75 and `rebuild ok`). **The gitignored `data/starter/` is absent from a fresh clone**, and `make-changes` dies with ENOENT until it is copied in, so the hour-16 machine needs it. **Never run `build-lookups.mjs --export-pins`**: it overwrites the hand-decided picks. Step 1's download was rehearsed separately on a real Drive file. Step 7 was rehearsed on `PORT=3099` (starts in about a second, `/api/lookup` answered, stopped; `.env` was absent, so it logged "not found" and ran `backend=api`). Step 5 now also narrows T6 to addresses the new rule's coverage reaches (`refine-t6.mjs`); the log line is `T6 coverage refinement: N -> M addresses`.

Who: **p-a-3** = ingest, rebuild, UI, changes.json. **p-a-2** = rules.json, lookups.json, server. **p-a-1** = selfcheck, recording. **p-a** = go/no-go and commits board.

| # | Who | Step | Command / check |
|---|-----|------|-----------------|
| 1 | p-a-3 | Watcher fires (exit 10, new entry printed). Tell p-a and p-a-2. Download into `data/starter/` only. | `node drive-watch.mjs` · `mkdir -p data/starter/hour16 && curl -sSL -o data/starter/hour16/<name>.txt "https://drive.google.com/uc?export=download&id=<id>"` (rehearsed 2026-10-03 on D001: 0.8 s, byte-identical; `gdown` is not installed, do not use it; fallback: open the file in a browser and save). The id is in the `drive-watch.mjs` output. Convert a PDF to text if needed, keeping the first lines `SOURCE: <url>` and `RETRIEVED: <date>` |
| 2 | p-a-2 | Freeze: no consolidation or rules.json writes while ingest runs (ingest rewrites rules.json). | message p-a-3 "clear" |
| 3 | p-a-3 | Dry run first. Check: rule count, jurisdiction, effective date, `supersedes`, `quote_unverified_dropped` 0, `T6_affected`. | `node ingest-doc.mjs data/starter/hour16/<doc>.txt --dry --today <today>` |
| 4 | p-a-3 | Real run. Writes rules.json and changes.json (T6), appends an `ingest` audit record. | `node ingest-doc.mjs data/starter/hour16/<doc>.txt --today <today>` |
| 5 | p-a-3 | Rebuild lookups, changes, Spanish, selfcheck. Stops at the first failure. Keeps T6. | `npm run rebuild -- --with-lookups` |
| 6 | p-a-1 | Confirm selfcheck is green (0 unknown rule ids, T1–T5 ok, T6 check once added). | `node selfcheck.mjs` |
| 7 | p-a-2 | **Restart** the server after the rebuild finishes: it reads `rules.json` and `lookups.json` only at startup, so a running `:3000` keeps serving the old data (found one hour stale after the e0a3e31 fix). Stop the old process first, then start; do not trust a server that was already up. | stop the process on :3000, then `BACKEND=cli npm start` (port 3000); the new process must log its start line |
| 8 | p-a-3 | **Confirm the live server has the new rule**, then verify by hand: a Cambridge address before and after the effective date. The response must contain a `new-<docname>-N` rule id; if it does not, the server is stale, go back to step 7. | `curl "localhost:3000/api/lookup?address=A0010&asof=<day before>"` then `asof=<effective day>`: expect the new rule, `not_yet_effective`, then `applies` |
| 9 | p-a-1 | Record the hour-16 segment: doc dropped → ingest output → rebuild → lookup before/after. | `record-demo.mjs` plan in `demo-steps.json` |
| 10 | p-a-3 | Commit, one `--only` commit per owner, under the board grant (re-read the card first): `rules.json lookups.json` (p-a-2), `changes.json public/es.json` (p-a-3). Report to p-a. | `git commit --only <paths> -F <msgfile>` |

## Backend and model calls

- Steps 3, 4 and 5 (`ingest-doc.mjs`, `build-lookups.mjs`, `translate-es.mjs`) and `add-city.mjs` call the model through `lib/llm.mjs`, which always spawns `claude -p` (the logged-in CLI). They do not read `BACKEND` or `.env`, so none of them depends on a `.env` or an API key; setting `BACKEND=cli` on them changes nothing. What they do need is the owner's `claude` login on this machine.
- `BACKEND` only picks how the server's legacy `/api/chat` answers. Start the server with `BACKEND=cli npm start` so a missing `.env` cannot select the keyless `api` mode.
- `/api/lookup` never calls the model: it reads `rules.json`, `lookups.json` and `jurisdictions.json` only, so the live demo needs no backend.

## Known behaviour to expect

- New rule ids are `new-<docname>-N`, not `r-NNNN`, until `normalize-rules.mjs` exists. Everything downstream accepts them.
- A rule whose effective date is after `--today` gets `not_yet_effective`; the lookup flips to `applies` on and after that date.
- If the new rule replaces an in-force rule in the same jurisdiction and category, ingest sets `supersedes` and the old rule stops applying. Check this in step 3: it is a heuristic and untested on a real amendment.
- `refine-t6.mjs` deliberately drops addresses whose new-rule result is `pending` (it keeps only `applies`, `unknown`, `not_yet_effective`). This is p-a's ruling: a T6 rule is enacted, so one with a future effective date comes out `not_yet_effective`, never `pending`, and `pending` should not occur there. If a T6 count looks short, check that the rule's status is `enacted` before suspecting the filter.
- Quotes that are not found verbatim in the document are dropped (`quote_unverified_dropped`). A non-zero count means the model paraphrased: say so on camera, do not hide it.
- If step 5 stops at selfcheck, read which check failed before touching anything. A red check means data out of sync, not a script bug.
- The Spanish view needs `public/es.json` regenerated (step 5 does it); a rule missing from it shows English marked "(sin traducir)".
