"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { FaUndo } from "react-icons/fa";
import { applicationsService } from "@/app/services/applications.service";
import { eventsService } from "@/app/services/events.service";
import Pagination from "@/components/pagination";
import { formatLocalTime } from "@/lib/dateFormatter";

// Small inline pay icon to match button style
const PayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="6" width="18" height="12" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 9h18M7 14h6" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function normalizeEvent(eventish) {
  if (!eventish) return null;
  if (eventish.data && (eventish.data._id || eventish.data.name || eventish.data.title)) return eventish.data;
  if (eventish._id || eventish.name || eventish.title) return eventish;
  return null;
}

const fetchEventById = async (id) => {
  const res = await eventsService.getById(id);
  return (res && res.data) ? res.data : res;
};

function mapRow(app, eventDocRaw) {
  const ev = normalizeEvent(eventDocRaw) || {};
  const name   = ev.name || ev.title || "";
  const type   = ev.eventType || ev.type || "";
  const start  = ev.startDateTime || ev.startsAt || null;
  const end    = ev.endDateTime || ev.endsAt || null;
  const loc    = ev.location || "";
  const vendor = app?.applicantName || "";
  return {
    id: app._id,
    eventName: name,
    eventType: type,
    start, end,
    location: loc,
    status: cap(app.status || "pending"),
    app,
    eventDoc: ev,
    vendorName: vendor,
  };
}

/* --------------------- Details Modal --------------------- */
const hasValue = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
};

