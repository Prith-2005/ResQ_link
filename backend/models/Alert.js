const mongoose = require("mongoose");

/**
 * One responder slot on an alert (multiple allowed — e.g. Medical + Fire).
 * Legacy docs may only have `name`; new writes use `responderType` + timestamps.
 */
const assignedResponderSchema = new mongoose.Schema(
  {
    responderType: { type: String, default: "" },
    /** @deprecated use responderType; kept for existing MongoDB documents */
    name: { type: String, default: "" },
    status: {
      type: String,
      enum: ["assigned", "on_the_way", "reached", "resolved"],
      default: "assigned"
    },
    assignedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const alertSchema = new mongoose.Schema({
  name: String,

  userEmail: {
    type: String,
    required: true
  },

  reportType: String,
  disasterType: String,
  locationName: String,
  level: String,

  coordinates: {
    lat: Number,
    lng: Number
  },

  /**
   * pending: new report (legacy DB may still say "unverified")
   * verified: admin approved
   * assigned: at least one responder assigned
   * resolved: incident closed
   */
  status: {
    type: String,
    enum: ["pending", "verified", "assigned", "resolved", "unverified"],
    default: "pending"
  },

  caseResolved: {
    type: Number,
    default: 0
  },

  isFalse: {
    type: Boolean,
    default: false
  },

  assignedResponders: [assignedResponderSchema],

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Alert", alertSchema);
