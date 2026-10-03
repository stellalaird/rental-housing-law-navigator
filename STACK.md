# STACK.md — Hack-Nation 7 default stack (proposal, 2026-10-03)

Status: draft by p-a-2. `npm install` done; page serves in both modes; cli mode verified end to end 2026-10-03; api mode NOT verified live (no key on this machine; only the no-key error path was exercised).

## Stack
- Frontend: one static page (`public/index.html`), vanilla JS, no build step. Swap to Vite+React only if the track needs real UI state.
- Backend: Node 22 (installed: v22.14.0) + Express, one file (`server.mjs`). Serves the page and `POST /api/chat` as an SSE stream.
- Model: `claude-opus-5-5` via `@anthropic-ai/sdk`. Key read from env server-side only; never reaches the browser.
- Run: `npm install && npm start` → http://localhost:3000. `BACKEND=api` (default) or `BACKEND=cli` (see Backends).

## Reskin
Edit `config.mjs` only: `title`, `tagline`, `systemPrompt`, `examples`. Server serves title/tagline/examples at `GET /api/config`; the system prompt never leaves the server. `SYSTEM_PROMPT` env still overrides.

## Fallbacks and static build
- Client order: live SSE stream, then `POST /api/chat?stream=0` (JSON `{text, thinking, usage, error, refusal}`) if the stream errors or is blocked, then recorded replay.
- Replay: `npm run record-replay` (server running; `node record-replay.mjs [baseUrl]`) runs `config.examples` through the real backend and writes `public/replay.json` (also holds title/tagline/examples). Re-record after every reskin; current file holds placeholder-prompt answers.
- Static build: `npm run build:static` copies `public/` to `dist/` (index.html, replay.json, assets; fails if replay.json is missing). Publish `dist/`. With no `/api`, the page reads config from replay.json and answers example prompts from it, labelled "Recorded response". Unrecorded prompts get an honest "no recorded response" message.
- Check: `node test-browser.mjs <livePort>` (headless system Chrome via Playwright; needs a running server) covers live stream, blocked-stream fallback, friendly 429, and static replay.

## Hardening (`/api/chat`, env-tunable)
- `RATE_LIMIT` (10/min per IP), `MAX_PROMPT_CHARS` (4000 per message), `MAX_HISTORY` (20 messages), `MAX_CONCURRENT` (2 simultaneous model calls / claude children; extra requests get 429, no queue).
- Rejections are JSON `{error}` sent before any SSE headers: 429 (rate, busy) and 400 (too long, malformed). The client shows the message in the note line and does not fall back to JSON/replay.
- Set `TRUST_PROXY=1` behind a tunnel/proxy, otherwise every client shares the proxy's IP and one rate bucket.
- Slots are released on response finish or client disconnect.

## Backends (`BACKEND=api|cli`)
- `api` (default): SDK + `ANTHROPIC_API_KEY` from `.env`. Settings below. Untested live.
- `cli`: spawns `claude -p` per request, prompt over stdin, stream-json parsed and re-emitted as the same SSE events. Uses the owner's `claude` login; no key in the repo.
- cli flags: `--allowedTools=` (the `=` is required), `--tools ""`, `--strict-mcp-config`, `--disable-slash-commands`, `--setting-sources ""`, `--system-prompt`, `--model claude-opus-5-5`, `--no-session-persistence`, cwd `/`. Without the isolation flags the child inherited the owner's MCP servers, hooks and ~24k tokens of context; with them input is ~420 tokens. Default CLI model is sonnet-5-5, hence the explicit `--model`.
- Verified (cli): streams text, multi-turn, child reports no tools and no hook reminders, timeout emits one error and kills the child, client disconnect kills the child.
- cli caveats: needs the owner's claude login on the demo machine; history is flattened into one prompt; flag behaviour is current-CLI-only; one process per request (slower start, no prompt caching control).
- Env: `PORT` (3000), `CLI_TIMEOUT_MS` (120000), `CLAUDE_BIN` (claude), `CLI_MODEL`, `SYSTEM_PROMPT`, `USE_FALLBACKS`.

