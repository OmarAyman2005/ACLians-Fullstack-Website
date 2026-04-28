import mongoose from "mongoose";

/**
 * Gym sessions.
 * Uniqueness policy:
 *   (type, date@00:00:00Z, startTime, endTime) must be unique.
 * Coach is not part of uniqueness (policy).
 */
const GymSessionSchema = new mongoose.Schema(
  {
    // New fields (used by admin UI)
    category: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    coachName: { type: String, required: true, trim: true },

    // Stored as Date at 00:00:00.000Z
    date: { type: Date, required: true, index: true },

    // "HH:mm"
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },

    capacity: { type: Number, default: 0, min: 0 },
    booked: { type: Number, default: 0, min: 0 }, // (reserved for future use)
  },
  { timestamps: true }
);

// Uniqueness across type + date + slot (coach not included)
GymSessionSchema.index(
  { type: 1, date: 1, startTime: 1, endTime: 1 },
  { unique: true, name: "uniq_type_date_slot" }
);

// Convenience indexes
GymSessionSchema.index({ date: 1, type: 1, startTime: 1 });

export default mongoose.model("GymSession", GymSessionSchema);
