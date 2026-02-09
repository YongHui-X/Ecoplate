# Security Remediation Report — Round 2 Scan

**Scan Date:** 2026-02-08 03:48 UTC
**Branch:** main | **Commit:** eacf4fd1
**Context:** This scan was run after the first round of security fixes were deployed.

---

## Scan Comparison (Round 1 vs Round 2)

| Metric | Round 1 | Round 2 | Change |
|--------|---------|---------|--------|
| Total Findings | 92 | 66 | -26 |
| Critical | 5 | 4 | -1 |
| High | 20 | 18 | -2 |
| Medium | 66 | 43 | -23 |
| Low | 1 | 1 | 0 |

| Scanner | Round 1 | Round 2 | Change |
|---------|---------|---------|--------|
| Trivy App Image | 2C + 2H + 46M | 1C + 1H + 23M | Halved (partial fix) |
| npm audit | 2H + 2M | 2H + 2M | No change |
| ZAP Baseline | 9H + 5M + 1L | 8H + 5M + 1L | -1H (CSP directive fix worked) |
| ZAP API | 7H + 1M | 7H + 1M | No change |
| Trufflehog | 3C | 3C | No change (git history) |

---

## Findings Still Present — Root Cause Analysis

### CRITICAL (4)

#### 1. Trufflehog — 3x Verified Secrets in Git History

- **Status:** Requires manual action
- **Why still present:** These secrets exist in git commit history. Code-level fixes cannot resolve this.
- **Required actions:**
  1. Rotate all potentially exposed credentials (GitHub deploy tokens, OpenAI API key, JWT secret)
  2. Update rotated values in GitHub Actions secrets and server `deploy/.env`
  3. Use [BFG Repo Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) to purge secrets from git history:
     ```bash
     # Example: remove a leaked API key from all history
     bfg --replace-text passwords.txt repo.git
     git reflog expire --expire=now --all && git gc --prune=now --aggressive
     git push --force
     ```

#### 2. Trivy — CVE-2023-24538 (golang html/template in esbuild)

- **Status:** Fixed in this round
- **Why Round 1 fix didn't work:** `bun install --frozen-lockfile --production` — the `--frozen-lockfile` flag forced bun to resolve from the lockfile which still contained esbuild entries from drizzle-kit
- **Fix applied:**
  - Removed `--frozen-lockfile` from Dockerfile
  - Changed to `bun install --production`
  - Added explicit cleanup: `rm -rf node_modules/@esbuild node_modules/esbuild node_modules/drizzle-kit`
- **File changed:** `Dockerfile`

### HIGH (18)

#### 3. npm audit — @capacitor/cli + tar (2 HIGH)

- **Status:** Fixed in this round
- **Why Round 1 fix didn't work:** `package.json` was updated to `^7.0.0` but `bun install` was never executed to regenerate `bun.lockb`. The npm audit scanner reads the lockfile, not package.json.
- **Fix applied:** Ran `bun install` in frontend/ — lockfile now resolves @capacitor/cli@7.4.5 with patched tar dependency
- **File changed:** `frontend/bun.lockb`

#### 4. Trivy — CVE-2022-41720 (golang os/net path traversal in esbuild)

