# AutoValue Canada

An evidence-first Canadian used-vehicle deal checker. AutoValue Canada combines current Canadian asking-market evidence with a transaction-trained condition and mileage adjustment, while keeping the estimate, uncertainty and unpriced factors visible on one page.

**[Open the live demo](https://autovalue-canada.vercel.app)** · [View the calculation](https://autovalue-canada.vercel.app/calculation) · [Inspect CI](https://github.com/twelfthlabor/autovalue-canada/actions)

## Why this project exists

Most portfolio price predictors return a single unexplained number from an old, foreign dataset. This project focuses on the harder work a production data scientist is accountable for:

- current and legally reusable Canadian data;
- explicit claim boundaries and uncertainty;
- reproducible ingestion and build-time quality gates;
- an accessible consumer decision experience;
- transparent sample size, provenance and model limitations;
- a small, reproducible gradient-boosted model that runs locally in the browser;
- a deployment path that separates the public Vercel interface from future licensed data/ML workloads.

## Current release

Release 0.3 answers one defensible question:

> What condition-aware market value is supported by current Canadian evidence, and how far is the seller's ask from that estimate?

The VIN-first flow validates format and decodes manufacturer-submitted specifications through the official NHTSA vPIC API at request time. Asking price, odometer, options and inspection facts are never inferred from an embedded listing snapshot: users enter them directly until a licensed row-level inventory connector is configured. The model then uses a published province × make × model × year market cell and adjusts it with a gradient-boosted condition and mileage model.

The condition model was trained on 91,278 completed US wholesale auction outcomes from the Larsen (2020) NBER research dataset. It predicts the sold-price residual around a leave-one-out matched-peer anchor and is tested on later sale years: 39,132 temporal-test outcomes, $1,198 MAE, 11.60% WAPE and a 4.29% MAE improvement over the peer-only baseline. The serialized trees run in TypeScript with no prediction API or secret.

For a valid VIN without an exact listing or matched comparables, the vehicle can still decode and the user can enter the seller's ask, odometer and condition. The app uses a broad Canadian market distribution only when the identity maps to a published cell; it never substitutes a stale unrelated vehicle. The output is a **condition-aware market estimate**, not an observable “true price,” certified appraisal, current Canadian completed-sale prediction or future residual value. Historical US wholesale condition effects are transferred only as relative adjustments around current Canadian evidence.

The interactive **How we calculate** page documents the live data contract and each model stage. The Market Lab publishes both the consumer condition model's temporal test and a separate aggregate research benchmark. See [MODEL_CARD.md](docs/MODEL_CARD.md).

The primary checker presents the estimate, range, listing gap, evidence method and factor coverage on one consolidated valuation sheet. It explicitly distinguishes modelled inputs from context-only and unpriced factors. The path from this research-grade hybrid to a licensed Canadian transaction model is documented in [VALUATION_MODEL_PLAN.md](docs/VALUATION_MODEL_PLAN.md).

The interface review and the GitHub design skills/guidelines are recorded in [FRONTEND_REVIEW.md](docs/FRONTEND_REVIEW.md).

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
npm run model:train-condition
npm test
npm run lint
npm run build
npm run test:e2e
```

The data build fails on schema drift, duplicate market-cell keys, invalid numerics, samples below 10, non-positive prices or non-monotonic percentiles.

## Repository map

```text
app/                 Next.js routes and product surfaces
analysis/            Reproducible model training and evaluation
components/          Interactive valuation workbench
data/raw/            Attributed source snapshots
docs/                Product, data and architecture decisions
lib/                 Tested market-evidence logic
public/data/         Validated, compact release artifacts
scripts/             Reproducible data preparation
.github/workflows/   CI quality gates
```

## Vercel deployment

Import this repository in Vercel and use the default Next.js settings. `npm run build` regenerates and validates the market artifact before compiling the application. The checked-in condition-model artifact is deterministic and can be rebuilt with the separate Python command above. No environment variables are required for release 0.3.

The Vercel Hobby plan is appropriate only for this non-commercial portfolio demonstration, which also matches the dataset's non-commercial licence. A commercial deployment requires a commercial data licence and a paid hosting plan appropriate to its use.

## Roadmap

Features advance only after their evidence gate is satisfied:

1. Transport Canada recall context from the official first-party dataset/API.
2. NRCan fuel and EV operating-cost scenarios.
3. Licensed row-level Canadian inventory feed for general VIN-to-listing retrieval, trim/options coverage and time-based validation.
4. Licensed Canadian retail transactions with structured accident, inspection and reconditioning fields; retrain and calibrate by segment.
5. Historical cohorts for 12–36 month residual forecasting.
6. Drift, missingness, interval-coverage and out-of-distribution monitoring before commercial use.

## Licence

Application code is MIT licensed. Source data retains its original [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) licence and attribution. Do not use the included data artifact for commercial purposes.
