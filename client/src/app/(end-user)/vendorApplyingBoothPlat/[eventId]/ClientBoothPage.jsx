"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "../vendorApplyingBoothPlat.css";

import { addDays, isBefore, startOfDay, endOfDay } from "date-fns";
import { Dialog } from "@headlessui/react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import clsx from "clsx";

import { eventsService } from "@/app/services/events.service";
import { applicationsService } from "@/app/services/applications.service";

import dynamic from "next/dynamic";
const LeafletMap = dynamic(() => import("./LeafletMapClient"), { ssr: false });

const MAX_ATTENDEES = 5;
const DURATION_WEEKS = [1, 2, 3, 4];
const BOOTH_SIZES = ["2x2", "4x4"];

/** Static booth layout (no reservation state baked in) */
const BOOTHS_LAYOUT = [
  { id: "B01", label: "1", className: "b-top b-1" },
  { id: "B02", label: "2", className: "b-top b-2" },
  { id: "B03", label: "3", className: "b-top b-3" },
  { id: "B04", label: "4", className: "b-top b-4" },
  { id: "B05", label: "5", className: "b-right b-r1" },
  { id: "B06", label: "6", className: "b-right b-r2" },
  { id: "B07", label: "7", className: "b-right b-r3" },
  { id: "B08", label: "8", className: "b-btm b-1b" },
  { id: "B09", label: "9", className: "b-btm b-2b" },
  { id: "B10", label: "10", className: "b-btm b-3b" },
  { id: "B11", label: "11", className: "b-btm b-4b" },
];

