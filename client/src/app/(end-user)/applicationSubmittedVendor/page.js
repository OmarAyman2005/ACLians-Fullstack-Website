"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import "./applicationSubmittedVendor.css";

export default function ApplicationSubmittedVendorPage() {
  const search = useSearchParams();
  // optional hints you can pass in your redirect: ?type=b ooth|bazaar&ref=ABC123
  const type = (search.get("type") || "booth").toLowerCase();
  const ref = search.get("ref");

  const title =
    type === "bazaar"
      ? "Bazaar application submitted!"
      : "Booth application submitted!";

  const subtitle =
    type === "bazaar"
      ? "Your bazaar request has been received. We’ll review it and notify you by email."
      : "Your booth request has been received. We’ll review it and notify you by email.";

  return (
    <div className="submitted-page">
      <div className="submitted-card">
        <div className="status-icon" aria-hidden="true">
          {/* Checkmark */}
          <svg width="64" height="64" viewBox="0 0 24 24" role="img">
            <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.12" />
            <path
              d="M7 12.5l3.2 3.2L17 9.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="submitted-title">{title}</h1>
        <p className="submitted-subtitle">{subtitle}</p>

        {ref && (
          <p className="submitted-ref">
            Reference: <strong>{ref}</strong>
          </p>
        )}

        {/* Primary actions */}
        <div className="submitted-actions">
          <Link href="/vendor-requests" className="btn btn-primary" role="button">
            View my applications
          </Link>
          {/* Changed from “Back to vendor home” (/) to “Return to home” (/home) */}
          <Link href="/home" className="btn btn-ghost" role="button">
            Return to home
          </Link>
        </div>

        {/* Removed the “Want to submit another one?” block to avoid directing to /events or vendor apply flows */}
      </div>
    </div>
  );
}
