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
| Uneven regional coverage | Smaller regions have more suppressed cells | Show sample size and no-result state |
| Model-name mismatch across sources | Incorrect recall/fuel joins | Add normalized aliases plus manual exception review before release |
| Source changes schema | Silent data corruption | Fail the build on schema drift |
| Non-commercial licence | Cannot turn demo into a business | Keep demo non-commercial; acquire commercial licence before monetization |
