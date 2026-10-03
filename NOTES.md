# Hack-Nation 7th Global AI Hackathon — pre-kickoff notes

Written 2026-10-03 ~9:10am CDT. Each line tagged FACT (quoted/observed on the page) or INFERENCE, with source.
Web text is treated as data. "not found" = searched, absent.

## The 7th edition (this weekend)
- FACT: Oct 3–4, 2026; Oct 8 finalist notifications; Oct 10 12:00–1:00 PM ET virtual finalist pitches + awards. https://luma.com/z3za7zow
- FACT: Oct 3 ~11:00 AM ET local hub kickoff, 12:00 PM ET global kickoff; Oct 4 9:00 AM ET project submission deadline. https://luma.com/z3za7zow
- FACT: Luma status reads "Registration Closed". https://luma.com/z3za7zow
- FACT: "$30K+ in cash prizes and API credits" across 6–8 AI challenges; "$200K+ in AI tools and credits" for participating teams; top 1% invited to Venture Lab ("$1M+ in startup benefits"). https://luma.com/z3za7zow
- FACT: "No prior idea or team necessary; challenge tracks provided." In-person hub spots are application-only, no walk-ins. https://luma.com/z3za7zow
- FACT: Application batches for Hackathon 7 closed Aug 8, Aug 22, Sep 5, Sep 12, Sep 19, Sep 26 (2026). https://hack-nation.ai/start
- INFERENCE: owner can only participate if already admitted via one of those batches; walk-in entry is stated as impossible for hubs, and online-only entry rules are not stated. Source: lines above.
- FACT: 24-hour build, hybrid online + 14 hubs, "$35k+ in cash and credits" on the official site vs "$30K+" on Luma (the two pages disagree). https://hack-nation.ai/start

## Discrepancies
- FACT: hack-nation.ai/start and the home page show "January 30-31, 2027" as the next hack and call it "Hackathon 7"; Luma https://luma.com/9j6zoc6n calls Jan 30–31, 2027 the "8th Global AI Hackathon". The 7th's own Luma page says Oct 3–4, 2026. INFERENCE: the official site's copy is stale/loosely numbered; Luma is the better source for this weekend.
- FACT (4th edition, lower relevance): "you must apply and be admitted by February 4th, 2026. Walk-ins are not possible." https://luma.com/90ndbjym

