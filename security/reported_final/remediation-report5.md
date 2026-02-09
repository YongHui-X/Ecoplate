# Consolidated Security Remediation Report

**Project:** EcoPlate
**Date:** 2026-02-08
**Scope:** 5 rounds of security scanning and remediation
**Initial Scan Commit:** `eacf4fd1` (main) | **Final Fix Commit:** `1539f9f` (dev)

---

## Executive Summary

Over 5 iterative scan-fix-verify cycles, we reduced the security findings from **92 to 21** and eliminated all **Critical** and **High** severity issues.

| Metric | Round 1 (Initial) | Round 5 (Final) | Reduction |
|--------|-------------------|-----------------|-----------|
| Total Findings | 92 | 21 | **-77%** |
| Critical | 5 | 0 | **-100%** |
| High | 20 | 0 | **-100%** |
| Medium | 66 | 17 | **-74%** |
| Low | 1 | 4 | +3 |
| Overall Status | FAIL | **WARN** | Improved |

---

## Progress Across All Rounds

| Round | Commit | Critical | High | Medium | Low | Total | Key Action |
|-------|--------|----------|------|--------|-----|-------|------------|
| 1 (Initial) | `eacf4fd1` | 5 | 20 | 66 | 1 | 92 | Baseline scan |
| 2 | `eacf4fd1` | 4 | 18 | 43 | 1 | 66 | First round fixes applied |
| 3 | `eacf4fd1` | 4 | 18 | 32 | 1 | 55 | Fixes on dev, not merged to main |
| 4 | `ff5bd03b` | 4 | 18 | 37 | 2 | 61 | Merged dev to main, new Trivy CVEs |
| 5 (Final) | `1539f9f` | 0 | 0 | 17 | 4 | 21 | All fixes deployed + report generator fixed |

---

## All Fixes Applied

### Category 1: Container Image Vulnerabilities (Trivy)

**Initial state:** 2 CRITICAL + 2 HIGH + 46 MEDIUM from Go binaries in esbuild/drizzle-kit
**Final state:** 0 CRITICAL + 0 HIGH + 0 MEDIUM

| # | Fix | Severity Resolved | Round | File Changed |
|---|-----|-------------------|-------|-------------|
| 1 | Changed Dockerfile from `COPY node_modules` to `bun install --production`, excluding devDependencies (drizzle-kit/esbuild) from production image | 2C + 2H | Round 1 | `Dockerfile` |
| 2 | Removed `--frozen-lockfile` flag which forced bun to resolve esbuild from stale lockfile | 1C + 1H | Round 2 | `Dockerfile` |
| 3 | Added explicit cleanup: `rm -rf node_modules/@esbuild node_modules/esbuild node_modules/drizzle-kit` | Preventive | Round 2 | `Dockerfile` |
| 4 | Pinned base image from floating `oven/bun:1.2-alpine` to `oven/bun:1.2.5-alpine` for reproducible builds | Prevents new CVEs | Round 3 | `Dockerfile` |
| 5 | Added Go binary cleanup: `grep -rl "Go BuildID"` across `node_modules/`, `/usr/local/bin/`, `/app/` | 1C + 2H + 12M | Round 4 | `Dockerfile` |
| 6 | Extended cleanup to `/root/.bun/install/cache/` — Bun's global cache contained esbuild Go binaries and bun-types docs with example Stripe key | 1C + 2H + 12M | Round 5 | `Dockerfile` |

**Root cause chain:** esbuild is a Go binary pulled as a transitive dependency of drizzle-kit (devDependency). Even with `--production` install, Bun cached it globally. The floating Docker tag also caused different Go binary versions between builds, introducing new CVEs each time.

---

### Category 2: Secret Detection (Trufflehog)

**Initial state:** 3 CRITICAL (verified secrets in git history)
**Final state:** 0 CRITICAL

| # | Fix | Severity Resolved | Round | File Changed |
|---|-----|-------------------|-------|-------------|
| 7 | Fixed report generator: Trufflehog parser was treating log/status JSON lines (`{"level":"info","msg":"..."}`) as secret findings. Added filter to only parse lines with `SourceMetadata`/`DetectorName` fields | 3C (false positives) | Round 5 | `.github/scripts/generate-security-report.py` |

**Note:** The actual Trufflehog scan found **0 verified secrets** in the latest run. The 3 CRITICAL shown in previous reports were caused by the report generator bug misinterpreting trufflehog's log output as secret findings.

---

### Category 3: JavaScript Dependency Vulnerabilities (npm audit)

