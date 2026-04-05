/* ===============================================================
   ResQLink — emgCont.js
   Emergency contacts setup: add, delete, and list contacts
   =============================================================== */

const API = "http://localhost:5000";
let currentUser = null;

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  currentUser = JSON.parse(localStorage.getItem("resqlink_user"));
  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  loadContacts();
});

// ─── HELPERS ─────────────────────────────────────────────────
function showEl(id)  { const e = document.getElementById(id); if (e) e.style.display = ""; }
function hideEl(id)  { const e = document.getElementById(id); if (e) e.style.display = "none"; }
function setText(id, val) { const e = document.getElementById(id); if (e) e.innerText = val; }

// ─── TOAST ───────────────────────────────────────────────────
function toast(msg, type = "success") {
  const wrap = document.getElementById("toastContainer");
  if (!wrap) return;

  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span>
    <span class="toast-msg">${msg}</span>
  `;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ─── LOAD CONTACTS ───────────────────────────────────────────
async function loadContacts() {
  if (!currentUser) return;

  showEl("loadingState");
  hideEl("emptyState");
  const list = document.getElementById("contactsList");
  if (list) list.innerHTML = "";

  try {
    const res = await fetch(`${API}/api/contact/all?userName=${encodeURIComponent(currentUser.name)}`);
    const data = await res.json();

    hideEl("loadingState");
    setText("contactCount", data.length);

    if (!data.length) {
      showEl("emptyState");
      return;
    }

    data.forEach(c => {
      const initials = c.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      const chip = `
        <div class="contact-chip">
          <div class="contact-avatar">${initials}</div>
          <div class="contact-info">
            <div class="contact-name">${c.name}</div>
            <div class="contact-number">${c.number}</div>
          </div>
          <span class="contact-relation">${c.relation || "Contact"}</span>
          <button class="del-btn" onclick="deleteContact('${c._id}')" title="Remove">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `;
      if (list) list.insertAdjacentHTML("beforeend", chip);
    });

  } catch (err) {
    console.error("loadContacts error:", err);
    hideEl("loadingState");
    toast("Failed to load contacts", "error");
  }
}

// ─── ADD CONTACT ─────────────────────────────────────────────
async function addContact() {
  const name     = document.getElementById("newName")?.value.trim();
  const number   = document.getElementById("newNumber")?.value.trim();
  const relation = document.getElementById("newRelation")?.value.trim();

  if (!name || !number) {
    toast("Name and number are required", "error");
    return;
  }

  const btn = document.getElementById("addBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;
  }

  try {
    const res = await fetch(`${API}/api/contact/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName: currentUser.name, name, number, relation })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to add contact");

    // Clear inputs
    ["newName","newNumber","newRelation"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    toast(`✅ ${name} added successfully`);
    await loadContacts();

  } catch (err) {
    toast(err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-plus-circle"></i> Save Contact`;
    }
  }
}

// ─── DELETE CONTACT ──────────────────────────────────────────
async function deleteContact(id) {
  if (!confirm("Are you sure you want to remove this contact?")) return;

  try {
    const res = await fetch(`${API}/api/contact/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");

    toast("Contact removed");
    await loadContacts();

  } catch (err) {
    toast(err.message, "error");
  }
}

// ─── BACK BUTTON ─────────────────────────────────────────────
function goBack() {
  window.location.href = "user.html";
}