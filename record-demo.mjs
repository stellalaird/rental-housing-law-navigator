#!/usr/bin/env node
// Paced demo recorder: drives a page with human-speed steps, records the browser
// context (no screen capture, no TCC), trims load dead time, writes H.264 MP4 <= 60 s.
// Usage: node record-demo.mjs steps.json [--out demo.mp4] [--max 60] [--size 1280x720] [--keep-webm]
// steps.json: {"steps":[ {"goto":"http://localhost:3000"}, {"type":{"selector":"#q","text":"hi","delay":70}},
//   {"click":"#go"}, {"waitFor":{"selector":"#out","text":"done","timeout":90000}}, {"pause":2000}, {"press":"ArrowRight"} ]}
//   type takes "clear":true to replace existing text; fill {selector,value} sets a field at once (use for <input type=date>).
//   goto URLs may contain {BASE}: --base URL or env DEMO_BASE, default http://localhost:3000. Frames show page content only (no address bar).
//   goto: a path without a scheme resolves relative to steps.json and opens as file://. press: a Playwright key name.
// Optional narration: any step may carry "narrate":"text". Rendered with macOS `say`, started at that step's
//   timestamp, muxed as AAC. Narrations that overlap or run past the cap trigger a warning.
// Needs devDependencies: playwright, ffmpeg-static. Uses system Chrome (channel "chrome"); no browser download.
import { readFileSync, mkdirSync, rmSync, existsSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const stepsFile = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!stepsFile) { console.error("usage: node record-demo.mjs steps.json [--out demo.mp4] [--max 60] [--size 1280x720] [--keep-webm]"); process.exit(2); }
const out = resolve(flag("--out", "demo.mp4"));
const maxSec = Number(flag("--max", 60));
const [W, H] = flag("--size", "1280x720").split("x").map(Number);
const channel = flag("--channel", "chrome");
const BASE = (flag("--base", process.env.DEMO_BASE || "http://localhost:3000")).replace(/\/$/, ""); // replaces {BASE} in goto URLs

let chromium, ffmpegPath;
try { ({ chromium } = await import("playwright")); } catch { console.error("missing devDependency: playwright (npm i -D playwright)"); process.exit(2); }
try { ffmpegPath = (await import("ffmpeg-static")).default; } catch { console.error("missing devDependency: ffmpeg-static (npm i -D ffmpeg-static)"); process.exit(2); }

const { steps } = JSON.parse(readFileSync(stepsFile, "utf8"));
const dir = join(tmpdir(), `record-demo-${process.pid}`);
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });

// Fake cursor: headless recordings show no pointer, so clicks look like magic without one.
const cursorInit = () => {
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;z-index:2147483647;width:18px;height:18px;border-radius:50%;background:rgba(255,80,80,.75);border:2px solid #fff;pointer-events:none;left:-40px;top:-40px;transition:left .35s,top .35s;box-shadow:0 0 6px rgba(0,0,0,.4)";
  const add = () => document.documentElement.appendChild(d);
  document.readyState === "loading" ? addEventListener("DOMContentLoaded", add) : add();
  addEventListener("mousemove", (e) => { d.style.left = e.clientX - 9 + "px"; d.style.top = e.clientY - 9 + "px"; }, true);
};

const browser = await chromium.launch({ channel });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir, size: { width: W, height: H } } });
await ctx.addInitScript(cursorInit);
const t0 = Date.now(); // video clock starts with the page
const page = await ctx.newPage();
const videoPath = page.video();

let tReady = null;         // ms into the video when the first goto finished: everything before is dead load time
const sleep = (ms) => page.waitForTimeout(ms);
const rnd = (n) => n * (0.7 + Math.random() * 0.6);
async function moveTo(sel) {
  const box = await page.locator(sel).first().boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await sleep(350);
}

