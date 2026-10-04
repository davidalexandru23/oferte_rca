let currentJobId = null;
let pollTimer = null;

const uploadForm = document.querySelector("#upload-form");
const statusEl = document.querySelector("#status");
const messageEl = document.querySelector("#message");
const progressEl = document.querySelector("#progress");
const resultsEl = document.querySelector("#results");
const downloadEl = document.querySelector("#download");
const resumeEl = document.querySelector("#resume");


uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(uploadForm);
  setMessage("Se incarca fisierul...");
  const response = await fetch("/api/jobs", { method: "POST", body: formData });
  const payload = await response.json();
  if (!response.ok) {
    setMessage(payload.error || "Upload esuat");
    return;
  }
  currentJobId = payload.id;
  renderJob(payload);
  startPolling();
});

resumeEl.addEventListener("click", async () => {
  if (!currentJobId) return;
  const response = await fetch(`/api/jobs/${currentJobId}/resume`, { method: "POST" });
  renderJob(await response.json());
  startPolling();
});

const debugButton = document.querySelector("#debug-button");

debugButton.addEventListener("click", () => {
  window.location.href = "/api/debug";
});

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!currentJobId) return;
    const response = await fetch(`/api/jobs/${currentJobId}`);
    const payload = await response.json();
    renderJob(payload);
    if (["completed", "failed", "waiting_for_manual_action"].includes(payload.status)) {
      clearInterval(pollTimer);
    }
  }, 1600);
}

function renderJob(job) {
  statusEl.textContent = job.status;
  statusEl.className = `status ${job.status}`;
  progressEl.max = Math.max(job.total || 1, 1);
  progressEl.value = job.processed || 0;
  setMessage(job.message || job.error || "");
  resumeEl.classList.toggle("hidden", job.status !== "waiting_for_manual_action");
  downloadEl.classList.toggle("hidden", job.status !== "completed");
  if (job.status === "completed") downloadEl.href = `/api/jobs/${job.id}/result`;
  resultsEl.innerHTML = (job.recentResults || [])
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.row)}</td>
        <td>${escapeHtml(row.status)}</td>
        <td>${escapeHtml(row.offerCount)}</td>
        <td>${escapeHtml(row.minOffer || "")}</td>
        <td>${escapeHtml(row.error || "")}</td>
      </tr>`
    )
    .join("");
}

function setMessage(message) {
  messageEl.textContent = message;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}
