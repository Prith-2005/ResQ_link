/* =================================================================
   ResQLink — Admin Panel JavaScript
   Features:
     • Load + auto-refresh alerts every 30 s
     • Toast notifications (replaces all alert() calls)
     • Filter tabs: All / Pending / Verified / Assigned / Resolved
     • Live search by location or disaster type
     • Verify / unverify by clicking status badge
     • Resolve / flag / undo actions
     • Assign responder → POST /api/assign-responder
     • Update responder status → PATCH /api/update-responder-status
     • Duplicate-assign guard (409 shown as toast)
     • Responder table shows only verified + assigned alerts
   ================================================================= */

// ─── API BASE ──────────────────────────────────────────────────────────────
const API_BASE = (function () {
  if (typeof window === "undefined") return "http://localhost:5000/api";
  const override = window.RESQLINK_API_BASE;
  if (override) return String(override).replace(/\/$/, "");
  const { protocol, hostname, port } = window.location;
  const host = hostname || "localhost";
  if (port === "5000") return `${protocol}//${host}:5000/api`;
  return `http://${host}:5000/api`;
})();

// ─── GLOBAL STATE ──────────────────────────────────────────────────────────
let alertsData   = [];   // full list from server
let activeFilter = "all";
let searchQuery  = "";
let autoRefreshId = null;

// ─── INIT ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initGlobals();
  initFilterTabs();
  initSearch();
  initRefreshButton();
  loadAlerts();
  startAutoRefresh();
});

function initGlobals() {
  window.resolveAlert          = resolveAlert;
  window.flagAlert             = flagAlert;
  window.undoAction            = undoAction;
  window.assignResponder       = assignResponder;
  window.updateResponderStatus = updateResponderStatus;
}

function initFilterTabs() {
  document.querySelectorAll(".filter-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach((b) =>
        b.classList.remove("active")
      );
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      renderAll();
    });
  });
}

function initSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  input.addEventListener("input", () => {
    searchQuery = input.value.trim().toLowerCase();
    renderAll();
  });
}

function initRefreshButton() {
  const btn = document.getElementById("refreshBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    showToast("Refreshing…", "info");
    loadAlerts();
  });
}

function startAutoRefresh() {
  if (autoRefreshId) clearInterval(autoRefreshId);
  autoRefreshId = setInterval(loadAlerts, 30_000);
}

// ─── SAFE JSON PARSE ───────────────────────────────────────────────────────
async function parseJsonResponse(res) {
  const text = await res.text();
  const t = text.trim();
  if (!t) return {};
  if (t.startsWith("<")) {
    const msg =
      "Server returned HTML. Make sure the backend (port 5000) is running.";
    console.error(msg, res.url, res.status);
    throw new Error(msg);
  }
  try {
    return JSON.parse(t);
  } catch {
    throw new Error("Invalid JSON: " + t.slice(0, 80));
  }
}

// ─── LOAD ALERTS ───────────────────────────────────────────────────────────
async function loadAlerts() {
  showLoader("alertLoader", true);
  try {
    const res  = await fetch(`${API_BASE}/alerts`);
    const data = await parseJsonResponse(res);

    if (!Array.isArray(data)) {
      throw new Error((data && data.error) || "GET /api/alerts did not return an array");
    }

    alertsData = data.map(normalizeAlert);
    renderAll();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Could not load alerts", "error");
  } finally {
    showLoader("alertLoader", false);
  }
}

/**
 * Normalise alert object for UI:
 * – unify `unverified` → `pending`
 * – derive `action` field
 */
function normalizeAlert(a) {
  a.status = a.status === "unverified" ? "pending" : a.status;
  let action = null;
  if (a.caseResolved === 1 || a.status === "resolved") action = "resolved";
  else if (a.isFalse === true) action = "flagged";
  if (!a.assignedResponders) a.assignedResponders = [];
  return { ...a, action };
}

function mergeAlertFromServer(serverAlert) {
  const normalized = normalizeAlert(serverAlert);
  const idx = alertsData.findIndex((a) => a._id === normalized._id);
  if (idx >= 0) alertsData[idx] = normalized;
  else alertsData.unshift(normalized);
}

