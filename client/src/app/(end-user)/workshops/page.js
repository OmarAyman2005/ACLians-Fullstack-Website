"use client";
import "@/globals.css";
import { useEffect, useState, useRef } from "react";
import {
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaClock,
  FaUsers,
  FaPlus,
  FaEdit,
  FaTrash,
} from "react-icons/fa";
import Toast from "@/components/toast.js";
import ViewDetailsButton from "@/app/admin/workshops/viewDetails";
import { convertToUTC } from "@/lib/dateFormatter.js";
import { api } from "@/lib/api";

export default function WorkshopsPage() {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedWorkshop, setSelectedWorkshop] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState(null);
  // single shared transient toast (uses components/toast.js)
  const [toastState, setToastState] = useState(null);
  const toastTimerRef = useRef(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "GUC Cairo",
    description: "",
    registrationDeadline: "",
    startDateTime: "",
    endDateTime: "",
    faculty: "MET",
    budget: "",
    fundingSource: "GUC",
    capacity: "",
    fullAgenda: "",
    professors: [{ id: "", contribution: "" }],
    extraRequiredResources: [{ resourceName: "", quantity: 1 }],
  });
  const [step, setStep] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState(null);
  const [professorsList, setProfessorsList] = useState([]);
  const [hoveredCard, setHoveredCard] = useState(null);

  const showToast = (type = "success", title = "", description = "", duration = 4000) => {
    // compose message like previous behaviour: "Title — Description"
    const message = description ? `${title} — ${description}` : title || "";

    // clear previous timer
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    setToastState({ message, type: type === "error" ? "error" : type === "warning" ? "warning" : "success" });

    if (duration > 0) {
      toastTimerRef.current = setTimeout(() => {
        setToastState(null);
        toastTimerRef.current = null;
      }, duration);
    }
  };

  // cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const fetchProfessors = async () => {
    try {
      const res = await api('/public/professors');
      let payload = res;
      if (res && typeof res.json === 'function') payload = await res.json();
      const list = Array.isArray(payload) ? payload : payload?.data ?? payload?.items ?? [];
      setProfessorsList(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to load professors:", err);
      showToast?.("error", "Failed to load professors");
    }
  };

  const fetchWorkshops = async () => {
    try {
      setLoading(true);
      const meRes = await api('/auth/me');
      let mePayload = meRes;
      if (meRes && typeof meRes.json === 'function') mePayload = await meRes.json();
      const me = mePayload?.data ?? mePayload?.user ?? mePayload;
      const userId = me?._id ?? me?.id ?? me?.sub;
      if (!userId) {
        setWorkshops([]);
        return;
      }
      const res = await api(`/workshop/professor/${userId}`);
      let payload = res;
      if (res && typeof res.json === 'function') payload = await res.json();
      const list = payload?.data ?? (Array.isArray(payload) ? payload : []);
      setWorkshops(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Error fetching workshops:", err);
      showToast("error", "Failed to load workshops", "Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkshops();
    fetchProfessors();
  }, []);

  const handleInput = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleResourceChange = (index, field, value) => {
    const updatedResources = [...formData.extraRequiredResources];
    updatedResources[index][field] = value;
    setFormData({ ...formData, extraRequiredResources: updatedResources });
  };

  const handleProfessorChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.professors];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, professors: updated };
    });
  };

  const addResource = () => {
    setFormData({
      ...formData,
      extraRequiredResources: [
        ...formData.extraRequiredResources,
        { resourceName: "", quantity: 1 },
      ],
    });
  };

  const addProfessor = () => {
    setFormData((prev) => ({
      ...prev,
      professors: [...prev.professors, { id: "", contribution: "" }],
    }));
  };

  const removeProfessor = (index) => {
    setFormData((prev) => ({
      ...prev,
      professors: prev.professors.filter((_, i) => i !== index),
    }));
  };

  const removeResource = (index) => {
    const updatedResources = formData.extraRequiredResources.filter((_, i) => i !== index);
    setFormData({ ...formData, extraRequiredResources: updatedResources });
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const openCreateModal = () => {
    setFormData({
      name: "",
      location: "GUC Cairo",
      description: "",
      registrationDeadline: "",
      startDateTime: "",
      endDateTime: "",
      faculty: "MET",
      budget: "",
      fundingSource: "GUC",
      capacity: "",
      fullAgenda: "",
      professors: [{ id: "", contribution: "" }],
      extraRequiredResources: [{ resourceName: "", quantity: 1 }],
    });
    setStep(1);
    setEditMode(false);
    setShowModal(true);
  };

  const openEditModal = (workshop) => {
    setFormData({
      name: workshop.name || "",
      location: workshop.location || "GUC Cairo",
      description: workshop.description || "",
      registrationDeadline: workshop.registrationDeadline?.slice(0, 16) || "",
      startDateTime: workshop.startDateTime?.slice(0, 16) || "",
      endDateTime: workshop.endDateTime?.slice(0, 16) || "",
      faculty: workshop.faculty || "MET",
      budget: workshop.budget || "",
      fundingSource: workshop.fundingSource || "GUC",
      capacity: workshop.capacity || "",
      fullAgenda: workshop.fullAgenda || "",
      professors: workshop.professors?.length
        ? workshop.professors.map((p) =>
          typeof p === "string" || p instanceof String
            ? { id: p, contribution: "" }
            : { id: p._id || p.id || "", contribution: p.contribution || "" }
        )
        : [{ id: "", contribution: "" }],
      extraRequiredResources: workshop.extraRequiredResources || [{ resourceName: "", quantity: 1 }],
    });
    setSelectedWorkshopId(workshop._id);
    setStep(1);
    setEditMode(true);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (!editMode) {
        formData.startDateTime = convertToUTC(formData.startDateTime);
        formData.endDateTime = convertToUTC(formData.endDateTime);
        formData.registrationDeadline = convertToUTC(formData.registrationDeadline);
      }

      const payload = {
        ...formData,
        eventType: "workshop",
        professors: (formData.professors || []).map((p) => p.id || p._id || p).filter(Boolean),
        extraRequiredResources: formData.extraRequiredResources.map(({ resourceName, quantity }) => ({ resourceName, quantity })),
      };

      const path = editMode ? `/workshop/${selectedWorkshopId}` : "/workshop";
      const method = editMode ? "PATCH" : "POST";
      const result = await api(path, { method, body: payload });

      if (result && typeof result.ok === "boolean") {
        if (result.ok) {
          showToast("success", editMode ? "Workshop updated" : "Workshop created", editMode ? "Updated successfully." : "Created successfully.");
          setShowModal(false);
          fetchWorkshops();
        } else {
          const errText = await result.text().catch(() => "Server responded with an error.");
          showToast("error", "Failed to submit workshop", errText);
        }
      } else {
        if (result && (result.status === "success" || result.data)) {
          showToast("success", editMode ? "Workshop updated" : "Workshop created", editMode ? "Updated successfully." : "Created successfully.");
          setShowModal(false);
          fetchWorkshops();
        } else {
          showToast("error", "Failed to submit workshop", result?.message || JSON.stringify(result || "Unknown error"));
        }
      }
    } catch (err) {
      showToast("error", "Error submitting form", err.message || "Check console for details.");
      setShowModal(false);
    }
  };

  const requestDelete = (id, name) => {
    setConfirmPayload({
      id,
      message: `Are you sure you want to delete the workshop "${name}"? This action cannot be undone.`,
      onConfirm: () => performDelete(id),
    });
    setConfirmOpen(true);
  };

  const performDelete = async (id) => {
    setConfirmOpen(false);
    setConfirmPayload(null);
    try {
      const result = await api(`/event/${id}`, { method: "DELETE" });
      if (result && typeof result.ok === "boolean") {
        if (result.ok) {
          showToast("success", "Workshop deleted", "The workshop was deleted successfully.");
          fetchWorkshops();
        } else {
          const errMsg = await result.text().catch(() => "Server responded with an error.");
          showToast("error", "Failed to delete workshop", errMsg);
        }
      } else {
        if (result && result.status === "success") {
          showToast("success", "Workshop deleted", "The workshop was deleted successfully.");
          fetchWorkshops();
        } else {
          showToast("error", "Failed to delete workshop", result?.message || JSON.stringify(result || "Unknown error"));
        }
      }
    } catch (err) {
      showToast("error", "Error deleting workshop", err.message || "Check console for details.");
    }
  };

  const openDetailsModal = async (workshop) => {
    const w = { ...workshop };
    if (Array.isArray(w.professors) && w.professors.length > 0) {
      const resolved = await Promise.all(
        w.professors.map(async (p) => {
          if (!p) return p;
          if (typeof p === "string" || typeof p === "number") {
            const prof = await fetchProfessorById(String(p));
            return prof ? { _id: prof._id || prof.id || String(p), fullName: prof.fullName || prof.name || prof.email, email: prof.email || "" } : { _id: String(p) };
          }
          if (p._id && (p.fullName || p.name)) return p;
          const prof = await fetchProfessorById(p._id || p.id);
          return prof ? { _id: prof._id || prof.id, fullName: prof.fullName || prof.name || prof.email, email: prof.email || "", contribution: p.contribution } : p;
        })
      );
      w.professors = resolved;
    }

    setSelectedWorkshop(w);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedWorkshop(null);
  };

  const fetchProfessorById = async (id) => {
    if (!id) return null;
    try {
      const res = await api(`/public/professors/${id}`);
      let payload = res;
      if (res && typeof res.json === 'function') payload = await res.json();
      return payload?.data ?? (Array.isArray(payload) ? payload[0] : payload) ?? null;
    } catch (err) {
      console.error("Failed to fetch professor", id, err);
      return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-root-secondary bg-root">
        Loading workshops...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-root px-6 py-10 text-root-secondary">
      {toastState && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <Toast
            key={Date.now()}
            message={toastState.message}
            type={toastState.type}
            duration={4000}
            onClose={() => setToastState(null)}
          />
        </div>
      )}

      <h1 className="text-3xl font-bold text-center mb-10 text-root-primary">Workshops</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {workshops.map((workshop) => (
          <div
            key={workshop._id}
            onMouseEnter={() => setHoveredCard(workshop._id)}
            onMouseLeave={() => setHoveredCard(null)}
            className={
              (hoveredCard === workshop._id
                ? "bg-primary text-root-primary"
                : "bg-surface text-root-secondary") +
              " border border-root rounded-2xl p-6 hover:shadow-elevated transition-colors duration-300 flex flex-col justify-between cursor-pointer"
            }
          >
            <div>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-semibold text-root-primary">
                  {workshop.name}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(workshop)}
                    className="text-root-secondary hover:text-root-primary transition cursor-pointer"
                    title="Edit Workshop"
                  >
                    <FaEdit size={22} />
                  </button>
                  <button
                    onClick={() => requestDelete(workshop._id, workshop.name)}
                    className="text-error hover:opacity-90 transition cursor-pointer"
                    title="Delete Workshop"
                  >
                    <FaTrash size={22} />
                  </button>
                </div>
              </div>

              <p className="text-root-secondary text-sm mb-5 line-clamp-3">
                {workshop.description}
              </p>

              <div className="flex items-center text-root-secondary text-sm mb-2">
                <FaMapMarkerAlt className="mr-2 text-root-secondary" />
                {workshop.location}
              </div>

              <div className="flex items-center text-root-secondary text-sm mb-2">
                <FaCalendarAlt className="mr-2 text-root-secondary" />
                {new Date(workshop.startDateTime).toLocaleDateString()} — {new Date(workshop.endDateTime).toLocaleDateString()}
              </div>

              <div className="flex items-center text-root-secondary text-sm mb-2">
                <FaClock className="mr-2 text-root-secondary" />
                {new Date(workshop.startDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(workshop.endDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>

              <div className="flex items-center text-root-secondary text-sm mb-4">
                <FaUsers className="mr-2 text-root-secondary" />
                Capacity: {workshop.capacity}
              </div>
            </div>

            <ViewDetailsButton onClick={() => openDetailsModal(workshop)} />
          </div>
        ))}

        <div
          onMouseEnter={() => setHoveredCard("create")}
          onMouseLeave={() => setHoveredCard(null)}
          onClick={openCreateModal}
          className={
            (hoveredCard === "create" ? "bg-primary text-root-primary" : "bg-surface text-root-secondary") +
            " border-2 border-dashed border-root hover:opacity-90 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-300"
          }
        >
          <FaPlus className="text-4xl mb-2 text-root-primary" />
          <p className="text-root-primary font-medium">Create New Workshop</p>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-surface border border-root rounded-2xl p-8 w-full max-w-3xl relative text-root-primary max-h-[90vh] min-h-[90vh] overflow-y-auto flex flex-col">
            <h2 className="text-2xl font-semibold text-center mb-6">
              {editMode ? `Edit Workshop (Step ${step}/4)` : `Create Workshop (Step ${step}/4)`}
            </h2>

            {step === 1 && (
              <div className="space-y-4">
                <label className="block text-sm text-root-secondary">Workshop Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleInput} className="w-full input-surface p-2 rounded" />
                <label className="block text-sm text-root-secondary">Description</label>
                <textarea name="description" value={formData.description} onChange={handleInput} className="w-full input-surface p-2 rounded" />
                <label className="block text-sm text-root-secondary">Location</label>
                <select name="location" value={formData.location} onChange={handleInput} className="w-full input-surface p-2 rounded">
                  <option>GUC Cairo</option>
                  <option>GUC Berlin</option>
                </select>
                <label className="block text-sm text-root-secondary">Start Date & Time</label>
                <input type="datetime-local" name="startDateTime" value={formData.startDateTime} onChange={handleInput} className="w-full input-surface p-2 rounded" />
                <label className="block text-sm text-root-secondary">End Date & Time</label>
                <input type="datetime-local" name="endDateTime" value={formData.endDateTime} onChange={handleInput} className="w-full input-surface p-2 rounded" />
                <label className="block text-sm text-root-secondary">Registration Deadline</label>
                <input type="datetime-local" name="registrationDeadline" value={formData.registrationDeadline} onChange={handleInput} className="w-full input-surface p-2 rounded" />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <label className="block text-sm text-root-secondary">Capacity</label>
                <input type="number" name="capacity" value={formData.capacity} onChange={handleInput} className="w-full input-surface p-2 rounded" />
                <label className="block text-sm text-root-secondary">Budget</label>
                <input type="number" name="budget" value={formData.budget} onChange={handleInput} className="w-full input-surface p-2 rounded" />
                <label className="block text-sm text-root-secondary">Funding Source</label>
                <select name="fundingSource" value={formData.fundingSource} onChange={handleInput} className="w-full input-surface p-2 rounded">
                  <option>GUC</option>
                  <option>External</option>
                </select>
                <label className="block text-sm text-root-secondary">Faculty</label>
                <select name="faculty" value={formData.faculty} onChange={handleInput} className="w-full input-surface p-2 rounded">
                  <option>MET</option>
                  <option>IET</option>
                  <option>EMS</option>
                  <option>MBA</option>
                  <option>MGT</option>
                  <option>LAW</option>
                </select>
                <label className="block text-sm font-medium text-root-secondary mt-4">Full Agenda</label>
                <textarea name="fullAgenda" value={formData.fullAgenda} onChange={handleInput} rows={5} placeholder="e.g. 09:30 - Intro to Robotics..." className="w-full input-surface p-2 rounded mt-1" />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-root-secondary">Extra Required Resources</label>
                {formData.extraRequiredResources.map((res, index) => (
                  <div key={index} className="flex items-center gap-2 input-surface p-2 rounded">
                    <input type="text" placeholder="Resource Name" value={res.resourceName} onChange={(e) => handleResourceChange(index, "resourceName", e.target.value)} className="flex-1 bg-transparent text-root-primary p-1" />
                    <input type="number" min="1" value={res.quantity} onChange={(e) => handleResourceChange(index, "quantity", e.target.value)} className="w-20 bg-transparent text-root-primary p-1" />
                    <button onClick={() => removeResource(index)} className="text-error hover:opacity-90"><FaTrash /></button>
                  </div>
                ))}
                <button onClick={addResource} className="px-3 py-1 bg-primary text-root-primary rounded hover:opacity-90 flex items-center gap-1"><FaPlus /> Add Resource</button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <label className="block text-sm font-medium text-root-secondary">Professors</label>
                {formData.professors.map((prof, index) => (
                  <div key={index} className="flex flex-wrap gap-2 input-surface p-2 rounded items-center">
                    <select
                      value={prof.id || ""}
                      onChange={(e) => handleProfessorChange(index, "id", e.target.value)}
                      className="flex-1 input-surface p-1 rounded"
                    >
                      <option value="">Select professor</option>
                      {professorsList.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.fullName || u.name || u.email}{u.department ? ` — ${u.department}` : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Contribution (optional)"
                      value={prof.contribution || ""}
                      onChange={(e) => handleProfessorChange(index, "contribution", e.target.value)}
                      className="flex-1 input-surface p-1 rounded"
                    />
                    <button onClick={() => removeProfessor(index)} className="text-error hover:opacity-90"><FaTrash /></button>
                  </div>
                ))}
                <button onClick={addProfessor} className="px-3 py-1 bg-primary text-root-primary rounded hover:opacity-90 flex items-center gap-1"><FaPlus /> Add Professor</button>
              </div>
            )}

            <div className="flex justify-between mt-auto pt-6">
              <button onClick={() => { setShowModal(false); setStep(1); }} className="px-4 py-2 rounded input-surface hover:opacity-80">Cancel</button>
              <div className="space-x-3">
                {step > 1 && <button onClick={prevStep} className="px-4 py-2 rounded input-surface hover:opacity-80">Back</button>}
                {step < 4 ? (
                  <button onClick={nextStep} className="px-4 py-2 rounded bg-primary text-root-primary font-medium hover:opacity-90">Next</button>
                ) : (
                  <button onClick={handleSubmit} className="px-4 py-2 rounded bg-primary text-root-primary font-medium hover:opacity-90">{editMode ? "Save Changes" : "Submit"}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedWorkshop && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-surface border border-root rounded-2xl p-6 w-full max-w-xl text-root-primary max-h-[85vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="workshop-details-title">
            <div className="flex justify-between items-start">
              <h2 id="workshop-details-title" className="text-2xl font-semibold mb-2">{selectedWorkshop.name}</h2>
            </div>

            <p className="text-root-secondary mb-3">{selectedWorkshop.description}</p>

            <div className="flex items-center text-root-secondary text-sm mb-2">
              <FaCalendarAlt className="mr-2 text-root-secondary" />
              <span>Schedule: {selectedWorkshop.startDateTime && selectedWorkshop.endDateTime ? `${new Date(selectedWorkshop.startDateTime).toLocaleString()} — ${new Date(selectedWorkshop.endDateTime).toLocaleString()}` : "N/A"}</span>
            </div>

            <div className="flex items-center text-root-secondary text-sm mb-2">
              <FaMapMarkerAlt className="mr-2 text-root-secondary" />
              <span>{selectedWorkshop.location || "N/A"}</span>
            </div>

            <div className="flex items-center text-root-secondary text-sm mb-2">
              <FaUsers className="mr-2 text-root-secondary" />
              <span>Capacity: {selectedWorkshop.capacity ?? "N/A"}</span>
            </div>

            <div className="flex items-center text-root-secondary text-sm mb-2">
              <span className="mr-2 text-root-secondary font-medium">Faculty:</span>
              <span>{selectedWorkshop.faculty || "N/A"}</span>
            </div>

            <div className="flex items-center text-root-secondary text-sm mb-2">
              <span className="mr-2 text-root-secondary font-medium">Budget:</span>
              <span>{selectedWorkshop.budget ?? "N/A"}</span>
              <span className="ml-3 text-root-secondary">({selectedWorkshop.fundingSource || "N/A"})</span>
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium text-root-secondary mb-1">Full Agenda</div>
              <pre className="whitespace-pre-wrap input-surface p-3 rounded text-sm text-root-primary">{selectedWorkshop.fullAgenda || "No agenda."}</pre>
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium text-root-secondary mb-1">Professors</div>
              {selectedWorkshop.professors?.length > 0 ? (
                <ul className="list-disc ml-6 text-sm text-root-secondary">
                  {selectedWorkshop.professors.map((p, idx) => (
                    <li key={idx} className="mb-1">
                      <span className="text-root-primary font-medium">{p.fullName || "Unnamed"}</span>
                      {p.contribution ? <span className="ml-2 text-root-secondary">— {p.contribution}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-root-secondary">No professors listed.</p>
              )}
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium text-root-secondary mb-1">Extra Required Resources</div>
              {selectedWorkshop.extraRequiredResources?.length > 0 ? (
                <ul className="list-disc ml-6 text-sm text-root-secondary">
                  {selectedWorkshop.extraRequiredResources.map((r, idx) => (
                    <li key={idx}>{r.resourceName || "Unnamed resource"} (x{r.quantity ?? 1})</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-root-secondary">No extra resources.</p>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={closeDetailsModal} className="px-4 py-2 rounded bg-primary text-root-primary font-medium hover:opacity-90">Close</button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && confirmPayload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="confirm-modal bg-surface border border-root rounded-2xl p-6 w-full max-w-md text-root-primary transform transition-all shadow-elevated">
            <h3 className="text-lg font-semibold mb-3">Confirm Delete</h3>
            <p className="text-sm text-root-secondary mb-5">{confirmPayload.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setConfirmOpen(false); setConfirmPayload(null); }} className="px-4 py-2 rounded input-surface hover:opacity-80">Cancel</button>
              <button onClick={() => { confirmPayload.onConfirm && confirmPayload.onConfirm(); }} className="px-4 py-2 rounded bg-error text-root-primary hover:opacity-90">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
