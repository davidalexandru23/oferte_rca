import { parseScenarioFile } from "./src/excel/template.js";
import { runScenario } from "./src/automation/rcaRunner.js";
import fs from "fs/promises";

async function run() {
  const file = await fs.readFile("/Users/davidalexandru/Downloads/date 3 masini.xlsx");
  const parsed = await parseScenarioFile("date 3 masini.xlsx", file);
  console.log("Parsed rows:", parsed.rows.length);
  
  for (let i = 0; i < parsed.rows.length; i++) {
    console.log(`\n--- RUNNING ROW ${i + 1} ---`);
    console.log("VIN:", parsed.rows[i].vin);
    try {
      const result = await runScenario(parsed.rows[i], `./data/test-row-${i}`);
      console.log(`RESULT ROW ${i + 1}:`, result.status, result.error || "");
    } catch (err) {
      console.error(`CRITICAL ERROR ROW ${i + 1}:`, err);
    }
  }
}
run().catch(console.error);
