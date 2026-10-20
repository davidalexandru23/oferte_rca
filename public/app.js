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
const timerBoxEl = document.querySelector("#timer-box");
const timerTextEl = document.querySelector("#timer-text");
const timerStatsEl = document.querySelector("#timer-stats");

let liveTimer = null;
let currentJobStartedAt = null;

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function updateLiveClock(startedAt, total, processed) {
  if (!startedAt) return;
  const elapsedMs = Date.now() - startedAt;
  timerTextEl.textContent = `Timp scurs: ${formatDuration(elapsedMs)}`;
  if (processed > 0 && total > 0) {
    const mins = elapsedMs / 60000;
    const speed = Math.round((processed / mins) * 10) / 10;
    const remaining = total - processed;
    if (remaining > 0 && speed > 0) {
      const etaMs = (remaining / (speed / 60)) * 1000;
      timerStatsEl.textContent = `Viteză: ~${speed} mașini/min | Estimare rămas: ~${formatDuration(etaMs)}`;
    } else {
      timerStatsEl.textContent = `Viteză: ~${speed} mașini/min`;
    }
  } else {
    timerStatsEl.textContent = "Se inițializează...";
  }
}


uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearInterval(liveTimer);
  liveTimer = null;
  currentJobStartedAt = null;
  timerBoxEl.classList.add("hidden");
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
  setMessage("Se oprește jobul și se salvează rezultatele parțiale...");
  stopEl.disabled = true;
  await fetch("/api/jobs/cancel-active", { method: "POST" });
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

const debugButton = document.querySelector("#debug-button");

debugButton.addEventListener("click", () => {
  window.location.href = "/api/debug";
});

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!currentJobId) return;
    const response = await fetch(`/api/jobs/${currentJobId}`);
    if (!response.ok) return;
    const payload = await response.json();
    renderJob(payload);
    if (["completed", "failed", "waiting_for_manual_action"].includes(payload.status)) {
      clearInterval(pollTimer);
      stopEl.disabled = false;
    } else if (payload.status === "cancelled") {
      if (payload.resultPath || payload.processed === 0) {
        clearInterval(pollTimer);
        stopEl.disabled = false;
      }
    }
  }, 1000);
}

function renderJob(job) {
  statusEl.textContent = job.status;
  statusEl.className = `status ${job.status}`;
  progressEl.max = Math.max(job.total || 1, 1);
  progressEl.value = job.processed || 0;
  setMessage(job.message || job.error || "");
  resumeEl.classList.toggle("hidden", job.status !== "waiting_for_manual_action");

  // Timer handling
  if (job.startedAt) {
    currentJobStartedAt = job.startedAt;
    timerBoxEl.classList.remove("hidden");

    if (job.status === "completed") {
      clearInterval(liveTimer);
      liveTimer = null;
      timerBoxEl.classList.add("completed");
      const duration = job.durationMs || (job.completedAt ? job.completedAt - job.startedAt : Date.now() - job.startedAt);
      timerTextEl.textContent = `Timp total: ${formatDuration(duration)}`;
      timerStatsEl.textContent = `Procesare completă (${job.processed}/${job.total} mașini) - Excel pregătit!`;
    } else if (job.status === "running") {
      timerBoxEl.classList.remove("completed");
      updateLiveClock(job.startedAt, job.total || 0, job.processed || 0);
      if (!liveTimer) {
        liveTimer = setInterval(() => {
          updateLiveClock(currentJobStartedAt, progressEl.max, progressEl.value);
        }, 1000);
      }
    } else if (job.status === "cancelled" || job.status === "failed") {
      clearInterval(liveTimer);
      liveTimer = null;
      const duration = job.durationMs || (Date.now() - job.startedAt);
      timerTextEl.textContent = `Timp scurs până la oprire: ${formatDuration(duration)}`;
      timerStatsEl.textContent = `Job ${job.status} (${job.processed}/${job.total || 0} mașini)`;
    }
  } else {
    timerBoxEl.classList.add("hidden");
    clearInterval(liveTimer);
    liveTimer = null;
  }
  
  if (job.status === "completed" || job.status === "cancelled") { 
    if (job.resultPath || job.status === "completed") {
      downloadEl.href = `/api/jobs/${job.id}/result`; 
      downloadEl.classList.remove("hidden");
      downloadEl.textContent = job.status === "cancelled" ? "Descarcă rezultate parțiale" : "Descarcă rezultat";
    }
  }
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
