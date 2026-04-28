// server/src/routes/eventRoutes.js
import express from "express";
import {
  getAllEvents,
  deleteEvent,
  getEventById,
  createEvent,
} from "../controllers/eventController.js";
import { getParticipatingVendorsByEventId } from "../controllers/applicationParticipants.controller.js";

const router = express.Router();

router.get("/", getAllEvents);
router.post("/", createEvent);                 // ← NEW: create
router.get("/:id", getEventById);
router.delete("/:id", deleteEvent);

// accepted vendors’ names for an event
router.get("/:eventId/participants", getParticipatingVendorsByEventId);

export default router;
