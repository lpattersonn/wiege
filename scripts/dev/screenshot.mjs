// Visual QA helper: capture a page at a given viewport using the locally
// installed Google Chrome (Playwright's bundled Chromium isn't installed).
//
//   node scripts/dev/screenshot.mjs <url|file> <out.png> [width=1440] [height=900]
//        [--full] [--dark] [--motion] [--cookie=name=value]
//
// Examples:
//   node scripts/dev/screenshot.mjs http://localhost:3000 /tmp/home.png 390 844 --full
//   node scripts/dev/screenshot.mjs ./mock/index.html /tmp/mock.png 1440 900 --full --dark
//   node scripts/dev/screenshot.mjs http://localhost:3000/today /tmp/today.png 390 844 --cookie=wiege_session=abc
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--") && !a.includes("=")));
const cookieArg = args.find((a) => a.startsWith("--cookie="))?.slice("--cookie=".length);
const [target, out, width = "1440", height = "900"] = args.filter((a) => !a.startsWith("--"));

if (!target || !out) {
  console.error("usage: screenshot.mjs <url|file> <out.png> [width] [height] [--full] [--dark]");
  process.exit(1);
}

const url = /^https?:\/\//.test(target) ? target : pathToFileURL(path.resolve(target)).href;
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: Number(width), height: Number(height) },
    deviceScaleFactor: 1,
    colorScheme: flags.has("--dark") ? "dark" : "light",
    reducedMotion: flags.has("--motion") ? "no-preference" : "reduce",
  });
  if (cookieArg && /^https?:\/\//.test(url)) {
    const eq = cookieArg.indexOf("=");
    await page.context().addCookies([
      { name: cookieArg.slice(0, eq), value: cookieArg.slice(eq + 1), url: new URL(url).origin },
    ]);
  }
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: out, fullPage: flags.has("--full") });
  console.log(`saved ${out}`);
} finally {
  await browser.close();
}
