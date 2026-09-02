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
| Grain | Province × make × model × model year × new/used listing status |
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

Arbitrary valid VINs can be decoded automatically when vPIC has coverage, but a VIN itself does not encode a seller, listing URL, asking price or odometer. The current release intentionally has no embedded listing registry: exact listing retrieval requires a licensed inventory feed. If a decoded vehicle cannot be mapped to a released price cell, the interface suppresses the previous result instead of substituting an unrelated market.

Two external sources are offered for follow-up:

- [IBC VIN Verify](https://www.ibc.ca/industry-resources/insurance-data-tools/vin-verify) is a free check for vehicles reported as non-repairable in Alberta, Ontario and the Atlantic provinces. Its result is not a complete accident history.
- [CARFAX Canada accident and damage history](https://www.carfax.ca/vehicle-history/vehicle-history-report/accident-damage-history) can contain reported accidents, claims, police records and available damage estimates. An absent record does not prove that damage never occurred.

Seller-displayed history highlights remain visibly attributed and link back to the exact public listing. They can prefill the user-visible condition form but are not treated as independently verified facts. The interface recommends an independent pre-purchase inspection because no record source is complete.

## Completed auction outcomes: condition model

| Item | Detail |
|---|---|
| Publisher | Bradley Larsen via the National Bureau of Economic Research |
| Dataset | Dealer-to-Dealer Used-Car Bargaining and Auction Data |
| Source | https://www.nber.org/research/data/dealer-dealer-used-car-bargaining-and-auction-data-larsen-2020 |
| Download | https://data.nber.org/data/used-car-bargaining/Larsen_used_car_bargaining_data_and_code.zip |
| SHA-256 | `7827d220499700868fec28e09288e67b7c35ae8235e9b13e486d123ae05008fa` |
| Price meaning | Completed US wholesale auction sale price |
| Period | 2006–2010 |
| Model use | Relative condition and odometer adjustment only |

The source contains 512,396 auction observations, of which 260,299 are recorded as sold. The release trainer retains 91,278 sold outcomes that have a sufficiently dense close-peer group: same sale year, auction, vehicle year, make, model and VIN-derived trim code; at least eight peers; and at least two auction grades. The model target divides each completed price by a leave-one-out peer price so the subject vehicle cannot set its own anchor.

Training uses 52,146 outcomes from 2006–2008 and the temporal test uses 39,132 outcomes from 2009–2010. With the same Average-grade centering used at inference, the model reaches $1,198.19 MAE and 11.601% WAPE on the later years, improving MAE 4.29% over the peer-only baseline. These metrics establish historical wholesale residual accuracy; they do not validate a current Canadian retail transaction claim.

The consumer's accident, mechanical, cosmetic, service and wear selections are consolidated into a transparent auction-grade equivalent because those fields are not separately present in the training table. Their independent causal or dollar effects have not been learned. The condition model is therefore transferred only as a relative adjustment around a current Canadian anchor.

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
| Canadian anchor is asking price while adjustment data is wholesale sale price | Cannot claim a current Canadian transaction value | Label the hybrid output as a market estimate and expose both stages |
| Single snapshot | Cannot infer a trend or future residual | Keep forecast feature gated |
| No trim or inspection grade in aggregate cells | Wide within-cell variation | Prefer reviewed matches; show source range and the separate learned adjustment |
| Historical US auction transfer | Market/channel drift can bias the adjustment | Centre on the current Canadian anchor, publish temporal metrics and require Canadian retraining before commercial use |
| Composite condition proxy | Six user inputs may imply more granularity than the training data contains | Display the auction-grade equivalent and state that individual dollar effects are not separately learned |
| Few matched comparables | A fitted target can look more certain than it is | Require four valid observations, exclude the subject, show sample size and residual RMSE, and grade the six-observation example as limited evidence |
| Odometer outside matched support | Linear extrapolation may be unstable | Expose the observed odometer bounds and flag extrapolation in the benchmark object |
| Uneven regional coverage | Smaller regions have more suppressed cells | Show sample size and no-result state |
| Model-name mismatch across sources | Incorrect recall/fuel joins | Add normalized aliases plus manual exception review before release |
| Source changes schema | Silent data corruption | Fail the build on schema drift |
| Missing or incomplete damage records | A clean search can be mistaken for a damage-free vehicle | Say "none reported, not verified clear" and require independent inspection |
| Non-commercial licence | Cannot turn demo into a business | Keep demo non-commercial; acquire commercial licence before monetization |
