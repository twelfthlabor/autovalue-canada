import { PriceAnatomy } from "@/components/price-anatomy";
import { TargetIcon, CurveIcon, PersonIcon } from "@/components/icons";

export default function CalculationPage() {
  return (
    <div className="inner-page">
      <header className="page-hero">
        <div>
          <p className="eyebrow">How we calculate it</p>
          <h1>Here is the price.<br />Here is <em>every assumption.</em></h1>
        </div>
        <aside className="hero-card">
          <span>WHAT “TRUE PRICE” MEANS HERE</span>
          <p>A completed transaction price cannot be known before a vehicle sells. The defensible output is a current Canadian market anchor plus a transaction-trained relative condition and mileage adjustment—shown with uncertainty and exclusions.</p>
        </aside>
      </header>

      <PriceAnatomy />

      <section className="calculation-boundaries">
        <article>
          <i aria-hidden="true"><TargetIcon /></i>
          <div>
            <span>WHAT THE MODEL CONTROLS</span>
            <h2>Anchor + relative effect.</h2>
            <p>The live VIN decode identifies year, make, model and available specifications. Historical completed auctions then supply the relative condition and odometer adjustment around the selected Canadian market cell.</p>
          </div>
        </article>
        <article>
          <i aria-hidden="true"><CurveIcon /></i>
          <div>
            <span>WHAT THE RANGE MEANS</span>
            <h2>Two uncertainty sources.</h2>
            <p>The final range keeps the matched-market error and expands to include later-year condition-model residuals. It is empirical model uncertainty, not guaranteed sale coverage.</p>
          </div>
        </article>
        <article>
          <i aria-hidden="true"><PersonIcon /></i>
          <div>
            <span>WHAT STILL NEEDS A HUMAN</span>
            <h2>Inspection + negotiation.</h2>
            <p>User-entered condition is not a verified inspection. Options, hidden damage, taxes, fees and negotiation can materially change the completed price.</p>
          </div>
        </article>
      </section>
    </div>
  );
}
