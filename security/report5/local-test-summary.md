# Security Report - EcoPlate

**Branch:** `main` | **Commit:** `1539f9f` | **Date:** 2026-02-08 07:39 UTC

## Overall Status: :warning: WARN

| Metric | Count |
|--------|-------|
| Total Findings | 21 |
| Critical | 0 |
| High | 0 |
| Medium | 17 |
| Low | 4 |

## Scan Results

| Tool | Category | Status | Critical | High | Medium | Low |
|------|----------|--------|----------|------|--------|-----|
| Semgrep | SAST | :warning: WARN | - | - | 13 | 1 |
| Bandit | SAST | :white_check_mark: PASS | - | - | - | - |
| Trufflehog | Secrets | :white_check_mark: PASS | - | - | - | - |
| pip-audit | SCA | :next_track_button: SKIPPED | - | - | - | - |
| npm audit | SCA | :warning: WARN | - | - | 1 | - |
| Checkov | IaC | :warning: WARN | - | - | 1 | - |
| pip-licenses | License | :white_check_mark: PASS | - | - | - | - |
| Syft (Source) | SBOM | :white_check_mark: PASS | - | - | - | - |
| Trivy (App Image) | Container | :white_check_mark: PASS | - | - | - | - |
| Trivy (Rec Image) | Container | :white_check_mark: PASS | - | - | - | - |
| Syft (Container) | SBOM | :white_check_mark: PASS | - | - | - | - |
| ZAP Baseline | DAST | :warning: WARN | - | - | 2 | 2 |
| ZAP API Scan | DAST | :warning: WARN | - | - | - | 1 |

> Download the full HTML report from the **consolidated-security-report** artifact for detailed findings.
