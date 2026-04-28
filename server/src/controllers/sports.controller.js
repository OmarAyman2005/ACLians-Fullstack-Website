import Court from "../models/Court.js";
import GymSession from "../models/GymSession.js";

/* ---------------- helpers ---------------- */
function pad(n) { return String(n).padStart(2, "0"); }
function toMinutes(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
function fromMinutes(mins) { const h = Math.floor(mins / 60); const m = mins % 60; return `${pad(h)}:${pad(m)}`; }

// Normalize any date-like to 00:00:00.000Z Date
function toUTCDateOnly(dateLike) {
  if (!dateLike) return null;
  const iso = typeof dateLike === "string"
    ? dateLike.slice(0, 10)
    : new Date(dateLike).toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}
function isFriOrSatUTC(d) { // d is Date in UTC midnight
  const dow = d.getUTCDay(); // 0..6
  return dow === 5 || dow === 6;
}
function ensureTimesAscending(start, end) {
  if (!start || !end) return true;
  return toMinutes(end) > toMinutes(start);
}

/** build 1h slots from time windows: [{startTime,endTime}] */
function buildHourlySlotsFromWindows(windows) {
  const out = [];
  for (const w of windows) {
    const startM = toMinutes(w.startTime);
    const endM = toMinutes(w.endTime);
    for (let m = startM; m < endM; m += 60) {
      const next = m + 60;
      if (next <= endM) out.push({ start: fromMinutes(m), end: fromMinutes(next) });
    }
  }
  return out;
}

/** Friday: single 2h PREMIUM block 14:00–16:00 */
function fridayPremiumBlock() { return { start: "14:00", end: "16:00", premium: true }; }
/** Thursday: 08:00–22:00 windows */
function thursdayWindows() { return [{ startTime: "08:00", endTime: "22:00" }]; }
/** Sun–Wed: 08:00–16:00 */
function standardWindows() { return [{ startTime: "08:00", endTime: "16:00" }]; }

/** seed-based reservations for a specific date */
function findReservedForDate(court, isoDate) {
  const entries = court?.reserved || [];
  return entries.filter((r) => r.date?.slice(0, 10) === isoDate.slice(0, 10));
}
/** randomly reserve around 45–60% of slots when no seed entries exist */
function sprinkleRandomReservations(slots) {
  const bias = 0.45 + Math.random() * 0.15;
  return slots.map((s) => ({ ...s, reserved: Math.random() < bias }));
}

/* ---------------- COURTS ---------------- */

// list courts
export const listCourts = async (_req, res, next) => {
  try {
    const data = await Court.find().lean();
    res.json({ data });
  } catch (e) { next(e); }
};

// court availability by date with weekday rules + premium Friday
export const courtAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date } = req.query; // YYYY-MM-DD
    const whenISO = (date || new Date().toISOString()).slice(0, 10);

    const court = await Court.findById(id).lean();
    if (!court) return res.status(404).json({ error: "Court not found" });

    const day = new Date(whenISO).getDay(); // 0..6
    if (day === 6) return res.json({ data: [] }); // Saturday: off

    let slots = [];
    let isPremiumDay = false;

    if (day === 5) {
      const p = fridayPremiumBlock();
      isPremiumDay = true;
      const seeded = findReservedForDate(court, whenISO);
      const seededMatch = seeded.some((r) => r.start === p.start && r.end === p.end);
      const reserved = seeded.length ? seededMatch : Math.random() < 0.5;
      slots = [{ start: p.start, end: p.end, reserved, premium: true }];
    } else if (day === 4) {
      slots = buildHourlySlotsFromWindows(thursdayWindows());
    } else {
      slots = buildHourlySlotsFromWindows(standardWindows());
    }

    if (!isPremiumDay) {
      const seeded = findReservedForDate(court, whenISO);
      if (seeded.length > 0) {
        slots = slots.map((s) => {
          const isRes = seeded.find((r) => r.start === s.start && r.end === s.end) != null;
          return { ...s, reserved: isRes };
        });
      } else {
        slots = sprinkleRandomReservations(slots);
      }
    }

    res.json({ data: slots });
  } catch (e) { next(e); }
};

/* ---------------- GYM SESSIONS ---------------- */

/**
 * GET /api/sports/gym/sessions
 * Optional filters:
 *   - type=...      (string)
 *   - date=YYYY-MM-DD (UTC midnight match)
 * If no date is provided, returns sessions from today onwards.
 */
// GET /api/sports/gym/sessions?date=YYYY-MM-DD&type=Yoga
export const listGymSessions = async (req, res, next) => {
  try {
    const { date, type, location } = req.query;
    const filter = {};

    if (type) filter.type = type;                 // e.g., "Yoga"
    if (location) filter.location = location;     // if you still use it

    if (date) {
      // normalize to day range local
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: start, $lt: end };
    } else {
      // default: future sessions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filter.date = { $gte: today };
    }

    const data = await GymSession.find(filter)
      .sort({ date: 1, startTime: 1 })
      .lean();

    res.json({ data });
  } catch (e) {
    next(e);
  }
};

// POST /api/sports/gym/sessions
export const createGymSession = async (req, res, next) => {
  try {
    const body = { ...req.body };

    // capacity & booked guard
    const cap = Number(body.capacity) || 0;

    // Assign a persistent random "booked" on creation IF not provided.
    // - Mostly in [0, cap], with ~20% chance to be fully-booked to test UI.
    let booked =
      typeof body.booked === "number"
        ? Math.max(0, Math.min(cap, Math.floor(body.booked)))
        : Math.floor(Math.random() * (cap + 1));

    if (cap > 0 && Math.random() < 0.2) booked = cap; // ~20% full

    body.capacity = cap;
    body.booked = booked;

    const created = await GymSession.create(body);
    res.status(201).json({ data: created });
  } catch (e) {
    next(e);
  }
};

