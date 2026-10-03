# Entry ideas by challenge type — pre-kickoff

Written 2026-10-03 ~9:15am CDT. FACT = seen on a page (URL). INFERENCE = mine. Sources were read through a summarizing model, not raw HTML. Audit record: scratchpad/past-tracks-research.md.
**Evidence is thin.** Per-edition challenge titles and winners were mostly not retrievable (hack-nation.ai is a JS shell; Devpost gallery unpublished). Replace this with the real track list at 11:03.

## What past editions show
- FACT: 4th (Feb 7–8 2026): prizes sponsored by OpenAI and Lovable; 1,276 registered. Challenges and winners not found. https://luma.com/90ndbjym
- FACT: 5th (Apr 25–26 2026): challenge sponsors OpenAI, Google, Databricks, SAP, Mozilla, ElevenLabs, World Bank Group, DSV-Gruppe; a venture track; ~2,000 participants. https://eleveight.ai/en/newsroom/zgfnnlny7junw80ybsb6cmt8/armenia-showed-up-eleveight-ai-sponsors-5th-global-ai-hackathon/ (sponsor-side PR, not independent)
- FACT (same page): the DSV-Gruppe challenge was won by a 17-year-old working solo, with "a fully working AI platform that generates hyper-personalized local commercial offers in real time". The only winner found.
- FACT: a "Final pitches" Luma page lists prize sponsors SAP, OpenAI, Google, Paid, Lila Sciences (MIT Sloan AI Club co-host). INFERENCE: probably the 6th; edition number not stated. https://luma.com/qy5qxki1
- Editions 1–3: not found. Past winners other than DSV: not found. Written judging rubric: not found (the FAQ bot says creativity, communication, technical depth; see NOTES.md).
- FACT: the 7th has "6–8 AI challenges". https://luma.com/z3za7zow

## Recurring types (INFERENCE, from sponsor lists only, not challenge text)
Each idea below is buildable in ~18h on our kit: Node + Express, streamed Claude, a recorded-replay fallback. "Rank" is my guess at fit with that kit and with a 60 s demo video.

1. **Enterprise / agent / data (OpenAI, Databricks, SAP).**
   - a) Ask-your-spreadsheet agent: upload a CSV, Claude plans queries and streams the answer plus a chart spec. Replay mode shows a saved run.
   - b) Ticket triage agent: pastes a support queue, Claude classifies, drafts replies, and explains each routing decision.
2. **Corporate/industry problem (DSV logistics, commerce).**
   - a) Personalised-offer generator: input a customer profile and catalogue, stream tailored offers. (Mirrors the one known winner; INFERENCE that a repeat theme scores.)
   - b) Shipment-exception explainer: paste a tracking log, Claude names the delay cause and proposes a customer message.
3. **Voice / conversational (ElevenLabs).** Needs an ElevenLabs credit and key; not on this machine.
   - a) Spoken-feedback coach: type or paste a pitch, Claude critiques it and streams text for a TTS voice.
   - b) Phone-script rehearsal partner: Claude plays the other party, turn by turn.
4. **Public good / development (World Bank, Mozilla).**
   - a) Plain-language explainer for official documents (policy, forms), with a reading-level toggle.
   - b) Open-data question answerer: ask about a public dataset, answers cite the rows used.
5. **Science (Lila Sciences).** Hard in 18h without domain data.
   - a) Paper-to-protocol summariser: paste an abstract, get a checklist of steps and open questions.
   - b) Hypothesis critique: Claude lists confounds and a cheap first experiment.

## Notes
- INFERENCE: demo video is 60 s with the judges' cue of "communication"; ideas whose result is a visible streamed answer in one screen fit best.
- INFERENCE: ranks 1 and 2 need no external key beyond Claude; type 3 needs an ElevenLabs key and is risky unless credits are provided.
- Do not claim any idea matches a real 7th-edition challenge until the track list is read.