let webm, endMs;
const narr = []; // {text, atMs}
try {
  for (const [i, s] of steps.entries()) {
    const k = Object.keys(s).find((x) => x !== "narrate"), v = s[k];
    console.error(`step ${i + 1}/${steps.length}: ${k}`);
    if (s.narrate) narr.push({ text: s.narrate, atMs: Date.now() - t0 });
    if (k === "goto") { const u = v.replaceAll("{BASE}", BASE); await page.goto(/^[a-z]+:/i.test(u) ? u : pathToFileURL(resolve(dirname(stepsFile), u)).href, { waitUntil: "load" }); tReady ??= Date.now() - t0; }
    else if (k === "type") {
      await moveTo(v.selector); await page.locator(v.selector).first().click();
      if (v.clear) await page.keyboard.press("Meta+a"); // replace existing text instead of appending
      for (const ch of v.text) await page.keyboard.type(ch, { delay: 0 }), await sleep(rnd(v.delay ?? 70));
    }
    else if (k === "fill") { await moveTo(v.selector); await page.locator(v.selector).first().fill(v.value); } // for date inputs, value YYYY-MM-DD
    else if (k === "click") { await moveTo(v); await page.locator(v).first().click(); }
    else if (k === "waitFor") {
      const to = v.timeout ?? 60000;
      if (v.selector && v.text) await page.waitForFunction(([s, t]) => document.querySelector(s)?.textContent.includes(t), [v.selector, v.text], { timeout: to });
      else if (v.selector) await page.waitForSelector(v.selector, { timeout: to });
      else if (v.text) await page.getByText(v.text).first().waitFor({ timeout: to });
    }
    else if (k === "scroll") { // {"scroll":"visible text"}: smooth-scroll the first element containing that text to the top of the page
      await page.evaluate((t) => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.textContent.includes(t)) { n.parentElement.scrollIntoView({ behavior: "smooth", block: "start" }); return; } throw new Error("scroll target not found: " + t); }, v);
      await sleep(900);
    }
    else if (k === "press") await page.keyboard.press(v);
    else if (k === "pause") await sleep(v);
    else throw new Error(`unknown step "${k}"`);
  }
} finally {
  endMs = Date.now() - t0;
  await ctx.close();                       // finalizes the webm
  webm = await videoPath.path();
  await browser.close();
}

const start = Math.max(0, (tReady ?? 0) / 1000 - 0.3);             // keep 0.3 s before the page is up
const avail = endMs / 1000 - start;
const dur = Math.min(maxSec, avail);
if (avail > maxSec) console.error(`warning: ${avail.toFixed(1)} s of footage after trim; truncated to ${maxSec} s. Shorten waits or pause steps.`);
const durOf = (f) => { const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(spawnSync(ffmpegPath, ["-i", f], { encoding: "utf8" }).stderr); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0; };
const aud = [];
let prevEnd = 0;
for (const [i, n] of narr.entries()) {
  const f = join(dir, `n${i}.aiff`);
  const sr = spawnSync("say", ["-o", f, n.text], { stdio: "inherit" });
  if (sr.status !== 0) { console.error("macOS `say` failed (narration needs macOS)"); process.exit(1); }
  const at = Math.max(0, n.atMs / 1000 - start), len = durOf(f);
  if (at < prevEnd) console.error(`warning: narration ${i + 1} starts at ${at.toFixed(1)} s while narration ${i} runs until ${prevEnd.toFixed(1)} s; they overlap`);
  if (at + len > dur) console.error(`warning: narration ${i + 1} ends at ${(at + len).toFixed(1)} s, past the ${dur.toFixed(1)} s video; cut off. Shorten text or add pauses.`);
  prevEnd = Math.max(prevEnd, at + len);
  aud.push({ f, ms: Math.round(at * 1000) });
}
const args = ["-y", "-loglevel", "error", "-ss", start.toFixed(2), "-i", webm];
for (const a of aud) args.push("-i", a.f);
if (aud.length) {
  const fc = aud.map((a, i) => `[${i + 1}:a]adelay=${a.ms}|${a.ms}[a${i}]`).join(";") + ";" + aud.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${aud.length}:normalize=0:duration=longest[aout]`;
  args.push("-filter_complex", fc, "-map", "0:v", "-map", "[aout]", "-c:a", "aac", "-b:a", "128k", "-ar", "44100");
}
args.push("-t", dur.toFixed(2), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out);
const r = spawnSync(ffmpegPath, args, { stdio: "inherit" });
if (r.status !== 0) { console.error("ffmpeg failed"); process.exit(1); }
if (argv.includes("--keep-webm")) renameSync(webm, out.replace(/\.mp4$/, "") + ".webm"); else rmSync(dir, { recursive: true, force: true });
console.log(`${out}  trimmed ${start.toFixed(1)} s dead time, length ${dur.toFixed(1)} s (cap ${maxSec} s)`);
