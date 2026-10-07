const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.asigurari.ro/rca/', { waitUntil: 'networkidle' });
  
  const cookieBanner = page.locator('#cookiesAccept');
  if (await cookieBanner.isVisible()) await cookieBanner.click();

  await page.waitForTimeout(3000);

  const labels = await page.locator('label').allTextContents();
  console.log('Labels on first load:', labels.map(l => l.trim().replace(/\s+/g, ' ')).filter(Boolean));

  // Find all inputs and their names/ids
  const inputs = await page.$$eval('input, select', els => els.map(el => ({ tag: el.tagName, name: el.name, id: el.id, placeholder: el.getAttribute('placeholder'), class: el.className })));
  console.log('Inputs:', inputs);

  await browser.close();
}
main();
