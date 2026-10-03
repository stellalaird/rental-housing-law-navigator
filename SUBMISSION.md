# Submission checklist — HackOS

**Deadline: Sunday Oct 4, 2026, 9:00 AM ET (8:00 AM CDT).** Source: `NOTES.md`. The requirements below are **FAQ-bot output, not a primary source** (bot cites "the official FAQ"). If anything looks different on the HackOS Team & Submission page, the page wins. Questions: questions@hack-nation.com.

Legend: **[agent]** = an agent can make it. **[owner]** = only the owner can do it (account, login, photo, clicks).

## Before anything else
- [ ] **[owner]** Sign in to HackOS with the link from noreply@hack-nation.ai (Google, GitHub or password). Entry needs an accepted application; nothing here lets a non-admitted entrant in.
- [ ] **[owner]** Pick **one official challenge** on the Team & Submission page. The latest submission's challenge counts. Do it once tracks are out (11 AM CDT).

## Required items
| # | Item | Spec | Who |
|---|---|---|---|
| 1 | Demo video | MP4 or MOV, ≤60 s, ≤1 GB | **[agent]** records and converts; **[owner]** uploads |
| 2 | Tech video | MP4 or MOV, ≤60 s, ≤1 GB | **[agent]** records and converts; **[owner]** uploads |
| 3 | Team video | MP4 or MOV, ≤60 s, ≤1 GB | **[owner]** (needs their face and voice); upload also **[owner]** |
| 4 | Live demo link | must be live when judges look | **[agent]** builds/serves; **[owner]** runs any tunnel or host account |
| 5 | Public GitHub repo link | private repos do NOT count | **[owner]** creates and pushes (commands below) |
| 6 | Team photo | JPG, PNG or WebP, ≤10 MB | **[owner]** |
| 7 | One challenge picked | see above | **[owner]** |

If a video is rejected, re-export as H.264 MP4.

## Videos (agent-made)
- Demo: `node record-demo.mjs steps.json --out demo.mp4` (drives the app in system Chrome, no screen capture, caps at 60 s).
- Tech: slides in `tech-video/`; same recorder with `tech-video/steps.json`.
- Manual conversion if needed: `ffmpeg -y -i in.webm -t 60 -c:v libx264 -pix_fmt yuv420p -movflags +faststart demo.mp4` (`ffmpeg-static` is a dev dependency; `-t 60` hard-caps length).
- Check length: output must read Duration ≤ 00:01:00.

## Live demo link
Pick one. Details and sources are in `NOTES.md`.
- **Static (safest):** `npm run build:static`, publish `dist/` to GitHub Pages (needs the public repo) or Cloudflare Pages. Answers example prompts from recorded replay only. **[owner]** account needed.
- **Live backend from the owner's laptop:** `npm start`, then `cloudflared tunnel --url http://localhost:3000` (no account per Cloudflare docs; cloudflared is not installed, `brew install cloudflared` is an owner step). Caveats: URL changes every run, dies when the laptop sleeps or cloudflared stops, and Cloudflare's quick tunnels do not support SSE, so the page will use the JSON fallback. Set `TRUST_PROXY=1`. **A public URL exposes the API key's spend**: set a budget cap in the Anthropic console first.
- Avoid Fly (no free tier). Vercel Hobby is non-commercial only.

## Public GitHub repo — owner-only commands (not run by any agent)
1. On github.com: **New repository**, name e.g. `hack-nation-7`, visibility **Public**, **do not** add a README, .gitignore or license (the repo already has them).
2. In a terminal:

```bash
cd ~/local-dev/hack-nation-7
git remote add origin git@github.com:<your-username>/hack-nation-7.git
git push -u origin main
```

(HTTPS instead of SSH: `https://github.com/<your-username>/hack-nation-7.git`.)
3. Open the repo URL in a private/incognito window to confirm it loads without login. That is the link to paste into HackOS.

Before pushing: `.env` is gitignored, but run `git status` and confirm no key or personal data is tracked.

## Final steps on HackOS
1. Upload the three videos and the team photo; paste the live demo link and the GitHub link.
2. **Press the Submit button.** "Save project" alone does NOT submit.
3. Confirm the message reads **"Your project is submitted"** and the button reads **"Project submitted"**.
4. You can edit until the deadline; the latest save before 9:00 AM ET counts.

## After
- Finalists are emailed Oct 7 (FAQ) or Oct 8 (Luma); sources disagree. Virtual pitches are Oct 10, 12:00–1:00 PM ET.
