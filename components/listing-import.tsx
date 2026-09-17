"use client";

import { animate } from "animejs";
import { useEffect, useRef, useState } from "react";
import { readListingFields, type ListingFields } from "@/lib/listing-import";

type ImportState = "idle" | "fetching" | "success" | "error";

// `onImport` may return a short note when the parsed vehicle does not match a
// published price cell; it is appended to the import feedback.
export function ListingImport({ onImport, disabled }: { onImport: (fields: ListingFields) => string | undefined; disabled?: boolean }) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<ImportState>("idle");
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState("");
  const noteRef = useRef<HTMLDivElement>(null);

  // One brief reveal per settled state; reduced motion skips the animation and
  // the element simply renders in place.
  useEffect(() => {
    const element = noteRef.current;
    if (!element || (state !== "success" && state !== "error")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    animate(element, {
      opacity: [0, 1],
      translateY: [-6, 0],
      duration: state === "success" ? 420 : 240,
      ease: "out(3)",
    });
  }, [state]);

  async function importListing() {
    if (disabled || state === "fetching") return;
    setState("fetching");
    setMessage("");
    try {
      const response = await fetch("/api/listing-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const payload = await response.json().catch(() => null);
      if (!payload?.ok) throw new Error(payload?.reason || "That listing could not be read. Enter the details manually.");
      const fields = readListingFields(payload.fields);
      if (Object.keys(fields).length === 0) throw new Error("That listing did not contain usable vehicle details. Enter them manually.");
      const matchNote = onImport(fields);
      setSummary([fields.year, fields.make, fields.model].filter(Boolean).join(" ") || "Listing details");
      setMessage([typeof payload.note === "string" ? payload.note : "Listing details imported.", matchNote].filter(Boolean).join(" "));
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That listing could not be read. Enter the details manually.");
      setState("error");
    }
  }

  // Compact by design: the panel that holds this block is an internal
  // scroller, so the field and its button must sit well inside its clip at
  // rest (see the at-rest fit assertions in tests/e2e/listing-import.spec.ts).
  return (
    <div className="history-input" style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }}>
      <p className="kicker" style={{ marginBottom: 6 }}>PASTE A LISTING LINK <span>AutoTrader · Kijiji · Carpages · Clutch</span></p>
      <label className="vin-field">
        <div className="vin-control" style={{ gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 8 }}>
          <input
            type="url"
            value={url}
            onChange={(event) => { setUrl(event.target.value); if (state === "success" || state === "error") { setState("idle"); setMessage(""); } }}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void importListing(); } }}
            spellCheck={false}
            placeholder="https://www.autotrader.ca/..."
            aria-label="Listing URL"
          />
          <button type="button" onClick={importListing} disabled={disabled || state === "fetching" || url.trim() === ""} style={{ whiteSpace: "nowrap" }}>{state === "fetching" ? "IMPORTING…" : "Import listing"}</button>
        </div>
      </label>
      {state === "error" ? <div className="lookup-error" role="alert" ref={noteRef} style={{ margin: "6px 0 0", fontSize: 10 }}>{message}</div> : null}
      {state === "success" ? <div className="decoded-mini" role="status" ref={noteRef} style={{ marginTop: 6, padding: "7px 9px" }}>
        <p style={{ fontSize: 9, margin: 0, color: "var(--green)", letterSpacing: ".04em" }}>LISTING DETAILS FOUND</p>
        <strong style={{ fontSize: 12, lineHeight: 1.3 }}>{summary}</strong>
        <p style={{ fontSize: 9.5, margin: "2px 0 0", lineHeight: 1.4 }}>{message}</p>
      </div> : null}
    </div>
  );
}
