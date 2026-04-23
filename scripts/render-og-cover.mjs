/**
 * Génère public/og-cover.png (1200×630) à partir du logo officiel.
 * Usage : node scripts/render-og-cover.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "public/og-cover.png");
const logoPath = path.join(root, "public/brand/norixo-logo-mark.png");
const logoB64 = readFileSync(logoPath).toString("base64");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    width: 1200px;
    height: 630px;
    background: linear-gradient(165deg, #020617 0%, #0b1224 45%, #020617 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  .glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 70% 55% at 50% 28%, rgba(99, 102, 241, 0.22), transparent 62%),
                radial-gradient(ellipse 50% 40% at 80% 75%, rgba(6, 182, 212, 0.12), transparent 55%);
    pointer-events: none;
  }
  .mark-wrap {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 28px 64px rgba(59, 130, 246, 0.35))
            drop-shadow(0 0 40px rgba(139, 92, 246, 0.2));
  }
  .mark-wrap img {
    width: 380px;
    height: 380px;
    object-fit: contain;
    display: block;
  }
  .sub {
    position: relative;
    z-index: 1;
    margin-top: 8px;
    text-align: center;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .sub .brand {
    font-size: 20px;
    font-weight: 650;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    background: linear-gradient(90deg, #a5b4fc, #38bdf8, #22d3ee);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .sub .tag {
    margin-top: 12px;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0.06em;
    color: rgba(226, 232, 240, 0.72);
  }
</style>
</head>
<body>
  <div class="glow" aria-hidden="true"></div>
  <div class="mark-wrap">
    <img src="data:image/png;base64,${logoB64}" width="380" height="380" alt="" />
  </div>
  <div class="sub">
    <div class="brand">Norixo Optimizer</div>
    <div class="tag">Listing Conversion Optimizer</div>
  </div>
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.setContent(html, { waitUntil: "load" });
await page.screenshot({ path: outPath, type: "png" });
await browser.close();

console.log("Wrote", outPath);
