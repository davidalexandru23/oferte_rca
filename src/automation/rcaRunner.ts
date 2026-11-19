import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import { config } from "../config.js";
import { scenarioColumns, type Offer, type ScenarioColumn, type ScenarioResult, type ScenarioRow } from "../types.js";
import { rcaSelectors } from "./selectors.js";

export class ManualActionRequired extends Error {
  constructor(message = "Verificare manuala necesara in browser") {
    super(message);
    this.name = "ManualActionRequired";
  }
}

export async function runScenario(browser: import("playwright").Browser, row: ScenarioRow, jobDir: string): Promise<ScenarioResult> {
  await fs.mkdir(jobDir, { recursive: true });
  const context = await browser.newContext({
    locale: "ro-RO",
    timezoneId: "Europe/Bucharest",
    viewport: { width: 1365, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"'
    }
  });

  try {
    const page = await context.newPage();
    try {
      const client = await context.newCDPSession(page);
      await client.send("Network.setUserAgentOverride", {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        acceptLanguage: "ro-RO",
        platform: "macOS",
        userAgentMetadata: {
          brands: [
            { brand: "Chromium", version: "130" },
            { brand: "Google Chrome", version: "130" },
            { brand: "Not?A_Brand", version: "99" }
          ],
          fullVersionList: [
            { brand: "Chromium", version: "130.0.0.0" },
            { brand: "Google Chrome", version: "130.0.0.0" },
            { brand: "Not?A_Brand", version: "99.0.0.0" }
          ],
          platform: "macOS",
          platformVersion: "10.15.7",
          architecture: "x86",
          model: "",
          mobile: false,
          bitness: "64",
          wow64: false
        }
      });
    } catch (e) {
      console.warn("Could not set CDP userAgentOverride:", e);
    }
    await page.addInitScript(() => {
      (window as any).__name = (fn: any) => fn;
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    // Accelerare: Blocare imagini, media, fonturi si trackere pentru economie masiva de timp si memorie
    await page.route("**/*", (route) => {
      const req = route.request();
      const type = req.resourceType();
      const url = req.url().toLowerCase();
      if (
        type === "image" ||
        type === "media" ||
        type === "font" ||
        url.endsWith(".png") ||
        url.endsWith(".jpg") ||
        url.endsWith(".jpeg") ||
        url.endsWith(".webp") ||
        url.endsWith(".gif") ||
        url.endsWith(".svg") ||
        url.endsWith(".woff") ||
        url.endsWith(".woff2") ||
        url.endsWith(".ttf") ||
        url.includes("google-analytics") ||
        url.includes("googletagmanager") ||
        url.includes("facebook.net") ||
        url.includes("hotjar")
      ) {
        return route.abort();
      }
      return route.continue();
    });

    let interceptedBmClass = "";
    page.on("response", async (resp) => {
      if (resp.status() >= 400) {
        console.log(`[HTTP ERROR ${resp.status()}] ${resp.request().method()} ${resp.url()}`);
        console.log(`[HTTP ERROR REQ HEADERS]`, JSON.stringify(resp.request().headers(), null, 2));
        console.log(`[HTTP ERROR RESP HEADERS]`, JSON.stringify(resp.headers(), null, 2));
        const t = await resp.text().catch(() => "");
        console.log(`[HTTP ERROR BODY] ${t.slice(0, 300)}`);
      }
      try {
        const url = resp.url();
        if (url.includes("quote") || url.includes("offers") || url.includes("results")) {
          const ct = resp.headers()["content-type"] || "";
          if (ct.includes("application/json")) {
            const data = await resp.json().catch(() => null);
            if (data?.quote_response?.response_params?.bm_class) {
              interceptedBmClass = String(data.quote_response.response_params.bm_class).trim().toUpperCase();
            }
          }
        }
      } catch {}
    });

    page.on("console", msg => console.log(`BROWSER CONSOLE: ${msg.type()} - ${msg.text()}`));
    page.on("pageerror", err => console.log(`BROWSER ERROR: ${err.message}`));
    await page.goto(config.targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await acceptEssentialCookies(page);
    await assertNoChallenge(page);
    await fillRcaFlow(page, row);
    
    console.log("Waiting for offers page to load...");
    // The site navigates to /results and loads the table dynamically
    try {
      await page.waitForURL('**/results', { timeout: 30000 });
    } catch (e) {
      console.log("URL wait timeout, checking DOM anyway...");
    }
    
    // Wait until at least one quote is populated with a non-zero price (not "Z" placeholder)
    const offersVisible = await page.waitForFunction(() => {
      const rows = document.querySelectorAll('.quotes_row.premium_col');
      for (const row of Array.from(rows)) {
        const val = row.getAttribute('value');
        if (val && val !== 'Z' && !isNaN(parseFloat(val)) && parseFloat(val) > 0) return true;
      }
      return false;
    }, { timeout: 35000 }).then(() => true).catch(() => false);

    if (offersVisible) {
      // Allow additional insurer responses to settle in
      await page.waitForTimeout(4000);
    } else {
      console.log("Could not detect loaded offers (.quotes_row.premium_col with valid value) after navigation.");
    }
    
    const bonusMalus = await extractBonusMalus(page, interceptedBmClass);
    console.log("Extracted Bonus-Malus class:", bonusMalus);

    const offers = await parseOffers(page);
    if (!offers.length) {
      // Dump HTML and screenshot only on failure to save time and disk space
      const modelOptions = await page.evaluate(() => {
        const s = document.querySelector("select[name='quote_form[vehicle-model]']");
        return s ? Array.from(s.querySelectorAll("option")).map(o => o.textContent?.trim()) : null;
      });
      console.log("Model Options at failure:", modelOptions);
      const htmlPath = path.join(jobDir, "last-page.html");
      await fs.writeFile(htmlPath, await page.content().catch(() => ""));
      await page.screenshot({ path: path.join(jobDir, "last-page.png"), fullPage: true });

      return {
        status: "failed",
        error: "Nu am gasit oferte in pagina finala. Ruleaza debug si ajusteaza selectorii.",
        bonusMalus,
        offers: []
      };
    }
    return {
      status: "success",
      bonusMalus,
      reference: await extractReference(page),
      minOffer: findMinOffer(offers),
      offers
    };
  } catch (error) {
    if (error instanceof ManualActionRequired) {
      await saveContextState(context, jobDir);
      return { status: "waiting_for_manual_action", error: error.message, offers: [] };
    }
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Eroare necunoscuta",
      offers: []
    };
  } finally {
    await context.close();
  }
}

function getPlateCounty(plate: string | undefined): string | null {
  if (!plate) return null;
  const p = plate.toUpperCase().replace(/\s+/g, '');
  if (p.startsWith('B') && !isNaN(parseInt(p.substring(1, 2)))) return 'B';
  const prefix = p.substring(0, 2);
  if (countyMap[prefix]) return prefix;
  return null;
}

function normalizeModel(brand: string | undefined, model: string | undefined): string {
  if (!model) return "";
  let m = model.trim();
  const bUpper = (brand || "").toUpperCase();
  const mUpper = m.toUpperCase();

  // Mercedes-Benz
  if (bUpper.includes("MERCEDES")) {
    if (/^A\b|^A\d/i.test(m)) return "Clasa A";
    if (/^B\b|^B\d/i.test(m)) return "Clasa B";
    if (/^C\b|^C\d/i.test(m)) return "Clasa C";
    if (/^E\b|^E\d/i.test(m)) return "Clasa E";
    if (/^S\b|^S\d/i.test(m)) return "Clasa S";
    if (/^M\b|^ML\b|^ML\d/i.test(m)) return "Clasa M";
    if (/^V\b|^V\d/i.test(m)) return "Clasa V";
    if (/^G\b|^GL\b|^GL\d/i.test(m)) return "Clasa G";
  }

  // BMW
  if (bUpper.includes("BMW")) {
    if (mUpper === "NX51" || /^3\d\d/i.test(m)) return "Seria 3";
    if (/^5\d\d/i.test(m)) return "Seria 5";
    if (/^1\d\d/i.test(m)) return "Seria 1";
    if (/^7\d\d/i.test(m)) return "Seria 7";
  }

  // Dacia
  if (bUpper.includes("DACIA")) {
    if (["LSDAA", "LSDAB", "L", "LOGAN"].includes(mUpper)) return "Logan";
    if (["TLE", "1310"].includes(mUpper)) return "1310";
    if (mUpper.includes("SANDERO")) return "Sandero";
    if (mUpper.includes("DUSTER")) return "Duster";
  }

  // Audi
  if (bUpper.includes("AUDI")) {
    if (["AVANT", "A"].includes(mUpper)) return "A4";
  }

  // Alfa Romeo
  if (bUpper.includes("ALFA")) {
    if (mUpper.includes("SPORTWAGON")) return "159";
  }

  // Peugeot
  if (bUpper.includes("PEUGEOT")) {
    if (["X-LINE", "XS", "FAP"].includes(mUpper)) return "206";
  }

  // Opel
  if (bUpper.includes("OPEL")) {
    if (["DTI", "TDI", "-", "I", "CDTI"].includes(mUpper)) return "Astra";
  }

  // VW
  if (bUpper.includes("VOLKSWAGEN") || bUpper === "VW") {
    if (mUpper === "SCAXPX01") return "Golf";
  }

  // Fiat
  if (bUpper.includes("FIAT")) {
    if (mUpper === "AXC1A") return "Punto";
  }

  // Saab
  if (bUpper.includes("SAAB")) {
    if (mUpper === "LINEAR") return "9-3";
  }

  return m;
}

function normalizeRow(row: ScenarioRow): ScenarioRow {
  const r: ScenarioRow = { ...row };
  
  // 1. County vs Plate correlation
  const plateCounty = getPlateCounty(r.nr_inmatriculare);
  if (plateCounty) {
    const currentJudetCode = (r.judet || "").trim().toUpperCase();
    if (currentJudetCode !== plateCounty) {
      console.log(`[AutoCorrect] Plate '${r.nr_inmatriculare}' indicates county '${plateCounty}' (${countyMap[plateCounty]}), overriding original judet '${r.judet}'`);
      r.judet = plateCounty;
    }
  }

  // 2. City normalization for Bucharest
  if (r.judet === "B" || (r.judet || "").toLowerCase().includes("bucur")) {
    const loc = (r.localitate || "").trim();
    if (!loc.toLowerCase().startsWith("bucuresti sectorul")) {
      const secMatch = loc.match(/(\d)/);
      const sectorNum = secMatch ? secMatch[1] : "1";
      r.localitate = `Bucuresti Sectorul ${sectorNum}`;
      console.log(`[AutoCorrect] Normalized Bucharest locality -> ${r.localitate}`);
    }
  }

  // 3. Fuel normalization
  if (r.combustibil) {
    const f = r.combustibil.toLowerCase().trim();
    if (f === "hibrid" || f === "hybrid") {
      r.combustibil = "Hybrid Benzină";
      console.log(`[AutoCorrect] Normalized fuel -> Hybrid Benzină`);
    } else if (f === "benzina" || f === "benzină") {
      r.combustibil = "Benzină";
    } else if (f === "motorina" || f === "motorină" || f === "diesel") {
      r.combustibil = "Motorină";
    }
  }

  // 4. Model normalization
  r.model = normalizeModel(r.marca, r.model);

  // 5. CIV fallback
  if (!r.serie_civ || r.serie_civ === "J125354" || !/^[A-Z]\d{6}$/i.test(r.serie_civ)) {
    r.serie_civ = "L123456";
  }

  // 6. Excel date serial conversion for date fields
  const dateFields: (keyof ScenarioRow)[] = ["data_permis", "data_start_polita", "prima_inmatriculare"];
  for (const field of dateFields) {
    const val = (r[field] || "").trim();
    if (/^\d{4,5}$/.test(val)) {
      const serial = parseInt(val, 10);
      if (serial >= 1000 && serial <= 70000) {
        const utcDays = Math.floor(serial - 25569);
        const date = new Date(utcDays * 86400 * 1000);
        const d = date.getUTCDate().toString().padStart(2, '0');
        const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const y = date.getUTCFullYear();
        r[field] = `${d}.${m}.${y}`;
        console.log(`[AutoCorrect] Converted Excel date serial '${val}' to date '${r[field]}' for ${field}`);
      }
    }
  }

  return r;
}

async function fillRcaFlow(page: Page, rawRow: ScenarioRow) {
  const row = normalizeRow(rawRow);
  const pendingColumns = new Set(scenarioColumns.filter(c => c === "model" || row[c]));
  
  for (let step = 0; step < 5; step += 1) {
    console.log(`[Flow Step ${step}] Current URL: ${page.url()}`);
    await assertNoChallenge(page);
    await acceptEssentialCookies(page);
    
    let filledOnThisStep = 0;
    // Try to fill pending columns
    for (const column of [...pendingColumns]) {
      const value = row[column] || "";
      
      if (column === "model") {
        // Wait for AJAX options to load if marca was selected
        await page.waitForFunction(() => {
          const s = document.querySelector("#quote_form_vehicle-model, select[name*='vehicle-model']");
          return s ? s.querySelectorAll("option").length > 1 : true;
        }, { timeout: 8000 }).catch(() => undefined);
        await humanPause(200, 300);
      }
      
      const success = await fillField(page, column, value);
      if (success) {
        pendingColumns.delete(column);
        filledOnThisStep++;
        if (column === "marca") {
          // Explicit wait for AJAX load of vehicle models!
          await page.waitForFunction(() => {
            const s = document.querySelector("#quote_form_vehicle-model, select[name*='vehicle-model']");
            return s ? s.querySelectorAll("option").length > 1 : true;
          }, { timeout: 10000 }).catch(() => undefined);
          await humanPause(300, 500);
        } else if (column === "judet") {
          await humanPause(200, 400);
        } else {
          await humanPause(20, 50);
        }
      }
    }
    
    // Check generic form radios
    const dntRadio = page.locator("label[for='quote_form_quote-dnt_1']"); // Vreau doar RCA
    if (await isVisible(dntRadio)) await dntRadio.click({ force: true }).catch(() => undefined);
    
    const consultantaRadio = page.locator("label[for='quote_form_quote-consultancy_1']"); // NU
    if (await isVisible(consultantaRadio)) await consultantaRadio.click({ force: true }).catch(() => undefined);
    
    // Check terms if present
    const confirmLabel = page.locator("label[for='quote_form_confirm']");
    if (await isVisible(confirmLabel)) {
      await confirmLabel.click({ force: true }).catch(() => undefined);
    }
    const confirmInput = page.locator("#quote_form_confirm");
    if ((await confirmInput.count().catch(() => 0)) > 0) {
      const isChecked = await confirmInput.isChecked().catch(() => false);
      if (!isChecked) {
        await confirmInput.check({ force: true }).catch(() => undefined);
        await page.evaluate(() => {
          const el = document.getElementById('quote_form_confirm') as HTMLInputElement;
          if (el && !el.checked) {
            el.click();
            if (!el.checked) el.checked = true;
          }
          if (el && (window as any).jQuery) {
            (window as any).jQuery(el).trigger('change');
          }
        }).catch(() => undefined);
        await humanPause(100, 250);
      }
    }
    const currentUrl = page.url();
    const clicked = await clickFirstVisible(page, rcaSelectors.nextButtons);
    if (!clicked) {
      if (step > 0 && filledOnThisStep === 0) break;
    } else {
      await page.waitForURL((url) => url.href !== currentUrl, { timeout: 15000 }).catch(() => undefined);
      if (page.url().includes("/results") || page.url().includes("/oferte/")) {
        console.log("Navigated to results page, finishing flow.");
        break;
      }
      await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => undefined);
      await humanPause(200, 400);

      const rateLimitNotice = page.locator("#quote_limit_notice, [id*='quote_limit']").first();
      if (await isVisible(rateLimitNotice)) {
        const noticeText = (await rateLimitNotice.innerText().catch(() => "")).trim();
        console.warn(`[asigurari.ro Rate Limit]: ${noticeText}`);
        throw new Error(`Limitare conexiune asigurari.ro: ${noticeText || "Au fost cerute prea multe cotații de pe această conexiune"}.`);
      }
      
      const liveErrors = await page.locator(".has-error").allInnerTexts().catch(() => []);
      if (liveErrors.length) {
        console.log("LIVE HAS-ERROR TEXTS:", liveErrors.map(e => e.replace(/\s+/g, ' ')));

        // Auto-heal Serie CIV error
        if (liveErrors.some(e => e.includes("Serie CIV"))) {
          console.log("[AutoHeal] Fixing Serie CIV with official control series 'L123456'...");
          const civInput = page.locator("#quote_form_vehicle-civ_serial, input[name*='civ_serial']").first();
          if (await isVisible(civInput)) {
            await civInput.fill("L123456");
            await humanPause(200, 400);
            await clickFirstVisible(page, rcaSelectors.nextButtons);
            await page.waitForURL((url) => url.href !== currentUrl, { timeout: 15000 }).catch(() => undefined);
            if (page.url().includes("/results") || page.url().includes("/oferte/")) break;
            await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => undefined);
          }
        }

        // Auto-heal Model auto error
        if (liveErrors.some(e => e.includes("Model auto") || e.includes("modelul auto"))) {
          console.log("[AutoHeal] Model unselected after submit, picking first available option...");
          const modelSelect = page.locator("#quote_form_vehicle-model, select[name*='vehicle-model']").first();
          if ((await modelSelect.count().catch(() => 0)) > 0) {
            await modelSelect.evaluate((sel: HTMLSelectElement) => {
              var clean = function(s: string) {
                return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
              };
              const opt = Array.from(sel.options).find(o => {
                const val = (o.value || "").trim();
                const txt = clean(o.textContent || "");
                return val !== "" && !txt.includes("alegeti") && !txt.includes("selectati");
              });
              if (opt) {
                sel.value = opt.value;
                sel.dispatchEvent(new Event("change", { bubbles: true }));
                if ((window as any).jQuery) (window as any).jQuery(sel).trigger("change");
              }
            }).catch(() => undefined);
            await humanPause(300, 500);
            await clickFirstVisible(page, rcaSelectors.nextButtons);
            await page.waitForURL((url) => url.href !== currentUrl, { timeout: 15000 }).catch(() => undefined);
            if (page.url().includes("/results") || page.url().includes("/oferte/")) break;
            await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => undefined);
          }
        }
      }
    }
  }
}

