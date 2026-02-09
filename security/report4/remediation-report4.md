# Security Remediation Report — Round 4 Scan

**Scan Date:** 2026-02-08 04:40 UTC
**Branch:** main | **Commit:** ff5bd03b
**Context:** This scan was run after merging dev into main. All previous code fixes are included in this build.

---

## Scan Comparison (Round 3 vs Round 4)

| Metric | Round 3 | Round 4 | Change |
|--------|---------|---------|--------|
| Total Findings | 55 | 61 | +6 |
| Critical | 4 | 4 | 0 |
| High | 18 | 18 | 0 |
| Medium | 32 | 37 | +5 |
| Low | 1 | 2 | +1 |

| Scanner | Round 3 | Round 4 | Change |
|---------|---------|---------|--------|
| Semgrep | 12M | 13M + 1L | +1M, +1L (new code from ecolocker) |
| Trivy App Image | 1C + 2H + 12M | 1C + 2H + 12M | No change |
| npm audit | 2H + 2M | 2H + 4M | +2M (new @esbuild-kit deps from drizzle-kit) |
| Checkov | PASS | 2M | +2M (new Dockerfile.nginx) |
| ZAP Baseline | 7H + 5M + 1L | 7H + 5M + 1L | No change |
| ZAP API | 7H + 1M | 7H + 1M | No change |
| Trufflehog | 3C | 3C | No change (git history) |

---

## Root Cause Analysis — Why Previous Fixes Did Not Take Effect

### 1. Nginx Configuration Never Updated on Server

**Impact:** ZAP Server version leak (2H), Unexpected Content-Type (1H), JSON error pages — all unfixed.

**Root Cause Chain:**
1. `deploy.sh` attempts to install `libnginx-mod-http-headers-more-filter` via `apt-get`
2. Installation likely failed silently (suppressed with `|| warn`)
3. `nginx.conf` uses `more_clear_headers Server;` which requires the headers-more module
4. `nginx -t` fails because the directive is unknown without the module
5. `nginx -s reload` never executes (chained with `&&`)
6. **Result:** Host nginx keeps the OLD configuration, none of the Round 1-3 nginx fixes were ever applied

**Evidence:** ZAP still reports Server version leak and text/html Content-Type for API errors — both should have been fixed by nginx.conf changes from Round 2.

### 2. Trivy Go Binary Cleanup Too Narrow

**Impact:** CVE-2024-24790 (CRITICAL), CVE-2023-39325 (HIGH), CVE-2025-58183 (HIGH) + 12 MEDIUM still present.

**Root Cause:** `grep -rl "Go BuildID" node_modules/` only searches `node_modules/`. The vulnerable Go binaries (compiled with Go 1.20.7 and Go 1.23.12) are located elsewhere in the Docker image — likely in the `oven/bun:1.2.5-alpine` base image's system directories (`/usr/local/bin/` or similar), not in `node_modules/`.

### 3. npm audit Scans devDependencies

**Impact:** 2H + 4M findings include development-only packages that never reach production.

**Root Cause:** CI runs `npm audit` without `--omit=dev`, so vulnerabilities in `@capacitor/cli`, `drizzle-kit`, `esbuild`, and `@esbuild-kit/*` (all devDependencies) are flagged. These packages are excluded from the production Docker image by `bun install --production`.

### 4. Checkov New Findings

**Impact:** 2 new MEDIUM findings.

**Root Cause:** `deploy/Dockerfile.nginx` was a new file added in the dev merge. It lacked `HEALTHCHECK` and `USER` instructions, which Checkov flags as security best practices.

---

## Fixes Applied in This Round

### Fix 1: Switch to Containerized Nginx (resolves 3+ HIGH)

**Problem:** Host nginx lacks headers-more module, causing all nginx config changes to silently fail.

**Solution:** Replace host nginx with a Docker container that has headers-more pre-installed.

**Changes:**

| File | Change |
|------|--------|
| `deploy/docker-compose.prod.yml` | Added `ecoplate-nginx` service with `build: Dockerfile.nginx`, port 80, on `ecoplate-net` network |
| `deploy/docker-compose.prod.yml` | Changed `ecoplate-app` from `ports: "3000:3000"` to `expose: "3000"` (internal only) |
| `deploy/nginx-upstream.conf` | Changed `server 127.0.0.1:3000;` to `server ecoplate-app:3000;` (Docker DNS) |
| `deploy/deploy.sh` | Removed host nginx steps (apt-get install, cp, nginx -t, reload). Added `systemctl stop nginx` to disable host nginx. Added `--build` flag to build nginx container. |

**Architecture change:**
```
Before: Client → Host nginx (port 80) → ecoplate-app container (port 3000)
After:  Client → nginx container (port 80) → ecoplate-app container (port 3000)
                 └── headers-more module pre-installed via Dockerfile.nginx
```

**Expected impact:**
- `more_clear_headers Server;` will now work → fixes ZAP Server version leak (2H)
- `proxy_intercept_errors on` + JSON error pages will now work → fixes ZAP Unexpected Content-Type (1H)
- All other nginx security headers will be properly applied

