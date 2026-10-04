import { describe, expect, it } from "vitest";
import { createTemplateBuffer, parseScenarioFile } from "../src/excel/template.js";
import { writeResultsWorkbook } from "../src/export/results.js";

describe("excel contract", () => {
  it("creates and parses the fixed template", async () => {
    const buffer = await createTemplateBuffer();
    const parsed = await parseScenarioFile("template.xlsx", buffer);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].tip_auto).toBe("Autoturism");
    expect(parsed.rows[0].durata_luni).toBe("12");
  });

  it("exports result columns to the right of the input", async () => {
    const buffer = await createTemplateBuffer();
    const parsed = await parseScenarioFile("template.xlsx", buffer);
    const output = await writeResultsWorkbook(parsed.workbook, parsed.sheetName, [
      {
        status: "success",
        reference: "RCAQ-123",
        minOffer: "100 RON",
        offers: [{ insurer: "Test Asigurator", price: "100 RON", details: "detalii" }]
      }
    ]);
    const reparsed = await parseScenarioFile("result.xlsx", output);
    expect(reparsed.rows).toHaveLength(1);
  });
});