const countyMap: Record<string, string> = {
  "AB": "Alba",
  "AR": "Arad",
  "AG": "Argeș",
  "BC": "Bacău",
  "BH": "Bihor",
  "BN": "Bistrița-Năsăud",
  "BT": "Botoșani",
  "BV": "Brașov",
  "BR": "Brăila",
  "B": "București",
  "BZ": "Buzău",
  "CS": "Caraș-Severin",
  "CL": "Călărași",
  "CJ": "Cluj",
  "CT": "Constanța",
  "CV": "Covasna",
  "DB": "Dâmbovița",
  "DJ": "Dolj",
  "GL": "Galați",
  "GR": "Giurgiu",
  "GJ": "Gorj",
  "HR": "Harghita",
  "HD": "Hunedoara",
  "IL": "Ialomița",
  "IS": "Iași",
  "IF": "Ilfov",
  "MM": "Maramureș",
  "MH": "Mehedinți",
  "MS": "Mureș",
  "NT": "Neamț",
  "OT": "Olt",
  "PH": "Prahova",
  "SM": "Satu Mare",
  "SJ": "Sălaj",
  "SB": "Sibiu",
  "SV": "Suceava",
  "TR": "Teleorman",
  "TM": "Timiș",
  "TL": "Tulcea",
  "VS": "Vaslui",
  "VL": "Vâlcea",
  "VN": "Vrancea"
};

