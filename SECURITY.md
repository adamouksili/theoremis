# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅ Active |
| < 1.0   | ❌ End of life |

## Reporting a Vulnerability

If you discover a security vulnerability in Theoremis, **please do not open a public issue.**

Instead, email **adam@theoremis.com** with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested fix (if you have one)

We will respond within **48 hours** and work with you to resolve the issue before any public disclosure.

## Scope

Security issues we care about:
- **API authentication bypass** — Unauthorized access to verification endpoints
- **Worker sandbox escape** — Breaking out of Lean 4 worker isolation
- **Path traversal** — Accessing files outside of intended directories
- **Rate limit bypass** — Circumventing API rate limiting
- **XSS/injection** — Cross-site scripting in the web IDE
- **Dependency vulnerabilities** — Known CVEs in npm dependencies

## Out of Scope

- Theoretical attacks that require physical access
- Social engineering attacks
- Denial of service via legitimate API usage (covered by rate limits)

## Recognition

We appreciate responsible disclosure. Security researchers who report valid vulnerabilities will be credited in our changelog (unless they prefer anonymity).
