# Digital Flight Companion

The Digital Flight Companion is the pilot-facing post-flight coaching layer of
KVA OS.

## Purpose

After a PIREP is submitted, the companion produces an explainable debrief
based only on evidence recorded by KVA OS.

## v1.0 evidence

- Landing rate, when supplied
- Actual block time compared with route block time
- Fuel-used data completeness
- Black Box Replay integrity

## Debrief structure

- Flight score
- Confidence level
- Supportive summary
- What went well
- Focus for the next flight
- Evidence for every coaching item

## Tone preferences

Pilots may choose:

- Supportive
- Professional
- Direct

The selected tone applies to future debriefs. Historical debriefs remain
unchanged.

## Trust boundary

The companion never invents simulator telemetry. Missing evidence remains
visible as missing. Event-platform integrity warnings are shown as system
record notes and are not automatically treated as pilot faults.

## Route

`/pilot/companion`
