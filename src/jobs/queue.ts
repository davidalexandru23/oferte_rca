import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { runScenario } from "../automation/rcaRunner.js";
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
};

const jobs = new Map<string, Job>();
let activeJob: Promise<void> | null = null;

export async function createJob(filename: string, input: Buffer): Promise<JobProgress> {
  const id = crypto.randomUUID();
  const jobDir = path.join(config.dataDir, "jobs", id);
  await fs.mkdir(jobDir, { recursive: true });
  await fs.writeFile(path.join(jobDir, filename), input);

  const job: Job = {
    id,
    filename,
    input,
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

  for (let index = job.results.length; index < parsed.rows.length; index += 1) {
    job.currentRow = index + 2;
    job.message = `Se proceseaza randul ${index + 1}/${parsed.rows.length}`;
    const result = await runScenario(parsed.rows[index], path.join(job.jobDir, `row-${index + 2}`));
    if (result.status === "waiting_for_manual_action") {
      job.status = "waiting_for_manual_action";
      job.message = "Verificare manuala necesara. Rezolva challenge-ul si apasa Reluare.";
      return;
    }
    job.results.push(result);
    job.processed = job.results.length;
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

  job.message = "Se exporta rezultatul";
  const output = await writeResultsWorkbook(parsed.workbook, parsed.sheetName, job.results);
  const resultPath = path.join(job.jobDir, "rezultate-rca.xlsx");
  await fs.writeFile(resultPath, output);
  job.resultPath = resultPath;
  job.status = "completed";
  job.message = "Finalizat";
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