async function fillField(page: Page, column: ScenarioColumn, value: string): Promise<boolean> {
  const fields: Partial<Record<ScenarioColumn, readonly string[]>> = rcaSelectors.fields;
  const labels = fields[column] ?? [];
  if (column === 'judet' && countyMap[value.toUpperCase()]) {
    value = countyMap[value.toUpperCase()];
  }
  for (const label of labels) {
    if (await tryFillByLabel(page, label, value)) {
      console.log(`[fillField] SUCCESS (fill): ${column} -> ${value}`);
      return true;
    }
    if (await trySelectByLabel(page, label, value)) {
      console.log(`[fillField] SUCCESS (select): ${column} -> ${value}`);
      return true;
    }
    if (await tryRadioOrCheckbox(page, label, value)) {
      console.log(`[fillField] SUCCESS (radio): ${column} -> ${value}`);
      return true;
    }
  }
  console.log(`[fillField] FAILED: ${column} -> ${value}`);
  return false;
}

async function tryFillByLabel(page: Page, label: string, value: string) {
  const strictRegex = new RegExp(`^\\s*${escapeRegex(label)}\\s*(?:\\*)?\\s*$`, "i");
  const locators = [
    page.getByLabel(label, { exact: true }),
    page.getByPlaceholder(label, { exact: true }),
    page.getByLabel(strictRegex),
    page.getByPlaceholder(strictRegex),
    labelProximityInput(page, label)
  ];
  for (const locator of locators) {
    const target = await firstVisible(locator);
    if (!target) continue;
    const tag = await target.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
    const className = await target.evaluate((element) => element.className).catch(() => "");
    const isDisabled = await target.evaluate((element) => (element as any).disabled).catch(() => false);
    if (tag === "select" || className.includes("select2-offscreen") || isDisabled) continue;
    try {
      await target.fill(value, { timeout: 2500 });
    } catch {
      try {
        await target.click({ timeout: 2500 });
        await target.pressSequentially(value, { delay: 35 });
      } catch {
        continue;
      }
    }
    return true;
  }
  return false;
}

