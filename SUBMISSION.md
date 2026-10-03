# Submission checklist — Challenge 02, Rental Housing Law Navigator (RealPage)

**Deadline: Sunday Oct 4, 2026, 9:00 AM ET (8:00 AM CDT).** Spec: `challenges/02-rental-housing-law-realpage.pdf` (read in full). Platform rules (HackOS, video limits) are **FAQ-bot output, not a primary source** (`NOTES.md`); if the HackOS page differs, the page wins.

## 1. Tonight's checklist (state as of 2026-10-03 ~1:30 PM CDT)

| # | Item | Status | Where / waiting on | Owner |
|---|---|---|---|---|
| 1 | `rules.json` | **94 rules**, 94 schema-valid; quoted spans found in corpus for 78, the other 16 rest on fetched link-only pages (README Limitations) | `rules.json` | p-a-2 |
| 2 | `lookups.json` | **500/500 addresses, 9403 entries**; 0 bad results, 0 unknown rule ids; 5791 of 6319 `applies` cited | `lookups.json` | p-a-2 |
| 3 | `changes.json` | **T1 250, T2 89, T3 140, T4 110, T5 0** affected. **T6 absent**: waits on the hour-16 doc | `changes.json` | p-a-3 |
| 4 | Demo video | **UNCONFIRMED**: final file name and duration. p-a-1 is to copy the finals into `videos/` (gitignored) and send names and durations | `videos/` (empty until p-a-1 delivers) | p-a-1 records, owner uploads |
| 5 | Tech video | **UNCONFIRMED**: final file name and duration; **T6 slide pending** until the drop | `videos/` (same) | p-a-1 records, owner uploads |
| 6 | Team video | not made; ≤60 s, MP4/MOV | `video-scripts.md` | **owner** |
| 7 | Team photo | not made; JPG/PNG/WebP ≤10 MB | HackOS | **owner** |
| 8 | Public GitHub repo | local git only, no remote; steps in section 5 | owner terminal | **owner** pushes |
| 9 | Live demo link | no host chosen; pick from `DEPLOY.md`; **also decide whether `sample_addresses.csv` may be redistributed** (without it every lookup is a 503; `ADDRESSES_CSV` env points to a copy) | `DEPLOY.md` | **owner** |
| 10 | HackOS: pick challenge 02, upload, **press Submit** (Save alone does not submit) | not done | section 9 | **owner** |

