# AutoValue Canada

A transparent Canadian used-vehicle deal checker. It compares a seller's asking price with current Canadian dealer inventory, then adjusts the market estimate for mileage and user-reported condition.

[Live demo](https://autovalue-canada.vercel.app) · [Calculation](https://autovalue-canada.vercel.app/calculation) · [CI](https://github.com/twelfthlabor/autovalue-canada/actions)

## How it works

1. Select a province, make, model and year, then enter the asking price and odometer.
2. Optionally decode a VIN and describe the vehicle's condition and history.
3. Review the estimated value, range, difference from the asking price, evidence strength and unpriced factors.

The estimate combines:

- a province × make × model × year median from Canadian dealer asking prices; and
- a browser-based gradient-boosted model that applies relative mileage and condition adjustments.

VIN decoding uses the official NHTSA vPIC API. A VIN is sent only after the user clicks **Decode VIN**, is kept out of the URL and is not stored. The app has no live listing feed, so asking price, odometer and condition are entered by the user.

## Data and limitations

The included market artifact contains 5,605 used-vehicle cells representing 180,833 vehicles from [OmniaAuto's Canadian Vehicle Market Aggregates](https://huggingface.co/datasets/OmniaAuto/canadian-vehicle-market-aggregates). These are dealer asking prices, not completed sales. Cells with fewer than 10 vehicles are excluded.

The adjustment model was trained on 91,278 historical US wholesale auction sales. On a later-year test set of 39,132 sales, it reached $1,198 MAE and 11.60% WAPE. The model runs locally in the browser; no prediction service or API key is required.

Results are market estimates, not certified appraisals, guaranteed offers or future-value forecasts. Trim, options, inspection findings, fees and the final negotiated price may not be captured. See the [model card](docs/MODEL_CARD.md) and [data sources](docs/DATA_SOURCES.md) for methodology, provenance and full limitations.

## Run locally

Requires Node.js 20.9 or later.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. No credentials or environment variables are required.

## Verify

```bash
npm run build:data
npm test
npm run lint
npm run build
npm run test:e2e
```

Model training is optional and requires Python dependencies:

```bash
python -m pip install -r requirements.txt
npm run model:benchmark
npm run model:train-condition
```

The data build rejects schema changes, duplicate market cells, invalid values, samples below 10 and unordered price percentiles.

## Project structure

```text
app/          Pages and VIN decode route
components/   Valuation interface
lib/          Market, VIN and model logic
analysis/     Model training and evaluation
data/raw/     Attributed source snapshots
public/data/  Validated release artifacts
scripts/      Data preparation
docs/         Architecture, methodology and data notes
```

## Deployment

Import the repository into Vercel with the default Next.js settings. The production build regenerates and validates the market artifact before compiling the app.

## Licence

Application code is MIT licensed. The included market data retains its [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) licence and is not licensed for commercial use.