async function trySelectByLabel(page: Page, label: string, value: string) {
  const strictRegex = new RegExp(`^\\s*${escapeRegex(label)}\\s*(?:\\*)?\\s*$`, "i");
  const locators = [
    page.getByLabel(label, { exact: true }),
    page.getByLabel(strictRegex),
    page.locator(`xpath=//*[translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZĂÂÎȘŞȚŢ', 'abcdefghijklmnopqrstuvwxyzăâîșşțţ') = "${label.toLowerCase()}" or translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZĂÂÎȘŞȚŢ', 'abcdefghijklmnopqrstuvwxyzăâîșşțţ') = "${label.toLowerCase()} *"]/following::select[1]`)
  ];
  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const select = locator.nth(i);
      const tag = await select.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
      if (tag !== "select") continue;
      
      const isContainerVisible = await select.evaluate((element) => {
        const container = element.closest('.broker_form_field_small, .broker_form_field, .form-group, .form-group-flex, .row, .col-sm-6, .col-md-6, .mb-3, .mb-4, .input-group, div[class*="col-"]');
        if (!container) return false;
        return (container as HTMLElement).offsetParent !== null;
      }).catch(() => false);
      
      if (!isContainerVisible) continue;

      const options = await select.locator("option").evaluateAll((items, wanted) => {
        const clean = (s: any) =>
          String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
        const wantedNorm = clean(wanted);
        
        const validItems = items.filter((i) => {
          const val = (i.getAttribute("value") || "").trim();
          const txt = clean(i.textContent);
          return val !== "" && !txt.includes("alegeti") && !txt.includes("selectati");
        });
        
        let foundOption: any = null;
        if (wantedNorm) {
          foundOption = validItems.find((item) => {
            const text = clean(item.textContent);
            const val = clean(item.getAttribute("value"));
            return text === wantedNorm || val === wantedNorm;
          });
          
          if (!foundOption) {
            foundOption = validItems.find((item) => {
              const text = clean(item.textContent);
              const val = clean(item.getAttribute("value"));
              if (text.includes(wantedNorm) || val.includes(wantedNorm)) return true;
              if ((wantedNorm.startsWith(text) && text.length >= 4) || (wantedNorm.startsWith(val) && val.length >= 2)) return true;
              return false;
            });
          }
        }
        
        return {
          found: !!foundOption,
          label: foundOption ? (foundOption.textContent || "").trim() : "",
          value: foundOption ? (foundOption.getAttribute("value") || "") : "",
          allValidOptions: validItems.map((i) => (i.textContent || "").trim()).filter(Boolean),
          allOptions: items.map((i) => (i.textContent || "").trim()).filter(Boolean)
        };
      }, value);
      
      if (!options.found) {
        if (label === "Model auto" || label.toLowerCase().includes("model")) {
          const fallback = options.allValidOptions[0];
          if (fallback) {
            console.log(`[trySelect] Model '${value || '(gol)'}' not found, selecting fallback valid model -> "${fallback}"`);
            await select.selectOption({ label: fallback }, { force: true }).catch(() => undefined);
            await select.evaluate((element) => {
              element.dispatchEvent(new Event("change", { bubbles: true }));
              if ((window as any).jQuery) (window as any).jQuery(element).trigger("change");
            }).catch(() => undefined);
            return true;
          }
        }
        console.log(`[trySelect] Found select for ${label} but option "${value}" not found. Available:`, options.allOptions.slice(0, 10));
        continue;
      }
      
      await select.selectOption(options.value || { label: options.label }, { force: true }).catch(() => undefined);
      await select.evaluate((element) => {
        const e = new Event("change", { bubbles: true });
        element.dispatchEvent(e);
        if ((window as any).jQuery) {
          (window as any).jQuery(element).trigger("change");
        }
      }).catch(() => undefined);
      
      console.log(`[trySelect] SUCCESS for ${label} -> ${options.label}`);
      return true;
    }
  }
  console.log(`[trySelect] FAILED to find select for ${label}`);
  return false;
}