**Initial state:** 2 HIGH + 2 MEDIUM
**Final state:** 0 HIGH + 1 MEDIUM

| # | Fix | Severity Resolved | Round | File Changed |
|---|-----|-------------------|-------|-------------|
| 8 | Upgraded `@capacitor/cli` from ^6.x to ^7.0.0 in frontend | 2H (capacitor + tar) | Round 1 | `frontend/package.json` |
| 9 | Ran `bun install` to regenerate lockfile (Round 1 only updated package.json, not lockfile) | Lockfile sync | Round 2 | `frontend/bun.lockb` |
| 10 | Upgraded `drizzle-kit` from ^0.12.8 to ^0.31.0 in backend | 2M (drizzle-kit + esbuild) | Round 2 | `backend/package.json`, `backend/bun.lockb` |
| 11 | Added `--omit=dev` to `npm audit` commands in CI — devDependencies never reach production image | 4M + 2H (false positives) | Round 4 | `.github/workflows/ci.yml` |

---

### Category 4: Content Security Policy (ZAP DAST)

**Initial state:** 4 HIGH (CSP missing directives, wildcards, unsafe-inline)
**Final state:** 2 MEDIUM (unsafe-inline accepted risk, correctly classified)

| # | Fix | Severity Resolved | Round | File Changed |
|---|-----|-------------------|-------|-------------|
| 12 | Added missing CSP directives: `form-action`, `base-uri`, `object-src`, `worker-src`, `manifest-src` for both API and SPA routes | 1H | Round 1 | `backend/src/index.ts` |
| 13 | Replaced CSP `https:` wildcards with explicit domains in `img-src` and `connect-src` | 1H | Round 1 | `backend/src/index.ts` |
| 14 | Removed `wss:` protocol wildcard from `connect-src` — `'self'` already covers same-origin WebSocket | 1H | Round 2 | `backend/src/index.ts` |
| 15 | Removed duplicate CSP header from nginx (backend handles context-aware CSP for API vs SPA) | Prevents conflicts | Round 1 | `deploy/nginx.conf` |

**Accepted risk:** `'unsafe-inline'` in `script-src` and `style-src` — required by Vite framework. Removal would require nonce-based CSP with server-side rendering.

---

### Category 5: Server Information Leak (ZAP DAST)

**Initial state:** 2 HIGH (Server header exposes Bun version)
**Final state:** 0 HIGH

| # | Fix | Severity Resolved | Round | File Changed |
|---|-----|-------------------|-------|-------------|
| 16 | Added `headers.delete("Server")` in backend `addSecurityHeaders()` | Attempted | Round 1 | `backend/src/index.ts` |
| 17 | Changed to `headers.set("Server", "")` — Bun re-adds the header after `delete()` | Backend fix | Round 2 | `backend/src/index.ts` |
| 18 | Added `proxy_hide_header Server` and `proxy_hide_header X-Powered-By` to nginx | Nginx fix | Round 1 | `deploy/nginx.conf` |
| 19 | Added `server_tokens off` to nginx to suppress version numbers | Nginx fix | Round 1 | `deploy/nginx.conf` |

**Root cause chain:** Three separate issues: (1) Bun ignores `headers.delete()` for Server header, (2) `deploy.sh` didn't copy nginx.conf to server, (3) host nginx lacked `headers-more` module. All resolved across Rounds 1-4.

---

### Category 6: API Error Handling (ZAP DAST)

**Initial state:** 1 HIGH (API returns HTML instead of JSON)
**Final state:** 0 HIGH (correctly classified as Low)

| # | Fix | Severity Resolved | Round | File Changed |
|---|-----|-------------------|-------|-------------|
| 20 | Added `proxy_intercept_errors on` in nginx API location block | 1H | Round 2 | `deploy/nginx.conf` |
| 21 | Added JSON error handlers: `@api_404` returns `{"error":"Not found"}`, `@api_error` returns `{"error":"Service unavailable"}` | 1H | Round 2 | `deploy/nginx.conf` |

---

### Category 7: Nginx Infrastructure

**Initial state:** Multiple security headers not applied; all nginx config changes silently failing
**Final state:** All nginx security headers properly applied via containerized nginx

