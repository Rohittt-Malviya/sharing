# Security Guidelines

This document describes the security posture of the **sharing** WebRTC P2P file-sharing application and explains how each control is implemented and tested.

---

## Security Controls

### 1. HTTP Security Headers

All HTTP responses include the following headers, set by `backend/middleware/helmet.js`:

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking via `<iframe>` |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter for older browsers |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage |
| `Content-Security-Policy` | see `helmet.js` | Restricts resource loading |
| `Permissions-Policy` | `camera=(), microphone=(), …` | Disables unused powerful APIs |
| `Strict-Transport-Security` | `max-age=31536000` | Forces HTTPS (production only) |

### 2. CORS

CORS is restricted to a configurable list of allowed origins via the `FRONTEND_URL` environment variable. Wildcard (`*`) origins are **never** used.

```
# backend/.env.example
FRONTEND_URL=https://your-app.example.com
# Multiple origins (comma-separated):
# FRONTEND_URL=https://your-app.example.com,http://localhost:5173
```

CORS is validated automatically in the CI/CD integration-test job.

### 3. Rate Limiting

The HTTP layer is protected by `backend/middleware/rateLimit.js` which limits each IP address to **200 requests per 60-second window** by default. Clients that exceed the limit receive a `429 Too Many Requests` response with a `Retry-After` header.

### 4. Input Validation

All socket event payloads are validated before processing using the helpers in `backend/utils/validators.js` (also accessible via `backend/utils/validation.js`):

- `isNonEmptyString` — rejects empty/whitespace strings
- `isValidRoomId` — accepts only 6–12 character alphanumeric room IDs
- `isValidSdp` — validates WebRTC SDP object shape
- `isValidIceCandidate` — validates ICE candidate objects

### 5. Environment Variables

Secrets are **never** hardcoded.  All configuration is supplied through environment variables.

- Copy `backend/.env.example` → `backend/.env` and fill in real values.
- Copy `frontend/.env.example` → `frontend/.env` (for local development only).
- Both `.env` files are in `.gitignore` and must never be committed.

### 6. Dependency Auditing

- `npm audit --audit-level=high` is run on the **backend** dependencies in every CI run.
- `npm audit --audit-level=high --omit=dev` is run on **frontend production** dependencies (dev tools like Vite/esbuild are excluded as their known CVEs only affect the local development server, not the production build).

### 7. Static Analysis

ESLint with security-focused rules (`no-eval`, `no-implied-eval`, `no-script-url`, `no-throw-literal`) is enforced on all frontend code in every CI run.

---

## Pre-commit / Pre-push Hooks (Local Development)

[Husky](https://typicode.github.io/husky/) hooks in `.husky/` prevent broken code from being committed or pushed.

### Setup

```bash
# From the repo root
npm install        # installs husky from package.json
npx husky          # installs the git hooks
```

Hooks installed:

| Hook | Action |
|---|---|
| `pre-commit` | Runs `npm run lint` in `frontend/` |
| `pre-push` | Runs `npm test` in both `backend/` and `frontend/` |

---

## CI/CD Pipeline

The `.github/workflows/ci.yml` pipeline runs on every push and pull request:

1. **Backend job** — dependency install, security audit, syntax check, tests
2. **Frontend job** — dependency install, production-dep audit, lint, tests, build
3. **Security job** — scans for committed `.env` files and hardcoded secret patterns
4. **Integration job** — starts the real backend server and validates:
   - `/health` endpoint responds correctly
   - Required security headers are present
   - CORS reflects allowed origins and rejects arbitrary ones
   - Wildcard CORS is not in use
5. **Deploy-check job** (main branch only) — runs `scripts/deploy-safety-check.js`

---

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public GitHub issue.  Instead, email the maintainer directly or open a private [GitHub Security Advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability).

We aim to acknowledge reports within 48 hours and provide a fix within 14 days for critical issues.