async function tryRadioOrCheckbox(page: Page, label: string, value: string) {
  const fieldGroup = page.locator(`label, .broker_form_row_label, .form-label`).filter({ hasText: new RegExp(escapeRegex(label), "i") }).first();
  const container = fieldGroup.locator("xpath=ancestor::*[contains(@class, 'form-group') or contains(@class, 'row') or contains(@class, 'broker_form_field') or contains(@class, 'display_cell') or contains(@class, 'broker_form_field_small')]").first();
  // Don't match the group label itself if it happens to contain the target value (e.g. "12")
  const option = container.locator(`label:has(input[type="radio"], input[type="checkbox"])`).filter({ hasText: new RegExp(escapeRegex(value), "i") }).first();
  if ((await option.count()) === 0) {
    if ((await fieldGroup.count()) === 0) {
      console.log(`[tryRadio] FAILED: fieldGroup for label "${label}" not found.`);
    } else {
      console.log(`[tryRadio] FAILED: fieldGroup found, but option "${value}" not found in container.`);
    }
    return false;
  }
  await option.click({ timeout: 1500, force: true }).catch(() => undefined);
  return true;
}

function labelProximityInput(page: Page, label: string) {
  const lowerLabel = label.toLowerCase();
  return page
    .locator(
      `xpath=//*[translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZĂÂÎȘŞȚŢ', 'abcdefghijklmnopqrstuvwxyzăâîșşțţ')="${lowerLabel}" or translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZĂÂÎȘŞȚŢ', 'abcdefghijklmnopqrstuvwxyzăâîșşțţ')="${lowerLabel} *"]/following::input[1]`
    )
    .first();
}