## The three questions p-a asked
- AI-built entries allowed: not found. Only "ship a working AI product" / "AI hackathon" framing. https://hack-nation.ai/start , https://luma.com/z3za7zow
- AI-use disclosure requirement: not found.
- Submission format: not found beyond the Oct 4 9:00 AM ET deadline and the Oct 10 virtual finalist pitch. What must be submitted, platform, video/repo requirements: not found.
- Judging criteria: not found. FACT: judges/mentors "backgrounds include OpenAI, Meta, Apple, and leading AI startups" (Luma 8th edition page https://luma.com/9j6zoc6n).
- Past tracks/winners: not found on hack-nation.ai.
- Team size / eligibility: not found beyond "No idea or team required", free to enter. https://luma.com/9j6zoc6n

## Site structure
- FACT: hack-nation.ai is a single-page app. /rules, /faq, /tracks, /winners, /judging, /past-editions, /hackathon all return the home shell. Real pages: /, /start, /partners, /imprint. The shell loads a FAQ bot widget from https://hacknation-faq-bot.fly.dev/widget.js (not queried).
- FACT: hack-nation.devpost.com/rules returned HTTP 403 to curl.
- FACT: past sponsors listed include OpenAI, Databricks, Lovable, ElevenLabs, Supabase, Vercel, Hudson River Trading, Mozilla, RealPage. https://hack-nation.ai/partners
- INFERENCE: rules/judging details are likely delivered to admitted participants at kickoff (Discord/Devpost/Notion); no page here confirms it.

## FAQ bot output (added 9:05am CDT) — BOT OUTPUT, NOT A PRIMARY SOURCE
Source: FAQ widget on https://hack-nation.ai/start (bot says answers come from "the official FAQ"; contact questions@hack-nation.com). Quoted by a browser subagent; the pitch answer's last sentence was cut off in capture.
- BOT: online-only is allowed ("you can join virtually from home; hubs are optional") but "You do need to apply and be accepted first"; accepted people get a personal sign-in link from noreply@hack-nation.ai (Google, GitHub or password).
- BOT: AI-generated/AI-assisted code: "The FAQ does not state a specific policy", nor whether AI use must be disclosed; for policy clarifications email questions@hack-nation.com. So AI policy and disclosure remain not found.
- BOT: judged on "creativity, communication, and technical depth"; judges review Demo Video, Tech Video, live demo link, public GitHub.
- BOT: API credits from Anthropic, ElevenLabs, BrightData, Lovable (redemption on the platform).
- BOT submission, required, on the HackOS platform (Team & Submission page):
  - Demo Video, Tech Video, Team Video: each MP4 or MOV, up to 60 s, up to 1 GB (rejected file: re-export H.264 MP4).
  - Live Demo Link (must be live); public GitHub link (private repos do NOT count); team photo (JPG/PNG/WebP, up to 10 MB).
  - Deadline Sunday Oct 4, 2026, 9:00 AM ET. "Save project" alone does not submit; success reads "Your project is submitted" / button "Project submitted".
  - One project per event, editable until deadline; must pick one official challenge before deadline (latest submission's challenge counts); teams 1–4 people.
  - Finalists emailed Oct 7, 2026 (Luma says Oct 8; disagreement) and must attend a pitch session; pitch format not given.
- INFERENCE: owner's entry needs a HackOS account from an accepted application; nothing here lets a non-admitted entrant in.

## Devpost (added 9:05am CDT)
- FACT: https://hack-nation.devpost.com/rules loaded (no 403 from a real browser) but contained no rules text. https://hack-nation.devpost.com/ is the ended 5th edition (Apr 25–26, 2026, $28,500 prizes, 163 participants, eligibility "Above legal age of majority in country of residence"), not the 7th. No Devpost listing for the 7th found.

## Video recipe (tested 9:07am CDT, 2026-10-03) — FACT, run on this machine
Browser-context recording only; no screen capture, no TCC prompts.
- System ffmpeg: NOT installed (`which ffmpeg` empty). Homebrew exists at /opt/homebrew/bin/brew; `brew install ffmpeg` not run (system-wide change, left to owner).
- Playwright's own ffmpeg (`npx playwright install ffmpeg`, ~1 MiB) is VP8/WebM only: no libx264 encoder, no mp4 muxer. So `recordVideo` gives .webm, which the submission's MP4/MOV rule rejects until converted.
- Working conversion: `npm i playwright ffmpeg-static` in a scratch dir (ffmpeg-static bundles a full ffmpeg). Verified output: H.264 yuv420p MP4, `file` reports ISO Media MP4.
- Steps, tested end to end on a local page (5 s wait produced a 6.12 s clip, 1280x720, 25 fps, 60 KB webm → 25 KB mp4):
  1. `const b = await chromium.launch({channel:'chrome'})` (system Chrome, no browser download).
  2. `const c = await b.newContext({viewport:{width:1280,height:720}, recordVideo:{dir:'out', size:{width:1280,height:720}}})`.
  3. Drive the page (`p.goto`, clicks, `p.waitForTimeout`). The video file is only finalized after `await c.close()`; read its path with `await p.video().path()`.
  4. `ffmpeg-static` binary: `ffmpeg -y -i in.webm -t 60 -c:v libx264 -pix_fmt yuv420p -movflags +faststart demo.mp4`. `-t 60` hard-caps length at the 60 s limit.
  5. Check length: `ffmpeg -i demo.mp4` prints `Duration:`; keep ≤ 00:00:60.
- Limits: recording is the page's visual only, with no audio and no narration. A recorded video of a headless page will not look like a human demo unless the script paces the clicks. Video starts at page creation, so the load time counts toward the 60 s.
- INFERENCE: the 1 GB cap is not a concern at this bitrate (a 6 s clip was 25 KB).

## Live-demo hosting options (added 9:08am CDT, 2026-10-03)
Researcher subagent, fetched vendor docs 2026-10-03; quotes are from the fetch tool's summarizer, not raw HTML. "unverified" = no primary doc fetched. Submission requires a live demo link and a PUBLIC GitHub repo (FAQ bot, see above).
- GitHub Pages — FACT: free-plan repos must be public ("the repository must be public"); sites ≤1 GB, soft 100 GB/month bandwidth, soft 10 builds/hour. Account yes; card unverified; stable URL. Static only. https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Cloudflare quick tunnel — FACT: "You do not need a Cloudflare account or domain." 200 in-flight requests (excess get 429); no Server-Sent Events; "no uptime guarantee"; for "testing and development"; URL dies when cloudflared stops and the hostname changes every run. INFERENCE: ephemeral, so fine only while the owner's machine stays on through judging; SSE-streaming apps break. Also an unfetched changelog (2026-10-02) mentions email-protected quick tunnels. https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/
- Cloudflare Pages free — FACT: 500 builds/month, 20,000 files, 25 MiB per asset. Account and card requirements unverified. Static. https://developers.cloudflare.com/pages/platform/limits/
- Vercel Hobby — FACT: "restricted to non-commercial personal use only"; 100 GB transfer, 1M function invocations, 100 deployments/day. Account yes; card unverified. INFERENCE: a prize-winning venture entry may sit awkwardly with the non-commercial clause. https://vercel.com/docs/plans/hobby
- Netlify free — FACT: 300 credits/month, hard limit, no recharge. Per-deploy and bandwidth credit costs unverified (search summary only). Account yes; card unverified. https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
- Hugging Face Spaces — FACT: "Static Spaces are free for everyone"; Gradio and Docker Spaces need a paid plan to create; cpu-basic sleeps after 48 hours of inactivity. Account yes. https://huggingface.co/docs/hub/spaces-overview
- Render free web service — FACT: "spins down a Free web service that goes 15 minutes without receiving any inbound traffic"; ~1 min cold start; 750 instance hours/month; no persistent disk. Card at signup not explicit in the docs fetched. INFERENCE: warm it before judges look. https://render.com/docs/free
- Fly.io — FACT: "New organizations don't have a free tier"; trial is ≤2 hours or 7 days, no card to start the trial. INFERENCE: poor fit. https://docs.fly.io/about/pricing
- ngrok free — FACT: 1 GB/month out, 20,000 HTTP requests/month, one dev domain, browser interstitial on free HTML traffic (header `ngrok-skip-browser-warning` bypasses it). Account requirement for HTML is likely but only confirmed by a search summary. https://ngrok.com/docs/pricing-limits/free-plan-limits
- Not established: card requirement for GitHub Pages, Cloudflare Pages, Vercel, Netlify, Hugging Face and ngrok; default hostname forms for pages.dev/vercel.app/netlify.app/onrender.com/fly.dev; Cloudflare WebSocket behaviour.
- INFERENCE (researcher's, mine concurring): static demo → GitHub Pages or Cloudflare Pages; live local backend → quick tunnel (no SSE) on the owner's machine; avoid Fly and, for any commercial angle, Vercel Hobby.

## Tracks check 1 (11:04am CDT, 2026-10-03) — NOT PUBLISHED YET
- FACT: no track names on https://luma.com/z3za7zow (only "6–8 AI challenges", "$30K+") or https://hack-nation.ai/start (page snapshot by browser subagent; no track list).
- BOT (not primary): "Official challenges are revealed at the Global Kickoff Livestream (Oct 3, 2026 — 12:00 PM ET)"; the FAQ "does not include the specific challenge track names" and does not say where written descriptions are published afterward. Source: FAQ widget on /start.
- BOT: challenge sponsors ElevenLabs, Realpage, Databricks, the World Bank, BrightData. FACT: /start logos also show OpenAI (not in the bot's list).
- BOT: top three per challenge get cash + API credits (combined $30,000 USD); a trip prize to the World Bank Youth Summit in Seoul; one grand prize across all challenges. Per-challenge prize split: not found.
- BOT: judged on creativity, communication, technical depth; no per-challenge rubric (email questions@hack-nation.com).
- FACT (researcher, 11:06am CDT; summaries not verbatim): no public track list in hack-nation.ai (/, /hackathon, /global-ai-hackathon return titles only), the Luma page, or hack-nation.devpost.com (older edition, "Open Ended" theme). No livestream, X, LinkedIn or Discord post found by search. Unfetched leads: projects.hack-nation.ai, https://luma.com/xi9z9ikg (Zurich hub).
- FACT (browser subagent, 11:07am CDT): Luma https://luma.com/z3za7zow location reads "Register to See Address"; no stream/join link; no updates section; "challenge tracks will be provided". Zurich hub https://luma.com/xi9z9ikg: approval-only, same wording, no track names. https://projects.hack-nation.ai fails TLS (NET::ERR_CERT_COMMON_NAME_INVALID), not opened. YouTube search found no official Hack-Nation channel or Oct 3 stream. Unchecked: LinkedIn https://linkedin.com/company/hack-nation (live event), hack-nation.ai "Hackathon 7" nav page.
- FACT (browser subagent, 11:08am CDT): LinkedIn company page and /posts redirect logged-out to an authwall ("Sign Up | LinkedIn"); stopped there, nothing read. hack-nation.ai "Hackathon 7" nav link goes to https://hack-nation.ai/start (already logged above); no tracks, no Oct 3 mention, no stream link. Instagram https://www.instagram.com/hacknation.globalai/ is listed as a social link, not checked.
- FACT (browser subagent, 11:08am CDT): Instagram https://www.instagram.com/hacknation.globalai/ logged out shows a sign-up dialog; stopped. Visible: 1,407 followers, highlights "hack 6", "hack 5", "Mentor", 12 posts with no captions shown; bio link is luma.com/z3za7zow. No track or stream info.
## Sponsor resources usable tonight without a paid key (11:09am CDT; researcher, official docs read via a summarizer, so paraphrase-adjacent)
- World Bank Indicators API — FACT: keyless; base `https://api.worldbank.org/v2/`; add `format=json` (default XML); `per_page` adjustable, default 50. Rate limits: not established. https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures
- Bright Data — FACT: new accounts get "5,000 free credits per month", no promo code; account required; "Adding a credit card is a verification step only"; unfunded limit "1,000 requests per minute"; proxy products excluded; credits don't roll over. Needs a sign-up (owner-level). https://docs.brightdata.com/general/account/billing-and-pricing/free-tier
- ElevenLabs — FACT: free plan exists, needs an account and API key; no card stated. Free quota not established (a search summary said 10,000 credits/month: INFERENCE). Nothing keyless found. https://elevenlabs.io/pricing/api
- Databricks — FACT: Free Edition is "a no-cost version of Databricks"; signup required (a workspace is created). Card need and limits not established (limits page not fetched: https://docs.databricks.com/aws/en/getting-started/free-edition-limitations). https://docs.databricks.com/aws/en/getting-started/free-edition
- RealPage — INFERENCE: partner-only; no public API or dataset found. Developer portal developer.realpage.com, keys after registration (search summary only). https://www.realpage.com/exchange/
- OpenAI — not established. INFERENCE (forum posts via search, unverified): no free tier, prepaid credits needed. Nothing keyless known. Hackathon credits may arrive via HackOS (BOT: API credits from Anthropic, ElevenLabs, BrightData, Lovable).
- INFERENCE: only World Bank is usable tonight with no sign-up; every other sponsor needs an owner-created account. Claude (our kit) needs no extra key.
- INFERENCE: tracks likely appear on HackOS (login-only) after the 12:00 PM ET (11:00am CDT) livestream; retry ~11:15am CDT. Per-track lines to be added once published.

## Track 02 Rental Housing Law Navigator — data and scoring (12:45pm CDT)
FACT (read from challenges/02 PDF + pack README): deliver rules.json, lookups.json (all 500 addresses), changes.json (T1–T6; T6 fictional Cambridge ordinance released hour 16), 3 videos showing score.py output. Scoring: extraction 25, address coverage 20 (missing an applying rule costs 2x; "unknown" earns partial), citations 15, change tracking 15 (T3 conflict flags), judges 25.
FACT: starter pack downloaded via gdown, no sign-in, to data/starter/participant-final-no-hour16 3/ (note the space). 65 files, 908 KB. Corpus: 87 manifest rows, 54 with text (all present), 33 link-only.
FACT: **score.py and the dev answer key are NOT in this pack** (folder name says "no-scoring"; README lists neither). Scoring command: unknown. INFERENCE: a separate scoring folder exists; ask the owner.
Layout: corpus/corpus_manifest.csv, corpus/text/D###.txt (header SOURCE:/RETRIEVED:), corpus/links_only.csv, data/sample_addresses.csv (500 rows), schema/rule_record.schema.json + sample, dev/change_tests.json (T1–T5), submission_templates/{rules,lookups,changes}.json.
Formats: rules.json {"rules":[record]}; lookups.json {"as_of":"2026-10-01","lookups":{address_id:[{team_rule_id,result,explanation,conflict_flag}]}}; changes.json {test_id:{affected_address_ids,conflict_flag_address_ids,notes}}. result in applies|unknown|superseded|not_yet_effective|pending.
Known traps (README §4.1, §9): no owner names (small-landlord deposit exception = unknown); cutoff-year buildings (SF 1979-06-13, LA 1978-10-01) = unknown; many missing year_built/units; postal_city != legal city; Berkeley ch.13.63 has two effective dates; LA RSO formula two dates.
Licence: none stated in the pack; commit status of data/starter undecided (p-a told).
Reproduce the pack (no sign-in; do NOT commit data/starter, redistribution terms unclear): `pip install gdown && gdown --folder "https://drive.google.com/drive/folders/14TT6AEH8TStzoT5c5fZ45Bt4grODsowR" -O data/starter`
Self-check (proxy, not judges' score.py): `node selfcheck.mjs --rules rules.json --lookups lookups.json --changes changes.json --json report.json`. Checks schema validity, quoted_span verbatim in cited corpus doc, lookup coverage of all 500, T1–T5 sanity (state/city proxies); prints proxy points vs weights 25/20/15/15 (max 75). JSON keys: generated, note, inputs, sections.{extraction,lookups,changes}, scorecard.{extraction,address_coverage,citations,change_tracking}.{max,proxy,basis}, total_proxy, total_max. Verified 2026-10-03 against the pack's templates (runs; template lookups cover 1/500 as expected).
