# KVA OS

> **Build Your Aviation Career. Fly Your Story. Leave a Legacy.**

**KVA OS** is a next-generation Virtual Aviation Operating System designed for virtual pilots, virtual airlines, operations teams, and connected aviation communities.

**Kalabsha Airlines** is the founder airline and the first airline powered by KVA OS.

KVA OS is being built as a modular, event-driven, multi-airline-ready platform where every flight can become part of a pilot's identity, operational history, learning journey, achievements, and long-term aviation legacy.

---

## Project Status

- **Product:** KVA OS
- **Founder Airline:** Kalabsha Airlines
- **Stage:** Active Development
- **Architecture:** Modular · Event-Driven · Multi-Airline Ready
- **Web:** Next.js · TypeScript
- **Backend:** Supabase · PostgreSQL
- **Core Model:** Domain Events + Projections + Evidence-Backed Automation
- **Pillars Completed:** **7 / 10**

---

# The 10 Core Pillars

| # | Pillar | Status |
|---|---|---|
| 01 | Universal Pilot Passport | ✅ Completed |
| 02 | Smart Operations AI | ✅ Completed |
| 03 | Black Box Replay | ✅ Completed |
| 04 | Digital Flight Companion | ✅ Completed |
| 05 | Mentor AI | ✅ Completed |
| 06 | Living Airbot / AI Dispatcher | ✅ Completed |
| 07 | Global Aviation Events | ✅ Completed |
| 08 | Career & Economy | ⬜ Pending |
| 09 | Museum / History | ⬜ Pending |
| 10 | Living Airports | ⬜ Pending |

**Current progress: 7 / 10 pillars completed.**

---

## ✅ Pillar 01 — Universal Pilot Passport

One pilot. One identity. One aviation journey.

The Universal Pilot Passport gives each pilot a persistent digital identity across the KVA OS ecosystem.

### Implemented

- Unified pilot identity
- Persistent passport number
- Public/private visibility model
- Airline memberships
- Pilot qualifications
- Verified experience ledger
- Flight history integration
- Rank-aware profile data
- Multi-airline-ready organization model
- Event Platform integration

---

## ✅ Pillar 02 — Smart Operations AI

Explainable operational intelligence for airline operations.

Smart Operations AI analyzes recorded KVA OS operational data, detects risks and presents evidence-backed recommendations without silently changing flights.

### Implemented

- Operational health score
- Explainable rules engine
- Finding severity model
- Evidence inspection
- Human approval workflow
- Acknowledge / resolve lifecycle
- Operational analysis runs
- Finding history
- Core health integration
- Event-backed operational intelligence

---

## ✅ Pillar 03 — Black Box Replay

Reconstruct every flight from immutable operational events.

Black Box Replay turns the KVA OS Event Platform into a deterministic flight history and integrity engine.

### Implemented

- Flight event reconstruction
- Deterministic timeline
- Event evidence inspection
- Replay status
- Projection comparison
- Source-to-projection integrity checks
- Correlation validation
- Causation validation
- Processing-health checks
- JSON export
- Historical flight archive

---

## ✅ Pillar 04 — Digital Flight Companion

A supportive, evidence-backed post-flight companion.

The Digital Flight Companion explains what went well, identifies the next focus area and never invents simulator data.

### Implemented

- Post-flight debriefs
- Flight score
- Evidence-backed strengths
- Next-flight focus areas
- Operational timing analysis
- Landing-data awareness
- Fuel-data awareness
- Replay-integrity awareness
- Pilot acknowledgement
- Personal companion style preferences

---

## ✅ Pillar 05 — Mentor AI

Turn every debrief into practical learning.

Mentor AI converts flight evidence into a focused lesson, records pilot reflection and tracks measurable goals across future flights.

### Implemented

