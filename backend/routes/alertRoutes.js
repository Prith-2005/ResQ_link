const express = require("express");
const router = express.Router();

const {
  createAlert,
  getAlerts,
  resolveAlert,
  flagAlert,
  verifyAlert,
  unverifyAlert,
  resetAlert,
  assignResponderLegacy,
  updateResponseStatusLegacy,
  getAlertsByStatus,
  getAlertStats
} = require("../controllers/alertController");

router.post("/", createAlert);
router.get("/", getAlerts);

// ─── Stats (must come before /:id style routes) ───────────────────────────
router.get("/stats", getAlertStats);

// ─── Filter by status ────────────────────────────────────────────────────
router.get("/status/:status", getAlertsByStatus);

// ─── Alert lifecycle ─────────────────────────────────────────────────────
router.put("/resolve/:id", resolveAlert);
router.put("/flag/:id", flagAlert);
router.put("/verify/:id", verifyAlert);
router.put("/unverify/:id", unverifyAlert);
router.put("/reset/:id", resetAlert);

// ─── Backward-compatible assignment endpoints (older frontend paths) ──────
router.put("/assign/:id", assignResponderLegacy);
router.put("/response-status/:id", updateResponseStatusLegacy);

module.exports = router;

