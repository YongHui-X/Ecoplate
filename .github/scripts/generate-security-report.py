#!/usr/bin/env python3
"""Generate a consolidated HTML security report from CI/CD scan artifacts."""

import argparse
import json
import os
import re
from datetime import datetime, timezone
from html import escape
from pathlib import Path


# =============================================================================
# Data Structures
# =============================================================================

class Finding:
    def __init__(self, title, severity, description="", location="", cve_id=""):
        self.title = title
        self.severity = severity  # "critical", "high", "medium", "low", "info"
        self.description = description
        self.location = location
        self.cve_id = cve_id


class ScanResult:
    def __init__(self, tool_name, category, status, findings=None, summary_text="", error_message=""):
        self.tool_name = tool_name
        self.category = category
        self.status = status  # "pass", "warn", "fail", "skipped", "error"
        self.findings = findings or []
        self.summary_text = summary_text
        self.error_message = error_message

    @property
    def critical_count(self):
        return sum(1 for f in self.findings if f.severity == "critical")

    @property
    def high_count(self):
        return sum(1 for f in self.findings if f.severity == "high")

    @property
    def medium_count(self):
        return sum(1 for f in self.findings if f.severity == "medium")

    @property
    def low_count(self):
        return sum(1 for f in self.findings if f.severity == "low")


# =============================================================================
# Helpers
# =============================================================================