- Mentor sessions
- Practical diagnosis
- Before-next-flight guidance
- After-next-flight validation
- Recommended goals
- Pilot reflection
- Mentor responses
- Explain-simpler workflow
- Give-an-example workflow
- Ready-to-practise workflow
- Goal acceptance
- Goal pause / resume
- Evidence-based goal progress
- Automatic goal completion

---

## ✅ Pillar 06 — Living Airbot / AI Dispatcher

A live dispatcher that follows the flight lifecycle.

Living Airbot reads recorded KVA OS evidence and stays aligned with the flight from booking through completion.

### Implemented

- Automatic dispatcher session creation
- Preflight readiness
- Route validation
- Dispatch-record validation
- Aircraft assignment validation
- Aircraft operational-state validation
- Brief Me
- Readiness
- Aircraft
- Next Step
- Pilot / dispatcher conversation
- Live lifecycle synchronization
- Preflight
- Boarding
- Ground Departure
- Airborne
- Arrived
- Completed
- Legacy session normalization
- Evidence-only responses

### Validated Live Lifecycle

`PREFLIGHT → BOARDING → GROUND DEPARTURE → AIRBORNE → ARRIVED → COMPLETED`

---

## ✅ Pillar 07 — Global Aviation Events

Connect individual flights to a larger virtual aviation world.

Global Aviation Events allows pilots and virtual airlines to participate in shared aviation campaigns using real KVA OS flight evidence.

### Implemented

- Global Events Hub
- Live events
- Upcoming events
- Event history
- Event participation
- Join / withdraw
- Event routes and missions
- Cross-airline organization model
- Live progress
- Event points
- Automatic PIREP event credit
- Duplicate-credit protection
- Completion achievements
- Historical event records
- Operations event publishing
- Archive / republish lifecycle
- Event Platform integration

### Validated End-to-End

`Publish → Join → Mission → Flight → PIREP → Credit → Progress → Achievement → Archive → History`

---

# Remaining Pillars

## ⬜ Pillar 08 — Career & Economy

Planned as the long-term progression and economy layer of KVA OS.

Expected direction includes pilot career progression, salary/rewards, virtual currency, economic participation, marketplace concepts and meaningful use of earned value inside the platform.

**Status:** Pending

---

## ⬜ Pillar 09 — Museum / History

The long-term memory and legacy layer of KVA OS.

Expected direction includes milestones, first flights, aircraft memories, anniversaries, historic achievements and a timeline that allows pilots and airlines to look back at their journey years later.

**Status:** Pending

---

## ⬜ Pillar 10 — Living Airports

The world-awareness layer of KVA OS.

Expected direction includes airports that feel alive inside the platform, with operational context, activity, events and dynamic aviation-world information connected to the wider KVA OS ecosystem.

**Status:** Pending

---

# Event-Driven Foundation

KVA OS is built around an Event Platform rather than isolated CRUD screens.

Important flight and platform actions are recorded as domain events, allowing multiple systems to react without tightly coupling every feature together.

Examples include:

- `flight.booked`
- `aircraft.assigned`
- `dispatch.created`
- Flight lifecycle events
- PIREP events
- Passport events
- Global Aviation Events
- Operational intelligence events

This foundation powers:

- Operations projections
- Black Box Replay
- Smart Operations AI
- Digital Flight Companion
- Mentor AI
- Living Airbot
- Global Aviation Events
- Future KVA OS pillars

---

# Core Platform Capabilities

Beyond the 10 product pillars, the platform already includes important shared infrastructure.

### Event Core

- Immutable domain-event storage
- Processing log
- Correlation IDs
- Causation IDs
- Event metadata
- Event consumers
- Retry support
- Projection rebuild support

### Operations Event Projector

- Operational flight projection
- Event-driven state updates
- Processing health
- Projection rebuild

### Event Operations Console

Protected operational console for:

- Domain event inspection
- Processing status
- Failed-event diagnostics
- Retry
- Projection rebuild
- Audit history

### Reliability

KVA OS prioritizes:

- Evidence over invented data
- Deterministic processing
- Idempotent event consumers
- Auditable operational actions
- Safe historical backfill
- Human approval for operational recommendations

