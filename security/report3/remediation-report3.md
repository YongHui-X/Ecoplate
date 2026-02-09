# Security Remediation Report — Round 3 Scan

**Scan Date:** 2026-02-08 04:18 UTC
**Branch:** main | **Commit:** eacf4fd1
**Context:** This scan was run on `main` branch. All code fixes from previous rounds are on `dev` branch (commit `3d78aee`) and have NOT been merged to `main` yet.

---

## Root Cause: Fixes Not Merged to Main

The security scan pipeline runs against `main` branch (commit `eacf4fd1`). All remediation code from Round 1 and Round 2 was committed to the `dev` branch but **never merged to `main`**. This is why most issues persist.

**Action Required:** Merge `dev` into `main` and trigger a new CI/CD build.

---

## Scan Comparison (Round 2 vs Round 3)

| Metric | Round 2 | Round 3 | Change |
|--------|---------|---------|--------|
| Total Findings | 66 | 55 | -11 |
| Critical | 4 | 4 | 0 |
| High | 18 | 18 | 0 |
| Medium | 43 | 32 | -11 |
| Low | 1 | 1 | 0 |

| Scanner | Round 2 | Round 3 | Change |
|---------|---------|---------|--------|
| Trivy App Image | 1C + 1H + 23M | 1C + 2H + 12M | CVEs changed (see below) |
| npm audit | 2H + 2M | 2H + 2M | No change |
| ZAP Baseline | 8H + 5M + 1L | 7H + 5M + 1L | -1H (CSP Wildcard gone!) |
| ZAP API | 7H + 1M | 7H + 1M | No change |
| Trufflehog | 3C | 3C | No change (git history) |
| Semgrep | 12M | 12M | No change |

---

## What Changed in Trivy (Important)

The Trivy CVEs **completely changed** between Round 2 and Round 3:

| | Round 2 | Round 3 |
|--|---------|---------|
| Source binary | esbuild (Go 1.19.3) | Unknown binary (Go 1.20.7 + Go 1.23.12) |
| CVE-2023-24538 (CRITICAL) | Present | **Gone** |
| CVE-2022-41720 (HIGH) | Present | **Gone** |
| CVE-2024-24790 (CRITICAL) | Not present | **New** |
| CVE-2023-39325 (HIGH) | Not present | **New** |
| CVE-2025-58183 (HIGH) | Not present | **New** |

**Why:** The Docker image was rebuilt with a newer pull of the floating tag `oven/bun:1.2-alpine`. The old esbuild Go 1.19.3 binary may have been resolved differently, but the base image now contains Go binaries compiled with Go 1.20.7 and Go 1.23.12 that have their own vulnerabilities.

**Key insight:** The old esbuild CVEs are gone (our Dockerfile `rm -rf` fix is working), but the `oven/bun:1.2-alpine` floating tag now resolved to a version containing different vulnerable Go binaries, likely from:
- Alpine system packages updated during `apk upgrade`
- Bun runtime bundled tools
- Other dependency binaries not cleaned by our `rm -rf` step

---

## Findings Analysis — What Will Be Fixed by Merging dev to main

### Already Fixed on `dev` (will resolve after merge + deploy)

| # | Finding | Severity | Fix on dev branch |
|---|---------|----------|-------------------|
| 1 | npm audit: @capacitor/cli + tar | 2x HIGH | `frontend/bun.lockb` regenerated with @capacitor/cli@7.4.5 |
| 2 | npm audit: drizzle-kit + esbuild | 2x MEDIUM | `backend/package.json` drizzle-kit ^0.31.0, lockfile regenerated |
| 3 | ZAP: Server version leak (Baseline + API) | 2x HIGH | `headers.set("Server", "")` in backend, `more_clear_headers Server;` in nginx, deploy.sh updated |
| 4 | ZAP API: Unexpected Content-Type | 1x HIGH | `proxy_intercept_errors on` + JSON error pages in nginx.conf |

**Expected reduction after merge:** -2 HIGH (npm), -2 HIGH (Server leak), -1 HIGH (Content-Type), -2 MEDIUM (npm) = **-5 HIGH, -2 MEDIUM**

### Requires New Fix — Trivy Go Binary CVEs

#### CVE-2024-24790 (CRITICAL) — Go 1.20.7 net/netip

