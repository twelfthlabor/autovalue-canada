"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { conditionModelMetadata, predictConditionAdjustedValue, type ConditionProfile, type ConditionValuation } from "@/lib/condition-model";
import { confidenceForSample, formatCad, formatNumber, type DealSignal, type MarketRow } from "@/lib/market";
import { normalizeVin, validateNorthAmericanVin, vinStatusCopy } from "@/lib/vin";
import type { VinLookupResponse } from "@/lib/vin-report";

type FormState = ConditionProfile & {
  province: string;
  make: string;
  model: string;
  year: string;
  askingPrice: string;
  odometer: string;
  vin: string;
};

const initialForm: FormState = {
  province: "ON", make: "Toyota", model: "RAV4", year: "2021", askingPrice: "31995", odometer: "89000",
  vin: "", conditionGrade: "average", accidentHistory: "none", mechanicalCondition: "sound",
  cosmeticCondition: "light", serviceHistory: "partial", wearItems: "good",
};

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function InfoIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></svg>;
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
  "Condition & history": <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.4-3 8.4-7 10-4-1.6-7-5.6-7-10V6l7-3z" /><path d="M9.2 12.2l2 2 3.6-4" /></svg>,
  "Options & transaction": <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 8h6M9 11.5h6M9 15h3.5" /></svg>,
};

function PredictionBand({ valuation, askingPrice, row }: { valuation: ConditionValuation; askingPrice?: number; row: MarketRow }) {
  const multiplier = valuation.baseValue ? valuation.estimate / valuation.baseValue : 1;
  const p25 = row.p25 * multiplier;
  const p75 = row.p75 * multiplier;
  const padding = Math.max((valuation.high - valuation.low) * 0.1, 800);
  const min = Math.max(0, Math.min(valuation.low, p25) - padding);
  const max = Math.max(valuation.high, p75) + padding;
  const position = (value: number) => Math.max(2.5, Math.min(97.5, ((value - min) / (max - min)) * 100));
  const percentiles = [
    { label: "P10", value: valuation.low },
    { label: "P25", value: p25 },
    { label: "MEDIAN (P50)", value: valuation.estimate, emphasis: true },
    { label: "P75", value: p75 },
    { label: "P90", value: valuation.high },
  ];
  return (
    <div className="band-wrap prediction-band">
      <div className="band-caption">
        {percentiles.map((p) => <span key={p.label} className={p.emphasis ? "emphasis" : undefined}><small>{p.label}</small><b>{formatCad(p.value)}</b></span>)}
      </div>
      <div className="price-band">
        <span className="band-outer" />
        <span className="band-typical" style={{ left: `${position(valuation.low)}%`, right: `${100 - position(valuation.high)}%` }} />
        <span className="band-median" style={{ left: `${position(valuation.estimate)}%` }}><i><b>ML estimate</b>{formatCad(valuation.estimate)}</i></span>
        {askingPrice ? <span className="band-asking" style={{ left: `${position(askingPrice)}%` }}><i><b>Listing ask</b>{formatCad(askingPrice)}</i></span> : null}
      </div>
    </div>
  );
}

function dealSignalForPrediction(askingPrice: number, valuation: ConditionValuation): DealSignal {
  if (valuation.isOdometerExtrapolation) return { label: "Outside trained mileage support", detail: "The odometer was capped at the model boundary, so this estimate needs additional comparable evidence.", tone: "high" };
  if (askingPrice < valuation.low) return { label: "Below predicted range", detail: "The ask is below the condition-aware range; verify history, condition, fees and title status before treating it as favourable.", tone: "watch" };
  if (askingPrice > valuation.high) return { label: "Above predicted range", detail: "The ask is above the condition-aware range produced from the current market anchor and transaction-trained adjustment.", tone: "high" };
  return { label: "Within predicted range", detail: "The ask is consistent with the condition-aware prediction interval, subject to the unpriced factors shown below.", tone: "typical" };
}

type FactorState = "modelled" | "context" | "missing";

