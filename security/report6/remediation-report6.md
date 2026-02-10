# Security Vulnerability Remediation Report — Round 6

**Project:** EcoPlate
**Date:** 2026-02-10
**Branch:** `dev`

---

## Vulnerabilities Resolved

### 1. JWT Token Detected in Test Files (High × 3)

**Rule:** `generic.secrets.security.detected-jwt-token.detected-jwt-token`
**Tool:** Semgrep
**Severity:** High
**CWE:** CWE-798 (Use of Hard-coded Credentials)

**Finding:** Test files contained hardcoded strings matching real JWT header format (`eyJhbGciOi...` = base64 of `{"alg":"HS256"}`), flagged as leaked credentials.

**Fix:** Replaced with non-JWT-format placeholder strings that preserve test logic.

| File | Line | Before | After |
|------|------|--------|-------|
| `frontend/src/pages/ListingDetailPage.test.tsx` | 370 | `[JWT-format token redacted]` | `header.payload.signature` |
| `frontend/src/pages/ListingDetailPage.test.tsx` | 413 | `[JWT-format token redacted]` | `test-header.test-payload.test-sig` |
| `backend/src/routes/__tests__/auth-nonfunctional.test.ts` | 108 | `[JWT-format token redacted]` | `malformed-header.invalid.signature` |

---

### 2. CSP: script-src unsafe-inline (Medium × 4)

**Plugin:** 10055
**Tool:** OWASP ZAP
**Severity:** Medium
**CWE:** CWE-693 (Protection Mechanism Failure)

**Finding:** `Content-Security-Policy` header included `'unsafe-inline'` in `script-src`, allowing arbitrary inline JavaScript execution and defeating XSS protection.

**Affected URLs:**
- `http://13.212.25.234`
- `http://13.212.25.234/`
- `http://13.212.25.234/robots.txt`
- `http://13.212.25.234/sitemap.xml`

**Fix:** Replaced `'unsafe-inline'` with nonce-based CSP in `backend/src/index.ts`.

- Added `generateNonce()` — 16-byte cryptographic random via `crypto.getRandomValues()`
- Added `injectNonce()` — injects `nonce="..."` into `<script>`, `<style>`, `<link rel="stylesheet">` tags in HTML
- Fetch handler intercepts HTML responses, injects nonce into body, sets nonce-based CSP header

**CSP Before:**
```
script-src 'self' 'unsafe-inline' https://maps.googleapis.com
```

**CSP After:**
```
script-src 'self' 'nonce-<random>' https://maps.googleapis.com
```

---

### 3. CSP: style-src unsafe-inline (Medium × 4)

**Plugin:** 10055
**Tool:** OWASP ZAP
**Severity:** Medium
**CWE:** CWE-693 (Protection Mechanism Failure)

**Finding:** `'unsafe-inline'` in `style-src` allows injected inline CSS, which can be exploited for data exfiltration.

**Affected URLs:** Same 4 URLs as Issue 2.

**Fix:** Same nonce mechanism applied to `style-src`.

**CSP Before:**
```
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
```

**CSP After:**
```
style-src 'self' 'nonce-<random>' https://fonts.googleapis.com
```

---

### 4. HTTP Only Site (Medium × 1)

**Plugin:** 10106
**Tool:** OWASP ZAP
**Severity:** Medium
**CWE:** CWE-311 (Missing Encryption of Sensitive Data)
**WASC:** WASC-4 (Insufficient Transport Layer Protection)

**Finding:** Site served only over HTTP. ZAP attempted `https://13.212.25.234/` and failed to connect. All traffic transmitted unencrypted.

**Fix:** Enabled HTTPS with HTTP-to-HTTPS redirect.

| File | Change |
|------|--------|
| `deploy/nginx.conf` | Added HTTPS server block (port 8443) with TLSv1.2/1.3, strong ciphers, HSTS header; HTTP server (port 8080) now returns 301 redirect to HTTPS |
| `deploy/Dockerfile.nginx` | Exposed port 8443, created `/etc/nginx/ssl` directory |
| `deploy/docker-compose.prod.yml` | Mapped `443:8443`, mounted SSL certificate volume |
| `deploy/deploy.sh` | Auto-generates self-signed SSL certificate on first deploy if none exists |

**Traffic flow after fix:**
```
HTTP:80  → 301 redirect → HTTPS:443
HTTPS:443 → nginx SSL termination → Bun:3000
```

**Headers added:**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

### 5. Proxy Disclosure (Medium × 1)

**Plugin:** 40025
**Tool:** OWASP ZAP
**Severity:** Medium
**CWE:** CWE-200 (Exposure of Sensitive Information)

**Finding:** TRACE/TRACK HTTP methods and unrestricted OPTIONS responses revealed proxy infrastructure details.

**Fix:** Blocked TRACE/TRACK methods and restricted OPTIONS handling at both nginx and application layers.

| File | Change |
|------|--------|
| `deploy/nginx.conf` | Added `if ($request_method ~* ^(TRACE\|TRACK)$) { return 405; }` in HTTPS server block |
| `backend/src/index.ts` | Added TRACE/TRACK blocking returning 405; restricted OPTIONS handling to `/api/` routes only |

---

### 6. Semgrep False Positive Suppressions (Info × 4)

**Tool:** Semgrep
**Severity:** Info (false positives)

**Finding:** Semgrep flagged several patterns that are safe in context:

| File | Rule | Justification | Fix |
|------|------|---------------|-----|
| `backend/src/index.ts` | `path-join-resolve-traversal` | The `safePath` function IS the path traversal guard — it validates resolved paths stay within the base directory | Added `nosemgrep` comment |
| `backend/src/utils/router.ts` | `detect-non-literal-regexp` | Route paths are developer-defined constants, not user input; no ReDoS risk | Added `nosemgrep` comment |
| `recommendation-engine/app.py` | `avoid_app_run_with_bad_host` | Flask binds `0.0.0.0` for Docker container networking; not exposed to public internet directly | Added `nosemgrep` comment |
| `e2e/helpers/driver.ts` | `path-join-resolve-traversal` | Filename is internally generated (`${name}-${timestamp}.png`), not user input | Added `nosemgrep` comment |

**Additional:** Excluded `security/` directory from Semgrep scanning in CI/CD config — old ZAP report HTML artifacts contained HTTP links that triggered false positives.

---

## Summary

| # | Vulnerability | Severity | Instances | Status |
|---|--------------|----------|-----------|--------|
| 1 | JWT token detected in test files | High | 3 | Fixed |
| 2 | CSP script-src unsafe-inline | Medium | 4 | Fixed |
| 3 | CSP style-src unsafe-inline | Medium | 4 | Fixed |
| 4 | HTTP Only Site | Medium | 1 | Fixed |
| 5 | Proxy Disclosure | Medium | 1 | Fixed |
| 6 | Semgrep false positive suppressions | Info | 4 | Suppressed |
| **Total** | | **3 High + 10 Medium + 4 Info** | **17** | **All Resolved** |
