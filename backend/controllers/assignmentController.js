const alertService = require("../services/alertService");

function handleError(res, err) {
  if (err instanceof alertService.HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: err.message || "Internal server error" });
}

/**
 * POST /api/assign-responder
 * Body: { alertId, responderType }
 */
exports.assignResponder = async (req, res) => {
  try {
    const { alertId, responderType } = req.body;
    const type = responderType || req.body.type;
    if (!alertId) {
      return res.status(400).json({ error: "alertId is required" });
    }
    const alert = await alertService.assignResponder(alertId, type);
    res.status(200).json({
      message: "Responder assigned",
      alert
    });
  } catch (err) {
    handleError(res, err);
  }
};

/**
 * PATCH /api/update-responder-status
 * Body: { alertId, assignmentId, status }
 */
exports.updateResponderStatus = async (req, res) => {
  try {
    const { alertId, assignmentId, status } = req.body;
    if (!alertId || !assignmentId || !status) {
      return res
        .status(400)
        .json({ error: "alertId, assignmentId, and status are required" });
    }
    const alert = await alertService.updateAssignmentStatus(
      alertId,
      assignmentId,
      status
    );
    res.json({ message: "Responder status updated", alert });
  } catch (err) {
    handleError(res, err);
  }
};
