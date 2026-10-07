const fs = require('fs');
let code = fs.readFileSync('src/jobs/queue.ts', 'utf-8');

// 1. Add cancelled and browser to Job type
code = code.replace('jobDir: string;\n};', 'jobDir: string;\n  cancelled?: boolean;\n  browser?: import("playwright").Browser;\n};');

// 2. getActiveJob and cancelJob
const exportedFunctions = `
export function getActiveJob() {
  for (const job of jobs.values()) {
    if (["running", "queued", "waiting_for_manual_action"].includes(job.status)) {
      return publicJob(job);
    }
  }
  return null;
}

export async function cancelJob(id: string) {
  const job = jobs.get(id);
  if (!job) return null;
  job.cancelled = true;
  if (job.status === "queued" || job.status === "waiting_for_manual_action") {
    job.status = "cancelled";
    job.message = "Job oprit manual.";
    pump(); // start next if any
  }
  if (job.browser) {
    job.browser.close().catch(() => {});
  }
  return publicJob(job);
}
`;

code = code.replace('export function getJob(id: string) {', exportedFunctions + '\nexport function getJob(id: string) {');

// 3. Update while condition
code = code.replace('while (nextIndex < parsed.rows.length && !manualActionTriggered) {', 'while (nextIndex < parsed.rows.length && !manualActionTriggered && !job.cancelled) {');

// 4. Update processJob to store browser
code = code.replace('const browser = await chromium.launch({ headless: config.headless });', 'const browser = await chromium.launch({ headless: config.headless });\n  job.browser = browser;');

// 5. Check cancellation in result
code = code.replace('if (manualActionTriggered) {\n    return; // Don\'t export yet\n  }', 'if (manualActionTriggered) {\n    return; // Don\'t export yet\n  }\n  if (job.cancelled) {\n    job.status = "cancelled";\n    job.message = "Job oprit manual. Se exporta rezultatele partiale...";\n  }');

// 6. Handle completed status properly at the end
code = code.replace('job.status = "completed";\n  job.message = "Finalizat";', 'if (!job.cancelled) {\n    job.status = "completed";\n    job.message = "Finalizat";\n  }');

fs.writeFileSync('src/jobs/queue.ts', code);
