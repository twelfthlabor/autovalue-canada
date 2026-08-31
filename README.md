# AutoValue Canada

An evidence-first Canadian used-vehicle deal checker. AutoValue Canada helps a shopper spot asking-price opportunities using matched comparables, a visible mileage model and an honest fallback to broad province × make × model × year evidence—without pretending that an advertised price is a completed transaction or appraisal.

**[Open the live demo](https://autovalue-canada.vercel.app)** · [View the calculation](https://autovalue-canada.vercel.app/calculation) · [Inspect CI](https://github.com/twelfthlabor/autovalue-canada/actions)

## Why this project exists

Most portfolio price predictors return a single unexplained number from an old, foreign dataset. This project focuses on the harder work a production data scientist is accountable for:

- current and legally reusable Canadian data;
- explicit claim boundaries and uncertainty;
- reproducible ingestion and build-time quality gates;
- an accessible consumer decision experience;
- transparent sample size, provenance and model limitations;
- a deployment path that separates the public Vercel interface from future AWS data/ML workloads.

## Current release

Release 0.2 answers one defensible question:

> Is this asking price supported by recent comparable dealer inventory, after a transparent mileage adjustment?

The VIN-first flow validates format, decodes manufacturer-submitted specifications through the official NHTSA vPIC API and checks a time-stamped evidence registry for an exact public listing. When reviewed trim-level comparables exist, the app excludes the subject listing, fits asking price against odometer with ordinary least squares, and displays the mileage-adjusted target, residual-error range and listing-minus-target deal signal. The worked BMW VIN resolves to a real listing at $34,690 and a six-comparable target of $33,200 with a $30,700–$35,600 expected asking range.

For a valid VIN without an exact listing or matched comparables, the vehicle can still decode and the user can enter the seller's ask and odometer. The app uses a clearly labelled broad-market distribution only when its decoded identity maps to a published cell; it never substitutes a stale unrelated vehicle. It does **not** claim a completed transaction price, damage adjustment or future residual value.

The interactive **How we calculate** page plots every matched observation, fitted mileage line, error band, subject ask and model target. The Market Lab separately publishes a research benchmark: five-fold grouped cross-validation with complete make-model holdouts. Histogram gradient boosting reduces vehicle-weighted MAE by 45.2% versus a declared global-median baseline, while the remaining $8,026 MAE is shown plainly and keeps that aggregate research model out of the consumer result. See [MODEL_CARD.md](docs/MODEL_CARD.md).

## Data

The demo uses [OmniaAuto's Canadian Vehicle Market Aggregates](https://huggingface.co/datasets/OmniaAuto/canadian-vehicle-market-aggregates), licensed CC BY-NC 4.0. The source describes 624,678 dealer vehicles across 12 provinces and territories. Price cells with fewer than 10 vehicles are suppressed by the publisher.

The release artifact contains 5,605 used-vehicle price cells representing 180,833 vehicles. The source price file includes 530,585 new and used vehicles with published price statistics. The core price check remains usable if the VIN service is unavailable.

See [DATA_SOURCES.md](docs/DATA_SOURCES.md) for provenance, licence and limitations.

## Run locally

Requirements: Node.js 20.9 or later.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Quality and production checks:

```bash
npm run build:data
npm run model:benchmark
npm test
npm run lint
npm run build
npm run test:e2e
```

The data build fails on schema drift, duplicate market-cell keys, invalid numerics, samples below 10, non-positive prices or non-monotonic percentiles.

## Repository map

```text
app/                 Next.js routes and product surfaces
components/          Interactive valuation workbench
data/raw/            Attributed source snapshots
docs/                Product, data and architecture decisions
lib/                 Tested market-evidence logic
public/data/         Validated, compact release artifacts
scripts/             Reproducible data preparation
.github/workflows/   CI quality gates
```

## Vercel deployment

Import this repository in Vercel and use the default Next.js settings. `npm run build` regenerates and validates the market artifact before compiling the application. No environment variables are required for release 0.2.

The Vercel Hobby plan is appropriate only for this non-commercial portfolio demonstration, which also matches the dataset's non-commercial licence. A commercial deployment requires a commercial data licence and a paid hosting plan appropriate to its use.

## Roadmap

Features advance only after their evidence gate is satisfied:

1. Transport Canada recall context from the official first-party dataset/API.
2. NRCan fuel and EV operating-cost scenarios.
3. Licensed row-level inventory feed for general VIN-to-listing retrieval, matched-comparable coverage and time-based validation.
4. Licensed transaction or auction outcomes for sale-value estimates.
5. Historical cohorts for 12–36 month residual forecasting.
6. AWS S3/Glue/SageMaker/Lambda production mirror with drift and forecast QA monitoring.

## Licence

Application code is MIT licensed. Source data retains its original [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) licence and attribution. Do not use the included data artifact for commercial purposes.
