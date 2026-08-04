# Business Rule Engine Blueprint

## Purpose
Centralize configurable promotion, salary, reward, penalty, eligibility, and legacy decisions.

## Rule lifecycle
Draft → Review → Approved → Active → Superseded → Archived.

## Safety
Rules return decisions. Approved domain services execute changes and publish events.
