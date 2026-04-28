// app/(end-user)/vendorApplyingBazaars/vendorApplyingBazaars.jsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import "../vendorApplyingBazaars.css";
import { useRouter } from "next/navigation";
import { applicationsService } from "@/app/services/applications.service";

const MAX_ATTENDEES = 5;
const BOOTH_SIZES = [
  { label: "2 × 2 m", value: "2x2", w: 2, d: 2 },
  { label: "4 × 4 m", value: "4x4", w: 4, d: 4 },
];

export default function VendorApplyingBazaars({ eventId, me }) {
  const router = useRouter();

  const [attendees, setAttendees] = useState([{ name: "", email: "" }]);
  const [boothSize, setBoothSize] = useState("2x2");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const canAddMore = attendees.length < MAX_ATTENDEES;

  const errors = useMemo(() => {
    const e = {};
    attendees.forEach((p, idx) => {
      const row = {};
      if (!p.name.trim()) row.name = "Required";
      if (!p.email.trim()) {
        row.email = "Required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) {
        row.email = "Invalid email";
      }
      if (Object.keys(row).length) e[`attendee_${idx}`] = row;
    });
    if (!BOOTH_SIZES.some((s) => s.value === boothSize)) {
      e.boothSize = "Please select a booth size";
    }
    return e;
  }, [attendees, boothSize]);

  const hasErrors = Object.keys(errors).length > 0;

  const updateAttendee = (index, field, value) => {
    setAttendees((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addAttendee = () => {
    if (!canAddMore) return;
    setAttendees((prev) => [...prev, { name: "", email: "" }]);
  };

  const removeAttendee = (index) => {
    setAttendees((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (hasErrors) {
      document.querySelector(".form-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const userId = me?.id || me?._id;
    if (!userId) {
      setServerError("You must be logged in to apply.");
      return;
    }

    // ✅ always derive applicantName from the authenticated user (token /me)
    const applicantName =
      (me?.fullName && me.fullName.trim()) ||
      ([me?.firstName, me?.lastName].filter(Boolean).join(" ").trim()) ||
      (me?.name && me.name.trim()) ||
      (me?.email && me.email.trim()) ||
      "Unknown Vendor";

    const payload = {
      userId,
      eventId: String(eventId),
      participants: attendees.map((a) => ({ name: a.name.trim(), email: a.email.trim() })),
      boothSize,
      applicantName, // ← strictly from /me
    };

    setSubmitting(true);
    try {
      await applicationsService.create(payload);
      router.push(`/applicationSubmittedVendor?type=bazaar&id=${encodeURIComponent(eventId)}`);
    } catch (err) {
      if (err?.status === 409) {
        setServerError(err?.data?.message || "You have already applied to this event.");
      } else {
        setServerError(err?.message || "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="apply-wrap">
      <form className="apply-card" onSubmit={onSubmit} noValidate>
        <h1 className="apply-title">Apply to Bazaar</h1>
        <p className="apply-subtitle">
          Bazaar ID: <strong>{eventId}</strong>
        </p>

        <section className="fieldset">
          <div className="legend">Booth Staff (max {MAX_ATTENDEES})</div>

          {attendees.map((p, idx) => {
            const rowErr = errors[`attendee_${idx}`] || {};
            return (
              <div key={idx} className="row attendees-row">
                <div className="field">
                  <label htmlFor={`name_${idx}`}>Full Name</label>
                  <input
                    id={`name_${idx}`}
                    type="text"
                    value={p.name}
                    onChange={(e) => updateAttendee(idx, "name", e.target.value)}
                    placeholder="e.g., Ahmed Ali"
                    aria-invalid={!!rowErr.name}
                  />
                  {rowErr.name && <div className="form-error">{rowErr.name}</div>}
                </div>

                <div className="field">
                  <label htmlFor={`email_${idx}`}>Email</label>
                  <input
                    id={`email_${idx}`}
                    type="email"
                    inputMode="email"
                    value={p.email}
                    onChange={(e) => updateAttendee(idx, "email", e.target.value)}
                    placeholder="name@example.com"
                    aria-invalid={!!rowErr.email}
                  />
                  {rowErr.email && <div className="form-error">{rowErr.email}</div>}
                </div>

                <div className="row-actions">
                  {attendees.length > 1 && (
                    <button type="button" className="icon-btn danger" onClick={() => removeAttendee(idx)} title="Remove person">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div className="row">
            <button type="button" className="btn outline" onClick={addAttendee} disabled={!canAddMore}>
              + Add person
            </button>
          </div>
        </section>

        <section className="fieldset">
          <div className="legend">Booth Size</div>
          <div className="row">
            <div className="field">
              <label>Choose size</label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {BOOTH_SIZES.map((s) => (
                  <label
                    key={s.value}
                    className="btn outline"
                    style={{
                      padding: "0 14px",
                      height: 36,
                      borderRadius: 999,
                      cursor: "pointer",
                      userSelect: "none",
                      borderWidth: boothSize === s.value ? 2 : 1,
                    }}
                  >
                    <input
                      type="radio"
                      name="boothSize"
                      value={s.value}
                      checked={boothSize === s.value}
                      onChange={() => setBoothSize(s.value)}
                      style={{ display: "none" }}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
              {errors.boothSize && <div className="form-error">{errors.boothSize}</div>}
            </div>
          </div>
        </section>

        {serverError && <div className="server-error" role="alert">{serverError}</div>}

        <div className="form-actions">
          <Link className="btn ghost" href="/events">Cancel</Link>
          <button className="btn" type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        </div>
      </form>
    </main>
  );
}
