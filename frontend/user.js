/* ===============================================================
   ResQLink — user.js
   User dashboard: profile, alerts, emergency contacts, settings
   =============================================================== */

const API = "http://localhost:5000";
let currentUser = null;
let allAlerts   = [];
let activeFilter = "all";
let isLoading   = false;

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  currentUser = JSON.parse(localStorage.getItem("resqlink_user"));
  if (!currentUser) { window.location.href = "login.html"; return; }

  // Fill profile
  const initials = currentUser.name
    ? currentUser.name.split(" ").map(w => w[0]).join("").toUpperCase()
    : "U";

  setText("userName",   currentUser.name || "User");
  setText("userDetails",`📍 ${currentUser.location || "Unknown"} · Member since ${currentUser.memberSince || "N/A"}`);
  setText("avatar",     initials);
  setText("sideAvatar", initials);
  setText("sideName",   currentUser.name || "User");
  setText("sideRole",   currentUser.role || "Member");

  setText("editName",     currentUser.name     || "", "value");
  setText("editLocation", currentUser.location  || "", "value");
  setText("editSince",    currentUser.memberSince || "", "value");

  // Filter tabs wiring
  document.querySelectorAll(".filter-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      renderAlerts();
    });
  });

  loadAlerts();
  loadContacts(); // ✅ Added: Load counts immediately on start
  setInterval(loadAlerts, 5000);
});

// ─── HELPERS ─────────────────────────────────────────────────
function setText(id, val, prop = "innerText") {
  const el = document.getElementById(id);
  if (el) el[prop] = val;
}

function showEl(id)  { const e = document.getElementById(id); if (e) e.style.display = ""; }
function hideEl(id)  { const e = document.getElementById(id); if (e) e.style.display = "none"; }

// ─── TOAST ───────────────────────────────────────────────────
function toast(msg, type = "info") {
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const wrap  = document.getElementById("toastContainer");
  const t     = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

// ─── SECTION SWITCHING ────────────────────────────────────────
function showSection(section, navEl) {
  ["profileSection", "contactsSection", "settingsSection"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === section + "Section") ? "block" : "none";
  });

  document.querySelectorAll(".side-item").forEach(el => el.classList.remove("active"));
  if (navEl) navEl.classList.add("active");

  if (section === "contacts") loadContacts();
}

// ─── LOAD ALERTS ─────────────────────────────────────────────
async function loadAlerts() {
  if (isLoading) return;
  isLoading = true;

  try {
    const res    = await fetch(`${API}/api/alerts`);
    const alerts = await res.json();

    allAlerts = alerts.filter(a => a.name === currentUser.name);

    // Stats
    let sos = 0, report = 0, resolved = 0;
    allAlerts.forEach(a => {
      if (a.reportType === "SOS")    sos++;
      if (a.reportType === "REPORT") report++;
      if (a.caseResolved === 1 || a.resolved === 1) resolved++;
    });

    setText("sosCount",      sos);
    setText("distressCount", report);
    setText("resolvedCount", resolved);

    // Trust score
    let score = 0;
    allAlerts.forEach(a => {
      if (a.caseResolved === 1 || a.resolved === 1) score += 10;
      if (a.isFalse === true) score -= 15;
    });
    score = Math.max(0, Math.min(100, score));
    setText("trustLabel", score + "%");
    setRing("trustCircle", score);

    renderAlerts();
    hideEl("alertLoader");

  } catch (err) {
    console.error("loadAlerts error:", err);
  }

  isLoading = false;
}

// ─── RENDER ALERTS ────────────────────────────────────────────
function renderAlerts() {
  const filtered = activeFilter === "all"
    ? allAlerts
    : allAlerts.filter(a => a.reportType === activeFilter);

  const tbody = document.getElementById("historyTable");
  const empty = document.getElementById("alertEmpty");

  if (!tbody) return;
  tbody.innerHTML = "";

  if (filtered.length === 0) {
    if (empty) empty.style.display = "";
    return;
  }

  if (empty) empty.style.display = "none";

  filtered.forEach(a => {
    tbody.insertAdjacentHTML("beforeend", buildRow(a));
  });
}

