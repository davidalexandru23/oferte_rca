import { chromium } from "playwright";
import { rcaSelectors } from "./selectors.js";
export async function getStep2Html() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "ro-RO",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
  });
  const page = await context.newPage();
  await page.goto("https://www.asigurari.ro/rca/");
  await page.waitForTimeout(2000);
  
  // click cookie
  const cookie = page.locator("#cookiesAccept");
  if (await cookie.isVisible()) await cookie.click();

  // Try to reach step 2. Actually, the form is all on one page or multi-step?
  // Let's just return whatever is in the DOM
  const html = await page.content();
  await browser.close();
  return html;
}
