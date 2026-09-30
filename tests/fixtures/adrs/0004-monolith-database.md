# 4. Use SQLite for initial development

Date: 2023-02-01

## Status

Superseded by 0005

## Context

We need a lightweight database for local development touching `src/db/sqlite.ts`.

## Decision

Use SQLite embedded database.

## Consequences

Fast setup but limits concurrent write operations.
