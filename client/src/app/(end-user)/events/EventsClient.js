// app/events/EventsClient.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaUsers,
  FaClipboardList,
  FaTag,
  FaRegCalendarAlt,
} from "react-icons/fa";
import { api } from "@/lib/admin/eventApi";
import { applicationsService } from "@/app/services/applications.service";
import { publicService } from "@/app/services/public.service";

/* ---------- Helpers ---------- */
function formatDateRange(start, end) {
  if (!start) return "TBD";
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts = { year: "numeric", month: "short", day: "numeric" };
  if (!e) return s.toLocaleDateString(undefined, opts);
  if (s.toDateString() === e.toDateString()) return s.toLocaleDateString(undefined, opts);
  return `${s.toLocaleDateString(undefined, opts)} — ${e.toLocaleDateString(undefined, opts)}`;
}

function shortText(s, n = 140) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n).trim() + "…" : s;
}

function currency(v) {
  if (v == null) return "";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(v);
}

function normalizeType(t) {
  if (!t) return "";
  const s = String(t).toLowerCase().trim();
  if (s === "workshops" || s === "workshop") return "workshop";
  if (s === "conferences" || s === "conference") return "conference";
  if (s === "bazaars" || s === "bazaar") return "bazaar";
  if (s === "trips" || s === "trip") return "trip";
  if (s === "booth" || s === "booths" || s === "booth-platform" || s === "boothplatform") return "booth";
  return s;
}

const LABELS = {
  workshop: "Workshops",
  conference: "Conferences",
  bazaar: "Bazaars",
  trip: "Trips",
  booth: "Booths",
};

// staff/professor/ta/student → can see ALL types
function roleAllowedTypes(role) {
  const r = (role || "").toLowerCase();
  const all = ["workshop", "trip", "conference", "bazaar", "booth"];
  if (["student", "staff", "ta", "teaching assistant", "professor"].includes(r)) return all;
  if (r === "vendor") return ["bazaar", "booth"];
  return all; // default: show everything
}

/* -- App activity helpers -------------------------------------------------- */
function normStatus(s) {
  const t = String(s || "").toLowerCase();
  if (t === "cancelled") return "canceled";
  return t;
}
function isActiveApp(app) {
  const st = normStatus(app?.status);
  return !["canceled", "rejected", "declined"].includes(st);
}

// only show workshops whose status is Accepted
function workshopIsVisible(ev) {
  if (!ev) return false;
  const t = normalizeType(ev.eventType || ev.type);
  if (t !== "workshop") return true;
  return String(ev.status || "").toLowerCase() === "accepted";
}

/** GET /event/:eventId/participants — accepted vendor names for this event */
async function getParticipants(eventId) {
  const json = await api(`/event/${eventId}/participants`);
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json)) return json;
  return [];
}

