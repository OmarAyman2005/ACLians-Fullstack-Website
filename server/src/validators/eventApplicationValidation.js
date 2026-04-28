import Joi from "joi";

const attendee = Joi.object({
  name: Joi.string().min(2).max(80).required(),
  email: Joi.string().email().required(),
});

export const createEventApplicationSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  eventId: Joi.string().hex().length(24).required(),

  participants: Joi.array().items(attendee).max(5).default([]),

  gucID: Joi.string().max(80).allow("").optional(),           // ⬅️ NEW

  boothSize: Joi.string().valid("2x2", "4x4").optional(),
  setupDurationWeeks: Joi.number().integer().min(1).max(4).optional(),
  setupLocation: Joi.string().max(120).optional(),
  boothNumber: Joi.string().max(20).optional(),

  // Optional on create; defaults to pending
  status: Joi.string().valid("pending", "accepted", "rejected").optional(),

  notes: Joi.string().max(2000).allow("").optional(),
  createdBy: Joi.string().hex().length(24).optional(),
  modifiedBy: Joi.string().hex().length(24).optional(),
}).messages({
  "string.length": "{#label} must be a valid 24-char ObjectId",
});

export const updateEventApplicationSchema = Joi.object({
  participants: Joi.array().items(attendee).max(5),
  gucID: Joi.string().max(80).allow(""),                      // ⬅️ NEW
  boothSize: Joi.string().valid("2x2", "4x4"),
  setupDurationWeeks: Joi.number().integer().min(1).max(4),
  setupLocation: Joi.string().max(120),
  boothNumber: Joi.string().max(20),
  status: Joi.string().valid("pending", "accepted", "rejected", "cancelled"),
  notes: Joi.string().max(2000).allow(""),
  modifiedBy: Joi.string().hex().length(24),
}).min(1);
