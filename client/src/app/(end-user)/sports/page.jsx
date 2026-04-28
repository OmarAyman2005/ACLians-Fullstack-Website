"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sportsBase } from "@/lib/api";

export default function SportsPage() {
  const [courts, setCourts] = useState([]);
  const [courtId, setCourtId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const shakeRef = useRef(new Map());
  const reservationCacheRef = useRef(new Map());

  // Load courts once
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${sportsBase}/courts`, { cache: "no-store" });
        const json = await res.json();
        if (!cancel) setCourts(json?.data || []);
      } catch {
        /* ignore */
      }
    })();
    return () => (cancel = true);
  }, []);

  // Load availability whenever courtId/date changes
  useEffect(() => {
    if (!courtId || !date) return;
    let cancel = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const url = new URL(`${sportsBase}/courts/${courtId}/availability`);
        url.searchParams.set("date", date);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (!cancel) {
          const base = json?.data || [];
          const decorated = decorateSlotsBalanced(
            base,
            `${courtId}|${date}`,
            reservationCacheRef
          );
          setSlots(decorated);
        }
      } catch {
        if (!cancel) {
          setErr("Could not load availability.");
          setSlots([]);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => (cancel = true);
  }, [courtId, date]);

  const minDate = todayISO();
  const maxDate = addDaysISO(14);

  return (
    <div className="py-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-2xl bg-neutral-900 ring-1 ring-neutral-800 shadow-[0_20px_40px_rgba(0,0,0,.45)]">
          {/* Header */}
          <div className="px-6 sm:px-8 pt-6">
            <h1 className="text-center text-2xl sm:text-3xl font-semibold text-white">
              Sports Courts Reservation
            </h1>
            <div className="mt-3 rounded-md bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/30 px-4 py-2 text-sm text-center leading-relaxed">
              Pick a court and a date to view the available 1-hour slots.
              Thursdays extend until 10 PM. Fridays have a single Premium block (2–4 PM).
              Saturdays are off.
            </div>
          </div>

          {/* Controls + Calendar */}
          <div className="px-6 sm:px-8 pb-6 pt-4 space-y-6">
            {/* Court select */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-full sm:w-80">
                <label htmlFor="court" className="sr-only">Court</label>
                <div className="relative">
                  <select
                    id="court"
                    className="appearance-none w-full rounded-md bg-neutral-950 text-gray-100 ring-1 ring-neutral-700 focus:outline-none focus:ring-neutral-500 px-3 py-2"
                    value={courtId}
                    onChange={(e) => setCourtId(e.target.value)}
                  >
                    {!courtId && (
                      <option value="" disabled hidden>
                        Select a court…
                      </option>
                    )}
                    {courts.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {/* single custom chevron */}
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                    ▾
                  </span>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div className="rounded-xl ring-1 ring-neutral-800 bg-neutral-950 p-3">
              <MiniCalendar
                value={date}
                minISO={minDate}
                maxISO={maxDate}
                onChange={(iso) => setDate(iso)}
              />
            </div>

            {/* Messages */}
            {!courtId && (
              <div className="rounded-md bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/30 px-4 py-3 text-sm text-center leading-relaxed">
                Please select a court to view availability.
              </div>
            )}

            {courtId && !loading && !err && slots.length === 0 && isSaturday(date) && (
              <div className="rounded-md bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/30 px-4 py-3 text-sm text-center">
                🛌 Saturdays are off — no slots. Relax and recharge 😉
              </div>
            )}

            {loading && <SkeletonSlots />}

            {!loading && err && (
              <div className="rounded-md bg-red-500/10 text-red-200 ring-1 ring-red-500/30 px-4 py-3 text-sm">
                ⚠️ {err}
              </div>
            )}

            {!loading && !err && courtId && slots.length === 0 && !isSaturday(date) && (
              <div className="rounded-md bg-neutral-800 text-gray-200 ring-1 ring-neutral-700 px-4 py-3 text-sm">
                No free slots for this day.
              </div>
            )}

            {/* Slots */}
            {!loading && !err && courtId && slots.length > 0 && (
              <ul className="grid gap-4 md:grid-cols-2">
                {slots.map((s, idx) => {
                  const key = `${s.start}-${s.end}-${idx}`;
                  const reserved = !!s.reserved;
                  const premium = !!s.premium;
                  return (
                    <li key={key}>
                      <button
                        ref={(el) => shakeRef.current.set(key, el)}
                        onClick={() =>
                          reserved && animateShake(shakeRef.current.get(key))
                        }
                        className={[
                          "w-full text-left rounded-2xl px-4 py-3",
                          // stronger separation: thicker ring + subtle gradient
                          "bg-neutral-950 ring-2 ring-neutral-700",
                          "shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_14px_30px_rgba(0,0,0,.55)]",
                          "hover:ring-neutral-500 transition",
                          "bg-gradient-to-b from-neutral-950 to-neutral-900",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-white font-medium">
                              {formatTime12(s.start)} – {formatTime12(s.end)}
                            </p>
                            {premium && (
                              <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40">
                                ⭐ Premium (Fri)
                              </span>
                            )}
                          </div>

                          <span
                            className={[
                              "inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ring-1",
                              reserved
                                ? "bg-red-500/15 text-red-300 ring-red-500/40"
                                : "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
                            ].join(" ")}
                          >
                            {reserved ? "Reserved" : "Available"}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* local CSS */}
      <style jsx global>{`
        @keyframes shake-kf {
          0% { transform: translateX(0); }
          15% { transform: translateX(-3px); }
          30% { transform: translateX(3px); }
          45% { transform: translateX(-3px); }
          60% { transform: translateX(3px); }
          75% { transform: translateX(-2px); }
          100% { transform: translateX(0); }
        }
        .shake { animation: shake-kf 240ms ease-in-out; }

        /* ---- Native dropdown theme (black) & single chevron ---- */
        #court {
          appearance: none;           /* hide native arrow */
          background-color: #0a0a0a;  /* near-neutral-950 */
          color: #e5e7eb;
          border: 1px solid #3f3f46;
        }
        #court:focus { outline: none; }

        /* Menu items (black + separators) */
        #court option {
          background-color: #0a0a0a !important;
          color: #e5e7eb !important;
          padding: 8px 12px !important;
          line-height: 1.6 !important;
          /* visual separator line under each item */
          box-shadow: inset 0 -1px #2a2a2a !important;
        }
        #court option:checked {
          background-color: #27272a !important;
          color: #ffffff !important;
        }
        #court option:hover {
          background-color: #3f3f46 !important;
        }
      `}</style>
    </div>
  );
}

/* ------------ Stable random reservation logic ------------ */
function decorateSlotsBalanced(rawSlots, cacheKey, cacheRef) {
  const cache = cacheRef.current;
  let dayMap = cache.get(cacheKey);

  if (!dayMap) {
    dayMap = new Map();
    const keys = rawSlots.map((s) => `${s.start}-${s.end}`);
    const n = keys.length;

    const target = Math.round(n * (0.45 + Math.random() * 0.1));
    const shuffled = [...keys];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (let i = 0; i < target; i++) dayMap.set(shuffled[i], true);
    for (const k of keys) if (!dayMap.has(k)) dayMap.set(k, false);

    cache.set(cacheKey, dayMap);
  }

  return rawSlots.map((s) => ({
    ...s,
    reserved: !!dayMap.get(`${s.start}-${s.end}`),
  }));
}

/* ------------ Mini 14-day calendar (dark) ------------ */
function MiniCalendar({ value, minISO, maxISO, onChange }) {
  const days = useMemo(() => listNextDays(14), []);
  const monthLabel = useMemo(() => {
    const d = new Date(value || todayISO());
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [value]);

  const isDisabled = (iso) => iso < minISO || iso > maxISO;

  return (
    <div>
      <div className="mb-2 text-sm text-gray-300">{monthLabel}</div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const iso = d.iso;
          const disabled = isDisabled(iso);
          const selected = iso === value;
          const isSat = d.date.getDay() === 6;

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onChange(iso)}
              className={[
                "flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-xs ring-1 transition",
                disabled
                  ? "text-gray-500 ring-neutral-900 bg-neutral-950 cursor-not-allowed"
                  : selected
                  ? "text-white ring-blue-500 bg-blue-500/20"
                  : "text-gray-200 ring-neutral-800 bg-neutral-900 hover:ring-neutral-600",
              ].join(" ")}
              aria-label={`${weekdayName(d.date)} ${d.date.getDate()}`}
            >
              <span className="font-medium">{weekdayShort(d.date)}</span>
              <span className="text-sm">{d.date.getDate()}</span>
              {isSat && (
                <span className="mt-1 text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30">
                  OFF
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function addDaysISO(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function isSaturday(iso) {
  return new Date(iso).getDay() === 6;
}
function formatTime12(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return "";
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}
function listNextDays(n) {
  const out = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ date: d, iso });
  }
  return out;
}
function weekdayShort(d) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}
function weekdayName(d) {
  return [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][d.getDay()];
}
function animateShake(el) {
  if (!el) return;
  el.classList.remove("shake");
  // force reflow
  // eslint-disable-next-line no-unused-expressions
  el.offsetWidth;
  el.classList.add("shake");
}

function SkeletonSlots() {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="rounded-2xl p-4 ring-1 ring-neutral-800 bg-neutral-950 animate-pulse shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_12px_28px_rgba(0,0,0,.55)]"
        >
          <div className="h-5 w-1/2 bg-neutral-800 rounded mb-2" />
          <div className="h-4 w-1/3 bg-neutral-800 rounded" />
        </li>
      ))}
    </ul>
  );
}
