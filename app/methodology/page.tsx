import Link from "next/link";

const decisions = [
  ["What we show", "A mileage-adjusted target and error band when reviewed trim-level matches exist; otherwise, an observed broad-market distribution."],
  ["What we do not show", "A known transaction value, appraisal, recommended offer, damage adjustment or residual-value forecast."],
  ["Why the range", "P25–P75 describes the middle half of observed inventory. P10–P90 supplies broader context without exposing individual listings."],
  ["Minimum evidence", "The source suppresses prices for cells with fewer than 10 vehicles. We validate that rule during every build."],
  ["Listing evidence", "VIN validation confirms format only. Seller history highlights stay attributed and never alter or certify the modeled price."],
];

export default function MethodologyPage() {
  return (
    <div className="document-page">
      <header className="document-hero">
        <p className="eyebrow"><span /> Methodology</p>
        <h1>A useful number should arrive with its <em>receipts.</em></h1>
        <p>This demo is designed to make every market claim inspectable: what it measures, how much evidence supports it and where it can be wrong.</p>
      </header>

      <section className="method-grid">
        <aside><p>RELEASE 0.2</p><strong>Matched + broad evidence</strong><span>Market data Aug 29, 2026</span><span>Listings Aug 25–31, 2026</span><span>Prices in CAD</span><span>Non-commercial research</span></aside>
        <div>
          <h2>Claim boundary</h2>
          <p className="lead">This release answers one defensible question: <strong>is the ask supported by recent comparable inventory after a visible mileage adjustment?</strong></p>
          <p>A vehicle has no observable “true” transaction price before it sells. The matched output is therefore a current asking-price target with model error—not a promise of what a buyer will pay. It does not adjust for condition or accident history. Seller highlights remain attributed and never declare a vehicle damage-free.</p>
          <div className="decision-list">
            {decisions.map(([title, copy], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}
          </div>
        </div>
      </section>

      <section className="method-section">
        <p className="kicker">MATCHED-COMPARABLE MODEL</p>
        <h2>Match first. Exclude the subject. Then learn the mileage effect.</h2>
        <div className="method-columns">
          <div><h3>Evidence tier</h3><p>The BMW example uses six 2017 340i xDrive automatic sedans observed in Canadian public inventory. Manual cars and the subject listing are excluded. Fewer than four valid observations produces no matched model.</p></div>
          <div><h3>Estimator</h3><p>Ordinary least squares fits advertised price against odometer. The displayed centre evaluates that line at the subject’s 73,677 km. The $33,200 target and −$990 per 10,000 km coefficient are rounded only after fitting.</p></div>
          <div><h3>Uncertainty</h3><p>The $30,700–$35,600 range is target ± one residual RMSE. Sample size, capture date and each model input are public. Six observations are graded limited evidence; condition and transaction-price error remain outside the model.</p><Link className="text-link" href="/calculation">Audit the calculation →</Link></div>
        </div>
      </section>

      <section className="method-section">
        <p className="kicker">DATA PROVENANCE</p>
        <h2>Canadian inventory, aggregated to protect privacy and improve stability.</h2>
        <div className="method-columns">
          <div><h3>Market source</h3><p>OmniaAuto’s Canadian Vehicle Market Aggregates describe 624,678 vehicles across Canada. Price statistics are based on dealer asking prices and duplicate vehicles are resolved to an originating seller.</p><a className="text-link" href="https://huggingface.co/datasets/OmniaAuto/canadian-vehicle-market-aggregates" target="_blank" rel="noreferrer">View source dataset ↗</a></div>
          <div><h3>Licence</h3><p>The aggregate dataset is released under CC BY-NC 4.0 for research, teaching and non-commercial use. AutoValue Canada is a non-commercial portfolio demonstration and attributes the publisher on every relevant surface.</p><a className="text-link" href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer">Read the licence ↗</a></div>
          <div><h3>Build-time QA</h3><p>The pipeline verifies schema, numeric types, unique market-cell keys, minimum sample size, positive prices and monotonic percentile order. A failed check stops the build.</p><Link className="text-link" href="/market-lab">Inspect the QA summary →</Link></div>
        </div>
      </section>

      <section className="method-section" id="model-benchmark">
        <p className="kicker">MODEL CARD · RESEARCH ONLY</p>
        <h2>Grouped validation asks a harder, more honest question.</h2>
        <div className="method-columns">
          <div><h3>Target</h3><p>The published median dealer asking price for an aggregate province × make × model × year cell. The benchmark is evaluated separately from the consumer lookup and never changes a displayed source statistic.</p></div>
          <div><h3>Leakage control</h3><p>Five-fold GroupKFold validation holds out complete make-model groups. No make-model pair appears in both training and evaluation data within a fold. All reported scores are out-of-fold.</p></div>
          <div><h3>Result and limit</h3><p>Histogram gradient boosting reduces weighted MAE by 45.2% versus a training-fold global-median baseline, but its $8,026 MAE is not adequate for individual appraisals. That gap remains visible by design.</p><Link className="text-link" href="/market-lab">View metrics and fold errors →</Link></div>
        </div>
      </section>

      <section className="method-section dark-section">
        <p className="kicker">ROADMAP GATES</p>
        <h2>Features are earned by data—not added by wishful thinking.</h2>
        <div className="gate-grid">
          <article><span className="gate blocked">BLOCKED</span><h3>Transaction-value estimate</h3><p>Requires licensed Canadian completed-sale data with enough regional and trim coverage for time-based validation.</p></article>
          <article><span className="gate blocked">BLOCKED</span><h3>1–3 year residual forecast</h3><p>Requires multiple historical snapshots or transactions. A current snapshot cannot support a trend claim.</p></article>
          <article><span className="gate ready">NEXT</span><h3>Safety recall context</h3><p>Transport Canada publishes a first-party recall dataset and API under the Open Government Licence.</p></article>
          <article><span className="gate ready">NEXT</span><h3>Operating-cost context</h3><p>NRCan publishes model-level fuel-consumption and battery-electric vehicle ratings suitable for transparent cost scenarios.</p></article>
        </div>
      </section>
    </div>
  );
}
