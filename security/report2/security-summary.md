# Security Report - EcoPlate

**Branch:** `main` | **Commit:** `eacf4fd1` | **Date:** 2026-02-08 03:48 UTC

## Overall Status: :x: FAIL

| Metric | Count |
|--------|-------|
| Total Findings | 66 |
| Critical | 4 |
| High | 18 |
| Medium | 43 |
| Low | 1 |

## Scan Results

| Tool | Category | Status | Critical | High | Medium | Low |
|------|----------|--------|----------|------|--------|-----|
| Semgrep | SAST | :warning: WARN | - | - | 12 | - |
| Bandit | SAST | :white_check_mark: PASS | - | - | - | - |
| Trufflehog | Secrets | :x: FAIL | 3 | - | - | - |
| pip-audit | SCA | :white_check_mark: PASS | - | - | - | - |
| npm audit | SCA | :x: FAIL | - | 2 | 2 | - |
| Checkov | IaC | :white_check_mark: PASS | - | - | - | - |
| pip-licenses | License | :white_check_mark: PASS | - | - | - | - |
| Syft (Source) | SBOM | :white_check_mark: PASS | - | - | - | - |
| Trivy (App Image) | Container | :x: FAIL | 1 | 1 | 23 | - |
| Trivy (Rec Image) | Container | :white_check_mark: PASS | - | - | - | - |
| Syft (Container) | SBOM | :white_check_mark: PASS | - | - | - | - |
| ZAP Baseline | DAST | :x: FAIL | - | 8 | 5 | 1 |
| ZAP API Scan | DAST | :x: FAIL | - | 7 | 1 | - |

> Download the full HTML report from the **consolidated-security-report** artifact for detailed findings.
