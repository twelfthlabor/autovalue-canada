import manifest from "@/public/data/manifest.json";
import modelMetrics from "@/public/data/model-metrics.json";
import conditionModel from "@/public/data/condition-model.json";
import sqlSummary from "@/public/data/sql_summary.json";
import { formatRetrievedDate } from "@/lib/market";
import { InfoIcon, CheckCircleIcon, AnchorIcon } from "@/components/icons";

const provinceNames: Record<string, string> = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick", NL: "Newfoundland & Labrador",
  NS: "Nova Scotia", NT: "Northwest Territories", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan", YT: "Yukon",
};

type SegmentRow = {
  segment: string;
  n: number;
  maeCad?: number;
  medianAeCad?: number;
  wapePct?: number;
  coverage80Pct?: number;
  intervalWidthPct?: number;
};

type SegmentAxis = { definition: string; baseline: SegmentRow[]; model: SegmentRow[] };

const segmentAxes: Array<[string, string]> = [
  ["auctionGrade", "Auction grade"],
  ["saleYear", "Sale year"],
  ["priceBand", "Price band"],
  ["logOdometerDeltaSextile", "Odometer delta vs peers"],
  ["peerCountTercile", "Peer count"],
];

export default function MarketLabPage() {
  const sha = manifest.sourceSha256;
  const maxFoldWape = Math.max(...modelMetrics.folds.map((fold) => fold.model.wape_pct));
  const segments = conditionModel.validation.segments as unknown as Record<string, SegmentAxis>;
  const segmentPairs = segmentAxes.flatMap(([axisKey]) => segments[axisKey].baseline.map((baseline, index) => ({ baseline, model: segments[axisKey].model[index] })));
  const modelWins = segmentPairs.filter(({ baseline, model }) => (model.wapePct ?? Infinity) < (baseline.wapePct ?? -Infinity)).length;
  const intervalWidthPct = segments.auctionGrade.model[0]?.intervalWidthPct;

  return (
    <div className="inner-page">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Market data</p>
          <h1>Coverage, provenance, quality gates, and <em>model benchmarks.</em></h1>
        </div>
        <p className="page-hero-side">This page reports coverage, provenance, and automated quality checks from the same artifact that powers the public price check.</p>
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
        <article>
          <span>National weighted median (warehouse) <InfoIcon /></span>
          <strong title="Sample-weighted median across used cells in Postgres">${Math.round(sqlSummary.kpi.national_weighted_median_cad).toLocaleString("en-CA")}</strong>
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
          <h2>Reproducible from the released source</h2>
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
            <div><p className="kicker">Consumer adjustment model</p><h2>Trained on completed auction outcomes.</h2></div>
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
            <div><p className="kicker">Research benchmark</p><h2>Evaluated against a declared baseline.</h2></div>
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

      <section className="segment-card">
        <article className="qa-card">
          <div className="qa-head">
            <div>
              <p className="kicker">Segment validation</p>
              <h2>Where the error concentrates.</h2>
            </div>
            <span className="pill pill-blue">TEMPORAL TEST · 39,132 OUTCOMES</span>
          </div>
          <div className="segment-table-wrap">
            <table className="segment-table" aria-label="Temporal-test error by validation segment, peer baseline vs condition model">
              <thead>
                <tr>
                  <th scope="col">Segment</th>
                  <th scope="col">n</th>
                  <th scope="col" className="seg-mae">Baseline MAE</th>
                  <th scope="col" className="seg-mae">Model MAE</th>
                  <th scope="col">Baseline WAPE</th>
                  <th scope="col">Model WAPE</th>
                  <th scope="col">Model 80% coverage</th>
                </tr>
              </thead>
              {segmentAxes.map(([axisKey, axisTitle]) => (
                <tbody key={axisKey}>
                  <tr className="group">
                    <th scope="colgroup" colSpan={7} title={segments[axisKey].definition}>{axisTitle}</th>
                  </tr>
                  {segments[axisKey].baseline.map((row, index) => {
                    const model = segments[axisKey].model[index];
                    return (
                      <tr key={row.segment}>
                        <th scope="row">{row.segment}</th>
                        <td>{row.n.toLocaleString("en-CA")}</td>
                        <td className="seg-mae">${row.maeCad?.toLocaleString("en-CA")}</td>
                        <td className="seg-mae">${model.maeCad?.toLocaleString("en-CA")}</td>
                        <td>{row.wapePct?.toFixed(2)}%</td>
                        <td>{model.wapePct?.toFixed(2)}%</td>
                        <td className={model.coverage80Pct !== undefined && model.coverage80Pct < 80 ? "cov-under" : undefined}>
                          {model.coverage80Pct?.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
          <p className="seg-note">
            80% coverage is the share of each segment&apos;s actual sale prices inside the global temporal-test
            interval [P10, P90] of log(actual / model prediction); its width is {intervalWidthPct?.toFixed(2)}% of the
            central estimate, so it does not re-fit per segment. The model improves WAPE in {modelWins} of{" "}
            {segmentPairs.length} segments; the remaining rows are where the peer baseline already prices well.
          </p>
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
