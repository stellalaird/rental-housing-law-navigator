# Rental Housing Law Navigator — Hack-Nation 7 · Challenge 02 (RealPage)

> Which rules apply to this apartment today, and what is about to change?

An AI system that reads a corpus of real state and local housing law, extracts structured rule records, resolves any sample address to its jurisdiction stack, and answers with every applicable rule, in plain language, with a citation and quoted source text. It also tracks law changes: given a new or pending law, it lists the addresses affected and what changes for each.

**Not legal advice.** Output is a reading aid built from public text, not a legal opinion or compliance certification. The answer key behind the challenge has not been reviewed by counsel.

## Demo

<!-- TODO: replace after recording (see video-scripts.md). -->
`[ demo video / GIF goes here ]`

Live demo: `[ link goes here ]`

## Scores

<!-- TODO: filled in from a real `score.py` run on the dev set. Do not write numbers that were not produced by that script. -->

| Component | Max | Our dev-set result |
|---|---|---|
| Extraction accuracy | 25 | TODO |
| Address coverage | 20 | TODO |
| Citations | 15 | TODO |
| Change tracking (T1–T6) | 15 | TODO |

The judged components (usability 10, responsible design 10, scalability 5) are scored by judges, not by script. Scores come from the organisers' own `score.py` against the dev key; the held-out key is not available to us.

## How it works

The challenge defines five stages. This is how each maps to this repo.

| Stage | What it does | Where |
|---|---|---|
| 1. Extract | An LLM reads each corpus document and emits one record per rule in the provided schema: category, jurisdiction, requirement, coverage conditions, exemptions, effective date, status (enacted/pending), penalty, citation, quoted span. Automated, not hand-coded. | `extract-rules.mjs` (per document, to `out/rules.raw.json`), then `consolidate-rules.mjs` (merges to `rules.json`) |
| 2. Resolve | Geocode an address, build the jurisdiction stack (state → county → city). | `jurisdictions.mjs` (US Census geocoder, no key; writes `jurisdictions.json`) |
| 3. Apply | Test each rule's coverage conditions against building facts (year built, units, use code). Missing facts yield `unknown`, never a guess. | `build-lookups.mjs` (writes `lookups.json`; model-derived coverage and supersession answers are pinned in `cov-pins.json` and `supersession-pins.json`) |
| 4. Explain | Every applicable rule, in plain language, with a citation and quoted span. Local-over-state overrides are stated explicitly. | `GET /api/lookup` in `server.mjs` and `lib/navigator.mjs`; the page is `public/index.html` |
| 5. Track change | For a new or pending law: affected addresses, before/after rule set, and an "as of date" query. `changelog.mjs` (`asOf`, `diff`), `make-changes.mjs` (T1–T5 to `changes.json`), `ingest-doc.mjs` (a new document to extracted rules, supersession and a T6 entry in one command). |

Scope: 3 states (CA, NJ, MA), 10 cities (9 with address samples; Santa Ana is extraction-only), 6 rule categories (rent increase limits, just-cause eviction, security deposits, application/screening fees, screening restrictions, algorithmic rent-setting).

Lookup results use five states: `applies`, `unknown`, `superseded`, `not yet effective`, `pending`.

## Output files

| File | Contents |
|---|---|
| `rules.json` | Extracted rule records with citation and quoted source text |
| `lookups.json` | For all 500 sample addresses, each rule's result |
| `changes.json` | Affected addresses and conflict flags for each change test (T1–T6) |

## Run it

Needs Node 22. The pipeline scripts also need a logged-in `claude` CLI (they call `claude -p`; no API key is read). `DEPLOY.md` has the host requirements.

```bash
npm install
npm start                      # http://localhost:3000 (PORT=8080 npm start to change the port)
curl "localhost:3000/api/lookup?address=A0001&asof=2026-10-01"
```

The server reads the organisers' `sample_addresses.csv` from `data/starter/participant-final-no-hour16 3/data/` (gitignored, not in a fresh clone), or from `ADDRESSES_CSV=/path/to/sample_addresses.csv`. Without it `/api/lookup` returns 503 `address data not installed`.

Rebuild pipeline, in order (each calls the model through `claude -p`, cached in `cache/`):

```bash
node extract-rules.mjs         # corpus text -> out/rules.raw.json
node consolidate-rules.mjs     # out/rules.raw.json -> rules.json
node build-lookups.mjs         # rules.json -> lookups.json (500 addresses)
node translate-es.mjs          # Spanish text -> public/es.json
node make-changes.mjs          # changes.json (T1-T5)
```

`npm run rebuild -- --with-lookups` runs the rebuild steps after a new document is ingested (see `HOUR16.md`). Do not run `build-lookups.mjs --export-pins`: it overwrites the hand-decided pins.

