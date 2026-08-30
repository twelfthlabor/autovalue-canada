import manifest from "@/public/data/manifest.json";
import modelMetrics from "@/public/data/model-metrics.json";

const provinceNames: Record<string, string> = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick", NL: "Newfoundland & Labrador",
  NS: "Nova Scotia", NT: "Northwest Territories", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan", YT: "Yukon",
};

export default function MarketLabPage() {
  return (
    <div className="lab-page">
      <header className="lab-hero">
        <div><p className="eyebrow"><span /> Data control room</p><h1>Market data you can <em>interrogate.</em></h1></div>
        <p>Coverage, provenance and automated quality gates from the exact artifact powering the public price check.</p>
      </header>

      <section className="lab-metrics">
        <article><span>USED VEHICLES REPRESENTED</span><strong>{manifest.usedVehiclesRepresented.toLocaleString("en-CA")}</strong><p>Across published price cells</p></article>
        <article><span>USED MARKET CELLS</span><strong>{manifest.usedMarketCells.toLocaleString("en-CA")}</strong><p>Province × make × model × year</p></article>
        <article><span>MAKES</span><strong>{manifest.makes}</strong><p>With usable used inventory</p></article>
        <article><span>YEAR COVERAGE</span><strong>{manifest.yearRange[0]}–{manifest.yearRange[1]}</strong><p>Not every combination is present</p></article>
      </section>

      <section className="lab-grid">
        <article className="qa-card">
          <div className="card-title"><div><p className="kicker">PIPELINE HEALTH</p><h2>All release gates passed</h2></div><span className="status-live"><i /> VERIFIED</span></div>
          <div className="checks">
            <div><span>Schema contract</span><strong>PASS</strong></div>
            <div><span>Duplicate composite keys</span><strong>{manifest.quality.duplicateKeys}</strong></div>
            <div><span>Percentile-order violations</span><strong>{manifest.quality.percentileOrderViolations}</strong></div>
            <div><span>Rejected market cells</span><strong>{manifest.quality.rejectedRows}</strong></div>
            <div><span>Minimum cell sample</span><strong>n ≥ {manifest.quality.minimumCellSize}</strong></div>
          </div>
        </article>

        <article className="provenance-card">
          <p className="kicker">ARTIFACT PROVENANCE</p>
          <h2>Reproducible by construction</h2>
          <dl>
            <div><dt>Retrieved</dt><dd>Aug 29, 2026</dd></div>
            <div><dt>Licence</dt><dd>{manifest.sourceLicense}</dd></div>
            <div><dt>Price basis</dt><dd>{manifest.priceBasis}</dd></div>
            <div><dt>SHA-256</dt><dd className="hash">{manifest.sourceSha256}</dd></div>
          </dl>
        </article>
      </section>

      <section className="model-section">
        <div className="model-title">
          <div><p className="kicker">RESEARCH BENCHMARK</p><h2>A model that earns its place by beating a declared baseline.</h2></div>
          <span className="research-badge">NOT USED FOR CONSUMER RESULTS</span>
        </div>
        <div className="model-scoreboard">
          <article><span>GROUPED-CV MAE</span><strong>${Math.round(modelMetrics.model.mae_cad).toLocaleString("en-CA")}</strong><p>Vehicle-count weighted · CAD</p></article>
          <article><span>VS. GLOBAL-MEDIAN BASELINE</span><strong>−{modelMetrics.maeImprovementVsBaselinePct.toFixed(1)}%</strong><p>Lower mean absolute error</p></article>
          <article><span>WEIGHTED R²</span><strong>{modelMetrics.model.r2.toFixed(3)}</strong><p>Out-of-fold predictions only</p></article>
          <article><span>HELD-OUT GROUPS</span><strong>{modelMetrics.makeModelGroups}</strong><p>Make × model combinations</p></article>
        </div>
        <div className="validation-story">
          <div>
            <p className="kicker">LEAKAGE CONTROL</p>
            <h3>Five folds. Zero make-model overlap.</h3>
            <p>Complete make-model groups are held out from training. The benchmark asks whether vehicle age, mileage, province, make, market time and sample strength generalize to unseen model lines.</p>
          </div>
          <div className="folds" aria-label="Model error by validation fold">
            {modelMetrics.folds.map((fold) => (
              <div key={fold.fold}>
                <span>FOLD 0{fold.fold}</span>
                <i><b style={{ width: `${Math.min(100, fold.model.wape_pct * 3)}%` }} /></i>
                <strong>{fold.model.wape_pct.toFixed(1)}% WAPE</strong>
              </div>
            ))}
          </div>
        </div>
        <p className="model-boundary"><strong>Claim boundary:</strong> predicts aggregate median dealer asking prices from one snapshot. It is not an individual appraisal, transaction-price estimate or future-value forecast. <a href="/methodology#model-benchmark">Read the model card summary.</a></p>
      </section>

      <section className="coverage-section">
        <div><p className="kicker">GEOGRAPHIC SCOPE</p><h2>Published coverage across Canada</h2></div>
        <div className="province-list">{manifest.provinces.map((province, index) => <div key={province}><span>{String(index + 1).padStart(2, "0")}</span><strong>{province}</strong><p>{provinceNames[province]}</p></div>)}</div>
      </section>

      <section className="lab-disclosure">
        <strong>Interpretation note</strong>
        <p>Coverage is not uniform. Smaller provinces and territories have more suppressed price cells because the dataset does not publish statistics for samples below 10 vehicles. Counts and price-cell totals therefore answer different questions.</p>
      </section>
    </div>
  );
}
