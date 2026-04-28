// models/EventApplication.js
import mongoose from "mongoose";

const attendeeSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, minlength: 2, maxlength: 80, required: true },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
  },
  { _id: false }
);

const eventApplicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },

    participants: { type: [attendeeSchema], default: [] },

    // NEW: human-friendly who applied (first participant, or user full name)
    applicantName: { type: String, trim: true, maxlength: 120, index: true }, // ← NEW

    gucID: { type: String, trim: true, maxlength: 80 },

    boothSize: { type: String, enum: ["2x2", "4x4"] },
    setupDurationWeeks: { type: Number, min: 1, max: 4 },
    setupLocation: { type: String, trim: true, maxlength: 120 },
    boothNumber: { type: String, trim: true, maxlength: 20 },

    reservationStart: { type: Date, default: null, index: true },
    reservationEnd:   { type: Date, default: null, index: true },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    notes: { type: String, trim: true, maxlength: 2000 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// normalize boothNumber uppercase
eventApplicationSchema.pre("validate", function (next) {
  if (this.boothNumber) this.boothNumber = String(this.boothNumber).trim().toUpperCase();

  // Best-effort normalize applicantName if missing
  if (!this.applicantName || !this.applicantName.trim()) {
    const firstP = Array.isArray(this.participants) && this.participants[0];
    if (firstP?.name) this.applicantName = String(firstP.name).trim();
  }
  next();
});

export const EventApplication = mongoose.model("EventApplication", eventApplicationSchema);
