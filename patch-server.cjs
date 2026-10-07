const fs = require('fs');
let code = fs.readFileSync('src/server.ts', 'utf-8');

// Update imports
code = code.replace('import { createJob, getJob, getResultPath, resumeJob } from "./jobs/queue.js";', 'import { createJob, getJob, getResultPath, resumeJob, getActiveJob, cancelJob } from "./jobs/queue.js";');

const activeEndpoint = `
app.get("/api/jobs/active", { preHandler: requireAuth }, async (_request, reply) => {
  const job = getActiveJob();
  if (!job) return reply.status(404).send({ error: "Niciun job activ" });
  return reply.send(job);
});
`;

const cancelEndpoint = `
app.post<{ Params: { id: string } }>("/api/jobs/:id/cancel", { preHandler: requireAuth }, async (request, reply) => {
  const job = await cancelJob(request.params.id);
  if (!job) return reply.status(404).send({ error: "Job inexistent" });
  return reply.send(job);
});
`;

// Insert them before app.get("/api/jobs/:id")
code = code.replace('app.get<{ Params: { id: string } }>("/api/jobs/:id"', activeEndpoint + cancelEndpoint + '\napp.get<{ Params: { id: string } }>("/api/jobs/:id"');

fs.writeFileSync('src/server.ts', code);
