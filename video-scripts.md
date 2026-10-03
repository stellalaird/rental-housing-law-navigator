# Video scripts — Rental Housing Law Navigator

Each video: MP4/MOV, **≤60 s**, ≤1 GB (HackOS, FAQ-bot source). Narration at ~2.3 words/s: **≤130 words per video** leaves room for pauses. The brief requires the three videos to show: the full `score.py` report on the dev set, T1–T6 results, and the hour-16 ordinance being processed.

Any number below in `‹…›` is a placeholder for a real number from the actual run. Never read a score aloud that was not printed by `score.py`.

**Recording with `record-demo.mjs`:** each step may carry `"narrate":"text"` (macOS `say`, muxed as AAC, started at that step's timestamp). Pace steps so narration does not overlap or run past 60 s (the recorder warns). `goto` takes a URL, or a relative path that opens as `file://`. Terminal output is not a browser page: render the `score.py` report and the T1–T6 table into a static HTML page (`report.html`) and `goto` it, or have the owner screen-record the terminal. TODO: pick one.

---

## 1. Demo video (~55 s) — agent records

**Shows:** a real address lookup, then the hour-16 ordinance processed live.
**Split of time:** 0–35 s lookup, 35–55 s ordinance. Record the lookup part early; record the ordinance part after it is released (release time unknown, see `SUBMISSION.md` section 6) and join the clips.

| Time | On screen | Narration |
|---|---|---|
| 0–6 | Landing page, "not legal advice" visible | "Which housing rules apply to this apartment today, and what is about to change? Pick any address." |
| 6–20 | Type/select a sample address (TODO: choose one with a local-over-state override, e.g. a San Francisco building). Result lists rules. | "Here is a building in ‹city›, built ‹year›. The system builds its jurisdiction stack and lists every applicable rule, in plain language." |
| 20–35 | Click a rule: citation, retrieval date, quoted span. Point at an "unknown" and a "pending" row. | "Every rule carries its source and a quoted span. Where a fact is missing, it says unknown. Pending bills are never shown as law." |
| 35–55 | Hour-16 Cambridge ordinance: drop it in, extraction runs, affected addresses list, future effective date shown. | "Now the surprise ordinance, released this morning. Extracted with no hand coding. ‹N› Cambridge addresses affected, effective ‹date›." |

Sketch of `steps.json` (selectors are placeholders until the page exists):

```json
{"steps":[
 {"goto":"http://localhost:3000","narrate":"Which housing rules apply to this apartment today, and what is about to change? Pick any address."},
 {"pause":5500},
 {"type":{"selector":"#q","text":"TODO sample address","delay":60}},
 {"click":"#go"},
 {"waitFor":{"selector":"#out","text":"TODO","timeout":90000}},
 {"pause":3000,"narrate":"Every rule carries its source and a quoted span. Where a fact is missing, it says unknown."},
 {"pause":12000}
]}
```

---

## 2. Technical video (~58 s) — agent records, scores shown

**Shows:** the pipeline, then the `score.py` dev-set report and T1–T6.

| Time | On screen | Narration |
|---|---|---|
| 0–14 | `tech-video/` slide: Corpus → Extract (LLM) → rules.json → Resolve → Apply → Explain; Track change. | "The corpus goes through an LLM extractor that emits one schema record per rule, with a quoted span. Lookup geocodes the address, builds the state, county and city stack, and tests each rule's conditions against year built and unit count." |
| 14–24 | Guardrails slide: unknown, as-of date, enacted vs pending, corpus as data. | "Missing facts return unknown. Corpus text is data, never instructions. No evasion advice, and every interface says not legal advice." |
| 24–42 | Full `score.py` report on screen, held long enough to read. | "Organisers' scoring script, dev set: extraction ‹X› of 25, address coverage ‹X› of 20, citations ‹X› of 15." |
| 42–58 | T1–T6 table with pass/fail per test; T3 conflict flag highlighted. | "Change tests: ‹T1–T6 results›. T3 flags the possible conflict between the New Jersey FAIR Act and the two local bans." |

Built: `tech-video/index.html` (4 slides) and `tech-video/steps.json` (ends on `report.html`). Generate the report page with `node tech-video/make-report.mjs --selfcheck report.json` (p-a-1's `selfcheck.mjs --json` output; PROXY scores, labelled as such, since no official score.py exists in our pack). `--score score.txt` still shows an official score.py output verbatim if one arrives. Narrate only proxy numbers as proxy. Record: `node record-demo.mjs tech-video/steps.json --out tech.mp4`. Not yet recorded; the final slide timing was never run, so check total ≤60 s.

---

## 3. Team video (~50 s) — owner records

An agent cannot record this (needs faces and voice). Suggested outline, owner to adapt:

| Time | On screen | Say |
|---|---|---|
| 0–10 | Team on camera | Names and where you are from. |
| 10–30 | Team on camera | Why housing law, and who you built it for: renters, small landlords, advocates. |
| 30–50 | Optional cut to the score screen | One headline result, only a number from the real `score.py` run: "‹X› out of 75 automatic points on the dev set." |

Team size is 1–4 (FAQ bot).

---

## 4. Score and test footage checklist (across all three videos)

- [ ] Full `score.py` report on the dev set, readable on screen (technical video).
- [ ] T1–T6 results shown (technical video).
- [ ] Hour-16 ordinance processed on screen (demo video).
- [ ] No score or test result narrated unless it appears on screen from a real run.
- [ ] Each export ≤60 s, H.264 MP4 (`ffmpeg ... -t 60`), file opens and plays before upload.