| # | Fix | Severity Resolved | Round | File Changed |
|---|-----|-------------------|-------|-------------|
| 22 | Added H2C smuggling prevention: validate WebSocket `Upgrade` header in `/ws` location | 1M (Semgrep) | Round 1 | `deploy/nginx.conf` |
| 23 | Fixed header-redefinition: added `always` flag to location-level `add_header` directives | 1M (Semgrep) | Round 1 | `deploy/nginx.conf` |
| 24 | Added `Cross-Origin-Resource-Policy: same-origin` to mitigate Spectre side-channel | 1M (ZAP) | Round 1 | `deploy/nginx.conf`, `backend/src/index.ts` |
| 25 | **Switched to containerized nginx** — host nginx lacked `headers-more` module, causing ALL nginx config changes to silently fail for Rounds 1-4 | 3H (Server leak x2, Content-Type x1) | Round 4 | `deploy/docker-compose.prod.yml`, `deploy/Dockerfile.nginx`, `deploy/deploy.sh`, `deploy/nginx-upstream.conf` |
| 26 | Replaced `more_clear_headers Server` (requires headers-more module) with built-in `proxy_hide_header Server` | Compatibility fix | Round 5 | `deploy/nginx.conf` |

**Root cause (Round 4 discovery):** `apt-get install libnginx-mod-http-headers-more-filter` failed silently on EC2. The `more_clear_headers` directive caused `nginx -t` to fail, preventing `nginx -s reload`. **Every nginx change from Rounds 1-3 was never applied.** Fixed by containerizing nginx with known-good configuration.

---

### Category 8: ZAP Scanner False Positives (Sec-Fetch-* Headers)

**Initial state:** 8 HIGH (4 Baseline + 4 API)
**Final state:** 0 (suppressed in report generator)

| # | Fix | Severity Resolved | Round | File Changed |
|---|-----|-------------------|-------|-------------|
| 27 | Added `ZAP_SUPPRESSED_ALERTS` set to skip known scanner noise: Sec-Fetch-Dest/Mode/Site/User and Modern Web Application alerts | 8H (false positives) | Round 5 | `.github/scripts/generate-security-report.py` |

**Rationale:** Sec-Fetch-* are browser request metadata headers automatically sent by browsers. ZAP's crawler does not send them. Server-side enforcement would break non-browser API clients.

---

### Category 9: Security Report Generator Bugs

**Initial state:** Report inflated severity counts; showed stale data
**Final state:** Report correctly reflects actual scan results

| # | Fix | Impact | Round | File Changed |
|---|-----|--------|-------|-------------|
| 28 | **ZAP severity mapping:** Changed from `riskdesc` text parsing to `riskcode` numeric mapping. `riskdesc` format is `"Risk (Confidence)"` — parser confused confidence "High" with severity "HIGH" (e.g. `"Informational (High)"` was mapped as HIGH) | -12H (false inflation) | Round 5 | `.github/scripts/generate-security-report.py` |
| 29 | **Trufflehog parser:** Added filter to skip log/status lines that have `level`/`msg` fields. Only lines with `SourceMetadata`/`DetectorName` are actual secret findings | -3C (false inflation) | Round 5 | `.github/scripts/generate-security-report.py` |
| 30 | **Branch resolution:** Fixed double `workflow_run` chain (CI→CD→Security Report) losing original branch info. CD now uploads `pipeline-metadata.json` artifact | Bug fix | Round 4 | `.github/workflows/cd.yml`, `.github/workflows/security-report.yml` |

---

### Category 10: CI/CD Pipeline Improvements

| # | Fix | Impact | Round | File Changed |
|---|-----|--------|-------|-------------|
| 31 | Added `HEALTHCHECK` instruction to `deploy/Dockerfile.nginx` | Checkov compliance | Round 4 | `deploy/Dockerfile.nginx` |
| 32 | Updated `deploy.sh` to stop host nginx, use containerized nginx with `--build` flag | Deployment reliability | Round 4 | `deploy/deploy.sh` |
| 33 | Changed `ecoplate-app` from `ports: "3000:3000"` to `expose: "3000"` (internal only behind nginx) | Reduced attack surface | Round 4 | `deploy/docker-compose.prod.yml` |
| 34 | Upgraded `zaproxy/action-baseline` from `v0.14.0` to `v0.15.0` to fix `exit code 3` Docker error | ZAP scan reliability | Round 5 | `.github/workflows/cd.yml` |

---

## All Files Modified

