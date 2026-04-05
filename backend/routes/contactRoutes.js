const express = require("express");
const router = express.Router();

const {
    getContacts,
    addContact,
    deleteContact,
    getContact,
    saveContact
} = require("../controllers/contactController");

// Multi-contact routes (user-scoped)
router.get("/all", getContacts);          // GET /api/contact/all?userName=John
router.post("/add", addContact);          // POST /api/contact/add
router.delete("/:id", deleteContact);     // DELETE /api/contact/:id

// Legacy routes (backwards compat)
router.post("/", saveContact);
router.get("/", getContact);

module.exports = router;