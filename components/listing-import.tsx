"use client";

import { animate } from "animejs";
import { useEffect, useRef, useState } from "react";
import type { ListingFields } from "@/lib/listing-import";

type ImportState = "idle" | "fetching" | "success" | "error";

export function ListingImport({ onImport, disabled }: { onImport: (fields: ListingFields) => void; disabled?: boolean }) {
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
      const fields = payload.fields as ListingFields;
      onImport(fields);
      setSummary([fields.year, fields.make, fields.model].filter(Boolean).join(" ") || "Listing details");
      setMessage(payload.note as string);
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That listing could not be read. Enter the details manually.");
      setState("error");
    }
  }

  return (
    <div className="history-input" style={{ borderTop: "1px solid var(--line)", marginTop: 18, paddingTop: 14 }}>
      <p className="kicker">PASTE A LISTING LINK <span>AutoTrader · Kijiji · Carpages · Clutch</span></p>
      <label className="vin-field"><span>Listing URL</span>
        <div className="vin-control">
          <input
            type="url"
            value={url}
            onChange={(event) => { setUrl(event.target.value); if (state === "success" || state === "error") { setState("idle"); setMessage(""); } }}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void importListing(); } }}
            spellCheck={false}
            placeholder="https://www.autotrader.ca/..."
            aria-label="Listing URL"
          />
          <button type="button" onClick={importListing} disabled={disabled || state === "fetching" || url.trim() === ""}>{state === "fetching" ? "IMPORTING…" : "Import listing"}</button>
        </div>
      </label>
      {state === "error" ? <div className="lookup-error" role="alert" ref={noteRef}>{message}</div> : null}
      {state === "success" ? <div className="decoded-mini" role="status" ref={noteRef}>
        <span>LISTING DETAILS FOUND</span>
        <strong>{summary}</strong>
        <p>{message}</p>
        <small>Edit any field before you check the price.</small>
      </div> : null}
    </div>
  );
}
