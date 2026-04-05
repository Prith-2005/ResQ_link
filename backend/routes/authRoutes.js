const express = require("express");
const router = express.Router();

const { registerUser, loginUser, verifyUser } = require("../controllers/authController");

router.post("/register", registerUser);
router.post("/login", loginUser);

// 🔥 THIS LINE MUST BE PRESENT
router.post("/verify", verifyUser);

module.exports = router;