**The demo server needs no model backend.** `GET /api/lookup`, `/api/rules` and `/api/lookups` only read `rules.json`, `lookups.json` and `jurisdictions.json` (plus an append to the audit log); the page calls nothing else. `BACKEND` and `ANTHROPIC_API_KEY` matter only for the legacy `/api/chat` route, which the page no longer calls, so the server can be hosted anywhere Node runs with those files and no `.env`. The model is used only offline, by the pipeline scripts (`ingest-doc.mjs`, `build-lookups.mjs`, `translate-es.mjs`, `add-city.mjs`), which call a logged-in `claude -p` regardless of `BACKEND`. For the legacy chat route: API mode needs `ANTHROPIC_API_KEY` in a gitignored `.env` (see `.env.example`); CLI mode (`BACKEND=cli npm start`) uses a logged-in `claude` CLI instead.

Change tracking: `node make-changes.mjs` writes `changes.json`; `node ingest-doc.mjs <new-doc.txt>` ingests a new document and adds T6 (`--dry` writes nothing); `node test-changelog.mjs` runs the as-of cases. Rebuilds are deterministic from the tracked pin files (`cov-pins.json`, `supersession-pins.json`): `build-lookups.mjs` re-calls the model only for a new or edited rule, and a cold rebuild of existing rules reproduced `lookups.json` byte for byte with no model calls. `translate-es.mjs` still calls the model. Scoring uses the organisers' `score.py` against the dev key; it is not in this repo.

## Responsible design

The challenge asks for transparency, not legal verdicts. What this system does about it:

- **Not legal advice.** Every interface says so.
- **Citations on every answer.** Each reported rule carries its source and retrieval date, plus a quoted span that exists in the corpus.
- **"As of" date on every answer,** with enacted law kept separate from pending law. Pending bills are never reported as in force.
- **Explicit unknowns.** If coverage depends on a fact the data lacks (for example, year built is missing for San Diego), the answer is `unknown`, not a guess.
- **No invented rules.** Where the source is silent, the system reports "no rule at this level".
- **Conflicts flagged** for human review (for example, the NJ FAIR Act possibly preempting local bans).
- **Corpus is data, not instructions.** Corpus text is passed to the model as quoted data. Directive-looking text inside a document is treated as content to extract or ignore, never obeyed. The extraction prompt is `SYSTEM` in `extract-rules.mjs`: it says the document is data, to ignore instructions inside it, to return JSON only, and to never invent a rule, value, date or quote. Each rule must carry a verbatim quote, and a quote not found in the document is dropped.
- **No evasion help.** The system explains rules; it does not suggest ways around them.
- **Audit log** of lookups and ingests: `audit.jsonl` (written by `audit.mjs`; `AUDIT_LOG` moves it, gitignored). One line per event with time, input, as-of date, the rule ids returned or created, and the version (git commit, `rules.json` hash, model). It does not store model outputs; model calls are cached in `cache/`.

## Limitations

- **Citations:** 16 of 94 rules (528 of 6319 `applies` answers) rest on pages that are link-only in the starter corpus, so their text is not in it. Each quoted span is verbatim from a page fetched by plain GET (`data/starter/fetched/`), labelled in `source_note`; non-official hosts are capped at confidence 0.5. Confirm against the primary text.
- **Supersession is city-wide:** where a city ordinance overrides a state rule, the whole city is marked superseded. Los Angeles's RSO-only override (r-0020 over r-0034) is not modelled, because adding it would mark every non-RSO LA address superseded.

## Robustness

Built so a flaky network or API does not break a live demo: the page tries a live stream, then a plain JSON call, then a recorded replay (`npm run record-replay`; `npm run build:static` makes a server-less build). Rate limit, size limits and a concurrency cap protect the API key (`RATE_LIMIT`, `MAX_PROMPT_CHARS`, `MAX_HISTORY`, `MAX_CONCURRENT`; set `TRUST_PROXY=1` behind a tunnel). Details are in `STACK.md`.

## How AI is used

- **In the product:** Claude (`claude-opus-5-5`) extracts rules from statute text and writes the plain-language explanations.
- **In the build:** developed with Claude Code assisting the author. <!-- TODO: owner to confirm disclosure wording; the FAQ states no AI-disclosure policy. -->

## Scalability

New jurisdictions need no new code: add the source text to the corpus, rerun extraction, and the lookup and change-tracking stages work off the same schema. <!-- TODO: confirm and demonstrate with the hour-16 ordinance. -->

## Data

The starter pack (corpus, sample addresses, schema, dev key) is provided by the organisers and is not committed here unless its terms allow it. <!-- TODO: confirm what is in the repo. -->

## License

MIT, see `LICENSE`.
