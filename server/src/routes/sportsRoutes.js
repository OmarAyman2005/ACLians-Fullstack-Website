// server/src/routes/sportsRoutes.js
console.log("[sports.routes] loaded");

import { Router } from "express";
import {
  listCourts,
  courtAvailability,
  listGymSessions,
  createGymSession,
} from "../controllers/sports.controller.js";

const router = Router();

// simple health check for this group
router.get("/_ping", (_req, res) => res.json({ ok: true }));

// Courts
router.get("/courts", listCourts);
router.get("/courts/:id/availability", courtAvailability);

// Gym sessions
router.get("/gym/sessions", listGymSessions);
router.post("/gym/sessions", createGymSession);

export default router;