**Selfcheck: 73.7 / 75 (proxy, not the judges' `score.py`).** Extraction 25/25 and coverage 20/20 are measured against our own dev key (10 rules, 20 addresses), so they say little about the held-out 58 rules and 100 addresses. Citations 13.7/15 comes from the 5791/6319 cited ratio. Change tracking 15/15 checks only that sets exist and are in the right place. T6 check is skipped until a T6 entry exists. The judged 25 are not scored.

**Hour-16 steps still owed after the drop** (full runbook `HOUR16.md`):
1. Drive watcher fires; download the doc into `data/starter/hour16/` (p-a-3).
2. `ingest-doc.mjs <doc> --dry`, check, then the real run (p-a-3).
3. `npm run rebuild -- --with-lookups`, then restart the server on :3000 (p-a-3, p-a-2).
4. Confirm the new `new-*` rule id in `/api/lookup` before and after its effective date; `node selfcheck.mjs` T6 check (p-a-3, p-a-1).
5. Record the hour-16 segment, add the T6 slide to the tech video (p-a-1).
6. Commit `rules.json lookups.json changes.json public/es.json`; owner uploads the final videos.

Legend: **[owner]** = only the owner can do it. **TODO** = a number or fact not yet produced; never fill it from memory. Section 2 onward is background and may lag the table above; the table wins.

### What the three videos must show (from the challenge brief)
The brief says the three videos "need to include your scores". Required on screen across them:
- `score.py` run on the dev set, **full score report visible**.
- Results for change tests **T1–T6**.
- The system **processing the hour-16 ordinance test dataset** (released via the Google Drive folder ~16 h into the event; see section 6 for timing).

Each video is capped at 60 s on HackOS (FAQ bot), so allocation matters. Proposed split, scripts in `video-scripts.md`:
- Demo video: live address lookup, then the hour-16 ordinance being processed.
- Technical video: pipeline walkthrough, then the full `score.py` report and T1–T6.
- Team video: team intro, with one headline score line. Owner records this one.

Risk: the full score report plus six test results may not be legible in under 60 s. If it is not, hold the report on screen longer and cut narration. Do not exceed 60 s; the upload may be rejected.

## 2. Scoring rubric map

Total 100: **75 automatic** (organisers' `score.py`) + **25 judged**.

| Component | Pts | Type | How measured (brief) | Where we address it | Our score |
|---|---|---|---|---|---|
| Extraction accuracy | 25 | auto | Rules matched to the held-out key by jurisdiction, category and citation; field accuracy on date, status, key value, citation | `rules.json` | 25/25 proxy (own dev key only) |
| Address coverage | 20 | auto | 100 held-out addresses; missing an applicable rule costs twice other errors; "unknown" earns partial credit | `lookups.json` | 20/20 proxy (own dev key only) |
| Citations | 15 | auto | Share of "applies" answers backed by a source and a quoted span found in the corpus | every answer carries both | 13.7/15 proxy |
| Change tracking | 15 | auto | Overlap with expected affected-address sets for T1–T6, plus conflict flags on T3 | `changes.json` | T1–T5 pass the local `selfcheck.mjs` proxy (15/15); the real score is judged against the held-out sets, so this is a floor on information |
| Plain language and usability | 10 | judges | Demo | demo video, live link | judged |
| Responsible design | 10 | judges | Uncertainty, audit trail, guardrails | section 4 | judged |
| Scalability path | 5 | judges | How the approach extends to new jurisdictions | section 4 | judged |

Notes:
- Judges score against the held-out key (58 rules, 19 "no rule at this level" findings; 100 of the 500 addresses). We only have the dev key (10 rules, 20 addresses), so our self-test numbers are a floor on information, not a prediction.
- Minimum viable entry is Modules A and B scored on the dev set. Module C (change tracking) is also listed as required in the brief.
- Automated extraction only; the hour-16 ordinance and a live rerun in the demo check this.
- "Unknown" is a valid answer and earns credit. Do not trade it for guesses.

## 3. Test cases T1–T6 (what a correct system does)

| Test | Correct behaviour | Our result |
|---|---|---|
| T1 · CA AB 325 / SB 763, eff. 1/1/2026 | "Not yet effective" for CA addresses as of 12/31/2025; "applies" as of 1/2/2026 | 250 CA addresses affected; `asOf` returns not yet effective on 12/31/2025 and applies on 1/2/2026 (`test-changelog.mjs`, 9/9) |
| T2 · Hoboken and Jersey City local bans | Each ban only inside its own city; neither in Newark | 89 affected, all inside Hoboken or Jersey City legal limits. **Currently the `change_tests.json` spec fallback, labelled in `changes.json`**: no Hoboken or Jersey City ban text was extractable. It becomes a cited extracted rule if the link-only docs yield text, then regenerate. |
| T3 · NJ FAIR Act, signed 7/20/2026, eff. 7/1/2027 | "Not yet effective" today, "applies" on 7/2/2027; flags possible conflict with the two local bans | 140 affected; 89 flagged, with the two rule-pair conflicts as primary items and per-address flags as detail |
| T4 · MA S.2983 and H.5222 (pending) | Reported as pending, never in force; lists addresses they would affect | 110 MA addresses listed as pending (per `change_tests.json`; the bill text is not in the corpus) |
| T5 · MA rent-control ballot question, struck 6/23/2026 | No rent cap for Boston or Cambridge; affected set empty | 0 affected |
| T6 · Fictional Cambridge ordinance (hour 16) | Extracted unaided; affected addresses listed; future effective date correct | Path built and run with `--dry` on a fake Cambridge ordinance (`not_yet_effective`, 2027-03-01, 49 addresses); real run waits for the hour-16 doc |

## 4. Judged criteria

### Plain language and usability (10, judges: demo)
- **What judges see:** the demo video and the live link.
- **Evidence to show:** an address in, a short plain-language answer out, each rule with its citation; unknowns and pending law visibly distinct.
- **Stretch if time:** Spanish view, confidence score and conflict flag per answer (listed as stretch goals in the brief).
- **Status:** TODO. Owner of the page: p-a-2.

### Responsible design (10, judges: uncertainty, audit trail, guardrails)
Cover each of these, in the README and on screen:
- **Not legal advice:** stated on every interface (the rules of the event require this).
- **Explicit unknowns:** `unknown` when coverage depends on a fact not in the data (for example, no year built for San Diego, none for Berkeley, no units for Berkeley).
- **Citations on every answer:** source, retrieval date and a quoted span found in the corpus; no invented rules or citations where the text is silent.
- **Legal jurisdiction, not postal city** (p-a-1 geocoder `c42b414`, verified by p-a): lookups match on the legal jurisdiction; 32 of 500 addresses have a Boston neighborhood as postal name (e.g. Dorchester → legally Boston), 1 is San Ysidro → San Diego. Fuzzy matches with a wrong house number resolve to `unknown` instead of a guess (9 of 500 unknown). Do not cite a Cambridge → Boston example (retracted).
- **As-of date and enacted vs pending:** every answer carries both.
- **Corpus-as-data prompt-injection handling:** corpus text is passed as quoted data; instructions inside a document are not obeyed. TODO: confirm the prompt wording and show one example.
- **Conflicts and low confidence flagged** for human review (T3 is the visible case).
- **Audit log** of sources, model outputs and changes. TODO: confirm it exists.
- **No evasion help, no non-public data, no scraping against site terms.**

### Scalability path (5, judges)
- **Claim:** a new jurisdiction means adding source text and rerunning extraction; schema, lookup and change tracking are unchanged.
- **Evidence:** the hour-16 Cambridge ordinance processed live (T6) is the proof.
- **Status:** TODO until T6 runs.

## 5. Public GitHub repo — owner-only commands (not run by any agent)
1. On github.com: **New repository**, name e.g. `hack-nation-7`, visibility **Public**, **do not** add a README, .gitignore or license (the repo already has them).
2. In a terminal:

```bash
cd ~/local-dev/hack-nation-7
git remote add origin git@github.com:<your-username>/hack-nation-7.git
git push -u origin main
```

(HTTPS instead of SSH: `https://github.com/<your-username>/hack-nation-7.git`.)
3. Open the repo URL in a private/incognito window to confirm it loads without login. That is the link to paste into HackOS.

Before pushing: confirm `.env` is untracked, that `rules.json`, `lookups.json`, `changes.json` and the README are committed, and check the starter pack's terms before committing corpus or address data (the brief says "No customer, pricing or proprietary data" and gives no redistribution terms, so TODO: owner to confirm).

## 6. Timeline
- **Hour-16 release time: UNKNOWN.** The spec says only "released at hour 16" via the Google Drive folder, and the pack README says only "via the Google Drive folder". No source gives a clock time or when hour 0 starts. If hour 0 were the 12:00 PM ET global kickoff (FAQ-bot, not primary) it would be ~4:00 AM ET / 3:00 AM CDT Oct 4, but the spec's 24-hour plan (hours 20–23 for scoring) would then run past the 9:00 AM ET deadline, so do not rely on this. p-a-2 polls the Drive folder for T6. The T6 and ordinance footage cannot be recorded before it appears.
- Deadline is 9:00 AM ET (8:00 AM CDT); leave time to record, convert, upload and submit after T6 appears.
- Plan: record every video segment except T6/ordinance in advance; slot T6 in last.

## 7. Video production (agent-made)
- Scripts: `video-scripts.md`.
- Record: `node record-demo.mjs steps.json --out demo.mp4` (system Chrome, no screen capture, caps at 60 s, optional macOS `say` narration).
- Manual conversion: `ffmpeg -y -i in.webm -t 60 -c:v libx264 -pix_fmt yuv420p -movflags +faststart demo.mp4`.
- Check length ≤ 00:01:00. If HackOS rejects a file, re-export as H.264 MP4.
- A terminal showing the `score.py` report is not a browser page. TODO: decide how to show it (render the report in an HTML page the recorder can drive, or have the owner screen-record the terminal).

## 8. Live demo link
The server needs no model, no `claude` CLI and no `.env`; what a host must provide, and the one data file it needs, is in `DEPLOY.md`. Host choice, TLS and domain are the owner's. The older static-build and tunnel options are in `NOTES.md`; a tunnel from the laptop dies when it sleeps.

## 9. Final steps on HackOS
1. Pick challenge 02.
2. Upload the three videos and the team photo; paste the live demo link and the GitHub link.
3. **Press Submit.** "Save project" alone does NOT submit.
4. Confirm "Your project is submitted" / "Project submitted".
5. Editable until the deadline; the latest save before 9:00 AM ET counts.

## After
- Finalists emailed Oct 7 (FAQ) or Oct 8 (Luma); sources disagree. Virtual pitches Oct 10, 12:00–1:00 PM ET.
- Questions: questions@hack-nation.com.
