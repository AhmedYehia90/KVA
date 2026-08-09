# Mentor AI Blueprint

Status: Implemented in Pack v1.0

## Objective

Create a personal learning loop for every pilot:

1. Flight is completed.
2. Digital Flight Companion generates a debrief.
3. Mentor AI selects one useful focus.
4. The pilot reviews a practical lesson.
5. The pilot records a reflection.
6. The pilot may accept a measurable goal.
7. Later debriefs update goal progress.

## Inputs

- `flight_companion_debriefs`
- Companion tone
- Debrief strengths
- Debrief focus items
- Debrief score and confidence
- Black Box Replay integrity context

## Outputs

- Mentor sessions
- Lesson plan
- Mentor reflections
- Recommended goals
- Active-goal progress
- Goal completion events

## Privacy

- Sessions, reflections and goals are private to the pilot.
- Clients may read their own rows only.
- All writes use authenticated security-definer RPCs.

## Explainability

Every session preserves its primary focus, diagnosis, lesson steps,
recommended goal and source debrief. Goal progress records the evidence-based
reason for each update.

## Boundary with other pillars

- Digital Flight Companion: static post-flight debrief
- Mentor AI: adaptive learning and progress
- AI Dispatcher: operational planning and dispatch support
- Smart Operations AI: management-facing operational intelligence