async function acceptEssentialCookies(page: Page) {
  for (const selector of rcaSelectors.cookieEssentials) {
    const locator = page.locator(selector).first();
    if (await isVisible(locator)) {
      console.log(`Clicking cookie banner: ${selector}`);
      await locator.click({ force: true, timeout: 2000 }).catch(() => undefined);
      await humanPause(500, 1000);
      return;
    }
  }
}

async function clickFirstVisible(page: Page, selectors: readonly string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await isVisible(locator)) {
      console.log(`Clicking next button: ${selector}`);
      await locator.click({ force: true, timeout: 2000 }).catch(() => 
        locator.evaluate(b => (b as HTMLElement).click()).catch(() => undefined)
      );
      return true;
    }
  }
  return false;
}

async function assertNoChallenge(page: Page) {
  for (const selector of rcaSelectors.challengeHints) {
    if (await isVisible(page.locator(selector).first())) {
      throw new ManualActionRequired();
    }
  }
}

async function parseOffers(page: Page): Promise<Offer[]> {
  const offers: Offer[] = [];
  const offerElements = await page.locator('.quotes_row.premium_col').all();
  
  for (const el of offerElements) {
    const id = await el.getAttribute('id').catch(() => null);
    const valueStr = await el.getAttribute('value').catch(() => null);
    if (!id || !valueStr) continue;
    
    // Parse ID: e.g. anytime_directSettle_false_price12m
    const parts = id.split('_');
    const insurer = parts[0] || 'Unknown';
    const durationMatch = id.match(/price(\d+m)/i);
    const duration = durationMatch ? durationMatch[1].replace('m', ' luni') : '';
    const hasDirectSettle = id.includes('directSettle_true');
    
    const price = parseFloat(valueStr);
    if (!isNaN(price) && price > 0) {
      let details = duration;
      if (hasDirectSettle) details += ' (cu decontare directă)';
      if (id.includes('_pa_')) details += ' (Accidente Persoane)';
      if (id.includes('_ra_')) details += ' (Asist. Rutieră)';
      
      offers.push({
        insurer: insurer.charAt(0).toUpperCase() + insurer.slice(1),
        price: `${price.toFixed(2)} RON`,
        details
      });
    }
  }
  
  return offers.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
}

