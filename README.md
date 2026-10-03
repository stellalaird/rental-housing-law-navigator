# Demo — Hack-Nation 7th Global AI Hackathon entry

> **Placeholder content.** Title, tagline and prompts below are the kit's defaults. They get replaced once the challenge track is chosen (edit `config.mjs`, then re-record the replay).

A streaming AI web app built in one weekend: type a prompt, watch Claude answer token by token. It is built to **never show a dead screen in front of a judge**: if the live model call fails, it degrades to a plain JSON call, then to a recorded answer.

## Demo

<!-- TODO: replace after recording. `node record-demo.mjs steps.json --out demo.mp4`, then convert to GIF or link the hosted video. -->
`[ demo GIF / video goes here ]`

Live demo: `[ link goes here ]`

## How it works

```
Browser (public/index.html, vanilla JS)
   │  POST /api/chat  (SSE stream)
   ▼
Express server (server.mjs)  ── guard: rate limit, size limits, concurrency cap
   │
   ├─ BACKEND=api  → Anthropic SDK, claude-opus-5-5, adaptive thinking, effort high
   └─ BACKEND=cli  → spawns `claude -p` per request (owner's login, no key in repo)
```

- **Frontend:** one static page, vanilla JS, no build step.
- **Backend:** Node 22 + Express in a single file. `POST /api/chat` streams Server-Sent Events.
- **Model:** `claude-opus-5-5` through `@anthropic-ai/sdk`, with adaptive thinking and `output_config.effort: high`. The API key stays server-side.
- **Reskin in one file:** `config.mjs` holds the title, tagline, system prompt and example prompts. The system prompt never leaves the server; `GET /api/config` serves only the title, tagline and examples.

## Run it

Needs Node 22.

```bash
npm install
npm start          # http://localhost:3000
```

**API mode (default):** put `ANTHROPIC_API_KEY=...` in a `.env` file in the repo root (gitignored; see `.env.example`). `npm start` loads it.

**CLI mode:** no key needed, uses a logged-in `claude` CLI on the same machine.

```bash
BACKEND=cli npm start
```

Other settings (all optional environment variables): `PORT`, `CLI_TIMEOUT_MS`, `CLAUDE_BIN`, `CLI_MODEL`, `SYSTEM_PROMPT`, `USE_FALLBACKS`.

## Robustness

Built so a flaky network, an API hiccup or a crowd of judges does not break the demo.

| Layer | What it does |
|---|---|
| **Fallback chain** | Client tries the live SSE stream, then `POST /api/chat?stream=0` (plain JSON), then a recorded replay. |
| **Recorded replay** | `npm run record-replay` runs the example prompts through the real backend and saves `public/replay.json`. |
| **Static build** | `npm run build:static` copies `public/` to `dist/`. With no server, the page answers example prompts from the replay and labels them "Recorded response". Unrecorded prompts get an honest "no recorded response" message. |
| **Rate limit** | `RATE_LIMIT`, default 10 requests/min per IP. |
| **Size limits** | `MAX_PROMPT_CHARS` (4000 per message), `MAX_HISTORY` (20 messages). |
| **Concurrency cap** | `MAX_CONCURRENT`, default 2 simultaneous model calls. Extra requests get a friendly 429 rather than a queue. |
| **Clean rejections** | Rejections are JSON `{error}` sent before any SSE headers; slots are freed on finish or client disconnect. |

Behind a tunnel or proxy, set `TRUST_PROXY=1` so each visitor gets their own rate bucket.

## Testing

With a server running:

```bash
node test-browser.mjs 3000
```

Headless Chrome via Playwright covers the live stream, the blocked-stream fallback, the friendly 429 and the static replay.

## How AI is used

- **In the product:** Claude is the core engine. The server shapes the prompt (system prompt in `config.mjs`), streams the response, and checks `stop_reason` for refusals before showing anything.
- **In the build:** the project was developed with Claude Code assisting the author. <!-- TODO: confirm the disclosure wording before submitting; the FAQ states no AI-disclosure policy. -->

## Repo map

| Path | Purpose |
|---|---|
| `server.mjs` | Express server, both backends, hardening |
| `config.mjs` | Title, tagline, system prompt, examples |
| `public/` | The page and `replay.json` |
| `build-static.mjs`, `record-replay.mjs` | Static build and replay recorder |
| `record-demo.mjs`, `tech-video/` | Demo-video recorder and tech-video slides |
| `test-browser.mjs` | Browser test |

## License

MIT, see `LICENSE`.
