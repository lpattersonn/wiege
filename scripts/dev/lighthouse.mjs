// Lighthouse gate: audits pages with both the mobile and desktop presets and
// prints every category score. Run it against a production build
// (`npm run build && npm start`), never `next dev`.
//
//   node scripts/dev/lighthouse.mjs [--base=http://localhost:3000] [--cookie=wiege_session=...]
//        [--out=./.lighthouse] [--strict] [--only=mobile|desktop] /path1 /path2 ...
//
// --strict exits non-zero when any category on any page scores below 100.
// Failing audits are listed under each page so they can be fixed directly.
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import * as chromeLauncher from "chrome-launcher";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const CHROME_PATH =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const base = opt("base", "http://localhost:3000").replace(/\/$/, "");
const cookie = opt("cookie", "");
const outDir = opt("out", "./.lighthouse");
const only = opt("only", "");
const strict = args.includes("--strict");
const paths = args.filter((a) => !a.startsWith("--"));
if (paths.length === 0) paths.push("/");

const presets = [
  { name: "mobile", config: undefined },
  { name: "desktop", config: desktopConfig },
].filter((p) => !only || p.name === only);

await mkdir(outDir, { recursive: true });
const chrome = await chromeLauncher.launch({
  chromePath: CHROME_PATH,
  chromeFlags: ["--headless=new", "--no-first-run", "--disable-extensions"],
});

let failed = false;
try {
  for (const p of paths) {
    for (const preset of presets) {
      const url = base + p;
      const result = await lighthouse(
        url,
        {
          port: chrome.port,
          output: "json",
          logLevel: "error",
          onlyCategories: CATEGORIES,
          extraHeaders: cookie ? { Cookie: cookie } : undefined,
        },
        preset.config,
      );
      const lhr = result.lhr;
      const scores = CATEGORIES.map((c) => Math.round((lhr.categories[c]?.score ?? 0) * 100));
      const ok = scores.every((s) => s === 100);
      if (!ok) failed = true;
      console.log(
        `${ok ? "PASS" : "FAIL"}  ${preset.name.padEnd(7)} ${p.padEnd(28)} ` +
          CATEGORIES.map((c, i) => `${c}=${scores[i]}`).join("  "),
      );
      if (!ok) {
        for (const c of CATEGORIES) {
          for (const ref of lhr.categories[c]?.auditRefs ?? []) {
            const audit = lhr.audits[ref.id];
            if (ref.weight > 0 && audit && audit.score !== null && audit.score < 1) {
              const value = audit.displayValue ? ` (${audit.displayValue})` : "";
              console.log(`        - [${c}] ${audit.id}: ${audit.title}${value}`);
            }
          }
        }
      }
      const file = path.join(outDir, `${preset.name}${p === "/" ? "-home" : p.replaceAll("/", "-")}.json`);
      await writeFile(file, result.report);
    }
  }
} finally {
  await chrome.kill();
}

if (strict && failed) process.exit(1);