// ─── FILTER + SEARCH LOGIC ─────────────────────────────────────────────────
function filteredAlerts() {
  return alertsData.filter((a) => {
    // filter tab
    if (activeFilter !== "all" && a.status !== activeFilter) return false;
    // search
    if (searchQuery) {
      const hay = `${a.locationName || ""} ${a.disasterType || ""}`.toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }
    return true;
  });
}

// ─── RENDER ALL ───────────────────────────────────────────────────────────
function renderAll() {
  renderAlertTable();
  renderResponderTable();
  updateStats();
}

// ─── STATS ────────────────────────────────────────────────────────────────
function updateStats() {
  let pending = 0, verified = 0, assigned = 0, resolved = 0, flagged = 0;
  alertsData.forEach((a) => {
    if (a.status === "pending")  pending++;
    if (a.status === "verified") verified++;
    if (a.status === "assigned") assigned++;
    if (a.status === "resolved") resolved++;
    if (a.isFalse === true)      flagged++;
  });
  setText("activeCount",   pending);
  setText("verifiedCount", verified);
  setText("assignedCount", assigned);
  setText("resolvedCount", resolved);
  setText("falseCount",    flagged);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── ALERT TABLE ──────────────────────────────────────────────────────────
function renderAlertTable() {
  const tbody  = document.getElementById("alertTable");
  const empty  = document.getElementById("alertEmpty");
  const list   = filteredAlerts();

  tbody.innerHTML = "";

  if (list.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  list.forEach((alert, i) => {
    tbody.innerHTML += buildAlertRow(alert, i, list.length);
  });
}

function buildAlertRow(alert, i, total) {
  const altId = `ALT-${total - i}`;
  const dt    = new Date(alert.createdAt);
  const date  = dt.toLocaleDateString();
  const time  = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const statusBadge = buildStatusBadge(alert);
  const actions     = buildActionButtons(alert);

  return `
    <tr>
      <td><span style="font-family:monospace;font-size:12px;color:var(--text-muted)">${altId}</span></td>
      <td>
        <div style="font-size:13px">${date}</div>
        <div style="color:var(--text-muted);font-size:11px">${time}</div>
      </td>
      <td>${escHtml(alert.locationName || "—")}</td>
      <td>
        <span class="badge badge-pending" style="background:rgba(255,255,255,0.05);border:none;color:var(--text)">
          ${escHtml(alert.disasterType || "—")}
        </span>
      </td>
      <td>
        <span style="font-size:12px;text-transform:capitalize;color:var(--text-muted)">
          ${escHtml(alert.level || "—")}
        </span>
      </td>
      <td>${statusBadge}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${actions}
        </div>
      </td>
    </tr>
  `;
}

function buildStatusBadge(alert) {
  const st = alert.status;

  // Resolved / flagged are not clickable here
  if (alert.action === "resolved") {
    return `<span class="badge badge-resolved">🏁 Resolved</span>`;
  }
  if (alert.action === "flagged") {
    return `<span class="badge badge-flagged">🚩 Flagged</span>`;
  }

  // Pending → click to verify. Verified/assigned → click to unverify.
  const cls = `badge badge-${st} clickable`;
  let label = st;
  let tip   = "";
  if (st === "pending")  { label = "⏳ Pending";  tip = "Click to verify";  }
  if (st === "verified") { label = "✅ Verified"; tip = "Click to unverify"; }
  if (st === "assigned") { label = "🚑 Assigned"; tip = "Click to unverify"; }

  return `<span class="${cls}" data-id="${alert._id}" title="${tip}">${label}</span>`;
}

function buildActionButtons(alert) {
  if (alert.action === "resolved") {
    return `<button class="btn btn-undo" onclick="undoAction('${alert._id}')">↩ Undo</button>`;
  }
  if (alert.action === "flagged") {
    return `<button class="btn btn-undo" onclick="undoAction('${alert._id}')">↩ Undo</button>`;
  }
  return `
    <button class="btn btn-resolve" onclick="resolveAlert('${alert._id}')">✅ Resolve</button>
    <button class="btn btn-flag"    onclick="flagAlert('${alert._id}')">🚩 Flag</button>
  `;
}

// ─── VERIFY via badge click ────────────────────────────────────────────────
document.addEventListener("click", async (e) => {
  const badge = e.target.closest(".badge.clickable");
  if (!badge || !badge.dataset.id) return;

  const id       = badge.dataset.id;
  const alertObj = alertsData.find((a) => a._id === id);
  if (!alertObj) return;

  const st = alertObj.status;

  try {
    if (st === "pending") {
      const res  = await fetch(`${API_BASE}/alerts/verify/${id}`, { method: "PUT" });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || res.statusText);
      alertObj.status = "verified";
      if (data.alert) mergeAlertFromServer(data.alert);
      showToast("Alert verified ✅", "success");
    } else if (st === "verified" || st === "assigned") {
      const res  = await fetch(`${API_BASE}/alerts/unverify/${id}`, { method: "PUT" });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || res.statusText);
      alertObj.status = "pending";
      if (data.alert) mergeAlertFromServer(data.alert);
      showToast("Alert moved back to pending", "info");
    }
    renderAll();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Verification failed", "error");
  }
});

