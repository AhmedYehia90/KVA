# Living Airbot Blueprint

Status: Implemented in Pack v1.0

## Identity

**LIVING AIRBOT — AI DISPATCHER**

## Objective

Create a dispatcher that feels present throughout the flight while staying
strictly grounded in KVA OS operational evidence.

## Lifecycle

1. A route is booked.
2. Living Airbot opens a dispatcher session.
3. Route, dispatch and aircraft evidence are checked.
4. The pilot sees a readiness score and next step.
5. Flight events move the session through live phases.
6. The pilot can ask bounded dispatch questions.
7. The session closes when the flight is completed.

## Phases

- Preflight
- Boarding
- Ground departure
- Airborne
- Arrived
- Completed

## Data model

- `living_airbot_sessions`
- `living_airbot_messages`

## Domain events

- `airbot.session_created`
- `airbot.session_updated`
- `airbot.interaction_recorded`

## Privacy

- Pilot sessions and conversation history are private.
- Clients can read only their own rows.
- Writes occur through security-definer functions.
- Living Airbot never changes a flight status automatically.

## Relationship to other pillars

- Smart Operations AI: management decision support
- Digital Flight Companion: post-flight debrief
- Mentor AI: adaptive learning
- Living Airbot: live operational dispatch assistance
