// server.js
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import authRoutes from "./src/routes/auth.routes.js";
import adminRoutes from "./src/routes/admin.routes.js";
import publicRoutes from "./src/routes/publicRoutes.js";
import eventRoutes from "./src/routes/eventRoutes.js";
import bazaarRoutes from "./src/routes/bazaarRoutes.js";
import conferenceRoutes from "./src/routes/conferenceRoutes.js";
import tripRoutes from "./src/routes/tripRoutes.js";
import workshopRoutes from "./src/routes/workshopRoutes.js";
import workshopRequestsRoutes from "./src/routes/workshopRequestsRoutes.js";
import sportsRoutes from "./src/routes/sportsRoutes.js";
import eventApplicationRoutes from "./src/routes/eventApplicationRoutes.js";
import boothNumberRoutes from "./src/routes/boothNumberRoutes.js";
import eventRegisterRoutes from "./src/routes/eventRegisterRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/* ------------ CORS (robust, non-throwing) ------------ */
const normalize = (u) => String(u || "").replace(/\/+$/, "");

const envOrigins =
  (process.env.CLIENT_URLS || process.env.CLIENT_URL || "")
    .split(",")
    .map(s => normalize(s.trim()))
    .filter(Boolean);

const devOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://0.0.0.0:3000",
].map(normalize);

const ALLOWED = new Set([...envOrigins, ...devOrigins]);

const corsOptions = {
  origin(origin, cb) {
    // Allow same-origin / tools with no Origin header
    if (!origin) return cb(null, true);
    if (ALLOWED.has(normalize(origin))) return cb(null, true);
    // Do NOT throw—just block by returning false
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.set("trust proxy", 1);
app.use(cors(corsOptions));
// Express 5 doesn’t accept "*" in app.options; use a regex to match all.
app.options(/.*/, cors(corsOptions));

/* ------------ Body/Cookies ------------ */
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

/* ------------ Basic routes ------------ */
app.get("/", (_req, res) => res.send("API is running..."));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* ------------ API routes ------------ */
app.use("/api/auth", authRoutes);          // register/login/logout/verify/me
app.use("/api/admin", adminRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/event", eventRoutes);
app.use("/api/bazaar", bazaarRoutes);
app.use("/api/conference", conferenceRoutes);
app.use("/api/trip", tripRoutes);
app.use("/api/workshop", workshopRoutes);
app.use("/api/workshopRequests", workshopRequestsRoutes);
app.use("/api/sports", sportsRoutes);
app.use("/api/application", eventApplicationRoutes);
app.use("/api/event-registers", eventRegisterRoutes);

// Booths router (compat mounts)
app.use("/api/booths", boothNumberRoutes);
app.use("/api/booth", boothNumberRoutes);

/* ------------ 404 + Error handlers (last) ------------ */
app.use((req, res, _next) => {
  res.status(404).json({ message: "Not found", path: req.originalUrl });
});

app.use((err, _req, res, _next) => {
  console.error("[server] Unhandled error:", err?.stack || err);
  res.status(500).json({ message: err?.message || "Server error" });
});

/* ------------ DB connect + optional SMTP verify + start ------------ */
(async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.warn("[server] MONGO_URI is not set");
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("Mongo connection error:", err.message);
  }

  try {
    const mailMod = await import("./src/utils/sendEmail.js");
    if (typeof mailMod.verifySmtp === "function") {
      await mailMod.verifySmtp();
    }
  } catch (err) {
    console.warn("[mail] SMTP verification skipped:", err.message);
  }

  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();

export default app;
