import { chromium } from "playwright";
async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://www.asigurari.ro/rca", { waitUntil: "domcontentloaded" });
  await page.locator("text='Acceptă toate'").first().click({force:true}).catch(()=>{});

  await page.fill("input[name='quote_form[license-plate]']", "B123ABC");
  await page.fill("input[name='quote_form[chassis-number]']", "WBA1234567890ABCD");
  await page.locator("label:has-text('Înmatriculat')").click();
  await page.locator("label:has-text('Nu')").nth(0).click(); // transfer
  await page.selectOption("select[name='quote_form[vehicle-category]']", { label: "Autoturism" });
  await page.evaluate(() => { (document.querySelector("select[name='quote_form[vehicle-category]']") as any).dispatchEvent(new Event("change", { bubbles: true })) });
  await page.selectOption("select[name='quote_form[fuel-type]']", { label: "Benzină" });
  await page.selectOption("select[name='quote_form[vehicle-brand]']", { label: "BMW" });
  await page.evaluate(() => { (document.querySelector("select[name='quote_form[vehicle-brand]']") as any).dispatchEvent(new Event("change", { bubbles: true })) });
  await page.waitForTimeout(1000);
  await page.selectOption("select[name='quote_form[vehicle-model]']", { label: "320D XDRIVE" });
  await page.fill("input[name='quote_form[vehicle-identity-card]']", "A123456");
  await page.selectOption("select[name='quote_form[manufacture-year]']", { label: "2015" });
  await page.fill("input[name='quote_form[maximum-weight]']", "2000");
  await page.fill("input[name='quote_form[engine-capacity]']", "1995");
  await page.fill("input[name='quote_form[engine-power]']", "140");
  await page.fill("input[name='quote_form[seats]']", "5");
  await page.fill("input[name='quote_form[registration-date]']", "15.06.2015");
  await page.fill("input[name='quote_form[mileage]']", "150000");
  
  await page.locator("text=/înainte/i").first().click({force: true});
  await page.waitForTimeout(3000);
  
  const step2 = await page.locator("div.step-2").innerHTML().catch(() => page.content());
  const fs = require('fs');
  fs.writeFileSync('step2.html', step2);
  console.log("Dumped step2.html");
  await browser.close();
}
run().catch(console.error);
