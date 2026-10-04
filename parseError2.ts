import { chromium } from "playwright";
import path from "path";
async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file://" + path.resolve("data/test-row-2/last-page.html"));
  const errors = await page.locator(".has-error").allInnerTexts();
  console.log("ERRORS test-row-2:", errors);
  await browser.close();
}
run().catch(console.error);
