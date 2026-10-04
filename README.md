# LegalLens: Rental Housing Law Navigator — Hack-Nation 7 · Challenge 02 (RealPage)

> Which rules apply to this apartment today, and what is about to change?

An AI system that reads a corpus of real state and local housing law, extracts structured rule records, resolves any sample address to its jurisdiction stack, and answers with every applicable rule, in plain language, with a citation and quoted source text. It also tracks law changes: given a new or pending law, it lists the addresses affected and what changes for each.

**Not legal advice.** Output is a reading aid built from public text, not a legal opinion or compliance certification. The answer key behind the challenge has not been reviewed by counsel.

## Demo

<!-- TODO: replace after recording (see video-scripts.md). -->
`[ demo video / GIF goes here ]`

Live demo: `[ link goes here ]`

## Scores

Our own proxy from `node selfcheck.mjs` (run 2026-10-04). It is **not** the organisers' `score.py`, which is not in our pack and has no answer key behind it here. It checks structure only: schema validity, quoted spans found in the cited corpus text, lookup coverage of all 500 addresses, and sanity of the change-test outputs.

| Component | Max | Our proxy |
|---|---|---|
| Extraction accuracy | 25 | 25 (94 of 94 records schema-valid; 78 quoted spans found in the corpus) |
| Address coverage | 20 | 20 (500 of 500 addresses covered, 0 bad result values) |
| Citations | 15 | 14 (5791 of 6209 `applies` answers cited) |
| Change tracking (T1–T6) | 15 | 15 (T1–T5 sanity checks pass; T6 skipped, no T6 entry in `changes.json`) |
| **Total** | 75 | **74** |

A proxy cannot show that the extracted rules are correct, only that they are well formed. The judged components (usability 10, responsible design 10, scalability 5) are scored by judges, not by script, and the held-out key is not available to us.

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

Hosted: deployed with the `vercel` CLI (`vercel.json`); the address CSV is bundled privately and is not in this repo.

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

The lookup page needs the Node server: it calls `GET /api/lookup`, which reads `rules.json`, `lookups.json` and the organisers' `sample_addresses.csv`. `npm run build:static` is not a working static demo. It copies `public/` to `dist/`, which has no `/api`, so the page reports lookups as unavailable. `?fixtures=1` loads `fixtures/lookup-fixtures.json`, which is placeholder data for layout checks and not real law. The server has a rate limit, size limits and a concurrency cap (`RATE_LIMIT`, `MAX_PROMPT_CHARS`, `MAX_HISTORY`, `MAX_CONCURRENT`; set `TRUST_PROXY=1` behind a tunnel). Details are in `STACK.md` and `DEPLOY.md`.

## How AI is used

- **In the product:** Claude extracts rules from the statute text offline, and the lookup pipeline uses it for pinned coverage and supersession decisions (`cov-pins.json`, `supersession-pins.json`), for the Spanish text (`public/es.json`), and for the short plain-language summaries (`public/plain.json`, made offline by `plain-lang.mjs`). Each summary is checked mechanically: any number in it must appear in that rule's own record, and it is capped at 25 words; a summary that fails is dropped and the page falls back to the rule's requirement text. This does not check that a summary is semantically faithful. No model is called at lookup time.
- **In the build:** developed with Claude Code assisting the author. <!-- TODO: owner to confirm disclosure wording; the FAQ states no AI-disclosure policy. -->

## Scalability

New jurisdictions need no new code: add the source text to the corpus, rerun extraction, and the lookup and change-tracking stages work off the same schema. Current size: 94 rules, 500 addresses, 3 states and 10 cities. `ingest-doc.mjs` takes a new document through extraction, supersession and a T6 entry in one command (see `HOUR16.md`).

## Data

The starter pack (corpus, sample addresses, schema, dev key) is provided by the organisers and is gitignored: a fresh clone does not contain it. The corpus has 87 manifest rows, 54 with text and 33 link-only; for 16 of the 94 rules the quoted text comes from pages fetched by plain GET (`data/starter/fetched/`), also gitignored. `lookups.json` keys results by address id (A0001 to A0500) and holds no street addresses. Whether the pack may be redistributed is unconfirmed.

## License

MIT, see `LICENSE`.
