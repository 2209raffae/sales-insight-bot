/**
 * app.js - Shared utilities for AI Lead & Spend Analytics Copilot.
 * Sales dataset removed; supports Leads + Spend.
 */

const EUR_FORMATTER = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function formatEur(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    return EUR_FORMATTER.format(n);
}

// API helper
async function apiFetch(url, options = {}) {
    const res = await fetch(url, options);
    const raw = await res.text();
    let data = null;
    try {
        data = raw ? JSON.parse(raw) : {};
    } catch {
        data = { detail: raw || "Risposta server non valida" };
    }
    if (!res.ok) throw new Error(data.detail || "Errore API");
    return data;
}

// Toast notification
function showToast(msg, type = "info") {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `show ${type}`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("show"), 3500);
}

// DB Status
async function refreshStatus() {
    const leadsText = document.getElementById("leads-status-text");
    const leadsBadge = document.getElementById("leads-status-badge");
    if (leadsText) {
        try {
            const d = await apiFetch("/api/leads/status");
            leadsText.textContent = d.ready
                ? `${d.lead_records_in_db} lead caricati.`
                : "Nessun dato leads disponibile. Carica un CSV leads per iniziare.";
            if (leadsBadge) {
                leadsBadge.textContent = d.ready ? "Leads OK" : "Nessun lead";
                leadsBadge.className = `badge ${d.ready ? "badge-success" : "badge-warning"}`;
            }
        } catch {
            leadsText.textContent = "Impossibile verificare lo stato leads.";
            if (leadsBadge) {
                leadsBadge.textContent = "Offline";
                leadsBadge.className = "badge badge-warning";
            }
        }
    }

    const spendText = document.getElementById("spend-status-text");
    const spendBadge = document.getElementById("spend-status-badge");
    if (spendText) {
        try {
            const d = await apiFetch("/api/spend/status");
            spendText.textContent = d.ready
                ? `${d.spend_records_in_db} voci di spesa caricate.`
                : "Nessun dato spese disponibile. Carica un CSV spese per iniziare.";
            if (spendBadge) {
                spendBadge.textContent = d.ready ? "Spese OK" : "Nessuna spesa";
                spendBadge.className = `badge ${d.ready ? "badge-success" : "badge-warning"}`;
            }
        } catch {
            spendText.textContent = "Impossibile verificare lo stato spese.";
            if (spendBadge) {
                spendBadge.textContent = "Offline";
                spendBadge.className = "badge badge-warning";
            }
        }
    }
}

// Upload factory
function makeUploader({
    dropZoneId,
    fileInputId,
    uploadBtnId,
    spinnerId,
    fileNameId,
    resultId,
    endpoint,
    onSuccess,
}) {
    const dropZone = document.getElementById(dropZoneId);
    const fileInput = document.getElementById(fileInputId);
    const uploadBtn = document.getElementById(uploadBtnId);
    const spinner = document.getElementById(spinnerId);
    const fileNameEl = document.getElementById(fileNameId);
    const resultEl = document.getElementById(resultId);
    if (!dropZone || !fileInput || !uploadBtn) return;

    let selectedFile = null;

    function setFile(f) {
        selectedFile = f;
        if (fileNameEl) fileNameEl.textContent = f.name;
        uploadBtn.disabled = false;
    }

    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", e => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", e => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener("change", () => {
        if (fileInput.files[0]) setFile(fileInput.files[0]);
    });

    uploadBtn.addEventListener("click", async () => {
        if (!selectedFile) return;
        uploadBtn.disabled = true;
        if (spinner) spinner.style.display = "inline-block";
        if (resultEl) resultEl.textContent = "";

        const form = new FormData();
        form.append("file", selectedFile);

        // Let the caller inject custom data (like mapping)
        if (window._currentUploadExtraParams) {
            for (const [k, v] of Object.entries(window._currentUploadExtraParams)) {
                form.append(k, v);
            }
        }

        try {
            const res = await fetch(endpoint, { method: "POST", body: form });
            const raw = await res.text();
            let data = {};
            try {
                data = raw ? JSON.parse(raw) : {};
            } catch {
                data = { detail: raw || "Risposta server non valida" };
            }
            if (res.ok) {
                if (data.status === "needs_mapping") {
                    if (onSuccess) onSuccess(data, selectedFile);
                    return;
                }
                const msg = `Importati: +${data.rows_new || data.rows_inserted || 0} nuovi, ${data.rows_skipped || 0} scartati, ${data.rows_updated ?? 0} aggiornati`;
                if (resultEl) resultEl.textContent = msg;
                showToast("Caricamento completato", "success");
                if (onSuccess) onSuccess(data, selectedFile);
            } else {
                if (resultEl) resultEl.textContent = `${data.detail}`;
                showToast("Caricamento non riuscito", "error");
            }
        } catch (e) {
            if (resultEl) resultEl.textContent = `Errore di rete: ${e.message}`;
            showToast("Errore di rete", "error");
        } finally {
            uploadBtn.disabled = false;
            if (spinner) spinner.style.display = "none";
            window._currentUploadExtraParams = null; // reset
        }
    });

    return { setFile };
}

// Confirmation modal
function confirmModal(message, onConfirm) {
    const overlay = document.getElementById("confirm-modal");
    if (!overlay) {
        if (confirm(message)) onConfirm();
        return;
    }
    document.getElementById("confirm-modal-msg").textContent = message;
    overlay.classList.add("open");
    const yes = document.getElementById("confirm-yes");
    const no = document.getElementById("confirm-no");
    const close = () => {
        overlay.classList.remove("open");
        yes.onclick = null;
        no.onclick = null;
    };
    yes.onclick = () => {
        close();
        onConfirm();
    };
    no.onclick = close;
}
