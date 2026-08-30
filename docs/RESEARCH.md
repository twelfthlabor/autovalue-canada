# Product and repository research

## Competitor patterns

| Product | Useful pattern | Opportunity for AutoValue Canada |
|---|---|---|
| CARFAX Canada Value Range | Uses transaction data, odometer, market movement and location | Show the sample, distribution, provenance and failure conditions |
| AutoTrader valuation | Fast no-account flow; make/model or VIN entry | Be explicit about excluded condition/history and asking-price basis |
| CarLens | Frames the task around checking a listing and what to ask | Ground every finding in structured evidence rather than generated advice |
| Canadian Black Book | Multiple value channels and residual-value products | Make methodology and data sufficiency visible in the portfolio release |

## Open-source patterns reviewed

### Atharv-AC/Car-Price-ML-System

Useful: training/inference separation, FastAPI validation, prediction logging, model versioning, Docker and tests.

Gap to improve: its source data are not Canadian, uncertainty is not a first-class product output, and cloud deployment/monitoring remain roadmap items.

Repository: https://github.com/Atharv-AC/Car-Price-ML-System

### UBC MDS used-car price prediction

Useful: reproducible Make pipeline, Docker path, comparative model evaluation and documented dataset imbalance.

Gap to improve: it uses historical US Craigslist listings and a random supervised-learning framing that does not produce a current Canadian consumer product.

Repository: https://github.com/UBC-MDS-2019-20/DSCI_522_Group-308_Used-Cars

### Common Streamlit price predictors

Useful: quick exploration and low deployment effort.

Gap to improve: many are notebook models wrapped in a form, rely on stale or geography-mismatched data, and provide neither production QA nor a claim boundary.

## Product decision

The first release should not imitate a proprietary appraisal product with weaker data. Its differentiator is evidence literacy: accurate aggregate values, visible sample size, uncertainty, provenance, and a public quality-control surface. Once licensed row-level and historical data are available, the same product can add a genuine model without changing its trust contract.
