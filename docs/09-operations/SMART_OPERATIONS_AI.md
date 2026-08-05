# Smart Operations AI

Smart Operations AI is the airline-management intelligence layer of KVA OS.

## Purpose

It continuously turns operational data into explainable findings, evidence and
recommended actions. It does not change flights, aircraft assignments or
PIREP decisions automatically.

## v1.0 rules

1. Event Platform degradation
2. Active flight stalled beyond its threshold
3. Active flight without aircraft assignment
4. Completed flight without a linked PIREP
5. Submitted PIREP waiting too long for review
6. Aircraft assignment without synchronized operational state

## Human control

Every finding is visible to an authorized operations administrator. The
administrator may acknowledge, resolve or reopen it. All management actions
are written to the existing Operations Console audit log.

## Boundary

- Smart Operations AI: management-facing analysis and recommendations
- AI Dispatcher: future conversational operational assistant
- Digital Flight Companion: future pilot-facing in-flight and post-flight help
