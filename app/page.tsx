import { ValuationWorkbench } from "@/components/valuation-workbench";
import { HeroVisual } from "@/components/hero-visual";
import manifest from "@/public/data/manifest.json";
import conditionModel from "@/public/data/condition-model.json";

const heroMae = Math.round(conditionModel.validation.model.maeCad).toLocaleString("en-CA");

const heroTickerItems = [
  `${manifest.usedMarketCells.toLocaleString("en-CA")} market cells`,
  `${manifest.usedVehiclesRepresented.toLocaleString("en-CA")} vehicles represented`,
  `US wholesale temporal-test MAE $${heroMae}`,
  `${manifest.provinces.length} provinces covered`,
  "Dealer asking-price basis",
  "Prices in CAD",
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <h1>
              See the market behind the <em>asking price.</em>
            </h1>
            <p>
              We model Canadian dealer asking prices using real listings, auction outcomes, and adjustment
              science. Use the workbench to see the evidence and its limits.
            </p>
            <a className="hero-cta" href="#check">
              Check this price <span aria-hidden="true">→</span>
            </a>
          </div>
          <HeroVisual />
        </div>
        <div className="hero-ticker">
          <div className="hero-ticker-track">
            <div className="hero-ticker-group">
              {heroTickerItems.map((item) => (
                <span className="hero-ticker-item" key={item}>
                  <span className="hero-ticker-dot" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
            <div className="hero-ticker-group" aria-hidden="true">
              {heroTickerItems.map((item) => (
                <span className="hero-ticker-item" key={item}>
                  <span className="hero-ticker-dot" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="workbench-section" id="check">
        <ValuationWorkbench />
      </section>

      <section className="principles">
        <div className="principle-grid">
          <article><span>01</span><h3>Range over theatre</h3><p>We publish a model range instead of dressing up an uncertain estimate as an exact answer.</p></article>
          <article><span>02</span><h3>Evidence on the label</h3><p>Every result shows the Canadian anchor, ML adjustment, sample strength and temporal-test error.</p></article>
          <article><span>03</span><h3>Claims stay in their lane</h3><p>Historical wholesale effects do not turn a dealer asking anchor into a known transaction price.</p></article>
        </div>
      </section>
    </>
  );
}