export default function ClientBoothPage({ eventId, userId }) {
  const router = useRouter();

  const [attendees, setAttendees] = useState([{ name: "", email: "" }]);
  const [boothSize, setBoothSize] = useState("2x2");
  const [durationWeeks, setDurationWeeks] = useState(1);

  const [selectedBooth, setSelectedBooth] = useState(null); // {id,label}
  const [startDate, setStartDate] = useState(null);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [reservedRanges, setReservedRanges] = useState([]); // [{from,to}]
  const [calendarError, setCalendarError] = useState("");   // ⬅️ NEW (inline DayPicker errors)

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null); // keep global banner for non-calendar messages

  /* ===== Map config ===== */
  const MAP_CENTER = { lat: 29.9873, lng: 31.44212 };
  const [mapZoom, setMapZoom] = useState(17);
  const mapRef = useRef(null);

  const zoomIn = () => {
    const m = mapRef.current;
    if (!m) return;
    const z = Math.min(21, (m.getZoom() ?? mapZoom) + 1);
    m.setZoom(z);
    setMapZoom(z);
  };
  const zoomOut = () => {
    const m = mapRef.current;
    if (!m) return;
    const z = Math.max(14, (m.getZoom() ?? mapZoom) - 1);
    m.setZoom(z);
    setMapZoom(z);
  };

  // We render the static layout directly
  const boothGrid = useMemo(() => BOOTHS_LAYOUT, []);

  // Normalize reserved windows with EXCLUSIVE end (paint last inclusive day)
  const normalizeRanges = useCallback((payload) => {
    const d = payload?.data ?? payload ?? {};
    const out = [];
    const pushExclusive = (fromISO, endExclusiveISO) => {
      if (!fromISO || !endExclusiveISO) return;
      const from = startOfDay(new Date(fromISO));
      const lastInclusive = endOfDay(addDays(new Date(endExclusiveISO), -1));
      if (lastInclusive >= from) out.push({ from, to: lastInclusive });
    };

    if (Array.isArray(d.reservations)) d.reservations.forEach((r) => pushExclusive(r.start, r.end));
    if (Array.isArray(d.applications)) d.applications.forEach((a) => pushExclusive(a.reservationStart, a.reservationEnd));
    if (Array.isArray(d.boothLinkedApplications)) d.boothLinkedApplications.forEach((a) => pushExclusive(a.reservationStart, a.reservationEnd));
    if (d.boothLinkedApplication) pushExclusive(d.boothLinkedApplication.reservationStart, d.boothLinkedApplication.reservationEnd);

    return out;
  }, []);

  const handleSelectBooth = async (tile) => {
    setSelectedBooth({ id: tile.id, label: tile.label });
    setStartDate(null);
    setMsg(null);
    setCalendarError(""); // ⬅️ reset dialog error when opening
    try {
      // ← the ONLY source of availability
      const data = await eventsService.getBoothReservations(eventId, tile.id);
      setReservedRanges(normalizeRanges(data));
      setCalendarOpen(true);
    } catch (e) {
      setMsg({ type: "err", text: `Failed to load reservations for Booth ${tile.label}. ${e?.message || ""}` });
    }
  };

  // Overlap test (adjacent OK)
  const collidesWithReserved = useCallback(
    (candidateStart) => {
      if (!candidateStart) return false;
      const from = startOfDay(candidateStart);
      const to = endOfDay(addDays(from, durationWeeks * 7 - 1));
      return reservedRanges.some(({ from: rFrom, to: rTo }) => from <= rTo && to >= rFrom);
    },
    [reservedRanges, durationWeeks]
  );

  const onSelectStartDate = (date) => {
    if (!date) return;
    const d0 = startOfDay(date);
    if (isBefore(d0, startOfDay(new Date()))) {
      setCalendarError("You can’t select a past date.");
      return;
    }
    if (collidesWithReserved(d0)) {
      setCalendarError("That start date overlaps reserved dates. Please choose another.");
      return;
    }
    setCalendarError("");
    setStartDate(d0);
  };

  // If duration changes and now overlaps, show the error INSIDE the dialog
  useEffect(() => {
    if (startDate && collidesWithReserved(startDate)) {
      setCalendarError("Selected range now overlaps reserved dates. Pick a different start date.");
      setCalendarOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationWeeks]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    if (!userId) {
      setMsg({ type: "err", text: "You must be signed in to reserve a booth." });
      setSubmitting(false);
      return;
    }

    const filtered = attendees.filter((a) => a.name.trim() && a.email.trim());
    if (filtered.length === 0) {
      setMsg({ type: "err", text: "Please add at least one worker (name & email)." });
      setSubmitting(false);
      return;
    }
    if (!selectedBooth) {
      setMsg({ type: "err", text: "Please select a booth location from the grid." });
      setSubmitting(false);
      return;
    }
    if (!startDate) {
      setMsg({ type: "err", text: "Please choose a start date." });
      setSubmitting(false);
      setCalendarOpen(true);
      return;
    }
    if (collidesWithReserved(startDate)) {
      // Show the error **inside** the datepicker and focus it
      setCalendarError("Selected start date collides with an existing reservation.");
      setCalendarOpen(true);
      setSubmitting(false);
      return;
    }

    try {
      await applicationsService.create({
        userId,
        eventId,
        boothNumber: selectedBooth.id,
        boothSize,
        participants: filtered,
        durationWeeks: durationWeeks,
        startDate, // server computes reservationEnd (inclusive end = start + weeks*7 - 1)
        notes: "",
      });

      setMsg({
        type: "ok",
        text: `Application submitted for Booth ${selectedBooth.label} starting ${startDate.toLocaleDateString()} for ${durationWeeks} ${durationWeeks === 1 ? "week" : "weeks"} ✅`,
      });

      // (no refresh of booth availability—availability comes per-booth via getBoothReservations)
      // router.push('/vendor/applications');
    } catch (err) {
      if (err?.status === 409) {
        setCalendarError("That time window overlaps another active application. Pick a different date.");
        setCalendarOpen(true);
        try {
          const data = await eventsService.getBoothReservations(eventId, selectedBooth.id);
          setReservedRanges(normalizeRanges(data));
        } catch {}
      } else if (err?.status === 401 || err?.status === 403) {
        setMsg({ type: "err", text: "Your session expired. Please sign in again." });
      } else {
        setMsg({ type: "err", text: err?.message || "Application failed. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const updateAttendee = (idx, field, value) => {
    setAttendees((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };
  const addAttendee = () => {
    setAttendees((prev) =>
      prev.length < MAX_ATTENDEES ? [...prev, { name: "", email: "" }] : prev
    );
  };
  const removeAttendee = (idx) => {
    setAttendees((prev) => prev.filter((_, i) => i !== idx));
  };

  const computedEnd = startDate ? addDays(startDate, durationWeeks * 7 - 1) : null;

  return (
    <div className="apply-page">
      <div className="apply-head">
        <div className="apply-breadcrumbs">
          <Link href="/vendor">Vendor</Link>
          <span aria-hidden="true"> / </span>
          <Link href="/vendor/applications">Applications</Link>
          <span aria-hidden="true"> / </span>
          <span className="crumb-current">Booth Application</span>
        </div>
        <h1 className="apply-title">Booth Application</h1>
        <p className="apply-subtitle">
          Add up to 5 workers, choose booth size (2×2 or 4×4), set duration (1–4 weeks), pick a booth, then choose a start date.
        </p>
      </div>

      <div className="apply-card">
        <form onSubmit={onSubmit} className="apply-form">
          <div className="form-grid">
            {/* Workers */}
            <div className="form-field form-field--full">
              <label>Workers Attending (max 5)</label>
              <div className="att-list">
                <div className="att-row att-row--head">
                  <div>Name</div>
                  <div>Email</div>
                  <div className="att-actions-col" />
                </div>

                {attendees.map((a, idx) => (
                  <div className="att-row" key={idx}>
                    <div>
                      <input
                        type="text"
                        placeholder="Full name"
                        value={a.name}
                        onChange={(e) => updateAttendee(idx, "name", e.target.value)}
                        required={idx === 0}
                      />
                    </div>
                    <div>
                      <input
                        type="email"
                        placeholder="name@company.com"
                        value={a.email}
                        onChange={(e) => updateAttendee(idx, "email", e.target.value)}
                        required={idx === 0}
                      />
                    </div>
                    <div className="att-actions-col">
                      {attendees.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => removeAttendee(idx)}
                          aria-label={`Remove attendee ${idx + 1}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <div className="att-footer">
                  <button type="button" className="btn btn-ghost" onClick={addAttendee} disabled={attendees.length >= MAX_ATTENDEES}>
                    + Add worker
                  </button>
                  <span className="att-count">{attendees.length}/{MAX_ATTENDEES}</span>
                </div>
              </div>
            </div>

            {/* Booth size */}
            <div className="form-field">
              <label>Booth Size</label>
              <div className="size-row" role="group" aria-label="Booth size">
                {BOOTH_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={clsx("size-chip", boothSize === s && "active")}
                    onClick={() => setBoothSize(s)}
                    aria-pressed={boothSize === s}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="form-field">
              <label htmlFor="durationWeeks">Duration</label>
              <select id="durationWeeks" value={durationWeeks} onChange={(e) => setDurationWeeks(Number(e.target.value))} required>
                {DURATION_WEEKS.map((w) => (
                  <option key={w} value={w}>
                    {w} {w === 1 ? "week" : "weeks"}
                  </option>
                ))}
              </select>
            </div>

            {/* Grid */}
            <div className="form-field form-field--full">
              <label>Booth Setup Location (select on grid)</label>

              <div className="plat plat--inline">
                <div className="bldg left top">Pronto</div>
                <div className="bldg left btm">Friends</div>
                <div className="bldg right top">L'aroma</div>
                <div className="bldg right btm">Pasta</div>

                {/* Map */}
                <div className="map-overlay" aria-label="Campus map">
                  <div className="map-zoom">
                    <button type="button" onClick={zoomIn} aria-label="Zoom in">+</button>
                    <button type="button" onClick={zoomOut} aria-label="Zoom out">−</button>
                  </div>

                  <LeafletMap
                    center={MAP_CENTER}
                    zoom={mapZoom}
                    minZoom={14}
                    maxZoom={21}
                    onReady={(m) => { mapRef.current = m; }}
                    onZoom={(z) => setMapZoom(z)}
                  />
                </div>

                {/* Booth tiles */}
                {boothGrid.map((b) => {
                  const active = selectedBooth?.id === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={clsx("booth", b.className, active && "selected")}
                      onClick={() => handleSelectBooth(b)}
                      aria-pressed={active}
                      title="Click to choose this booth and pick your start date"
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>

              <p className="inline-help">
                Click one booth to select, then choose a start date. Current booth:{" "}
                <strong>{selectedBooth ? `Booth ${selectedBooth.label}` : "—"}</strong>
              </p>

              <p className="inline-help">
                {startDate ? (
                  <>
                    Start: <strong>{startDate.toLocaleDateString()}</strong>{" "}
                    {computedEnd && (
                      <>
                        &nbsp;•&nbsp; End: <strong>{computedEnd.toLocaleDateString()}</strong>
                      </>
                    )}
                  </>
                ) : (
                  <>No start date selected yet.</>
                )}
              </p>
            </div>
          </div>

          <div className="form-actions">
            <Link href="/events" className="btn btn-ghost" role="button">
              Cancel
            </Link>
            <button className="btn btn-primary" disabled={submitting}>
              {submitting ? "Submitting…" : "Reserve Booth"}
            </button>
          </div>

          {/* Keep global banner for non-calendar messages only */}
          {msg && !calendarOpen && (
            <div className={clsx("alert", msg.type === "ok" ? "alert--ok" : "alert--err")}>
              {msg.text}
            </div>
          )}
        </form>
      </div>

      {/* Calendar modal */}
      <Dialog open={calendarOpen} onClose={() => setCalendarOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <Dialog.Title className="text-lg font-semibold mb-1">
              Choose start date{selectedBooth ? ` — Booth ${selectedBooth.label}` : ""}
            </Dialog.Title>
            <p className="text-sm text-gray-600 mb-3">
              <span style={{ color: "#ef4444", fontWeight: 700 }}>Red</span> days are already reserved. Your chosen{" "}
              <span style={{ color: "#2563eb", fontWeight: 700 }}>blue</span> range must not overlap them.
            </p>

            <DayPicker
              mode="single"
              weekStartsOn={1}
              selected={startDate || undefined}
              onSelect={onSelectStartDate}
              modifiers={{
                reserved: reservedRanges,
                selectedRange: startDate && computedEnd ? { from: startDate, to: computedEnd } : undefined,
              }}
              modifiersStyles={{
                reserved: { backgroundColor: "#ef4444", color: "white" },
                selectedRange: { backgroundColor: "#2563eb", color: "white" },
              }}
              disabled={{ before: startOfDay(new Date()) }}
              footer={
                <div className="mt-2 text-sm space-y-1">
                  {startDate && (
                    <div>
                      Selected range:&nbsp;
                      <strong>{startDate.toLocaleDateString()}</strong>
                      {computedEnd ? (
                        <>
                          {" "}
                          &rarr; <strong>{computedEnd.toLocaleDateString()}</strong>
                        </>
                      ) : null}
                    </div>
                  )}
                  {calendarError && (
                    <div className="text-red-600 font-semibold">{calendarError}</div>  // ⬅️ INLINE ERROR
                  )}
                </div>
              }
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setCalendarError("");
                  setCalendarOpen(false);
                }}
                type="button"
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  if (!startDate) return;
                  if (collidesWithReserved(startDate)) {
                    setCalendarError("Chosen range overlaps reserved dates. Pick a different start date.");
                    return;
                  }
                  setCalendarError("");
                  setCalendarOpen(false);
                }}
                disabled={!startDate}
                title={!startDate ? "Pick a date first" : "Use selected date"}
              >
                Use this date
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
