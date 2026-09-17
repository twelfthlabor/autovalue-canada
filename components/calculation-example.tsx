"use client";

import Link from "next/link";

import { useMemo, useState, type CSSProperties } from "react";
import { CONDITION_TIER_GRADE, CONDITION_TIER_LABEL, predictConditionAdjustedValue, type ConditionTier } from "@/lib/condition-model";
import { formatCad, formatNumber, type MarketRow } from "@/lib/market";

const tiers: ConditionTier[] = ["below-average", "rough", "average"];

export function CalculationExample({ row }: { row: MarketRow }) {
  const [mileage, setMileage] = useState(89000);
  const [tier, setTier] = useState<ConditionTier>("average");
  const [selected, setSelected] = useState<"anchor" | "adjustment" | "result">("adjustment");
  const value = useMemo(() => predictConditionAdjustedValue({ baseValue: row.p50, baseLow: row.p10, baseHigh: row.p90, baselineOdometerKm: row.km, targetOdometerKm: mileage, profile: { conditionGrade: CONDITION_TIER_GRADE[tier] } }), [row, mileage, tier]);
  const explanation = {
    anchor: { title: "The Canadian starting point", copy: `${formatNumber(row.n)} dealer listings match this province, make, model and year. Their median asking price is ${formatCad(row.p50)} at a median ${formatNumber(row.km)} km. The anchor stays fixed while you change the example.` },
    adjustment: { title: "What the inputs change", copy: `The condition model compares ${formatNumber(mileage)} km with the market median, and maps the condition tier to its auction-grade equivalent. The resulting adjustment is ${value.adjustmentCad < 0 ? "−" : "+"}${formatCad(Math.abs(value.adjustmentCad))}.` },
    result: { title: "The estimate and its range", copy: `After rounding, the estimate is ${formatCad(value.estimate)}. The range, ${formatCad(value.low)}–${formatCad(value.high)}, combines the Canadian price spread with model residuals. It is not a guaranteed transaction price.` },
  }[selected];
  return <section className="calculation-example" id="worked-example" aria-label="Interactive worked valuation example">
    <header><div><span className="eyebrow">Worked example</span><h2>{row.y} {row.mk} {row.md}</h2><p>{row.p} · {formatNumber(row.n)} vehicles in the reference set</p></div><button className="text-button" onClick={() => { setMileage(89000); setTier("average"); }}>Reset example ↺</button></header>
    <div className="calculation-controls"><label><span>Odometer <output>{formatNumber(mileage)} km</output></span><input type="range" aria-label="Example odometer" min="0" max="250000" step="1000" value={mileage} style={{ "--fill": `${Math.min(100, Math.max(0, mileage) / 2500)}%` } as CSSProperties} onChange={event => setMileage(Number(event.target.value))} /></label><fieldset><legend>Condition tier</legend><div>{tiers.map(item => <button key={item} aria-pressed={tier === item} onClick={() => setTier(item)}>{CONDITION_TIER_LABEL[item]}</button>)}</div></fieldset></div>
    <div className="calculation-ledger" aria-label="Calculation breakdown">
      <button aria-pressed={selected === "anchor"} onClick={() => setSelected("anchor")}><span>Canadian anchor</span><strong>{formatCad(row.p50)}</strong><small>Published market median</small></button><span aria-hidden="true">{value.adjustmentCad < 0 ? "−" : "+"}</span>
      <button aria-pressed={selected === "adjustment"} onClick={() => setSelected("adjustment")}><span>Condition &amp; mileage</span><strong data-testid="example-adjustment">{formatCad(Math.abs(value.adjustmentCad))}</strong><small>Relative model adjustment</small></button><span aria-hidden="true">=</span>
      <button aria-pressed={selected === "result"} onClick={() => setSelected("result")}><span>Estimated market value</span><strong data-testid="example-estimate">{formatCad(value.estimate)}</strong><small>Rounded to the nearest $100</small></button>
    </div>
    <div className="calculation-explanation" aria-live="polite"><h3>{explanation.title}</h3><p>{explanation.copy}</p></div>
    <footer><span>Predicted range</span><strong>{formatCad(value.low)} – {formatCad(value.high)}</strong><Link href="/">Use your own vehicle ↗</Link></footer>
  </section>;
}
