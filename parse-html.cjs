const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://www.asigurari.ro/rca/");
  await page.waitForTimeout(3000);
  const labels = await page.$$eval('label', els => els.map(e => e.innerText.trim()));
  console.log('LABELS:', labels.filter(Boolean));
  const inputs = await page.$$eval('input, select', els => els.map(e => e.name || e.id || e.placeholder).filter(Boolean));
  console.log('INPUTS:', inputs);
  await browser.close();
}
run();
