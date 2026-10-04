import { chromium } from "playwright";
async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://www.asigurari.ro/rca", { waitUntil: "domcontentloaded" });
  await page.locator("text='Acceptă toate'").first().click({force:true}).catch(()=>{});
  // fill step 1 enough to go to step 2? No, I can't easily go to step 2 without filling all required fields.
  // Actually, I can just use runScenario and log the DOM of step 2 before it clicks inainte!
}
