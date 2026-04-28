// client/src/app/(end-user)/vendor-requests/vendor-requests.js
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { applicationsService } from "@/app/services/applications.service";
import { eventsService } from "@/app/services/events.service";

// ── API/service calls (top) ──────────────────────────────────────────────
const listAppsByUser = (userId, extra = {}) =>
  applicationsService.listByUser(userId, extra);
const listAllApps = (query = {}) => applicationsService.list(query);
const fetchEventById = async (id) => {
  const res = await eventsService.getById(id);
  return (res && res.data) ? res.data : res;
};

// ── Styles (single object) ───────────────────────────────────────────────
const STYLES = {
  section: { padding: 24 },
  h1: { marginBottom: 8, fontSize: 22, fontWeight: 700 },
  sub: { marginBottom: 12, color: "#6B7280", fontSize: 13 },
  tableWrap: { width: "100%", overflowX: "auto", borderRadius: 12, border: "1px solid #eee", background: "#fff" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
  thtd: { padding: "14px 16px", fontSize: 14, textAlign: "left", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  detailsBtn: (open) => ({
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb",
    background: open ? "#eef2ff" : "#f9fafb", cursor: "pointer",
    fontSize: 13, fontWeight: 600, color: "#111827",
  }),
  textDangerBtn: {
    background: "transparent", border: "none", color: "#B42318",
    cursor: "pointer", fontSize: 13, fontWeight: 700, padding: 0, textDecoration: "none",
  },
  primaryBtn: {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "8px 12px", borderRadius: 10, border: "1px solid #0F62FE",
    background: "#0F62FE", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700,
  },
  outlineBtn: {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "8px 12px", borderRadius: 10, border: "1px solid #d1d5db",
    background: "#fff", color: "#111827", cursor: "pointer", fontSize: 13, fontWeight: 700,
  },
  tabWrap: { display: "inline-flex", gap: 8, padding: 4, borderRadius: 999, background: "#f3f4f6", border: "1px solid #e5e7eb" },
  tabBtn: (active) => ({
    padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: "none", background: active ? "#111827" : "transparent", color: active ? "#fff" : "#111827",
  }),
  badge: (status) => {
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    const map = {
      Accepted: { bg: "#E6FFED", color: "#0F8A3D", border: "#B7EFC5" },
      Pending:  { bg: "#FFF8E6", color: "#A05A00", border: "#FAD69C" },
      Rejected: { bg: "#FFECEC", color: "#B42318", border: "#FFB4AE" },
      Cancelled:{ bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" },
    };
    const key = cap(status);
    const s = map[key] || map.Cancelled;
    return {
      display: "inline-block", padding: "4px 10px", borderRadius: 999,
      fontSize: 12, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}`, lineHeight: 1,
    };
  },
};

const PayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="6" width="18" height="12" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 9h18M7 14h6" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const Chevron = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" style={{ transform: `rotate(${open ? 180 : 0}deg)`, transition: "transform .15s ease" }} aria-hidden="true">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

// ── Helpers ──────────────────────────────────────────────────────────────
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// strict dd/MM/yyyy hh:mm AM/PM
function fmtDTStrict(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(+dt)) return "—";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  let h = dt.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const mins = String(dt.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${h}:${mins} ${ampm}`;
}

// strict dd/MM/yyyy (no time) — used for Setup Start/End
function fmtDStrict(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(+dt)) return "—";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function normalizeEvent(eventish) {
  if (!eventish) return null;
  if (eventish.data && (eventish.data._id || eventish.data.name || eventish.data.title)) return eventish.data;
  if (eventish._id || eventish.name || eventish.title) return eventish;
  return null;
}

function mapAppToRow(app, eventDocRaw) {
  const eventDoc = normalizeEvent(eventDocRaw);
  const name        = eventDoc?.name || eventDoc?.title || "—";
  const eventType   = eventDoc?.eventType || eventDoc?.type || "—";
  const startRaw    = eventDoc?.startDateTime || eventDoc?.startsAt;
  const endRaw      = eventDoc?.endDateTime || eventDoc?.endsAt;
  const location    = eventDoc?.location || "—";
  const description = eventDoc?.fullAgenda || eventDoc?.description || eventDoc?.shortDescription || "—";

  return {
    id: app._id,
    event: name,
    type: eventType,
    start: fmtDTStrict(startRaw),
    end: fmtDTStrict(endRaw),
    startRaw,
    endRaw,
    location,
    status: cap(app.status || "pending"),
    app,
    eventDoc,
    description,
  };
}

// Pull setup window + related vendor fields with robust fallbacks
function extractVendorFields(app) {
  const setupStart =
    app?.reservationStart ??
    app?.startDate ??
    app?.setupStart ??
    app?.boothReservationStart ??
    null;

  const setupEnd =
    app?.reservationEnd ??
    app?.endDate ??
    app?.setupEnd ??
    app?.boothReservationEnd ??
    null;

  const durationWeeks =
    app?.durationWeeks ??
    app?.setupDurationWeeks ??
    null;

  const boothNumber =
    app?.boothNumber ??
    app?.setupLocation ??
    app?.booth ??
    null;

  const boothSize = app?.boothSize ?? null;

  const participants = Array.isArray(app?.participants) ? app.participants.slice(0, 5) : [];

  return {
    setupStart, setupEnd, durationWeeks, boothNumber, boothSize, participants
  };
}

// Generic presence check (no rendering of "—")
const isPresent = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0 && v.trim() !== "—";
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

// ── Component ────────────────────────────────────────────────────────────
export default function VendorRequests({ vendorId, role = "vendor", vendorName }) {
  const isStaff = ["admin", "event_office"].includes(String(role || "").toLowerCase());
  const title = isStaff ? "Vendor Participation Requests" : "Your Requests";

  const [tab, setTab] = useState("All");
  const [openIndex, setOpenIndex] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Load applications + related events
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const apps = isStaff ? await listAllApps() : await listAppsByUser(vendorId);

        const cache = new Map();
        const getEvent = async (id) => {
          const key = String(id);
          if (cache.has(key)) return cache.get(key);
          const doc = await fetchEventById(key).catch(() => null);
          cache.set(key, doc);
          return doc;
        };

        const mappedRows = await Promise.all(
          apps.map(async (app) => {
            let eventDoc =
              normalizeEvent(app.event) ||
              normalizeEvent(app.eventId);

            if (!eventDoc && app.eventId && typeof app.eventId === "string") {
              eventDoc = await getEvent(app.eventId);
            }
            return mapAppToRow(app, eventDoc);
          })
        );

        if (alive) setRows(mappedRows);
      } catch (e) {
        if (alive) setErr(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [isStaff, vendorId]);

  // ── Actions: accept / reject / cancel ──────────────────────────────────
  const patchRowStatus = (appId, newStatus) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === appId ? { ...r, status: cap(newStatus), app: { ...r.app, status: newStatus } } : r
      )
    );
  };

  const handleAccept = async (row) => {
    try {
      await applicationsService.accept(row.id);
      patchRowStatus(row.id, "accepted");
    } catch (e) {
      alert(`Failed to accept: ${String(e?.message || e)}`);
    }
  };

  const handleReject = async (row) => {
    try {
      await applicationsService.reject(row.id);
      patchRowStatus(row.id, "rejected");
    } catch (e) {
      alert(`Failed to reject: ${String(e?.message || e)}`);
    }
  };

  const handleCancel = async (row) => {
    try {
      await applicationsService.cancel(row.id);
      patchRowStatus(row.id, "cancelled");
    } catch (e) {
      alert(`Failed to cancel: ${String(e?.message || e)}`);
    }
  };

  const baseRows = rows;
  const filteredRows = useMemo(() => {
    if (!isStaff && tab === "Accepted") {
      return baseRows.filter((r) => r.status === "Accepted");
    }
    return baseRows;
  }, [baseRows, isStaff, tab]);

  const toggle = (idx) => setOpenIndex((curr) => (curr === idx ? null : idx));
  const COLS = 8;

  return (
    <section style={STYLES.section}>
      <h1 style={STYLES.h1}>{title}</h1>
      <div style={STYLES.sub}>Role: <strong>{role}</strong></div>

      {!isStaff && (
        <div style={{ marginBottom: 16 }}>
          <div style={STYLES.tabWrap} role="tablist" aria-label="Filter requests">
            <button role="tab" aria-selected={tab === "All"} onClick={() => setTab("All")} style={STYLES.tabBtn(tab === "All")}>All</button>
            <button role="tab" aria-selected={tab === "Accepted"} onClick={() => setTab("Accepted")} style={STYLES.tabBtn(tab === "Accepted")}>Accepted</button>
          </div>
        </div>
      )}

      {loading && <div style={{ padding: 12 }}>Loading applications…</div>}
      {err && !loading && <div style={{ padding: 12, color: "#B42318" }}>Failed to load: {err}</div>}

      {!loading && !err && (
        <div style={STYLES.tableWrap}>
          <table style={STYLES.table} aria-label="Vendor Requests">
            <thead>
              <tr>
                {["Event", "Event Type", "Start", "End", "Location", "Status", "Actions", "Details"].map((h) => (
                  <th key={h} style={{ ...STYLES.thtd, fontWeight: 700, color: "#333" }}>{h}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td style={STYLES.thtd} colSpan={COLS}>
                    No requests found{!isStaff ? <> for vendor <strong>{vendorName}</strong></> : null}.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, idx) => {
                  const isOpen = openIndex === idx;
                  const rowKey = r.id || `${r.event}-${idx}`;
                  const descId = `desc-${rowKey}`;

                  const renderActions = () => {
                    if (!r.status) return <span style={{ color: "#9CA3AF" }}>—</span>;
                    if (!isStaff) {
                      if (r.status === "Pending") {
                        return (
                          <button type="button" style={STYLES.textDangerBtn} onClick={() => handleCancel(r)}>
                            Cancel
                          </button>
                        );
                      }
                      if (r.status === "Accepted") {
                        return (
                          <button type="button" style={STYLES.primaryBtn} onClick={() => alert(`Proceed to pay for ${r.event}`)}>
                            <PayIcon /> Pay
                          </button>
                        );
                      }
                      return <span style={{ color: "#9CA3AF" }}>—</span>;
                    } else {
                      if (r.status === "Pending") {
                        return (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" style={STYLES.primaryBtn} onClick={() => handleAccept(r)}>Accept</button>
                            <button type="button" style={STYLES.outlineBtn} onClick={() => handleReject(r)}>Reject</button>
                          </div>
                        );
                      }
                      return <span style={{ color: "#9CA3AF" }}>—</span>;
                    }
                  };

                  // ── DETAILS CONTENT — shown for vendor AND staff ───────
                  const {
                    setupStart, setupEnd, durationWeeks,
                    boothNumber, boothSize, participants
                  } = extractVendorFields(r.app);

                  const participantsInline = participants.length
                    ? participants.map(p => `${p.name || "—"} — ${p.email || "—"}`).join(", ")
                    : "";

                  return (
                    <React.Fragment key={rowKey}>
                      <tr>
                        <td style={STYLES.thtd}>{r.event}</td>
                        <td style={STYLES.thtd}>{cap(r.type)}</td>
                        <td style={STYLES.thtd}>{r.start}</td>
                        <td style={STYLES.thtd}>{r.end}</td>
                        <td style={STYLES.thtd}>{r.location}</td>
                        <td style={STYLES.thtd}><span style={STYLES.badge(r.status)}>{r.status || "—"}</span></td>
                        <td style={STYLES.thtd}>{renderActions()}</td>
                        <td style={{ ...STYLES.thtd, minWidth: 160 }}>
                          <button type="button" onClick={() => toggle(idx)} aria-expanded={isOpen} aria-controls={descId} style={STYLES.detailsBtn(isOpen)}>
                            <Chevron open={isOpen} /> {isOpen ? "Hide details" : "Show details"}
                          </button>
                        </td>
                      </tr>

                      <tr>
                        <td
                          id={descId}
                          colSpan={COLS}
                          style={{
                            padding: isOpen ? "12px 16px" : "0 16px",
                            background: "#f8fafc",
                            borderBottom: "1px solid #eee",
                            transition: "padding .18s ease",
                          }}
                        >
                          <div
                            style={{
                              maxHeight: isOpen ? 420 : 0,
                              overflow: "hidden",
                              transition: "max-height .2s ease",
                              color: "#374151",
                              fontSize: 14,
                              lineHeight: 1.5,
                            }}
                          >
                            {isOpen && (
                              <div style={{ display: "grid", gap: 8 }}>
                                {/* Summary block — only render fields that have values */}
                                {isPresent(r.event) && <div><strong>Event:</strong> {r.event}</div>}
                                {isPresent(r.type) && <div><strong>Type:</strong> {cap(r.type)}</div>}
                                {isPresent(r.location) && <div><strong>Location:</strong> {r.location}</div>}
                                {isPresent(r.status) && <div><strong>Status:</strong> {r.status}</div>}
                                {isPresent(boothSize) && <div><strong>Booth Size:</strong> {boothSize}</div>}

                                {isPresent(setupStart) && <div><strong>Setup Start:</strong> {fmtDStrict(setupStart)}</div>}
                                {isPresent(setupEnd) && <div><strong>Setup End:</strong> {fmtDStrict(setupEnd)}</div>}
                                {isPresent(durationWeeks) && <div><strong>Setup Duration (weeks):</strong> {durationWeeks}</div>}
                                {isPresent(boothNumber) && <div><strong>Booth Number:</strong> {boothNumber}</div>}

                                {isPresent(participantsInline) && (
                                  <div>
                                    <strong>Participants (max 5):</strong> {participantsInline}
                                  </div>
                                )}

                                {isPresent(r.description) && (
                                  <div style={{ marginTop: 8 }}>
                                    <strong>Event Description</strong>
                                    <div>{r.description}</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
