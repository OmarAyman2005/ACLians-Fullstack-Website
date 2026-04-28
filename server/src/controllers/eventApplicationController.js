// server/controllers/application.controller.js
import mongoose from "mongoose";
import BoothNumber from "../models/BoothNumber.js";
import { EventApplication } from "../models/EventApplication.js";
import { Event } from "../models/Event.js";
import User from "../models/User.js";
import {
  createEventApplicationSchema,
  updateEventApplicationSchema,
} from "../validators/eventApplicationValidation.js";
import { boothReserveSchema } from "../validators/boothNumberValidation.js";

/* -----------------------------------------------------------
 * GET /api/application/:id
 * --------------------------------------------------------- */
export const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: "error", message: "Invalid application id" });
    }

    const hasRef =
      EventApplication.schema.path("eventId")?.options?.ref === "Event" ||
      EventApplication.schema.path("event")?.options?.ref === "Event";

    const query = EventApplication.findById(id);
    if (hasRef) {
      if (EventApplication.schema.path("eventId")) query.populate("eventId");
      if (EventApplication.schema.path("event")) query.populate("event");
    }

    let app = await query.lean();
    if (!app) {
      return res.status(404).json({ status: "error", message: "Application not found" });
    }

    let eventDoc = null;
    if (app.event) {
      eventDoc = app.event;
    } else if (app.eventId && typeof app.eventId === "object" && app.eventId !== null) {
      eventDoc = app.eventId;
    } else if (app.eventId && mongoose.Types.ObjectId.isValid(app.eventId)) {
      eventDoc = await Event.findById(app.eventId).lean();
    }

    const eventIdStr =
      app.event?._id
        ? String(app.event._id)
        : typeof app.eventId === "object" && app.eventId !== null
          ? String(app.eventId._id)
          : app.eventId
            ? String(app.eventId)
            : null;

    const { event, eventId, ...rest } = app;

    return res.json({
      status: "success",
      data: { ...rest, eventId: eventIdStr, event: eventDoc || null },
    });
  } catch (err) {
    console.error("Error fetching application:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* -----------------------------------------------------------
 * POST /api/application
 *  - Booth Platform: requires boothNumber + startDate + durationWeeks
 *  - Bazaar: no startDate/boothNumber required
 * --------------------------------------------------------- */
export const createApplication = async (req, res) => {
  try {
    const isBoothPlat =
      (typeof req.body.boothNumber === "string" && req.body.boothNumber.trim() !== "") ||
      !!req.body.startDate;

    const { value, error } = (isBoothPlat ? boothReserveSchema : createEventApplicationSchema)
      .validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({ status: "error", message: error.message });
    }

    // Must have a valid event
    const ev = await Event.findById(value.eventId).lean();
    if (!ev) {
      return res.status(404).json({ status: "error", message: "Event not found" });
    }

    // ✅ Enforce applicantName from userId (token) whenever available
    let applicantName = "";
    if (value.userId) {
      const u = await User.findById(value.userId, { fullName: 1, firstName: 1, lastName: 1, email: 1 }).lean();
      applicantName =
        (u?.fullName && String(u.fullName).trim()) ||
        ([u?.firstName, u?.lastName].filter(Boolean).join(" ").trim()) ||
        (u?.email || "");
    }
    // Fall back only if user couldn't be resolved (e.g., system call)
    if (!applicantName) {
      applicantName =
        (value.applicantName && String(value.applicantName).trim()) ||
        ((Array.isArray(value.participants) && value.participants[0]?.name)
          ? String(value.participants[0].name).trim()
          : "");
    }
    if (applicantName) value.applicantName = applicantName;

    // ── Booth Platform branch ───────────────────────────────────────────
    if (isBoothPlat) {
      const weeks = Number(value.durationWeeks ?? value.setupDurationWeeks);
      if (!weeks || weeks < 1 || weeks > 4) {
        return res.status(400).json({ status: "error", message: "Invalid duration (weeks)." });
      }

      const reservationStart = new Date(value.startDate);
      if (isNaN(reservationStart.getTime())) {
        return res.status(400).json({ status: "error", message: "startDate is invalid." });
      }

      const reservationEnd = new Date(reservationStart);
      reservationEnd.setUTCDate(reservationEnd.getUTCDate() + weeks * 7 - 1);

      if (ev.endDateTime) {
        const eventEnd = new Date(ev.endDateTime);
        if (reservationEnd > eventEnd) {
          return res.status(400).json({
            status: "error",
            message: "Requested range extends beyond the event end date.",
          });
        }
      }

      const boothKey = String(value.boothNumber).trim().toUpperCase();

      const overlapExists = await EventApplication.exists({
        eventId: value.eventId,
        boothNumber: boothKey,
        status: { $in: ["pending", "accepted"] },
        reservationStart: { $lte: reservationEnd },
        reservationEnd:   { $gte: reservationStart },
      });
      if (overlapExists) {
        return res.status(409).json({
          status: "error",
          message: "Booth reservation window overlaps an existing reservation.",
        });
      }

      const doc = await EventApplication.create({
        ...value,
        boothNumber: boothKey,
        setupDurationWeeks: weeks,
        reservationStart,
        reservationEnd,
      });

      return res.status(201).json({ status: "success", data: doc });
    }

    // ── Bazaar branch ───────────────────────────────────────────────────
    if (value.durationWeeks && !value.setupDurationWeeks) {
      value.setupDurationWeeks = value.durationWeeks;
    }

    const doc = await EventApplication.create({ ...value });
    return res.status(201).json({ status: "success", data: doc });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ status: "error", message: "Duplicate key." });
    }
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* -----------------------------------------------------------
 * GET /api/application
 * --------------------------------------------------------- */
