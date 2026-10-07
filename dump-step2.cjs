const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.asigurari.ro/rca/');
  
  // click "Porneste" if cookie is there
  const cookieBanner = page.locator('#cookiesAccept');
  if (await cookieBanner.isVisible()) await cookieBanner.click();

  // fill generic row 1 data to advance to step 2
  // We need valid data. 
  // Let's just grab the HTML of the first page to see if Owner is there.
  const html = await page.content();
  fs.writeFileSync('step1.html', html);
  console.log('Saved step1.html');

  // Let's check what fields are available without filling anything
  const labels = await page.locator('label').allTextContents();
  console.log('Labels on first load:', labels.map(l => l.trim()).filter(Boolean));

  await browser.close();
}
main();
