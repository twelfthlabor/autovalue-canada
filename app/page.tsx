import { ValuationWorkbench } from "@/components/valuation-workbench";

const facts = [
  ["624,678", "vehicles in the source snapshot"],
  ["12", "provinces and territories"],
  ["P10–P90", "observed market distribution"],
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="eyebrow"><span /> Canadian used-vehicle evidence</div>
        <div className="hero-grid">
          <div>
            <h1 aria-label="See the market behind the asking price.">
              <span>See the market</span>
              <span>behind the</span>
              <em>asking price.</em>
            </h1>
          </div>
          <div className="hero-copy">
            <p>Decode a VIN, recover reviewed listing evidence and compare its ask with mileage-adjusted matches. No mystery score—just the target, range, sample and caveats behind the deal signal.</p>
            <a className="text-link" href="#check">Check a listing <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <div className="hero-instrument" aria-hidden="true">
          <div className="instrument-rule"><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <div className="instrument-line"><span>LOWER</span><b /><span>TYPICAL MARKET</span><b /><span>UPPER</span></div>
        </div>
        <div className="fact-strip">
          {facts.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
        </div>
      </section>

      <section className="workbench-section" id="check">
        <div className="section-intro">
          <span className="section-number">01</span>
          <div>
            <p className="kicker">PRICE CHECK</p>
            <h2>Bring the listing.<br />We’ll bring the context.</h2>
          </div>
          <p>Choose manually or decode a VIN. Matched listings produce a mileage-adjusted target; every other supported vehicle gets a clearly labelled broad-market fallback.</p>
        </div>
        <ValuationWorkbench />
      </section>

      <section className="principles">
        <div className="section-intro compact">
          <span className="section-number">02</span>
          <div><p className="kicker">BUILT FOR SCRUTINY</p><h2>The useful answer includes its limits.</h2></div>
        </div>
        <div className="principle-grid">
          <article><span>01</span><h3>Range over theatre</h3><p>We publish observed quartiles and deciles instead of dressing up a rough estimate as an exact value.</p></article>
          <article><span>02</span><h3>Evidence on the label</h3><p>Every result shows its sample size, geography, mileage benchmark and source-retrieval date.</p></article>
          <article><span>03</span><h3>Claims stay in their lane</h3><p>Dealer asking prices are not completed transactions. This release does not pretend otherwise.</p></article>
        </div>
      </section>
    </>
  );
}
