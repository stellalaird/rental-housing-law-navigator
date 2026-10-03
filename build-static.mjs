// Writes dist/ for a static host (Pages): public/ as-is (index.html, replay.json, assets). No backend; the page serves recorded replies.
import { rmSync, cpSync, existsSync } from "node:fs";
if (!existsSync("public/replay.json")) { console.error("public/replay.json missing: run `npm run record-replay` first"); process.exit(1); }
rmSync("dist", { recursive: true, force: true });
cpSync("public", "dist", { recursive: true });
console.log("wrote dist/");
