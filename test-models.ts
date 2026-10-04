import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://www.asigurari.ro/rca", { waitUntil: "domcontentloaded" });
  
  // click cookies
  await page.locator("#cookiesReject").click().catch(() => {});
  
  // Select autoturism
  const autoSelect = page.locator("xpath=//label[text()='Tip auto *']/following::select[1]");
  await autoSelect.selectOption({ label: "Autoturism" }, { force: true });
  await page.evaluate(() => {
    const e = document.querySelector("select[name='quote_form[vehicle-category]']");
    if (e) {
      e.dispatchEvent(new Event("change", { bubbles: true }));
      if ((window as any).jQuery) (window as any).jQuery(e).trigger("change");
    }
  });

  // Select BMW
  const marcaSelect = page.locator("xpath=//label[text()='Marca auto *']/following::select[1]");
  await marcaSelect.waitFor({ state: "attached" });
  await marcaSelect.selectOption({ label: "BMW" }, { force: true });
  await page.evaluate(() => {
    const e = document.querySelector("select[name='quote_form[vehicle-brand]']");
    if (e) {
      e.dispatchEvent(new Event("change", { bubbles: true }));
      if ((window as any).jQuery) (window as any).jQuery(e).trigger("change");
    }
  });

  await page.waitForTimeout(2000);
  
  // Dump models
  const models = await page.evaluate(() => {
    const s = document.querySelector("select[name='quote_form[vehicle-model]']");
    if (!s) return null;
    return Array.from(s.querySelectorAll("option")).map(o => o.textContent?.trim());
  });
  
  console.log("MODELS FOR BMW:", models);
  await browser.close();
}
run().catch(console.error);
