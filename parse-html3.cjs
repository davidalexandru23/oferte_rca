const { chromium } = require('playwright');
const fs = require('fs');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "ro-RO",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
  });
  const page = await context.newPage();
  await page.goto("https://www.asigurari.ro/rca/");
  await page.waitForTimeout(3000);
  const html = await page.content();
  fs.writeFileSync('rca-page.html', html);
  console.log('Saved to rca-page.html, size:', html.length);
  await browser.close();
}
run();
