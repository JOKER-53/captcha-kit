# Security Policy

captcha-kit is a security-adjacent project (bot/spam mitigation), so we take vulnerability reports seriously.

## Supported Versions

| Version | Supported |
|---|---|
| Latest (main) | ✅ |
| Pre-release / v0.x | ✅ (best effort) |

Once a stable v1.0 is released, this table will be updated with a formal support window.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report it privately using one of the following:

- GitHub's [private vulnerability reporting](../../security/advisories/new) (preferred)
- Email: security disclosures can be sent to the maintainer directly (see GitHub profile: [@JOKER-53](https://github.com/JOKER-53))

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce, or a proof-of-concept
- Affected module(s)/version(s)
- Any suggested remediation, if known

## What to Expect

- **Acknowledgment:** within a few days of report
- **Assessment:** we'll confirm the issue and assess severity
- **Fix & disclosure:** a patch will be prepared and released; public disclosure happens after a fix is available, with credit to the reporter (unless anonymity is requested)

## Scope

In scope:
- Bypass of CAPTCHA validation logic
- Token forgery, replay, or expiration bypass
- Rate-limiting bypass
- Any way to solve a challenge programmatically without solving the actual challenge (bot bypass)

Out of scope:
- Vulnerabilities in third-party dependencies (report upstream, but let us know too)
- Issues requiring physical access or a compromised client machine
- Denial-of-service via brute-force alone (expected — rate-limiting is a mitigation, not a guarantee)

## Design Principle

All challenge modules are built on the rule: **never trust the frontend — validation is always server-side.** If you find a case where this principle is violated, that's a priority report.

Thank you for helping keep captcha-kit and its users safe.
