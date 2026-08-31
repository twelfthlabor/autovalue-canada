"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { approximatePercentile, confidenceForSample, dealSignalForMarket, dealSignalForMatched, deriveComparableBenchmark, formatCad, formatNumber, marketPosition, type ComparableBenchmark, type MarketRow } from "@/lib/market";
import { normalizeVin, validateNorthAmericanVin, vinStatusCopy } from "@/lib/vin";
import type { ComparableEvidence, VinLookupResponse } from "@/lib/vin-report";

type FormState = {
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
  vin: "",
};

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function CurrencyBand({ row, askingPrice }: { row: MarketRow; askingPrice?: number }) {
  const min = row.p10;
  const max = row.p90;
  const position = askingPrice ? Math.max(13, Math.min(87, ((askingPrice - min) / (max - min)) * 100)) : 50;
  return (
    <div className="band-wrap">
      <div className="band-caption"><span>DEALER ASKING-PRICE DISTRIBUTION</span><span>MIDDLE 80%</span></div>
      <div className="price-band">
        <span className="band-outer" />
        <span className="band-typical" style={{ left: `${((row.p25 - min) / (max - min)) * 100}%`, right: `${100 - ((row.p75 - min) / (max - min)) * 100}%` }} />
        <span className="band-median" style={{ left: `${((row.p50 - min) / (max - min)) * 100}%` }} />
        {askingPrice ? <span className="band-asking" style={{ left: `${position}%` }}><i>THIS LISTING · {formatCad(askingPrice)}</i></span> : null}
      </div>
      <div className="band-scale"><span>{formatCad(row.p10)}</span><span>{formatCad(row.p90)}</span></div>
      <div className="band-legend"><span><i className="legend-typical" /> Typical 50%</span><span><i className="legend-median" /> Median</span>{askingPrice ? <span><i className="legend-asking" /> This listing</span> : null}</div>
    </div>
  );
}

function MatchedBand({ benchmark, askingPrice }: { benchmark: ComparableBenchmark; askingPrice: number }) {
  const padding = Math.max(benchmark.rmse, 1000);
  const min = benchmark.low - padding;
  const max = benchmark.high + padding;
  const position = (value: number) => Math.max(3, Math.min(97, ((value - min) / (max - min)) * 100));
  return (
    <div className="band-wrap matched-band">
      <div className="band-caption"><span>MILEAGE-ADJUSTED MATCHED COMPARABLES</span><span>{benchmark.sampleSize} LISTINGS · LIMITED EVIDENCE</span></div>
      <div className="price-band">
        <span className="band-outer" />
        <span className="band-typical" style={{ left: `${position(benchmark.low)}%`, right: `${100 - position(benchmark.high)}%` }} />
        <span className="band-median" style={{ left: `${position(benchmark.benchmark)}%` }} />
        <span className="band-asking" style={{ left: `${position(askingPrice)}%` }}><i>THIS LISTING · {formatCad(askingPrice)}</i></span>
      </div>
      <div className="band-scale"><span>{formatCad(min)}</span><span>{formatCad(max)}</span></div>
      <div className="band-legend"><span><i className="legend-typical" /> Expected range</span><span><i className="legend-median" /> Mileage-adjusted target</span><span><i className="legend-asking" /> This listing</span></div>
    </div>
  );
}

