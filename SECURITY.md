# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Snaplify, report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Email security concerns to the instance operator's contact email (configured in `snaplify.config.ts`).

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to acknowledge reports within 48 hours and provide a fix within 7 days for critical issues.

## Security Measures

### Headers
- `Content-Security-Policy`: Restricts resource loading
- `Strict-Transport-Security`: Forces HTTPS
- `X-Frame-Options: DENY`: Prevents clickjacking
- `X-Content-Type-Options: nosniff`: Prevents MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: Restricts browser features

### Authentication
- Session tokens with 7-day expiry and daily rotation
- bcrypt password hashing (via Better Auth)
- CSRF protection on all form actions
- Rate limiting on auth endpoints (sliding window)

### Data
- Parameterized queries via Drizzle ORM (no SQL injection)
- Input validation at API boundaries with Zod
- HTML sanitization with DOMPurify
- UUID primary keys (no sequential IDs)

### Infrastructure
- Non-root Docker container
- Health checks on all services
- Dependency audit in CI pipeline
