"use client";

import { useEffect, useMemo, useState } from "react";
import { approximatePercentile, confidenceForSample, formatCad, formatNumber, marketPosition, type MarketRow } from "@/lib/market";

type FormState = { province: string; make: string; model: string; year: string; askingPrice: string; odometer: string };

const initialForm: FormState = {
  province: "ON", make: "Toyota", model: "RAV4", year: "2021", askingPrice: "31995", odometer: "89000",
};

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function CurrencyBand({ row, askingPrice }: { row: MarketRow; askingPrice?: number }) {
  const min = row.p10;
  const max = row.p90;
  const position = askingPrice ? Math.max(0, Math.min(100, ((askingPrice - min) / (max - min)) * 100)) : 50;
  return (
    <div className="band-wrap">
      <div className="band-labels"><span>{formatCad(row.p10)}</span><span>observed asking-price spread</span><span>{formatCad(row.p90)}</span></div>
      <div className="price-band">
        <span className="band-outer" />
        <span className="band-typical" style={{ left: `${((row.p25 - min) / (max - min)) * 100}%`, right: `${100 - ((row.p75 - min) / (max - min)) * 100}%` }} />
        <span className="band-median" style={{ left: `${((row.p50 - min) / (max - min)) * 100}%` }} />
        {askingPrice ? <span className="band-asking" style={{ left: `${position}%` }}><i>ASKING</i></span> : null}
      </div>
      <div className="band-legend"><span><i className="legend-typical" /> Typical 50%</span><span><i className="legend-median" /> Median</span>{askingPrice ? <span><i className="legend-asking" /> This listing</span> : null}</div>
    </div>
  );
}

export function ValuationWorkbench() {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/market.json")
      .then((response) => {
        if (!response.ok) throw new Error("Market data could not be loaded");
        return response.json();
      })
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
  const result = modelRows.find((row) => String(row.y) === form.year);

  function update(field: keyof FormState, value: string) {
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
      if (field === "model") {
        next.year = String(rows.filter((row) => row.p === current.province && row.mk === current.make && row.md === value).sort((a, b) => b.y - a.y)[0]?.y ?? "");
      }
      return next;
    });
  }

  const askingPrice = Number(form.askingPrice) || undefined;
  const odometer = Number(form.odometer) || undefined;
  const confidence = result ? confidenceForSample(result.n) : "limited";
  const difference = result && askingPrice ? askingPrice - result.p50 : undefined;
  const mileageDifference = result && odometer ? odometer - result.km : undefined;

  return (
    <div className="workbench">
      <form className="vehicle-form" onSubmit={(event) => event.preventDefault()}>
        <div className="form-heading"><span>VEHICLE</span><p>We only show combinations with a published sample of at least 10 vehicles.</p></div>
        <div className="field-grid">
          <label><span>Province</span><select aria-label="Province" value={form.province} onChange={(event) => update("province", event.target.value)} disabled={loading}>{provinces.map((province) => <option key={province}>{province}</option>)}</select></label>
          <label><span>Make</span><select aria-label="Make" value={form.make} onChange={(event) => update("make", event.target.value)} disabled={loading}>{makes.map((make) => <option key={make}>{make}</option>)}</select></label>
          <label className="field-wide"><span>Model</span><select aria-label="Model" value={form.model} onChange={(event) => update("model", event.target.value)} disabled={loading}>{models.map((model) => <option key={model}>{model}</option>)}</select></label>
          <label><span>Model year</span><select aria-label="Model year" value={form.year} onChange={(event) => update("year", event.target.value)} disabled={loading}>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
          <label><span>Odometer <small>optional</small></span><div className="input-suffix"><input inputMode="numeric" value={form.odometer} onChange={(event) => update("odometer", event.target.value.replace(/\D/g, ""))} aria-label="Odometer in kilometres" /><i>km</i></div></label>
          <label className="field-wide"><span>Listing asking price <small>optional</small></span><div className="input-prefix"><i>$</i><input inputMode="numeric" value={form.askingPrice} onChange={(event) => update("askingPrice", event.target.value.replace(/\D/g, ""))} aria-label="Asking price in Canadian dollars" /></div></label>
        </div>
        <div className="privacy-note"><span aria-hidden="true">●</span> Runs in your browser. No VIN, account or personal information required.</div>
      </form>

      <section className="result-panel" aria-live="polite">
        {loading ? <div className="result-empty"><div className="loader" /><p>Loading the Canadian market snapshot…</p></div> : result ? (
          <>
            <div className="result-head">
              <div><p className="kicker">MARKET EVIDENCE</p><h3>{result.y} {result.mk} {result.md}</h3><p>{result.p} · Used dealer inventory · {formatNumber(result.n)} vehicles</p></div>
              <span className={`confidence ${confidence}`}><i /> {confidence} evidence</span>
            </div>
            <div className="headline-value">
              <span>OBSERVED MEDIAN ASKING PRICE</span>
              <strong>{formatCad(result.p50)}</strong>
              <p>Typical 50%: {formatCad(result.p25)}–{formatCad(result.p75)}</p>
            </div>
            <CurrencyBand row={result} askingPrice={askingPrice} />
            {askingPrice ? (
              <div className="listing-readout">
                <div><span>LISTING POSITION</span><strong>≈ {approximatePercentile(askingPrice, result)}th percentile</strong><p>{formatCad(askingPrice)} is {marketPosition(askingPrice, result)}.</p></div>
                <div><span>VS. OBSERVED MEDIAN</span><strong className={difference && difference > 0 ? "positive" : "negative"}>{difference && difference > 0 ? "+" : ""}{formatCad(difference ?? 0)}</strong><p>This is comparison evidence, not a recommended offer.</p></div>
              </div>
            ) : null}
            <div className="evidence-grid">
              <div><span>Median odometer</span><strong>{formatNumber(result.km)} km</strong>{mileageDifference !== undefined ? <p>Your listing is {formatNumber(Math.abs(mileageDifference))} km {mileageDifference > 0 ? "above" : "below"} this benchmark.</p> : <p>Add an odometer to compare.</p>}</div>
              <div><span>Median days listed</span><strong>{result.dom} days</strong><p>Descriptive inventory context; not a sale-time forecast.</p></div>
              <div><span>Broader observed range</span><strong>{formatCad(result.p10)}–{formatCad(result.p90)}</strong><p>Middle 80% of this exact market cell.</p></div>
            </div>
            <div className="caution"><strong>What this does not know</strong><p>Trim, condition, accident history, options, private-sale prices and completed transaction prices. Use an inspection and vehicle-history report before buying.</p></div>
          </>
        ) : <div className="result-empty"><p>No published price cell matches that combination.</p><small>Try another year or province. Sparse cells are intentionally suppressed.</small></div>}
      </section>
    </div>
  );
}
