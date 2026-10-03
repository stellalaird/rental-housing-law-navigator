# DEPLOY: running the demo server on a plain Node host

Nothing here deploys anything or needs an account. This is what a host must provide. Checked 2026-10-03 on a scratch copy of the files below, with `claude` off `PATH`, no `.env`, and an unwritable audit log.

## Runtime

- **Node 22** (developed and checked on 22.14; `npm start` uses the `--env-file-if-exists` flag, which older Node releases lack, so do not go below 22 without testing).
- `npm install` (or `npm ci`) for `express` and `@anthropic-ai/sdk`. The SDK is imported at startup but never called by the lookup routes, so no API key is needed.
- **No `claude` CLI, no `.env`, no API key, no outbound network.** `/api/lookup`, `/api/rules` and `/api/lookups` read local JSON only and never call a model. Verified: starts with `claude` not found, answers lookups, serves the page.
- The model is used only offline (`ingest-doc.mjs`, `build-lookups.mjs`, `translate-es.mjs`, `add-city.mjs`, all `claude -p`). None of those run on the host.

## Start

```bash
npm start            # = node --env-file-if-exists=.env server.mjs
PORT=8080 npm start  # port comes from the PORT env var, default 3000
```

Start it **from the repo root**: the page is served from `./public` relative to the working directory. Reads `rules.json` and `lookups.json` only at startup, so restart after replacing either.

## Files that must ship

| Path | Why |
|---|---|
| `server.mjs`, `audit.mjs`, `config.mjs`, `changelog.mjs`, `jurisdictions.mjs`, `lib/` | the server and what it imports |
| `package.json`, `package-lock.json` | `npm install` |
| `rules.json`, `lookups.json`, `jurisdictions.json` | the data every lookup reads |
| `public/` | the page, `es.json` (Spanish), `fixtures/` (fallback data) |
| `changes.json` | not read by the server; ship it only if the host should serve or show the change-tracking output |
| **`data/starter/participant-final-no-hour16 3/data/sample_addresses.csv`** | **read by `lib/navigator.mjs` on the first lookup** (see below) |

**The address CSV is a hard dependency, and it sits under the folder that is otherwise excluded.** Without it the server starts and the page loads, but `/api/lookup`, `/api/rules` and `/api/lookups` return HTTP 503 `{"error":"address data not installed"}` (stderr: `address data missing: <path> (set ADDRESSES_CSV)`). Either ship that single file at that exact path, or set **`ADDRESSES_CSV=/path/to/sample_addresses.csv`**, which overrides the default (added in `e1463b2`; the 503 behaviour is p-a-2's, read from the code, not re-run here). It is the organisers' data: whether it may be redistributed is the owner's open question, so do not put it on a public host until that is answered.

## Excluded

- `data/starter/` apart from the one CSV above (organiser corpus and key; gitignored).
- `audit.jsonl` (local log, gitignored), `cache/`, `dist/`, `out/`, `challenges/`, `node_modules/` (reinstall on the host), `.env`.
- Dev and recording tooling: `record-demo.mjs`, `test-browser.mjs`, `selfcheck.mjs`, `tech-video/`, `demo-steps*.json`, `drive-watch.mjs`, `fetch-links.mjs`.

## Audit log on a read-only filesystem

Each lookup appends one line to `audit.jsonl` next to `audit.mjs`; set `AUDIT_LOG=/path/to/audit.jsonl` to move it (for example to a mounted volume or `/tmp`). **A failed write does not fail the request**: `audit()` catches it and prints `audit write failed: <error>` to stderr. Verified with an unwritable path: lookup still returned 200 and the error appeared once in the log. On a read-only host, the audit trail is simply not kept unless `AUDIT_LOG` points somewhere writable.

Harmless noise: outside a git checkout, `git rev-parse` prints `fatal: not a git repository` once on stderr (the audit record's `commit` is then `null`).

## Not covered here

Choice of host, TLS, a domain, and rate limiting beyond what the legacy `/api/chat` guard does (the lookup routes have none). `TRUST_PROXY=1` matters only for that legacy route.
