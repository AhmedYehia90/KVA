# Career & Economy Blueprint

## Split model

### Pilot Economy
Career progression, salary, rewards, wallet, Pilot Marketplace and route
support.

### Company Economy
Treasury, Company Marketplace, aircraft purchase/lease economic records,
route-investment decisions and Operations audit.

## Unified Ledger
Every balance movement is represented by one immutable ledger entry with an
owner scope of `pilot` or `company`.

## PIREP flow
`PIREP → salary + optional evidence bonus → wallet → career XP → rank check → milestone check → ledger + domain events`

## Company Marketplace flow
`Operations actor → company purchase → company ledger debit → company asset → domain event`

Aircraft/fleet mutation is intentionally not automatic.

## Route support flow
`Pilot wallet debit → company funds received → campaign progress → goal reached → Operations review`

A goal does not activate a route.

## Core domain events
- career.experience_awarded
- career.promoted
- career.milestone_achieved
- economy.transaction_created
- economy.salary_awarded
- economy.bonus_awarded
- pilot_marketplace.item_purchased
- company_marketplace.item_purchased
- route_support.contribution_created
- route_support.goal_reached
- route_support.operations_reviewed
- company.aircraft_purchased
- company.aircraft_leased
