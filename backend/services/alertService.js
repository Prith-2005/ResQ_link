const mongoose = require("mongoose");
const Alert = require("../models/Alert");

const RESPONDER_STATUSES = ["assigned", "on_the_way", "reached", "resolved"];
const STATUS_ORDER = { assigned: 0, on_the_way: 1, reached: 2, resolved: 3 };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Normalize dropdown / legacy labels to canonical responder type.
 */
function normalizeResponderType(input) {
  if (input == null || input === "") return null;
  let t = String(input).trim();
  if (t.endsWith(":")) t = t.replace(/:\s*$/, "").trim();
  if (t === "Volunteers") return "Volunteer";
  return t;
}

/**
 * Map legacy UI strings ("On The Way") to enum values.
 */
function normalizeIncomingResponderStatus(input) {
  if (input == null) return null;
  const raw = String(input).trim().toLowerCase().replace(/\s+/g, "_");
  if (raw === "on_the_way" || raw.includes("way")) return "on_the_way";
  if (raw === "reached") return "reached";
  if (raw === "resolved") return "resolved";
  if (raw === "assigned") return "assigned";
  return null;
}

function effectiveResponderType(doc) {
  return (doc.responderType || doc.name || "").trim();
}

/**
 * API shape: unify legacy `unverified` → `pending`, fix responder fields.
 */
function serializeAlert(alertDoc) {
  const o = alertDoc.toObject ? alertDoc.toObject({ virtuals: true }) : { ...alertDoc };
  let status = o.status;
  if (status === "unverified") status = "pending";

  const assignedResponders = (o.assignedResponders || []).map((r) => ({
    _id: r._id,
    responderType: effectiveResponderType(r),
    status: r.status || "assigned",
    assignedAt: r.assignedAt || o.createdAt,
    updatedAt: r.updatedAt || r.assignedAt || o.createdAt
  }));

  return { ...o, status, assignedResponders };
}

function assertValidObjectId(id) {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, "Invalid alert id");
  }
}

async function listAlerts() {
  const rows = await Alert.find().sort({ createdAt: -1 });
  return rows.map(serializeAlert);
}

async function createAlert(payload) {
  const alert = new Alert({
    ...payload,
    status: "pending",
    caseResolved: 0,
    isFalse: false
  });
  await alert.save();
  return serializeAlert(alert);
}

async function resolveAlert(id) {
  assertValidObjectId(id);
  const updated = await Alert.findByIdAndUpdate(
    id,
    {
      status: "resolved",
      caseResolved: 1,
      isFalse: false
    },
    { new: true }
  );
  if (!updated) throw new HttpError(404, "Alert not found");
  return serializeAlert(updated);
}

async function flagAlert(id) {
  assertValidObjectId(id);
  const updated = await Alert.findByIdAndUpdate(
    id,
    {
      isFalse: true,
      status: "pending"
    },
    { new: true }
  );
  if (!updated) throw new HttpError(404, "Alert not found");
  return serializeAlert(updated);
}

async function verifyAlert(id) {
  assertValidObjectId(id);
  const updated = await Alert.findByIdAndUpdate(
    id,
    { status: "verified" },
    { new: true }
  );
  if (!updated) throw new HttpError(404, "Alert not found");
  return serializeAlert(updated);
}

async function unverifyAlert(id) {
  assertValidObjectId(id);
  const updated = await Alert.findByIdAndUpdate(
    id,
    { status: "pending" },
    { new: true }
  );
  if (!updated) throw new HttpError(404, "Alert not found");
  return serializeAlert(updated);
}

/**
 * Undo resolve / flag from admin UI: clear flags; restore a sensible workflow status.
 */
