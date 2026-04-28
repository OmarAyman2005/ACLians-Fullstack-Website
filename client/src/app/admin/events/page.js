"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/admin/eventApi.js";
import { formatLocalTime } from "@/lib/dateFormatter.js";
import Pagination from "@/components/pagination.js";
import FilterPanel from "@/components/filterPanel.js";
import { ActionsDropdown } from "@/components/actionDropdown.js";
import { EventDetailsModal } from "./eventDetails.js";
import Link from "next/link";
import { FaUndo } from "react-icons/fa";
import Toast from "@/components/toast.js";

export default function EventsAdmin() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState({ text: "", tone: "info" });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ visible: false, id: null });

  // toast timer ref used by showToast
  const toastTimerRef = useRef(null);
  const [toast, setToast] = useState(null);

  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(null);
  const DEFAULT_TOAST_DURATION = 4000;

  // professors list for filter dropdown
  const [professors, setProfessors] = useState([]);
  useEffect(() => {
    let mounted = true;
    const loadProfessors = async () => {
      try {
        const res = await api("/public/professors");
        let payload = res;
        if (res && typeof res.json === "function") payload = await res.json();
        const list = payload?.data ?? payload ?? [];
        if (!mounted) return;
        setProfessors(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("Failed to load professors for filter:", err);
        if (mounted) setProfessors([]);
      }
    };
    loadProfessors();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api("/auth/me");
        let payload = res;
        if (res && typeof res.json === "function") payload = await res.json();
        const me = payload?.data ?? payload?.user ?? payload;
        if (!mounted) return;
        if (me?.role !== "event_office" && me?.role !== "admin") {
          setHasAccess(false);
          router.replace("/404");
          return;
        }
        setHasAccess(true);
      } catch (err) {
        setHasAccess(false);
        router.replace("/404");
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  // Pagination + Filters
  const [filters, setFilters] = useState({
    name: "",
    location: "",
    startDateTime: "",
    endDateTime: "",
    page: 1,
    limit: 5,
    sortBy: "name",
    sortOrder: "asc",
  });

  const [totalCount, setTotalCount] = useState(0);

  // helper: check if event contains professor id (supports ids or populated objects)
  const eventHasProfessor = (event, profId) => {
    if (!event || !profId) return false;
    const arr = event.professors || event.professor || event.professorsIds || [];
    if (!Array.isArray(arr)) return false;
    return arr.some((p) => {
      if (!p) return false;
      // p may be a string id, or object with _id or id
      if (typeof p === "string" || typeof p === "number") return String(p) === String(profId);
      const pid = p._id ?? p.id ?? p.professorId ?? null;
      return pid && String(pid) === String(profId);
    });
  };

  const load = async () => {
    setLoading(true);
    setBanner({ text: "", tone: "info" });
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== "professor") params.append(key, value);
        // do not append professor here if you prefer client-side filtering,
        // but if backend supports it you can append it too:
        else if (value && key === "professor") params.append(key, value);
      });

      const data = await api(`/event?${params.toString()}`);
      let eventsList = data.data || [];

      // If professor filter is set, ensure we filter events where the event's professors array contains that id.
      if (filters.professor) {
        eventsList = eventsList.filter((ev) => eventHasProfessor(ev, filters.professor));
      }

      setEvents(eventsList);
      setTotalCount(data.totalEvents ?? eventsList.length ?? 0);
    } catch (e) {
      // use shared Toast component for transient error notification
      showToast(e.message || "Failed to load events", "error", DEFAULT_TOAST_DURATION);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) load();
  }, [filters, hasAccess]);

  if (hasAccess === null) return <main className="p-8">Checking permissions...</main>;
  if (hasAccess === false) return null;

  const Banner = ({ text, tone }) => {
    if (!text) return null;
    const toneClass =
      tone === "error"
        ? "bg-red-600/25 text-red-200 border-red-400/40"
        : tone === "success"
          ? "bg-green-600/25 text-green-200 border-green-400/40"
          : "bg-black/30 text-secondary border-white/10";
    return (
      <div className={`mb-3 rounded-xl px-3 py-2 text-sm border ${toneClass}`}>
        {text}
      </div>
    );
  };

  const confirmDeleteBazaar = (id) => {
    setConfirmDelete({ visible: true, id });
  };

  const handleDelete = async () => {
    try {
      const res = await api(`/event/${confirmDelete.id}`, { method: "DELETE" });
      // api helper may return a payload object
      if (res && res.status === "error") {
        const msg = res.message || "Failed to delete event";
        // show specific toast when deletion blocked by registrations
        if (String(msg).toLowerCase().includes("registration") || String(msg).toLowerCase().includes("registr")) {
          showToast(msg, "error");
        } else {
          showToast(msg, "error");
        }
      } else {
        showToast("Event deleted successfully", "success");
        await load();
      }
    } catch (e) {
      const msg = e?.message || (e && String(e)) || "Failed to delete event";
      if (String(msg).toLowerCase().includes("registration") || String(msg).toLowerCase().includes("registr")) {
        showToast(msg, "error");
      } else {
        showToast(msg, "error");
      }
    } finally {
      setConfirmDelete({ visible: false, id: null });
    }
  };

  const handleView = (event) => {
    setSelectedEvent(event);
  };

  const totalPages = Math.ceil(totalCount / filters.limit);

  const ConfirmModal = ({ visible, onCancel, onConfirm }) => {
    if (!visible) return null;
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4">
        <div className="bg-surface text-root-primary rounded-2xl p-6 w-96 text-center space-y-4 shadow-elevated border border-root">
          <p className="text-lg font-medium">Are you sure you want to delete this Event?</p>
          <div className="flex justify-center gap-4">
            <button
              className="px-4 py-2 rounded-lg input-surface hover:opacity-90 transition hover:cursor-pointer"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-error text-root-primary hover:opacity-90 transition hover:cursor-pointer"
              onClick={onConfirm}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  // showToast sets a transient toast (uses shared components/toast.js)
  const showToast = (text = "", type = "success", timeout = DEFAULT_TOAST_DURATION) => {
    // clear existing toast timer if present
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    setToast({ message: text || "", type: type || "success" });

    if (timeout > 0) {
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, timeout);
    }
  };

  return (
    <main className="p-8 space-y-6">
      {/* Shared transient toast (top-center) */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <Toast
            message={toast.message}
            type={toast.type}
            duration={DEFAULT_TOAST_DURATION}
            onClose={() => {
              if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
                toastTimerRef.current = null;
              }
              setToast(null);
            }}
          />
        </div>
      )}
      <ConfirmModal
        visible={confirmDelete.visible}
        onCancel={() => setConfirmDelete({ visible: false, id: null })}
        onConfirm={handleDelete}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-semibold text-root-primary hover:opacity-80 transition">Events</h1>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-root-primary hover:opacity-90 transition"
          >
            <FaUndo className="text-lg" /> Home
          </Link>
        </div>
      </div>
      
      {/* Banner */}
      <Banner text={banner.text} tone={banner.tone} />
      
      {/* Filters (replaced FilterPanel with vendor-requests style controls) */}
      <div className="p-4 rounded-2xl bg-surface text-root-secondary">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Search</label>
            <input
              className="px-3 py-2 rounded input-surface"
              placeholder="Event name…"
              value={filters.name}
              onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value, page: 1 }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Event type</label>
            <select
              className="px-3 py-2 rounded input-surface"
              value={filters.eventType || ""}
              onChange={(e) => setFilters((f) => ({ ...f, eventType: e.target.value || "", page: 1 }))}
            >
              <option value="">All</option>
              <option value="bazaar">Bazaar</option>
              <option value="conference">Conference</option>
              <option value="trip">Trip</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Professor</label>
            <select
              className="px-3 py-2 rounded input-surface"
              value={filters.professor || ""}
              onChange={(e) => setFilters((f) => ({ ...f, professor: e.target.value || "", page: 1 }))}
            >
              <option value="">All</option>
              {professors.map((p) => (
                <option key={p._id ?? p.id ?? String(p)} value={p._id ?? p.id ?? p}>
                  {p.fullName ?? p.name ?? String(p)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Start Date From</label>
            <input
              type="datetime-local"
              className="px-3 py-2 rounded input-surface"
              value={filters.startDateTime || ""}
              onChange={(e) => setFilters((f) => ({ ...f, startDateTime: e.target.value || "", page: 1 }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">End Date To</label>
            <input
              type="datetime-local"
              className="px-3 py-2 rounded input-surface"
              value={filters.endDateTime || ""}
              onChange={(e) => setFilters((f) => ({ ...f, endDateTime: e.target.value || "", page: 1 }))}
            />
          </div>

          <div className="flex items-end">
            <div className="w-full" />
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="p-4 rounded-2xl bg-surface text-root-primary">
         {loading ? (
           <p>Loading...</p>
         ) : events.length === 0 ? (
           <p className="opacity-70">No Events Found.</p>
         ) : (
           <div className="overflow-auto">
             <table className="w-full text-sm">
               <thead className="text-root-secondary opacity-80">
                 <tr>
                   {[
                     { key: "name", label: "Name" },
                     { key: "location", label: "Location" },
                     { key: "startDateTime", label: "Start" },
                     { key: "endDateTime", label: "End" },
                     { key: "eventType", label: "Event Type" },
                   ].map(({ key, label }) => (
                     <th
                       key={key}
                       onClick={() =>
                         setFilters((prev) => ({
                           ...prev,
                           sortBy: key,
                           sortOrder:
                             prev.sortBy === key && prev.sortOrder === "asc"
                               ? "desc"
                               : "asc",
                         }))
                       }
                       className="text-left p-2 cursor-pointer select-none hover:opacity-80 transition"
                     >
                       {label}
                       {filters.sortBy === key && (
                         <span className="ml-1 text-xs">
                           {filters.sortOrder === "asc" ? "▲" : "▼"}
                         </span>
                       )}
                     </th>
                   ))}
                   <th className="p-2 text-center">Actions</th>
                 </tr>
               </thead>
               <tbody>
                 {events.map((e) => (
                   <tr key={e._id} className="border-t border-root">
                     <td className="p-2 text-root-primary">{e.name}</td>
                     <td className="p-2 text-root-primary">{e.location}</td>
                     <td className="p-2 text-root-primary">{formatLocalTime(e.startDateTime)}</td>
                     <td className="p-2 text-root-primary">{formatLocalTime(e.endDateTime)}</td>
                     <td className="p-2 text-root-primary">
                       {e.eventType
                         ? e.eventType.charAt(0).toUpperCase() + e.eventType.slice(1)
                         : ""}
                     </td>
                     <td className="p-2">
                       <div className="flex justify-center items-center">
                         <ActionsDropdown
                           event={e}
                           onDelete={() => confirmDeleteBazaar(e._id)}
                           onView={handleView}
                         />
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
 
             <Pagination
               page={filters.page}
               limit={filters.limit}
               totalCount={totalCount}
               onPageChange={(newPage) =>
                 setFilters((f) => ({ ...f, page: newPage }))
               }
               onLimitChange={(newLimit) =>
                 setFilters((f) => ({ ...f, limit: newLimit, page: 1 }))
               }
             />
           </div>
         )}
       </div>
 
       {selectedEvent && (
         <EventDetailsModal
           event={selectedEvent}
           onClose={() => setSelectedEvent(null)}
         />
       )}
     </main>
  );
}
