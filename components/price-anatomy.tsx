import { conditionModelMetadata, predictConditionAdjustedValue, type ConditionProfile } from "@/lib/condition-model";
import marketData from "@/public/data/market.json";
import { formatCad, formatNumber, type MarketRow } from "@/lib/market";
import { CodeIcon, CpuIcon, BarsIcon, PencilIcon, ShieldCheckIcon, PlugIcon, ShieldIcon } from "@/components/icons";

/**
 * Explains the live valuation contract without embedding a captured listing.
 * The worked example mirrors the demo's default vehicle and is computed from
 * the released artifacts at request time, so it can never masquerade as a
 * live inventory feed.
 */
const DEMO_CELL = { province: "ON", make: "Toyota", model: "RAV4", year: 2021, askingPrice: 31995, odometerKm: 89000 };
const DEMO_PROFILE: ConditionProfile = {
  conditionGrade: "average",
  accidentHistory: "none",
  mechanicalCondition: "sound",
  cosmeticCondition: "light",
  serviceHistory: "partial",
  wearItems: "good",
};

function workedExample() {
  const rows = marketData as unknown as MarketRow[];
  const row = rows.find((item) => item.p === DEMO_CELL.province && item.mk === DEMO_CELL.make && item.md === DEMO_CELL.model && item.y === DEMO_CELL.year);
  if (!row) return undefined;
  const valuation = predictConditionAdjustedValue({
    baseValue: row.p50,
    baseLow: row.p10,
    baseHigh: row.p90,
    baselineOdometerKm: row.km,
    targetOdometerKm: DEMO_CELL.odometerKm,
    profile: DEMO_PROFILE,
  });
  return { row, valuation };
}

export function PriceAnatomy() {
  const example = workedExample();
  const valuation = example?.valuation;
  const adjustment = valuation?.adjustmentCad ?? 0;
  const span = valuation ? valuation.high - valuation.low : 1;
  const at = (value: number) => Math.max(3, Math.min(97, ((value - valuation!.low) / span) * 100));

  return (
    <section className="anatomy-lab" aria-label="Live valuation data contract">
      <div className="anatomy-topline">
        <span>LIVE DATA CONTRACT</span>
        <strong>Decode → match → adjust → disclose</strong>
        <i>NO EMBEDDED LISTINGS</i>
      </div>

      <div className="anatomy-steps">
        <article>
          <i className="step-num" aria-hidden="true">1</i>
          <div className="step-head"><CodeIcon /><div><span>IDENTIFY</span><strong>VIN</strong></div></div>
          <p>Official NHTSA vPIC decode at request time.</p>
        </article>
        <article>
          <i className="step-num" aria-hidden="true">2</i>
          <div className="step-head"><PencilIcon /><div><span>LISTING FACTS</span><strong>USER ENTERED</strong></div></div>
          <p>Asking price, kilometres and condition until a licensed feed is connected.</p>
        </article>
        <article>
          <i className="step-num" aria-hidden="true">3</i>
          <div className="step-head"><BarsIcon /><div><span>CANADIAN ANCHOR</span><strong>MARKET</strong></div></div>
          <p>Current province × make × model × year reference with sample size and percentiles.</p>
        </article>
        <article className="ml">
          <i className="step-num" aria-hidden="true">4</i>
          <div className="step-head"><CpuIcon /><div><span>RELATIVE ADJUSTMENT</span><strong>ML</strong></div></div>
          <p>{formatNumber(conditionModelMetadata.outcomes)} completed auction outcomes train condition and odometer effects.</p>
        </article>
      </div>

      {valuation ? (
        <div className="anatomy-panels">
          <div className="anatomy-equation">
            <small>WORKED EXAMPLE · {example!.row.y} {example!.row.mk} {example!.row.md} · {example!.row.p}</small>
            <div><span>Canadian anchor</span><strong>{formatCad(valuation.baseValue)}</strong></div>
            <b className="op" aria-hidden="true">{adjustment < 0 ? "−" : "+"}</b>
            <div><span>Condition &amp; odometer</span><strong className="adjustment">{adjustment === 0 ? "±$0" : `${adjustment > 0 ? "+" : "−"}${formatCad(Math.abs(adjustment))}`}</strong></div>
            <b className="op" aria-hidden="true">=</b>
            <div><span>ML market value</span><strong>{formatCad(valuation.estimate)}</strong></div>
          </div>
          <div className="anatomy-range">
            <div className="range-end"><strong>{formatCad(valuation.low)}</strong><span>PREDICTED LOW</span></div>
            <div className="range-track">
              <i className="range-dot end" style={{ left: "0%" }} aria-hidden="true" />
              <i className="range-dot estimate" style={{ left: `${at(valuation.estimate)}%` }}><i><b>{formatCad(valuation.estimate)}</b><span>ESTIMATE</span></i></i>
              <i className="range-dot asking" style={{ left: `${at(DEMO_CELL.askingPrice)}%` }}><i><b>{formatCad(DEMO_CELL.askingPrice)}</b><span>ASKING</span></i></i>
              <i className="range-dot end" style={{ left: "100%" }} aria-hidden="true" />
            </div>
            <div className="range-end"><strong>{formatCad(valuation.high)}</strong><span>PREDICTED HIGH</span></div>
          </div>
        </div>
      ) : null}

      <div className="anatomy-notes">
        <article className="connected">
          <ShieldCheckIcon />
          <div><span>CONNECTED NOW</span><strong>VIN decoding</strong><p>NHTSA vPIC is queried only when Decode VIN is pressed.</p></div>
        </article>
        <article className="required">
          <PlugIcon />
          <div><span>REQUIRED FOR LIVE PRICE</span><strong>Listing provider</strong><p>Current ask and odometer remain user-entered until a licensed Canadian connector is live.</p></div>
        </article>
        <article className="guardrail">
          <ShieldIcon />
          <div><span>MODEL GUARDRAIL</span><strong>Transparent limits</strong><p>No seller snapshot is treated as live. Missing or stale inputs stay visible.</p></div>
        </article>
      </div>
    </section>
  );
}