## API settings (from the claude-api skill, TypeScript docs)
- `thinking: {type: "adaptive", display: "summarized"}`. Always on for Opus 5.5; `disabled` and `budget_tokens` return 400.
- `output_config: {effort: ...}` set explicitly; default is `medium` on this model. Scaffold uses `high`.
- Stream (`client.messages.stream`, `max_tokens` 64000). No temperature/top_p/top_k (400); no forced tool_choice.
- Check `stop_reason === "refusal"` before reading content.
- Fallbacks: skill says opt in by default for Opus 5.5 (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`, via `client.beta.messages`). Scaffold has it behind `USE_FALLBACKS=1`; SDK typing for the scalar form not verified. Tell the owner if on.
- Price: $4 in / $20 out per MTok; cache reads $0.20/MTok.

## Navigator (rules, lookups, endpoints)

- **Endpoints** (server.mjs): `GET /api/lookup?address=<id or text>&date=YYYY-MM-DD` (stack, per-rule results, not legal advice), `GET /api/rules`, `GET /api/lookups`.
- **Build pipeline**: `extract-rules.mjs` (per-doc extraction) -> `consolidate-rules.mjs` (dedupe, stable ids, curated patches) -> `rules.json` -> `build-lookups.mjs` -> `lookups.json` (500 addresses). All model calls go through `lib/llm.mjs` and are cached in `cache/`, so a rerun is cheap.
- **Pins make rebuilds deterministic**: the two model steps in `build-lookups.mjs` (per-rule coverage, per-city supersession) are stored in `cov-pins.json` and `supersession-pins.json`, keyed by a hash of the exact prompt. A matching pin is used as is; the model is called only for a new or edited rule (no pin or stale hash), and the run logs `pins: N pinned, M model calls`. Picks decided by hand from the rule text carry a `basis`. Rolling windows (`exempt_if_built_within_years`, `unknown_if_built_within_years`) are computed against the build's as-of year; `lib/navigator.mjs` reads the stored gate for other query dates, so they are not recomputed per date. `node build-lookups.mjs --export-pins` regenerates the pin files from the model/cache and overwrites hand picks. `translate-es.mjs` reuses `public/es.json` entries whose English source hash (stored in the sidecar `es-source.json`) is unchanged and calls the model only for new or changed rules; verified 2026-10-03 in a fresh clone with no cache and a failing `CLAUDE_BIN`: full `rebuild --with-lookups` reaches `rebuild ok`. `data/starter/` (gitignored) must exist on the build machine.
- **One command after a new document**: `npm run rebuild -- --with-lookups` (p-a-3's rebuild; ingest writes `new-<doc>-N` ids, then rules, lookups and changes are regenerated).
- **Results**: applies | unknown | superseded | not_yet_effective | pending. Time status comes from `changelog.mjs` `asOf`; coverage (units, year built, a named blocking fact) and local-over-state supersession are applied by `build-lookups.mjs`. Missing data gives `unknown` naming the condition, never a silent applies.
- **As-of queries**: not-yet-effective and pending entries carry `if_in_force` (the unknown or superseded result they take once in force); `lib/navigator.mjs` applies it when the query date moves the rule into force.
- **Curated patches** in `consolidate-rules.mjs`: SF rent ordinance coverage (units first issued a CO after 1979-06-13 are exempt, from D079); Berkeley coverage rule (D009); NJ P.L. 2026 c.43 / Jersey City / Hoboken conflict flags; MA H.5222 pending; key_value wording for MA ch. 40P and Santa Ana.
- **`source_note`** (optional string on a rule): set when the quoted span is verbatim in a fetched page, not the starter corpus. Official hosts are labelled `alt`; others are `secondary` with confidence capped at 0.5.
- **Not verified**: the `api` backend mode; a real judges' score (selfcheck is a proxy).

## Deploy, no owner account
- Primary: run on the owner's laptop, demo from localhost. Zero accounts.
- If judges need a public URL: Cloudflare quick tunnel (`cloudflared tunnel --url http://localhost:3000`) needs no account per my recollection. NOT verified; cloudflared is not installed (a brew step). URL is temporary and dies with the laptop session.
- Any persistent host (Vercel, Netlify, Render, Fly) needs an owner account. Unavoidable only if the track demands a persistent URL; name it then.
- A public tunnel exposes the key's spend to anyone with the URL. Add a passphrase or rate limit before sharing.

## Owner-side needs
1. API key. Found: none. `ANTHROPIC_API_KEY` unset, `ANTHROPIC_AUTH_TOKEN` unset, `ant` CLI not installed, `~/.config/anthropic` absent. Owner supplies a key from console.anthropic.com.
2. Where it goes: `.env` in the repo root (gitignored), loaded by `node --env-file-if-exists=.env` (no crash if absent; cli mode needs no .env). Never committed, never printed.
3. Spend: a budget cap in the Anthropic console is advisable.
4. Accounts: none for localhost. Hosting/tunnel accounts only per the Deploy section.
5. Submission platform account: unknown; p-a-1 is reading the rules.
