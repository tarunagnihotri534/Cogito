# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

The decision-tracker team takes the security of our software and users seriously.

If you discover a security vulnerability in `decision-tracker`, please **do NOT report it in public GitHub issues**. Instead, please follow this process:

1. Open a **Private Vulnerability Report** via GitHub Advisories at:
   `https://github.com/tarunagnihotri534/decision-tracker/security/advisories/new`
2. If GitHub Advisories is unavailable, contact the project maintainer directly via GitHub [@tarunagnihotri534](https://github.com/tarunagnihotri534).

### Information to Include

To help us triage and resolve the issue quickly, please provide:
- A description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions or a minimal proof of concept (PoC).
- Affected version(s) and operating system / Node environment.
- Any suggested mitigations or patches.

### Response Timeline

- **Initial Response**: Within 48 hours acknowledging receipt.
- **Triage & Assessment**: Within 5 business days confirming validity and severity.
- **Fix & Disclosure**: We aim to release a patch within 14 days of confirmation, coordinating public disclosure with the reporter.

## Privacy & Local Execution Notice

`decision-tracker` is designed with local-first security principles:
- **No telemetry**: No tracking, metrics, or telemetry are collected or sent over the network.
- **Local storage**: All architectural decisions reside in `.decisions/` within your local repository.
- **No external AI calls**: Decision matching and linting execute 100% locally via fast glob matching and regex/AST inspection.
