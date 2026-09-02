import Link from "next/link";
import conditionModel from "@/public/data/condition-model.json";
import manifest from "@/public/data/manifest.json";
import pkg from "../../package.json";
import { formatRetrievedDate } from "@/lib/market";
import { CalendarIcon, BarsIcon, DollarIcon, ShieldIcon, AnchorIcon, PulseIcon, TargetIcon, LockIcon, ArrowRightIcon, TrendUpIcon, PercentIcon } from "@/components/icons";

const decisions = [
  ["What we show", "Condition-aware market value estimate, range, and seller-ask gap for the selected vehicle."],
  ["What we do not show", "Known transaction value, certified appraisal, recommended offer, or residual forecast."],
  ["Why the range", "Canadian asking-market spread in the anchor, plus relative condition and odometer effects from later-year models."],
  ["Minimum evidence", `A price cell is shown only when the Canadian anchor has n ≥ ${manifest.quality.minimumCellSize} dealer listings.`],
  ["Condition evidence", "Six condition selections form one auction-grade equivalent, not six learned dollar effects."],
] as const;

const [trainYears, testYears] = [...conditionModel.validation.split.matchAll(/(\d{4})-(\d{4})/g)].map((match) => `${match[1]}–${match[2]}`);

export default function MethodologyPage() {
  return (
    <div className="inner-page">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Methodology</p>
          <h1>A useful number should arrive with its <em>receipts.</em></h1>
          <p className="hero-lede">Every market claim stays inspectable: what it measures, how much evidence supports it and where it can be wrong.</p>
        </div>
        <aside className="hero-card release-card">
          <p className="kicker">Release {pkg.version}</p>
          <strong>Canadian anchor + condition ML</strong>
          <ul>
            <li><CalendarIcon /> Market data {formatRetrievedDate(manifest.sourceRetrievedAt)}</li>
            <li><BarsIcon /> {conditionModel.rows.eligibleSoldOutcomes.toLocaleString("en-CA")} completed outcomes</li>
            <li><DollarIcon /> Prices in CAD</li>
            <li><ShieldIcon /> Non-commercial research</li>
          </ul>
        </aside>
      </header>

      <section className="boundary-card">
        <h2 className="kicker">Claim boundary</h2>
        <p className="boundary-question">What condition-aware market value is supported by current Canadian evidence?</p>
        <p className="boundary-lead">This is a current asking-market anchor, adjusted by relative condition and odometer effect. It is not a promise of the completed transaction price.</p>
        <div className="decision-strip">
          {decisions.map(([title, copy], index) => (
            <article key={title}>
              <span className="decision-num">{String(index + 1).padStart(2, "0")}</span>
              <div><h3>{title}</h3><p>{copy}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="pipeline-row" aria-label="How the estimate is assembled">
        <article>
          <i className="pipe-icon" aria-hidden="true"><AnchorIcon /></i>
          <h3>Current Canadian anchor</h3>
          <p>{manifest.usedMarketCells.toLocaleString("en-CA")} province × make × model × year cells from dealer asking prices.</p>
          <span className="pipe-tag">SOURCE: OMNIAAUTO CANADIAN AGGREGATES</span>
        </article>
        <b className="pipe-arrow" aria-hidden="true">→</b>
        <article>
          <i className="pipe-icon" aria-hidden="true"><PulseIcon /></i>
          <h3>Condition + odometer model</h3>
          <p>{conditionModel.rows.eligibleSoldOutcomes.toLocaleString("en-CA")} completed US wholesale outcomes; close-peer matching; gradient-boosted residual. Average at anchor mileage is neutral.</p>
          <span className="pipe-tag">SOURCE: LARSEN NBER AUCTION OUTCOMES</span>
        </article>
        <b className="pipe-arrow" aria-hidden="true">→</b>
        <article>
          <i className="pipe-icon" aria-hidden="true"><TargetIcon /></i>
          <h3>Disclosed range</h3>
          <p>Combines the Canadian source spread with temporal-test residuals. Not guaranteed Canadian coverage.</p>
          <span className="pipe-tag">SCOPE: ASKING-MARKET ESTIMATE ONLY</span>
        </article>
      </section>

      <section className="validation-strip">
        <p className="kicker">Validation (temporal-test)</p>
        <div className="validation-row">
          <div className="v-item"><i aria-hidden="true"><CalendarIcon /></i><div><span>Train</span><strong>{trainYears}</strong></div></div>
          <div className="v-item"><i aria-hidden="true"><CalendarIcon /></i><div><span>Test</span><strong>{testYears}</strong></div></div>
          <div className="v-item"><i aria-hidden="true"><BarsIcon /></i><div><span>Held-out outcomes</span><strong>{conditionModel.rows.temporalTest.toLocaleString("en-CA")}</strong></div></div>
          <div className="v-item"><i aria-hidden="true"><PulseIcon /></i><div><span>MAE</span><strong>${Math.round(conditionModel.validation.model.maeCad).toLocaleString("en-CA")}</strong></div></div>
          <div className="v-item"><i aria-hidden="true"><PercentIcon /></i><div><span>WAPE</span><strong>{conditionModel.validation.model.wapePct.toFixed(2)}%</strong></div></div>
          <div className="v-item"><i aria-hidden="true"><TrendUpIcon /></i><div><span>vs peer baseline</span><strong>{conditionModel.validation.maeImprovementPct.toFixed(2)}% better</strong></div></div>
          <Link className="inspect-button" href="/market-lab">Inspect model metrics <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <section className="method-section" id="model-benchmark">
        <p className="kicker">CONDITION MODEL · USED IN RESULTS</p>
        <h2>Learn the residual only after matching close peers.</h2>
        <div className="method-columns">
          <div><h3>Outcome and target</h3><p>91,278 completed US wholesale outcomes are compared with leave-one-out peers matched on sale year, auction, vehicle year, make, model and trim code. The model predicts log sold price relative to that peer anchor.</p></div>
          <div><h3>Condition input</h3><p>Overall grade, accident/title, mechanical, cosmetic, service and wear selections form a bounded auction-grade equivalent. Gradient-boosted trees learn that composite grade and odometer effect; Average at anchor mileage is neutral.</p></div>
          <div><h3>Temporal test</h3><p>Training uses {trainYears.replace("–", "-")} and testing uses {conditionModel.rows.temporalTest.toLocaleString("en-CA")} outcomes from {testYears.replace("–", "-")}. With the deployed centering, MAE is ${Math.round(conditionModel.validation.model.maeCad).toLocaleString("en-CA")}, WAPE is {conditionModel.validation.model.wapePct.toFixed(2)}%, and MAE improves {conditionModel.validation.maeImprovementPct.toFixed(2)}% over the peer-only baseline. These are historical wholesale metrics, not Canadian retail accuracy.</p><Link className="text-link" href="/market-lab">Inspect the model metrics →</Link></div>
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

      <section className="method-section" id="aggregate-benchmark">
        <p className="kicker">MODEL CARD · RESEARCH ONLY</p>
        <h2>Grouped validation asks a harder, more honest question.</h2>
        <div className="method-columns">
          <div><h3>Target</h3><p>The published median dealer asking price for an aggregate province × make × model × year cell. The benchmark is evaluated separately from the consumer lookup and never changes a displayed source statistic.</p></div>
          <div><h3>Leakage control</h3><p>Five-fold GroupKFold validation holds out complete make-model groups. No make-model pair appears in both training and evaluation data within a fold. All reported scores are out-of-fold.</p></div>
          <div><h3>Result and limit</h3><p>Histogram gradient boosting reduces weighted MAE by 45.2% versus a training-fold global-median baseline, but its $8,026 MAE is not adequate for individual appraisals. That gap remains visible by design.</p><Link className="text-link" href="/market-lab">View metrics and fold errors →</Link></div>
        </div>
      </section>

      <section className="roadmap-section">
        <p className="kicker">Roadmap (data-gated)</p>
        <h2>Features are earned by data—not added by wishful thinking.</h2>
        <div className="gate-grid">
          <article className="blocked">
            <i className="gate-icon" aria-hidden="true"><LockIcon /></i>
            <div><span className="gate-label">BLOCKED</span><h3>Transaction-value estimate</h3><p>Needs Canadian completed-sale data.</p></div>
          </article>
          <article className="blocked">
            <i className="gate-icon" aria-hidden="true"><LockIcon /></i>
            <div><span className="gate-label">BLOCKED</span><h3>1–3 year residual forecast</h3><p>Needs longitudinal outcome panels.</p></div>
          </article>
          <article className="next">
            <i className="gate-icon" aria-hidden="true"><ArrowRightIcon /></i>
            <div><span className="gate-label">NEXT</span><h3>Safety recall context</h3><p>Transport Canada first-party recall data.</p></div>
          </article>
          <article className="next">
            <i className="gate-icon" aria-hidden="true"><ArrowRightIcon /></i>
            <div><span className="gate-label">NEXT</span><h3>Operating-cost context</h3><p>NRCan fuel and EV ratings.</p></div>
          </article>
        </div>
      </section>
    </div>
  );
}
