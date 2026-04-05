const alertService = require("../services/alertService");
const assignmentService = require("../services/assignmentService");

function handleError(res, err) {
  if (err instanceof alertService.HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: err.message || "Internal server error" });
}

// ================= CREATE ALERT =================
exports.createAlert = async (req, res) => {
  try {
    const alert = await alertService.createAlert(req.body);
    res.status(201).json({
      message: "Alert created successfully",
      alert
    });
  } catch (err) {
    handleError(res, err);
  }
};

// ================= GET ALL ALERTS (includes assignments) =================
exports.getAlerts = async (req, res) => {
  try {
    const alerts = await alertService.listAlerts();
    res.json(alerts);
  } catch (err) {
    handleError(res, err);
  }
};

// ================= RESOLVE ALERT (admin closes case) =================
exports.resolveAlert = async (req, res) => {
  try {
    const alert = await alertService.resolveAlert(req.params.id);
    res.json({ message: "Alert resolved", alert });
  } catch (err) {
    handleError(res, err);
  }
};

// ================= FLAG ALERT =================
exports.flagAlert = async (req, res) => {
  try {
    const alert = await alertService.flagAlert(req.params.id);
    res.json({ message: "Alert flagged", alert });
  } catch (err) {
    handleError(res, err);
  }
};

// ================= VERIFY / UNVERIFY =================
exports.verifyAlert = async (req, res) => {
  try {
    const alert = await alertService.verifyAlert(req.params.id);
    res.json({ message: "Verified", alert });
  } catch (err) {
    handleError(res, err);
  }
};

exports.unverifyAlert = async (req, res) => {
  try {
    const alert = await alertService.unverifyAlert(req.params.id);
    res.json({ message: "Unverified", alert });
  } catch (err) {
    handleError(res, err);
  }
};

// ================= RESET (undo resolve / flag) =================
exports.resetAlert = async (req, res) => {
  try {
    const alert = await alertService.resetAlert(req.params.id);
    res.json({ message: "Alert reset", alert });
  } catch (err) {
    handleError(res, err);
  }
};

/**
 * Legacy: PUT /api/alerts/assign/:id — same body as POST /api/assign-responder
 */
exports.assignResponderLegacy = async (req, res) => {
  try {
    const responderType =
      req.body.responderType || req.body.responder || req.body.type;
    const alert = await alertService.assignResponder(req.params.id, responderType);
    res.json({ message: "Responder assigned", alert });
  } catch (err) {
    handleError(res, err);
  }
};

/**
 * Legacy: PUT /api/alerts/response-status/:id
 */
exports.updateResponseStatusLegacy = async (req, res) => {
  try {
    const { assignmentId, status, responderName } = req.body;

    if (assignmentId) {
      const alert = await alertService.updateAssignmentStatus(
        req.params.id,
        assignmentId,
        status
      );
      return res.json({ message: "Status updated", alert });
    }

    // Fallback: match by responder name/type (older clients)
    const alertDoc = await require("../models/Alert").findById(req.params.id);
    if (!alertDoc) {
      return res.status(404).json({ error: "Alert not found" });
    }
    const sub = (alertDoc.assignedResponders || []).find(
      (r) =>
        (r.responderType || r.name || "").toString() ===
        (responderName || "").toString()
    );
    if (!sub) {
      return res.status(404).json({ error: "Responder assignment not found" });
    }
    const alert = await alertService.updateAssignmentStatus(
      req.params.id,
      sub._id.toString(),
      status
    );
    res.json({ message: "Status updated", alert });
  } catch (err) {
    handleError(res, err);
  }
};

// ================= FILTER BY STATUS =================
/**
 * GET /api/alerts/status/:status
 * Returns alerts filtered by: pending | verified | assigned | resolved
 */
exports.getAlertsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const allowed = ["pending", "verified", "assigned", "resolved"];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: "status must be one of: " + allowed.join(", ")
      });
    }
    const alerts = await assignmentService.getAlertsByStatus(status);
    res.json(alerts);
  } catch (err) {
    handleError(res, err);
  }
};

// ================= STATS =================
/**
 * GET /api/alerts/stats
 * Returns count per status bucket for admin dashboard
 */
exports.getAlertStats = async (req, res) => {
  try {
    const stats = await assignmentService.getAlertStats();
    res.json(stats);
  } catch (err) {
    handleError(res, err);
  }
};

