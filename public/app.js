let currentJobId = null;
let pollTimer = null;

const uploadForm = document.querySelector("#upload-form");
const statusEl = document.querySelector("#status");
const messageEl = document.querySelector("#message");
const progressEl = document.querySelector("#progress");
const resultsEl = document.querySelector("#results");
const downloadEl = document.querySelector("#download");
const resumeEl = document.querySelector("#resume");
const stopEl = document.querySelector("#stop");


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


stopEl.addEventListener("click", async () => {
  await fetch("/api/jobs/cancel-active", { method: "POST" });
  currentJobId = null;
  clearInterval(pollTimer);
  renderJob({ status: "cancelled", message: "Toate joburile active au fost oprite." });
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
    if (["completed", "failed", "waiting_for_manual_action", "cancelled"].includes(payload.status)) {
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
  
  if (job.status === "completed" || job.status === "cancelled") { downloadEl.href = `/api/jobs/${job.id}/result`; downloadEl.classList.remove("hidden"); }
  stopEl.classList.remove("hidden"); // Always show stop button just in case
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

// Prompt Modal Logic
const promptBtn = document.getElementById('prompt-button');
const promptModal = document.getElementById('prompt-modal');
const closeModal = document.querySelector('.close-modal');
const copyPromptBtn = document.getElementById('copy-prompt-btn');
const promptText = document.getElementById('prompt-text');

if (promptBtn && promptModal) {
  promptBtn.addEventListener('click', () => {
    promptModal.classList.remove('hidden');
  });

  closeModal.addEventListener('click', () => {
    promptModal.classList.add('hidden');
  });

  window.addEventListener('click', (event) => {
    if (event.target === promptModal) {
      promptModal.classList.add('hidden');
    }
  });

  copyPromptBtn.addEventListener('click', () => {
    promptText.select();
    document.execCommand('copy');
    copyPromptBtn.textContent = 'Copiat!';
    setTimeout(() => {
      copyPromptBtn.textContent = 'Copiază Prompt';
    }, 2000);
  });
}
