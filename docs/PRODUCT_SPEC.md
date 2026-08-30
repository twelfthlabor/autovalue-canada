# Product specification

## Product promise

AutoValue Canada gives a used-car shopper credible evidence for a price conversation. It does not replace an appraisal, inspection, history report or recall confirmation.

## Primary user

A Canadian consumer comparing a dealer listing who knows the vehicle's province, make, model, model year, asking price and approximate odometer.

## Core job to be done

“When I am considering a used vehicle, help me understand whether its asking price is unusual for comparable dealer inventory, and show me enough evidence to judge how much confidence to place in that comparison.”

## Release 0.1 acceptance criteria

- Users can select only combinations present in the validated dataset.
- A default scenario works immediately without typing.
- Results identify the exact geographic and vehicle market cell.
- Results show median, P25–P75, P10–P90 and sample size.
- An optional asking price is positioned against published percentiles.
- Optional odometer is compared with, but does not alter, the published median.
- Every result states important missing factors.
- The interface works at 360 px width and supports keyboard operation.
- The public build requires no secret or paid service.
- Data claims reproduce the source artifact exactly.

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

- Do not state “good deal,” “bad deal” or “fair value” from aggregate asking prices alone.
- Do not produce a recommended offer without condition, history and channel data.
- Never state that a vehicle has no outstanding recall based only on make/model/year data.
- Never collect or expose a VIN unless a future feature has a documented need and retention policy.
- Do not expose commercial API keys to the browser.
