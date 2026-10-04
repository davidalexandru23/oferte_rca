import { chromium, type Page } from "playwright";
import { config } from "../config.js";
import { rcaSelectors } from "./selectors.js";

type Candidate = {
  label: string;
  tag: string;
  type: string;
  name: string;
  id: string;
  placeholder: string;
  selector: string;
  score: number;
};

export async function runDebug() {
  const browser = await chromium.launch({ headless: config.headless });
  const page = await browser.newPage({
    locale: "ro-RO",
    timezoneId: "Europe/Bucharest",
    viewport: { width: 1365, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
  });

  try {
    await page.goto(config.targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await acceptEssentialCookies(page);
    const html = await page.content();
    const candidates = await collectCandidates(page);
    return { 
      url: page.url(), 
      generatedAt: new Date().toISOString(), 
      totalCandidates: candidates.length, 
      candidates,
      htmlLength: html.length
    };
  } finally {
    await browser.close();
  }
}

async function acceptEssentialCookies(page: Page) {
  for (const selector of rcaSelectors.cookieEssentials) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
      await locator.click().catch(() => undefined);
      return;
    }
  }
}

async function collectCandidates(page: Page): Promise<Candidate[]> {
  return page.evaluate(() => {
    const controls = [...document.querySelectorAll("input, select, textarea, button")];
    return controls.map((element) => {
      const html = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement;
      const id = html.id || "";
      const name = html.getAttribute("name") || "";
      const placeholder = html.getAttribute("placeholder") || "";
      const label =
        (id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent : "") ||
        html.closest("label")?.textContent ||
        html.parentElement?.textContent ||
        "";
      const selector = id
        ? `#${CSS.escape(id)}`
        : name
          ? `${html.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`
          : `${html.tagName.toLowerCase()}:has-text("${(label || placeholder).trim().slice(0, 32)}")`;
      const score = [id, name, placeholder, label].filter(Boolean).length;
      return {
        label: label.replace(/\s+/g, " ").trim().slice(0, 160),
        tag: html.tagName.toLowerCase(),
        type: html.getAttribute("type") || "",
        name,
        id,
        placeholder,
        selector,
        score
      };
    });
  });
}

if (process.argv[1]?.endsWith("debug.ts")) {
  runDebug()
    .then((result) => {
      console.log(`Debug found ${result.totalCandidates} candidates.`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
