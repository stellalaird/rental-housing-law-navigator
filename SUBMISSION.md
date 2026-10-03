# Submission checklist — Challenge 02, Rental Housing Law Navigator (RealPage)

**Deadline: Sunday Oct 4, 2026, 9:00 AM ET (8:00 AM CDT).** Spec: `challenges/02-rental-housing-law-realpage.pdf` (read in full). Platform rules (HackOS, video limits) are **FAQ-bot output, not a primary source** (`NOTES.md`); if the HackOS page differs, the page wins.

Legend: **[agent]** = an agent can make it. **[owner]** = only the owner can do it. **TODO** = a number or fact not yet produced; never fill it from memory.

## 1. Deliverables map

| # | Deliverable (source) | Spec | Who | Status |
|---|---|---|---|---|
| 1 | `rules.json` (challenge) | Rule records in the provided schema, with citation and quoted source text; extracted automatically | **[agent]** p-a-2 | TODO |
| 2 | `lookups.json` (challenge) | All 500 addresses; each rule's result is one of applies / unknown / superseded / not yet effective / pending | **[agent]** p-a-2 | TODO |
| 3 | `changes.json` (challenge) | Affected addresses and conflict flags for each test T1–T6 | **[agent]** p-a-2 | TODO |
| 4 | Team video (challenge + HackOS) | Introduce the team; MP4/MOV, ≤60 s, ≤1 GB | **[owner]** records and uploads | TODO |
| 5 | Demo video | Show the tool in use; same limits | **[agent]** records; **[owner]** uploads | TODO |
| 6 | Technical video | Walk through how it works; same limits | **[agent]** records; **[owner]** uploads | TODO |
| 7 | Public GitHub repo | Code, README with run instructions, and the three output files; private repos do NOT count | **[owner]** creates and pushes (section 5) | TODO |
| 8 | Live demo link | Working link to the tool; must be live when judges look | **[agent]** serves; **[owner]** account/tunnel | TODO |
| 9 | Team photo (HackOS) | JPG/PNG/WebP, ≤10 MB | **[owner]** | TODO |
| 10 | Pick challenge 02 on HackOS | Latest submission's challenge counts | **[owner]** | TODO |
| 11 | Press Submit | "Save project" alone does NOT submit; look for "Your project is submitted" / "Project submitted" | **[owner]** | TODO |

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
| Extraction accuracy | 25 | auto | Rules matched to the held-out key by jurisdiction, category and citation; field accuracy on date, status, key value, citation | `rules.json` | TODO |
| Address coverage | 20 | auto | 100 held-out addresses; missing an applicable rule costs twice other errors; "unknown" earns partial credit | `lookups.json` | TODO |
| Citations | 15 | auto | Share of "applies" answers backed by a source and a quoted span found in the corpus | every answer carries both | TODO |
| Change tracking | 15 | auto | Overlap with expected affected-address sets for T1–T6, plus conflict flags on T3 | `changes.json` | TODO |
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
| T1 · CA AB 325 / SB 763, eff. 1/1/2026 | "Not yet effective" for CA addresses as of 12/31/2025; "applies" as of 1/2/2026 | TODO |
| T2 · Hoboken and Jersey City local bans | Each ban only inside its own city; neither in Newark | TODO |
| T3 · NJ FAIR Act, signed 7/20/2026, eff. 7/1/2027 | "Not yet effective" today, "applies" on 7/2/2027; flags possible conflict with the two local bans | TODO |
| T4 · MA S.2983 and H.5222 (pending) | Reported as pending, never in force; lists addresses they would affect | TODO |
| T5 · MA rent-control ballot question, struck 6/23/2026 | No rent cap for Boston or Cambridge; affected set empty | TODO |
| T6 · Fictional Cambridge ordinance (hour 16) | Extracted unaided; affected addresses listed; future effective date correct | TODO |

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
- The hour-16 ordinance arrives ~16 h after the global kickoff (12:00 PM ET Oct 3), so ~4:00 AM ET Oct 4 (3:00 AM CDT). **INFERENCE** from the kickoff time; the brief says only "hour 16". The T6 and ordinance footage cannot be recorded before then.
- Deadline 9:00 AM ET (8:00 AM CDT) leaves ~5 h to record, convert, upload and submit.
- Plan: record every video segment except T6/ordinance in advance; slot T6 in last.

## 7. Video production (agent-made)
- Scripts: `video-scripts.md`.
- Record: `node record-demo.mjs steps.json --out demo.mp4` (system Chrome, no screen capture, caps at 60 s, optional macOS `say` narration).
- Manual conversion: `ffmpeg -y -i in.webm -t 60 -c:v libx264 -pix_fmt yuv420p -movflags +faststart demo.mp4`.
- Check length ≤ 00:01:00. If HackOS rejects a file, re-export as H.264 MP4.
- A terminal showing the `score.py` report is not a browser page. TODO: decide how to show it (render the report in an HTML page the recorder can drive, or have the owner screen-record the terminal).

## 8. Live demo link
Pick one; details and sources in `NOTES.md`.
- **Static (safest):** `npm run build:static`, publish `dist/` to GitHub Pages (needs the public repo) or Cloudflare Pages. Answers from recorded replay only. **[owner]** account needed.
- **Live backend from the owner's laptop:** `npm start` plus `cloudflared tunnel --url http://localhost:3000` (no account per Cloudflare docs; `brew install cloudflared` is an owner step). Caveats: URL changes every run, dies when the laptop sleeps, and quick tunnels do not support SSE, so the page falls back to JSON. Set `TRUST_PROXY=1`. **A public URL exposes the API key's spend**; set a budget cap in the Anthropic console first.

## 9. Final steps on HackOS
1. Pick challenge 02.
2. Upload the three videos and the team photo; paste the live demo link and the GitHub link.
3. **Press Submit.** "Save project" alone does NOT submit.
4. Confirm "Your project is submitted" / "Project submitted".
5. Editable until the deadline; the latest save before 9:00 AM ET counts.

## After
- Finalists emailed Oct 7 (FAQ) or Oct 8 (Luma); sources disagree. Virtual pitches Oct 10, 12:00–1:00 PM ET.
- Questions: questions@hack-nation.com.