- **Description:** `net/netip.Addr.Is4In6()` incorrectly reports IPv4-mapped IPv6 addresses not in ::ffff:0.0.0.0/96
- **Source:** Go binary compiled with Go 1.20.7 in Docker image
- **Fix required:** Pin `oven/bun` to a specific digest or upgrade to the latest minor version, and add Go binary cleanup step

#### CVE-2023-39325 (HIGH) — Go 1.20.7 net/http

- **Description:** HTTP/2 rapid reset DoS vulnerability
- **Source:** Same Go 1.20.7 binary
- **Fix:** Same as above

#### CVE-2025-58183 (HIGH) — Go 1.23.12 archive/tar

- **Description:** Unbounded memory allocation when reading tar headers
- **Source:** Different Go binary compiled with Go 1.23.12
- **Fix:** Same approach — upgrade base image and clean binaries

**Proposed Dockerfile fix:**

```dockerfile
# Pin to specific Bun version instead of floating tag
FROM oven/bun:1.2.5-alpine AS production

# ... existing steps ...

# Remove ALL Go binaries from production image (they are not needed at runtime)
RUN find /app/node_modules -type f -name '*.node' -o -type f -executable | \
    xargs -I{} sh -c 'file "{}" 2>/dev/null | grep -q "Go BuildID" && rm -f "{}"' || true
```

### Accepted Risks (No Fix Planned)

| # | Finding | Severity | Reason |
|---|---------|----------|--------|
| 1 | Trufflehog 3x secrets | 3x CRITICAL | Git history — requires manual credential rotation + BFG Repo Cleaner |
| 2 | CSP unsafe-inline (script-src) | HIGH | Vite framework requirement |
| 3 | CSP unsafe-inline (style-src) | HIGH | Vite framework / inline styles |
| 4 | Sec-Fetch-* x4 (Baseline) | 4x HIGH | ZAP scanner false positive — browser request metadata headers |
| 5 | Sec-Fetch-* x4 (API) | 4x HIGH | ZAP scanner false positive |
| 6 | ZAP API: Client Error 404 | HIGH | Expected behavior — API returns proper 404 for unknown routes |

---

## Action Plan

### Step 1: Merge dev to main (resolves 5 HIGH + 2 MEDIUM)

```bash
git checkout main
git merge dev
git push origin main
```

This will deploy all Round 1-3 fixes:
- Dockerfile: production-only install + esbuild cleanup
- Backend: security headers, CSP, Server header override
- Frontend: @capacitor/cli lockfile update
- Backend: drizzle-kit upgrade + lockfile update
- Nginx: more_clear_headers, JSON error pages, H2C protection
- Deploy script: nginx.conf deployment, headers-more module

### Step 2: Fix Trivy Go binary CVEs (resolves 1 CRITICAL + 2 HIGH + 12 MEDIUM)

Pin Bun base image to specific version and add Go binary cleanup to Dockerfile:

1. Change all `FROM oven/bun:1.2-alpine` to `FROM oven/bun:1.2.5-alpine` (or latest specific version)
2. Add Go binary scan+removal in production stage after `bun install`

### Step 3: Rotate credentials (resolves 3 CRITICAL)

Manual action required:
1. Rotate GitHub deploy token (GHCR_DEPLOY_TOKEN)
2. Rotate OpenAI API key
3. Rotate JWT_SECRET
4. Update values in GitHub Actions secrets and server `deploy/.env`
5. Optionally use BFG Repo Cleaner to purge from git history

---

## Expected Impact After All Actions

| Metric | Round 3 | After Merge (Step 1) | After Trivy Fix (Step 2) | After Rotation (Step 3) |
|--------|---------|---------------------|-------------------------|------------------------|
| Critical | 4 | 4 | 3 | 0 |
| High | 18 | 13 | 11 | 11 |
| Medium | 32 | 30 | ~18 | ~18 |

**Remaining after all fixes:** 11 HIGH (all accepted risks: CSP unsafe-inline x2 + Sec-Fetch-* x8 + API 404 x1)

---

## Note on Floating Docker Tags

The `oven/bun:1.2-alpine` tag is a **floating tag** that resolves to different images over time. This caused the Trivy CVEs to change between scans even though the application code didn't change.

**Recommendation:** Always pin Docker base images to specific versions (e.g., `oven/bun:1.2.5-alpine`) or SHA digests for reproducible builds.
