import fs from "node:fs/promises";
import path from "node:path";
import { type Browser, type Page } from "playwright";
import { type ScenarioResult, type ScenarioRow, type JobProgress } from "../types.js";

export async function runOnesteScenario(browser: Browser, row: ScenarioRow, jobDir: string, updateProgress?: (status: Partial<JobProgress>) => void): Promise<ScenarioResult> {
  await fs.mkdir(jobDir, { recursive: true });
  const context = await browser.newContext({
    locale: "ro-RO",
    timezoneId: "Europe/Bucharest",
    viewport: { width: 1365, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    updateProgress?.({ status: 'running', message: 'Se încarcă asigurari-oneste.ro...' });
    await page.goto("https://asigurari-oneste.ro/cumpara/rca", { waitUntil: "domcontentloaded", timeout: 45000 });
    
    // Accept cookies
    await page.click('button:has-text("Am înțeles")').catch(() => {});
    await page.click('button:has-text("Acceptă toate cookies")').catch(() => {});
    
    // Step 1: VIN
    updateProgress?.({ status: 'running', message: 'Pasul 1: Se caută mașina în AIDA (VIN)...' });
    const safeVin = row.vin ? row.vin.replace(/O/g, '0') : '';
    await page.fill('input[placeholder="Introdu seria de șasiu"]', safeVin);
    await page.keyboard.press('Enter');
    
    // Wait for AIDA to process
    await page.waitForTimeout(6000);
    
    // Step 2: Detalii Vehicul
    updateProgress?.({ status: 'running', message: 'Pasul 2: Se completează restul detaliilor vehiculului...' });
    await page.locator('text="Stare legală"').locator('~ div').click({ timeout: 2000 }).catch(()=>{});
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    
    await page.fill('input[placeholder*="Poziția A din talon"]', row.nr_inmatriculare, { timeout: 2000 }).catch(()=>{});
    
    // Subcategoria
    await page.locator('text="Subcategoria"').locator('~ div').click({ timeout: 2000 }).catch(()=>{});
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await page.fill('input[placeholder*="ex. 84000"]', "80000", { timeout: 2000 }).catch(()=>{});
    await page.fill('input[placeholder*="Poziția X/Y din talon"]', row.serie_civ, { timeout: 2000 }).catch(()=>{});

    await page.locator('button:has-text("Continuare") >> visible=true').first().click();
    await page.waitForTimeout(4000);
    
    // Step 3: Detalii Proprietar
    updateProgress?.({ status: 'running', message: 'Pasul 3: Se completează datele proprietarului...' });
    await page.fill('input[placeholder="ex. Marius Dan"]', row.prenume, { timeout: 2000 }).catch(()=>{});
    await page.fill('input[placeholder="ex. Popescu"]', row.nume, { timeout: 2000 }).catch(()=>{});
    await page.fill('input[placeholder="ex. 19910118205301"]', row.cnp, { timeout: 2000 }).catch(()=>{});
    await page.fill('input[placeholder="ex. XD"]', row.serie_ci, { timeout: 2000 }).catch(()=>{});
    await page.fill('input[placeholder="ex. 8872943"]', row.numar_ci, { timeout: 2000 }).catch(()=>{});
    await page.fill('input[placeholder="ex. popescu@exemplu.com"]', row.email, { timeout: 2000 }).catch(()=>{});
    await page.fill('input[placeholder="ex. 0712345678"]', row.telefon, { timeout: 2000 }).catch(()=>{});

    // Judet
    await page.locator('text="Judet"').locator('~ div').click({ timeout: 2000 }).catch(()=>{});
    await page.waitForTimeout(500);
    if (row.judet) {
      let judetToType = row.judet;
      // Handle Bucuresti specific case where they put sector in judet
      if (row.judet.toLowerCase() === 'bucuresti' || row.judet.toLowerCase() === 'bucurești') {
         if (row.localitate && row.localitate.toLowerCase().includes('sector')) {
            judetToType = `Bucuresti - ${row.localitate}`;
         } else {
            judetToType = 'Bucuresti';
         }
      }
      await page.keyboard.type(judetToType, { delay: 50 });
      await page.waitForTimeout(1000);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    }

    // Oras
    await page.locator('text="Oras"').locator('~ div').click({ timeout: 2000 }).catch(()=>{});
    await page.waitForTimeout(500);
    if(row.localitate) {
      await page.keyboard.type(row.localitate, { delay: 50 });
      await page.waitForTimeout(1000);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    }

    await page.fill('input[placeholder="ex. Str. Principală"]', row.adresa, { timeout: 2000 }).catch(()=>{});
    await page.fill('input[placeholder="ex. nr. 1, bl. A, sc. 2, etc."]', "1", { timeout: 2000 }).catch(()=>{});
    await page.fill('input[placeholder="ex. 407270"]', row.cod_postal, { timeout: 2000 }).catch(()=>{});

    // Click the visible "Continuare" button
    await page.locator('button:has-text("Continuare") >> visible=true').click({ timeout: 5000 });
    await page.waitForTimeout(5000);
    
    // Step 4: Detalii conducatori
    updateProgress?.({ status: 'running', message: 'Pasul 4: Se preiau datele conducătorului auto...' });
    const anPermis = row.data_permis || '2010';
    await page.getByLabel('Data dobândirii permisului *').click().catch(()=>{});
    await page.waitForTimeout(500);
    await page.keyboard.type(`01 Ianuarie ${anPermis}`, { delay: 50 });
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    
    await page.locator('button:has-text("Continuare") >> visible=true').click({ timeout: 5000 }).catch(()=>{});
    
    // Step 5: Offers / Calculate
    updateProgress?.({ status: 'running', message: 'Pasul 5: Se obțin ofertele RCA...' });
    
    // Fill Date of Start
    await page.getByLabel('Data de începere a poliței').click({ timeout: 2000 }).catch(()=>{});
    await page.waitForTimeout(500);
    // Use tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const months = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
    const dateStr = `${tomorrow.getDate()} ${months[tomorrow.getMonth()]} ${tomorrow.getFullYear()}`;
    await page.keyboard.type(dateStr, { delay: 30 });
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    
    // Duration
    await page.getByLabel('Durata poliței').click({ timeout: 2000 }).catch(()=>{});
    await page.waitForTimeout(500);
    await page.getByRole('option', { name: '12 luni' }).click({ timeout: 2000 }).catch(async ()=>{
      await page.keyboard.type('12', { delay: 50 });
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    });
    
    // Usage type
    await page.getByLabel('Utilizarea vehiculului').click({ timeout: 2000 }).catch(()=>{});
    await page.waitForTimeout(500);
    await page.getByRole('option').first().click({ timeout: 2000 }).catch(async ()=>{
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    });
    
    // Checkboxes - accept and perjury
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check({ force: true }).catch(()=>{});
    }
    
    await page.locator('button:has-text("Către oferte")').click({ timeout: 5000 }).catch(()=>{});
    
    updateProgress?.({ status: 'running', message: 'Se așteaptă ofertele...' });
    await page.waitForTimeout(20000); // wait for calculation
    
    // Save final state
    await page.screenshot({ path: path.join(jobDir, 'oneste-final.png'), fullPage: true });

    // Extract offers
    const offers = await page.evaluate(() => {
      const results: any[] = [];
      const offerCards = document.querySelectorAll('.mantine-Card-root');
      
      offerCards.forEach(card => {
        const text = card.textContent || '';
        if (text.includes('RCA') && text.includes('lei')) {
           const priceMatch = text.match(/([\d,.]+)\s*lei/i);
           const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
           
           // Simple heuristic for provider name
           let provider = 'Unknown';
           const lowerText = text.toLowerCase();
           if (lowerText.includes('grawe')) provider = 'Grawe';
           else if (lowerText.includes('groupama')) provider = 'Groupama';
           else if (lowerText.includes('allianz')) provider = 'Allianz';
           else if (lowerText.includes('asirom')) provider = 'Asirom';
           else if (lowerText.includes('generali')) provider = 'Generali';
           else if (lowerText.includes('omniasig')) provider = 'Omniasig';
           else if (lowerText.includes('hellas') || lowerText.includes('hd')) provider = 'Hellas Direct';
           else if (lowerText.includes('axon')) provider = 'Axon';
           else if (lowerText.includes('ehi')) provider = 'EHI';
           
           if (price > 0) {
              results.push({ provider, price });
           }
        }
      });
      return results;
    });

    if (offers.length === 0) {
       return {
          status: 'failed',
          error: 'Nu s-au putut extrage ofertele. Verifică oneste-final.png.',
          offers: []
       };
    }

    const minOfferObj = offers.reduce((prev, curr) => prev.price < curr.price ? prev : curr);
    const minOfferStr = `${minOfferObj.provider} - ${minOfferObj.price} lei`;

    return {
      status: 'success',
      reference: '',
      minOffer: minOfferStr,
      offers: offers.map(o => ({ insurer: o.provider, price: `${o.price} lei` }))
    };

  } catch (error: any) {
    console.error("Eroare Oneste:", error);
    await page.screenshot({ path: path.join(jobDir, 'oneste-error.png'), fullPage: true }).catch(() => {});
    return {
      status: 'failed',
      error: `A apărut o eroare: ${error.message}`,
      offers: []
    };
  } finally {
    await context.close();
  }
}
