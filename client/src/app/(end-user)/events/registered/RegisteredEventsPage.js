// app/events/registered/RegisteredEventsPage.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FaMapMarkerAlt, FaCalendarAlt, FaClock, FaUsers } from "react-icons/fa";
import { applicationsService } from "@/app/services/applications.service";
import { eventsService } from "@/app/services/events.service";

function formatDateRange(start, end) {
  if (!start) return "TBD";
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts = { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
  if (!e) return s.toLocaleString(undefined, opts);
  if (s.toDateString() === e.toDateString()) {
    return `${s.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} — ${e.toLocaleTimeString(
      undefined,
      { hour: "2-digit", minute: "2-digit" }
    )}, ${s.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
  }
  return `${s.toLocaleString(undefined, opts)} — ${e.toLocaleString(undefined, opts)}`;
}

function normalizeType(t) {
  if (!t) return "";
  const s = String(t).toLowerCase().trim();
  if (s === "booths" || s === "booth-platform" || s === "boothplatform") return "booth";
  if (s === "bazaars") return "bazaar";
  return s;
}

/* ---- helpers: only show ACTIVE apps ---- */
function normStatus(s) {
  const t = String(s || "").toLowerCase();
  if (t === "cancelled") return "canceled";
  return t;
}
function isActiveApp(app) {
  const st = normStatus(app?.status);
  return !["canceled", "rejected", "declined"].includes(st);
}

export default function RegisteredEventsPage({ currentUser }) {
  const router = useRouter();

  const [apps, setApps] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);

  const [eventsById, setEventsById] = useState({});
  const [eventsLoading, setEventsLoading] = useState(false);

  const [selected, setSelected] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [banner, setBanner] = useState({ text: "", tone: "info" });

  // If no user (no token server-side), ask them to login
  if (!currentUser?.id) {
    return (
      <main className="min-h-screen bg-gray-dark px-6 py-10 text-secondary">
        <div className="max-w-6xl mx-auto text-center">
          <p className="mb-6">Please sign in to view your registered events.</p>
          <button
            onClick={() => router.push("/login")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-primary hover:opacity-95 transition"
          >
            Go to Login
          </button>
        </div>
      </main>
    );
  }

  // Fetch user's applications (filter to active)
  const refreshApplications = async () => {
    try {
      setAppsLoading(true);
      const list = await applicationsService.listByUser(currentUser.id);
      setApps(Array.isArray(list) ? list.filter(isActiveApp) : []);
    } catch {
      setApps([]);
    } finally {
      setAppsLoading(false);
    }
  };

  useEffect(() => {
    refreshApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Resolve events for those applications
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!apps?.length) {
        setEventsById({});
        return;
      }
      const next = {};
      const missing = new Set();
      for (const a of apps) {
        const eid = a.eventId || a.event?._id || a.event?.id || a.event;
        if (!eid) continue;
        if (a.event && (a.event._id || a.event.id)) {
          next[String(eid)] = a.event;
        } else {
          missing.add(String(eid));
        }
      }
      setEventsById((prev) => ({ ...prev, ...next }));

      if (missing.size === 0) return;

      try {
        setEventsLoading(true);
        const fetched = await Promise.all(
          Array.from(missing).map(async (id) => {
            try {
              const ev = await eventsService.getById(id);
              return [id, ev];
            } catch {
              return [id, null];
            }
          })
        );
        if (!mounted) return;
        const add = {};
        for (const [id, ev] of fetched) {
          if (ev) add[id] = ev;
        }
        setEventsById((prev) => ({ ...prev, ...add }));
      } finally {
        if (mounted) setEventsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [apps]);

  // Derived list (apps already filtered to active)
  const registeredList = useMemo(() => {
    return (apps || [])
      .map((a) => {
        const eventId = a.eventId || a.event?._id || a.event?.id || a.event;
        const ev = eventsById[String(eventId)] || {};
        return { app: a, event: ev, eventId: String(eventId || "") };
      })
      .filter((row) => !!row.eventId);
  }, [apps, eventsById]);

  const goToEvents = () => router.push("/events");

  async function unregister(appId) {
    try {
      await applicationsService.cancel(appId);
      setBanner({ text: "Registration canceled.", tone: "success" });
      await refreshApplications(); // now it disappears since we filter inactive
      if (selected && (selected.app._id === appId || selected.app.id === appId)) {
        setShowDetailsModal(false);
        setSelected(null);
      }
    } catch (e) {
      setBanner({ text: e?.message || "Failed to cancel registration.", tone: "error" });
    }
  }

  const canRegisterAgain = (event, role) => {
    const r = String(role || currentUser?.role || "").toLowerCase();
    const t = normalizeType(event?.eventType || event?.type);
    return r === "vendor" && t === "booth";
  };

  const handleRegisterAgain = (eventId) => {
    if (!eventId) return;
    router.push(`/vendorApplyingBoothPlat/${eventId}`);
  };

  return (
    <>
      <main className="min-h-screen bg-gray-dark px-6 py-10 text-secondary">
        <div className="max-w-6xl mx-auto mb-6">
          <button
            onClick={goToEvents}
            className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-secondary hover:opacity-95 transition"
            aria-label="Back to events"
          >
            ← Back to events
          </button>

          {banner.text ? (
            <div
              className={`mb-4 rounded-xl px-3 py-2 text-sm border ${
                banner.tone === "error"
                  ? "bg-red-600/25 text-red-200 border-red-400/40"
                  : banner.tone === "success"
                  ? "bg-emerald-600/25 text-emerald-200 border-emerald-400/40"
                  : "bg-black/30 text-secondary border-white/10"
              }`}
            >
              {banner.text}
            </div>
          ) : null}

          <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-6">My Registered Events</h1>
        </div>

        {appsLoading || eventsLoading ? (
          <p className="text-center text-gray-300">Loading…</p>
        ) : registeredList.length === 0 ? (
          <p className="text-center text-gray-300">You have no registered events.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-12 w-full max-w-[1600px] mx-auto px-8 justify-items-center">
            {registeredList.map(({ app, event, eventId }) => {
              const appId = app._id || app.id;
              const participants = Array.isArray(app.participants) ? app.participants : [];
              const first = participants[0] || {};
              const name = first.name || app.name || currentUser.fullName || "You";
              const email = first.email || app.email || currentUser.email || "";
              const gucID = app.gcID || app.gucID || app.studentId || "";

              const start = event.startDateTime || event.startDate || event.startsAt;
              const end = event.endDateTime || event.endDate || event.endsAt;
              const type = event.eventType || event.type;

              const showRegisterAgain = canRegisterAgain(event, currentUser?.role);

              return (
                <div
                  key={appId}
                  className="bg-primary border border-gray-600 rounded-2xl p-10 hover:border-secondary transition duration-300 flex flex-col justify-between max-w-[720px] w-full min-h-[260px] overflow-hidden"
                >
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                      <h2 className="text-2xl md:text-3xl font-semibold text-secondary">
                        {event.name || event.title || "Event"}
                      </h2>
                      <span className="ml-2 inline-block text-xs px-2 py-1 rounded bg-gray-700 text-white">
                        {type || "—"}
                      </span>
                    </div>

                    <div className="mb-5 text-gray-300 text-base md:text-lg line-clamp-3">
                      {event.description || "—"}
                    </div>

                    <div className="flex items-center text-gray-300 text-sm md:text-base mb-2">
                      <FaMapMarkerAlt className="mr-2 text-secondary" />
                      {event.location || "N/A"}
                    </div>

                    <div className="flex items-center text-gray-300 text-sm md:text-base mb-2">
                      <FaCalendarAlt className="mr-2 text-secondary" />
                      {formatDateRange(start, end)}
                    </div>

                    <div className="flex items-center text-gray-300 text-sm md:text-base mb-2">
                      <FaClock className="mr-2 text-secondary" />
                      {(start && new Date(start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) || "TBD"}
                    </div>

                    <div className="flex items-center text-gray-300 text-sm md:text-base mb-4">
                      <FaUsers className="mr-2 text-secondary" />
                      Capacity: {event.capacity ?? "N/A"}
                    </div>
                  </div>

                  <div className="text-center">
                    <button
                      onClick={() => {
                        setSelected({ app, event, eventId });
                        setShowDetailsModal(true);
                      }}
                      className="px-8 py-3 rounded bg-secondary text-primary w-full text-lg"
                    >
                      View Details
                    </button>
                  </div>

                  <div className="mt-4">
                    <div className="mb-4 text-sm text-gray-300">
                      <div>
                        <div className="text-secondary font-medium">Registered as {name}</div>
                        <div className="text-sm text-gray-400">
                          {email || "—"} {gucID ? <> • {gucID}</> : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="px-4 py-2 rounded bg-gray-dark text-secondary"
                        onClick={() => unregister(appId)}
                      >
                        Unregister
                      </button>

                      {/* NEW: Vendors can apply again to BOOTH events */}
                      {showRegisterAgain && (
                        <button
                          className="px-4 py-2 rounded bg-primary text-secondary border border-secondary/40 hover:opacity-95"
                          onClick={() => handleRegisterAgain(eventId)}
                          title="Submit another booth application"
                        >
                          Register Again
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Details Modal */}
      {showDetailsModal && selected && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-index-50">
          <div
            className="bg-primary border border-gray-700 rounded-2xl p-6 w-full max-w-xl text-secondary max-h-[85vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="registered-details-title"
          >
            <div className="flex justify-between items-start">
              <h2 id="registered-details-title" className="text-2xl font-semibold mb-2">
                {selected.event?.name || selected.event?.title || "Event"}
              </h2>
            </div>

            <p className="text-gray-300 mb-3">{selected.event?.description || "—"}</p>

            <div className="flex items-center text-gray-300 text-sm mb-2">
              <FaCalendarAlt className="mr-2 text-secondary" />
              <span>
                {formatDateRange(
                  selected.event?.startDateTime || selected.event?.startDate || selected.event?.startsAt,
                  selected.event?.endDateTime || selected.event?.endDate || selected.event?.endsAt
                )}
              </span>
            </div>

            <div className="flex items-center text-gray-300 text-sm mb-2">
              <FaMapMarkerAlt className="mr-2 text-secondary" />
              <span>{selected.event?.location || "N/A"}</span>
            </div>

            <div className="flex items-center text-gray-300 text-sm mb-2">
              <FaUsers className="mr-2 text-secondary" />
              <span>Capacity: {selected.event?.capacity ?? "N/A"}</span>
            </div>

            <div className="mb-6 text-gray-300">
              {selected.event?.fullAgenda || selected.event?.description || "—"}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              {/* NEW in modal: Register Again for vendors on booth events */}
              {(() => {
                const allowAgain =
                  String(currentUser?.role || "").toLowerCase() === "vendor" &&
                  normalizeType(selected.event?.eventType || selected.event?.type) === "booth";
                return (
                  allowAgain && (
                    <button
                      onClick={() => handleRegisterAgain(selected.eventId)}
                      className="px-4 py-2 rounded bg-primary text-secondary border border-secondary/40"
                    >
                      Register Again
                    </button>
                  )
                );
              })()}

              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelected(null);
                }}
                className="px-4 py-2 rounded bg-secondary text-primary font-medium"
              >
                Close
              </button>
              <button
                onClick={() => unregister(selected.app._id || selected.app.id)}
                className="px-4 py-2 rounded bg-gray-dark text-secondary font-medium"
              >
                Unregister
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
