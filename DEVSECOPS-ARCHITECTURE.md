<!-- NOSONAR -->
# EcoPlate DevSecOps Architecture

## Toolchain Overview

| Layer | Tool | Purpose |
|-------|------|---------|
| Source Control | GitHub | Repository hosting, branch protection |
| Code Quality | SonarQube | Code smells, bugs, vulnerabilities, coverage |
| Secret Scanning | Gitleaks | Detects leaked credentials in git history |
| SAST (JS/TS) | SonarQube | Static analysis for TypeScript/React code |
| SAST (Python) | Bandit | Static analysis for Flask recommendation engine |
| Dependency Audit (JS) | osv-scanner | Known CVEs in npm packages |
| Dependency Audit (Python) | pip-audit | Known CVEs in PyPI packages |
| Container Scanning | Trivy | CVEs in Docker images (OS packages + deps) |
| DAST | OWASP ZAP | Baseline scan against live deployment |
| CI/CD | GitHub Actions | Automated pipeline orchestration |
| Container Registry | GitHub Container Registry (GHCR) | Docker image storage |
| Deployment | Docker + Blue-Green | Zero-downtime deployment on AWS EC2 |
| Reverse Proxy | Nginx | Rate limiting, security headers, traffic switching |

---

## Pipeline Architecture Diagram

```mermaid
flowchart LR
    subgraph DEV["Developer"]
        A["git push / PR"]
    end

    subgraph CI["CI Pipeline — GitHub Actions"]
        direction TB
        B1["Typecheck Backend"]
        B2["Typecheck Frontend"]
        B3["Test Backend"]
        B4["Test Frontend"]
        B5["Test Recommendation Engine"]
        B6["Build Frontend"]
        B7["Secret Scan\n(Gitleaks)"]
        B8["Python SAST\n(Bandit)"]
        B9["Python Deps\n(pip-audit)"]
        B10["JS Deps\n(osv-scanner)"]
    end

    subgraph GATE["Deployment Gate"]
        C["push-to-deployment"]
    end

    subgraph CD["CD Pipeline — GitHub Actions"]
        direction TB
        D1["Build & Push\nDocker Images\n(GHCR)"]
        D2["Container Scan\n(Trivy)"]
        D3["Deploy to EC2\n(Blue-Green)"]
        D4["DAST Scan\n(OWASP ZAP)"]
    end

    subgraph EC2["AWS EC2"]
        direction TB
        E1["Nginx\n(Reverse Proxy)"]
        E2["Blue Environment\n:3001 / :5001"]
        E3["Green Environment\n:3002 / :5002"]
        E4["SQLite Volume\n(Shared)"]
    end

    subgraph EXT["External"]
        F1["SonarQube\n(GitHub Integration)"]
    end

    A --> CI
    A --> F1
    B1 & B2 & B3 & B4 & B5 & B6 & B7 --> C
    B8 & B9 & B10 -.->|informational| C
    C -->|"push to deployment branch"| D1
    D1 --> D2
    D2 -->|"PASS"| D3
    D2 -->|"FAIL\n(HIGH/CRITICAL CVE)"| X["Block Deploy"]
    D3 --> D4
    D3 --> EC2
    E1 --> E2
    E1 --> E3
    E2 --> E4
    E3 --> E4
```

---

## CI Pipeline Detail (ci.yml)

Triggers on: **push to main** or **pull request to main**

```mermaid
flowchart TB
    subgraph PARALLEL["All jobs run in parallel"]
        direction LR
        subgraph EXISTING["Existing Quality Checks"]
            T1["Typecheck Backend\nbunx tsc --noEmit"]
            T2["Typecheck Frontend\nbunx tsc --noEmit"]
            T3["Test Backend\nbun test"]
            T4["Test Frontend\nvitest run"]
            T5["Test Recommendation\npytest"]
            T6["Build Frontend\nvite build"]
        end
        subgraph SECURITY["Security Scans"]
            S1["Gitleaks\nSecret Detection\nBLOCKING"]
            S2["Bandit\nPython SAST\ninformational"]
            S3["pip-audit\nPython Deps\ninformational"]
            S4["osv-scanner\nJS Deps\ninformational"]
        end
    end

    PARALLEL --> GATE{"All blocking\njobs pass?"}
    GATE -->|Yes + push event| DEPLOY["Force-push to\ndeployment branch"]
    GATE -->|No| FAIL["Pipeline fails\nPR blocked"]
    GATE -->|PR event| DONE["PR checks complete\n(no deploy)"]
```

**Blocking jobs** (must pass to deploy): Typecheck Backend, Typecheck Frontend, Test Backend, Test Frontend, Test Recommendation, Build Frontend, Secret Scan (Gitleaks).

**Informational jobs** (produce reports, do not block): Bandit, pip-audit, osv-scanner.

All security scan results are uploaded as **GitHub Actions artifacts** (30-day retention).

---

## CD Pipeline Detail (cd.yml)

Triggers on: **push to deployment branch** (auto-triggered by CI)

```mermaid
flowchart TB
    A["Build & Push Images\n(Docker Buildx + GHCR)"] --> B["Container Image Scan\n(Trivy)"]
    B -->|"HIGH/CRITICAL found"| X["BLOCKED\nDeploy halted\nReport uploaded"]
    B -->|"Clean"| C["Deploy to EC2\n(SCP + SSH)"]
    C --> D["Blue-Green Switch\n(deploy.sh)"]
    D --> E["Health Checks\n(30 retries x 5s)"]
    E -->|"Healthy"| F["Switch Nginx\nTraffic"]
    E -->|"Unhealthy"| G["Auto-rollback\nOld env stays active"]
    F --> H["OWASP ZAP\nBaseline Scan"]
    H --> I["Upload ZAP Report\n(HTML + JSON + MD)"]
```

