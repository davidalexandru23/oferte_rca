import fs from "fs/promises";
import { parseScenarioFile } from "./src/excel/template.js";
import { runScenario } from "./src/automation/rcaRunner.js";

async function run() {
  const filePath = "/Users/davidalexandru/Downloads/template-rca_date_eu.xlsx";
  const file = await fs.readFile(filePath);
  const result = await parseScenarioFile("template-rca_date_eu.xlsx", file);
  // It returns { workbook, sheetName, rows } or { rows } for csv
  const rows = (result as any).rows;
  console.log(`Parsed ${rows.length} rows:`);
  console.log(JSON.stringify(rows, null, 2));
  
  if (rows.length > 0) {
    const row = rows[0];
    console.log(`Running scenario for first row...`);
    const scenarioResult = await runScenario(row, `./data/manual-test-row-0`);
    console.log(`Result:`, JSON.stringify(scenarioResult, null, 2));
  }
}

run().catch(console.error);