async function resetAlert(id) {
  assertValidObjectId(id);
  const alert = await Alert.findById(id);
  if (!alert) throw new HttpError(404, "Alert not found");

  const wasResolved = alert.caseResolved === 1 || alert.status === "resolved";
  const wasFlagged = alert.isFalse === true;

  const updates = { caseResolved: 0, isFalse: false };

  if (wasResolved) {
    updates.status =
      alert.assignedResponders && alert.assignedResponders.length > 0
        ? "assigned"
        : "verified";
  } else if (wasFlagged) {
    updates.status = "pending";
  } else {
    updates.status =
      alert.status === "unverified" ? "pending" : alert.status;
  }

  const updated = await Alert.findByIdAndUpdate(id, updates, { new: true });
  return serializeAlert(updated);
}

/**
 * Assign a responder team to a verified alert. Supports multiple types per alert.
 * Blocks duplicate active assignment for the same responderType.
 */
async function assignResponder(alertId, responderTypeRaw) {
  assertValidObjectId(alertId);
  const responderType = normalizeResponderType(responderTypeRaw);
  if (!responderType) {
    throw new HttpError(400, "responderType is required (Medical, Fire, Police, Volunteer)");
  }

  const alert = await Alert.findById(alertId);
  if (!alert) throw new HttpError(404, "Alert not found");

  let workflowStatus = alert.status;
  if (workflowStatus === "unverified") workflowStatus = "pending";

  if (workflowStatus === "resolved" || alert.caseResolved === 1) {
    throw new HttpError(400, "Cannot assign on a resolved alert");
  }

  if (workflowStatus !== "verified" && workflowStatus !== "assigned") {
    throw new HttpError(
      400,
      "Alert must be verified before assignment (current status: " + workflowStatus + ")"
    );
  }

  const existing = alert.assignedResponders || [];
  const duplicate = existing.some(
    (r) =>
      effectiveResponderType(r) === responderType &&
      r.status !== "resolved"
  );
  if (duplicate) {
    throw new HttpError(409, "This responder type is already assigned (active) on this alert");
  }

  const now = new Date();
  existing.push({
    responderType,
    name: responderType,
    status: "assigned",
    assignedAt: now,
    updatedAt: now
  });
  alert.assignedResponders = existing;
  alert.status = "assigned";
  await alert.save();

  return serializeAlert(alert);
}

function assertTransition(from, to) {
  const i = STATUS_ORDER[from] ?? 0;
  const j = STATUS_ORDER[to];
  if (j === undefined) return;
  // Allow forward progression or jump straight to resolved (closure).
  if (to === "resolved") return;
  if (j < i) {
    throw new HttpError(400, `Invalid status transition: ${from} → ${to}`);
  }
}

/**
 * Update one assignment by subdocument id (from GET /api/alerts).
 */
async function updateAssignmentStatus(alertId, assignmentId, newStatusRaw) {
  assertValidObjectId(alertId);
  assertValidObjectId(assignmentId);

  const normalized = normalizeIncomingResponderStatus(newStatusRaw) || newStatusRaw;
  if (!RESPONDER_STATUSES.includes(normalized)) {
    throw new HttpError(
      400,
      "status must be one of: " + RESPONDER_STATUSES.join(", ")
    );
  }

  const alert = await Alert.findById(alertId);
  if (!alert) throw new HttpError(404, "Alert not found");

  const sub = (alert.assignedResponders || []).find(
    (r) => r._id.toString() === assignmentId
  );
  if (!sub) throw new HttpError(404, "Assignment not found on this alert");

  assertTransition(sub.status, normalized);

  sub.status = normalized;
  sub.updatedAt = new Date();

  const allResolved =
    alert.assignedResponders.length > 0 &&
    alert.assignedResponders.every((r) => r.status === "resolved");

  if (allResolved) {
    alert.status = "resolved";
    alert.caseResolved = 1;
  }

  await alert.save();
  return serializeAlert(alert);
}

module.exports = {
  HttpError,
  listAlerts,
  createAlert,
  resolveAlert,
  flagAlert,
  verifyAlert,
  unverifyAlert,
  resetAlert,
  assignResponder,
  updateAssignmentStatus,
  serializeAlert,
  normalizeResponderType,
  RESPONDER_STATUSES
};