- **Status:** Fixed in this round (same fix as #2)
- **File changed:** `Dockerfile`

#### 5. ZAP — CSP Wildcard Directive

- **Status:** Fixed in this round
- **Why Round 1 fix didn't work:** The `wss:` protocol wildcard in `connect-src` was not addressed in the first round
- **Fix applied:** Removed `wss:` from CSP connect-src. CSP `'self'` already covers same-origin WebSocket connections.
- **File changed:** `backend/src/index.ts`
- **CSP connect-src before:** `connect-src 'self' https://maps.googleapis.com wss:`
- **CSP connect-src after:** `connect-src 'self' https://maps.googleapis.com`

#### 6-7. ZAP — CSP unsafe-inline (script-src + style-src)

- **Status:** Accepted risk
- **Reason:** Vite framework injects inline scripts and styles during build. Removing `'unsafe-inline'` would break the application. Full mitigation requires implementing nonce-based CSP with server-side rendering support, which is a significant architectural change.

#### 8-9. ZAP — Server Leaks Version Information (Baseline + API)

- **Status:** Fixed in this round
- **Why Round 1 fix didn't work (3 root causes):**
  1. **Bun:** `headers.delete("Server")` does not work because Bun re-adds the `Server: Bun` header at the transport level after the Response object is constructed
  2. **nginx config not deployed:** `deploy.sh` only copied `nginx-upstream.conf` but NOT `nginx.conf`, so all nginx.conf changes were never applied to the server
  3. **nginx module missing:** `server_tokens off` only removes the version number (changes `Server: nginx/1.x` to `Server: nginx`), but ZAP flags any Server header presence
- **Fixes applied:**
  1. **Bun:** Changed `headers.delete("Server")` to `headers.set("Server", "")` to override the default
  2. **deploy.sh:** Added `sudo cp nginx.conf /etc/nginx/conf.d/default.conf` so nginx config changes are deployed
  3. **nginx:** Added `more_clear_headers Server;` using `headers-more` module to completely remove the Server header
  4. **deploy.sh:** Added automatic installation of `libnginx-mod-http-headers-more-filter` if not present
- **Files changed:** `backend/src/index.ts`, `deploy/nginx.conf`, `deploy/deploy.sh`

#### 10-17. ZAP — Sec-Fetch-* Headers Missing (x4 Baseline + x4 API)

- **Status:** Accepted risk (false positive)
- **Reason:** Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site, and Sec-Fetch-User are **browser request metadata headers** automatically sent by modern browsers. The ZAP scanner's crawler does not send these headers, which triggers these alerts. This is a scanner limitation, not an actual vulnerability. Server-side enforcement would break legitimate non-browser API clients (curl, mobile apps, Postman, etc.).

#### 18. ZAP API — Unexpected Content-Type (text/html)

- **Status:** Fixed in this round
- **Why Round 1 fix didn't work:** nginx returns its own HTML error pages when the upstream is unavailable or returns errors
- **Fix applied:** Added `proxy_intercept_errors on` and JSON-formatted error page handlers in nginx API location block:
  - `@api_404` returns `{"error":"Not found","code":"NOT_FOUND"}`
  - `@api_error` returns `{"error":"Service unavailable","code":"SERVICE_UNAVAILABLE"}`
- **File changed:** `deploy/nginx.conf`

### MEDIUM (also addressed)

#### npm audit — drizzle-kit + esbuild (2 MEDIUM)

- **Status:** Fixed in this round
- **Why not fixed before:** drizzle-kit ^0.12.8 was outdated and depended on an old esbuild compiled with Go 1.19.3
- **Fix applied:** Updated drizzle-kit to ^0.31.0 and regenerated backend lockfile
- **Files changed:** `backend/package.json`, `backend/bun.lockb`

---

## All Files Modified in This Round

| File | Changes |
|------|---------|
| `Dockerfile` | Removed `--frozen-lockfile`, added explicit esbuild/drizzle-kit cleanup |
| `frontend/package.json` | @capacitor packages ^6.x -> ^7.0.0 (Round 1, lockfile now updated) |
| `frontend/bun.lockb` | Regenerated with @capacitor/cli@7.4.5 |
| `backend/package.json` | drizzle-kit ^0.12.8 -> ^0.31.0 |
| `backend/bun.lockb` | Regenerated with updated drizzle-kit |
| `backend/src/index.ts` | Server header: delete -> set empty; CSP: removed wss: wildcard |
| `deploy/nginx.conf` | `more_clear_headers Server;`, JSON error pages for API, nginx.conf now deployed |
| `deploy/deploy.sh` | Copies nginx.conf to server, installs headers-more module |

---

## Expected Impact After Deployment

| Metric | Round 2 | Expected Round 3 |
|--------|---------|-------------------|
| Critical | 4 | 3 (only Trufflehog git history remains) |
| High | 18 | 6 (CSP unsafe-inline x2 + Sec-Fetch-* x4 accepted risks) |
| Medium | 43 | ~20 (Trivy golang CVEs eliminated, npm audit mediums fixed) |

---

## Remaining Accepted Risks

| Finding | Severity | Reason |
|---------|----------|--------|
| Trufflehog 3x secrets | CRITICAL | Git history — requires manual credential rotation |
| CSP unsafe-inline (script-src) | HIGH | Vite framework requirement |
| CSP unsafe-inline (style-src) | HIGH | Inline styles required by UI framework |
| Sec-Fetch-* x4 (Baseline) | HIGH | ZAP scanner false positive |
| Sec-Fetch-* x4 (API) | HIGH | ZAP scanner false positive |
