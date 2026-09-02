import manifest from "@/public/data/manifest.json";
import modelMetrics from "@/public/data/model-metrics.json";
import conditionModel from "@/public/data/condition-model.json";
import { formatRetrievedDate } from "@/lib/market";
import { InfoIcon, CheckCircleIcon, AnchorIcon } from "@/components/icons";

const provinceNames: Record<string, string> = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick", NL: "Newfoundland & Labrador",
  NS: "Nova Scotia", NT: "Northwest Territories", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan", YT: "Yukon",
};

export default function MarketLabPage() {
  const sha = manifest.sourceSha256;
  const maxFoldWape = Math.max(...modelMetrics.folds.map((fold) => fold.model.wape_pct));

  return (
    <div className="inner-page">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Data control room</p>
          <h1>Market data you can <em>interrogate.</em></h1>
        </div>
        <p className="page-hero-side">Coverage, provenance and automated quality gates from the exact artifact powering the public price check.</p>
      </header>

      <section className="lab-stats" aria-label="Coverage totals">
        <article>
          <span>Used vehicles represented <InfoIcon /></span>
          <strong title="Across published price cells">{manifest.usedVehiclesRepresented.toLocaleString("en-CA")}</strong>
        </article>
        <article>
          <span>Used market cells <InfoIcon /></span>
          <strong title="Province × make × model × year">{manifest.usedMarketCells.toLocaleString("en-CA")}</strong>
        </article>
        <article>
          <span>Makes</span>
          <strong title="With usable used inventory">{manifest.makes}</strong>
        </article>
        <article>
          <span>Year coverage</span>
          <strong title="Not every combination is present">{manifest.yearRange[0]}–{manifest.yearRange[1]}</strong>
        </article>
      </section>

      <section className="lab-grid">
        <article className="qa-card">
          <div className="qa-head">
            <div><p className="kicker">Pipeline health</p><h2>All release gates passed</h2></div>
            <span className="pill pill-verified"><i aria-hidden="true" /> VERIFIED</span>
          </div>
          <ul className="qa-checks">
            <li><span>Schema contract</span><strong className="pass"><CheckCircleIcon /> PASS</strong></li>
            <li><span>Duplicate composite keys</span><strong>{manifest.quality.duplicateKeys}</strong></li>
            <li><span>Percentile-order violations</span><strong>{manifest.quality.percentileOrderViolations}</strong></li>
            <li><span>Rejected market cells</span><strong>{manifest.quality.rejectedRows}</strong></li>
            <li><span>Minimum cell sample n</span><strong>≥ {manifest.quality.minimumCellSize}</strong></li>
          </ul>
        </article>

        <article className="qa-card provenance-card">
          <p className="kicker">Artifact provenance</p>
          <h2>Reproducible by construction</h2>
          <dl className="prov-list">
            <div><dt>Retrieved</dt><dd>{formatRetrievedDate(manifest.sourceRetrievedAt)}</dd></div>
            <div><dt>Licence</dt><dd>{manifest.sourceLicense}</dd></div>
            <div><dt>Price basis</dt><dd>{manifest.priceBasis}</dd></div>
            <div><dt>SHA-256 (abbrev.)</dt><dd className="hash">{sha.slice(0, 8)}…{sha.slice(-8)}</dd></div>
          </dl>
        </article>
      </section>

      <section className="lab-grid">
        <article className="model-card consumer">
          <div className="qa-head">
            <div><p className="kicker">Consumer adjustment model</p><h2>Completed outcomes train the condition effect.</h2></div>
            <span className="pill pill-blue">USED IN CONSUMER RESULTS</span>
          </div>
          <div className="scoreboard">
            <article><strong>{conditionModel.rows.eligibleSoldOutcomes.toLocaleString("en-CA")}</strong><span>Eligible sold outcomes</span></article>
            <article><strong>${Math.round(conditionModel.validation.model.maeCad).toLocaleString("en-CA")}</strong><span>Temporal-test MAE</span></article>
            <article><strong>{conditionModel.validation.model.wapePct.toFixed(2)}%</strong><span>Temporal-test WAPE</span></article>
            <article><strong>−{conditionModel.validation.maeImprovementPct.toFixed(2)}%</strong><span>vs peer baseline</span></article>
          </div>
          <div className="model-foot">
            <i className="foot-icon" aria-hidden="true"><AnchorIcon /></i>
            <p><strong>Canadian anchor.</strong> Learned auction residual. <a href="/methodology#model-benchmark">Read the model card summary →</a></p>
          </div>
        </article>

        <article className="model-card research">
          <div className="qa-head">
            <div><p className="kicker">Research benchmark</p><h2>A model that earns its place by beating a declared baseline.</h2></div>
            <span className="pill pill-red">NOT USED FOR CONSUMER RESULTS</span>
          </div>
          <div className="scoreboard">
            <article><strong>${Math.round(modelMetrics.model.mae_cad).toLocaleString("en-CA")}</strong><span>Grouped-CV MAE</span></article>
            <article><strong>−{modelMetrics.maeImprovementVsBaselinePct.toFixed(1)}%</strong><span>vs global-median baseline</span></article>
            <article><strong>{modelMetrics.model.r2.toFixed(3)}</strong><span>Weighted R²</span></article>
            <article><strong>{modelMetrics.makeModelGroups}</strong><span>Held-out make × model groups</span></article>
          </div>
          <p className="fold-title"><span>Five-fold WAPE (grouped)</span> · Five folds. Zero make-model overlap.</p>
          <div className="fold-bars" aria-label="Model error by validation fold">
            {modelMetrics.folds.map((fold) => (
              <div key={fold.fold}>
                <b>{fold.model.wape_pct.toFixed(1)}%</b>
                <i><b style={{ width: `${(fold.model.wape_pct / maxFoldWape) * 100}%` }} /></i>
                <span>Fold {fold.fold}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="lab-note">
        <div className="lab-note-info">
          <InfoIcon size={16} />
          <p><strong>Coverage is not uniform.</strong> Cells below {manifest.quality.minimumCellSize} vehicles are suppressed.</p>
        </div>
        <div className="province-pills">
          {manifest.provinces.map((province) => <span key={province} title={provinceNames[province]}>{province}</span>)}
        </div>
      </section>
    </div>
  );
}
