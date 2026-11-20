# AutoValue Canada

Is this used car fairly priced? AutoValue Canada compares a seller's asking price with current Canadian dealer inventory for the same province, make, model and year, then adjusts for mileage and condition with a gradient-boosted model that runs in the browser.

[Live demo](https://autovalue-canada.vercel.app) · [Calculation](https://autovalue-canada.vercel.app/calculation) · [Model card](docs/MODEL_CARD.md) · [CI](https://github.com/twelfthlabor/autovalue-canada/actions)

## Results

| What | Number |
|---|---|
| Canadian market coverage | 5,605 province × make × model × year cells, 180,833 dealer-listed vehicles |
| Adjustment model, temporal test (39,132 auction sales) | $1,198 MAE, 11.60% WAPE; 4.29% better than a matched-peer baseline |
| Canadian cross-province check (4,609 held-out cells) | full mileage effect $2,961 MAE vs $2,236 without it; cross-validated scale 0.2 gives $2,142 |

The last row is the honest one: the mileage effect was learned from US auction sales, and on Canadian cell medians it is about five times too steep. The [model card](docs/MODEL_CARD.md#canadian-cross-province-check) explains why the shipped estimate is not shrunk on that evidence alone.

## How it works

1. Pick a province, make, model and year, then enter the asking price and odometer. A listing link from AutoTrader.ca, Kijiji.ca, Carpages.ca or Clutch.ca can prefill these where the site allows a fetch.
2. Optionally decode a VIN (official NHTSA vPIC API, sent only on click, never stored) and pick a condition tier.
3. Read the estimate, its range, the gap to the asking price and how strong the evidence is.

The estimate starts from the median dealer asking price for the matching cell ([OmniaAuto Canadian Vehicle Market Aggregates](https://huggingface.co/datasets/OmniaAuto/canadian-vehicle-market-aggregates); cells under 10 vehicles excluded). The model trees are serialized to JSON and evaluated by a small TypeScript function, so there is no prediction server or API key.

Checks can be saved in the browser, restored or shared as a link. Research pages cover provincial coverage, methodology and an interactive calculation breakdown.

## Limitations

These are dealer asking prices, not completed sales. The condition and mileage model was fit on 52,146 US wholesale auction sales from 2006–2008 and tested on 39,132 from 2009–2010. Results are market estimates, not appraisals or offers; trim, options, inspection findings and fees may not be captured. See [data sources](docs/DATA_SOURCES.md) for provenance.

## Run locally

Requires Node.js 20.9 or later. No credentials or environment variables are needed.

```bash
npm ci
npm run dev
```

## Verify

```bash
npm test          # unit tests, including the pinned Canadian check
npm run lint
npm run build     # regenerates and validates the market artifact first
npm run test:e2e  # Playwright, Chromium and WebKit
```

The data build rejects schema changes, duplicate market cells, invalid values, samples below 10 and unordered price percentiles. Model retraining is optional:

```bash
python -m pip install -r requirements.txt
npm run model:benchmark
npm run model:train-condition
```

The same CSVs also load into a PostgreSQL 16 warehouse for SQL analytics; see [docs/WAREHOUSE.md](docs/WAREHOUSE.md).

## Project structure

```text
app/          Pages and VIN decode route
components/   Valuation interface
lib/          Market, VIN, model and Canadian-check logic
analysis/     Model training, Postgres ETL and warehouse SQL
data/raw/     Attributed source snapshots
public/data/  Validated release artifacts
scripts/      Data preparation
docs/         Architecture, model card, data sources and design notes
```

## Deployment

Import the repository into Vercel with the default Next.js settings.

## Licence

Application code is [MIT licensed](LICENSE). The included market data keeps its [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) licence and is not licensed for commercial use.
