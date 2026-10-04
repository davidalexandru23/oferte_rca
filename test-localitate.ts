import { chromium } from "playwright";
async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://www.asigurari.ro/rca", { waitUntil: "domcontentloaded" });
  await page.locator("text='Acceptă toate'").first().click({force:true}).catch(()=>{});
  // We can't just skip to step 2 easily, we need to fill step 1!
}
