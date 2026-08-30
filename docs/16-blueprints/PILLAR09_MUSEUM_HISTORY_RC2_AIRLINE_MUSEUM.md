# KVA OS — Pillar 09 Museum / History — RC2 Airline Museum

## Purpose

RC2 adds the airline side of KVA OS legacy.

The company story has two explicitly different evidence classes:

### Derived company history

Read-only facts derived from authoritative systems:

- Company Economy assets
- Economy Ledger
- Operations review of Route Support interest

### Curated company history

Narrative facts that are not safely derivable from operational records:

- Founding story
- Major company eras
- Historic announcements
- fleet/network/community/technology moments
- commemorative entries

Curated history lives in:

`public.museum_company_history_entries`

and is visibly labelled **CURATED** in the UI.

## New read-only projection

`public.get_airline_museum_history()`

The current pilot's organization comes from:

`pilot_career_accounts.organization_id`

The projection returns:

- organization/company summary
- company activity statistics
- pilot ↔ airline legacy connection
- combined company timeline

## Pilot ↔ Airline legacy connection

RC2 uses organization-scoped existing evidence:

- `career_economy_pirep_awards`
- `route_support_contributions`

This avoids assuming that every pilot flight in a future multi-airline KVA OS belongs to the same airline.

## Route authority integrity

An approved Route Support campaign remains only an approved community-interest signal.

The museum text explicitly states:

`Operations review ≠ automatic route activation`

## Aircraft/fleet integrity

A Company Economy aircraft asset remains an economic asset.

The museum text explicitly states:

`Economic aircraft asset ≠ operational fleet registration`

## No changes to

- Economy Ledger write rules
- company balance write rules
- fleet mutation rules
- route activation rules
- PIREP state
- Career XP / promotions
- marketplace actions
- Global Aviation Events
- Pilot Museum RC1 RPC
