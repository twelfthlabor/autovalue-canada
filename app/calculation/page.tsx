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
          <p>A completed transaction price cannot be known before a vehicle sells. The output here is a current Canadian market anchor plus a relative condition and mileage adjustment trained on completed auctions. It is shown with uncertainty and exclusions.</p>
        </aside>
      </header>

      <PriceAnatomy />

      <section className="calculation-boundaries">
        <article>
          <i aria-hidden="true"><TargetIcon /></i>
          <div>
            <span>WHAT THE MODEL CONTROLS</span>
            <h2>Anchor + relative effect.</h2>
            <p>The live VIN decode identifies the year, make, model, and available specifications. Completed auction outcomes supply the relative condition and odometer adjustment applied to the selected Canadian market cell.</p>
          </div>
        </article>
        <article>
          <i aria-hidden="true"><CurveIcon /></i>
          <div>
            <span>WHAT THE RANGE MEANS</span>
            <h2>How the range is built.</h2>
            <p>The range starts with the matched-market error and adds residuals from the later-year condition model. Both sources come from measured model error. Neither is a guarantee that the final sale price falls inside the range.</p>
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
