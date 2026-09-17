import { CalculationExample } from "@/components/calculation-example";
import { ReportNav } from "@/components/report-nav";
import market from "@/public/data/market.json";
import type { MarketRow } from "@/lib/market";

const contents = [{id:"worked-example",label:"Try the calculation"},{id:"inputs",label:"Where inputs come from"},{id:"exclusions",label:"What it leaves out"}];

export default function CalculationPage() {
  const row = market.find(row => row.p === "ON" && row.mk === "Toyota" && row.md === "RAV4" && row.y === 2021) as MarketRow;
  return <div className="inner-page research-page calculation-page">
    <header className="report-header"><div><p className="eyebrow">AutoValue / Research</p><h1>How we calculate</h1><p>Change the example. Select a part of the equation to see where it comes from.</p></div><span>Canadian dollars · Asking-price reference</span></header>
    <div className="report-layout"><ReportNav items={contents} /><div className="report-content">
      <CalculationExample row={row} />
      <section className="report-section" id="inputs"><div className="section-heading"><h2>Where inputs come from</h2><span>VIN decoding is optional</span></div><div className="input-sources">
        <article><span>Vehicle identity</span><h3>You or the VIN decoder</h3><p>Select the province, make, model and year, or request an official NHTSA vPIC VIN decode. The VIN identifies specifications; it does not contain the current asking price, mileage or condition.</p></article>
        <article><span>Listing details</span><h3>The seller or your inspection</h3><p>Asking price, odometer and condition are entered by you. There is no connected listing feed. The app never treats a seller snapshot as live.</p></article>
        <article><span>Price reference</span><h3>The released market data</h3><p>The matched Canadian cell supplies the median, percentiles, mileage and sample size. Without a defensible match, a VIN decode does not produce an estimate.</p></article>
      </div></section>
      <section className="report-section" id="exclusions"><div className="section-heading"><h2>What it leaves out</h2><a href="/methodology">Read the methodology ↗</a></div><div className="exclusion-list"><article><h3>Inspection</h3><p>User-entered condition is not a verified inspection. Hidden damage and unreported history can materially affect the price.</p></article><article><h3>The final bill</h3><p>Taxes, fees, options and negotiation are not included. The estimate is not a suggested offer.</p></article><article><h3>A future sale</h3><p>The range describes current asking-market uncertainty. It is not a depreciation forecast or guaranteed sale price.</p></article></div></section>
    </div></div>
  </div>;
}