| File | Rounds Modified | Summary of Changes |
|------|----------------|-------------------|
| `Dockerfile` | 1, 2, 3, 4, 5 | Production-only install, pinned base image, Go binary cleanup across all paths including Bun cache |
| `backend/src/index.ts` | 1, 2 | Enhanced CSP (directives, explicit domains, removed wildcards), Server header override, CORP header |
| `deploy/nginx.conf` | 1, 2, 4, 5 | Security headers, CSP delegation to backend, H2C protection, JSON error pages, proxy_hide_header |
| `deploy/docker-compose.prod.yml` | 4 | Added containerized nginx service, app changed to expose-only |
| `deploy/Dockerfile.nginx` | 4, 5 | Created for containerized nginx, added HEALTHCHECK |
| `deploy/deploy.sh` | 2, 4 | Stop host nginx, containerized nginx deployment |
| `deploy/nginx-upstream.conf` | 4 | Changed from `127.0.0.1:3000` to `ecoplate-app:3000` (Docker DNS) |
| `frontend/package.json` | 1 | @capacitor packages ^6.x → ^7.0.0 |
| `frontend/bun.lockb` | 2 | Regenerated with updated @capacitor/cli |
| `backend/package.json` | 2 | drizzle-kit ^0.12.8 → ^0.31.0 |
| `backend/bun.lockb` | 2 | Regenerated with updated drizzle-kit |
| `.github/workflows/ci.yml` | 4 | npm audit `--omit=dev` |
| `.github/workflows/cd.yml` | 4, 5 | Pipeline metadata artifact, ZAP action upgrade |
| `.github/workflows/security-report.yml` | 4 | Metadata-based branch resolution |
| `.github/scripts/generate-security-report.py` | 5 | Fixed ZAP severity mapping, Trufflehog parser, ZAP alert suppression |

---

## Remaining Findings (21 total — all Medium or Low)

| Scanner | Severity | Count | Finding | Status |
|---------|----------|-------|---------|--------|
| Semgrep | Medium | 4 | `workflow_run` + `checkout` pattern in CD/Security Report workflows | Accepted — required for `workflow_run` pipelines |
| Semgrep | Medium | 2 | Path traversal in `path.join` (backend) | Accepted — input is validated before path operations |
| Semgrep | Medium | 1 | X-Frame-Options via user input (backend) | Accepted — hardcoded value, not user-controlled |
| Semgrep | Medium | 1 | Non-literal RegExp in router | Accepted — route patterns are developer-defined |
| Semgrep | Medium | 2 | Nginx header-redefinition | Accepted — `always` flag applied, inherent to nginx `add_header` behavior |
| Semgrep | Medium | 1 | Nginx H2C smuggling pattern | Accepted — WebSocket Upgrade validation is in place |
| Semgrep | Medium | 1 | Flask `host=0.0.0.0` | Accepted — runs inside Docker container, not exposed directly |
| Semgrep | Medium | 1 | Hardcoded `TESTING=True` in test file | Accepted — test configuration, not production code |
| Semgrep | Low | 1 | Unsafe format string in locker-service | Accepted — internal logging, not user-facing |
| npm audit | Medium | 1 | esbuild (backend) | DevDependency — excluded from production image |
| Checkov | Medium | 1 | Dockerfile.nginx missing `USER` instruction | Accepted — nginx requires root for port 80 binding |
| ZAP Baseline | Medium | 2 | CSP `unsafe-inline` (script-src, style-src) | Accepted — Vite framework requirement |
| ZAP Baseline | Low | 1 | Insufficient Site Isolation (missing COEP/COOP) | Accepted — would break Google Maps cross-origin resources |
| ZAP Baseline | Low | 1 | Private IP Disclosure (`10.0.2.2:3000` in JS bundle) | Low risk — Android emulator default, no production impact |
| ZAP API | Low | 1 | Unexpected Content-Type (non-API paths return HTML) | Expected — SPA serves HTML for non-API routes |

---

## Key Lessons Learned

1. **Floating Docker tags cause non-deterministic builds.** `oven/bun:1.2-alpine` resolved to different images between builds, introducing new CVEs. Always pin to specific versions.

2. **nginx config changes require end-to-end deployment verification.** Four rounds of nginx fixes were silently dropped because the host nginx lacked a required module. Containerizing nginx eliminated this class of deployment failures.

3. **Security report generators can inflate severity counts.** The ZAP `riskdesc` field contains both risk and confidence levels (`"Informational (High)"`). Parsing this as a string and matching "high" led to 12 false HIGH findings. Using numeric `riskcode` is the correct approach.

4. **Lockfile synchronization matters.** Updating `package.json` without running `bun install` leaves the lockfile stale. npm audit reads the lockfile, not package.json.

5. **`workflow_run` chains lose context.** A double `workflow_run` chain (CI→CD→Security Report) always reports the default branch, not the triggering branch. Solved by passing metadata through artifacts.
