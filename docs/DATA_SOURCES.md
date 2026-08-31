# Data sources and accuracy contract

## Market prices: current release

| Item | Detail |
|---|---|
| Publisher | OmniaAuto |
| Dataset | Canadian Vehicle Market Aggregates |
| Source | https://huggingface.co/datasets/OmniaAuto/canadian-vehicle-market-aggregates |
| Retrieved | 2026-08-29 |
| Licence | CC BY-NC 4.0 |
| Price meaning | Dealer advertised price in CAD, not completed transaction price |
| Grain | Province × make × model × model year × condition |
| Privacy | Aggregates only; no VINs, sellers, addresses or listing URLs |
| Suppression | Price statistics are not published below 10 vehicles per cell |

The pipeline records a SHA-256 digest of the exact source file. The digest for this release is:

`93f41bf12ce1e79b452b8a47ba7d29b2fed090810c892ecd644fd63d05702c8e`

## Accuracy contract

“Accurate” means each displayed statistic reproduces the attributed source value for the selected market cell. It does **not** mean that the median equals the fair value of an individual vehicle.

The release build enforces:

- exact expected source columns;
- successful numeric parsing for every quantitative field;
- unique province/make/model/year/condition keys;
- at least 10 vehicles in every released cell;
- positive price percentiles;
- `p10 ≤ p25 ≤ median ≤ p75 ≤ p90`;
- explicit labels identifying asking prices and snapshot data.

## VIN decode and public-listing evidence

The VIN lookup is not a damage-record search. Format validation runs in the browser and confirms only length, permitted characters and the North American check digit. When the user explicitly selects **Decode VIN**, the VIN is sent in a POST body to the AutoValue server route and then to the official [NHTSA vPIC API](https://vpic.nhtsa.dot.gov/api/) for manufacturer-submitted vehicle specifications. It is not persisted, used for model training or joined to the released aggregate market artifact.

The demonstration evidence registry contains two manually reviewed public listings:

- VIN `WAUFAAF43PN018218`: 2023 Audi A4, Clutch listing `106685`, 76,243 km and $32,990 asking price (previously $35,690), verified 2026-08-30.
- The listing labels the Canadian trim as Technik 45; vPIC decodes the manufacturer trim vocabulary as S Line quattro Prestige. Both labels are displayed with their sources rather than silently forced into one value.
- “No accidents,” “single owner,” recall, registration and theft statements are displayed only as seller/CARFAX-summary claims with a direct link and verification date.
- VIN `WBA8B7C37HA190314`: 2017 BMW 340i xDrive Sedan, Clutch stock `108558`, 73,677 km and $34,690 on the freshest CarGurus snapshot captured 2026-08-31. An older Carpages snapshot displayed $35,190 and an earlier Clutch search snapshot displayed $36,090, so the UI explicitly labels the price drift.
- The BMW benchmark uses six Canadian 2017 340i xDrive automatic sedan observations from public CarGurus inventory snapshots captured 2026-08-25 and 2026-08-31. The subject VIN is excluded. Three manual-transmission listings are excluded.
- A one-feature ordinary-least-squares model fits advertised price against odometer. At 73,677 km it yields a rounded target ask of $33,200, a mileage coefficient of −$990 per 10,000 km and residual RMSE of $2,400. The displayed $30,700–$35,600 range is target ± one residual RMSE; it is not a calibrated transaction-price interval.

This registry is a transparent portfolio demonstration, not a general inventory crawler. Arbitrary valid VINs can be decoded automatically when vPIC has coverage, but a VIN itself does not encode a seller, listing URL, asking price or odometer. General exact-listing retrieval requires a licensed inventory feed. If a decoded vehicle cannot be mapped to a released price cell, the interface suppresses the previous result instead of substituting an unrelated market.

Two external sources are offered for follow-up:

- [IBC VIN Verify](https://www.ibc.ca/industry-resources/insurance-data-tools/vin-verify) is a free check for vehicles reported as non-repairable in Alberta, Ontario and the Atlantic provinces. Its result is not a complete accident history.
- [CARFAX Canada accident and damage history](https://www.carfax.ca/vehicle-history/vehicle-history-report/accident-damage-history) can contain reported accidents, claims, police records and available damage estimates. An absent record does not prove that damage never occurred.

Seller-displayed history highlights never alter, discount or relabel the source market statistics. They remain visibly attributed and link back to the exact public listing. The interface recommends an independent pre-purchase inspection because no record source is complete.

## Evaluated but not used for model training

### MarketCheck

MarketCheck has useful Canadian live inventory and price endpoints, but its current terms prohibit using its API data to train models, reconstruct datasets or build competing data products. It may be appropriate for a separately licensed, user-driven live lookup, but it is not a lawful training source for this project under the standard API terms.

- Documentation: https://docs.marketcheck.com/docs/api/cars
- Terms: https://www.marketcheck.com/terms_of_service/

### Canadian Black Book

Canadian Black Book offers retail, trade, private-party and residual-value APIs to customers. Public pricing and redistribution rights are not stated, so no integration will be made without a written licence.

- API overview: https://www.canadianblackbook.com/api/

### AutoTrader and CARFAX Canada

Both provide useful consumer valuation experiences, but their underlying market/transaction data are proprietary. Their public tools are product references, not data sources.

- AutoTrader valuation: https://www.autotrader.ca/valuations/
- CARFAX Canada value range: https://www.carfax.ca/whats-my-car-worth/car-value

## Approved next sources

### Transport Canada vehicle recalls

The Vehicle Recalls Database is available as a monthly CSV and first-party API under the Open Government Licence – Canada. The API excludes inconsequential and non-safety-related recalls. Product copy must tell users to confirm suspected recalls with Transport Canada and must not imply VIN-specific repair completion status.

- Dataset/API: https://open.canada.ca/data/en/dataset/1ec92326-47ef-4110-b7ca-959fab03f96d
- Developer terms: https://tc.canada.ca/en/road-transportation/defects-recalls-vehicles-tires-child-car-seats/vehicle-recalls-canada-developer-terms-use

### Natural Resources Canada fuel consumption ratings

NRCan publishes model-year fuel-consumption ratings and dedicated battery-electric and plug-in hybrid files. These can support transparent operating-cost scenarios when joined carefully on model year, make, model and vehicle class.

- Dataset: https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64

## Known data risks

| Risk | Impact | Control |
|---|---|---|
| Asking price differs from sale price | Cannot claim transaction value | Label every price and block transaction-value language |
| Single snapshot | Cannot infer a trend or future residual | Keep forecast feature gated |
| No trim or condition | Wide within-cell variation | Show P25–P75 and P10–P90; never apply a hidden adjustment |
| Few matched comparables | A fitted target can look more certain than it is | Require four valid observations, exclude the subject, show sample size and residual RMSE, and grade the six-observation example as limited evidence |
| Odometer outside matched support | Linear extrapolation may be unstable | Expose the observed odometer bounds and flag extrapolation in the benchmark object |
| Uneven regional coverage | Smaller regions have more suppressed cells | Show sample size and no-result state |
| Model-name mismatch across sources | Incorrect recall/fuel joins | Add normalized aliases plus manual exception review before release |
| Source changes schema | Silent data corruption | Fail the build on schema drift |
| Missing or incomplete damage records | A clean search can be mistaken for a damage-free vehicle | Say "none reported, not verified clear" and require independent inspection |
| Non-commercial licence | Cannot turn demo into a business | Keep demo non-commercial; acquire commercial licence before monetization |