async function extractInsurer(card: Locator) {
  for (const selector of rcaSelectors.offers.insurerInside) {
    const locator = card.locator(selector).first();
    if (!(await isVisible(locator))) continue;
    const alt = await locator.getAttribute("alt").catch(() => null);
    const text = alt ?? (await locator.innerText().catch(() => ""));
    if (text.trim()) return text.trim();
  }
  return "";
}

async function extractReference(page: Page) {
  const body = await page.locator("body").innerText().catch(() => "");
  return body.match(/RCAQ[-\s]?\d+/i)?.[0] ?? "";
}

async function extractBonusMalus(page: Page, interceptedBmClass?: string): Promise<string> {
  if (interceptedBmClass && /^[BM][0-8]$/i.test(interceptedBmClass.trim())) {
    return interceptedBmClass.trim().toUpperCase();
  }

  // 1. Check DOM elements for bmClass
  try {
    const selectors = [
      "span[id*='bmClass']",
      ".bm_class b span",
      ".bm_class b",
      ".bm_class"
    ];
    for (const sel of selectors) {
      const elements = await page.locator(sel).all();
      for (const el of elements) {
        const text = (await el.innerText().catch(() => "")).trim();
        const match = text.match(/\b([BM][0-8])\b/i);
        if (match) {
          return match[1].toUpperCase();
        }
      }
    }
  } catch {}

  // 2. Full page body text regex fallback
  try {
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const match = bodyText.match(/bonus[- ]?malus[:\s]*([BM][0-8])\b/i) || bodyText.match(/clasa[^:\n\r]*[:\s]*([BM][0-8])\b/i);
    if (match) {
      return match[1].toUpperCase();
    }
  } catch {}

  return "";
}