function CalculationStory({ row, askingPrice, odometer, comparableEvidence, matchedBenchmark }: { row: MarketRow; askingPrice?: number; odometer?: number; comparableEvidence?: ComparableEvidence; matchedBenchmark?: ComparableBenchmark }) {
  const difference = askingPrice ? askingPrice - row.p50 : undefined;
  const mileageDifference = odometer ? odometer - row.km : undefined;
  if (askingPrice && odometer && comparableEvidence && matchedBenchmark) {
    const matchedDifference = askingPrice - matchedBenchmark.benchmark;
    const signal = dealSignalForMatched(askingPrice, matchedBenchmark);
    return (
      <div className="calculation-story">
        <div className="calc-intro"><p className="kicker">VISIBLE DERIVATION</p><h4>From matched listings to a mileage-adjusted target.</h4><p>The subject listing is excluded from the fit, so it cannot pull its own benchmark toward its asking price.</p></div>
        <div className="calc-rail" aria-label="Matched comparable calculation">
          <article><span className="calc-index">01</span><div><small>MATCH</small><strong>Same year · trim · drivetrain · transmission</strong><p>{comparableEvidence.scope}</p></div><b>{matchedBenchmark.sampleSize}<i>comparables</i></b></article>
          <article><span className="calc-index">02</span><div><small>FIT</small><strong>Asking price versus odometer</strong><p>Ordinary least squares · R² {matchedBenchmark.rSquared.toFixed(2)} · {formatNumber(matchedBenchmark.odometerMin)}–{formatNumber(matchedBenchmark.odometerMax)} km support</p></div><b>{formatCad(matchedBenchmark.mileageRatePer10k)}<i>per 10,000 km</i></b></article>
          <article><span className="calc-index">03</span><div><small>ESTIMATE</small><strong>Evaluate the line at {formatNumber(odometer)} km</strong><p>Rounded to the nearest $100</p></div><b>{formatCad(matchedBenchmark.benchmark)}<i>target ask</i></b></article>
          <article><span className="calc-index">04</span><div><small>COMPARE</small><strong>{signal.label}</strong><p>{signal.detail}</p></div><b>{matchedDifference > 0 ? "+" : ""}{formatCad(matchedDifference)}<i>vs target</i></b></article>
        </div>
        <div className="calc-equation"><div><span>Matched-listing fit</span><strong>{formatCad(matchedBenchmark.benchmark)}</strong></div><i>±</i><div><span>Observed fit error</span><strong>{formatCad(matchedBenchmark.rmse)}</strong></div><i>=</i><div className="calc-answer"><span>Expected asking range</span><strong>{formatCad(matchedBenchmark.low)}–{formatCad(matchedBenchmark.high)}</strong></div></div>
        <div className="calc-mileage"><span>EVIDENCE GRADE · LIMITED</span><p>Only {matchedBenchmark.sampleSize} recent public comparables matched. {matchedBenchmark.isExtrapolation ? "The target odometer is outside observed support, so no reliable deal verdict should be inferred. " : "The target odometer is inside observed support. "}This is a current asking-price target—not a completed-sale value—and it still cannot price condition, damage, options or dealer fees.</p></div>
      </div>
    );
  }
  return (
    <div className="calculation-story">
      <div className="calc-intro">
        <p className="kicker">VISIBLE CALCULATION</p>
        <h4>From 180,833 vehicles to one honest comparison.</h4>
        <p>This fallback is a source lookup and percentile comparison—not a hidden appraisal model.</p>
      </div>
      <div className="calc-rail" aria-label="Price comparison calculation">
        <article><span className="calc-index">01</span><div><small>FILTER</small><strong>{row.p} × {row.mk} × {row.md} × {row.y}</strong><p>Exact used-market cell only</p></div><b>{formatNumber(row.n)}<i>vehicles</i></b></article>
        <article><span className="calc-index">02</span><div><small>ANCHOR</small><strong>Published market median</strong><p>Middle observation, not a prediction</p></div><b>{formatCad(row.p50)}<i>P50</i></b></article>
        <article><span className="calc-index">03</span><div><small>OVERLAY</small><strong>{askingPrice ? "Listing price" : "No price entered"}</strong><p>{askingPrice ? `${marketPosition(askingPrice, row)} · ≈ P${approximatePercentile(askingPrice, row)}` : "Add a price to position it"}</p></div><b>{askingPrice ? `${difference && difference > 0 ? "+" : ""}${formatCad(difference ?? 0)}` : "—"}<i>vs median</i></b></article>
      </div>
      <div className="calc-equation">
        <div><span>Observed P50</span><strong>{formatCad(row.p50)}</strong></div><i>+</i>
        <div><span>Hidden adjustments</span><strong>$0</strong></div><i>=</i>
        <div className="calc-answer"><span>Comparison anchor</span><strong>{formatCad(row.p50)}</strong></div>
      </div>
      <div className="calc-mileage"><span>ODOMETER CONTEXT</span><p>{mileageDifference === undefined ? "Add an odometer to compare it with the cell median." : `The listing is ${formatNumber(Math.abs(mileageDifference))} km ${mileageDifference > 0 ? "above" : "below"} the ${formatNumber(row.km)} km market-cell median. We show this gap but do not invent a dollar adjustment without row-level evidence.`}</p></div>
    </div>
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
  const [resultTab, setResultTab] = useState<"market" | "calculation">("market");
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
  const models = useMemo(() => uniqueSorted(makeRows.map((row) => row.md)), [makeRows]);
  const modelRows = useMemo(() => makeRows.filter((row) => row.md === form.model), [makeRows, form.model]);
  const years = useMemo(() => [...new Set(modelRows.map((row) => row.y))].sort((a, b) => b - a), [modelRows]);
  const selectedResult = modelRows.find((row) => String(row.y) === form.year);
  const result = marketBlockedByVin ? undefined : selectedResult;

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    if (field !== "vin") setMarketBlockedByVin(false);
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
      const province = report.listing?.province ?? form.province;
      const make = uniqueSorted(rows.filter((row) => row.p === province).map((row) => row.mk)).find((candidate) => candidate.toLowerCase() === report.vehicle.make.toLowerCase());
      const decodedMarketModel = report.listing?.marketModel ?? report.vehicle.model;
      const model = make ? uniqueSorted(rows.filter((row) => row.p === province && row.mk === make).map((row) => row.md)).find((candidate) => candidate.toLowerCase().replace(/[^a-z0-9]/g, "") === decodedMarketModel.toLowerCase().replace(/[^a-z0-9]/g, "")) : undefined;
      const hasMarketCell = Boolean(make && model && rows.some((row) => row.p === province && row.mk === make && row.md === model && row.y === report.vehicle.year));
      setMarketBlockedByVin(!hasMarketCell);
      setForm((current) => ({ ...current, province, make: make ?? current.make, model: model ?? current.model, year: make && model ? String(report.vehicle.year) : current.year, askingPrice: report.listing ? String(report.listing.askingPrice) : current.askingPrice, odometer: report.listing ? String(report.listing.odometerKm) : current.odometer }));
      setLookupState("success"); setResultTab("market"); setResultPulse((value) => value + 1);
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch (error) { setLookupState("error"); setLookupError(error instanceof Error ? error.message : "VIN lookup failed."); }
  }

  function checkPrice() { setResultPulse((value) => value + 1); resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }

  const askingPrice = Number(form.askingPrice) || undefined;
  const odometer = Number(form.odometer) || undefined;
  const confidence = result ? confidenceForSample(result.n) : "limited";
  const difference = result && askingPrice ? askingPrice - result.p50 : undefined;
  const mileageDifference = result && odometer ? odometer - result.km : undefined;
  const matchedBenchmark = useMemo(() => {
    if (!odometer || !vinReport?.listing?.comparableEvidence) return undefined;
    return deriveComparableBenchmark(vinReport.listing.comparableEvidence.comparables, odometer);
  }, [odometer, vinReport]);
  const dealSignal = askingPrice && result
    ? matchedBenchmark ? dealSignalForMatched(askingPrice, matchedBenchmark) : dealSignalForMarket(askingPrice, result)
    : undefined;
  const vinStatus = validateNorthAmericanVin(form.vin);
  const sellerTrimIncludesModel = Boolean(vinReport?.listing?.sellerTrim.toLowerCase().includes(vinReport.vehicle.model.toLowerCase()));
  const listingDisplayName = vinReport?.listing ? `${vinReport.vehicle.year} ${vinReport.vehicle.make} ${sellerTrimIncludesModel ? "" : `${vinReport.vehicle.model} `}${vinReport.listing.sellerTrim}` : "";

  return (
    <div className="workbench">
      <form className="vehicle-form" onSubmit={(event) => { event.preventDefault(); checkPrice(); }}>
        <div className="form-heading"><span>VEHICLE</span><p>Choose manually or decode a VIN to fill the exact available market cell.</p></div>
        <div className="field-grid">
          <label><span>Province</span><select aria-label="Province" value={form.province} onChange={(event) => update("province", event.target.value)} disabled={loading}>{provinces.map((province) => <option key={province}>{province}</option>)}</select></label>
          <label><span>Make</span><select aria-label="Make" value={form.make} onChange={(event) => update("make", event.target.value)} disabled={loading}>{makes.map((make) => <option key={make}>{make}</option>)}</select></label>
          <label className="field-wide"><span>Model</span><select aria-label="Model" value={form.model} onChange={(event) => update("model", event.target.value)} disabled={loading}>{models.map((model) => <option key={model}>{model}</option>)}</select></label>
          <label><span>Model year</span><select aria-label="Model year" value={form.year} onChange={(event) => update("year", event.target.value)} disabled={loading}>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
          <label><span>Odometer <small>optional</small></span><div className="input-suffix"><input inputMode="numeric" value={form.odometer} onChange={(event) => update("odometer", event.target.value.replace(/\D/g, ""))} aria-label="Odometer in kilometres" /><i>km</i></div></label>
          <label className="field-wide"><span>Listing asking price <small>optional</small></span><div className="input-prefix"><i>$</i><input inputMode="numeric" value={form.askingPrice} onChange={(event) => update("askingPrice", event.target.value.replace(/\D/g, ""))} aria-label="Asking price in Canadian dollars" /></div></label>
        </div>
        <button className="check-price-button" type="submit"><span>RUN MARKET CHECK</span><strong>Check this price</strong><i>→</i></button>
        <div className="history-input">
          <div className="history-input-title"><span>VIN LOOKUP</span><small>live decode</small></div>
          <label className="vin-field"><span>VIN</span><div className="vin-control"><input value={form.vin} onChange={(event) => { update("vin", normalizeVin(event.target.value)); setLookupState("idle"); setVinReport(undefined); setMarketBlockedByVin(false); }} maxLength={17} spellCheck={false} autoCapitalize="characters" placeholder="17 characters" aria-label="Vehicle identification number" /><button type="button" onClick={decodeVin} disabled={loading || lookupState === "loading"}>{lookupState === "loading" ? "DECODING…" : "DECODE VIN"}</button></div><small className={`vin-status ${vinStatus}`}>{vinStatusCopy[vinStatus]}</small></label>
          {!vinReport ? <button className="demo-vin" type="button" onClick={() => { update("vin", "WBA8B7C37HA190314"); setLookupState("idle"); }}><span>TRY THE MATCHED-COMPARABLE EXAMPLE</span><strong>WBA8B7C37HA190314</strong></button> : null}
          {lookupState === "error" ? <p className="lookup-error" role="alert">{lookupError}</p> : null}
          {vinReport ? <div className="decoded-mini"><span>DECODED BY {vinReport.vehicle.source}</span><strong>{vinReport.vehicle.year} {vinReport.vehicle.make} {vinReport.vehicle.model}</strong><p>{vinReport.vehicle.trim} · {vinReport.vehicle.driveType} · {vinReport.vehicle.displacementL ?? "—"} L</p><small>{vinReport.notice}{marketBlockedByVin ? " No matching price cell exists in this public release, so the previous manual selection is not used as a substitute." : ""}</small></div> : null}
        </div>
        <div className="privacy-note"><span aria-hidden="true">●</span> VIN is sent to the official NHTSA vPIC decoder only when you click Decode. AutoValue does not store it.</div>
      </form>

      <section key={resultPulse} ref={resultRef} className="result-panel result-enter" aria-live="polite">
        {loading ? <div className="result-empty"><div className="loader" /><p>Loading the Canadian market snapshot…</p></div> : result ? <>
          <div className="result-head"><div><p className="kicker">MARKET EVIDENCE</p><h3>{result.y} {result.mk} {result.md}</h3><p>{result.p} · Used dealer inventory · {formatNumber(result.n)} vehicles</p></div><span className={`confidence ${confidence}`}><i /> {confidence} evidence</span></div>
          {vinReport?.listing ? <section className="listing-report">
            <div className="listing-report-head"><div><span>EXACT PUBLIC LISTING FOUND</span><h4 aria-label={listingDisplayName}>{vinReport.vehicle.year} {vinReport.vehicle.make} {!sellerTrimIncludesModel ? `${vinReport.vehicle.model} ` : ""}<em>{vinReport.listing.sellerTrim}</em></h4><p>VIN {vinReport.vehicle.vin} · {vinReport.listing.seller ?? vinReport.listing.source} stock #{vinReport.listing.listingId}</p></div><a href={vinReport.listing.sourceUrl} target="_blank" rel="noreferrer">OPEN SOURCE ↗</a></div>
            <div className="listing-facts"><div><span>ASKING NOW</span><strong>{formatCad(vinReport.listing.askingPrice)}</strong><small>{vinReport.listing.previousPrice ? `${formatCad(vinReport.listing.previousPrice)} before reduction` : "Current source price"}</small></div><div><span>ODOMETER</span><strong>{formatNumber(vinReport.listing.odometerKm)} km</strong><small>{vinReport.listing.transmission}</small></div><div><span>PUBLIC SNAPSHOT</span><strong>{vinReport.listing.verifiedAt}</strong><small>Seller data can change</small></div></div>
            <div className="listing-highlights">{vinReport.listing.highlights.map((item) => <div key={item.label}><i>✓</i><span><strong>{item.label}</strong><small>{item.attribution}</small></span></div>)}</div>
            <p className="seller-boundary">These are seller-displayed claims, not an independent AutoValue damage report. Verify them on the linked listing and full history report before purchase.</p>
          </section> : vinReport ? <div className="no-listing"><strong>Vehicle decoded; no exact listing feed found.</strong><p>{marketBlockedByVin ? "The identity is shown above, but this release has no matching price cell. AutoValue will not substitute an unrelated vehicle." : "The available make, model and year were filled automatically. Add the seller’s price and odometer to finish the comparison."}</p></div> : null}
          {dealSignal ? <div className={`deal-verdict ${dealSignal.tone}`}><span>DEAL CHECK</span><strong>{dealSignal.label}</strong><p>{dealSignal.detail}</p></div> : null}
          <div className="headline-value"><span>{matchedBenchmark ? "MILEAGE-ADJUSTED TARGET ASKING PRICE" : "OBSERVED MEDIAN ASKING PRICE"}</span><strong>{formatCad(matchedBenchmark?.benchmark ?? result.p50)}</strong><p>{matchedBenchmark ? `Expected range: ${formatCad(matchedBenchmark.low)}–${formatCad(matchedBenchmark.high)} · ${matchedBenchmark.sampleSize} matched listings` : `Typical 50%: ${formatCad(result.p25)}–${formatCad(result.p75)}`}</p></div>
          <div className="result-tabs" role="tablist" aria-label="Result detail"><button role="tab" aria-selected={resultTab === "market"} className={resultTab === "market" ? "active" : ""} onClick={() => setResultTab("market")}>Market position</button><button role="tab" aria-selected={resultTab === "calculation"} className={resultTab === "calculation" ? "active" : ""} onClick={() => setResultTab("calculation")}>How we calculate it</button></div>
          {resultTab === "market" ? <div className="tab-panel tab-reveal" role="tabpanel">
            {matchedBenchmark && askingPrice ? <MatchedBand benchmark={matchedBenchmark} askingPrice={askingPrice} /> : <CurrencyBand row={result} askingPrice={askingPrice} />}
            {askingPrice ? <div className="listing-readout"><div><span>{matchedBenchmark ? "MATCHED-COMPARABLE RESULT" : "LISTING POSITION"}</span><strong>{matchedBenchmark ? dealSignal?.label : `≈ ${approximatePercentile(askingPrice, result)}th percentile`}</strong><p>{matchedBenchmark ? `${formatCad(askingPrice)} compared with a ${formatCad(matchedBenchmark.benchmark)} target.` : `${formatCad(askingPrice)} is ${marketPosition(askingPrice, result)}.`}</p></div><div><span>{matchedBenchmark ? "VS. MILEAGE-ADJUSTED TARGET" : "VS. OBSERVED MEDIAN"}</span><strong className={(matchedBenchmark ? askingPrice - matchedBenchmark.benchmark : difference ?? 0) > 0 ? "positive" : "negative"}>{(matchedBenchmark ? askingPrice - matchedBenchmark.benchmark : difference ?? 0) > 0 ? "+" : ""}{formatCad(matchedBenchmark ? askingPrice - matchedBenchmark.benchmark : difference ?? 0)}</strong><p>Use this as negotiation evidence, not a guaranteed transaction value.</p></div></div> : null}
            <div className="evidence-grid"><div><span>{matchedBenchmark ? "Matched comparables" : "Median odometer"}</span><strong>{matchedBenchmark ? `${matchedBenchmark.sampleSize} listings` : `${formatNumber(result.km)} km`}</strong>{matchedBenchmark ? <p>Subject excluded; exact trim, year, drivetrain and transmission.</p> : mileageDifference !== undefined ? <p>Your listing is {formatNumber(Math.abs(mileageDifference))} km {mileageDifference > 0 ? "above" : "below"} this benchmark.</p> : <p>Add an odometer to compare.</p>}</div><div><span>{matchedBenchmark ? "Mileage effect" : "Median days listed"}</span><strong>{matchedBenchmark ? `${formatCad(matchedBenchmark.mileageRatePer10k)} / 10k km` : `${result.dom} days`}</strong><p>{matchedBenchmark ? "Learned only from the matched snapshot." : "Descriptive inventory context; not a sale-time forecast."}</p></div><div><span>{matchedBenchmark ? "Broader model median" : "Broader observed range"}</span><strong>{matchedBenchmark ? formatCad(result.p50) : `${formatCad(result.p10)}–${formatCad(result.p90)}`}</strong><p>{matchedBenchmark ? "Context only; it mixes lower and higher trims." : "Middle 80% of this exact market cell."}</p></div></div>
          </div> : <div className="tab-panel tab-reveal" role="tabpanel"><CalculationStory row={result} askingPrice={askingPrice} odometer={odometer} comparableEvidence={vinReport?.listing?.comparableEvidence} matchedBenchmark={matchedBenchmark} /></div>}
          <div className="caution"><strong>Price boundary</strong><p>{matchedBenchmark ? "The matched target controls year, trim, drivetrain, transmission and odometer, but not condition, damage, options, fees or completed transaction price." : "The broad market range is not adjusted for this vehicle’s trim, condition, options, damage or completed transaction price."} Verify the linked evidence and commission an independent inspection before purchase.</p></div>
        </> : <div className="result-empty"><p>{marketBlockedByVin ? "VIN decoded, but no defensible price match is available." : "No published price cell matches that combination."}</p><small>{marketBlockedByVin ? "Enter the listing manually only if you can select its true model family, or connect a licensed row-level inventory feed." : "Try another year or province. Sparse cells are intentionally suppressed."}</small></div>}
      </section>
    </div>
  );
}
