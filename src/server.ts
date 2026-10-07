import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { clearSession, isAuthenticated, requireAuth, setSession, verifyPassword } from "./auth.js";
import { assertConfig, config } from "./config.js";
import { runDebug } from "./automation/debug.js";
import { createTemplateBuffer } from "./excel/template.js";
import { createJob, getJob, getResultPath, resumeJob, getActiveJob, cancelJob, cancelAllActiveJobs } from "./jobs/queue.js";

assertConfig();

const app = Fastify({ logger: true });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../../public");

await fs.mkdir(config.dataDir, { recursive: true });

await app.register(cookie);
await app.register(formbody);
await app.register(multipart, {
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1
  }
});
await app.register(fastifyStatic, {
  root: publicDir,
  prefix: "/assets/"
});

app.get("/", async (request, reply) => {
  return reply.redirect(isAuthenticated(request) ? "/dashboard" : "/login");
});

app.get("/login", async (_request, reply) => {
  return reply.sendFile("login.html");
});

app.post<{ Body: { password?: string } }>("/login", async (request, reply) => {
  if (verifyPassword(request.body.password ?? "")) {
    setSession(reply);
    return reply.redirect("/dashboard");
  }
  return reply.status(401).type("text/html").send("Parola invalida. <a href=\"/login\">Inapoi</a>");
});

app.post("/logout", async (_request, reply) => {
  clearSession(reply);
  return reply.redirect("/login");
});

app.get("/dashboard", { preHandler: requireAuth }, async (_request, reply) => {
  return reply.sendFile("dashboard.html");
});

app.get("/api/template", { preHandler: requireAuth }, async (_request, reply) => {
  const buffer = await createTemplateBuffer();
  return reply
    .header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .header("content-disposition", "attachment; filename=\"template-rca.xlsx\"")
    .send(buffer);
});

app.post("/api/jobs", { preHandler: requireAuth }, async (request, reply) => {
  const parts = request.parts();
  let fileBuffer: Buffer | null = null;
  let filename = "upload.xlsx";
  let provider = "asigurari.ro";

  for await (const part of parts) {
    if (part.type === 'file') {
      filename = part.filename;
      const chunks: Buffer[] = [];
      for await (const chunk of part.file) chunks.push(Buffer.from(chunk));
      fileBuffer = Buffer.concat(chunks);
    } else if (part.type === 'field' && part.fieldname === 'provider') {
      provider = String(part.value);
    }
  }

  if (!fileBuffer) return reply.status(400).send({ error: "Lipseste fisierul" });
  const job = await createJob(filename, fileBuffer, provider);
  return reply.send(job);
});


app.get("/api/jobs/active", { preHandler: requireAuth }, async (_request, reply) => {
  const job = getActiveJob();
  if (!job) return reply.status(404).send({ error: "Niciun job activ" });
  return reply.send(job);
});


app.post("/api/jobs/cancel-active", { preHandler: requireAuth }, async (_request, reply) => {
  await cancelAllActiveJobs();
  return reply.send({ success: true });
});

app.post<{ Params: { id: string } }>("/api/jobs/:id/cancel", { preHandler: requireAuth }, async (request, reply) => {
  const job = await cancelJob(request.params.id);
  if (!job) return reply.status(404).send({ error: "Job inexistent" });
  return reply.send(job);
});

app.get<{ Params: { id: string } }>("/api/jobs/:id", { preHandler: requireAuth }, async (request, reply) => {
  const job = getJob(request.params.id);
  if (!job) return reply.status(404).send({ error: "Job inexistent" });
  return reply.send(job);
});

app.post<{ Params: { id: string } }>("/api/jobs/:id/resume", { preHandler: requireAuth }, async (request, reply) => {
  const job = await resumeJob(request.params.id);
  if (!job) return reply.status(404).send({ error: "Job inexistent" });
  return reply.send(job);
});

app.get<{ Params: { id: string } }>("/api/jobs/:id/result", { preHandler: requireAuth }, async (request, reply) => {
  const resultPath = getResultPath(request.params.id);
  if (!resultPath) return reply.status(404).send({ error: "Rezultatul nu este disponibil" });
  return reply
    .header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .header("content-disposition", "attachment; filename=\"rezultate-rca.xlsx\"")
    .send(await fs.readFile(resultPath));
});

app.get("/api/debug", { preHandler: requireAuth }, async (_request, reply) => {
  const result = await runDebug();
  return reply.send(result);
});

app.setNotFoundHandler(async (_request, reply) => {
  return reply.status(404).send({ error: "Not found" });
});

app.listen({ host: "0.0.0.0", port: config.port }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
