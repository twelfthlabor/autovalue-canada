# AutoValue Canada

An evidence-first Canadian used-vehicle market explorer. AutoValue Canada helps a shopper understand where a dealer's asking price sits within an observed province × make × model × model-year market—without pretending that a listing price is a completed transaction or an appraisal.

## Why this project exists

Most portfolio price predictors return a single unexplained number from an old, foreign dataset. This project focuses on the harder work a production data scientist is accountable for:

- current and legally reusable Canadian data;
- explicit claim boundaries and uncertainty;
- reproducible ingestion and build-time quality gates;
- an accessible consumer decision experience;
- transparent sample size, provenance and model limitations;
- a deployment path that separates the public Vercel interface from future AWS data/ML workloads.

## Current release

Release 0.1 answers one defensible question:

> Where does this asking price sit within observed Canadian dealer inventory for the exact province, make, model and model year?

It displays the observed median, middle 50%, middle 80%, approximate asking-price percentile, sample size, median odometer and median days on market. It does **not** claim to estimate a transaction price, vehicle condition adjustment or future residual value.

The Market Lab also publishes a separate research benchmark: five-fold grouped cross-validation with complete make-model holdouts. Histogram gradient boosting reduces vehicle-weighted MAE by 45.2% versus a declared global-median baseline, while the remaining $8,026 MAE is shown plainly and keeps the model out of the consumer result. See [MODEL_CARD.md](docs/MODEL_CARD.md).

## Data

The demo uses [OmniaAuto's Canadian Vehicle Market Aggregates](https://huggingface.co/datasets/OmniaAuto/canadian-vehicle-market-aggregates), licensed CC BY-NC 4.0. The source describes 624,678 dealer vehicles across 12 provinces and territories. Price cells with fewer than 10 vehicles are suppressed by the publisher.

The release artifact contains 5,605 used-vehicle price cells representing 180,833 vehicles. The source price file includes 530,585 new and used vehicles with published price statistics.

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

Import this repository in Vercel and use the default Next.js settings. `npm run build` regenerates and validates the market artifact before compiling the application. No environment variables are required for release 0.1.

The Vercel Hobby plan is appropriate only for this non-commercial portfolio demonstration, which also matches the dataset's non-commercial licence. A commercial deployment requires a commercial data licence and a paid hosting plan appropriate to its use.

## Roadmap

Features advance only after their evidence gate is satisfied:

1. Transport Canada recall context from the official first-party dataset/API.
2. NRCan fuel and EV operating-cost scenarios.
3. Licensed row-level listings for mileage/trim adjustments and time-based validation.
4. Licensed transaction or auction outcomes for sale-value estimates.
5. Historical cohorts for 12–36 month residual forecasting.
6. AWS S3/Glue/SageMaker/Lambda production mirror with drift and forecast QA monitoring.

## Licence

Application code is MIT licensed. Source data retains its original [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) licence and attribution. Do not use the included data artifact for commercial purposes.
