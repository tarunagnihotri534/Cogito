# Use Markdown Architectural Decision Records (MADR)

* Status: accepted
* Deciders: Alice, Bob
* Date: 2023-03-15

## Context and Problem Statement

We want structured decision documentation stored in version control.
We need guidelines governing `src/templates/*.ts` and `src/core/`.

## Considered Options

* MADR
* Nygard
* Wiki

## Decision Outcome

Chosen option: "MADR", because it provides clear headers and easy markdown editing.

### Positive Consequences

* Standardized structure across repositories
* Tooling support for markdown parsers

### Negative Consequences

* Slightly more verbose than plain text
