const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
    userName: { type: String, required: true },
    name:     { type: String, required: true },
    number:   { type: String, required: true },
    relation: { type: String, default: "Contact" },
    createdAt:{ type: Date, default: Date.now }
});

module.exports = mongoose.model("Contact", contactSchema);