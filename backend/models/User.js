const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullName: String,

  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: String,

  role: {
    type: String,
    enum: ["victim", "responder", "admin"],
    default: "victim",
  },

  isVerified: { type: Boolean, default: false },
  otp: String
});

module.exports = mongoose.model("User", userSchema);