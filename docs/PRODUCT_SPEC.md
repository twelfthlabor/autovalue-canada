# Product specification

## Product promise

AutoValue Canada gives a used-car shopper credible evidence for a price conversation. It does not replace an appraisal, inspection, history report or recall confirmation.

## Primary user

A Canadian consumer comparing a dealer listing who knows the vehicle's province, make, model, model year, asking price and approximate odometer.

## Core job to be done

“When I am considering a used vehicle, help me understand whether its asking price is unusual for comparable dealer inventory, and show me enough evidence to judge how much confidence to place in that comparison.”

## Release 0.3 acceptance criteria

- Users can select only combinations present in the validated dataset.
- A default scenario works immediately without typing.
- Results identify the exact geographic and vehicle market cell.
- Results show median, P25–P75, P10–P90 and sample size.
- An optional asking price is positioned against published percentiles.
- Odometer and condition alter the estimate through a reproducible transaction-trained model while the unadjusted Canadian anchor remains visible.
- Optional VIN input is validated locally; explicit decode requests are proxied to NHTSA vPIC without persistence.
- A successful VIN decode fills make, model and year when an exact published market cell is available.
- Listing price, odometer and inspection facts remain user-entered until a licensed row-level inventory connector is configured; no captured listing is treated as current.
- Users can enter overall grade, accident/title history, mechanical condition, cosmetic condition, service history, and tire/brake wear without leaving the one-page result.
- The six inputs produce a visible auction-grade equivalent; the interface does not imply that their individual dollar effects were separately learned.
- The condition model is trained on completed outcomes, validated on later sale years and required to beat its leave-one-out peer baseline before its artifact is published.
- The current Canadian market anchor is neutral at Average condition, preventing the historical model intercept from being double-counted.
- A decoded VIN that has no matching price cell never inherits a previous or default vehicle result.
- Seller-displayed history highlights are readable, attributed and linked back to the exact public listing.
- The primary desktop checker remains inside one viewport-height frame and adapts to smaller screens without horizontal overflow.
- A dedicated interactive calculation route visualizes the matched anchor and explains the transferred condition/odometer adjustment.
- Every result states important missing factors.
- The interface works at 360 px width and supports keyboard operation.
- The public build requires no secret or paid service.
- Data and model-performance claims reproduce their source artifacts exactly.

## Deliberate differentiation

Existing Canadian valuation products optimize for a fast answer. AutoValue Canada optimizes for an inspectable answer:

- visible sample strength;
- observed distribution rather than one opaque score;
- a public data-control room;
- explicit asking-price versus transaction-price distinction;
- documented blocked features;
- reproducible QA checks in the repository.

## Success measures

For the portfolio release:

- five usability sessions with active Canadian used-car shoppers;
- at least four can correctly explain what the median and typical band mean;
- no participant mistakes the result for a guaranteed sale value after reading it;
- median time to complete a price check below 90 seconds;
- zero production build failures and zero accessibility-critical findings.

## Safety and consumer protections

- Do not state “good deal,” “bad deal” or “fair value” from aggregate asking prices alone. A matched-comparable signal must name its evidence tier and unresolved risks.
- Do not produce a recommended offer; condition/history inputs support a market estimate but do not replace verified inspection, history and transaction-channel data.
- Never state that a vehicle has no outstanding recall based only on make/model/year data.
- Send a VIN only after an explicit decode action, keep it out of request URLs, and never persist, train on or expose it.
- Never describe a valid VIN format or an empty history result as proof that a vehicle is damage-free.
- Never describe seller-displayed CARFAX or inspection summaries as independently verified AutoValue findings.
- Do not expose commercial API keys to the browser.
- Never call an asking-price target a known transaction price. “True price” in product language means an evidence-based current target with uncertainty, not an observable ground truth before sale.
