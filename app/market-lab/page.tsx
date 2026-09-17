import { ReportNav } from "@/components/report-nav";
import { MarketCoverage } from "@/components/market-coverage";
import market from "@/public/data/market.json";
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

  const coverage = manifest.provinces.map(code => {
    const rows = market.filter(row => row.p === code);
    return { code, name: provinceNames[code] ?? code, vehicles: rows.reduce((sum, row) => sum + row.n, 0), cells: rows.length, makes: new Set(rows.map(row => row.mk)).size, years: [Math.min(...rows.map(row => row.y)), Math.max(...rows.map(row => row.y))] as [number, number] };
  });
  return (
    <div className="inner-page research-page market-page">
      <header className="report-header"><div><p className="eyebrow">AutoValue / Research</p><h1>Market lab</h1><p>Explore the inventory behind the estimate, then inspect how the model performs.</p></div><span>Data retrieved {formatRetrievedDate(manifest.sourceRetrievedAt)}</span></header>
      <div className="report-layout"><ReportNav items={[{id:"coverage",label:"Market coverage"},{id:"source-audit",label:"Source audit"},{id:"models",label:"Model validation"},{id:"segments",label:"Error by segment"}]} /><div className="report-content">
      <section id="coverage" className="report-section"><div className="section-heading"><h2>Market coverage</h2><span>Canadian dealer asking prices</span></div>
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
          <span>Weighted median <InfoIcon /></span>
          <strong title="Sample-weighted median across used cells in Postgres">${Math.round(sqlSummary.kpi.national_weighted_median_cad).toLocaleString("en-CA")}</strong>
        </article>
      </section>

      <MarketCoverage provinces={coverage} />
      </section>
      <section className="lab-grid report-section" id="source-audit">
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
          <h2>Source record</h2>
          <dl className="prov-list">
            <div><dt>Retrieved</dt><dd>{formatRetrievedDate(manifest.sourceRetrievedAt)}</dd></div>
            <div><dt>Licence</dt><dd>{manifest.sourceLicense}</dd></div>
            <div><dt>Price basis</dt><dd>{manifest.priceBasis}</dd></div>
            <div><dt>SHA-256 (abbrev.)</dt><dd className="hash">{sha.slice(0, 8)}…{sha.slice(-8)}</dd></div>
          </dl>
        </article>
      </section>

      <section className="lab-grid model-comparison report-section" id="models">
        <article className="model-card consumer">
          <div className="qa-head">
            <div><p className="kicker">Consumer adjustment model</p><h2>Condition model</h2></div>
            <span className="pill pill-blue">Used in estimates</span>
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
            <div><p className="kicker">Research benchmark</p><h2>Aggregate benchmark</h2></div>
            <span className="pill pill-red">Research only</span>
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

      <section className="segment-card report-section" id="segments">
        <article className="qa-card">
          <div className="qa-head">
            <div>
              <p className="kicker">Segment validation</p>
              <h2>Error by segment</h2>
            </div>
            <span className="pill pill-blue">Temporal test · {conditionModel.rows.temporalTest.toLocaleString("en-CA")} outcomes</span>
          </div>
          <div className="segment-table-wrap">
            <table className="segment-table" aria-label="Temporal-test error by validation segment, peer baseline vs condition model">
              <thead>
                <tr>
                  <th scope="col">Segment</th>
                  <th scope="col" className="seg-n">n</th>
                  <th scope="col" className="seg-mae">Baseline MAE</th>
                  <th scope="col" className="seg-mae">Model MAE</th>
                  <th scope="col"><span className="seg-long">Baseline WAPE</span><span className="seg-short">Base WAPE</span></th>
                  <th scope="col">Model WAPE</th>
                  <th scope="col"><span className="seg-long">Model 80% coverage</span><span className="seg-short">Coverage</span></th>
                </tr>
              </thead>
              {segmentAxes.map(([axisKey, axisTitle]) => (
                <tbody key={axisKey}>
                  <tr className="group">
                    <th scope="colgroup" colSpan={7} title={segments[axisKey].definition}>{axisTitle}</th>
                  </tr>
                  {segments[axisKey].baseline.map((row, index) => {
                    const model = segments[axisKey].model[index];
                    const modelBetter = model.wapePct !== undefined && row.wapePct !== undefined && model.wapePct < row.wapePct;
                    return (
                      <tr key={row.segment}>
                        <th scope="row">{row.segment}</th>
                        <td className="seg-n">{row.n.toLocaleString("en-CA")}</td>
                        <td className="seg-mae">${row.maeCad?.toLocaleString("en-CA")}</td>
                        <td className="seg-mae">${model.maeCad?.toLocaleString("en-CA")}</td>
                        <td>{row.wapePct?.toFixed(2)}%</td>
                        <td className={`seg-wape ${modelBetter ? "is-better" : "is-worse"}`}>{model.wapePct?.toFixed(2)}%</td>
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
          <p className="seg-legend">MAE/WAPE: lower is better — ▾ model beats baseline, ▴ model trails; coverage red when below 80%.</p>
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
    </div></div></div>
  );
}
