"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaUndo } from "react-icons/fa";
import { api } from "../../../lib/admin/eventApi.js";
import { ActionsDropdown } from "@/components/actionDropdown.js";
import { formatLocalTime, convertToUTC } from "@/lib/dateFormatter.js";
import { ConferenceAccordionForm } from "./conferenceAccordionForm.js";
import { ConferenceDetailsModal } from "./conferenceDetails.js";
import Pagination from "@/components/pagination.js";
import Toast from "@/components/toast.js";

export default function ConferencesAdmin() {
  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [detailsModal, setDetailsModal] = useState({ open: false, conference: null });

  const [toast, setToast] = useState({ message: "", type: "", visible: false });

  const [confirmDelete, setConfirmDelete] = useState({ visible: false, id: null });

  const [filters, setFilters] = useState({
    name: "",
    location: "",
    startDateTime: "",
    endDateTime: "",
    fundingSource: "",
    page: 1,
    limit: 5,
    sortBy: "name",
    sortOrder: "asc",
  });

  const [totalCount, setTotalCount] = useState(0);

  const [form, setForm] = useState({
    name: "",
    location: "",
    description: "",
    registrationDeadline: "",
    startDateTime: "",
    endDateTime: "",
    eventType: "conference",
    fullAgenda: "",
    conferenceWebsiteLink: "",
    budget: "",
    fundingSource: "GUC",
    extraRequiredResources: [{ resourceName: "", quantity: 1 }],
  });

  const resetForm = () =>
    setForm({
      name: "",
      location: "",
      description: "",
      registrationDeadline: "",
      startDateTime: "",
      endDateTime: "",
      eventType: "conference",
      fullAgenda: "",
      conferenceWebsiteLink: "",
      budget: "",
      fundingSource: "GUC",
      extraRequiredResources: [{ resourceName: "", quantity: 1 }],
    });

  const showToast = (message, type = "success", duration = 3000) => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast({ message: "", type: "", visible: false }), duration);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api("/auth/me");
        let payload = res;
        if (res && typeof res.json === "function") payload = await res.json();
        const me = payload?.data ?? payload?.user ?? payload;
        if (!mounted) return;
        if (me?.role !== "event_office") {
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
    return () => {
      mounted = false;
    };
  }, [router]);

  // 🔹 Load Conferences
  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append("eventType", "conference");

      const data = await api(`/conference?${params.toString()}`);
      setConferences(data.data || []);
      setTotalCount(data.totalConferences || 0);
    } catch (e) {
      showToast(e.message || "Failed to load conferences", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // only load when access is confirmed
    if (hasAccess) {
      load();
    }
  }, [
    filters.page,
    filters.limit,
    filters.name,
    filters.location,
    filters.startDateTime,
    filters.endDateTime,
    filters.sortBy,
    filters.sortOrder,
    filters.fundingSource,
    hasAccess,
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const preparedForm = {
      ...form,
      startDateTime: convertToUTC(form.startDateTime),
      endDateTime: convertToUTC(form.endDateTime),
      registrationDeadline: convertToUTC(form.registrationDeadline),
    };

    try {
      if (editingId) {
        await api(`/conference/${editingId}`, { method: "PUT", body: preparedForm });
        showToast("Conference updated successfully", "success");
      } else {
        await api(`/conference`, { method: "POST", body: preparedForm });
        showToast("Conference created successfully", "success");
      }
      resetForm();
      setEditingId(null);
      setAccordionOpen(false);
      await load();
    } catch (e) {
      showToast(e.message || "Failed to save conference", "error");
    }
  };

  const handleEdit = (conf) => {
    const cleaned = {
      name: conf.name || "",
      location: conf.location || "",
      description: conf.description || "",
      registrationDeadline: conf.registrationDeadline?.slice(0, 16) || "",
      startDateTime: conf.startDateTime?.slice(0, 16) || "",
      endDateTime: conf.endDateTime?.slice(0, 16) || "",
      eventType: conf.eventType || "conference",
      fullAgenda: conf.fullAgenda || "",
      conferenceWebsiteLink: conf.conferenceWebsiteLink || "",
      budget: conf.budget ?? "",
      fundingSource: conf.fundingSource || "GUC",
      extraRequiredResources: conf.extraRequiredResources?.length
        ? conf.extraRequiredResources.map((r) => ({ resourceName: r.resourceName, quantity: r.quantity }))
        : [{ resourceName: "", quantity: 1 }],
    };
    setForm(cleaned);
    setEditingId(conf._id);
    setAccordionOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDeleteConference = (id) => {
    setConfirmDelete({ visible: true, id });
  };

  const handleDelete = async () => {
    try {
      await api(`/event/${confirmDelete.id}`, { method: "DELETE" });
      showToast("Conference deleted successfully", "success");
      await load();
    } catch (e) {
      showToast(e.message || "Failed to delete conference", "error");
    } finally {
      setConfirmDelete({ visible: false, id: null });
    }
  };

  const handleView = (conf) => {
    setDetailsModal({ open: true, conference: conf });
  };

  const totalPages = Math.ceil(totalCount / filters.limit);

  // Confirm delete modal
  const ConfirmModal = ({ visible, onCancel, onConfirm }) => {
    if (!visible) return null;
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 p-4">
        <div className="bg-surface text-root-primary rounded-2xl p-6 w-96 text-center space-y-4 shadow-elevated border border-root">
          <p className="text-lg font-medium">Are you sure you want to delete this Conference?</p>
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

  return hasAccess === null ? (
    <main className="p-8">Checking permissions...</main>
  ) : hasAccess === false ? null : (
    <main className="p-8 space-y-6">
      {/* Toast (shared component) */}
      {toast.visible && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <Toast
            message={toast.message}
            type={toast.type || "success"}
            duration={3000}
            onClose={() => setToast({ message: "", type: "", visible: false })}
          />
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal visible={confirmDelete.visible} onCancel={() => setConfirmDelete({ visible: false, id: null })} onConfirm={handleDelete} />

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-semibold text-root-primary hover:opacity-80 transition">Conferences</h1>
        <div className="flex gap-2">
          <Link href="/admin" className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-root-primary hover:opacity-90 transition">
            <FaUndo className="text-lg" /> Home
          </Link>
        </div>
      </div>

      {/* Accordion Form */}
      <ConferenceAccordionForm
        form={form}
        setForm={setForm}
        editingId={editingId}
        setEditingId={setEditingId}
        resetForm={resetForm}
        handleSubmit={handleSubmit}
        open={accordionOpen}
        setOpen={setAccordionOpen}
      />

      {/* Filters (inline controls like Bazaars/Events) */}
      <div className="p-4 rounded-2xl bg-surface text-root-secondary">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Search</label>
            <input
              className="px-3 py-2 rounded input-surface"
              placeholder="Conference name…"
              value={filters.name}
              onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value, page: 1 }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Location</label>
            <input
              className="px-3 py-2 rounded input-surface"
              placeholder="Location…"
              value={filters.location}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value, page: 1 }))}
            />
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

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Funding Source</label>
            <select
              className="px-3 py-2 rounded input-surface"
              value={filters.fundingSource || ""}
              onChange={(e) => setFilters((f) => ({ ...f, fundingSource: e.target.value || "", page: 1 }))}
            >
              <option value="">All</option>
              <option value="GUC">GUC</option>
              <option value="External">External</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="p-4 rounded-2xl bg-surface text-root-primary">
        {loading ? (
          <p>Loading...</p>
        ) : conferences.length === 0 ? (
          <p className="opacity-70">No conferences found.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-root-secondary opacity-80">
                <tr>
                  {[{ key: "name", label: "Name" }, { key: "location", label: "Location" }, { key: "startDateTime", label: "Start" }, { key: "endDateTime", label: "End" }, { key: "registrationDeadline", label: "Registration Deadline" }, { key: "fundingSource", label: "Funding Source" }].map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          sortBy: key,
                          sortOrder: prev.sortBy === key && prev.sortOrder === "asc" ? "desc" : "asc",
                        }))
                      }
                      className="text-left p-2 cursor-pointer select-none hover:opacity-80 transition"
                    >
                      {label}
                      {filters.sortBy === key && <span className="ml-1 text-xs">{filters.sortOrder === "asc" ? "▲" : "▼"}</span>}
                    </th>
                  ))}

                  <th className="p-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {conferences.map((c) => (
                  <tr key={c._id} className="border-t border-root">
                    <td className="p-2 text-root-primary">{c.name}</td>
                    <td className="p-2 text-root-primary">{c.location}</td>
                    <td className="p-2 text-root-primary">{formatLocalTime(c.startDateTime)}</td>
                    <td className="p-2 text-root-primary">{formatLocalTime(c.endDateTime)}</td>
                    <td className="p-2 text-root-primary">{formatLocalTime(c.registrationDeadline)}</td>
                    <td className="p-2 text-root-primary">{c.fundingSource}</td>
                    <td className="p-2">
                      <div className="flex justify-center items-center">
                        <ActionsDropdown event={c} canEdit={true} onEdit={handleEdit} onDelete={() => confirmDeleteConference(c._id)} onView={() => handleView(c)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          page={filters.page}
          limit={filters.limit}
          totalCount={totalCount}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
          onLimitChange={(limit) => setFilters((f) => ({ ...f, limit, page: 1 }))}
        />
      </div>

      {/* Details Modal */}
      {detailsModal.open && <ConferenceDetailsModal conference={detailsModal.conference} onClose={() => setDetailsModal({ open: false, conference: null })} />}
    </main>
  );
}
