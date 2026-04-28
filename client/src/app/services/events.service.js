// /services/events.service.js
import { http } from "./http";

/** Normalize an event coming from the API into a UI-friendly shape */
export function mapApiEvent(e) {
  const fmt = (iso) => {
    try { return iso ? new Date(iso).toLocaleString() : "—"; }
    catch { return iso || "—"; }
  };
  return {
    id: e._id,
    vendorId: e.vendorId || "",
    event: e.name || e.title || "—",
    type: (e.eventType || e.type || "").toString(),
    start: fmt(e.startDateTime || e.startsAt),
    end: fmt(e.endDateTime || e.endsAt),
    location: e.location || "—",
    description: e.description || e.shortDescription,
    status: e.status || "Pending",
    participants: e.participants || [],
    boothSize: e.boothSize,
    boothNumber: e.boothNumber,
    boothSetupDurationWeeks: e.setupDurationWeeks || e.boothSetupDurationWeeks,
    boothSetupLocation: e.setupLocation || e.boothSetupLocation,
  };
}

/** GET /event (supports filters in query) */
async function listRaw(query = {}) {
  const qp = new URLSearchParams(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ).toString();
  const url = qp ? `/event?${qp}` : "/event";      // <-- no /api
  const json = await http.get(url);
  return Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
}

/** GET /event mapped */
async function list(query = {}) {
  const arr = await listRaw(query);
  return arr.map(mapApiEvent);
}

/** GET /event/:id */
async function getById(id) {
  const json = await http.get(`/event/${id}`);     // <-- no /api
  return json?.data ?? json;
}

/** POST /event — create an event */
async function create(data) {
  // Expecting server to validate payload (name, startDateTime, endDateTime, etc.)
  const json = await http.post("/event", data);
  return json?.data ?? json;
}

/** GET /event/:eventId/participants — accepted vendor names for this event */
async function getParticipants(eventId) {
  const json = await http.get(`/event/${eventId}/participants`); // <-- no /api
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json)) return json;
  return [];
}

/**
 * GET /application/booth-reservations?eventId=...&boothNumber=...
 * Returns all reservations/applications for this booth in this event
 * (server returns active + historical; client can filter by date range if needed)
 */
async function getBoothReservations(eventId, boothNumber) {
  const qp = new URLSearchParams({ eventId, boothNumber }).toString();
  // NOTE: no extra /api here – http already points at NEXT_PUBLIC_API_URL (/api)
  return http.get(`/application/by-booth?${qp}`).then((json) => json?.data ?? json);
}


/** GET /application?eventId=... — all applications for an event (any status) */
async function getEventApplications(eventId, extra = {}) {
  const qp = new URLSearchParams({ eventId, ...extra }).toString();
  const json = await http.get(`/application?${qp}`);
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json)) return json;
  return [];
}

export const eventsService = {
  // events
  listRaw,
  list,
  getById,
  create,

  // event-related extras
  getParticipants,

  // booth/application helpers tied to events
  getBoothReservations,
  getEventApplications,
};
