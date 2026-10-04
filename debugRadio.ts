import { chromium } from "playwright";
function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`
    <div class="broker_form_field display_cell ">
        <div class="form-group-flex">
            <label class="broker_form_row_label fw_radio_button control-label col-lg-2">Decontare directă</label>
            <div id="quote_form_quote-direct-compensation" class="radio_flex_mt6 quote_direct_compensation"><div class="radio"><label class=" broker_form_row_label  fw_radio_button whole_button_radio " for="quote_form_quote-direct-compensation_0"><input type="radio" id="quote_form_quote-direct-compensation_0" name="quote_form[quote-direct-compensation]" value="yes">
    DA</label></div><div class="radio"><label class=" broker_form_row_label  fw_radio_button whole_button_radio " for="quote_form_quote-direct-compensation_1"><input type="radio" id="quote_form_quote-direct-compensation_1" name="quote_form[quote-direct-compensation]" value="no">
    NU</label></div></div>
        </div>
    </div>
  `);
  
  const label = "Decontare directă";
  const value = "Nu";
  
  const fieldGroup = page.locator(`label`).filter({ hasText: new RegExp(escapeRegex(label), "i") }).first();
  console.log("fieldGroup count:", await fieldGroup.count());
  
  const container = fieldGroup.locator("xpath=ancestor::*[contains(@class, 'form-group') or contains(@class, 'row') or contains(@class, 'broker_form_field') or contains(@class, 'display_cell')]").first();
  console.log("container count:", await container.count());
  
  const option = container.locator(`label`).filter({ hasText: new RegExp(`^\\s*${escapeRegex(value)}\\s*$`, "i") }).first();
  console.log("option count:", await option.count());
  if (await option.count() > 0) {
      console.log("Option text:", await option.textContent());
  }
  
  await browser.close();
}
run().catch(console.error);
