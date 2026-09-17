"use client";

import { Tabs } from "@base-ui/react/tabs";
import { Dialog } from "@base-ui/react/dialog";
import { ListingImport } from "@/components/listing-import";
import { MarketComparison } from "@/components/market-comparison";
import { MileageCurve } from "@/components/mileage-curve";
import { SavedScenarios } from "@/components/saved-scenarios";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { conditionModelMetadata, CONDITION_TIER_GRADE, CONDITION_TIER_LABEL, predictConditionAdjustedValue, type ConditionProfile, type ConditionTier, type ConditionValuation } from "@/lib/condition-model";
import { bandPosition, bandScale, layoutBandItems } from "@/lib/band-layout";
import { confidenceForSample, dealSignalForPrediction, displayBandValues, formatCad, formatNumber, type MarketRow } from "@/lib/market";
import { normalizeVin, validateNorthAmericanVin, vinStatusCopy } from "@/lib/vin";
import { resolveVinMarketSelection, vinMarketEditAction } from "@/lib/vin-market-match";
import type { ListingFields } from "@/lib/listing-import";
import { decodeScenario, encodeScenario, loadScenarios, makeSavedScenario, saveScenarios, type SavedScenario, type ScenarioInputs } from "@/lib/scenario-store";
import type { VinLookupResponse } from "@/lib/vin-report";

type FormState = {
  province: string;
  make: string;
  model: string;
  year: string;
  askingPrice: string;
  odometer: string;
  vin: string;
  conditionTier: ConditionTier;
};

const initialForm: FormState = {
  province: "ON", make: "Toyota", model: "RAV4", year: "2021", askingPrice: "31995", odometer: "89000",
  vin: "", conditionTier: "average",
};

const CONDITION_TIERS: ConditionTier[] = ["below-average", "rough", "average"];

const CONDITION_TIER_DESCRIPTION: Record<ConditionTier, string> = {
  "below-average": "Salvage, rebuilt, or branded title",
  rough: "Needs mechanical or cosmetic work",
  average: "Typical used condition",
};

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}


function CheckCircleIcon() {
  return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.6 12.2l2.2 2.2 4.4-4.8" /></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>;
}

const FACTOR_ICONS: Record<string, ReactElement> = {
  "Identity & age": <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="11" r="2" /><path d="M6 16.5c.8-1.4 2-2 3-2s2.2.6 3 2M15 10h3.5M15 13.5h3.5" /></svg>,
  "Local market": <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.3-6.5-10.3A6.5 6.5 0 0112 4a6.5 6.5 0 016.5 6.7C18.5 15.7 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.3" /></svg>,
  "Odometer": <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5.5 18.5a8.5 8.5 0 1113 0" /><path d="M12 13.5l3.5-3.8" /><circle cx="12" cy="14" r="1.4" /></svg>,
  "Trim & drivetrain": <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M5 4v16M9 4v16M13 4v16M17.5 4L19 20M19 4l-1.5 16" /></svg>,
  "Condition": <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.4-3 8.4-7 10-4-1.6-7-5.6-7-10V6l7-3z" /><path d="M9.2 12.2l2 2 3.6-4" /></svg>,
  "Options & transaction": <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 8h6M9 11.5h6M9 15h3.5" /></svg>,
};

