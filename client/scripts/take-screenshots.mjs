/**
 * Capture README screenshots from Storybook stories using Playwright.
 *
 * Usage: Start Storybook first (`pnpm storybook`), then run:
 *   pnpm exec node scripts/take-screenshots.mjs
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.resolve(__dirname, "../../docs/screenshots");
const STORYBOOK_URL = "http://localhost:6006";

const SCREENSHOTS = [
  {
    name: "hero-terminal",
    story: "showcase--terminal-with-claude",
    fullPage: true,
  },
  {
    name: "hero-sessions",
    story: "showcase--multi-session",
    fullPage: true,
  },
  {
    name: "quick-keys",
    story: "showcase--terminal-with-claude",
    selector: "#storybook-root > div > div:last-child",
  },
];

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });

  for (const shot of SCREENSHOTS) {
    const page = await context.newPage();
    const url = `${STORYBOOK_URL}/iframe.html?id=${shot.story}&viewMode=story`;
    console.log(`Capturing ${shot.name}...`);

    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const outPath = path.join(SCREENSHOTS_DIR, `${shot.name}.png`);

    if (shot.selector) {
      const el = await page.$(shot.selector);
      if (el) {
        await el.screenshot({ path: outPath });
      } else {
        console.warn(`  Selector "${shot.selector}" not found, taking full page`);
        await page.screenshot({ path: outPath, fullPage: true });
      }
    } else {
      await page.screenshot({ path: outPath, fullPage: shot.fullPage });
    }

    console.log(`  -> ${outPath}`);
    await page.close();
  }

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);
