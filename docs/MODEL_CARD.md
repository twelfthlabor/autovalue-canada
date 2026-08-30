# Current-market median benchmark model card

## Status

Research-only. This benchmark is not used to generate the consumer result in release 0.1.

## Intended purpose

Demonstrate a reproducible supervised-learning evaluation on the Canadian aggregate market dataset. The target is the published median dealer asking price for a province × make × model × model-year cell.

It is **not** an individual appraisal, completed transaction-price estimator or future residual-value forecast.

## Dataset

- 5,605 used-vehicle aggregate market cells.
- 180,833 vehicles represented by those cells.
- One current Canadian commercial-inventory snapshot.
- Price cells with fewer than 10 vehicles are suppressed upstream.

## Features

- Province and make.
- Vehicle age relative to snapshot year.
- Log median mileage.
- Median days on market.
- Log market-cell sample size.

Model name is deliberately excluded from the benchmark features because validation holds out complete make-model groups. This asks a conservative question: can the model generalize to a model line it did not see during training?

## Validation design

Five-fold `GroupKFold` validation. The group is make × model, and groups never cross the training/test boundary. Metrics are calculated out-of-fold and weighted by the number of vehicles represented by each market cell.

The declared baseline predicts the training-fold global median on the log-price scale. Reported metrics include weighted MAE, weighted absolute percentage error, median absolute error, median absolute percentage error and weighted R².

## Model

Histogram gradient boosting on log price, with one-hot encoded province/make and standardized numeric inputs. The pipeline fixes its random state at 42.

## Limitations

- A single snapshot cannot measure temporal generalization or depreciation.
- Aggregate medians erase trim, condition and within-cell vehicle variation.
- Dealer asking price is not sale price.
- Sample weights improve fleet-level interpretation but make large provinces and common models more influential.
- Group holdout is intentionally harsh and differs from predicting a new year of a previously observed model.

## Reproduce

```bash
python -m pip install -r requirements.txt
python analysis/train_benchmark.py
```

The resulting artifact is written to `public/data/model-metrics.json` for the Market Lab page.