function PredictionBand({ valuation, askingPrice, row }: { valuation: ConditionValuation; askingPrice?: number; row: MarketRow }) {
  const band = displayBandValues(row, valuation);
  const scale = bandScale(band);
  const position = (value: number) => bandPosition(value, scale.min, scale.max);
  const medianPos = position(band.p50);
  const askPos = askingPrice !== undefined ? position(askingPrice) : null;
  const gapPp = askPos !== null ? Math.abs(askPos - medianPos) : null;
  const labelsClose = gapPp !== null && gapPp < 14;
  const labelsExact = gapPp !== null && gapPp < 2;
  const bandRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const percentiles = [
    { label: "P10", value: band.p10 },
    { label: "P25", value: band.p25 },
    { label: "MEDIAN (P50)", value: band.p50, emphasis: true },
    { label: "P75", value: band.p75 },
    { label: "P90", value: band.p90 },
  ];

  // One coordinate system: `position()` percent is the only source of truth.
  // Measure the rendered boxes, then hand back only the minimal containment
  // shift (`--band-shift`) and caption rows (`--band-row`). Nothing else moves
  // a marker off its value: the ask callout sits above the bar and the median
  // callout below it, so the two never share vertical space. Each callout
  // carries a decorative `.band-link` whose length/angle are computed from the
  // same measured dot/label boxes, so a clamped (shifted) callout still gets a
  // connector that lands on its dot.
  useLayoutEffect(() => {
    const bandEl = bandRef.current;
    const captionEl = captionRef.current;
    if (!bandEl || !captionEl) return;
    const finiteBand = [band.p10, band.p25, band.p50, band.p75, band.p90].every((value) => Number.isFinite(value));
    if (!finiteBand || (askingPrice !== undefined && !Number.isFinite(askingPrice))) return;

    const apply = () => {
      if (!bandEl.isConnected || !captionEl.isConnected) return;
      const bandRect = bandEl.getBoundingClientRect();
      if (bandRect.width <= 0) return;
      const cardRect = (bandEl.closest(".valuation-band") ?? bandEl).getBoundingClientRect();
      const minCenter = cardRect.left + 1 - bandRect.left;
      const maxCenter = cardRect.right - 1 - bandRect.left;

      const labels: Array<{ element: HTMLElement; link: HTMLElement | null; dot: HTMLElement; position: number }> = [];
      bandEl.querySelectorAll<HTMLElement>(".band-median, .band-asking").forEach((dot) => {
        const element = dot.querySelector<HTMLElement>("i");
        const declared = Number(dot.dataset.bandPos);
        if (element && Number.isFinite(declared)) labels.push({ element, link: dot.querySelector<HTMLElement>(".band-link"), dot, position: declared });
      });
      const labelItems = labels.map(({ element, position: itemPosition }) => {
        const rect = element.getBoundingClientRect();
        return { position: itemPosition, width: rect.width, height: rect.height };
      });
      const labelLayout = layoutBandItems(labelItems, bandRect.width, minCenter, maxCenter, 6);
      const askEntry = labels.find(({ dot }) => dot.classList.contains("band-asking"));
      const medianEntry = labels.find(({ dot }) => dot.classList.contains("band-median"));
      const bandStyle = getComputedStyle(bandEl);
      const borderWidth = Number.parseFloat(bandStyle.getPropertyValue("--band-dot-border")) || 3;
      const embed = Number.parseFloat(bandStyle.getPropertyValue("--band-link-embed")) || 2;
      const siblingEmbed = Number.parseFloat(bandStyle.getPropertyValue("--band-link-sibling-embed")) || 0.5;
      const linkThickness = Number.parseFloat(bandStyle.getPropertyValue("--band-link-thickness")) || 2;
      // A dot's settled centre is its declared value position, NOT its live
      // rect: `left` carries a 460ms spring, and a re-measure (cascade select,
      // ResizeObserver, fonts) can land mid-flight. Sibling avoidance must use
      // the settled distance or a transient overlap writes the short merged-disc
      // link (7.5px) with nothing left to re-measure after the spring settles.
      const declaredCenterX = (position: number) => bandRect.left + (bandRect.width * position) / 100;
      labels.forEach(({ element, link, dot, position }, index) => {
        const shift = labelLayout.shifts[index];
        element.style.setProperty("--band-shift", `${shift}px`);
        if (!link) return;
        // Connector geometry is measured after the shift lands. The link renders
        // inside its dot, from the *visible* disc edge (the border box inset by
        // the background-coloured ring) to the measured callout edge, so no
        // background gap can appear; it rides the dot's `left` transition and
        // only the diagonal changes when a containment clamp shifts a callout.
        // Vertical positions are not animated, so live y values stay exact.
        const dotRect = dot.getBoundingClientRect();
        const labelRect = element.getBoundingClientRect();
        const above = dot.classList.contains("band-asking");
        let anchorY = above ? dotRect.top + borderWidth + embed : dotRect.bottom - borderWidth - embed;
        // Exact/near-coincident discs: when the sibling's visible disc reaches
        // past this dot at the connector x, start on the outer visible edge (half
        // a pixel in) so the line never floats over the sibling's ring.
        const siblingEntry = above ? medianEntry : askEntry;
        if (siblingEntry) {
          const siblingRect = siblingEntry.dot.getBoundingClientRect();
          const radius = siblingRect.width / 2 - borderWidth;
          const offsetX = declaredCenterX(position) - declaredCenterX(siblingEntry.position);
          if (Math.abs(offsetX) <= radius) {
            const siblingY = siblingRect.y + siblingRect.height / 2 + (above ? -1 : 1) * Math.sqrt(radius * radius - offsetX * offsetX);
            anchorY = above ? Math.min(anchorY, siblingY + siblingEmbed) : Math.max(anchorY, siblingY - siblingEmbed);
          }
        }
        // `top` is relative to the dot's padding box; the link's centreline
        // starts at the anchor, so subtract the 2px bar's half height.
        const paddingTop = dotRect.top + borderWidth;
        const topPx = anchorY - paddingTop - linkThickness / 2;
        // Callout-side x is the measured containment shift (dot centre + shift),
        // independent of the dot's in-flight `left`.
        const dx = shift;
        const dy = above ? labelRect.bottom - anchorY : labelRect.top - anchorY;
        link.style.setProperty("--band-link-y", `${topPx}px`);
        link.style.setProperty("--band-link-length", `${Math.hypot(dx, dy)}px`);
        link.style.setProperty("--band-link-angle", `${(Math.atan2(dy, dx) * 180) / Math.PI}deg`);
      });

      const captions = Array.from(captionEl.querySelectorAll<HTMLElement>("span[data-band-pos]"));
      const captionItems = captions.map((caption) => {
        const rect = caption.getBoundingClientRect();
        return { position: Number(caption.dataset.bandPos), width: rect.width, height: rect.height };
      });
      const captionLayout = layoutBandItems(captionItems, bandRect.width, minCenter, maxCenter, 6);
      captions.forEach((caption, index) => {
        caption.style.setProperty("--band-shift", `${captionLayout.shifts[index]}px`);
        caption.style.setProperty("--band-row", String(captionLayout.rows[index]));
      });
      captionEl.style.setProperty("--band-row-h", `${captionLayout.rowHeight}px`);
      captionEl.style.height = `${captionLayout.rowCount * captionLayout.rowHeight}px`;
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(bandEl);
    void document.fonts.ready.then(apply);
    return () => observer.disconnect();
  }, [band.p10, band.p25, band.p50, band.p75, band.p90, askingPrice]);

  return (
    <div className="band-wrap prediction-band">
      <div className="band-caption" ref={captionRef}>
        {percentiles.map((p) => <span key={p.label} className={p.emphasis ? "emphasis" : undefined} data-band-pos={position(p.value)} style={{ left: `${position(p.value)}%` }}><small>{p.label}</small><b>{formatCad(p.value)}</b></span>)}
      </div>
      <div ref={bandRef} className={`price-band${labelsClose ? " band-close" : ""}${labelsExact ? " band-exact" : ""}`}>
        <span className="band-outer" />
        <span className="band-typical" style={{ left: `${position(band.p10)}%`, right: `${100 - position(band.p90)}%` }} />
        <span className="band-median" data-band-pos={medianPos} style={{ left: `${position(band.p50)}%` }}><span className="band-link" aria-hidden="true" /><i><b>ML estimate</b>{formatCad(band.p50)}</i></span>
        {askingPrice ? <span className="band-asking" data-band-pos={askPos ?? undefined} style={{ left: `${position(askingPrice)}%` }}><span className="band-link" aria-hidden="true" /><i><b>Listing ask</b>{formatCad(askingPrice)}</i></span> : null}
      </div>
    </div>
  );
}

type FactorState = "modelled" | "context" | "missing";

function FactorCoverage({ row, odometer, vinReport, valuation, tier }: { row: MarketRow; odometer?: number; vinReport?: VinLookupResponse; valuation: ConditionValuation; tier: ConditionTier }) {
  const trimLabel = vinReport
    ? [vinReport.vehicle.trim, vinReport.vehicle.driveType, vinReport.vehicle.transmission].filter((value) => value && value !== "Not encoded").join(" · ")
    : "Decode a VIN to identify the exact specification";
  const factors: Array<{ label: string; value: string; note: string; state: FactorState }> = [
    { label: "Identity & age", value: `${row.y} ${row.mk} ${row.md}`, note: "Exact make, model family and model year", state: "modelled" },
    { label: "Local market", value: `${row.p} · ${formatNumber(row.n)} vehicles`, note: "Current province-level dealer inventory", state: "modelled" },
    { label: "Odometer", value: odometer !== undefined ? `${formatNumber(odometer)} km` : "Market median used", note: valuation.isOdometerExtrapolation ? (odometer !== undefined ? "Outside the model's trained support; the mileage comparison was capped" : "The market median is outside the model's trained odometer support; no mileage comparison was applied") : "Transaction-trained relative to the Canadian cell median", state: "modelled" },
    { label: "Trim & drivetrain", value: trimLabel, note: "Decoded specifications are context until a live listing feed supplies row-level pricing", state: vinReport ? "context" : "missing" },
    { label: "Condition", value: `Auction-grade equivalent ${valuation.conditionScore.toFixed(2)} (scale -1 to 4)`, note: `Tier: ${CONDITION_TIER_LABEL[tier]} · the auction-grade equivalent drives the model`, state: "modelled" },
    { label: "Options & transaction", value: "Not available in public data", note: "Packages, fees, seller type and completed-sale price remain unpriced", state: "missing" },
  ];
  const modelledCount = factors.filter((factor) => factor.state === "modelled").length;

  return (
    <section className="factor-coverage" aria-labelledby="factor-coverage-title">
      <div className="factor-coverage-head">
        <div><p className="kicker">FACTOR COVERAGE</p><h4 id="factor-coverage-title">What this value knows—and what it cannot know yet.</h4></div>
        <strong><span>{modelledCount}</span> / {factors.length}<small>factor groups modelled</small></strong>
      </div>
      <div className="factor-grid">
        {factors.map((factor) => <article key={factor.label} className={factor.state}>
          <i className="factor-icon" aria-hidden="true">{FACTOR_ICONS[factor.label]}</i>
          <div><span>{factor.label}</span><em>{factor.state === "modelled" ? "USED" : factor.state === "context" ? "CONTEXT" : "UNPRICED"}</em></div>
          <strong title={factor.note}>{factor.value}</strong>
        </article>)}
      </div>
    </section>
  );
}

export function ValuationWorkbench() {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [lookupError, setLookupError] = useState("");
  const [vinReport, setVinReport] = useState<VinLookupResponse>();
  const [marketBlockedByVin, setMarketBlockedByVin] = useState(false);
  const [resultPulse, setResultPulse] = useState(0);
  const [editorTab, setEditorTab] = useState("listing");
  const [viewTab, setViewTab] = useState("price");
  const [baseline, setBaseline] = useState<{ form: FormState; estimate: number; low: number; high: number }>();
  const evidenceRef = useRef<HTMLButtonElement>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [scenarioNotice, setScenarioNotice] = useState("");
  const [marketVersion, setMarketVersion] = useState<string>();

  useEffect(() => {
    fetch("/data/market.json")
      .then((response) => { if (!response.ok) throw new Error("Market data could not be loaded"); return response.json(); })
      .then((data: MarketRow[]) => setRows(data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
    // The manifest identifies the market release saved checks are bound to.
    fetch("/data/manifest.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((manifest: { sourceRetrievedAt?: unknown } | null) => {
        if (typeof manifest?.sourceRetrievedAt === "string") setMarketVersion(manifest.sourceRetrievedAt);
      })
      .catch(() => {});
  }, []);

  // One-shot mount read of browser-only state; there is no hydration-safe
  // render-time alternative without changing the page shell.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSavedScenarios(loadScenarios()); }, []);

  // A valid share payload replaces the initial form once; anything malformed
  // is ignored and the defaults stay untouched.
  useEffect(() => {
    const shared = decodeScenario(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (shared) setForm({ ...initialForm, ...shared });
  }, []);

  const provinces = useMemo(() => uniqueSorted(rows.map((row) => row.p)), [rows]);
  const provinceRows = useMemo(() => rows.filter((row) => row.p === form.province), [rows, form.province]);
  // An imported (or restored) identity may not have a published cell. Keeping
  // its exact spelling as an option lets the selects show the real vehicle
  // instead of silently rendering a different one.
  const makes = useMemo(() => {
    const list = uniqueSorted(provinceRows.map((row) => row.mk));
    return form.make && !list.includes(form.make) ? uniqueSorted([...list, form.make]) : list;
  }, [provinceRows, form.make]);
  const makeRows = useMemo(() => provinceRows.filter((row) => row.mk === form.make), [provinceRows, form.make]);
  const models = useMemo(() => {
    const list = uniqueSorted(makeRows.map((row) => row.md));
    return form.model && !list.includes(form.model) ? uniqueSorted([...list, form.model]) : list;
  }, [makeRows, form.model]);
  const modelRows = useMemo(() => makeRows.filter((row) => row.md === form.model), [makeRows, form.model]);
  const years = useMemo(() => {
    const list = modelRows.map((row) => row.y);
    if (form.year && !list.some((year) => String(year) === form.year)) list.push(Number(form.year));
    return [...new Set(list)].filter(Number.isFinite).sort((a, b) => b - a);
  }, [modelRows, form.year]);
  const selectedResult = modelRows.find((row) => String(row.y) === form.year);
  const result = marketBlockedByVin ? undefined : selectedResult;

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    const vinAction = vinMarketEditAction(field);
    if (vinAction.clearsBlock) setMarketBlockedByVin(false);
    if (vinAction.clearsReport) { setVinReport(undefined); setLookupState("idle"); }
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "province") {
        const candidates = rows.filter((row) => row.p === value);
        next.make = uniqueSorted(candidates.map((row) => row.mk))[0] ?? "";
        const makeCandidates = candidates.filter((row) => row.mk === next.make);
        next.model = uniqueSorted(makeCandidates.map((row) => row.md))[0] ?? "";
        next.year = String(makeCandidates.filter((row) => row.md === next.model).sort((a, b) => b.y - a.y)[0]?.y ?? "");
      }
      if (field === "make") {
        const candidates = rows.filter((row) => row.p === current.province && row.mk === value);
        next.model = uniqueSorted(candidates.map((row) => row.md))[0] ?? "";
        next.year = String(candidates.filter((row) => row.md === next.model).sort((a, b) => b.y - a.y)[0]?.y ?? "");
      }
      if (field === "model") next.year = String(rows.filter((row) => row.p === current.province && row.mk === current.make && row.md === value).sort((a, b) => b.y - a.y)[0]?.y ?? "");
      return next;
    });
  }

  async function decodeVin() {
    if (validateNorthAmericanVin(form.vin) !== "valid") { setLookupState("error"); setLookupError("Check the 17-character VIN before decoding."); return; }
    setLookupState("loading"); setLookupError("");
    try {
      const response = await fetch("/api/vin-decode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vin: form.vin }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "VIN lookup failed.");
      const report = payload as VinLookupResponse;
      setVinReport(report);
      const { selection, cellMatched } = resolveVinMarketSelection({
        rows,
        province: form.province,
        current: { province: form.province, make: form.make, model: form.model, year: form.year },
        decoded: { make: report.vehicle.make, model: report.vehicle.model, year: report.vehicle.year },
      });
      setMarketBlockedByVin(!cellMatched);
      setForm((current) => ({ ...current, ...selection }));
      setLookupState("success"); setResultPulse((value) => value + 1);
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }), 120);
    } catch (error) { setLookupState("error"); setLookupError(error instanceof Error ? error.message : "VIN lookup failed."); }
  }

  // A listing title can truncate the model family ("Grand" for "Grand
  // Cherokee"). Exact spellings win first; otherwise the truncated token is
  // matched against published families by whitespace prefix, preferring a
  // family with a cell for the parsed year, then the largest family.
  function publishedModelMatch(province: string, make: string, model: string, year: string) {
    const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
    const families = [...new Set(rows.filter((row) => row.p === province && row.mk.toLowerCase() === make.toLowerCase()).map((row) => row.md))];
    if (families.some((family) => normalized(family) === normalized(model))) return model;
    const candidates = families.filter((family) => family.toLowerCase().startsWith(`${model.toLowerCase()} `));
    if (candidates.length === 0) return model;
    const rank = (family: string) => {
      const cells = rows.filter((row) => row.p === province && row.mk.toLowerCase() === make.toLowerCase() && row.md === family);
      return [cells.some((row) => String(row.y) === year) ? 1 : 0, cells.reduce((sum, row) => sum + row.n, 0), -family.length];
    };
    candidates.sort((a, b) => {
      const left = rank(a); const right = rank(b);
      for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return right[index] - left[index];
      return a.localeCompare(b);
    });
    return candidates[0];
  }

  // Parsed listing fields are mapped onto published cells the same way a VIN
  // decode is; a field the parser missed is never overwritten. When the
  // identity has no published cell, the parsed identity still replaces the
  // form so the user sees their vehicle and the no-cell state; the listing's
  // odometer and asking price are not applied to a different vehicle.
  function applyListingImport(fields: ListingFields): string | undefined {
    const province = fields.province && rows.some((row) => row.p === fields.province) ? fields.province : form.province;
    const make = fields.make ?? form.make;
    const year = fields.year ?? form.year;
    const model = publishedModelMatch(province, make, fields.model ?? form.model, year);
    const { selection, cellMatched } = resolveVinMarketSelection({
      rows,
      province,
      current: { province: form.province, make: form.make, model: form.model, year: form.year },
      decoded: { make, model, year: Number(year) },
    });
    const next = cellMatched ? selection : { province, make, model, year };
    const identityChanged = next.province !== form.province || next.make !== form.make || next.model !== form.model || next.year !== form.year;
    if (identityChanged) { setVinReport(undefined); setLookupState("idle"); setMarketBlockedByVin(false); }
    if (!cellMatched) {
      setForm((current) => ({ ...current, ...next }));
      return `No published price cell matches ${year} ${make} ${model}.`;
    }
    setForm((current) => ({
      ...current,
      ...selection,
      ...(fields.odometer ? { odometer: fields.odometer } : {}),
      ...(fields.askingPrice ? { askingPrice: fields.askingPrice } : {}),
    }));
    return undefined;
  }

  function checkPrice() { resultRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); resultRef.current?.focus({ preventScroll: true }); }

  const askingPrice = Number(form.askingPrice) || undefined;
  const odometer = form.odometer === "" ? undefined : Number(form.odometer);
  const confidence = result ? confidenceForSample(result.n) : "limited";
  const conditionProfile: ConditionProfile = {
    conditionGrade: CONDITION_TIER_GRADE[form.conditionTier],
  };
  const baseValue = result ? result.p50 : undefined;
  const conditionValuation = result && baseValue ? predictConditionAdjustedValue({
    baseValue,
    baseLow: result.p10,
    baseHigh: result.p90,
    baselineOdometerKm: result.km,
    targetOdometerKm: odometer ?? result.km,
    profile: conditionProfile,
  }) : undefined;
  // Same base and mileage inputs per tier; average is the reference row.
  const tierEstimates = result && baseValue ? Object.fromEntries(CONDITION_TIERS.map((tier) => [
    tier,
    predictConditionAdjustedValue({
      baseValue,
      baseLow: result.p10,
      baseHigh: result.p90,
      baselineOdometerKm: result.km,
      targetOdometerKm: odometer ?? result.km,
      profile: { conditionGrade: CONDITION_TIER_GRADE[tier] },
    }).estimate,
  ])) as Record<ConditionTier, number> : undefined;
  const tierDeltas: Record<ConditionTier, number> | undefined = tierEstimates ? {
    "below-average": tierEstimates["below-average"] - tierEstimates.average,
    rough: tierEstimates.rough - tierEstimates.average,
    average: 0,
  } : undefined;
  const dealSignal = askingPrice && conditionValuation ? dealSignalForPrediction(askingPrice, conditionValuation, odometer !== undefined) : undefined;
  const vinStatus = validateNorthAmericanVin(form.vin);
  const estimate = conditionValuation?.estimate;
  const estimateDifference = askingPrice && estimate ? askingPrice - estimate : undefined;
  const adjustment = conditionValuation?.adjustmentCad ?? 0;
  const askSliderMin = conditionValuation ? Math.floor(conditionValuation.low * .65 / 100) * 100 : 0;
  const askSliderMax = conditionValuation ? Math.ceil(conditionValuation.high * 1.3 / 100) * 100 : 0;
  const askSliderValue = Math.min(askSliderMax, Math.max(askSliderMin, askingPrice ?? estimate ?? 0));
  const askSliderFill = askSliderMax > askSliderMin ? Math.min(100, Math.max(0, ((askSliderValue - askSliderMin) / (askSliderMax - askSliderMin)) * 100)) : 0;
  const [estimatePulse, setEstimatePulse] = useState(0);
  const previousEstimate = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (previousEstimate.current !== undefined && previousEstimate.current !== estimate) setEstimatePulse((value) => value + 1);
    previousEstimate.current = estimate;
  }, [estimate]);

  function scenarioInputs(): ScenarioInputs {
    return {
      province: form.province, make: form.make, model: form.model, year: form.year,
      odometer: form.odometer, askingPrice: form.askingPrice, conditionTier: form.conditionTier,
    };
  }

  function saveCurrentScenario() {
    const next = [makeSavedScenario(scenarioInputs(), estimate, marketVersion), ...savedScenarios];
    if (!saveScenarios(next)) { setScenarioNotice("Saving is unavailable in this browser."); return; }
    setSavedScenarios(next);
    setScenarioNotice("Saved.");
  }

  async function copyScenarioLink() {
    const link = `${window.location.origin}${window.location.pathname}?${encodeScenario(scenarioInputs())}`;
    try {
      await navigator.clipboard.writeText(link);
      setScenarioNotice("Link copied.");
    } catch {
      setScenarioNotice("Copy failed — copy the URL from the address bar.");
    }
  }

  function restoreSavedScenario(scenario: SavedScenario) {
    setForm({ ...initialForm, ...scenario.inputs });
    setVinReport(undefined); setLookupState("idle"); setMarketBlockedByVin(false);
  }

  function deleteSavedScenario(id: string) {
    const next = savedScenarios.filter((scenario) => scenario.id !== id);
    if (saveScenarios(next)) setSavedScenarios(next);
  }

  return (
    <>
    <div className="workspace-heading"><div><p className="kicker">CANADIAN USED-VEHICLE RESEARCH</p><h1>Get a feel for the price<span>.</span></h1></div><p>One listing. A clearer picture.</p></div>
    <div className="workbench" id="check">
      <form id="listing" className="vehicle-form" onSubmit={(event) => { event.preventDefault(); checkPrice(); }}>
        <div className="form-heading"><h2>Your listing</h2><span className="form-live"><i /> Live estimate</span></div>
        <Tabs.Root value={editorTab} onValueChange={value => setEditorTab(String(value))} className="editor-tabs">
          <Tabs.List className="segmented" aria-label="Listing details"><Tabs.Tab value="listing">Vehicle</Tabs.Tab><Tabs.Tab value="condition">Condition</Tabs.Tab><Tabs.Tab value="vin">VIN</Tabs.Tab><Tabs.Indicator className="tab-indicator" /></Tabs.List>
          <Tabs.Panel value="listing" keepMounted className="editor-panel" style={{ height: "auto", paddingBottom: 0 }}><p className="panel-hint">Start with a car you’re considering.</p>
        <div className="field-rows">
          <label className="field-row"><span>Province</span><select aria-label="Province" value={form.province} onChange={(event) => update("province", event.target.value)} disabled={loading}>{provinces.map((province) => <option key={province}>{province}</option>)}</select></label>
          <label className="field-row"><span>Make</span><select aria-label="Make" value={form.make} onChange={(event) => update("make", event.target.value)} disabled={loading}>{makes.map((make) => <option key={make}>{make}</option>)}</select></label>
          <label className="field-row"><span>Model</span><select aria-label="Model" value={form.model} onChange={(event) => update("model", event.target.value)} disabled={loading}>{models.map((model) => <option key={model}>{model}</option>)}</select></label>
          <label className="field-row"><span>Model year</span><select aria-label="Model year" value={form.year} onChange={(event) => update("year", event.target.value)} disabled={loading}>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
        </div>
        <div className="field-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <label><span>Odometer <small>optional</small></span><div className="input-suffix"><input inputMode="numeric" value={form.odometer} onChange={(event) => update("odometer", event.target.value.replace(/\D/g, ""))} aria-label="Odometer in kilometres" /><i>km</i></div></label>
          <label><span>Listing asking price <small>optional</small></span><div className="input-prefix"><i>$</i><input inputMode="numeric" value={form.askingPrice} onChange={(event) => update("askingPrice", event.target.value.replace(/\D/g, ""))} aria-label="Asking price in Canadian dollars" /></div></label>
        </div>
        <ListingImport onImport={applyListingImport} disabled={loading} />

          </Tabs.Panel><Tabs.Panel value="condition" keepMounted className="editor-panel condition-panel"><p className="panel-hint">Which tier matches the listing or inspection?</p>
        <div className="condition-input">
          <div className="condition-tiers" role="group" aria-label="Condition tier">
            {CONDITION_TIERS.map((tier) => {
              const delta = tierDeltas?.[tier];
              return <button type="button" key={tier} className={form.conditionTier === tier ? "selected" : ""} aria-pressed={form.conditionTier === tier} onClick={() => update("conditionTier", tier)}>
                <span className="tier-name">{CONDITION_TIER_LABEL[tier]}</span>
                <small className="tier-desc">{CONDITION_TIER_DESCRIPTION[tier]}</small>
                {delta === undefined ? null : <span className="tier-delta" title={tier === "average" ? undefined : "Difference vs the Average tier at the same mileage"}>{tier === "average" ? <b>Reference</b> : <><b>{delta < 0 ? "−" : "+"}{formatCad(Math.abs(delta))}</b>{" "}<small>vs avg tier</small></>}</span>}
              </button>;
            })}
          </div>
          <p className="condition-note">The panel supports three tiers and does not distinguish above-average grades; the form does not offer them.</p>
        </div>
        </Tabs.Panel><Tabs.Panel value="vin" keepMounted className="editor-panel">
        <div className="history-input">
          <p className="kicker">HAVE A VIN? <span>Optional</span></p>
          <label className="vin-field"><span>17-character VIN</span><div className="vin-control"><input value={form.vin} onChange={(event) => update("vin", normalizeVin(event.target.value))} maxLength={17} spellCheck={false} autoCapitalize="characters" placeholder="Enter VIN (optional)" aria-label="Vehicle identification number" /><button type="button" onClick={decodeVin} disabled={loading || lookupState === "loading"}>{lookupState === "loading" ? "DECODING…" : "Decode VIN"}</button></div><small className={`vin-status ${vinStatus}`}>{vinStatusCopy[vinStatus]}</small></label>
          {lookupState === "error" ? <p className="lookup-error" role="alert">{lookupError}</p> : null}
          {vinReport ? <div className="decoded-mini"><span>DECODED BY {vinReport.vehicle.source}</span><strong>{vinReport.vehicle.year} {vinReport.vehicle.make} {vinReport.vehicle.model}</strong><p>{vinReport.vehicle.trim} · {vinReport.vehicle.driveType} · {vinReport.vehicle.displacementL ?? "—"} L</p><small>{vinReport.notice}{marketBlockedByVin ? " No matching price cell exists in this public release, so the previous manual selection is not used as a substitute." : ""}</small></div> : null}
          <p className="privacy-note"><LockIcon /> VIN is sent to the official NHTSA &amp; vPIC decoder only when you click Decode. AutoValue does not store it.</p>
        </div>
        </Tabs.Panel></Tabs.Root>
        <div className="editor-bottom"><button className="check-price-button" type="submit"><strong>Check this price</strong><i>→</i></button><p>Dealer asking-price reference · CAD</p></div>
      </form>

      <section key={resultPulse} ref={resultRef} className="result-panel" tabIndex={-1} aria-label="Price check result">
        {loading ? <div className="result-empty"><div className="loader" /><p>Loading the Canadian market reference…</p></div> : result ? <>
          <div className="result-head"><div><p className="kicker">{result.p} · {formatNumber(result.n)} VEHICLES IN THE REFERENCE SET</p><h3>{vinReport ? `${vinReport.vehicle.year} ${vinReport.vehicle.make} ${vinReport.vehicle.model}` : `${result.y} ${result.mk} ${result.md}`}</h3></div><button className="pin-button" type="button" onClick={() => { setBaseline({ form: { ...form, vin: "" }, estimate: estimate ?? 0, low: conditionValuation?.low ?? 0, high: conditionValuation?.high ?? 0 }); setViewTab("compare"); }}> <span aria-hidden="true">⊕</span> {baseline ? "In compare" : "Add to compare"}</button></div>

          {vinReport ? <div className="no-listing"><strong>Vehicle decoded live; no listing feed connected.</strong><p>VINs do not carry current asking price or odometer. Enter those values above, or connect a licensed inventory provider for live listing facts.</p></div> : null}

          <section className="valuation-summary" aria-label="Valuation summary">
            <div className="stat-tile ml-tile">
              <span className="stat-label">Estimated market value <span className="estimate-tag">MODELLED</span></span>
              <strong data-testid="ml-estimate" aria-live="polite" aria-atomic="true">{formatCad(estimate ?? 0)}</strong>
              {estimatePulse > 0 ? <i key={estimatePulse} className="estimate-settle" aria-hidden="true" /> : null}
              <div className="stat-foot">
                <div><small>Predicted range</small><b>{formatCad(conditionValuation?.low ?? 0)} – {formatCad(conditionValuation?.high ?? 0)}</b></div>
                <i className="stat-divider" aria-hidden="true" />
                <div><b className={adjustment === 0 ? undefined : adjustment > 0 ? "positive" : "negative"}>{adjustment === 0 ? "±$0" : `${adjustment > 0 ? "+" : "−"}${formatCad(Math.abs(adjustment))}`}</b><small>condition + mileage</small></div>
              </div>
            </div>
            <div className="stat-tile ask-tile">
              <span className="stat-label">Listing asking price</span>
              <strong>{askingPrice ? formatCad(askingPrice) : "Not entered"}</strong>
              <div className="stat-foot">
                {estimateDifference !== undefined ? <div><b className={estimateDifference > 0 ? "positive" : estimateDifference < 0 ? "negative" : undefined} title={dealSignal?.detail}>{estimateDifference > 0 ? "+" : estimateDifference < 0 ? "−" : "±"}{formatCad(Math.abs(estimateDifference))}</b><small>vs value</small></div> : <div><b>—</b><small>add an ask to compare</small></div>}
                <i className="stat-divider" aria-hidden="true" />
                {dealSignal ? <div className="signal-line"><i className={`signal-dot ${dealSignal.tone}`}><CheckCircleIcon /></i><small>{dealSignal.label}</small></div> : <div><small>enter an ask to compare</small></div>}
              </div>
            </div>
          </section>

          {conditionValuation ? <Tabs.Root className="explorer-tabs" value={viewTab} onValueChange={value => setViewTab(String(value))}>
            <Tabs.List className="explorer-nav" aria-label="Explore the valuation"><Tabs.Tab value="price">Price position</Tabs.Tab><Tabs.Tab value="mileage">Mileage</Tabs.Tab><Tabs.Tab value="markets">Across Canada</Tabs.Tab><Tabs.Tab value="compare">Compare{baseline ? <i className="saved-dot" /> : null}</Tabs.Tab><Tabs.Indicator className="explorer-indicator" /></Tabs.List>
            <div className="explorer-viewport">
            <Tabs.Panel value="price" keepMounted className="explorer-panel price-explorer">
              <div className="explorer-title"><div><h4>Where does the asking price sit?</h4></div><span className={`confidence ${confidence}`}><i />{confidence} evidence</span></div>
              <div className="valuation-band"><PredictionBand valuation={conditionValuation} askingPrice={askingPrice} row={result} /></div>
              <div className="ask-scrubber"><button type="button" aria-label="Decrease asking price by 500 dollars" onClick={() => update("askingPrice", String(Math.max(0, (askingPrice ?? estimate ?? 0) - 500)))}>−</button><label><span>Explore asking price</span><input type="range" aria-label="Explore asking price" min={askSliderMin} max={askSliderMax} step="1" value={askSliderValue} style={{ "--fill": `${askSliderFill}%` } as React.CSSProperties} onChange={event => update("askingPrice", event.target.value)} /></label><button type="button" aria-label="Increase asking price by 500 dollars" onClick={() => update("askingPrice", String((askingPrice ?? estimate ?? 0) + 500))}>+</button></div>
              <p className="range-explainer">Modelled range · Not an offer or guaranteed sale price.</p>
            </Tabs.Panel>
            <Tabs.Panel value="mileage" className="explorer-panel"><MileageCurve row={result} profile={conditionProfile} mileage={odometer ?? result.km} valuation={conditionValuation} onChange={km => update("odometer", String(km))} /></Tabs.Panel>
            <Tabs.Panel value="markets" className="explorer-panel"><MarketComparison rows={rows.filter(row => row.mk === result.mk && row.md === result.md && row.y === result.y)} selected={result.p} onSelect={row => { setForm(current => ({...current, province: row.p})); setVinReport(undefined); setLookupState("idle"); setMarketBlockedByVin(false); }} /></Tabs.Panel>
            <Tabs.Panel value="compare" className="explorer-panel comparison-panel">
              {baseline ? <><div className="explorer-title"><div><h4>See what changed.</h4><p>Your comparison stays fixed while you edit.</p></div><button className="text-button" type="button" onClick={() => setBaseline(undefined)}>Clear comparison</button></div><div className="comparison-pair"><article><span className="comparison-label">PINNED</span><h4>{baseline.form.year} {baseline.form.make} {baseline.form.model}</h4><p>{baseline.form.province} · {baseline.form.odometer.trim() ? `${formatNumber(Number(baseline.form.odometer))} km` : "Market median mileage"} · {CONDITION_TIER_LABEL[baseline.form.conditionTier]}</p><strong data-testid="pinned-estimate">{formatCad(baseline.estimate)}</strong><small>{formatCad(baseline.low)} – {formatCad(baseline.high)}</small><button type="button" onClick={() => { setForm(baseline.form); setVinReport(undefined); setLookupState("idle"); setMarketBlockedByVin(false); }}>Restore inputs ↺</button></article><article><span className="comparison-label">CURRENT</span><h4>{form.year} {form.make} {form.model}</h4><p>{form.province} · {formatNumber(odometer ?? result.km)} km · {CONDITION_TIER_LABEL[form.conditionTier]}</p><strong>{formatCad(estimate ?? 0)}</strong><small>{formatCad(conditionValuation.low)} – {formatCad(conditionValuation.high)}</small><b data-testid="scenario-delta">{(estimate ?? 0) - baseline.estimate >= 0 ? "+" : "−"}{formatCad(Math.abs((estimate ?? 0) - baseline.estimate))} from pinned</b></article></div></> : <div className="comparison-empty"><span aria-hidden="true">⊕</span><h4>Keep a point of comparison.</h4><p>Add a scenario to compare, then change the mileage, condition, or vehicle to see the difference.</p><button type="button" onClick={() => setBaseline({ form: { ...form, vin: "" }, estimate: estimate ?? 0, low: conditionValuation.low, high: conditionValuation.high })}>Compare this scenario</button></div>}
            </Tabs.Panel>
            </div>
          </Tabs.Root> : null}
          <div className="result-footer"><div><span>Canadian anchor</span><strong>{formatCad(baseValue ?? 0)}</strong></div><div><span>Model adjustment</span><strong>{adjustment < 0 ? "−" : "+"}{formatCad(Math.abs(adjustment))}</strong></div><button ref={evidenceRef} type="button" onClick={() => setEvidenceOpen(true)}>Inspect the evidence <span aria-hidden="true">↗</span></button></div>

        </> : <div className="result-empty"><p>{loadError ? "The market reference could not load." : marketBlockedByVin ? "VIN decoded, but no defensible price match is available." : "No published price cell matches that combination."}</p>{loadError ? <button type="button" onClick={() => window.location.reload()}>Reload market data</button> : null}<small>{loadError ? "Check your connection and reload this page." : marketBlockedByVin ? "Enter the listing manually only if you can select its true model family, or connect a licensed row-level inventory feed." : "Try another year or province. Sparse cells are intentionally suppressed."}</small></div>}
      </section>
    </div>
    <SavedScenarios scenarios={savedScenarios} notice={scenarioNotice} marketVersion={marketVersion} disabled={loading} onSave={saveCurrentScenario} onCopyLink={copyScenarioLink} onRestore={restoreSavedScenario} onDelete={deleteSavedScenario} />
    {result && conditionValuation ? <Dialog.Root open={evidenceOpen} onOpenChange={setEvidenceOpen}><Dialog.Portal><Dialog.Backdrop className="evidence-backdrop" /><Dialog.Popup className="evidence-popup" finalFocus={evidenceRef}><section className="studio-evidence" aria-label="Evidence behind the estimate"><header><div><p className="kicker">UNDER THE HOOD</p><Dialog.Title>Every number has a source.</Dialog.Title></div><Dialog.Close className="close-evidence" aria-label="Close evidence">×</Dialog.Close></header><Dialog.Description>The evidence behind {result.y} {result.mk} {result.md} in {result.p}.</Dialog.Description>
          {conditionValuation ? <section className="price-anatomy" aria-label="Price anatomy">
            <p className="kicker">PRICE ANATOMY</p>
            <div className="anatomy-row">
              <div className="anatomy-tile"><span>Canadian anchor</span><strong>{formatCad(baseValue ?? 0)}</strong></div>
              <b className="anatomy-op" aria-hidden="true">{adjustment < 0 ? "−" : "+"}</b>
              <div className="anatomy-tile"><span>Condition + odometer adjustment</span><strong>{adjustment === 0 ? "±$0" : `${adjustment > 0 ? "+" : "−"}${formatCad(Math.abs(adjustment))}`}</strong></div>
              <b className="anatomy-op" aria-hidden="true">=</b>
              <div className="anatomy-tile answer"><span>ML market value</span><strong>{formatCad(estimate ?? 0)}</strong></div>
            </div>
          </section> : null}

          {conditionValuation ? <FactorCoverage row={result} odometer={odometer} vinReport={vinReport} valuation={conditionValuation} tier={form.conditionTier} /> : null}

          <div className="valuation-method">
            <div><span>HYBRID ML METHOD</span><p>Gradient-boosted condition + odometer adjustment</p></div>
            <div><span>DATA FOUNDATION</span><p>{formatNumber(result.n)}-vehicle Canadian cell + {formatNumber(conditionModelMetadata.outcomes)} completed auction outcomes</p></div>
            <div><span>TEMPORAL-TEST WAPE</span><strong>{conditionModelMetadata.wapePct.toFixed(1)}%</strong></div>
            <div><span>METHOD &amp; TRANSPARENCY</span><a href="/calculation">See calculation <span aria-hidden="true">↗</span></a></div>
          </div>
          <div className="caution"><strong>Prediction boundary</strong><p>This is an ML estimate, not an observable “true price.” The condition effect transfers from historical US wholesale outcomes to a current Canadian asking-market anchor; options, inspection findings, fees and the eventual negotiated transaction remain uncertain.</p></div>

    </section></Dialog.Popup></Dialog.Portal></Dialog.Root> : null}
    </>
  );
}