def safe_load_json(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return None
            return json.loads(content)
    except (json.JSONDecodeError, OSError):
        return None


def safe_read_text(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
    except OSError:
        return None


def determine_status(findings):
    if not findings:
        return "pass"
    if any(f.severity in ("critical", "high") for f in findings):
        return "fail"
    if any(f.severity == "medium" for f in findings):
        return "warn"
    return "warn"


# =============================================================================
# Parsers
# =============================================================================

def parse_semgrep(reports_dir):
    fp = os.path.join(reports_dir, "semgrep", "semgrep-report.json")
    if not os.path.exists(fp):
        return ScanResult("Semgrep", "SAST", "skipped", summary_text="Report not available")
    data = safe_load_json(fp)
    if data is None:
        return ScanResult("Semgrep", "SAST", "error", error_message="Failed to parse report")
    results = data.get("results", [])
    findings = []
    for r in results:
        sev_map = {"ERROR": "high", "WARNING": "medium", "INFO": "low"}
        sev = sev_map.get(r.get("extra", {}).get("severity", "").upper(), "medium")
        findings.append(Finding(
            title=r.get("check_id", "Unknown rule"),
            severity=sev,
            description=r.get("extra", {}).get("message", ""),
            location=f"{r.get('path', '')}:{r.get('start', {}).get('line', '')}"
        ))
    return ScanResult("Semgrep", "SAST", determine_status(findings), findings,
                       f"{len(findings)} issue(s) found" if findings else "No issues found")


def parse_bandit(reports_dir):
    fp = os.path.join(reports_dir, "bandit", "bandit-report.json")
    if not os.path.exists(fp):
        return ScanResult("Bandit", "SAST", "skipped", summary_text="Report not available")
    data = safe_load_json(fp)
    if data is None:
        return ScanResult("Bandit", "SAST", "error", error_message="Failed to parse report")
    results = data.get("results", [])
    findings = []
    for r in results:
        sev = r.get("issue_severity", "MEDIUM").lower()
        if sev not in ("critical", "high", "medium", "low"):
            sev = "medium"
        findings.append(Finding(
            title=f"{r.get('test_id', '')} - {r.get('test_name', '')}",
            severity=sev,
            description=r.get("issue_text", ""),
            location=f"{r.get('filename', '')}:{r.get('line_number', '')}"
        ))
    return ScanResult("Bandit", "SAST", determine_status(findings), findings,
                       f"{len(findings)} issue(s) found" if findings else "No issues found")


def parse_trufflehog(reports_dir):
    fp = os.path.join(reports_dir, "trufflehog", "trufflehog-report.json")
    if not os.path.exists(fp):
        return ScanResult("Trufflehog", "Secrets", "skipped", summary_text="Report not available")
    text = safe_read_text(fp)
    if not text or not text.strip():
        return ScanResult("Trufflehog", "Secrets", "pass", summary_text="No verified secrets found")
    findings = []
    for line in text.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            # Skip trufflehog log/status lines (they have "level" and "msg" fields)
            # Only actual secret findings have "SourceMetadata" and "DetectorName"
            if "level" in obj or "msg" in obj:
                continue
            if "SourceMetadata" not in obj and "DetectorName" not in obj:
                continue
            # Extract location from git history OR filesystem metadata
            source_meta = obj.get("SourceMetadata", {}).get("Data", {})
            git_meta = source_meta.get("Git", {})
            fs_meta = source_meta.get("Filesystem", {})

            if git_meta:
                file_path = git_meta.get("file", "")
                commit = git_meta.get("commit", "")[:8]
                location = f"{file_path} (commit: {commit})" if commit else file_path
            elif fs_meta:
                location = fs_meta.get("file", "")
            else:
                location = "git history"

            detector = obj.get("DetectorName", obj.get("SourceName", "Secret"))
            detector_type = obj.get("DetectorType", "")
            title = f"{detector} ({detector_type})" if detector_type else detector

            findings.append(Finding(
                title=title,
                severity="critical",
                description=f"Verified secret detected — {detector}",
                location=location
            ))
        except json.JSONDecodeError:
            continue
    return ScanResult("Trufflehog", "Secrets", determine_status(findings), findings,
                       f"{len(findings)} secret(s) found" if findings else "No verified secrets found")


def parse_pip_audit(reports_dir):
    fp = os.path.join(reports_dir, "pip-audit", "pip-audit-report.json")
    if not os.path.exists(fp):
        return ScanResult("pip-audit", "SCA", "skipped", summary_text="Report not available")
    data = safe_load_json(fp)
    if data is None:
        return ScanResult("pip-audit", "SCA", "error", error_message="Failed to parse report")
    findings = []
    deps = data.get("dependencies", data) if isinstance(data, dict) else data
    if isinstance(deps, list):
        for dep in deps:
            for vuln in dep.get("vulns", []):
                findings.append(Finding(
                    title=f"{dep.get('name', 'Unknown')} - {vuln.get('id', '')}",
                    severity="high",
                    description=vuln.get("description", "")[:200],
                    location=f"Version: {dep.get('version', 'unknown')}",
                    cve_id=vuln.get("id", "")
                ))
    return ScanResult("pip-audit", "SCA", determine_status(findings), findings,
                       f"{len(findings)} vulnerability(ies)" if findings else "No vulnerabilities found")


def parse_js_audit(reports_dir):
    findings = []
    for name, label in [("backend-audit.json", "backend"), ("frontend-audit.json", "frontend")]:
        fp = os.path.join(reports_dir, "js-audit", name)
        data = safe_load_json(fp)
        if not data:
            continue
        vulns = data.get("vulnerabilities", {})
        if isinstance(vulns, dict):
            for pkg, info in vulns.items():
                # Skip devDependency-only vulnerabilities (not in production image)
                if info.get("isDirect") is False and not info.get("effects"):
                    continue
                sev = info.get("severity", "moderate").lower()
                sev_map = {"critical": "critical", "high": "high", "moderate": "medium", "low": "low"}
                findings.append(Finding(
                    title=f"[{label}] {pkg}",
                    severity=sev_map.get(sev, "medium"),
                    description=f"Severity: {sev}",
                    location=label
                ))
    if not os.path.exists(os.path.join(reports_dir, "js-audit")):
        return ScanResult("npm audit", "SCA", "skipped", summary_text="Report not available")
    return ScanResult("npm audit", "SCA", determine_status(findings), findings,
                       f"{len(findings)} vulnerability(ies)" if findings else "No vulnerabilities found")


def parse_checkov(reports_dir):
    fp = os.path.join(reports_dir, "checkov", "checkov-results.json")
    if not os.path.exists(fp):
        return ScanResult("Checkov", "IaC", "skipped", summary_text="Report not available")
    data = safe_load_json(fp)
    if data is None:
        return ScanResult("Checkov", "IaC", "error", error_message="Failed to parse report")
    findings = []
    checks = data if isinstance(data, list) else [data]
    for check_group in checks:
        results = check_group.get("results", {})
        for fc in results.get("failed_checks", []):
            findings.append(Finding(
                title=f"{fc.get('check_id', '')} - {fc.get('check_name', '')}",
                severity="medium",
                description=fc.get("guideline", ""),
                location=fc.get("file_path", "")
            ))
    passed = sum(c.get("summary", {}).get("passed", 0) for c in checks)
    failed = len(findings)
    return ScanResult("Checkov", "IaC", determine_status(findings), findings,
                       f"{passed} passed, {failed} failed")


def parse_license(reports_dir):
    fp = os.path.join(reports_dir, "license", "python-licenses.md")
    if not os.path.exists(fp):
        return ScanResult("pip-licenses", "License", "skipped", summary_text="Report not available")
    text = safe_read_text(fp) or ""
    findings = []
    for line in text.split("\n"):
        if re.search(r"\bGPL\b|\bAGPL\b", line, re.IGNORECASE):
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if parts:
                findings.append(Finding(
                    title=parts[0] if parts else "Unknown",
                    severity="medium",
                    description=f"Restrictive license detected: {line.strip()}"
                ))
    pkg_count = len([l for l in text.split("\n") if l.strip() and not l.startswith("|--") and "|" in l]) - 1
    return ScanResult("pip-licenses", "License", determine_status(findings), findings,
                       f"{max(pkg_count, 0)} packages scanned" + (f", {len(findings)} GPL/AGPL" if findings else ""))


def parse_sbom(reports_dir):
    count = 0
    for name in ["sbom-repo.cdx.json", "sbom-repo.spdx.json"]:
        fp = os.path.join(reports_dir, "sbom", name)
        data = safe_load_json(fp)
        if data:
            count = len(data.get("components", data.get("packages", [])))
            if count > 0:
                break
    if not os.path.exists(os.path.join(reports_dir, "sbom")):
        return ScanResult("Syft", "SBOM", "skipped", summary_text="Report not available")
    return ScanResult("Syft (Source)", "SBOM", "pass", summary_text=f"{count} components catalogued")


def parse_trivy(reports_dir, subdir, label):
    fp = os.path.join(reports_dir, subdir, f"trivy-{'app' if 'app' in subdir else 'rec'}-vuln.txt")
    if not os.path.exists(fp):
        return ScanResult(f"Trivy ({label})", "Container", "skipped", summary_text="Report not available")
    text = safe_read_text(fp) or ""
    findings = []
    seen_cves = set()
    for line in text.split("\n"):
        cve_match = re.search(r"(CVE-\d{4}-\d+)", line)
        if cve_match:
            cve = cve_match.group(1)
            if cve in seen_cves:
                continue
            seen_cves.add(cve)
            sev = "medium"
            for s in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
                if s in line.upper():
                    sev = s.lower()
                    break
            findings.append(Finding(title=cve, severity=sev, description=line.strip()[:150], cve_id=cve))
    return ScanResult(f"Trivy ({label})", "Container", determine_status(findings), findings,
                       f"{len(findings)} vulnerability(ies)" if findings else "No vulnerabilities found")


def parse_container_sbom(reports_dir):
    count = 0
    for name in ["sbom-app.cdx.json", "sbom-rec.cdx.json"]:
        fp = os.path.join(reports_dir, "container-sbom", name)
        data = safe_load_json(fp)
        if data:
            count += len(data.get("components", []))
    if not os.path.exists(os.path.join(reports_dir, "container-sbom")):
        return ScanResult("Syft (Container)", "SBOM", "skipped", summary_text="Report not available")
    return ScanResult("Syft (Container)", "SBOM", "pass", summary_text=f"{count} components catalogued")


# ZAP alerts that are scanner noise, not real vulnerabilities
ZAP_SUPPRESSED_ALERTS = {
    "Sec-Fetch-Dest Header is Missing",
    "Sec-Fetch-Mode Header is Missing",
    "Sec-Fetch-Site Header is Missing",
    "Sec-Fetch-User Header is Missing",
    "Modern Web Application",
}


def parse_zap(reports_dir, subdir, label):
    fp = os.path.join(reports_dir, subdir, "report_json.json")
    if not os.path.exists(fp):
        return ScanResult(f"ZAP {label}", "DAST", "skipped", summary_text="Report not available")
    data = safe_load_json(fp)
    if data is None:
        return ScanResult(f"ZAP {label}", "DAST", "error", error_message="Failed to parse report")
    findings = []
    sites = data.get("site", [])
    if isinstance(sites, dict):
        sites = [sites]
    for site in sites:
        for alert in site.get("alerts", []):
            alert_name = alert.get("alert", alert.get("name", "Unknown"))

            # Skip known scanner noise
            if alert_name in ZAP_SUPPRESSED_ALERTS:
                continue

            # Use riskcode (numeric) instead of riskdesc to avoid confusing
            # confidence with severity (e.g. "Informational (High)" != HIGH)
            risk_code = str(alert.get("riskcode", "0"))
            sev = {"3": "high", "2": "medium", "1": "low"}.get(risk_code, "info")
            findings.append(Finding(
                title=alert_name,
                severity=sev,
                description=alert.get("desc", "")[:200],
                location=alert.get("url", "")
            ))
    return ScanResult(f"ZAP {label}", "DAST", determine_status(findings), findings,
                       f"{len(findings)} alert(s)" if findings else "No alerts found")


# =============================================================================
# Aggregator
# =============================================================================

def collect_all(reports_dir):
    return [
        parse_semgrep(reports_dir),
        parse_bandit(reports_dir),
        parse_trufflehog(reports_dir),
        parse_pip_audit(reports_dir),
        parse_js_audit(reports_dir),
        parse_checkov(reports_dir),
        parse_license(reports_dir),
        parse_sbom(reports_dir),
        parse_trivy(reports_dir, "trivy-app", "App Image"),
        parse_trivy(reports_dir, "trivy-rec", "Rec Image"),
        parse_container_sbom(reports_dir),
        parse_zap(reports_dir, "zap-baseline", "Baseline"),
        parse_zap(reports_dir, "zap-api", "API Scan"),
    ]


def overall_status(results):
    if any(r.status == "fail" for r in results):
        return "fail"
    return "pass"


# =============================================================================
# HTML Renderer
# =============================================================================

STATUS_COLORS = {"pass": "#16a34a", "warn": "#ca8a04", "fail": "#dc2626", "skipped": "#9ca3af", "error": "#dc2626"}
STATUS_LABELS = {"pass": "PASS", "warn": "WARN", "fail": "FAIL", "skipped": "SKIPPED", "error": "ERROR"}
SEV_COLORS = {"critical": "#dc2626", "high": "#ea580c", "medium": "#ca8a04", "low": "#2563eb", "info": "#6b7280"}

CSS = """
:root { --bg: #f1f5f9; --card: #fff; --text: #1e293b; --muted: #64748b; --border: #e2e8f0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 2rem; max-width: 1200px; margin: 0 auto; }
header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #2563eb 100%); color: #fff; padding: 2.5rem; border-radius: 16px; margin-bottom: 2rem; }
header h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
header .meta { opacity: 0.8; font-size: 0.875rem; }
header .meta span { margin-right: 1.5rem; }
.overall { text-align: center; margin: 1.5rem 0; }
.overall .badge-lg { display: inline-block; padding: 0.5rem 2rem; border-radius: 9999px; font-size: 1.25rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin: 2rem 0; }
.card { background: var(--card); border-radius: 12px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 4px solid var(--border); text-align: center; }
.card .num { font-size: 2rem; font-weight: 700; }
.card .label { font-size: 0.8rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.25rem; }
.section { background: var(--card); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.section h2 { font-size: 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem; }
.badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; color: #fff; }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; margin-top: 0.75rem; }
th { background: #f8fafc; text-align: left; padding: 0.6rem 0.75rem; font-weight: 600; border-bottom: 2px solid var(--border); }
td { padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--border); }
tr:hover { background: #f8fafc; }
.sev-badge { padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; color: #fff; text-transform: uppercase; }
details { margin-top: 0.75rem; }
details summary { cursor: pointer; font-weight: 500; padding: 0.5rem; border-radius: 6px; }
details summary:hover { background: #f1f5f9; }
.overview-table td:nth-child(3) { text-align: center; }
.overview-table td:nth-child(4), .overview-table td:nth-child(5), .overview-table td:nth-child(6), .overview-table td:nth-child(7) { text-align: center; }
.overview-table th:nth-child(3), .overview-table th:nth-child(4), .overview-table th:nth-child(5), .overview-table th:nth-child(6), .overview-table th:nth-child(7) { text-align: center; }
footer { text-align: center; color: var(--muted); font-size: 0.8rem; padding: 2rem 0; }
@media print { body { padding: 0; } header { border-radius: 0; } .section { break-inside: avoid; } }
"""


def badge_html(status):
    return f'<span class="badge" style="background:{STATUS_COLORS.get(status, "#9ca3af")}">{STATUS_LABELS.get(status, status)}</span>'


def sev_badge_html(sev):
    return f'<span class="sev-badge" style="background:{SEV_COLORS.get(sev, "#6b7280")}">{sev.upper()}</span>'


def render_html(results, branch, commit, repo):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    status = overall_status(results)

    total_c = sum(r.critical_count for r in results)
    total_h = sum(r.high_count for r in results)
    total_m = sum(r.medium_count for r in results)
    total_l = sum(r.low_count for r in results)
    total_all = total_c + total_h + total_m + total_l
    scans_run = sum(1 for r in results if r.status not in ("skipped",))
    scans_skipped = sum(1 for r in results if r.status == "skipped")

    # Overview table
    overview_rows = ""
    for r in results:
        overview_rows += f"""<tr>
            <td>{escape(r.tool_name)}</td>
            <td>{escape(r.category)}</td>
            <td>{badge_html(r.status)}</td>
            <td style="color:{SEV_COLORS['critical']}">{r.critical_count or '-'}</td>
            <td style="color:{SEV_COLORS['high']}">{r.high_count or '-'}</td>
            <td style="color:{SEV_COLORS['medium']}">{r.medium_count or '-'}</td>
            <td style="color:{SEV_COLORS['low']}">{r.low_count or '-'}</td>
        </tr>"""

    # Detail sections
    detail_sections = ""
    for r in results:
        if r.status == "skipped" or not r.findings:
            continue
        findings_rows = ""
        for f in r.findings[:50]:  # Limit to 50 findings per tool
            findings_rows += f"""<tr>
                <td>{sev_badge_html(f.severity)}</td>
                <td>{escape(f.title)}</td>
                <td>{escape(f.location)}</td>
                <td>{escape(f.description[:120])}</td>
            </tr>"""
        detail_sections += f"""
        <div class="section">
            <h2>{badge_html(r.status)} {escape(r.tool_name)} <span style="color:var(--muted);font-size:0.85rem;font-weight:400">({escape(r.category)})</span></h2>
            <p style="color:var(--muted);margin-bottom:0.5rem">{escape(r.summary_text)}</p>
            <details>
                <summary>View {len(r.findings)} finding(s)</summary>
                <table>
                    <thead><tr><th style="width:100px">Severity</th><th>Finding</th><th>Location</th><th>Description</th></tr></thead>
                    <tbody>{findings_rows}</tbody>
                </table>
            </details>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EcoPlate Security Report</title>
<style>{CSS}</style>
</head>
<body>
<header>
    <h1>EcoPlate DevSecOps Security Report</h1>
    <div class="meta">
        <span>Branch: <strong>{escape(branch)}</strong></span>
        <span>Commit: <strong>{escape(commit[:8])}</strong></span>
        <span>Generated: <strong>{now}</strong></span>
        <span>Repo: <strong>{escape(repo)}</strong></span>
    </div>
</header>

<div class="overall">
    <span class="badge-lg" style="background:{STATUS_COLORS[status]};color:#fff">Overall: {STATUS_LABELS[status]}</span>
</div>

<div class="cards">
    <div class="card" style="border-left-color:#6b7280"><div class="num">{total_all}</div><div class="label">Total Findings</div></div>
    <div class="card" style="border-left-color:{SEV_COLORS['critical']}"><div class="num" style="color:{SEV_COLORS['critical']}">{total_c}</div><div class="label">Critical</div></div>
    <div class="card" style="border-left-color:{SEV_COLORS['high']}"><div class="num" style="color:{SEV_COLORS['high']}">{total_h}</div><div class="label">High</div></div>
    <div class="card" style="border-left-color:{SEV_COLORS['medium']}"><div class="num" style="color:{SEV_COLORS['medium']}">{total_m}</div><div class="label">Medium</div></div>
    <div class="card" style="border-left-color:{SEV_COLORS['low']}"><div class="num" style="color:{SEV_COLORS['low']}">{total_l}</div><div class="label">Low</div></div>
    <div class="card" style="border-left-color:#16a34a"><div class="num">{scans_run}</div><div class="label">Scans Run</div></div>
</div>

<div class="section">
    <h2>Scan Overview</h2>
    <table class="overview-table">
        <thead><tr><th>Tool</th><th>Category</th><th>Status</th><th>Critical</th><th>High</th><th>Medium</th><th>Low</th></tr></thead>
        <tbody>{overview_rows}</tbody>
    </table>
</div>

{detail_sections}

<footer>
    Generated by EcoPlate DevSecOps Pipeline &middot; {now}
</footer>
</body>
</html>"""
    return html


# =============================================================================
# Markdown Renderer
# =============================================================================

def render_markdown(results, branch, commit):
    status = overall_status(results)
    status_emoji = {"pass": ":white_check_mark:", "warn": ":warning:", "fail": ":x:"}.get(status, ":grey_question:")

    total_c = sum(r.critical_count for r in results)
    total_h = sum(r.high_count for r in results)
    total_m = sum(r.medium_count for r in results)
    total_l = sum(r.low_count for r in results)
    total_all = total_c + total_h + total_m + total_l

    status_emojis = {"pass": ":white_check_mark:", "warn": ":warning:", "fail": ":x:", "skipped": ":next_track_button:", "error": ":x:"}

    rows = ""
    for r in results:
        e = status_emojis.get(r.status, ":grey_question:")
        rows += f"| {r.tool_name} | {r.category} | {e} {r.status.upper()} | {r.critical_count or '-'} | {r.high_count or '-'} | {r.medium_count or '-'} | {r.low_count or '-'} |\n"

    md = f"""# Security Report - EcoPlate

**Branch:** `{branch}` | **Commit:** `{commit[:8]}` | **Date:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}

## Overall Status: {status_emoji} {status.upper()}

| Metric | Count |
|--------|-------|
| Total Findings | {total_all} |
| Critical | {total_c} |
| High | {total_h} |
| Medium | {total_m} |
| Low | {total_l} |

## Scan Results

| Tool | Category | Status | Critical | High | Medium | Low |
|------|----------|--------|----------|------|--------|-----|
{rows}
> Download the full HTML report from the **consolidated-security-report** artifact for detailed findings.
"""
    return md


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Generate consolidated security report")
    parser.add_argument("--reports-dir", required=True)
    parser.add_argument("--output-html", required=True)
    parser.add_argument("--output-md", required=True)
    parser.add_argument("--branch", default="unknown")
    parser.add_argument("--commit", default="unknown")
    parser.add_argument("--repo", default="unknown")
    args = parser.parse_args()

    results = collect_all(args.reports_dir)

    html = render_html(results, args.branch, args.commit, args.repo)
    md = render_markdown(results, args.branch, args.commit)

    Path(args.output_html).write_text(html, encoding="utf-8")
    Path(args.output_md).write_text(md, encoding="utf-8")

    print(f"HTML report generated: {args.output_html}")
    print(f"Markdown summary generated: {args.output_md}")

    status = overall_status(results)
    total = sum(r.critical_count + r.high_count + r.medium_count + r.low_count for r in results)
    print(f"Overall status: {status.upper()} ({total} total findings)")


if __name__ == "__main__":
    main()