### Docker Images

| Image | Registry | Tags |
|-------|----------|------|
| `ecoplate-app` | `ghcr.io/{owner}/ecoplate-app` | `:{commit-sha}`, `:latest` |
| `ecoplate-recommendation` | `ghcr.io/{owner}/ecoplate-recommendation` | `:{commit-sha}`, `:latest` |

### Trivy Scan Policy

- **Severity:** HIGH and CRITICAL only
- **Action on finding:** Fail pipeline, block deployment
- **Reports:** Uploaded as text artifacts

### ZAP Scan Policy

- **Type:** Passive baseline scan
- **Action on finding:** Non-blocking (continue-on-error)
- **Reports:** HTML, JSON, and Markdown uploaded as artifacts

---

## Blue-Green Deployment Architecture

```mermaid
flowchart TB
    USERS["Users\n(Port 80)"] --> NGINX["Nginx\nReverse Proxy"]

    NGINX -->|"active"| BLUE
    NGINX -.->|"standby"| GREEN

    subgraph BLUE["Blue Environment"]
        BA["ecoplate-blue\n:3001"]
        BR["recommendation-blue\n:5001"]
    end

    subgraph GREEN["Green Environment"]
        GA["ecoplate-green\n:3002"]
        GR["recommendation-green\n:5002"]
    end

    subgraph SHARED["Shared Resources"]
        DB["SQLite Database\n(Docker Volume:\necoplate-data)"]
    end

    BA --> DB
    GA --> DB
```

### Deployment Flow

1. Pull new Docker images by commit SHA
2. Stop the **inactive** environment (the one not serving traffic)
3. Start the inactive environment with new images
4. Health check recommendation engine, then app (30 retries x 5s = 150s max)
5. On success: switch Nginx upstream to new environment
6. On failure: stop new environment, old environment untouched
7. Old environment kept running as instant rollback target

### Rollback

```bash
ssh ec2-user@<EC2_HOST>
bash /ecoplate/deploy/deploy.sh rollback
```

Verifies the previous environment is healthy, switches Nginx back, updates state file.

---

## Nginx Security Configuration

### Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `SAMEORIGIN` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer leakage |
| `Content-Security-Policy` | `default-src 'self'; ...` | Restrict resource loading origins |
| `Permissions-Policy` | `camera=(self), geolocation=(self), ...` | Control browser API access |
| `server_tokens` | `off` | Hide Nginx version |

### Rate Limiting

- Zone: `api` (10MB shared memory)
- Rate: 30 requests/second per IP
- Burst: 50 requests (no delay)
- Applied to: `/api/*` endpoints

### Content Security Policy Breakdown

| Directive | Value | Reason |
|-----------|-------|--------|
| `default-src` | `'self'` | Restrict all resources to same origin |
| `script-src` | `'self' https://maps.googleapis.com` | App scripts + Google Maps SDK |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | Tailwind CSS requires inline styles |
| `img-src` | `'self' data: blob: https://*.googleapis.com https://*.gstatic.com` | Camera uploads (blob/data) + Maps tiles |
| `font-src` | `'self' https://fonts.gstatic.com` | Local fonts + Google Fonts |
| `connect-src` | `'self' ws: wss: https://maps.googleapis.com` | API calls + WebSocket + Maps |
| `frame-ancestors` | `'self'` | Prevent embedding in iframes |

---

## SonarQube Integration

- **Integration method:** GitHub App (automatic PR analysis)
- **Quality gate:** Sonar way (default)
- **Configuration file:** `sonar-project.properties` at repo root
- **Sources scanned:** `backend/src/`, `frontend/src/`, `recommendation-engine/`
- **Exclusions:** `node_modules/`, `dist/`, shadcn/ui components, migrations, config files

### Sonar Way Quality Gate Conditions (New Code)

| Condition | Threshold |
|-----------|-----------|
| New bugs | 0 |
| New vulnerabilities | 0 |
| Security hotspots reviewed | 100% |
| Duplicated lines | < 3% |
| Coverage (if configured) | >= 80% |

---

## Security Scan Report Artifacts

Every pipeline run produces downloadable artifacts in the GitHub Actions run:

| Artifact | Tool | Format | Retention |
|----------|------|--------|-----------|
| `gitleaks-report` | Gitleaks | SARIF | 30 days |
| `bandit-report` | Bandit | JSON | 30 days |
| `pip-audit-report` | pip-audit | JSON | 30 days |
| `js-audit-reports` | osv-scanner | JSON | 30 days |
| `trivy-reports` | Trivy | Text (table) | 30 days |
| `zap-report` | OWASP ZAP | HTML + JSON + MD | 30 days |

---

## Secrets Management

| Secret | Used By | Purpose |
|--------|---------|---------|
| `GITHUB_TOKEN` | CI/CD | Built-in, GHCR login + Gitleaks |
| `EC2_HOST` | CD | Deployment target IP |
| `EC2_USER` | CD | SSH username for EC2 |
| `EC2_SSH_KEY` | CD | SSH private key for EC2 |
| `GHCR_DEPLOY_USER` | CD | GHCR login on EC2 |
| `GHCR_DEPLOY_TOKEN` | CD | GHCR pull token on EC2 |

All secrets stored in **GitHub Actions Secrets** (encrypted at rest, masked in logs). No secrets are hardcoded in source code or Docker images.