function FactorCoverage({ row, odometer, vinReport, valuation, profile }: { row: MarketRow; odometer?: number; vinReport?: VinLookupResponse; valuation: ConditionValuation; profile: ConditionProfile }) {
  const trimLabel = vinReport
    ? [vinReport.vehicle.trim, vinReport.vehicle.driveType, vinReport.vehicle.transmission].filter((value) => value && value !== "Not encoded").join(" · ")
    : "Decode a VIN to identify the exact specification";
  const factors: Array<{ label: string; value: string; note: string; state: FactorState }> = [
    { label: "Identity & age", value: `${row.y} ${row.mk} ${row.md}`, note: "Exact make, model family and model year", state: "modelled" },
    { label: "Local market", value: `${row.p} · ${formatNumber(row.n)} vehicles`, note: "Current province-level dealer inventory", state: "modelled" },
    { label: "Odometer", value: odometer ? `${formatNumber(odometer)} km` : "Market median used", note: valuation.isOdometerExtrapolation ? "Outside trained support; the mileage input was capped" : "Transaction-trained relative to the Canadian cell median", state: "modelled" },
    { label: "Trim & drivetrain", value: trimLabel, note: "Decoded specifications are context until a live listing feed supplies row-level pricing", state: vinReport ? "context" : "missing" },
    { label: "Condition & history", value: `Auction-grade equivalent ${valuation.conditionScore.toFixed(2)} / 4`, note: `${profile.conditionGrade.replace("-", " ")} · ${profile.accidentHistory.replace("-", " ")} accident history · six user-entered signals`, state: "modelled" },
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
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [lookupError, setLookupError] = useState("");
  const [vinReport, setVinReport] = useState<VinLookupResponse>();
  const [marketBlockedByVin, setMarketBlockedByVin] = useState(false);
  const [resultPulse, setResultPulse] = useState(0);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/data/market.json")
      .then((response) => { if (!response.ok) throw new Error("Market data could not be loaded"); return response.json(); })
      .then((data: MarketRow[]) => setRows(data))
      .finally(() => setLoading(false));
  }, []);

  const provinces = useMemo(() => uniqueSorted(rows.map((row) => row.p)), [rows]);
  const provinceRows = useMemo(() => rows.filter((row) => row.p === form.province), [rows, form.province]);
  const makes = useMemo(() => uniqueSorted(provinceRows.map((row) => row.mk)), [provinceRows]);
  const makeRows = useMemo(() => provinceRows.filter((row) => row.mk === form.make), [provinceRows, form.make]);
  const models = useMemo(() => uniqueSorted(makeRows.map((row) => row.md)), [makeRows, form.model]);
  const modelRows = useMemo(() => makeRows.filter((row) => row.md === form.model), [makeRows, form.model]);
  const years = useMemo(() => [...new Set(modelRows.map((row) => row.y))].sort((a, b) => b - a), [modelRows]);
  const selectedResult = modelRows.find((row) => String(row.y) === form.year);
  const result = marketBlockedByVin ? undefined : selectedResult;

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    if (field !== "vin") setMarketBlockedByVin(false);
    if (field === "province" || field === "make" || field === "model" || field === "year") {
      setVinReport(undefined);
      setLookupState("idle");
    }
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
      const province = form.province;
      const make = uniqueSorted(rows.filter((row) => row.p === province).map((row) => row.mk)).find((candidate) => candidate.toLowerCase() === report.vehicle.make.toLowerCase());
      const decodedMarketModel = report.vehicle.model;
      const model = make ? uniqueSorted(rows.filter((row) => row.p === province && row.mk === make).map((row) => row.md)).find((candidate) => candidate.toLowerCase().replace(/[^a-z0-9]/g, "") === decodedMarketModel.toLowerCase().replace(/[^a-z0-9]/g, "")) : undefined;
      const hasMarketCell = Boolean(make && model && rows.some((row) => row.p === province && row.mk === make && row.md === model && row.y === report.vehicle.year));
      setMarketBlockedByVin(!hasMarketCell);
      setForm((current) => ({ ...current, province, make: make ?? current.make, model: model ?? current.model, year: make && model ? String(report.vehicle.year) : current.year }));
      setLookupState("success"); setResultPulse((value) => value + 1);
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch (error) { setLookupState("error"); setLookupError(error instanceof Error ? error.message : "VIN lookup failed."); }
  }

  function checkPrice() { setResultPulse((value) => value + 1); resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }

  const askingPrice = Number(form.askingPrice) || undefined;
  const odometer = Number(form.odometer) || undefined;
  const confidence = result ? confidenceForSample(result.n) : "limited";
  const conditionProfile: ConditionProfile = {
    conditionGrade: form.conditionGrade,
    accidentHistory: form.accidentHistory,
    mechanicalCondition: form.mechanicalCondition,
    cosmeticCondition: form.cosmeticCondition,
    serviceHistory: form.serviceHistory,
    wearItems: form.wearItems,
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
  const dealSignal = askingPrice && conditionValuation ? dealSignalForPrediction(askingPrice, conditionValuation) : undefined;
  const vinStatus = validateNorthAmericanVin(form.vin);
  const estimate = conditionValuation?.estimate;
  const estimateDifference = askingPrice && estimate ? askingPrice - estimate : undefined;
  const adjustment = conditionValuation?.adjustmentCad ?? 0;

  return (
    <>
    <div className="workbench">
      <form className="vehicle-form" onSubmit={(event) => { event.preventDefault(); checkPrice(); }}>
        <div className="form-heading"><p className="kicker">PRICE CHECK</p><h2>Describe the listing</h2></div>
        <div className="field-rows">
          <label className="field-row"><span>Province</span><select aria-label="Province" value={form.province} onChange={(event) => update("province", event.target.value)} disabled={loading}>{provinces.map((province) => <option key={province}>{province}</option>)}</select></label>
          <label className="field-row"><span>Make</span><select aria-label="Make" value={form.make} onChange={(event) => update("make", event.target.value)} disabled={loading}>{makes.map((make) => <option key={make}>{make}</option>)}</select></label>
          <label className="field-row"><span>Model</span><select aria-label="Model" value={form.model} onChange={(event) => update("model", event.target.value)} disabled={loading}>{models.map((model) => <option key={model}>{model}</option>)}</select></label>
          <label className="field-row"><span>Model year</span><select aria-label="Model year" value={form.year} onChange={(event) => update("year", event.target.value)} disabled={loading}>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
        </div>
        <div className="field-grid">
          <label><span>Odometer <small>optional</small></span><div className="input-suffix"><input inputMode="numeric" value={form.odometer} onChange={(event) => update("odometer", event.target.value.replace(/\D/g, ""))} aria-label="Odometer in kilometres" /><i>km</i></div></label>
          <label><span>Listing asking price <small>optional</small></span><div className="input-prefix"><i>$</i><input inputMode="numeric" value={form.askingPrice} onChange={(event) => update("askingPrice", event.target.value.replace(/\D/g, ""))} aria-label="Asking price in Canadian dollars" /></div></label>
        </div>
        <details className="condition-input" open>
          <summary><span>CONDITION PROFILE</span><strong>6 inputs · ML-adjusted</strong><i>⌄</i></summary>
          <div className="condition-grid">
            <label><span>Overall grade</span><select aria-label="Overall condition grade" value={form.conditionGrade} onChange={(event) => update("conditionGrade", event.target.value as FormState["conditionGrade"])}><option value="extra-clean">Extra clean</option><option value="clean">Clean</option><option value="average">Average</option><option value="rough">Rough</option><option value="extra-rough">Extra rough</option><option value="salvage">Salvage</option></select></label>
            <label><span>Accident / title</span><select aria-label="Accident and title history" value={form.accidentHistory} onChange={(event) => update("accidentHistory", event.target.value as FormState["accidentHistory"])}><option value="none">None reported</option><option value="minor">Minor accident</option><option value="major">Major accident</option><option value="rebuilt">Rebuilt / branded</option></select></label>
            <label><span>Mechanical</span><select aria-label="Mechanical condition" value={form.mechanicalCondition} onChange={(event) => update("mechanicalCondition", event.target.value as FormState["mechanicalCondition"])}><option value="sound">No known repairs</option><option value="minor-repair">Minor repair</option><option value="major-repair">Major repair</option><option value="not-running">Not running</option></select></label>
            <label><span>Cosmetic</span><select aria-label="Cosmetic condition" value={form.cosmeticCondition} onChange={(event) => update("cosmeticCondition", event.target.value as FormState["cosmeticCondition"])}><option value="clean">Very clean</option><option value="light">Light wear</option><option value="moderate">Moderate wear</option><option value="heavy">Heavy damage</option></select></label>
            <label><span>Service records</span><select aria-label="Service history" value={form.serviceHistory} onChange={(event) => update("serviceHistory", event.target.value as FormState["serviceHistory"])}><option value="complete">Complete</option><option value="partial">Partial</option><option value="unknown">Unknown</option></select></label>
            <label><span>Tires & brakes</span><select aria-label="Tire and brake condition" value={form.wearItems} onChange={(event) => update("wearItems", event.target.value as FormState["wearItems"])}><option value="good">Good</option><option value="due-soon">Due soon</option><option value="replace-now">Replace now</option></select></label>
          </div>
          <p>These inspection signals form an auction-grade equivalent. The price effect is learned from completed outcomes, not a hand-written dollar table.</p>
        </details>
        <div className="history-input">
          <p className="kicker">VIN</p>
          <label className="vin-field"><span>17-character VIN</span><div className="vin-control"><input value={form.vin} onChange={(event) => { update("vin", normalizeVin(event.target.value)); setLookupState("idle"); setVinReport(undefined); setMarketBlockedByVin(false); }} maxLength={17} spellCheck={false} autoCapitalize="characters" placeholder="Enter VIN (optional)" aria-label="Vehicle identification number" /><button type="button" onClick={decodeVin} disabled={loading || lookupState === "loading"}>{lookupState === "loading" ? "DECODING…" : "Decode VIN"}</button></div><small className={`vin-status ${vinStatus}`}>{vinStatusCopy[vinStatus]}</small></label>
          {lookupState === "error" ? <p className="lookup-error" role="alert">{lookupError}</p> : null}
          {vinReport ? <div className="decoded-mini"><span>DECODED BY {vinReport.vehicle.source}</span><strong>{vinReport.vehicle.year} {vinReport.vehicle.make} {vinReport.vehicle.model}</strong><p>{vinReport.vehicle.trim} · {vinReport.vehicle.driveType} · {vinReport.vehicle.displacementL ?? "—"} L</p><small>{vinReport.notice}{marketBlockedByVin ? " No matching price cell exists in this public release, so the previous manual selection is not used as a substitute." : ""}</small></div> : null}
          <p className="privacy-note"><LockIcon /> VIN is sent to the official NHTSA &amp; vPIC decoder only when you click Decode. AutoValue does not store it.</p>
        </div>
        <button className="check-price-button" type="submit"><strong>Check this price</strong><i>→</i></button>
      </form>

      <section key={resultPulse} ref={resultRef} className="result-panel result-enter" aria-live="polite">
        {loading ? <div className="result-empty"><div className="loader" /><p>Loading the Canadian market reference…</p></div> : result ? <>
          <div className="result-head">
            <div><p className="kicker">ONE-PAGE VALUATION</p><h3>{vinReport ? `${vinReport.vehicle.year} ${vinReport.vehicle.make} ${vinReport.vehicle.model}` : `${result.y} ${result.mk} ${result.md}`}</h3><p>{vinReport ? `VIN ${vinReport.vehicle.vin} · live vehicle decode` : `${result.p} · Used dealer inventory · ${formatNumber(result.n)} vehicles`}</p></div>
            <div className="result-stats">
              <span className={`confidence ${confidence}`}><i /> {confidence} broad evidence</span>
              <p>{formatNumber(result.n)} vehicles in cell<br />{formatNumber(conditionModelMetadata.outcomes)} auction outcomes</p>
            </div>
          </div>

          {vinReport ? <div className="no-listing"><strong>Vehicle decoded live; no listing feed connected.</strong><p>VINs do not carry current asking price or odometer. Enter those values above, or connect a licensed inventory provider for live listing facts.</p></div> : null}

          <section className="valuation-summary" aria-label="Valuation summary">
            <div className="stat-tile ml-tile">
              <span className="stat-label">CONDITION-AWARE ML MARKET VALUE <InfoIcon /></span>
              <strong data-testid="ml-estimate">{formatCad(estimate ?? 0)}</strong>
              <div className="stat-foot">
                <div><small>Predicted range</small><b>{formatCad(conditionValuation?.low ?? 0)} – {formatCad(conditionValuation?.high ?? 0)}</b></div>
                <i className="stat-divider" aria-hidden="true" />
                <div><b className={adjustment === 0 ? undefined : adjustment > 0 ? "positive" : "negative"}>{adjustment === 0 ? "±$0" : `${adjustment > 0 ? "+" : "−"}${formatCad(Math.abs(adjustment))}`}</b><small>ML adjustment</small></div>
              </div>
            </div>
            <div className="stat-tile ask-tile">
              <span className="stat-label">SELLER ASK <InfoIcon /></span>
              <strong>{askingPrice ? formatCad(askingPrice) : "Not entered"}</strong>
              <div className="stat-foot">
                {estimateDifference !== undefined ? <div><b className={estimateDifference > 0 ? "positive" : "negative"} title={dealSignal?.detail}>{estimateDifference > 0 ? "+" : "−"}{formatCad(Math.abs(estimateDifference))}</b><small>vs value</small></div> : <div><b>—</b><small>add an ask to compare</small></div>}
                <i className="stat-divider" aria-hidden="true" />
                {dealSignal ? <div className="signal-line"><i className={`signal-dot ${dealSignal.tone}`}><CheckCircleIcon /></i><small>{dealSignal.label}</small></div> : <div><small>enter an ask to compare</small></div>}
              </div>
            </div>
          </section>

          {conditionValuation ? <div className="valuation-band"><PredictionBand valuation={conditionValuation} askingPrice={askingPrice} row={result} /></div> : null}

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

          {conditionValuation ? <FactorCoverage row={result} odometer={odometer} vinReport={vinReport} valuation={conditionValuation} profile={conditionProfile} /> : null}

          <div className="valuation-method">
            <div><span>HYBRID ML METHOD</span><p>Gradient-boosted condition + odometer adjustment</p></div>
            <div><span>DATA FOUNDATION</span><p>{formatNumber(result.n)}-vehicle Canadian cell + {formatNumber(conditionModelMetadata.outcomes)} completed auction outcomes</p></div>
            <div><span>TEMPORAL-TEST WAPE</span><strong>{conditionModelMetadata.wapePct.toFixed(1)}%</strong></div>
            <div><span>METHOD &amp; TRANSPARENCY</span><a href="/calculation">See calculation <span aria-hidden="true">↗</span></a></div>
          </div>
          <div className="caution"><strong>Prediction boundary</strong><p>This is an ML estimate, not an observable “true price.” The condition effect transfers from historical US wholesale outcomes to a current Canadian asking-market anchor; options, inspection findings, fees and the eventual negotiated transaction remain uncertain.</p></div>
        </> : <div className="result-empty"><p>{marketBlockedByVin ? "VIN decoded, but no defensible price match is available." : "No published price cell matches that combination."}</p><small>{marketBlockedByVin ? "Enter the listing manually only if you can select its true model family, or connect a licensed row-level inventory feed." : "Try another year or province. Sparse cells are intentionally suppressed."}</small></div>}
      </section>
    </div>
    </>
  );
}
