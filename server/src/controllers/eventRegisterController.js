import mongoose from "mongoose";
import { EventRegister } from "../models/EventRegister.js";
import { Event } from "../models/Event.js";

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

export const createRegistration = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { event: eventId, name, email, studentId, meta } = req.body || {};

    if (!userId || !isObjectId(userId)) {
      return res.status(401).json({ status: "error", message: "Authentication required" });
    }
    if (!eventId || !isObjectId(eventId)) {
      return res.status(400).json({ status: "error", message: "Invalid or missing event id" });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ status: "error", message: "Event not found" });

    // prevent duplicate (index also enforces)
    const exists = await EventRegister.findOne({ event: eventId, user: userId });
    if (exists) {
      return res.status(409).json({ status: "error", message: "Already registered for this event" });
    }

    const reg = await EventRegister.create({
      event: eventId,
      user: userId,
      name,
      email,
      studentId,
      meta,
      modifiedBy: userId,
    });

    return res.status(201).json({ status: "success", data: reg });
  } catch (err) {
    // duplicate key -> already registered
    if (err && err.code === 11000) {
      return res.status(409).json({ status: "error", message: "Already registered" });
    }
    return res.status(400).json({ status: "error", message: err.message || "Failed to register" });
  }
};

export const getUserRegistrations = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.query.userId;
    if (!userId || !isObjectId(userId)) {
      return res.status(400).json({ status: "error", message: "Invalid user id" });
    }

    const regs = await EventRegister.find({ user: userId }).populate("event").sort({ createdAt: -1 });
    return res.status(200).json({ status: "success", count: regs.length, data: regs });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

export const getRegistrationsByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!eventId || !isObjectId(eventId)) {
      return res.status(400).json({ status: "error", message: "Invalid event id" });
    }

    const regs = await EventRegister.find({ event: eventId }).populate("user").sort({ createdAt: -1 });
    return res.status(200).json({ status: "success", count: regs.length, data: regs });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

export const deleteRegistration = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;
    if (!id || !isObjectId(id)) return res.status(400).json({ status: "error", message: "Invalid id" });

    const reg = await EventRegister.findById(id);
    if (!reg) return res.status(404).json({ status: "error", message: "Registration not found" });

    // only owner or admin can delete
    const isOwner = userId && String(reg.user) === String(userId);
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin) return res.status(403).json({ status: "error", message: "Forbidden" });

    await EventRegister.findByIdAndDelete(id);
    return res.status(200).json({ status: "success", message: "Registration removed" });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};