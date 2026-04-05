const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/assignmentController");

// Mounted under /api — see server.js
router.post("/assign-responder", assignmentController.assignResponder);
router.patch("/update-responder-status", assignmentController.updateResponderStatus);

module.exports = router;
