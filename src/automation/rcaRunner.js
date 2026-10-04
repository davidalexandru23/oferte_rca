import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { config } from "../config.js";
import { scenarioColumns } from "../types.js";
import { rcaSelectors } from "./selectors.js";
export class ManualActionRequired extends Error {
    constructor(message = "Verificare manuala necesara in browser") {
        super(message);
        this.name = "ManualActionRequired";
    }
}
export async function runScenario(row, jobDir) {
    await fs.mkdir(jobDir, { recursive: true });
    const browser = await chromium.launch({ headless: config.headless });
    const context = await browser.newContext({
        locale: "ro-RO",
        timezoneId: "Europe/Bucharest",
        viewport: { width: 1365, height: 900 },
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
    });
    try {
        const page = await context.newPage();
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
        }
        catch (e) {
            console.log("URL wait timeout, checking DOM anyway...");
        }
        // Playwright locators survive navigations and will automatically poll until the element appears
        const offersVisible = await page.locator('.quotes_row.premium_col').first().waitFor({ state: 'visible', timeout: 30000 })
            .then(() => true)
            .catch(() => false);
        if (!offersVisible) {
            console.log("Could not detect offers page elements (.quotes_row.premium_col) after navigation.");
        }
        console.log(`Failed or succeeded. Taking screenshot...`);
        const modelOptions = await page.evaluate(() => {
            const s = document.querySelector("select[name='quote_form[vehicle-model]']");
            return s ? Array.from(s.querySelectorAll("option")).map(o => o.textContent?.trim()) : null;
        });
        console.log("Model Options at failure:", modelOptions);
        const htmlPath = path.join(jobDir, "last-page.html");
        await fs.writeFile(htmlPath, await page.content().catch(() => ""));
        console.log("Dumped HTML to", htmlPath);
        await page.screenshot({ path: path.join(jobDir, "last-page.png"), fullPage: true });
        const offers = await parseOffers(page);
        if (!offers.length) {
            return {
                status: "failed",
                error: "Nu am gasit oferte in pagina finala. Ruleaza study si ajusteaza selectorii.",
                offers: []
            };
        }
        return {
            status: "success",
            reference: await extractReference(page),
            minOffer: findMinOffer(offers),
            offers
        };
    }
    catch (error) {
        if (error instanceof ManualActionRequired) {
            await saveContextState(context, jobDir);
            return { status: "waiting_for_manual_action", error: error.message, offers: [] };
        }
        return {
            status: "failed",
            error: error instanceof Error ? error.message : "Eroare necunoscuta",
            offers: []
        };
    }
    finally {
        await browser.close();
    }
}
async function fillRcaFlow(page, row) {
    const pendingColumns = new Set(scenarioColumns.filter(c => row[c]));
    for (let step = 0; step < 5; step += 1) {
        await assertNoChallenge(page);
        await acceptEssentialCookies(page);
        let filledOnThisStep = 0;
        // Try to fill pending columns
        for (const column of [...pendingColumns]) {
            const value = row[column];
            const success = await fillField(page, column, value);
            if (success) {
                pendingColumns.delete(column);
                filledOnThisStep++;
                await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => undefined);
                await humanPause(300, 800);
            }
        }
        // Check generic form radios
        const dntRadio = page.locator("label[for='quote_form_quote-dnt_1']"); // Vreau doar RCA
        if (await isVisible(dntRadio))
            await dntRadio.click({ force: true }).catch(() => undefined);
        const consultantaRadio = page.locator("label[for='quote_form_quote-consultancy_1']"); // NU
        if (await isVisible(consultantaRadio))
            await consultantaRadio.click({ force: true }).catch(() => undefined);
        // Check terms if present
        const confirmInput = page.locator("#quote_form_confirm");
        if ((await confirmInput.count().catch(() => 0)) > 0) {
            const isChecked = await confirmInput.isChecked().catch(() => false);
            if (!isChecked) {
                await confirmInput.check({ force: true }).catch(() => undefined);
                await page.evaluate(() => {
                    const el = document.getElementById('quote_form_confirm');
                    if (el && !el.checked) {
                        el.click();
                        if (!el.checked)
                            el.checked = true;
                    }
                }).catch(() => undefined);
                await humanPause(200, 500);
            }
        }
        const clicked = await clickFirstVisible(page, rcaSelectors.nextButtons);
        if (!clicked) {
            if (step > 0 && filledOnThisStep === 0)
                break;
        }
        else {
            await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => undefined);
            await page.waitForFunction(() => {
                const activeStep = document.querySelector('.step.active, .wizard-step.active, div[class*="step-"][style*="block"]');
                return true; // Just a generic pause logic via networkidle below
            }).catch(() => undefined);
            await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => undefined);
            await humanPause(1000, 2000);
        }
    }
}
async function fillField(page, column, value) {
    const fields = rcaSelectors.fields;
    const labels = fields[column] ?? [];
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
async function tryFillByLabel(page, label, value) {
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
        if (!target)
            continue;
        const tag = await target.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
        const className = await target.evaluate((element) => element.className).catch(() => "");
        const isDisabled = await target.evaluate((element) => element.disabled).catch(() => false);
        if (tag === "select" || className.includes("select2-offscreen") || isDisabled)
            continue;
        await target.fill(value, { timeout: 2500 }).catch(async () => {
            await target.click({ timeout: 2500 });
            await target.pressSequentially(value, { delay: 35 });
        });
        return true;
    }
    return false;
}
async function trySelectByLabel(page, label, value) {
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
            if (tag !== "select")
                continue;
            const isContainerVisible = await select.evaluate((element) => {
                const container = element.closest('.broker_form_field_small, .broker_form_field, .form-group, .form-group-flex, .row');
                if (!container)
                    return false;
                return container.offsetParent !== null;
            }).catch(() => false);
            if (!isContainerVisible)
                continue;
            const options = await select.locator("option").evaluateAll((items, wanted) => {
                function normalize(str) {
                    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
                }
                const value = normalize(String(wanted));
                let foundOption = items.find(function (item) {
                    const text = normalize(item.textContent || "");
                    return text === value;
                });
                if (!foundOption) {
                    foundOption = items.find(function (item) {
                        const text = normalize(item.textContent || "");
                        if (text.includes(value))
                            return true;
                        if (value.startsWith(text) && text.length >= 4)
                            return true;
                        return false;
                    });
                }
                return {
                    found: !!foundOption,
                    label: foundOption?.textContent?.trim() ?? "",
                    value: foundOption?.getAttribute("value") ?? "",
                    allOptions: items.map(function (i) { return i.textContent?.trim(); }).filter(Boolean)
                };
            }, value);
            if (!options.found) {
                console.log(`[trySelect] Found select for ${label} but option "${value}" not found. Available:`, options.allOptions.slice(0, 10));
                continue;
            }
            await select.selectOption(options.value || { label: options.label }, { force: true }).catch(() => undefined);
            await select.evaluate((element) => {
                const e = new Event("change", { bubbles: true });
                element.dispatchEvent(e);
                if (window.jQuery) {
                    window.jQuery(element).trigger("change");
                }
            }).catch(() => undefined);
            console.log(`[trySelect] SUCCESS for ${label} -> ${options.label}`);
            return true;
        }
    }
    console.log(`[trySelect] FAILED to find select for ${label}`);
    return false;
}
async function tryRadioOrCheckbox(page, label, value) {
    const fieldGroup = page.locator(`label, .broker_form_row_label, .form-label`).filter({ hasText: new RegExp(escapeRegex(label), "i") }).first();
    const container = fieldGroup.locator("xpath=ancestor::*[contains(@class, 'form-group') or contains(@class, 'row') or contains(@class, 'broker_form_field') or contains(@class, 'display_cell') or contains(@class, 'broker_form_field_small')]").first();
    const option = container.locator(`label`).filter({ hasText: new RegExp(escapeRegex(value), "i") }).first();
    if ((await option.count()) === 0) {
        if ((await fieldGroup.count()) === 0) {
            console.log(`[tryRadio] FAILED: fieldGroup for label "${label}" not found.`);
        }
        else {
            console.log(`[tryRadio] FAILED: fieldGroup found, but option "${value}" not found in container.`);
        }
        return false;
    }
    await option.click({ timeout: 1500, force: true }).catch(() => undefined);
    return true;
}
function labelProximityInput(page, label) {
    const lowerLabel = label.toLowerCase();
    return page
        .locator(`xpath=//*[translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZĂÂÎȘŞȚŢ', 'abcdefghijklmnopqrstuvwxyzăâîșşțţ')="${lowerLabel}" or translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZĂÂÎȘŞȚŢ', 'abcdefghijklmnopqrstuvwxyzăâîșşțţ')="${lowerLabel} *"]/following::input[1]`)
        .first();
}
async function acceptEssentialCookies(page) {
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
async function clickFirstVisible(page, selectors) {
    for (const selector of selectors) {
        const locator = page.locator(selector).first();
        if (await isVisible(locator)) {
            console.log(`Clicking next button: ${selector}`);
            await locator.click({ force: true, timeout: 2000 }).catch(() => locator.evaluate(b => b.click()).catch(() => undefined));
            return true;
        }
    }
    return false;
}
async function assertNoChallenge(page) {
    for (const selector of rcaSelectors.challengeHints) {
        if (await isVisible(page.locator(selector).first())) {
            throw new ManualActionRequired();
        }
    }
}
async function parseOffers(page) {
    const offers = [];
    const offerElements = await page.locator('.quotes_row.premium_col').all();
    for (const el of offerElements) {
        const id = await el.getAttribute('id').catch(() => null);
        const valueStr = await el.getAttribute('value').catch(() => null);
        if (!id || !valueStr)
            continue;
        // Parse ID: e.g. anytime_directSettle_false_price12m
        const parts = id.split('_');
        const insurer = parts[0] || 'Unknown';
        const durationMatch = id.match(/price(\d+m)/i);
        const duration = durationMatch ? durationMatch[1].replace('m', ' luni') : '';
        const hasDirectSettle = id.includes('directSettle_true');
        const price = parseFloat(valueStr);
        if (!isNaN(price) && price > 0) {
            let details = duration;
            if (hasDirectSettle)
                details += ' (cu decontare directă)';
            if (id.includes('_pa_'))
                details += ' (Accidente Persoane)';
            if (id.includes('_ra_'))
                details += ' (Asist. Rutieră)';
            offers.push({
                insurer: insurer.charAt(0).toUpperCase() + insurer.slice(1),
                price: `${price.toFixed(2)} RON`,
                details
            });
        }
    }
    return offers.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
}
async function extractInsurer(card) {
    for (const selector of rcaSelectors.offers.insurerInside) {
        const locator = card.locator(selector).first();
        if (!(await isVisible(locator)))
            continue;
        const alt = await locator.getAttribute("alt").catch(() => null);
        const text = alt ?? (await locator.innerText().catch(() => ""));
        if (text.trim())
            return text.trim();
    }
    return "";
}
async function extractReference(page) {
    const body = await page.locator("body").innerText().catch(() => "");
    return body.match(/RCAQ[-\s]?\d+/i)?.[0] ?? "";
}
function findMinOffer(offers) {
    const sorted = offers
        .map((offer) => ({ offer, amount: Number(offer.price.replace(/[^\d.,]/g, "").replace(",", ".")) }))
        .filter(({ amount }) => Number.isFinite(amount))
        .sort((a, b) => a.amount - b.amount);
    return sorted[0]?.offer.price ?? "";
}
function extractPrice(text) {
    return text.match(/\d+[.,]?\d*\s*(?:RON|lei)/i)?.[0] ?? "";
}
async function firstVisible(locator) {
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < Math.min(count, 3); i += 1) {
        const candidate = locator.nth(i);
        if (await isVisible(candidate))
            return candidate;
    }
    return null;
}
async function isVisible(locator) {
    return locator.isVisible({ timeout: 1000 }).catch(() => false);
}
async function humanPause(minMs, maxMs) {
    const delay = minMs + Math.floor(Math.random() * (maxMs - minMs));
    await new Promise((resolve) => setTimeout(resolve, delay));
}
async function saveContextState(context, jobDir) {
    await context.storageState({ path: path.join(jobDir, "storage-state.json") }).catch(() => undefined);
}
function escapeRegex(value) {
    let escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const charMap = {
        'a': '[aăâAĂÂ]', 'A': '[aăâAĂÂ]',
        'i': '[iîIÎ]', 'I': '[iîIÎ]',
        's': '[sșşSȘŞ]', 'S': '[sșşSȘŞ]',
        't': '[tțţTȚŢ]', 'T': '[tțţTȚŢ]'
    };
    return escaped.split('').map(c => charMap[c] || c).join('');
}
function xpathLiteral(value) {
    return value.replace(/"/g, '\\"');
}