export const listApplications = async (req, res) => {
  try {
    const { eventId, userId, status } = req.query;
    const filter = {};
    if (eventId) filter.eventId = eventId;
    if (userId) filter.userId = userId;
    if (status) filter.status = status;

    const apps = await EventApplication.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ status: "success", count: apps.length, data: apps });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* -----------------------------------------------------------
 * PATCH /api/application/:id
 * --------------------------------------------------------- */
export const updateApplication = async (req, res) => {
  try {
    const { value, error } = updateEventApplicationSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).json({ status: "error", message: error.message });
    }

    // If participants changed but applicantName not provided, recompute
    if (!value.applicantName && Array.isArray(value.participants) && value.participants.length > 0) {
      const firstP = value.participants[0];
      if (firstP?.name) value.applicantName = String(firstP.name).trim();
    }

    const app = await EventApplication.findByIdAndUpdate(
      req.params.id,
      { ...value },
      { new: true, runValidators: true }
    );
    if (!app) {
      return res.status(404).json({ status: "error", message: "Application not found" });
    }

    return res.json({ status: "success", data: app });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* -----------------------------------------------------------
 * DELETE /api/application/:id
 * --------------------------------------------------------- */
export const deleteApplication = async (req, res) => {
  try {
    const app = await EventApplication.findByIdAndDelete(req.params.id);
    if (!app) {
      return res.status(404).json({ status: "error", message: "Application not found" });
    }

    return res.json({
      status: "success",
      message: "Application deleted",
      id: req.params.id,
    });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/* -----------------------------------------------------------
 * Internal helper for status transitions
 * --------------------------------------------------------- */
async function setStatusOrFail(id, nextStatus, { reason } = {}) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error("Invalid application id");
    err.status = 400;
    throw err;
  }

  const app = await EventApplication.findById(id);
  if (!app) {
    const err = new Error("Application not found");
    err.status = 404;
    throw err;
  }

  if (app.status !== "pending") {
    const err = new Error(
      `Cannot change status from '${app.status}' to '${nextStatus}'. Only 'pending' can transition.`
    );
    err.status = 409;
    throw err;
  }

  app.status = nextStatus; // 'accepted' | 'rejected' | 'cancelled'
  if (reason) {
    app.notes = app.notes
      ? `${app.notes}\n[${nextStatus.toUpperCase()}] ${reason}`
      : `[${nextStatus.toUpperCase()}] ${reason}`;
  }
  await app.save();

  return app;
}

