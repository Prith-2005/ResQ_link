const Contact = require("../models/Contact");

// GET ALL CONTACTS FOR A USER
exports.getContacts = async (req, res) => {
    try {
        const { userName } = req.query;
        if (!userName) return res.status(400).json({ error: "userName required" });

        const contacts = await Contact.find({ userName }).sort({ createdAt: -1 });
        res.json(contacts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ADD A NEW CONTACT
exports.addContact = async (req, res) => {
    try {
        const { userName, name, number, relation } = req.body;
        if (!userName || !name || !number) {
            return res.status(400).json({ error: "userName, name and number are required" });
        }

        const contact = new Contact({ userName, name, number, relation: relation || "Contact" });
        await contact.save();
        res.json({ message: "Contact added", contact });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE A CONTACT BY ID
exports.deleteContact = async (req, res) => {
    try {
        const { id } = req.params;
        await Contact.findByIdAndDelete(id);
        res.json({ message: "Contact deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// LEGACY: single contact get (backwards compat for old script.js)
exports.getContact = async (req, res) => {
    try {
        const contact = await Contact.findOne();
        res.json(contact);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// LEGACY: upsert single contact
exports.saveContact = async (req, res) => {
    try {
        const { name, number } = req.body;
        let contact = await Contact.findOne({ userName: "default" });
        if (contact) {
            contact.name = name;
            contact.number = number;
        } else {
            contact = new Contact({ userName: "default", name, number });
        }
        await contact.save();
        res.json({ message: "Contact saved successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};