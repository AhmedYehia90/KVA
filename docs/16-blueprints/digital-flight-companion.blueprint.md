# Digital Flight Companion Blueprint

Status: Implemented in Pack v1.0

## Objective

Give each pilot a private and encouraging post-flight debrief that converts
recorded operational data into clear learning points.

## Inputs

- PIREP
- Flight booking
- Published route block time
- Black Box Replay integrity
- Pilot tone preference

## Outputs

- Evidence-backed flight score
- Confidence score
- Strengths
- Focus items
- Private pilot acknowledgement
- Companion domain events

## Generation

A debrief is generated after the durable `pirep.created` event. The trigger is
ordered after the Operations Projector so the companion reads the completed
flight projection and linked PIREP.

## Privacy

- Pilots can read only their own debriefs.
- Debriefs are not public passport data.
- Generation uses a security-definer function.
- Direct client inserts are not allowed.

## Relationship to future systems

- Digital Flight Companion: pilot-facing post-flight coaching
- Mentor AI: future richer guidance and conversational learning
- AI Dispatcher: operational planning and dispatch assistance
- Smart Operations AI: airline-management decision support