// ─── RESOLVE ──────────────────────────────────────────────────────────────
async function resolveAlert(id) {
  const alertObj = alertsData.find((a) => a._id === id);
  if (!alertObj || alertObj.action) return;
  try {
    const res  = await fetch(`${API_BASE}/alerts/resolve/${id}`, { method: "PUT" });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || res.statusText);
    if (data.alert) mergeAlertFromServer(data.alert);
    else { alertObj.caseResolved = 1; alertObj.status = "resolved"; alertObj.action = "resolved"; }
    renderAll();
    showToast("Alert resolved 🏁", "success");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Could not resolve alert", "error");
  }
}

// ─── FLAG ─────────────────────────────────────────────────────────────────
async function flagAlert(id) {
  const alertObj = alertsData.find((a) => a._id === id);
  if (!alertObj || alertObj.action) return;
  try {
    const res  = await fetch(`${API_BASE}/alerts/flag/${id}`, { method: "PUT" });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || res.statusText);
    if (data.alert) mergeAlertFromServer(data.alert);
    else { alertObj.isFalse = true; alertObj.action = "flagged"; alertObj.status = "pending"; }
    renderAll();
    showToast("Alert flagged as false 🚩", "warning");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Could not flag alert", "error");
  }
}

// ─── UNDO ─────────────────────────────────────────────────────────────────
async function undoAction(id) {
  const alertObj = alertsData.find((a) => a._id === id);
  if (!alertObj) return;
  try {
    const res  = await fetch(`${API_BASE}/alerts/reset/${id}`, { method: "PUT" });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || res.statusText);
    if (data.alert) mergeAlertFromServer(data.alert);
    else { alertObj.action = null; alertObj.caseResolved = 0; alertObj.isFalse = false; alertObj.status = "verified"; }
    renderAll();
    showToast("Action undone ↩", "info");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Could not undo action", "error");
  }
}

