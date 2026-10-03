// Headless-Chrome check of the lookup UI against the live server. Needs system Chrome (no browser download).
// Usage: node test-browser.mjs   (starts server.mjs itself on a free-ish port; no LLM call is made)
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = Number(process.env.TEST_PORT || 3917);
const base = `http://localhost:${PORT}`;
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); };

const srv = spawn("node", ["server.mjs"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
for (let i = 0; i < 40; i++) { try { if ((await fetch(`${base}/api/rules`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }

const browser = await chromium.launch({ channel: "chrome", headless: true });
const show = async (page, q, asof) => {
  await page.goto(base);
  await page.fill("#q", q);
  if (asof) await page.fill("#asof", asof);
  await page.click("#f button[type=submit], #f button:not(#lang)");
  await page.waitForFunction(() => !document.querySelector("#resultView").hidden, null, { timeout: 15000 });
};

try {
  // 1. A0016 (San Francisco): both CA state rules superseded, explanation text shown, if_in_force shown wherever the API sends it
  {
    const page = await browser.newPage();
    await show(page, "A0016");
    const api = await (await fetch(`${base}/api/lookup?address=A0016&asof=2026-10-01`)).json();
    for (const id of ["r-0017", "r-0020"]) {
      const row = api.results.find((r) => r.team_rule_id === id);
      const card = page.locator("article.rule.superseded", { hasText: row?.rule?.title?.slice(0, 40) || id });
      const n = await card.count();
      const text = n ? await card.first().textContent() : "";
      check(`A0016 ${id}: rendered as superseded with explanation`, row?.result === "superseded" && n >= 1 && text.includes("Replaced here by"), `(api=${row?.result}, cards=${n})`);
    }
    // if_in_force rides on not_yet_effective/pending rows: the rule's own card must say what it becomes once in force.
    await show(page, "A0002", "2026-10-01");
    const api2 = await (await fetch(`${base}/api/lookup?address=A0002&asof=2026-10-01`)).json();
    const gated = api2.results.filter((r) => r.if_in_force);
    let missing = 0;
    for (const g of gated) {
      const card = page.locator("article.rule", { hasText: g.rule?.title?.slice(0, 40) || g.team_rule_id }).first();
      if (!(await card.textContent()).includes(g.if_in_force.explanation.slice(-40))) missing++;
    }
    check("if_in_force shown on the rule's own card", gated.length > 0 && missing === 0, `(api rows with if_in_force=${gated.length}, not shown=${missing})`);
    await page.close();
  }
  // 2. an address outside the data lands on #empty
  {
    const page = await browser.newPage();
    await show(page, "1 Nowhere Road, Atlantis");
    const vis = await page.locator("#empty").isVisible();
    const txt = (await page.locator("#empty").textContent()).trim();
    check("unknown address -> #empty shown", vis && txt.length > 0, `("${txt.slice(0, 60)}")`);
    await page.close();
  }
} finally {
  await browser.close();
  srv.kill();
}
process.exit(results.every(Boolean) ? 0 : 1);