/* -----------------------------------------------------------
 * POST /api/application/:id/accept
 * --------------------------------------------------------- */
export const acceptApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const app = await setStatusOrFail(id, "accepted", { reason: req.body?.reason });
    return res.json({ status: "success", data: app });
  } catch (err) {
    console.error("acceptApplication error:", err);
    return res.status(err.status || 500).json({ status: "error", message: err.message });
  }
};

/* -----------------------------------------------------------
 * POST /api/application/:id/reject
 * --------------------------------------------------------- */
export const rejectApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const app = await setStatusOrFail(id, "rejected", {
      reason: req.body?.reason || "Rejected by staff.",
    });
    return res.json({ status: "success", data: app });
  } catch (err) {
    console.error("rejectApplication error:", err);
    return res.status(err.status || 500).json({ status: "error", message: err.message });
  }
};

/* -----------------------------------------------------------
 * POST /api/application/:id/cancel
 * --------------------------------------------------------- */
export const cancelApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const app = await setStatusOrFail(id, "cancelled", {
      reason: req.body?.reason || "Cancelled by applicant.",
    });
    return res.json({ status: "success", data: app });
  } catch (err) {
    console.error("cancelApplication error:", err);
    return res.status(err.status || 500).json({ status: "error", message: err.message });
  }
};

/* -----------------------------------------------------------
 * GET /api/application/booth?eventId=&boothNumber=
 * (unchanged except it already includes applicantName in projection)
 * --------------------------------------------------------- */
export const getApplicationsByEventAndBooth = async (req, res) => {
  try {
    const { eventId, boothNumber } = req.query;

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ status: "error", message: "Invalid or missing eventId" });
    }
    if (!boothNumber) {
      return res.status(400).json({ status: "error", message: "Missing boothNumber" });
    }

    const eventIdObj = new mongoose.Types.ObjectId(eventId);
    const boothKey = String(boothNumber).trim().toUpperCase();
    const ACTIVE = ["pending", "accepted"];

    const boothDoc = await BoothNumber.findOne({ boothNumber: boothKey }).lean();

    const proj = {
      _id: 1,
      userId: 1,
      eventId: 1,
      boothNumber: 1,
      status: 1,
      setupDurationWeeks: 1,
      reservationStart: 1,
      reservationEnd: 1,
      createdAt: 1,
      updatedAt: 1,
      applicantName: 1, // keep projecting
    };

    const appsThisEventRaw = await EventApplication
      .find({ eventId: eventIdObj, boothNumber: boothKey, status: { $in: ACTIVE } }, proj)
      .sort({ createdAt: -1 })
      .lean();

    const applications = appsThisEventRaw.map(a => ({
      ...a,
      start: a.reservationStart ?? null,
      end: a.reservationEnd ?? null,
    }));

    const appsOtherEventsRaw = await EventApplication
      .find({ boothNumber: boothKey, eventId: { $ne: eventIdObj }, status: { $in: ACTIVE } }, proj)
      .sort({ createdAt: -1 })
      .lean();

    const boothLinkedApplications = appsOtherEventsRaw.map(a => ({
      ...a,
      start: a.reservationStart ?? null,
      end: a.reservationEnd ?? null,
      _fromBoothLink: true,
    }));

    const reservations = applications
      .filter(a => a.reservationStart && a.reservationEnd)
      .map(a => ({
        applicationId: a._id,
        status: a.status,
        start: a.reservationStart,
        end: a.reservationEnd,
        userId: a.userId,
        applicantName: a.applicantName ?? null,
      }));

    return res.json({
      status: "success",
      count: applications.length,
      data: {
        applications,
        boothLinkedApplications,
        reservations,
        booth: boothDoc || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};
