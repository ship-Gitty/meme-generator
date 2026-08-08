# Security Audits

Five standard audit prompts, each mapped to the phase(s) in `PHASES.md` where it applies. Run the mapped audit(s) after finishing a phase, before starting the next one. Audit 4 is the exception — re-run it after every phase, not just once.

---

## Audit 1 — Authentication & Authorization
**Run after:** Phase 1 (full), Phase 4 (repeat, focused only on the admin role check)

Review this codebase for authentication and authorization vulnerabilities. Check for:
- Broken authentication flows (missing token validation, weak session management)
- Insecure JWT handling (algorithm confusion, missing expiry checks, weak secrets)
- Missing authorization checks on API routes (can users access other users' data?)
- Privilege escalation paths (can a regular user perform admin actions?)
- Hardcoded credentials or API keys in source code
- Password storage issues (plaintext, weak hashing like MD5/SHA1 instead of bcrypt/argon2)

For each issue found: explain the vulnerability, show the affected code, rate severity (Critical/High/Medium/Low), and provide a fixed code snippet.

---

## Audit 2 — Injection & Input Validation
**Run after:** Phase 2 (focus on the prompt field and any URL-fetching logic — SSRF risk from Giphy/Imgflip/Gemini image URLs), Phase 5 (re-run given new dependencies)

Analyze this code for injection vulnerabilities and missing input validation. Look for:
- SQL injection (raw queries with user input, ORM misuse)
- NoSQL injection (MongoDB query manipulation)
- Command injection (shell exec with user-controlled data)
- XSS vulnerabilities (unescaped user input rendered in HTML, dangerouslySetInnerHTML misuse)
- Path traversal attacks (user-controlled file paths)
- Missing input sanitization, length limits, and type validation on all user-facing inputs
- Server-Side Request Forgery (SSRF) in any URL-fetching logic

For every finding: show the vulnerable line, demonstrate a proof-of-concept attack string, and rewrite the code securely.

---

## Audit 3 — API & Data Exposure
**Run after:** Phase 4 (this is the audit that verifies NFR-11 — whether a regular user can reach admin cost data via the API even if the UI hides it)

Audit this application's API layer and data handling for exposure risks:
- Are sensitive fields (passwords, tokens, SSNs, PII) being returned in API responses unnecessarily?
- Is rate limiting and brute-force protection missing on any endpoints?
- Are CORS headers overly permissive (wildcard origins on authenticated routes)?
- Are internal error stack traces being leaked to the client?
- Is pagination missing, allowing mass data extraction?
- Are there any unauthenticated endpoints that should require auth?
- Check HTTP security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- Are environment variables and secrets properly excluded from client bundles?

List each exposure with its risk, the affected endpoint/code, and the remediation.

---

## Audit 4 — Dependency & Configuration
**Run after:** every phase, not just once — dependency risk accumulates over time

Scan this project's dependencies and configuration for security weaknesses:
- Identify outdated packages with known CVEs (cross-reference package.json / requirements.txt / go.mod versions)
- Flag packages that are deprecated, unmaintained, or have been flagged for malicious activity
- Check if development dependencies are accidentally bundled into production builds
- Review environment configuration: are .env files committed? Is NODE_ENV set correctly in prod?
- Check for overly broad IAM permissions or database roles (principle of least privilege)
- Identify any use of eval(), Function(), or other dangerous dynamic code execution
- Is the app running with unnecessary elevated OS privileges?

Provide a prioritized remediation list with package upgrade commands where applicable.

---

## Audit 5 — Business Logic & State Management
**Run after:** Phase 3 (focus on IDOR via meme IDs in the save/edit flow, and whether client-submitted text_style/metadata is trusted without server-side validation)

Examine this application for business logic vulnerabilities and state management flaws:
- Can users manipulate prices, quantities, or IDs on the client side that are trusted by the server?
- Are there race conditions in critical operations (double spending, duplicate submissions)?
- Is there proper idempotency on payment or write operations?
- Can workflow steps be skipped (e.g., bypassing email verification, skipping payment)?
- Are file uploads validated for type, size, and content (not just extension)?
- Is sensitive logic exposed in client-side JavaScript that should live server-side?
- Are there insecure direct object references (changing an ID in a request to access another user's resource)?
- Are audit logs missing for sensitive actions (login, data deletion, permission changes)?

For each flaw: describe the attack scenario step-by-step, identify the root cause, and provide the secure implementation pattern.
