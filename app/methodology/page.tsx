import Link from "next/link";
import conditionModel from "@/public/data/condition-model.json";
import modelMetrics from "@/public/data/model-metrics.json";
import manifest from "@/public/data/manifest.json";
import pkg from "../../package.json";
import { formatRetrievedDate } from "@/lib/market";
import { ReportNav } from "@/components/report-nav";

const [trainYears, testYears] = [...conditionModel.validation.split.matchAll(/(\d{4})-(\d{4})/g)].map(match => `${match[1]}–${match[2]}`);
const contents = [{id:"scope",label:"What the estimate means"},{id:"model-benchmark",label:"How the model works"},{id:"data-sources",label:"Data sources"},{id:"aggregate-benchmark",label:"Research benchmark"},{id:"limitations",label:"Limits & next steps"}];

export default function MethodologyPage() {
  return <div className="inner-page research-page methodology-page">
    <header className="report-header"><div><p className="eyebrow">AutoValue / Research</p><h1>Methodology</h1><p>The data, model and assumptions behind a price check.</p></div><span>Release {pkg.version} · {formatRetrievedDate(manifest.sourceRetrievedAt)}</span></header>
    <div className="report-layout"><ReportNav items={contents} /><div className="report-content reading-content">
      <section className="report-section" id="scope">
        <p className="section-label">The estimate</p><h2>A reference for an asking price.</h2>
        <p className="reading-lead">AutoValue starts with Canadian dealer asking prices, then adjusts for the condition and mileage you enter. It helps put a listing in context before you inspect the vehicle.</p>
        <div className="scope-callout"><h3>Claim boundary</h3><p>The result is an estimate of the asking market. It does not establish a completed transaction price, certified appraisal, recommended offer or future resale value.</p></div>
        <dl className="method-definitions"><div><dt>Market value</dt><dd>The matched Canadian median plus a relative condition and mileage adjustment.</dd></div><div><dt>Predicted range</dt><dd>The Canadian asking-price spread combined with residuals from the model’s held-out test. Canadian transaction coverage has not been verified.</dd></div><div><dt>Minimum evidence</dt><dd>At least {manifest.quality.minimumCellSize} dealer listings for the same province, make, model and year.</dd></div></dl>
      </section>
      <section className="report-section" id="model-benchmark">
        <p className="section-label">Used in price checks</p><h2>How the model works</h2>
        <div className="method-flow"><div><span>Market reference</span><strong>Canadian listings</strong></div><b aria-hidden="true">+</b><div><span>Relative adjustment</span><strong>Condition &amp; mileage</strong></div><b aria-hidden="true">=</b><div><span>With uncertainty</span><strong>Estimated range</strong></div></div>
        <h3>Three condition tiers, one score</h3><p>The form offers three condition tiers because the auction panel resolves three effective condition levels: below average, rough, and average or better. Below average covers salvage, rebuilt, and branded-title vehicles, which the panel prices the same. Above-average grades are not distinguished by the panel, so the form does not offer them. Gradient-boosted trees learn the effect of that bounded score and the odometer reading as one relative adjustment, not a separate dollar amount per inspection detail.</p>
        <h3>Compared with similar vehicles</h3><p>The training set contains {conditionModel.rows.eligibleSoldOutcomes.toLocaleString("en-CA")} completed US wholesale outcomes. Peers match on sale year, auction, vehicle year, make, model and trim code, with each outcome excluded from its own peer anchor. The model predicts log sold price relative to that reference.</p>
        <h3>Tested on later outcomes</h3><p>Training uses {trainYears}; testing uses {conditionModel.rows.temporalTest.toLocaleString("en-CA")} outcomes from {testYears}. Average grade at the market median odometer is neutral in the deployed adjustment.</p>
        <dl className="validation-summary"><div><dt>Mean absolute error</dt><dd>${Math.round(conditionModel.validation.model.maeCad).toLocaleString("en-CA")}</dd></div><div><dt>Weighted percentage error</dt><dd>{conditionModel.validation.model.wapePct.toFixed(2)}%</dd></div><div><dt>MAE improvement vs peers</dt><dd>{conditionModel.validation.maeImprovementPct.toFixed(2)}%</dd></div></dl>
        <p className="reading-note">These are historical US wholesale results. They do not measure accuracy on Canadian retail transactions.</p><Link className="text-link" href="/market-lab#models">Inspect validation results →</Link>
      </section>
      <section className="report-section" id="data-sources"><p className="section-label">Provenance</p><h2>Data sources</h2>
        <div className="source-row"><span>Canadian reference</span><div><h3>OmniaAuto market aggregates</h3><p>{manifest.usedVehiclesRepresented.toLocaleString("en-CA")} used vehicles represented in {manifest.usedMarketCells.toLocaleString("en-CA")} published cells. The source reports dealer asking prices, grouped to protect privacy. Duplicate vehicles resolve to an originating seller.</p><a href={manifest.sourceUrl} target="_blank" rel="noreferrer">View source dataset ↗</a></div></div>
        <div className="source-row"><span>Usage</span><div><h3>{manifest.sourceLicense}</h3><p>This is a non-commercial research demonstration. The aggregate source permits research, teaching and other non-commercial use under its licence.</p><a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer">Read the licence ↗</a></div></div>
        <div className="source-row"><span>Release checks</span><div><h3>Validated before publication</h3><p>The build checks schema, numeric types, unique market-cell keys, minimum sample size, positive prices and ordered percentiles. Failed checks stop the build.</p><Link href="/market-lab#source-audit">Inspect the source audit →</Link></div></div>
      </section>
      <section className="report-section" id="aggregate-benchmark"><p className="section-label">Research only</p><h2>A separate aggregate benchmark</h2><p>This experiment predicts published median asking prices. It is evaluated separately and does not affect the price check.</p><p>Five-fold GroupKFold holds out complete make-model groups, so each validation fold contains vehicles absent from that fold’s training data. All reported scores are out-of-fold.</p><p>Weighted MAE improves {modelMetrics.maeImprovementVsBaselinePct.toFixed(1)}% over a training-fold global median. Its ${Math.round(modelMetrics.model.mae_cad).toLocaleString("en-CA")} MAE remains too high for individual appraisals.</p><Link className="text-link" href="/market-lab#models">View benchmark and fold errors →</Link></section>
      <section className="report-section" id="limitations"><p className="section-label">Open questions</p><h2>Limits &amp; next steps</h2><div className="roadmap-list"><div><span>BLOCKED</span><h3>Transaction-value estimates</h3><p>Require Canadian completed-sale data.</p></div><div><span>BLOCKED</span><h3>One-to-three-year resale forecasts</h3><p>Require outcomes for the same vehicles over time.</p></div><div><span>Planned</span><h3>Recall and operating-cost context</h3><p>Potential sources include Transport Canada recalls and NRCan fuel and EV ratings.</p></div></div></section>
    </div></div>
  </div>;
}
