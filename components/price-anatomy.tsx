"use client";

import { useMemo, useState } from "react";
import { dealSignalForMatched, deriveComparableBenchmark, formatCad, formatNumber } from "@/lib/market";
import { findPublicListing } from "@/lib/vin-report";

const demoVin = "WBA8B7C37HA190314";
const subjectOdometer = 73_677;
const listing = findPublicListing(demoVin);
const evidence = listing?.comparableEvidence;

const chart = {
  width: 1_000,
  height: 430,
  left: 82,
  right: 32,
  top: 36,
  bottom: 58,
  minKm: 60_000,
  maxKm: 175_000,
  minPrice: 18_000,
  maxPrice: 42_000,
};

function xFor(km: number) {
  return chart.left + ((km - chart.minKm) / (chart.maxKm - chart.minKm)) * (chart.width - chart.left - chart.right);
}

function yFor(price: number) {
  return chart.top + (1 - (price - chart.minPrice) / (chart.maxPrice - chart.minPrice)) * (chart.height - chart.top - chart.bottom);
}

export function PriceAnatomy() {
  const [askingPrice, setAskingPrice] = useState(listing?.askingPrice ?? 34_690);
  const benchmark = useMemo(
    () => deriveComparableBenchmark(evidence?.comparables ?? [], subjectOdometer),
    [],
  );

  if (!listing || !evidence || !benchmark) return null;

  const difference = askingPrice - benchmark.benchmark;
  const signal = dealSignalForMatched(askingPrice, benchmark);
  const linePrice = (km: number) => benchmark.benchmark + (benchmark.mileageRatePer10k / 10_000) * (km - subjectOdometer);
  const xTicks = [70_000, 100_000, 130_000, 160_000];
  const yTicks = [20_000, 25_000, 30_000, 35_000, 40_000];

  return (
    <section className="anatomy-lab" aria-label="Interactive matched-comparable price model">
      <div className="anatomy-topline">
        <span>WORKED MODEL</span>
        <strong>2017 BMW 340i xDrive · VIN {demoVin}</strong>
        <i>INPUTS VISIBLE</i>
      </div>

      <div className="derivation-funnel" aria-label="Model derivation steps">
        <article><span>01 · IDENTIFY</span><strong>340i</strong><p>NHTSA decode plus seller trim</p></article>
        <b aria-hidden="true">→</b>
        <article><span>02 · MATCH</span><strong>{benchmark.sampleSize}</strong><p>automatic xDrive sedans; subject removed</p></article>
        <b aria-hidden="true">→</b>
        <article><span>03 · FIT</span><strong>{formatCad(benchmark.mileageRatePer10k)}</strong><p>asking-price change per 10,000 km</p></article>
        <b aria-hidden="true">→</b>
        <article className="funnel-answer"><span>04 · TARGET</span><strong>{formatCad(benchmark.benchmark)}</strong><p>at {formatNumber(subjectOdometer)} km</p></article>
      </div>

      <div className="model-explainer">
        <div>
          <p className="kicker">THE MODEL</p>
          <h2>Price = trim-level market + mileage effect.</h2>
        </div>
        <p>We fit ordinary least squares to recent advertised prices. The target vehicle is never an input. The centre is the fitted asking price at its odometer; the range is one observed residual RMSE on either side. With six listings, the result is deliberately graded <strong>limited evidence</strong>.</p>
      </div>

      <div className="comparable-chart">
        <div className="chart-heading"><span>ASKING PRICE × ODOMETER</span><span>{benchmark.sampleSize} MATCHED PUBLIC LISTINGS · SUBJECT EXCLUDED</span></div>
        <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-labelledby="chart-title chart-desc">
          <title id="chart-title">Mileage-adjusted asking-price model</title>
          <desc id="chart-desc">Six matched BMW listings form a downward fitted line. The subject listing and the model target are shown separately at 73,677 kilometres.</desc>
          {yTicks.map((price) => <g key={price}><line className="chart-grid" x1={chart.left} x2={chart.width - chart.right} y1={yFor(price)} y2={yFor(price)} /><text className="chart-axis-label" x={chart.left - 14} y={yFor(price) + 4} textAnchor="end">{formatCad(price).replace(",000", "k")}</text></g>)}
          {xTicks.map((km) => <g key={km}><line className="chart-grid vertical" x1={xFor(km)} x2={xFor(km)} y1={chart.top} y2={chart.height - chart.bottom} /><text className="chart-axis-label" x={xFor(km)} y={chart.height - 24} textAnchor="middle">{Math.round(km / 1_000)}k km</text></g>)}

          <line className="range-line" x1={xFor(chart.minKm)} y1={yFor(linePrice(chart.minKm) + benchmark.rmse)} x2={xFor(chart.maxKm)} y2={yFor(linePrice(chart.maxKm) + benchmark.rmse)} />
          <line className="range-line" x1={xFor(chart.minKm)} y1={yFor(linePrice(chart.minKm) - benchmark.rmse)} x2={xFor(chart.maxKm)} y2={yFor(linePrice(chart.maxKm) - benchmark.rmse)} />
          <line className="fit-line" x1={xFor(chart.minKm)} y1={yFor(linePrice(chart.minKm))} x2={xFor(chart.maxKm)} y2={yFor(linePrice(chart.maxKm))} />

          {evidence.comparables.map((item) => <g className="comp-mark" key={item.vin}>
            <circle cx={xFor(item.odometerKm)} cy={yFor(item.askingPrice)} r="7" />
            <title>{item.location}: {formatCad(item.askingPrice)} at {formatNumber(item.odometerKm)} km</title>
          </g>)}

          <line className="subject-guide" x1={xFor(subjectOdometer)} x2={xFor(subjectOdometer)} y1={yFor(askingPrice)} y2={chart.height - chart.bottom} />
          <circle className="benchmark-point" cx={xFor(subjectOdometer)} cy={yFor(benchmark.benchmark)} r="9" />
          <circle className="subject-point" cx={xFor(subjectOdometer)} cy={yFor(askingPrice)} r="10" />
          <text className="subject-label" x={xFor(subjectOdometer) + 16} y={yFor(askingPrice) - 9}>ASK {formatCad(askingPrice)}</text>
          <text className="benchmark-label" x={xFor(subjectOdometer) + 16} y={yFor(benchmark.benchmark) + 24}>TARGET {formatCad(benchmark.benchmark)}</text>
        </svg>
        <div className="chart-key"><span><i className="dot-comp" /> Matched listing</span><span><i className="line-fit" /> Fitted line</span><span><i className="dot-target" /> Target</span><span><i className="dot-subject" /> Subject ask</span><span><i className="line-range" /> ± {formatCad(benchmark.rmse)} fit error</span></div>
      </div>

      <div className="deal-control">
        <div>
          <p className="kicker">TEST THE ASK</p>
          <h2>{formatCad(askingPrice)}</h2>
          <p>Move only the seller’s asking price. The six comparables, mileage model, target and error band stay fixed.</p>
        </div>
        <label><span>SUBJECT ASKING PRICE · CAD</span><input aria-label="Interactive asking price" type="range" min="24000" max="42000" step="100" value={askingPrice} onChange={(event) => setAskingPrice(Number(event.target.value))} /><output>{formatCad(askingPrice)}</output></label>
      </div>

      <div className="deal-output">
        <article className={`signal-card ${signal.tone}`}><span>DEAL SIGNAL</span><strong>{signal.label}</strong><p>{signal.detail}</p></article>
        <article><span>MILEAGE-ADJUSTED TARGET</span><strong>{formatCad(benchmark.benchmark)}</strong><p>Expected asking range {formatCad(benchmark.low)}–{formatCad(benchmark.high)}</p></article>
        <article><span>ASK MINUS TARGET</span><strong>{difference > 0 ? "+" : ""}{formatCad(difference)}</strong><p>{difference > 0 ? "Seller asks above the model centre" : difference < 0 ? "Seller asks below the model centre" : "Seller ask equals the model centre"}</p></article>
      </div>

      <div className="comparable-ledger">
        <div className="ledger-head"><div><span>MODEL INPUT LEDGER</span><h3>Every observation behind the target.</h3></div><p>R² {benchmark.rSquared.toFixed(2)} · odometer support {formatNumber(benchmark.odometerMin)}–{formatNumber(benchmark.odometerMax)} km. Public inventory can change or disappear, so every capture date stays visible.</p></div>
        <div className="ledger-table" role="table" aria-label="Matched comparable inputs">
          <div className="ledger-row ledger-labels" role="row"><span>VIN</span><span>LOCATION</span><span>ODOMETER</span><span>ASK</span><span>CAPTURED</span></div>
          {evidence.comparables.map((item) => <div className="ledger-row" role="row" key={item.vin}><span data-label="VIN">…{item.vin.slice(-6)}</span><span data-label="Location">{item.location}</span><span data-label="Odometer">{formatNumber(item.odometerKm)} km</span><strong data-label="Ask">{formatCad(item.askingPrice)}</strong><span data-label="Captured">{item.observedAt}</span></div>)}
        </div>
        <div className="model-equation"><div><span>Fitted target</span><strong>{formatCad(benchmark.benchmark)}</strong></div><i>±</i><div><span>Residual RMSE</span><strong>{formatCad(benchmark.rmse)}</strong></div><i>=</i><div className="equation-result"><span>Expected asking range</span><strong>{formatCad(benchmark.low)}–{formatCad(benchmark.high)}</strong></div></div>
      </div>
    </section>
  );
}
