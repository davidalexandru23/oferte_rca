const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf-8');

// 1. Add references
code = code.replace('const resumeEl = document.querySelector("#resume");', 'const resumeEl = document.querySelector("#resume");\nconst stopEl = document.querySelector("#stop");');

// 2. Add event listener for stop
const stopListener = `
stopEl.addEventListener("click", async () => {
  if (!currentJobId) return;
  const response = await fetch(\`/api/jobs/\${currentJobId}/cancel\`, { method: "POST" });
  const payload = await response.json();
  renderJob(payload);
  startPolling();
});

document.addEventListener("DOMContentLoaded", async () => {
  const response = await fetch("/api/jobs/active");
  if (response.ok) {
    const payload = await response.json();
    currentJobId = payload.id;
    renderJob(payload);
    startPolling();
  }
});
`;

code = code.replace('const debugButton = document.querySelector("#debug-button");', stopListener + '\nconst debugButton = document.querySelector("#debug-button");');

// 3. Update renderJob to toggle stopEl and handle cancelled status
code = code.replace('if (job.status === "completed") downloadEl.href = `/api/jobs/${job.id}/result`;', 'if (job.status === "completed" || job.status === "cancelled") { downloadEl.href = `/api/jobs/${job.id}/result`; downloadEl.classList.remove("hidden"); }\n  stopEl.classList.toggle("hidden", !["running", "queued", "waiting_for_manual_action"].includes(job.status));');

// And remove the `downloadEl.classList.toggle` line before it because we overwrote its logic.
code = code.replace('downloadEl.classList.toggle("hidden", job.status !== "completed");', '');

// Also add cancelled to the stop polling array
code = code.replace('if (["completed", "failed", "waiting_for_manual_action"].includes(payload.status)) {', 'if (["completed", "failed", "waiting_for_manual_action", "cancelled"].includes(payload.status)) {');

fs.writeFileSync('public/app.js', code);
