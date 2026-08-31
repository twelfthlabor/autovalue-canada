import { PriceAnatomy } from "@/components/price-anatomy";

export default function CalculationPage() {
  return (
    <div className="calculation-page">
      <header className="calculation-hero">
        <div><p className="eyebrow"><span /> How we calculate it</p><h1>Here is the price.<br /><em>Here is every</em><br />assumption.</h1></div>
        <div className="calculation-hero-copy"><span>WHAT “TRUE PRICE” MEANS HERE</span><p>A completed transaction price cannot be known before a vehicle sells. Our defensible target is the current mileage-adjusted asking price implied by closely matched public listings—shown with its observed error, sample size and exclusions.</p></div>
      </header>

      <PriceAnatomy />

      <section className="calculation-boundaries">
        <article><span>WHAT THE MODEL CONTROLS</span><h2>Identity + mileage.</h2><p>The worked example matches year, 340i trim, xDrive, sedan body and automatic transmission, then learns the mileage effect from those listings.</p></article>
        <article><span>WHAT THE RANGE MEANS</span><h2>Observed model error.</h2><p>The interval is the fitted target plus or minus one residual RMSE. It describes scatter in this small asking-price sample; it is not a guaranteed sale interval.</p></article>
        <article><span>WHAT STILL NEEDS A HUMAN</span><h2>Condition + history.</h2><p>Damage, options, inspection findings, taxes, fees and negotiation can materially change value. A low-price opportunity is also a prompt for deeper due diligence.</p></article>
      </section>
    </div>
  );
}