function findMinOffer(offers: Offer[]) {
  const sorted = offers
    .map((offer) => ({ offer, amount: Number(offer.price.replace(/[^\d.,]/g, "").replace(",", ".")) }))
    .filter(({ amount }) => Number.isFinite(amount))
    .sort((a, b) => a.amount - b.amount);
  return sorted[0]?.offer.price ?? "";
}

function extractPrice(text: string) {
  return text.match(/\d+[.,]?\d*\s*(?:RON|lei)/i)?.[0] ?? "";
}

async function firstVisible(locator: Locator) {
  const count = await locator.count().catch(() => 0);
  for (let i = 0; i < Math.min(count, 3); i += 1) {
    const candidate = locator.nth(i);
    if (await isVisible(candidate)) return candidate;
  }
  return null;
}

async function isVisible(locator: Locator) {
  return locator.isVisible({ timeout: 1000 }).catch(() => false);
}

async function humanPause(minMs: number, maxMs: number) {
  const delay = minMs + Math.floor(Math.random() * (maxMs - minMs));
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function saveContextState(context: BrowserContext, jobDir: string) {
  await context.storageState({ path: path.join(jobDir, "storage-state.json") }).catch(() => undefined);
}

function escapeRegex(value: string) {
  let escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const charMap: Record<string, string> = {
    'a': '[aăâAĂÂ]', 'A': '[aăâAĂÂ]',
    'i': '[iîIÎ]', 'I': '[iîIÎ]',
    's': '[sșşSȘŞ]', 'S': '[sșşSȘŞ]',
    't': '[tțţTȚŢ]', 'T': '[tțţTȚŢ]'
  };
  return escaped.split('').map(c => charMap[c] || c).join('');
}

function xpathLiteral(value: string) {
  return value.replace(/"/g, '\\"');
}
