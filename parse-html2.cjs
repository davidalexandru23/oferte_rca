const { chromium } = require('playwright');
const fs = require('fs');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://www.asigurari.ro/rca/");
  await page.waitForTimeout(3000);
  const html = await page.content();
  fs.writeFileSync('rca-page.html', html);
  console.log('Saved to rca-page.html');
  await browser.close();
}
run();
