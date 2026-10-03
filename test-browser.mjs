// Headless-Chrome check of the three client paths. Needs system Chrome (no browser download).
// Usage: BACKEND=cli node server.mjs on PORT, then `node test-browser.mjs [livePort]`. Uses public/replay.json.
import http from "node:http";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const live = `http://localhost:${process.argv[2] || 3000}`;
const replayData = JSON.parse(readFileSync("public/replay.json", "utf8"));
const html = readFileSync("public/index.html");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); };

// Static host: serves only index.html and replay.json, no /api at all (404), like GitHub/Cloudflare Pages.
const staticSrv = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") return res.writeHead(200, { "Content-Type": "text/html" }).end(html);
  if (req.url === "/replay.json") return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(replayData));
  res.writeHead(404).end("not found");
});
await new Promise((r) => staticSrv.listen(0, r));
const staticUrl = `http://localhost:${staticSrv.address().port}`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const waitReply = (page) => page.waitForFunction(() => document.querySelector("#out").textContent.length > 0, null, { timeout: 90000 });

try {
  // 1. live streaming: example button sends, reply arrives, no fallback/recorded label; text arrives in >1 update
  {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.__updates = 0;
      window.__lens = new Set();
      new MutationObserver(() => { window.__updates++; const o = document.querySelector("#out"); if (o) window.__lens.add(o.textContent.length); }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    await page.goto(live);
    await page.waitForSelector("#examples button");
    const label = await page.locator("#examples button").first().textContent();
    await page.locator("#examples button").first().click();
    await waitReply(page);
    // wait until the stream settles (length unchanged for 2s), recording distinct lengths seen = proof of incremental streaming
    const seen = new Set(); let last = -1, stable = 0;
    while (stable < 4) {
      const n = (await page.locator("#out").textContent()).length; seen.add(n);
      stable = n === last ? stable + 1 : 0; last = n; await page.waitForTimeout(500);
    }
    const st = await page.locator("#note").textContent();
    const text = await page.locator("#out").textContent();
    const pageLens = await page.evaluate(() => [...window.__lens].filter((n) => n > 0).length); // distinct non-empty lengths observed in-page = incremental rendering
    seen.clear(); for (let i = 0; i < pageLens; i++) seen.add(i);
    check("live: example button -> reply, streamed incrementally", text.length > 20 && seen.size > 1 && !/recorded/i.test(st) && !/Streaming unavailable/.test(st), `(${label} -> ${text.length} chars, ${seen.size} distinct lengths, status="${st}")`);
    await page.close();
  }
  // 2. fallback: SSE route fails (as behind a tunnel that breaks SSE); ?stream=0 must still answer
  {
    const page = await browser.newPage();
    await page.route(/\/api\/chat$/, (route) => route.abort());
    await page.goto(live);
    await page.fill("#q", "Reply with exactly: pong");
    await page.click("#go");
    await waitReply(page);
    await page.waitForFunction(() => /non-streamed/.test(document.querySelector("#note").textContent), null, { timeout: 10000 }).catch(() => {});
    const st = await page.locator("#note").textContent();
    const text = await page.locator("#out").textContent();
    check("fallback: stream blocked -> JSON reply", /pong/i.test(text) && /non-streamed/.test(st), `(out="${text.slice(0, 40)}", status="${st}")`);
    await page.close();
  }
  // 2b. 429 (rate limit / busy): friendly message, no fallthrough to JSON or replay
  {
    const page = await browser.newPage();
    let calls = 0;
    await page.route(/\/api\/chat/, (route) => { calls++; route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }) }); });
    await page.goto(live);
    await page.fill("#q", "hello");
    await page.click("#go");
    await page.waitForFunction(() => /too many requests/i.test(document.querySelector("#note").textContent), null, { timeout: 10000 }).catch(() => {});
    const st = await page.locator("#note").textContent();
    const text = await page.locator("#out").textContent();
    check("429: friendly message, no fallback", /Too many requests/.test(st) && text === "" && calls === 1, `(note="${st}", calls=${calls})`);
    await page.close();
  }
  // 3. replay: no backend (static host); example click shows recorded text, labelled
  {
    const page = await browser.newPage();
    await page.goto(staticUrl);
    await page.waitForSelector("#examples button");
    const first = replayData.items[0];
    await page.locator("#examples button").first().click();
    await waitReply(page);
    const st = await page.locator("#note").textContent();
    const text = await page.locator("#out").textContent();
    check("replay: static host -> recorded response, labelled", text === first.text && /Recorded response/.test(st), `(status="${st}")`);
    // unrecorded prompt: honest message, not a fake answer
    await page.fill("#q", "something never recorded");
    await page.click("#go");
    await page.waitForFunction(() => /no recorded response/i.test(document.querySelector("#out").textContent), null, { timeout: 15000 });
    check("replay: unrecorded prompt -> honest message", true);
    await page.close();
  }
} finally {
  await browser.close();
  staticSrv.close();
}
process.exit(results.every(Boolean) ? 0 : 1);
