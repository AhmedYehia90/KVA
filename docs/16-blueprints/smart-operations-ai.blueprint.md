# Smart Operations AI Blueprint

Status: Implemented in Pack v1.0

## Objective

Give each airline on KVA OS an explainable operational intelligence engine
that detects risk before managers need to search manually across dashboards.

## Users

- Airline operations managers
- Dispatch supervisors
- Platform administrators

## Data sources

- Durable Event Platform and processing log
- Operations flight projection
- Aircraft operational state
- PIREPs
- Platform organizations

## Outputs

- Analysis runs
- Health score
- Evidence-backed findings
- Recommended action
- Finding lifecycle: open, acknowledged, resolved
- Domain events for completed analysis and finding status changes

## Security

- Server-only admin client
- Existing operations email allowlist
- No client-facing RLS policies
- Existing Operations Console audit table

## v1.0 limitations

- Explainable rules, not an external generative model
- No autonomous operational changes
- PIREP review analysis is currently scoped to the founding airline
- Scheduled execution is reserved for a later automation release
