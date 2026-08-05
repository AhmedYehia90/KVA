# Event Lifecycle

Domain transaction → outbox/event record → dispatcher → consumer → processing log → retry or dead letter.
