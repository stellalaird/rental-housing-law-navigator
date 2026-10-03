// Records the example prompts through the REAL backend into public/replay.json (the static/offline build serves these).
// Usage: start the server (npm start or BACKEND=cli npm start), then `node record-replay.mjs [baseUrl]`.
import { writeFileSync } from "node:fs";
import config from "./config.mjs";

const base = process.argv[2] || "http://localhost:3000";
const items = [];
for (const prompt of config.examples) {
  const r = await fetch(`${base}/api/chat?stream=0`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
  });
  const j = await r.json();
  if (!r.ok || j.error || !j.text) { console.error(`FAILED "${prompt}": ${j.error ?? r.status}`); process.exit(1); }
  items.push({ prompt, text: j.text });
  console.log(`recorded: ${prompt} (${j.text.length} chars)`);
}
const { title, tagline, examples } = config;
writeFileSync("public/replay.json", JSON.stringify({ recordedAt: new Date().toISOString(), title, tagline, examples, items }, null, 2));
console.log(`wrote public/replay.json (${items.length} items)`);