function ApplicationDetailsModal({ row, onClose }) {
  if (!row) return null;

  const { app, eventDoc } = row;
  const participants = Array.isArray(app?.participants) ? app.participants.filter(p => hasValue(p?.name) || hasValue(p?.email)).slice(0, 5) : [];

  const fields = [
    { label: "Event", value: eventDoc?.name || eventDoc?.title },
    { label: "Type", value: cap(eventDoc?.eventType || eventDoc?.type) },
    { label: "Vendor", value: row?.vendorName },
    { label: "Location", value: row.location },
    { label: "Start", value: row.start ? formatLocalTime(row.start) : "" },
    { label: "End", value: row.end ? formatLocalTime(row.end) : "" },
    { label: "Status", value: cap(app?.status) },
    { label: "Booth Size", value: app?.boothSize },
    { label: "Setup Duration (weeks)", value: app?.setupDurationWeeks },
    { label: "Setup Location", value: app?.setupLocation },
    { label: "Booth Number", value: app?.boothNumber },
    { label: "Notes", value: app?.notes },
  ];

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4">
      <div className="bg-surface text-root-primary rounded-2xl p-6 w-full max-w-lg space-y-4 relative overflow-auto max-h-[90vh] shadow-elevated border border-root">
        <button onClick={onClose} className="absolute top-3 right-3 text-root-secondary hover:text-root-primary text-lg">
          ✕
        </button>

        <h2 className="text-xl text-center font-semibold mb-2">Application Details</h2>

        <div className="space-y-2 text-sm">
          {fields
            .filter((f) => hasValue(f.value))
            .map((f) => (
              <p key={f.label}>
                <strong>{f.label}:</strong> {f.value}
              </p>
            ))}

          {participants.length > 0 && (
            <div className="mt-2">
              <strong>Participants (max 5):</strong>
              <ul className="list-disc pl-5 mt-1">
                {participants.map((p, i) => (
                  <li key={i}>
                    {hasValue(p.name) ? p.name : ""}
                    {hasValue(p.name) && hasValue(p.email) ? " — " : ""}
                    {hasValue(p.email) ? (
                      <a className="text-root-primary underline" href={`mailto:${p.email}`}>{p.email}</a>
                    ) : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-2xl bg-primary text-root-primary hover:opacity-90">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------- Page --------------------- */
export default function VendorRequests({ vendorId, role = "vendor" }) {
  const isStaff = ["admin", "event_office"].includes(String(role || "").toLowerCase());

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);

  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState({ text: "", tone: "info" });
  const [selected, setSelected] = useState(null);

  // ---- NEW: filters like users page.jsx
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | pending | accepted | rejected
  const [eventTypeFilter, setEventTypeFilter] = useState("all");

  // --- NEW: sorting (like users page.jsx)
  const [sortKey, setSortKey] = useState(null); // 'event' | 'type' | 'vendor' | 'start' | 'end' | 'status'
  const [sortDir, setSortDir] = useState("asc");

  const toggleSort = (key) => {
    setPage(1);
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const caret = (key) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  // --- ADDED: SortBtn component (same pattern as users page)
  const SortBtn = ({ k, children, align = "left" }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className={`w-full text-${align} p-2 hover:opacity-80`}
      title={`Sort by ${children}`}
    >
      {children}
      {caret(k)}
    </button>
  );

  // Load applications + related events
  const load = useCallback(async () => {
    setLoading(true);
    setBanner({ text: "", tone: "info" });
    try {
      const apps = isStaff
        ? await applicationsService.list({})
        : await applicationsService.listByUser(vendorId, {});

      const cache = new Map();
      const getEvent = async (id) => {
        const key = String(id);
        if (cache.has(key)) return cache.get(key);
        const doc = await fetchEventById(key).catch(() => null);
        cache.set(key, doc);
        return doc;
      };

      const rows = await Promise.all(
        (apps || []).map(async (app) => {
          let ev =
            normalizeEvent(app.event) ||
            normalizeEvent(app.eventId);

          if (!ev && app.eventId && typeof app.eventId === "string") {
            ev = await getEvent(app.eventId);
          }
          return mapRow(app, ev);
        })
      );

      setAllRows(rows);
    } catch (e) {
      setBanner({ text: e?.message || "Failed to load applications", tone: "error" });
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [isStaff, vendorId]);

  useEffect(() => {
    load();
  }, [load]);

  // derive available event types for the filter
  const eventTypeOptions = useMemo(() => {
    const set = new Set();
    (allRows || []).forEach((r) => {
      if (r.eventType) set.add(String(r.eventType));
    });
    return ["all", ...Array.from(set).sort()];
  }, [allRows]);

  // apply filters client-side (debounce pagination reset)
  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, eventTypeFilter]);

  const filtered = useMemo(() => {
    const ql = String(q || "").trim().toLowerCase();
    const base = (allRows || []).filter((r) => {
      if (statusFilter && statusFilter !== "all") {
        const st = String(r.status || "").toLowerCase();
        if (st !== String(statusFilter).toLowerCase()) return false;
      }
      if (eventTypeFilter && eventTypeFilter !== "all") {
        const et = String(r.eventType || "").toLowerCase();
        if (et !== String(eventTypeFilter).toLowerCase()) return false;
      }
      if (!ql) return true;
      // search in event name and vendor name
      const name = String(r.eventName || "").toLowerCase();
      const vendor = String(r.vendorName || "").toLowerCase();
      return name.includes(ql) || vendor.includes(ql);
    });

    // apply sorting
    if (!sortKey) return base;

    const arr = [...base];
    arr.sort((a, b) => {
      let av, bv;

      switch (sortKey) {
        case "event":
          av = String(a.eventName || "").toLowerCase();
          bv = String(b.eventName || "").toLowerCase();
          break;
        case "type":
          av = String(a.eventType || "").toLowerCase();
          bv = String(b.eventType || "").toLowerCase();
          break;
        case "vendor":
          av = String(a.vendorName || "").toLowerCase();
          bv = String(b.vendorName || "").toLowerCase();
          break;
        case "start":
          av = a.start ? new Date(a.start).getTime() : 0;
          bv = b.start ? new Date(b.start).getTime() : 0;
          break;
        case "end":
          av = a.end ? new Date(a.end).getTime() : 0;
          bv = b.end ? new Date(b.end).getTime() : 0;
          break;
        case "status":
          av = String(a.status || "").toLowerCase();
          bv = String(b.status || "").toLowerCase();
          break;
        default:
          av = "";
          bv = "";
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return arr;
  }, [allRows, q, statusFilter, eventTypeFilter, sortKey, sortDir]);

  // Pagination
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * limit;
  const pageRows = filtered.slice(startIdx, startIdx + limit);

  // Actions (unchanged)
  const patchRowStatus = (appId, newStatus) => {
    setAllRows((prev) =>
      prev.map((r) => (r.id === appId ? { ...r, status: cap(newStatus), app: { ...r.app, status: newStatus } } : r))
    );
  };

  const handleAccept = async (row) => {
    try {
      await applicationsService.accept(row.id);
      patchRowStatus(row.id, "accepted");
      setBanner({ text: "Application accepted.", tone: "success" });
    } catch (e) {
      setBanner({ text: `Failed to accept: ${String(e?.message || e)}`, tone: "error" });
    }
  };

  const handleReject = async (row) => {
    try {
      await applicationsService.reject(row.id);
      patchRowStatus(row.id, "rejected");
      setBanner({ text: "Application rejected.", tone: "success" });
    } catch (e) {
      setBanner({ text: `Failed to reject: ${String(e?.message || e)}`, tone: "error" });
    }
  };

  const handleCancel = async (row) => {
    try {
      await applicationsService.cancel(row.id);
      patchRowStatus(row.id, "rejected");
      setBanner({ text: "Application cancelled.", tone: "success" });
    } catch (e) {
      setBanner({ text: `Failed to cancel: ${String(e?.message || e)}`, tone: "error" });
    }
  };

  const Banner = ({ text, tone }) => {
    if (!text) return null;
    const toneClass =
      tone === "error"
        ? "bg-red-600/25 text-red-200 border-red-400/40"
        : tone === "success"
        ? "bg-green-600/25 text-green-200 border-green-400/40"
        : "bg-black/30 text-secondary border-white/10";
    return <div className={`mb-3 rounded-xl px-3 py-2 text-sm border ${toneClass}`}>{text}</div>;
  };

  return (
    <main className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl text-white font-semibold">
          {isStaff ? "Vendor Participation Requests" : "Your Requests"}
        </h1>

        <Link
          href="/admin"
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-root-primary hover:opacity-90 transition"
        >
          <FaUndo className="text-lg" /> Home
        </Link>
      </div>

      {/* --- ADDED: Filters (styled like users page.jsx) */}
      <div className="p-4 rounded-2xl bg-surface text-root-secondary">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Search</label>
            <input
              className="px-3 py-2 rounded input-surface"
              placeholder="Event name or vendor…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Status</label>
            <select
              className="px-3 py-2 rounded input-surface"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {["all", "pending", "accepted", "rejected"].map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All" : cap(s)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Event type</label>
            <select
              className="px-3 py-2 rounded input-surface"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
            >
              {eventTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {t === "all" ? "All" : cap(String(t))}
                </option>
              ))}
            </select>
          </div>

          {/* removed Apply/Reset buttons */}
          <div className="flex items-end">
            <div className="w-full" />
          </div>
        </div>
      </div>
      {/* --- END filters */}

      {/* Banner */}
      <Banner text={banner.text} tone={banner.tone} />

      {/* Table Card */}
      <div className="p-4 rounded-2xl bg-surface text-root-primary">
        {loading ? (
          <p>Loading...</p>
        ) : pageRows.length === 0 ? (
          <p className="opacity-70">No Applications found.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-root-secondary opacity-80">
                <tr>
                  <th className="text-left">
                    <SortBtn k="event">Event</SortBtn>
                  </th>
                  <th className="text-left">
                    <SortBtn k="type">Type</SortBtn>
                  </th>
                  <th className="text-left">
                    <SortBtn k="vendor">Vendor</SortBtn>
                  </th>
                  <th className="text-left">
                    <SortBtn k="start">Start</SortBtn>
                  </th>
                  <th className="text-left">
                    <SortBtn k="end">End</SortBtn>
                  </th>
                  <th className="text-left p-2">Location</th>
                  <th className="text-left">
                    <SortBtn k="status">Status</SortBtn>
                  </th>
                  <th className="text-center p-2">Actions</th>
                  <th className="text-center p-2">View</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="border-t border-root">
                    <td className="p-2">{r.eventName || ""}</td>
                    <td className="p-2">{cap(r.eventType) || ""}</td>
                    <td className="p-2">{r.vendorName || ""}</td>
                    <td className="p-2">{r.start ? formatLocalTime(r.start) : ""}</td>
                    <td className="p-2">{r.end ? formatLocalTime(r.end) : ""}</td>
                    <td className="p-2">{r.location || ""}</td>
                    <td className="p-2">
                      {(() => {
                        const st = String(r.status || "");
                        if (st === "Pending")
                          return (
                            <span className="inline-block px-2 py-0.5 rounded text-xs bg-yellow-600/40">
                              {r.status}
                            </span>
                          );
                        if (st === "Accepted" || st === "Approved")
                          return (
                            <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-600/40">
                              {r.status}
                            </span>
                          );
                        if (st === "Rejected")
                          return (
                            <span className="inline-block px-2 py-0.5 rounded text-xs bg-red-600/40">
                              {r.status}
                            </span>
                          );
                        return (
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-black/30">
                            {r.status || "n/a"}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-2 text-center">
                      {isStaff ? (
                        r.status === "Pending" ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="px-3 py-1 rounded bg-primary text-root-primary text-sm"
                              onClick={() => handleAccept(r)}
                            >
                              Accept
                            </button>
                            <button
                              className="px-3 py-1 rounded border border-root text-root-primary text-sm hover:bg-white/10"
                              onClick={() => handleReject(r)}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="opacity-60">—</span>
                        )
                      ) : r.status === "Pending" ? (
                        <button
                          className="px-3 py-1 rounded border border-root text-root-primary text-sm hover:bg-white/10"
                          onClick={() => handleCancel(r)}
                        >
                          Cancel
                        </button>
                      ) : r.status === "Accepted" ? (
                        <button
                          className="px-3 py-1 rounded bg-primary text-root-primary text-sm inline-flex items-center gap-2"
                          onClick={() => alert(`Proceed to pay for ${r.eventName}`)}
                        >
                          <PayIcon /> Pay
                        </button>
                      ) : (
                        <span className="opacity-60">—</span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        className="px-3 py-1 rounded-2xl bg-white/10 hover:bg-white/15 text-root-primary text-sm"
                        onClick={() => setSelected(r)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              page={currentPage}
              limit={limit}
              totalCount={totalCount}
              onPageChange={(newPage) => setPage(newPage)}
              onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
            />
          </div>
        )}
      </div>

      {selected && <ApplicationDetailsModal row={selected} onClose={() => setSelected(null)} />}

      {/* Details modal (small styling adjustments to use globals) */}
    </main>
  );
}
