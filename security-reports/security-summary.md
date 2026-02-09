# Security Report - EcoPlate

**Branch:** `main` | **Commit:** `ff5bd03b` | **Date:** 2026-02-08 06:15 UTC

## Overall Status: :x: FAIL

| Metric | Count |
|--------|-------|
| Total Findings | 59 |
| Critical | 4 |
| High | 16 |
| Medium | 37 |
| Low | 2 |

## Scan Results

| Tool | Category | Status | Critical | High | Medium | Low |
|------|----------|--------|----------|------|--------|-----|
| Semgrep | SAST | :warning: WARN | - | - | 13 | 1 |
| Bandit | SAST | :white_check_mark: PASS | - | - | - | - |
| Trufflehog | Secrets | :x: FAIL | 3 | - | - | - |
| pip-audit | SCA | :white_check_mark: PASS | - | - | - | - |
| npm audit | SCA | :x: FAIL | - | 2 | 4 | - |
| Checkov | IaC | :warning: WARN | - | - | 2 | - |
| pip-licenses | License | :white_check_mark: PASS | - | - | - | - |
| Syft (Source) | SBOM | :white_check_mark: PASS | - | - | - | - |
| Trivy (App Image) | Container | :x: FAIL | 1 | 2 | 12 | - |
| Trivy (Rec Image) | Container | :white_check_mark: PASS | - | - | - | - |
| Syft (Container) | SBOM | :white_check_mark: PASS | - | - | - | - |
| ZAP Baseline | DAST | :x: FAIL | - | 6 | 5 | 1 |
| ZAP API Scan | DAST | :x: FAIL | - | 6 | 1 | - |

> Download the full HTML report from the **consolidated-security-report** artifact for detailed findings.