export default function EventsClient({ currentUserId = null, currentUserRole = null }) {
  const [events, setEvents] = useState([]);
  const [userApplications, setUserApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [appsLoading, setAppsLoading] = useState(false);
  const [error, setError] = useState(null);

  const allowedTypes = roleAllowedTypes(currentUserRole);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("startDateTime");
  const [selected, setSelected] = useState(null);
  const router = useRouter();

  // ensure the current filter is valid for the role (otherwise reset to "all")
  useEffect(() => {
    if (typeFilter !== "all" && !allowedTypes.includes(typeFilter)) {
      setTypeFilter("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserRole]);

  // Banner
  const [banner, setBanner] = useState({ text: "", tone: "info" });
  const Banner = ({ text, tone }) => {
    if (!text) return null;
    const toneClass =
      tone === "error"
        ? "bg-red-600/25 text-red-200 border-red-400/40"
        : "bg-emerald-600/25 text-emerald-200 border-emerald-400/40";
    return <div className={`mb-4 rounded-xl px-3 py-2 text-sm border ${toneClass}`}>{text}</div>;
  };

  // inline non-vendor form state
  const [regFormVisible, setRegFormVisible] = useState(false);
  const [regFormData, setRegFormData] = useState({ name: "", email: "", studentId: "" });
  const [formErrors, setFormErrors] = useState({});

  // tiny cache for professor lookups
  const profCacheRef = useRef({});

  /* ------------------- Fetch events ------------------- */
  useEffect(() => {
    let mounted = true;
    const fetchEvents = async () => {
      try {
        const data = await api("/event");
        const payload = data && data.data ? data.data : Array.isArray(data) ? data : [];
        if (!mounted) return;
        setEvents(payload);
      } catch (err) {
        console.error("Failed to load events", err);
        if (mounted) setError(err.message || "Failed to load events");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchEvents();
    return () => { mounted = false; };
  }, []);

  /* ---- Fetch user's applications ---- */
  const refreshUserApplications = async () => {
    if (!currentUserId) {
      setUserApplications([]);
      return;
    }
    try {
      setAppsLoading(true);
      const apps = await applicationsService.listByUser(currentUserId);
      setUserApplications(Array.isArray(apps) ? apps.filter(isActiveApp) : []);
    } catch {
      setUserApplications([]);
    } finally {
      setAppsLoading(false);
    }
  };

  useEffect(() => {
    refreshUserApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  /* ---------------- Details modal side-effects ---------------- */
  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "auto";
    return () => { document.body.style.overflow = "auto"; };
  }, [selected]);

  async function resolveProfessors(list) {
    if (!Array.isArray(list) || list.length === 0) return [];
    const ids = list
      .map((p) => (typeof p === "string" ? p : p?._id || p?.id))
      .filter(Boolean)
      .map(String);

    const results = await Promise.all(
      ids.map(async (id) => {
        if (id in profCacheRef.current) return profCacheRef.current[id];
        const prof = await publicService.getProfessorById(id);
        if (prof && (prof.fullName || prof.email)) {
          const norm = {
            _id: prof._id || id,
            fullName: prof.fullName || prof.email,
            email: prof.email || "",
          };
          profCacheRef.current[id] = norm;
          return norm;
        }
        profCacheRef.current[id] = null;
        return null;
      })
    );

    return results.filter(Boolean);
  }

  // open details; also fetch participating vendors when applicable
  async function openDetails(event) {
    setSelected(event);
    setRegFormVisible(false);
    setFormErrors({});

    try {
      // 1) Resolve professors
      const raw = Array.isArray(event.professors) ? event.professors : [];
      if (raw.length > 0) {
        const resolved = await resolveProfessors(raw);
        setSelected((prev) => ({ ...(prev || {}), professors: resolved || [] }));
      }

      // 2) If role is staff/professor/ta/student AND type is bazaar/booth → fetch participants
      const r = (currentUserRole || "").toLowerCase();
      const canSeeParticipants = ["student", "staff", "ta", "teaching assistant", "professor"].includes(r);
      const t = normalizeType(event.eventType || event.type);
      if (canSeeParticipants && (t === "bazaar" || t === "booth")) {
        const eid = event._id || event.id;
        const names = await getParticipants(eid).catch(() => []);
        setSelected((prev) => ({ ...(prev || {}), participantsVendors: names }));
      }
    } catch (err) {
      console.error("openDetails error:", err);
    }
  }

  function closeDetails() {
    setSelected(null);
    setRegFormVisible(false);
    setRegFormData({ name: "", email: "", studentId: "" });
    setFormErrors({});
  }

  /* --------------- Vendor-specific navigation --------------- */
  const goVendorApply = (ev) => {
    const id = ev._id || ev.id;
    const t = normalizeType(ev.eventType || ev.type);
    if (t === "bazaar") {
      router.push(`/vendorApplyingBazaars/${id}`);
      return true;
    }
    if (t === "booth") {
      router.push(`/vendorApplyingBoothPlat/${id}`);
      return true;
    }
    return false;
  };

  /* --------------- Is event already submitted? --------------- */
  const isSubmitted = (eventId) => {
    if (!currentUserId || !Array.isArray(userApplications)) return false;
    const eid = String(eventId);
    return userApplications.some((a) => {
      if (!isActiveApp(a)) return false;
      const appEventId = a.eventId || a.event?.id || a.event?._id || a.event;
      return String(appEventId || "") === eid;
    });
  };

  // Helper: can vendor re-apply (register again) to a BOOTH even if already applied?
  const canRegisterAgain = (ev) => {
    const isVendor = (currentUserRole || "").toLowerCase() === "vendor";
    const isBooth = normalizeType(ev.eventType || ev.type) === "booth";
    return isVendor && isBooth;
  };

  /* --------- Derived: filter, search, sort for cards --------- */
  const filtered = events
    .map((ev) => ({ ...ev, _normType: normalizeType(ev.eventType || ev.type) }))
    .filter((ev) => allowedTypes.includes(ev._normType))
    // hide workshops that are not accepted
    .filter((ev) => workshopIsVisible(ev))
    .filter((ev) => (typeFilter === "all" ? true : ev._normType === typeFilter))
    .filter((ev) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        (ev.name && ev.name.toLowerCase().includes(q)) ||
        (ev.description && ev.description.toLowerCase().includes(q)) ||
        (Array.isArray(ev.professors) &&
          ev.professors.some((p) => (p.fullName || p.name || p.email || "").toLowerCase().includes(q)))
      );
    })
    .sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "price") return (b.price || 0) - (a.price || 0);
      return new Date(a.startDateTime || a.startDate || 0) - new Date(b.startDateTime || b.startDate || 0);
    });

  const registeredCount = currentUserId ? userApplications.length : 0;

  return (
    <div className="min-h-screen bg-gray-dark px-6 py-10 text-secondary">
      <div className="max-w-7xl mx-auto">
        <Banner text={banner.text} tone={banner.tone} />

        <header className="mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-1">Events Marketplace</h1>
            <p className="text-gray-300">
              Discover upcoming workshops, conferences, trips, bazaars and booths.
            </p>
          </div>

          <div className="mt-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <label htmlFor="events-search" className="block text-sm text-gray-300 mb-1">
                Search
              </label>
              <div className="relative">
                <input
                  id="events-search"
                  type="search"
                  placeholder="Search events, professors or topics..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-primary text-secondary border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="flex items-end gap-3">
              <div>
                <label htmlFor="type-filter" className="block text-sm text-gray-300 mb-1">
                  Type
                </label>
                <select
                  id="type-filter"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3 py-3 rounded-lg bg-primary text-secondary border border-gray-700"
                >
                  <option value="all">All types</option>
                  {roleAllowedTypes(currentUserRole).map((t) => (
                    <option key={t} value={t}>
                      {LABELS[t] || t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="sort-by" className="block text-sm text-gray-300 mb-1">
                  Sort by
                </label>
                <select
                  id="sort-by"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-3 rounded-lg bg-primary text-secondary border border-gray-700"
                >
                  <option value="startDateTime">Soonest</option>
                  <option value="name">Name</option>
                  <option value="price">Price</option>
                </select>
              </div>
            </div>
          </div>
        </header>

        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-gray-300">
            <FaRegCalendarAlt /> <span>{filtered.length} events</span>
            <span className="mx-2">•</span>
            <FaClipboardList /> <span>My registrations</span>
            <span className="ml-2 inline-flex items-center justify-center bg-green-600 text-white text-xs px-2 py-0.5 rounded">
              {appsLoading ? "…" : registeredCount}
            </span>
          </div>
          <button
            type="button"
            onClick={() => router.push("/events/registered")}
            className="ml-4 inline-flex items-center gap-2 px-3 py-1 rounded-md bg-primary text-secondary text-sm hover:opacity-95 transition"
            aria-label="View registered events"
          >
            View registrations
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-300">Loading events...</div>
        ) : error ? (
          <div className="text-center py-16 text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-300">No events match your filters.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
            {filtered.map((ev) => {
              const id = ev._id || ev.id;
              const submitted = isSubmitted(id);

              const t = normalizeType(ev.eventType || ev.type);
              const isVendor = (currentUserRole || "").toLowerCase() === "vendor";
              const isVendorFlow = t === "bazaar" || t === "booth";

              // Vendor can re-apply for booths specifically
              const allowRepeat = submitted && isVendor && t === "booth";

              const isBazOrBooth = ev._normType === "bazaar" || ev._normType === "booth";

              const handleRegisterClick = () => {
                // For bazaar/booth, only vendors may see / trigger vendor application flow
                if (isVendorFlow) {
                  if (!isVendor) return; // non-vendors should not be able to register/apply
                  goVendorApply(ev);
                  return;
                }

                // non-vendor flow (workshops, conferences, trips)
                setRegFormVisible(true);
                openDetails(ev);
              };

              return (
                <article
                  key={id}
                  className="bg-primary border border-gray-700 rounded-2xl p-6 hover:shadow-lg transition-shadow duration-200 flex flex-col h-full"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-28 h-28 bg-gradient-to-tr from-gray-700 to-gray-600 rounded-lg flex items-center justify-center text-2xl font-bold text-gray-200">
                      {(ev.eventType || ev.type)?.charAt(0)?.toUpperCase() || ev.name?.charAt(0)}
                    </div>

                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-secondary mb-1">{ev.name}</h3>
                      <p className="text-sm text-gray-300 mb-2">{shortText(ev.description, 120)}</p>

                      {/* Info section: special layout for bazaar/booth */}
                      {isBazOrBooth ? (
                        <div className="flex flex-col gap-2 text-xs text-gray-300">
                          <span className="flex items-center gap-2 px-2 py-1 bg-background-card rounded-md w-full">
                            <FaCalendarAlt />{" "}
                            <span className="w-full">
                              {formatDateRange(ev.startDateTime, ev.endDateTime)}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 px-2 py-1 bg-background-card rounded-md w-full">
                            <FaMapMarkerAlt /> <span className="w-full">{ev.location || "TBD"}</span>
                          </span>
                          {ev.price != null && (
                            <span className="text-sm font-semibold text-secondary self-end">
                              {currency(ev.price)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
                          <span className="flex items-center gap-2 px-2 py-1 bg-background-card rounded-md">
                            <FaCalendarAlt />{" "}
                            <span>{formatDateRange(ev.startDateTime, ev.endDateTime)}</span>
                          </span>
                          <span className="flex items-center gap-2 px-2 py-1 bg-background-card rounded-md">
                            <FaMapMarkerAlt /> <span>{ev.location || "TBD"}</span>
                          </span>
                          <span className="flex items-center gap-2 px-2 py-1 bg-background-card rounded-md">
                            <FaUsers /> <span>Capacity: {ev.capacity ?? "N/A"}</span>
                          </span>
                          {ev.price != null && (
                            <span className="ml-auto text-sm font-semibold text-secondary">
                              {currency(ev.price)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto flex items-center gap-3">
                    <button
                      onClick={() => openDetails(ev)}
                      className="flex-1 px-4 py-2 rounded-lg bg-secondary text-primary font-medium hover:opacity-95 transition"
                    >
                      View Details
                    </button>

                    {/* Register / Apply button:
                        - For bazaar/booth: only render for vendors
                        - For other types: render for everyone (non-vendor registration flow)
                    */}
                    {isVendorFlow ? (
                      // vendor-only apply button
                      isVendor ? (
                        <button
                          onClick={handleRegisterClick}
                          className="px-4 py-2 rounded-lg border bg-transparent text-secondary border-border hover:bg-secondary hover:text-primary"
                        >
                          {submitted ? (allowRepeat ? "Register Again" : "Submitted") : t === "bazaar" ? "Apply for this Bazaar" : "Apply for this Booth"}
                        </button>
                      ) : null
                    ) : (
                      // regular register button for workshops/trips/conferences
                      <button
                        onClick={() => {
                          if (submitted && !allowRepeat) return;
                          handleRegisterClick();
                        }}
                        disabled={submitted && !allowRepeat}
                        className={`px-4 py-2 rounded-lg border ${
                          submitted && !allowRepeat
                            ? "bg-gray-600 text-white border-gray-600 cursor-not-allowed"
                            : "bg-transparent text-secondary border-border hover:bg-secondary hover:text-primary"
                        }`}
                      >
                        {submitted ? (allowRepeat ? "Register Again" : "Submitted") : "Register"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Details modal */}
        {selected && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-primary border border-gray-700 rounded-2xl w-full max-w-3xl text-secondary max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-start gap-6">
                  <div className="w-24 h-24 bg-gradient-to-tr from-gray-700 to-gray-600 rounded-lg flex items-center justify-center text-3xl font-bold text-gray-200">
                    {(selected.eventType || selected.type)?.charAt(0)?.toUpperCase() || selected.name?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-secondary mb-1">{selected.name}</h2>
                    <p className="text-sm text-gray-300 mb-3">
                      {selected.fullAgenda || shortText(selected.description, 300)}
                    </p>

                    {/* ALWAYS: dates, location, capacity each on its own full row */}
                    <div className="grid grid-cols-1 gap-3 text-sm text-gray-300">
                      <div className="flex items-center gap-2">
                        <FaCalendarAlt />{" "}
                        <span>{formatDateRange(selected.startDateTime, selected.endDateTime)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FaMapMarkerAlt /> <span>{selected.location || "N/A"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FaUsers /> <span>Capacity: {selected.capacity ?? "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="ml-4 text-right">
                    {selected.price != null && (
                      <div className="text-lg font-semibold mb-2">{currency(selected.price)}</div>
                    )}
                    <div className="text-xs text-gray-400">Organized by: {selected.createdBy || "GUC"}</div>
                  </div>
                </div>

                {/* Professors — list vertically */}
                {Array.isArray(selected.professors) && selected.professors.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-secondary mb-2">Professors</h4>
                    <ul className="space-y-2 text-sm text-gray-300">
                      {selected.professors.map((p) => (
                        <li key={p._id} className="px-3 py-2 bg-background-card rounded-md">
                          {p.fullName || p.email}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Participating Vendors — ONLY for staff/professor/ta/student AND bazaar/booth, listed vertically */}
                {(() => {
                  const r = (currentUserRole || "").toLowerCase();
                  const showForRole = ["student", "staff", "ta", "teaching assistant", "professor"].includes(r);
                  const t = normalizeType(selected.eventType || selected.type);
                  const showForType = t === "bazaar" || t === "booth";
                  const names = selected.participantsVendors;

                  if (!showForRole || !showForType || !Array.isArray(names) || names.length === 0) return null;

                  return (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-secondary mb-2">Participating Vendors</h4>
                      <ul className="space-y-2 text-sm text-gray-300">
                        {names.map((n, i) => (
                          <li key={`${n}-${i}`} className="px-3 py-2 bg-background-card rounded-md">
                            {n}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                {/* Extra resources */}
                {Array.isArray(selected.extraRequiredResources) && selected.extraRequiredResources.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-secondary mb-2">Required resources</h4>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-300">
                      {selected.extraRequiredResources.map((r) => (
                        <li
                          key={r._id || r.resourceName}
                          className="flex items-center justify-between px-3 py-2 bg-background-card rounded-md"
                        >
                          <span className="flex items-center gap-2">
                            <FaTag /> {r.resourceName}
                          </span>
                          <span className="font-medium">{r.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex items-center gap-3">
                  {(() => {
                    const already = isSubmitted(selected._id || selected.id);
                    const t = normalizeType(selected.eventType || selected.type);
                    const isBooth = t === "booth";
                    const isVendor = (currentUserRole || "").toLowerCase() === "vendor";
                    const isVendorFlow = t === "bazaar" || t === "booth";
                    const allowRepeat = already && isVendor && isBooth; // enable re-apply

                    if (!regFormVisible || isVendorFlow) {
                      return (
                        <>
                          <button
                            onClick={() => {
                              // if already submitted but vendor can re-apply to a booth → still route
                              if (already && !(isVendor && isBooth)) return;
                              if (isVendorFlow) {
                                if (isVendor) {
                                  goVendorApply(selected);
                                }
                                return;
                              }
                              setRegFormVisible(true);
                              setFormErrors({});
                            }}
                            className="px-4 py-2 rounded-lg bg-secondary text-primary disabled:opacity-60"
                            disabled={already && !allowRepeat}
                          >
                            {already
                              ? allowRepeat
                                ? "Register Again"
                                : "Submitted"
                              : isVendorFlow
                              ? t === "bazaar"
                                ? "Apply for this Bazaar"
                                : "Apply for this Booth"
                              : "Register for this event"}
                          </button>
                          <button onClick={closeDetails} className="px-4 py-2 rounded-lg bg-gray-dark">
                            Close
                          </button>
                        </>
                      );
                    }

                    // Inline registration form for non-vendor types
                    return (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const errors = {};
                          if (!regFormData.name.trim()) errors.name = "Name is required";
                          if (!regFormData.email.trim()) errors.email = "Email is required";
                          else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regFormData.email))
                            errors.email = "Email is invalid";
                          if (!regFormData.studentId.trim()) errors.studentId = "Student/Staff ID is required";
                          if (!currentUserId) errors.auth = "Please sign in to register.";

                          setFormErrors(errors);
                          if (Object.keys(errors).length > 0) return;

                          const eventId = selected._id || selected.id;

                          try {
                            await applicationsService.create({
                              userId: currentUserId,
                              eventId,
                              participants: [
                                {
                                  name: regFormData.name.trim(),
                                  email: regFormData.email.trim(),
                                },
                              ],
                              gucID: regFormData.studentId.trim(),
                            });

                            await refreshUserApplications();
                            setBanner({ text: "Registration submitted.", tone: "success" });
                            setRegFormVisible(false);
                          } catch (err) {
                            setFormErrors({
                              submit: err?.message || "Registration failed. Please try again.",
                            });
                            setBanner({ text: "Registration failed. Please try again.", tone: "error" });
                          }
                        }}
                        className="space-y-3 mt-3 w-full"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input
                            className="px-3 py-2 rounded bg-primary text-secondary border border-gray-700"
                            placeholder="Full name"
                            value={regFormData.name}
                            onChange={(e) => setRegFormData((s) => ({ ...s, name: e.target.value }))}
                          />
                          <input
                            className="px-3 py-2 rounded bg-primary text-secondary border border-gray-700"
                            placeholder="Email"
                            value={regFormData.email}
                            onChange={(e) => setRegFormData((s) => ({ ...s, email: e.target.value }))}
                          />
                          <input
                            className="px-3 py-2 rounded bg-primary text-secondary border border-gray-700"
                            placeholder="Student / Staff ID"
                            value={regFormData.studentId}
                            onChange={(e) => setRegFormData((s) => ({ ...s, studentId: e.target.value }))}
                          />
                        </div>
                        <div className="flex gap-3">
                          <button type="submit" className="px-4 py-2 rounded bg-secondary text-primary">
                            Submit
                          </button>
                          <button
                            type="button"
                            onClick={() => setRegFormVisible(false)}
                            className="px-4 py-2 rounded bg-gray-dark"
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="text-sm text-red-500">
                          {Object.values(formErrors).map((m, i) => (
                            <div key={i}>{m}</div>
                          ))}
                        </div>
                      </form>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