function buildRow(alert) {
  const typeBadge = alert.reportType === "SOS"
    ? `<span class="badge badge-sos">🚨 SOS</span>`
    : `<span class="badge badge-report">📋 REPORT</span>`;

  const STATUS_MAP = {
    pending:  "badge-pending",
    verified: "badge-verified",
    assigned: "badge-assigned",
    resolved: "badge-resolved",
    flagged:  "badge-flagged"
  };

  const st     = alert.status === "unverified" ? "pending" : (alert.status || "pending");
  const cls    = STATUS_MAP[st] || "badge-pending";
  const statusB = `<span class="badge ${cls}">${st}</span>`;

  let respInfo = "";
  if (alert.assignedResponders?.length > 0) {
    const types = alert.assignedResponders.map(r => r.responderType || r.name || "Responder").join(", ");
    respInfo = `<div style="font-size:11px;color:#8b5cf6;margin-top:3px">🚑 ${types}</div>`;
  }

  const DISASTER_ICONS = {
    Flood: "🌊", Fire: "🔥", Earthquake: "🌍",
    Accident: "🚗", Landslide: "⛰️", Cyclone: "🌀"
  };
  const icon = DISASTER_ICONS[alert.disasterType] || "⚠️";

  return `
    <tr>
      <td>${new Date(alert.createdAt).toLocaleDateString()}</td>
      <td>${typeBadge}</td>
      <td>${icon} ${alert.disasterType || "—"}</td>
      <td>${alert.locationName || "—"}</td>
      <td style="text-transform:capitalize">${alert.level || "—"}</td>
      <td>${statusB}${respInfo}</td>
    </tr>
  `;
}

// ─── TRUST RING ───────────────────────────────────────────────
function setRing(id, percent) {
  const circle = document.getElementById(id);
  if (!circle) return;
  const r = 65;
  const circ = 2 * Math.PI * r;
  circle.style.strokeDashoffset = circ - (percent / 100) * circ;
}

// ─── EMERGENCY CONTACTS ───────────────────────────────────────
async function loadContacts() {
  if (!currentUser) return;

  showEl("contactsLoader");
  hideEl("contactsEmpty");
  const list = document.getElementById("contactsList");
  if (list) list.innerHTML = "";

  try {
    const res  = await fetch(`${API}/api/contact/all?userName=${encodeURIComponent(currentUser.name)}`);
    const data = await res.json();

    hideEl("contactsLoader");

    // Update count in stats
    setText("contactCount", data.length);

    if (!data.length) { showEl("contactsEmpty"); return; }

    data.forEach(c => {
      const initials = c.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      const chip = `
        <div class="contact-chip" id="chip-${c._id}">
          <div class="contact-avatar">${initials}</div>
          <div class="contact-info">
            <div class="contact-name">${c.name}</div>
            <div class="contact-number">${c.number}</div>
          </div>
          <span class="contact-relation">${c.relation || "Contact"}</span>
          <button class="btn btn-delete" onclick="deleteContact('${c._id}')">
            <i class="fas fa-trash-alt"></i> Remove
          </button>
        </div>
      `;
      if (list) list.insertAdjacentHTML("beforeend", chip);
    });

  } catch (err) {
    console.error("loadContacts error:", err);
    hideEl("contactsLoader");
    toast("Failed to load contacts", "error");
  }
}

async function addContact() {
  const name     = document.getElementById("newContactName")?.value.trim();
  const number   = document.getElementById("newContactNumber")?.value.trim();
  const relation = document.getElementById("newContactRelation")?.value.trim();

  if (!name || !number) {
    toast("Name and number are required", "error");
    return;
  }

  const btn = document.getElementById("addContactBtn");
  if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Adding…`; }

  try {
    const res = await fetch(`${API}/api/contact/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName: currentUser.name, name, number, relation })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");

    // Clear inputs
    ["newContactName","newContactNumber","newContactRelation"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    toast(`✅ ${name} added as emergency contact`, "success");
    await loadContacts();

  } catch (err) {
    toast(err.message, "error");
  }

  if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-plus"></i> Add`; }
}

async function deleteContact(id) {
  if (!confirm("Remove this emergency contact?")) return;

  try {
    const res = await fetch(`${API}/api/contact/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");

    toast("Contact removed", "info");
    await loadContacts();

  } catch (err) {
    toast(err.message, "error");
  }
}

// ─── SETTINGS / PROFILE SAVE ──────────────────────────────────
function saveProfile() {
  const updated = {
    ...currentUser,
    name:        document.getElementById("editName")?.value || currentUser.name,
    location:    document.getElementById("editLocation")?.value || currentUser.location,
    memberSince: document.getElementById("editSince")?.value || currentUser.memberSince
  };

  localStorage.setItem("resqlink_user", JSON.stringify(updated));
  currentUser = updated;

  // Re-fill header
  const initials = updated.name.split(" ").map(w => w[0]).join("").toUpperCase();
  setText("userName",   updated.name);
  setText("userDetails",`📍 ${updated.location || "Unknown"} · Member since ${updated.memberSince || "N/A"}`);
  setText("avatar",     initials);
  setText("sideAvatar", initials);
  setText("sideName",   updated.name);

  toast("Profile saved ✅", "success");
  showSection("profile", document.getElementById("nav-profile"));
}

// ─── LOGOUT ───────────────────────────────────────────────────
function logout() {
  localStorage.removeItem("resqlink_user");
  window.location.href = "login.html";
}