### Fix 2: Trivy Go Binary Cleanup — Broader Search (resolves up to 1C + 2H + 12M)

**Problem:** `grep -rl "Go BuildID" node_modules/` doesn't find Go binaries outside node_modules.

**Solution:** Added additional cleanup step scanning `/usr/local/bin/` and `/app/` in the Dockerfile production stage:

```dockerfile
# Remove any remaining Go binaries from entire image
RUN grep -rl "Go BuildID" /usr/local/bin/ /app/ 2>/dev/null | xargs rm -f 2>/dev/null || true
```

**File changed:** `Dockerfile`

**Note:** If the Go binaries are embedded in the Bun runtime itself (e.g., `/usr/local/bin/bun`), they cannot be removed without breaking the application. In that case, these CVEs must be accepted as base image vulnerabilities until Bun releases a version compiled with a patched Go stdlib.

### Fix 3: npm audit — Production Dependencies Only (resolves 4M, may resolve 2H)

**Problem:** `npm audit` scans all dependencies including devDependencies like `@capacitor/cli`, `drizzle-kit`, `esbuild`, which never reach the production image.

**Solution:** Added `--omit=dev` flag to npm audit commands in CI:

```yaml
npm audit --omit=dev --json > ../backend-audit.json 2>&1 || true
npm audit --omit=dev || true
```

**File changed:** `.github/workflows/ci.yml`

**Expected impact:**
- Backend: `drizzle-kit`, `esbuild`, `@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader` (4M) will no longer appear
- Frontend: `@capacitor/cli` and `tar` (2H) should disappear if they are devDependencies. If `@capacitor/cli` is in `dependencies`, they will remain.

### Fix 4: Dockerfile.nginx — Checkov Compliance (resolves 2M)

**Problem:** `deploy/Dockerfile.nginx` missing HEALTHCHECK and non-root USER.

**Solution:**
```dockerfile
USER nginx

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1
```

**File changed:** `deploy/Dockerfile.nginx`

### Fix 5: Security Report Branch Resolution (bug fix)

**Problem:** `workflow_run` chain (CI → CD → Security Report) loses the original branch info. CD's `head_branch` is always "main" because `workflow_run` workflows run on the default branch.

**Solution:**
- CD: Uploads `pipeline-metadata.json` artifact containing original branch and commit from CI
- Security Report: Downloads metadata artifact first, extracts real branch/commit, uses it for CI artifact downloads and report generation

**Files changed:** `.github/workflows/cd.yml`, `.github/workflows/security-report.yml`

---

## All Files Modified in This Round

| File | Changes |
|------|---------|
| `deploy/docker-compose.prod.yml` | Added nginx container service, app changed to expose-only |
| `deploy/nginx-upstream.conf` | `127.0.0.1:3000` → `ecoplate-app:3000` (Docker network) |
| `deploy/deploy.sh` | Stop host nginx, build+run containerized nginx, simplified |
| `deploy/Dockerfile.nginx` | Added `USER nginx` and `HEALTHCHECK` |
| `Dockerfile` | Broader Go binary cleanup: `/usr/local/bin/` + `/app/` |
| `.github/workflows/ci.yml` | npm audit `--omit=dev` |
| `.github/workflows/cd.yml` | Upload `pipeline-metadata` artifact |
| `.github/workflows/security-report.yml` | Read metadata for correct branch/commit resolution |

---

## Expected Impact After Deployment

| Metric | Round 4 | Expected Round 5 |
|--------|---------|-------------------|
| Critical | 4 | 3 (Trufflehog only; Trivy Go may be base image) |
| High | 18 | 8-10 (Server leak fixed, npm audit reduced) |
| Medium | 37 | ~18 (Checkov fixed, npm audit devDeps removed, Trivy reduced) |

### Breakdown of Expected Remaining Findings

| Finding | Severity | Status |
|---------|----------|--------|
| Trufflehog 3x secrets | 3x CRITICAL | Requires manual credential rotation |
| Trivy Go CVEs (if in Bun binary) | 1C + 2H | Accepted risk — base image vulnerability |
| CSP unsafe-inline (script-src) | HIGH | Accepted risk — Vite framework requirement |
| CSP unsafe-inline (style-src) | HIGH | Accepted risk — inline styles required |
| Sec-Fetch-* x4 (Baseline) | 4x HIGH | Accepted risk — ZAP scanner false positive |
| Sec-Fetch-* x4 (API) | 4x HIGH | Accepted risk — ZAP scanner false positive |

---

## Remaining Manual Actions

1. **Rotate compromised credentials** detected by Trufflehog (3 CRITICAL):
   - GitHub deploy token (GHCR_DEPLOY_TOKEN)
   - OpenAI API key
   - JWT_SECRET
   - Update in GitHub Actions secrets and server `deploy/.env`
   - Optionally purge from git history with BFG Repo Cleaner

2. **Verify after deployment:** Check that `curl -I http://<server>` no longer shows a `Server:` header

3. **If Trivy Go CVEs persist:** The Go binaries may be part of the Bun runtime itself. Options:
   - Upgrade to a newer Bun version when available
   - Add a `.trivyignore` file to accept base image CVEs
   - Switch to a distroless base image
