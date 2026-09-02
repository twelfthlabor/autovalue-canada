# Vehicle-level valuation model plan

## Product target

The product should estimate a vehicle's likely current completed-sale price in Canada and publish a calibrated prediction interval. It should not claim to reveal a single unknowable “true value.” A separate output can estimate the current dealer asking market when sold-price data is unavailable.

The consumer result stays on one valuation sheet: point estimate, likely range, seller-ask gap, confidence, comparable evidence and a factor-coverage ledger. A factor that the model does not price must remain visibly labelled as unpriced.

## Recommended approach

Use a hybrid comparable-plus-ML system, not a neural network and not a hand-authored adjustment table.

1. Retrieve recent comparable vehicles with the same make/model generation and similar geography, age and specification.
2. Train a gradient-boosted tree model on row-level outcomes. The prototype uses scikit-learn gradient boosting for a compact browser artifact; a licensed production table may justify CatBoost or LightGBM for sparse categorical features and richer interactions.
3. Predict the residual from a local comparable anchor, or blend the comparable estimate with the global model according to comparable density.
4. Calibrate P10/P50/P90 outputs on a held-out time period. Conformal calibration is preferred when enough representative validation data exists.
5. Apply explicit abstention rules when the vehicle is out of distribution, critical inputs are missing or recent local evidence is sparse.

## Required training row

One row must represent one vehicle listing or completed transaction, with a stable vehicle/listing identifier and observation time.

### Outcome

- completed sale or wholesale/auction price;
- transaction date;
- sale channel and province;
- dealer asking price and price history as separate features, never as the target substitute.

### Vehicle identity

- VIN-derived make, model, model year and generation;
- trim, body style, drivetrain, transmission, engine and fuel type;
- factory packages and material options;
- new-vehicle MSRP when available.

### Usage and condition

- odometer;
- accident count and severity, damage estimate and rebuilt/salvage status;
- service history and ownership count;
- mechanical/cosmetic inspection grades;
- tire, brake, battery and reconditioning condition;
- fleet, rental, commercial and lease history.

### Market context

- forward-sortation area or market region;
- listing date, days on market and season;
- seller type and channel;
- local comparable supply, price reductions and market velocity;
- fees kept separate from vehicle price.

## Leakage-safe validation

- Split by time: train on the past and test on later sales.
- Group repeated listings and price changes for the same VIN into one fold.
- Keep dealer duplicates and relisted vehicles together.
- Report MAE and median absolute percentage error by price band, province, age, make/model and evidence density.
- Measure P10–P90 interval coverage and width, not only point accuracy.
- Compare against simple baselines: local median, depreciation curve and nearest-comparable regression.
- Run a final untouched backtest and publish the data cutoff.

## Release gates

Do not call the output a vehicle-level estimate until all of these are true:

- licensed row-level Canadian inventory is available;
- completed-sale or auction outcomes are available for the intended target;
- condition/history/options have measurable coverage;
- temporal validation beats the local-comparable baseline materially;
- prediction intervals are calibrated by major segment;
- drift, missingness and out-of-distribution monitoring are live;
- the UI abstains instead of filling missing factors with invented adjustments.

## Current release boundary

Release 0.3 implements the hybrid architecture as a research-grade prototype:

1. A current Canadian asking-market anchor comes from reviewed trim-level comparables when available, or a published province × make × model × year aggregate cell.
2. A gradient-boosted residual model is trained on 91,278 completed historical US wholesale auction outcomes. Close-peer matching controls sale year, auction, vehicle year, make, model and VIN-derived trim code before the model learns condition-grade and odometer effects.
3. Six visible consumer condition inputs are consolidated into the auction-grade feature, and the relative model adjustment is applied around the current Canadian anchor.
4. The estimate, empirical range, listing gap, model metrics and factor ledger fit on one valuation sheet.

The implementation does not satisfy the production release gates above. It lacks licensed Canadian retail outcomes, separately learned accident/mechanical/service effects, calibrated Canadian interval coverage, complete options and transaction-channel fields, and live drift monitoring. Accordingly, the UI calls the output a condition-aware market estimate—not a known transaction price—and recommends an inspection and history report.
