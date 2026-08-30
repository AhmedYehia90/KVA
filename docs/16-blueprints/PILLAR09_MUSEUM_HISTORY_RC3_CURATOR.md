# KVA OS — Pillar 09 Museum / History — RC3 Museum Curator

## Purpose

RC3 adds the Operations-authorized curation workflow for official company narrative history.

This solves a deliberate gap from RC2:

`Derived evidence != Curated company narrative`

KVA OS must never invent a founding story, historic announcement or company era from unrelated operational records.

## Operations workflow

`Create Draft -> Review / Edit -> Publish -> Airline Museum`

A published item becomes visible through the existing RC2 Airline Museum projection.

An unpublished item remains a Draft.

## Authorization

The Next.js page and every Server Action reuse the existing:

`requireOperationsConsoleAdmin()`

pattern.

The Server Actions use the existing service-role Admin client and call service-role-only RPCs, consistent with the Operations Economy Console pattern already present in the codebase.

## Audit

Every curator write creates:

1. `museum_history_admin_audit` record
2. Event Platform domain event

Events:

- `museum.company_history_created`
- `museum.company_history_updated`
- `museum.company_history_published`
- `museum.company_history_unpublished`

## Curated history fields

- category
- title
- short summary
- long details
- occurred date
- era label
- source label
- source reference
- Draft / Published state

## Categories

- Company History
- Fleet History
- Network History
- Community History
- Event History
- Technology History
- Other

## Integrity

RC3 does not mutate:

- aircraft registrations
- fleet state
- route activation
- Route Support decisions
- PIREPs
- Career XP / ranks
- wallets
- company KVC balance
- Economy Ledger

Curator activity is historical narrative administration only.