---

# KVA OS Product Loop

The long-term KVA OS pilot journey is:

`Identity → Flight → Operations → Replay → Debrief → Learning → Dispatcher → Events → Career → Legacy → World`

The objective is not simply to log virtual flights.

The objective is to build a persistent aviation journey.

---

# Architecture

```text
Pilot / Operations UI
        │
        ▼
Next.js Application
        │
        ▼
Supabase RPC / Domain Logic
        │
        ├──────────────► PostgreSQL Operational Data
        │
        ▼
KVA OS Event Platform
        │
        ├──► Operations Projector
        ├──► Black Box Replay
        ├──► Smart Operations AI
        ├──► Digital Flight Companion
        ├──► Mentor AI
        ├──► Living Airbot
        └──► Global Aviation Events
```

The architecture is intentionally modular so future virtual airlines can operate on the same KVA OS foundation without becoming tightly coupled to Kalabsha Airlines.

---

# Repository Structure

```text
KVA/
├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       └── lib/
│
├── packages/
│   ├── event-core/
│   ├── operations-projector/
│   ├── universal-passport/
│   ├── smart-operations-ai/
│   ├── black-box-replay/
│   ├── digital-flight-companion/
│   ├── mentor-ai/
│   ├── living-airbot/
│   └── global-aviation-events/
│
├── supabase/
│   └── migrations/
│
├── docs/
│   ├── 01-product/
│   ├── 02-architecture/
│   ├── 03-database/
│   ├── 04-events/
│   ├── 05-engines/
│   ├── 08-pilot/
│   ├── 11-release/
│   ├── 16-blueprints/
│   └── adr/
│
└── README.md
```

---

# Development

## Requirements

- Node.js
- pnpm
- Supabase CLI
- Supabase project
- PostgreSQL
- Git

## Install

```powershell
pnpm install
```

## Development Server

```powershell
pnpm dev
```

## Production Build

```powershell
pnpm build
```

## Supabase Migration Preview

```powershell
npx supabase db push --dry-run
```

## Apply Supabase Migrations

```powershell
npx supabase db push
```

---

# Testing Philosophy

Every major KVA OS pillar is expected to pass:

1. Package typecheck
2. Package tests
3. Package build
4. Web production build
5. Supabase migration dry run
6. Database migration
7. Manual end-to-end validation
8. GitHub CI
9. Vercel deployment checks

A pillar is not considered complete just because a screen renders.

It must work through its real data lifecycle.

---

# Documentation

Start with the KVA OS documentation:

- [Product Bible](docs/01-product/PRODUCT_BIBLE.md)
- [Roadmap](docs/01-product/ROADMAP.md)
- [Architecture](docs/02-architecture/ARCHITECTURE.md)
- [Database Blueprint](docs/03-database/DATABASE_BLUEPRINT.md)
- [Event Catalog](docs/04-events/EVENT_CATALOG.md)
- [Rule Engine](docs/05-engines/RULE_ENGINE.md)
- [Legacy Engine](docs/05-engines/LEGACY_ENGINE.md)
- [Architecture Decisions](docs/adr/README.md)

Implemented pillar documentation is also maintained inside the pilot, release and blueprint documentation folders.

---

# Vision

KVA OS started with Kalabsha Airlines, but the platform is designed to grow beyond a single virtual airline.

The goal is a shared operating system where virtual aviation communities can build airlines, pilots can carry one persistent identity, flights create meaningful history, AI systems learn from recorded evidence, and years of activity become a real digital aviation legacy.

**Kalabsha Airlines is where the story started. KVA OS is where the ecosystem grows.**

---

## Current Milestone

**7 / 10 Core Pillars Completed**

`✅ ✅ ✅ ✅ ✅ ✅ ✅ ⬜ ⬜ ⬜`

Next:

**Pillar 08 — Career & Economy**

---

> **Don't build features. Build legacy.**
