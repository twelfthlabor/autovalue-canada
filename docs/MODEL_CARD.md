# Hybrid valuation model card

## Status and intended use

The consumer result is a production prototype for evaluating a Canadian dealer asking price. It combines a current Canadian market anchor with a learned relative condition and odometer adjustment.

It is not a certified appraisal, guaranteed offer, future residual forecast or direct prediction of a current Canadian retail transaction. A vehicle has no observable single “true price” before a buyer and seller complete a transaction.

## Stage 1: current Canadian market anchor

The preferred anchor is a mileage-adjusted ordinary-least-squares fit over reviewed trim, drivetrain and transmission matches, with the subject listing excluded. When those comparables are unavailable, the anchor is the median of a published province × make × model × model-year used-inventory cell. Its source distribution supplies the initial uncertainty range.

The public release contains 5,605 Canadian market cells representing 180,833 dealer vehicles. These are advertised prices, not sale outcomes.

## Stage 2: condition and odometer model

### Training data

- 91,278 eligible completed wholesale auction outcomes from the Larsen (2020) NBER research dataset.
- United States auctions from 2006–2010.
- A peer group fixes sale year, auction, vehicle year, make, model and VIN-derived trim code.
- Every training subject requires at least eight close peers and at least two observed condition grades.
- The subject is removed from its peer-price calculation.

### Target and features

The target is:

`log(completed sale price / leave-one-out matched-peer geometric price)`

The two learned features are auction condition score and log odometer difference from the peer median. Gradient-boosted regression trees with Huber loss estimate the residual. A monotonic guard prevents a grade above Average from receiving less value than Average at the same mileage.

The consumer form collects six signals: overall grade, accident/title history, mechanical state, cosmetic state, service history and tire/brake wear. Because the training data contains an auction inspection grade rather than six separately structured fields, the six selections are transparently consolidated into one bounded auction-grade equivalent. The mapping controls the model input; it is not a table of invented dollar discounts.

The transferred adjustment is centred on an Average vehicle at the anchor mileage. This prevents the historical auction intercept from being counted again in a Canadian anchor that already represents a mix of used-car conditions.

## Temporal validation

Training uses sale years 2006–2008. The untouched temporal test uses 2009–2010.

| Metric | Peer-only baseline | Gradient boosting |
|---|---:|---:|
| Outcomes | 39,132 | 39,132 |
| MAE | $1,251.88 | $1,198.19 |
| Median absolute error | $897.05 | $884.56 |
| WAPE | 12.121% | 11.601% |

MAE improves 4.29% over the leave-one-out matched-peer baseline after applying the same Average-grade centering used in the browser. The consumer range combines the Canadian anchor range with the model's temporal-test P10/P90 log-residuals. It is an empirical model range, not a formally calibrated Canadian coverage guarantee.

## Inference and reproducibility

The trainer serializes the gradient-boosted tree nodes to `public/data/condition-model.json`. A pure TypeScript evaluator runs those exact trees in the browser; no remote prediction service or secret is involved.

```bash
python -m pip install -r requirements.txt
npm run model:train-condition
```

The source archive SHA-256 is `7827d220499700868fec28e09288e67b7c35ae8235e9b13e486d123ae05008fa`, and the random state is fixed at 42.

## Limitations

- Training outcomes are historical US wholesale auctions, not current Canadian retail transactions.
- Accident, mechanical, cosmetic, service and wear effects are proxied through a composite grade; their individual dollar effects are not separately learned.
- Trim and drivetrain are priced only when reviewed matched comparables exist. The broad aggregate fallback does not contain those fields.
- Options, ownership count, regional transaction channel, inspection findings, fees and negotiation remain unpriced or unknown.
- User-entered condition can be mistaken or strategic. An independent inspection and history report remain essential.
- Clean and Extra Clean did not show a reliable residual premium over Average after close peer matching, so the model does not invent one.
- The completed transaction is the only ground truth for one specific car.

## Separate aggregate research benchmark

Market Lab also reports a research-only histogram-gradient-boosting benchmark on the Canadian aggregate cells. Five-fold `GroupKFold` holds out complete make × model groups and predicts published median dealer asking price from province, make, age, log mileage, days on market and sample size. It is not used in consumer predictions because aggregate medians erase trim and condition and one snapshot cannot test time generalization.

Reproduce it with:

```bash
npm run model:benchmark
```
