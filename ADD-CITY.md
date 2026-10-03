# Add a new jurisdiction live (stretch goal: scalability)

One command adds a city that is not in the corpus, from one official document fetched by plain GET, through the same pipeline as T6:

```
node add-city.mjs "https://cao-94612.s3.amazonaws.com/documents/TPO-Amendment-July-2020.pdf" --stack "CA|Alameda County, CA|Oakland, CA"
```

Run from the repo root. It writes only under `out/add-city/` (scratch copies of `rules.json`, `changes.json` and the audit log); the real files are never touched, so it is safe to run on camera. Pass `--out <dir>` to keep several runs.

## What it does (rehearsed twice 2026-10-03: 1 min 44 s and 1 min 18 s, almost all of it the model extraction; the count varied, 22 then 23 rules, both with 0 quotes dropped)

1. **GET** the URL (plain HTTP, no login or browser), convert PDF to text, save with `SOURCE:` and `RETRIEVED:` headers. About 3 s.
2. **BEFORE**: lists Oakland rules in the live `rules.json` for the stack. Result: 0.
3. **INGEST** with `ingest-doc.mjs`: extract, keep only rules whose quote is found verbatim in the document, map to the schema. Result: 22 to 23 Oakland rules (the model's count varies by run), 0 quotes dropped, 0 superseded, three categories (rent increase limits, just cause eviction, screening restrictions).
4. **AFTER**: the same stack now returns 22 or 23 rules, each with status, citation (e.g. O.M.C. 8.22.360A) and the quoted span.

## Recording plan (p-a-1 records; about 60 s of screen)

1. Start on the 10-city list: Oakland is not one of them. Say so.
2. Run the command above. It takes 80 to 105 s of model work every time (the second rehearsal run was not served from cache): cut the wait with a visible "(about 90 s, cut)" caption.
3. Pause on `BEFORE: 0 Oakland rules`, then on `AFTER: 22 or 23` and one rule's citation plus quoted span.
4. Close on the one-line claim: a new city is one official document and one command, with the same quote check and audit record as the other ten.

## Say honestly

- **No sample address is in Oakland** (0 of 500), so this demo looks rules up by jurisdiction stack, not by street address, and `changes.json` T6 would affect 0 addresses. Do not imply an address lookup for Oakland.
- The document is a 2020 amendment ordinance that restates parts of O.M.C. Chapter 8.22. It is a partial source for Oakland, not the whole code, and it states no effective date, so the rules show "in force; no effective date stated".
- Nothing here changes the submission's real `rules.json`. Adding Oakland for real would be p-a-2's to merge and rebuild.
