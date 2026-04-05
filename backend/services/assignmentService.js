/**
 * assignmentService.js
 *
 * Dedicated service for responder assignment queries.
 * Assignment mutations live in alertService.js to keep the
 * Alert model as the single source of truth.
 */

const Alert = require("../models/Alert");
const { HttpError, serializeAlert } = require("./alertService");

/**
 * Return all alerts that are in "verified" or "assigned" state.
 * Used by the admin Responder Management panel so only actionable
 * alerts appear there.
 */
async function getAssignableAlerts() {
  const rows = await Alert.find({
    status: { $in: ["verified", "assigned"] }
  }).sort({ createdAt: -1 });

  return rows.map(serializeAlert);
}

/**
 * Return alerts filtered by status.
 * Normalises legacy "unverified" → "pending" before querying.
 *
 * @param {string} status  One of: pending | verified | assigned | resolved
 */
async function getAlertsByStatus(status) {
  // Map the public-facing "pending" to include legacy "unverified" docs
  const query =
    status === "pending"
      ? { status: { $in: ["pending", "unverified"] } }
      : { status };

  const rows = await Alert.find(query).sort({ createdAt: -1 });
  return rows.map(serializeAlert);
}

/**
 * Return summary counts per status bucket.
 * Used by the admin stats cards.
 */
async function getAlertStats() {
  const all = await Alert.find();
  const stats = {
    total: all.length,
    pending: 0,
    verified: 0,
    assigned: 0,
    resolved: 0,
    flagged: 0
  };

  for (const a of all) {
    const st = a.status === "unverified" ? "pending" : a.status;
    if (stats[st] !== undefined) stats[st]++;
    if (a.isFalse === true) stats.flagged++;
  }

  return stats;
}

module.exports = {
  getAssignableAlerts,
  getAlertsByStatus,
  getAlertStats
};
