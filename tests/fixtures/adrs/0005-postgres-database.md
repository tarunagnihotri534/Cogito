# 5. Migrate primary database to PostgreSQL

Date: 2023-09-01

## Status

Accepted

## Context

The system has outgrown SQLite concurrency in `src/db/**/*.ts`.
Supersedes 0004

## Decision

Migrate to PostgreSQL for full ACID compliance and connection pooling.

## Consequences

Requires running a database container or managed service.
