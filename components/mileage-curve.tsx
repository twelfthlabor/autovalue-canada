"use client";

import { useId, useMemo, type CSSProperties, type PointerEvent } from "react";
import { predictConditionAdjustedValue, type ConditionProfile, type ConditionValuation } from "@/lib/condition-model";
import { formatCad, formatNumber, type MarketRow } from "@/lib/market";

const MAX_KM = 250000;
const LEFT = 20;
const RIGHT = 780;

export function MileageCurve({ row, profile, mileage, valuation, onChange }: {
  row: MarketRow; profile: ConditionProfile; mileage: number; valuation: ConditionValuation; onChange: (km: number) => void;
}) {
  const { conditionGrade } = profile;
  const points = useMemo(() => Array.from({ length: 101 }, (_, index) => {
    const km = index * MAX_KM / 100;
    const prediction = predictConditionAdjustedValue({ baseValue: row.p50, baseLow: row.p10, baseHigh: row.p90, baselineOdometerKm: row.km, targetOdometerKm: km, profile: { conditionGrade } });
    return { km, price: prediction.estimate };
  }), [row, conditionGrade]);
  const low = Math.min(...points.map(p => p.price), valuation.estimate) * .9;
  const high = Math.max(...points.map(p => p.price), valuation.estimate) * 1.08;
  const x = (km: number) => LEFT + Math.min(MAX_KM, Math.max(0, km)) / MAX_KM * (RIGHT - LEFT);
  const y = (price: number) => 145 - (price - low) / (high - low) * 118;
  const line = points.map((point, i) => `${i ? "L" : "M"}${x(point.km).toFixed(2)},${y(point.price).toFixed(2)}`).join(" ");
  const cursorX = x(mileage);
  const cursorY = y(valuation.estimate);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const areaFillId = `curve-area-fill-${uid}`;
  const lineStrokeId = `curve-line-stroke-${uid}`;
  const dotHaloId = `curve-dot-halo-${uid}`;

  function scrub(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = ((event.clientX - bounds.left) / bounds.width * 800 - LEFT) / (RIGHT - LEFT);
    onChange(Math.round(Math.max(0, Math.min(1, position)) * MAX_KM / 1000) * 1000);
  }

  return (
    <section className="mileage-curve" aria-labelledby="mileage-title">
      <div className="curve-heading"><div><h4 id="mileage-title">Put the mileage in perspective.</h4><p>Same car. Same condition. Different kilometres.</p></div><button type="button" onClick={() => onChange(row.km)} title="Set odometer to the selected market's median">Use market median <span aria-hidden="true">↺</span></button></div>
      <div className="curve-plot">
        <svg viewBox="0 0 800 180" preserveAspectRatio="none" aria-hidden="true" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); scrub(event); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) scrub(event); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}>
          <defs>
            <linearGradient id={areaFillId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#0087fb" stopOpacity=".03" />
              <stop offset=".5" stopColor="#0087fb" stopOpacity=".14" />
              <stop offset="1" stopColor="#0087fb" stopOpacity=".04" />
            </linearGradient>
            <linearGradient id={lineStrokeId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#5db4ff" />
              <stop offset=".52" stopColor="#0087fb" />
              <stop offset="1" stopColor="#0069cf" />
            </linearGradient>
            <radialGradient id={dotHaloId}>
              <stop offset="0" stopColor="#0087fb" stopOpacity=".24" />
              <stop offset="1" stopColor="#0087fb" stopOpacity="0" />
            </radialGradient>
          </defs>
          {[35, 90, 145].map((level) => <line className="curve-gridline" key={level} x1={LEFT} x2={RIGHT} y1={level} y2={level} />)}
          {Array.from({ length: 51 }, (_, index) => { const km = index * 5000; return <line key={km} className="curve-rug" x1={x(km)} x2={x(km)} y1="167" y2={index % 10 === 0 ? 178 : 172} />; })}
          <path className="curve-area" style={{ fill: `url(#${areaFillId})` }} d={`${line} L${RIGHT},145 L${LEFT},145 Z`} />
          <path className="curve-line" style={{ stroke: `url(#${lineStrokeId})` }} d={line} />
          <line className="curve-baseline" x1={x(row.km)} x2={x(row.km)} y1="20" y2="155" />
          <line className="curve-cursor" x1={cursorX} x2={cursorX} y1="16" y2="175" />
          <circle className="curve-dot-halo" style={{ fill: `url(#${dotHaloId})` }} cx={cursorX} cy={cursorY} r="12" />
          <circle className="curve-dot" cx={cursorX} cy={cursorY} r="5" />
        </svg>
        <span className="curve-price high">{formatCad(high)}</span><span className="curve-price low">{formatCad(low)}</span>
      </div>
      <label className="curve-slider-label"><span>Mileage explorer</span><output>{formatNumber(mileage)} km</output><input type="range" aria-label="Explore mileage" aria-valuetext={`${formatNumber(mileage)} kilometres, estimate ${formatCad(valuation.estimate)}`} min="0" max={MAX_KM} step="1000" value={Math.min(mileage, MAX_KM)} style={{ "--fill": `${Math.min(100, Math.max(0, mileage) / MAX_KM * 100)}%` } as CSSProperties} onChange={event => onChange(Number(event.target.value))} /></label>
      <div className="curve-axis"><span>0 km</span><span>125,000</span><span>250,000 km</span></div>
      <p className="curve-note"><span className="curve-key" /> Drag the curve or use the slider <span className="curve-note-end">Mileage scenario · not a future-price forecast</span></p>
      {mileage > MAX_KM ? <p className="curve-warning">Entered mileage is beyond this chart. The estimate still uses your entered {formatNumber(mileage)} km.</p> : null}
    </section>
  );
}
