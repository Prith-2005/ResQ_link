require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const connectDB = require("./config/db");

const app = express();

// ================= DB =================
connectDB();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// ================= ROUTES =================
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/alerts", require("./routes/alertRoutes"));
app.use("/api/contact", require("./routes/contactRoutes"));
app.use("/api", require("./routes/assignmentRoutes"));

// ================= 404 HANDLER =================
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ================= GLOBAL ERROR HANDLER =================
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[ERROR]", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || "Internal server error"
  });
});

// ================= START =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 ResQLink server running on http://localhost:${PORT}`);
});