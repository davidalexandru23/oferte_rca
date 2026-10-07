import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { chromium } from "playwright";
import { parseScenarioFile } from "../excel/template.js";
import { writeResultsWorkbook } from "../export/results.js";
import type { JobProgress, ScenarioResult } from "../types.js";

type Job = JobProgress & {
  filename: string;
  input: Buffer;
  workbook?: Awaited<ReturnType<typeof parseScenarioFile>>["workbook"];
  sheetName?: string;
  rows?: Awaited<ReturnType<typeof parseScenarioFile>>["rows"];
  results: ScenarioResult[];
  jobDir: string;
  cancelled?: boolean;
  browser?: import("playwright").Browser;
};

const jobs = new Map<string, Job>();
let activeJob: Promise<void> | null = null;

export async function createJob(filename: string, input: Buffer, provider: string = "asigurari.ro"): Promise<JobProgress> {
  const id = crypto.randomUUID();
  const jobDir = path.join(config.dataDir, "jobs", id);
  await fs.mkdir(jobDir, { recursive: true });
  await fs.writeFile(path.join(jobDir, filename), input);

  const job: Job = {
    id,
    filename,
    input,
    provider,
    status: "queued",
    total: 0,
    processed: 0,
    recentResults: [],
    results: [],
    jobDir
  };
  jobs.set(id, job);
  pump();
  return publicJob(job);
}


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

export function getJob(id: string) {
  const job = jobs.get(id);
  return job ? publicJob(job) : null;
}

export async function resumeJob(id: string) {
  const job = jobs.get(id);
  if (!job) return null;
  if (job.status === "waiting_for_manual_action") {
    job.status = "queued";
    job.message = "Job reluat";
    pump();
  }
  return publicJob(job);
}

export function getResultPath(id: string) {
  const job = jobs.get(id);
  if (!job?.resultPath) return null;
  return job.resultPath;
}

function pump() {
  if (activeJob) return;
  const next = [...jobs.values()].find((job) => job.status === "queued");
  if (!next) return;
  activeJob = processJob(next)
    .catch((error) => {
      next.status = "failed";
      next.error = error instanceof Error ? error.message : "Eroare necunoscuta";
    })
    .finally(() => {
      activeJob = null;
      pump();
    });
}

async function processJob(job: Job) {
  job.status = "running";
  job.message = "Se parseaza fisierul";
  const parsed = await parseScenarioFile(job.filename, job.input);
  job.workbook = parsed.workbook;
  job.sheetName = parsed.sheetName;
  job.rows = parsed.rows;
  job.total = parsed.rows.length;

  if (!parsed.rows.length) {
    throw new Error("Fisierul nu contine scenarii");
  }

  // Pre-fill results array if empty
  if (job.results.length === 0) {
    job.results = Array(parsed.rows.length).fill(null);
  }

  const concurrencyLimit = 3;
  let activeWorkers = 0;
  let nextIndex = 0;
  let manualActionTriggered = false;

  const browser = await chromium.launch({ headless: config.headless });
  job.browser = browser;

  try {
    const worker = async () => {
      while (nextIndex < parsed.rows.length && !manualActionTriggered && !job.cancelled) {
        const index = nextIndex++;
        // Skip already processed rows
        if (job.results[index]) continue;

        job.currentRow = index + 2;
        job.message = `Se proceseaza in paralel (max ${concurrencyLimit})...`;
        
        // Add a random delay before starting the row to avoid sending all requests at the exact same millisecond
        await new Promise(r => setTimeout(r, Math.random() * 2000));

        let result: ScenarioResult;
        if (job.provider === 'asigurari-oneste.ro') {
          const { runOnesteScenario } = await import("../automation/onesteRunner.js");
          result = await runOnesteScenario(browser, parsed.rows[index], path.join(job.jobDir, `row-${index + 2}`));
        } else {
          const { runScenario } = await import("../automation/rcaRunner.js");
          result = await runScenario(browser, parsed.rows[index], path.join(job.jobDir, `row-${index + 2}`));
        }
        
        if (result.status === "waiting_for_manual_action") {
          manualActionTriggered = true;
          job.status = "waiting_for_manual_action";
          job.message = "Verificare manuala necesara. Rezolva challenge-ul si apasa Reluare.";
          return;
        }

        job.results[index] = result;
        job.processed = job.results.filter(Boolean).length;
        job.recentResults = [
          {
            row: index + 2,
            status: result.status,
            offerCount: result.offers.length,
            minOffer: result.minOffer,
            error: result.error
          },
          ...job.recentResults
        ].slice(0, 12);
      }
    };

    const workers = [];
    for (let i = 0; i < concurrencyLimit; i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

  } finally {
    await browser.close();
  }

  if (manualActionTriggered) {
    return; // Don't export yet
  }
  if (job.cancelled) {
    job.status = "cancelled";
    job.message = "Job oprit manual. Se exporta rezultatele partiale...";
  }

  job.message = "Se exporta rezultatul";
  const output = await writeResultsWorkbook(parsed.workbook, parsed.sheetName, job.results);
  const resultPath = path.join(job.jobDir, "rezultate-rca.xlsx");
  await fs.writeFile(resultPath, output);
  job.resultPath = resultPath;
  if (!job.cancelled) {
    job.status = "completed";
    job.message = "Finalizat";
  }
}

function publicJob(job: Job): JobProgress {
  return {
    id: job.id,
    status: job.status,
    total: job.total,
    processed: job.processed,
    currentRow: job.currentRow,
    message: job.message,
    resultPath: job.resultPath,
    error: job.error,
    recentResults: job.recentResults
  };
}

export async function cancelAllActiveJobs() {
  for (const job of jobs.values()) {
    if (["running", "queued", "waiting_for_manual_action"].includes(job.status)) {
      job.cancelled = true;
      job.status = "cancelled";
      job.message = "Job oprit manual.";
      if (job.browser) {
        job.browser.close().catch(() => {});
      }
    }
  }
}