// ─── RESPONDER TABLE ──────────────────────────────────────────────────────
function renderResponderTable() {
  const tbody  = document.getElementById("responderTable");
  const empty  = document.getElementById("responderEmpty");

  // Show only verified/assigned alerts in responder panel
  const eligible = alertsData.filter(
    (a) => a.status === "verified" || a.status === "assigned"
  );

  tbody.innerHTML = "";

  if (eligible.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  eligible.forEach((alert, i) => {
    tbody.innerHTML += buildResponderRow(alert, i, eligible.length);
  });
}

function buildResponderRow(alert, i, total) {
  const altId = `ALT-${total - i}`;

  // ── Assigned responders chips ──
  let respondersHTML = `<span style="color:var(--text-muted);font-size:12px">None assigned yet</span>`;

  if (alert.assignedResponders.length > 0) {
    respondersHTML = `<div class="responder-chip-list">` +
      alert.assignedResponders.map((r) => {
        const sub_id    = r._id;
        const typeLabel = r.responderType || r.name || "Responder";
        const statusCls = `badge-${r.status || "assigned"}`;
        const statusLbl = (r.status || "assigned").replace(/_/g, " ");

        return `
          <div class="responder-chip">
            <div class="responder-chip-header">
              <span class="responder-name">${escHtml(typeLabel)}</span>
              <span class="badge ${statusCls}">${statusLbl}</span>
            </div>
            <div class="responder-actions">
              <button class="btn btn-sm btn-onway"
                onclick="updateResponderStatus('${alert._id}','${sub_id}','on_the_way')">
                🚗 On the way
              </button>
              <button class="btn btn-sm btn-reached"
                onclick="updateResponderStatus('${alert._id}','${sub_id}','reached')">
                📍 Reached
              </button>
              <button class="btn btn-sm btn-resolved-sm"
                onclick="updateResponderStatus('${alert._id}','${sub_id}','resolved')">
                ✅ Resolved
              </button>
            </div>
          </div>
        `;
      }).join("") +
    `</div>`;
  }

  // ── Assign dropdown ──
  const assignWrap = `
    <div class="assign-wrap">
      <select class="assign-select" id="responder-${alert._id}">
        <option value="Medical">🏥 Medical</option>
        <option value="Fire">🔥 Fire</option>
        <option value="Police">🚔 Police</option>
        <option value="Volunteer">🤝 Volunteer</option>
      </select>
      <button class="btn btn-assign" onclick="assignResponder('${alert._id}')">
        Assign
      </button>
    </div>
  `;

  return `
    <tr>
      <td><span style="font-family:monospace;font-size:12px;color:var(--text-muted)">${altId}</span></td>
      <td>${escHtml(alert.locationName || "—")}</td>
      <td>${escHtml(alert.disasterType || "—")}</td>
      <td>${respondersHTML}</td>
      <td>${assignWrap}</td>
    </tr>
  `;
}

// ─── ASSIGN RESPONDER ─────────────────────────────────────────────────────
async function assignResponder(id) {
  const select       = document.getElementById(`responder-${id}`);
  const responderType = select ? select.value : null;
  const alertObj     = alertsData.find((a) => a._id === id);
  if (!alertObj) return;

  // Client-side guard: must be verified or assigned
  if (alertObj.status === "pending") {
    showToast("Verify this alert before assigning responders.", "warning");
    return;
  }
  if (alertObj.status === "resolved" || alertObj.caseResolved === 1) {
    showToast("This alert is already resolved.", "warning");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/assign-responder`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ alertId: id, responderType })
    });

    const data = await parseJsonResponse(res);

    if (!res.ok) {
      // 409 = duplicate, give a friendly message
      const msg = res.status === 409
        ? `${responderType} is already actively assigned to this alert.`
        : data.error || res.statusText;
      showToast(msg, res.status === 409 ? "warning" : "error");
      return;
    }

    if (data.alert) mergeAlertFromServer(data.alert);
    renderAll();
    showToast(`${responderType} responder assigned 🚑`, "success");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Assignment failed", "error");
  }
}

// ─── UPDATE RESPONDER STATUS ───────────────────────────────────────────────
async function updateResponderStatus(alertId, assignmentId, status) {
  try {
    const res = await fetch(`${API_BASE}/update-responder-status`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ alertId, assignmentId, status })
    });

    const data = await parseJsonResponse(res);
    if (!res.ok) {
      showToast(data.error || res.statusText, "error");
      return;
    }

    if (data.alert) mergeAlertFromServer(data.alert);
    renderAll();

    const label = status.replace(/_/g, " ");
    showToast(`Responder status → ${label} ✅`, "success");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Status update failed", "error");
  }
}

// ─── LOADER HELPER ────────────────────────────────────────────────────────
function showLoader(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? "flex" : "none";
}

// ─── TOAST SYSTEM ─────────────────────────────────────────────────────────
const TOAST_ICONS = {
  success: "✅",
  error:   "❌",
  info:    "ℹ️",
  warning: "⚠️"
};

function showToast(msg, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const div = document.createElement("div");
  div.className = `toast toast-${type}`;
  div.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || "ℹ️"}</span>
    <span class="toast-msg">${escHtml(msg)}</span>
  `;
  container.appendChild(div);

  // Auto-remove after animation ends (~4 s)
  setTimeout(() => div.remove(), 4100);
}

// ─── UTILITY ──────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
