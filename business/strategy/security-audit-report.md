# Security Audit Report -- Observability Workbench

**Audit Date:** 2026-03-09
**Auditor:** Security Engineer (AI Agency)
**Scope:** Full codebase audit -- CLI tool, Fabric workload frontend, PySpark notebooks, utility scripts, CI/CD pipeline
**Classification:** Internal -- Pre-Launch Security Review

---

## Executive Summary

The Observability Workbench codebase has been reviewed across all layers: the Node.js/TypeScript CLI backend (`products/observability-workbench/src/`), the Fabric workload React frontend (`workload/app/`), three PySpark notebooks (`notebooks/`), eleven utility scripts (`scripts/`), and two CI/CD workflows (`.github/workflows/`).

**Overall assessment: The codebase demonstrates solid security fundamentals for an MVP.** Secrets are loaded from environment variables (not hardcoded), authentication uses standard OAuth2 client credentials flows, and the `.gitignore` correctly excludes `.env` files. However, several findings require remediation before public launch.

### Risk Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 2     | Must fix before any public-facing deployment |
| High     | 5     | Must fix before launch |
| Medium   | 8     | Should fix before GA; acceptable for private preview |
| Low      | 6     | Address in normal development sprints |
| Info     | 4     | Best practices and hardening recommendations |

---

## Findings Table

| # | Severity | Finding | Location | Category |
|---|----------|---------|----------|----------|
| 1 | **Critical** | KQL injection via unsanitized user-controlled data in management commands | `src/kql-client.ts:255`, `notebooks/NB_ObsCorrelation.py:547` | Input Validation |
| 2 | **Critical** | Command injection in `getEnvVar()` via PowerShell `execSync` | `scripts/upload-notebooks.mjs:21`, and 4 other scripts | Code Injection |
| 3 | **High** | Hardcoded Eventhouse cluster URLs and workspace IDs in committed source | `src/config.ts:73-109`, `notebooks/*.py`, `workload/app/services/kqlQueryService.ts:47` | Secrets Management |
| 4 | **High** | GitHub PAT embedded in git remote URL (plaintext in `.git/config`) | `scripts/github-presence-setup.sh:27` | Secrets Management |
| 5 | **High** | Token leakage via error messages and console logging | `src/auth.ts:64`, `src/fabric-client.ts:286-288` | Information Disclosure |
| 6 | **High** | No token caching isolation -- tokens stored in process memory without protection | `src/auth.ts:19-20`, `src/kql-client.ts:28` | Token Security |
| 7 | **High** | Stack traces exposed in production error output | `src/scheduler.ts:53-54`, `src/index.ts:247-248` | Information Disclosure |
| 8 | **Medium** | CI/CD pipeline lacks SAST, dependency scanning, and secrets detection | `.github/workflows/ci.yml` | Supply Chain |
| 9 | **Medium** | No Content Security Policy or security headers on landing page | `landing-page/` (deployed via GitHub Pages) | Web Security |
| 10 | **Medium** | Unbounded pagination could lead to resource exhaustion | `src/fabric-client.ts:304-326` | Denial of Service |
| 11 | **Medium** | `escapeKql()` function uses insufficient sanitization (replace-only) | `src/kql-client.ts:408-413` | Input Validation |
| 12 | **Medium** | Local file store writes world-readable JSON with potentially sensitive data | `src/store.ts:38` | Data Protection |
| 13 | **Medium** | Teams webhook URL accepted without validation in notebooks | `notebooks/NB_ObsAlerts.py:39` | SSRF Risk |
| 14 | **Medium** | No rate limiting on KQL query execution in the frontend service | `workload/app/services/kqlQueryService.ts` | Rate Limiting |
| 15 | **Medium** | Bare `except:` clauses in Python notebooks swallow security-relevant errors | `notebooks/NB_ObsIngestion.py:143-144` | Error Handling |
| 16 | **Low** | npm dependencies not pinned to exact versions (uses `^` ranges) | `package.json` | Supply Chain |
| 17 | **Low** | No `package-lock.json` integrity verification in CI | `.github/workflows/ci.yml` | Supply Chain |
| 18 | **Low** | `validate-notebooks.mjs` script not included in CI security checks | `.github/workflows/ci.yml` | Process Gap |
| 19 | **Low** | Missing input validation on CLI `--mode` argument | `src/index.ts:30-41` | Input Validation |
| 20 | **Low** | No audit logging of authentication events | `src/auth.ts`, `src/kql-client.ts` | Audit Trail |
| 21 | **Low** | `continuationUri` from API response used without origin validation | `src/fabric-client.ts:314-316` | SSRF Risk |
| 22 | **Info** | No dependency lockfile committed to repository | Root project | Supply Chain |
| 23 | **Info** | TypeScript `any` type used extensively in error handling | Multiple files | Code Quality |
| 24 | **Info** | No automated secret rotation mechanism for Service Principal | Architecture | Operations |
| 25 | **Info** | Workload frontend currently returns only sample data (no live security surface) | `workload/app/hooks/*.ts` | Design |

---

## Detailed Findings

### CRITICAL-1: KQL Injection via Unsanitized Data in Management Commands

**Location:** `src/kql-client.ts` lines 227-256, `notebooks/NB_ObsCorrelation.py` line 547

**Description:** The KQL inline ingestion commands are constructed by string concatenation using data from Fabric API responses. While the `escapeKql()` function in `kql-client.ts` replaces semicolons and newlines, this is not comprehensive protection against KQL injection. The management command endpoint (`/v1/rest/mgmt`) executes arbitrary KQL commands, meaning a specially crafted `displayName` or `failureReason` from the Fabric API (or a compromised upstream source) could inject additional KQL commands.

**Affected code in `kql-client.ts`:**
```typescript
const cmd = `.ingest inline into table FabricEvents <|\n${rows}`;
// Where 'rows' contains escapeKql(j.itemDisplayName), escapeKql(j.failureReason ?? "")
```

The `escapeKql()` function only handles three characters:
```typescript
function escapeKql(value: string): string {
  return value
    .replace(/;/g, ",")
    .replace(/\n/g, " ")
    .replace(/\r/g, "");
}
```

**Affected code in `NB_ObsCorrelation.py`:**
```python
check_query = f"""
FabricEvents
| where EventId == "{eid}"
...
"""
```
Here, `eid` (an EventId from the Eventhouse) is directly interpolated into a KQL query string without parameterization or escaping. If EventId values were tampered with, this enables KQL injection.

**Impact:** An attacker who controls item display names in a monitored Fabric workspace could inject KQL management commands (data exfiltration, table deletion, etc.) when those names are ingested.

**Remediation:**
1. Switch from `.ingest inline` to the Kusto Streaming Ingestion API or Queued Ingestion, which accept structured data payloads rather than command strings.
2. If inline ingestion must be used, implement proper KQL escaping that handles all special characters: backslash, single/double quotes, pipe, angle brackets, and the `<|` delimiter sequence.
3. In Python notebooks, use parameterized queries where possible, or apply a strict allowlist for GUID-format values using the existing `is_valid_guid()` function.

---

### CRITICAL-2: Command Injection in `getEnvVar()` via PowerShell `execSync`

**Location:** `scripts/upload-notebooks.mjs:21-34`, `scripts/check-eventhouse-schema.mjs:10`, `scripts/fix-slo-targets.mjs:10`, `scripts/verify-data-quality.mjs:11`

**Description:** The `getEnvVar()` function passes the environment variable name directly into a PowerShell command executed via `execSync`:

```javascript
const val = execSync(
  `powershell.exe -Command "[System.Environment]::GetEnvironmentVariable('${name}', 'User')"`,
  { encoding: 'utf-8' }
).trim();
```

While `name` is currently hardcoded at call sites (e.g., `FABRIC_TENANT_ID`), this pattern is dangerous. If any caller passes untrusted input as `name`, an attacker could inject arbitrary PowerShell commands by crafting a name like `'); Remove-Item -Recurse C:/ -Force; #`.

**Impact:** Arbitrary command execution on the developer's machine. Currently low exploitability because all call sites use hardcoded strings, but the pattern itself is a ticking time bomb if the function is reused.

**Remediation:**
1. Validate `name` against an allowlist of expected environment variable names.
2. Use PowerShell's `-EncodedCommand` parameter with Base64-encoded input to prevent injection.
3. Alternatively, access Windows environment variables via Node.js native APIs (e.g., read from the registry directly using `winreg` or use `dotenv`).

---

### HIGH-1: Hardcoded Infrastructure URLs and Workspace IDs

**Location:** `src/config.ts` lines 73-109, `notebooks/NB_ObsIngestion.py:32`, `notebooks/NB_ObsCorrelation.py:43`, `notebooks/NB_ObsAlerts.py:29`, `workload/app/services/kqlQueryService.ts:47`, `scripts/upload-notebooks.mjs:52-64`

**Description:** Production Eventhouse cluster URLs (`trd-685p3abk6ym487egyj.z9.kusto.fabric.microsoft.com`), workspace GUIDs (`2da36c93-*`, `d286b2c5-*`, `a3a73dce-*`), and Fabric item IDs are hardcoded in source files that are committed to the public GitHub repository. While these are not secrets per se (they require authentication to access), they expose the infrastructure topology to any observer, enabling targeted reconnaissance.

**Impact:** An attacker can map the deployment topology, identify specific workspace IDs and Eventhouse endpoints, and target them for API abuse or social engineering attacks.

**Remediation:**
1. Move all infrastructure URLs to environment variables or configuration files that are excluded from version control.
2. Replace hardcoded workspace IDs with dynamic discovery (the code already has `listWorkspaces()` capability).
3. In `config.ts`, make the KQL endpoint and workspace list fully environment-driven with no fallback defaults that contain real values.
4. In notebooks, use Fabric `notebookutils` for environment configuration rather than hardcoding cluster URLs.

---

### HIGH-2: GitHub PAT Embedded in Git Remote URL

**Location:** `scripts/github-presence-setup.sh:27`

**Description:** The script reads a GitHub Personal Access Token from environment variables and embeds it directly in the git remote URL:

```bash
git remote set-url origin "https://tenfingerseddy:${PAT}@github.com/${REPO}.git"
```

This writes the PAT in plaintext to `.git/config`, where it persists on disk and could be inadvertently shared.

**Impact:** If the `.git/config` file is shared, copied, or the machine is compromised, the GitHub PAT (with `repo` and `workflow` scopes) is exposed, granting full repository access.

**Remediation:**
1. Use `git credential-manager` or `GH_TOKEN` environment variable for authentication instead of embedding credentials in URLs.
2. The script already sets `GH_TOKEN` -- rely on that for `gh` CLI operations and use `git credential-manager` for git operations.
3. If URL-based auth is necessary, use a short-lived token and clear the remote URL after the operation.

---

### HIGH-3: Token and Error Body Leakage in Error Messages

**Location:** `src/auth.ts:63-64`, `src/fabric-client.ts:286-288`, `src/kql-client.ts:59-60`

**Description:** When token acquisition or API calls fail, the full error response body is included in the thrown Error message:

```typescript
throw new Error(
  `Token acquisition failed (${response.status}): ${errorText}`
);
```

```typescript
const err: any = new Error(
  `Fabric API ${response.status} on ${path}: ${errBody}`
);
```

Azure AD error responses can contain correlation IDs, tenant metadata, and in rare cases, partial request payloads. Fabric API error responses may include internal resource identifiers. These are written to console output and potentially to log files.

**Impact:** Sensitive infrastructure details leak into logs, console output, and error reports. In the `scheduler.ts` (line 53), stack traces are also printed, compounding the leak surface.

**Remediation:**
1. Sanitize error messages before logging -- strip response bodies and only include status codes and generic error descriptions.
2. Log full error details only at DEBUG level, behind an explicit configuration flag.
3. In `scheduler.ts`, only print stack traces when `LOG_LEVEL=debug`.
4. Never include the raw response body from token endpoints in user-facing error messages.

---

### HIGH-4: No Token Caching Isolation

**Location:** `src/auth.ts:19-20`, `src/kql-client.ts:28`

**Description:** OAuth2 access tokens are cached in plain JavaScript objects in process memory:

```typescript
private cache: CachedToken | null = null;
```

While this is standard for a CLI tool, these tokens grant broad access to the Fabric API and Eventhouse. There is no mechanism to:
- Clear tokens on process suspension
- Protect tokens from memory dumps
- Limit token scope to specific operations
- Detect or prevent token theft from a compromised process

**Impact:** If the process memory is inspected (via debugging tools, core dumps, or a compromised dependency), active tokens are exposed.

**Remediation:**
1. For the CLI tool (MVP), this is acceptable risk -- document that the process should run in a trusted environment.
2. For the Fabric workload (production), use the Fabric SDK's built-in token management which integrates with the platform's security context.
3. Add a `clearCache()` method to the auth providers and call it on process exit / shutdown signals.
4. For production, consider managed identity authentication which eliminates persistent credentials entirely.

---

### HIGH-5: Stack Traces Exposed in Production Error Output

**Location:** `src/scheduler.ts:52-55`, `src/index.ts:246-248`

**Description:** Full stack traces are printed to console on error:

```typescript
if (err.stack) {
  console.error(chalk.gray(err.stack));
}
```

Stack traces reveal internal file paths, function names, and application structure. When running as a scheduled service or in production environments, this information should not be exposed.

**Impact:** Information disclosure that aids an attacker in understanding the application's internal structure, dependencies, and potential attack surface.

**Remediation:**
1. Gate stack trace output behind `LOG_LEVEL=debug` or `NODE_ENV=development`.
2. In production mode, log only the error message, not the stack trace.
3. Consider writing detailed error information to a secure log file rather than stdout.

---

### MEDIUM-1: CI/CD Pipeline Lacks Security Scanning

**Location:** `.github/workflows/ci.yml`

**Description:** The CI pipeline only runs `tsc --noEmit` (type checking), `npm test`, and `npm run validate:notebooks`. It does not include:
- Static Application Security Testing (SAST)
- Software Composition Analysis (SCA) / dependency vulnerability scanning
- Secret detection scanning
- License compliance checking

**Impact:** Vulnerable dependencies, accidentally committed secrets, and code-level security issues can reach the `main` branch and production without detection.

**Remediation:** Add the following jobs to the CI pipeline:

```yaml
sast:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: semgrep/semgrep-action@v1
      with:
        config: p/owasp-top-ten p/cwe-top-25

dependency-scan:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        severity: 'CRITICAL,HIGH'
        exit-code: '1'

secrets-scan:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: gitleaks/gitleaks-action@v2
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### MEDIUM-2: No Security Headers on Landing Page

**Location:** `landing-page/` (deployed to GitHub Pages via `pages.yml`)

**Description:** The landing page deployed to GitHub Pages has no security headers configured. While GitHub Pages provides some baseline protections, the deployment does not configure:
- Content Security Policy (CSP)
- X-Content-Type-Options
- X-Frame-Options
- Referrer-Policy
- Permissions-Policy

**Impact:** The landing page could be susceptible to clickjacking, MIME-type sniffing attacks, or XSS if user-generated content is ever included.

**Remediation:**
1. Add a `<meta>` tag in `index.html` for CSP: `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-ancestors 'none';">`
2. GitHub Pages handles HSTS automatically, but verify the domain uses HTTPS.
3. Add `<meta http-equiv="X-Content-Type-Options" content="nosniff">` and similar meta headers.

---

### MEDIUM-3: Unbounded Pagination Could Cause Resource Exhaustion

**Location:** `src/fabric-client.ts:304-326`

**Description:** The `getPaginated<T>()` method follows pagination tokens indefinitely without any limit:

```typescript
while (currentPath) {
  const data = await this.request(currentPath) as PaginatedResponse<T>;
  if (data.value) results.push(...data.value);
  // ... follows continuationUri/continuationToken
}
```

If the API returns an unexpectedly large result set (or a malformed response creates a pagination loop), this could exhaust process memory.

**Impact:** Out-of-memory crashes or prolonged API calls that consume excessive rate-limit quota.

**Remediation:**
1. Add a maximum page count (e.g., 100 pages) and total result count limit.
2. Add a guard against circular pagination (track visited URIs).
3. Log a warning when approaching the limit to alert operators.

---

### MEDIUM-4: Insufficient KQL Escaping

**Location:** `src/kql-client.ts:408-413`

**Description:** The `escapeKql()` function only replaces semicolons, newlines, and carriage returns:

```typescript
function escapeKql(value: string): string {
  return value
    .replace(/;/g, ",")
    .replace(/\n/g, " ")
    .replace(/\r/g, "");
}
```

This does not handle pipe characters (`|` -- used as delimiter in some ingestion formats), backslashes, quotes, or the `<|` sequence that terminates inline ingestion blocks. The Python notebooks use pipe-delimited ingestion (`format=psv`) and correctly strip pipe characters, but the TypeScript CLI uses semicolon-delimited ingestion without stripping pipes.

**Impact:** Malformed data with unescaped characters could corrupt ingestion, produce parsing errors, or in worst case enable injection.

**Remediation:**
1. Extend the escape function to strip or replace: `|`, `\`, `"`, `'`, `<`, `>`, and control characters.
2. Consider switching the CLI to PSV format (pipe-delimited) for consistency with the notebooks.
3. Validate field lengths and reject values that exceed expected maximums.

---

### MEDIUM-5: Local File Store Writes World-Readable JSON

**Location:** `src/store.ts:38`

**Description:** The `ObservabilityStore` writes collection snapshots as JSON files with default permissions:

```typescript
await writeFile(filepath, JSON.stringify(result, null, 2), "utf-8");
```

These JSON files contain workspace IDs, item names, job instance IDs, failure reasons, and SLO metrics. On multi-user systems, these files could be readable by other users.

**Impact:** Information disclosure if the workbench runs on a shared system.

**Remediation:**
1. Set file permissions to owner-only: `await writeFile(filepath, data, { encoding: "utf-8", mode: 0o600 })`.
2. Consider encrypting data at rest if it contains customer-sensitive information.

---

### MEDIUM-6: Teams Webhook URL Accepted Without SSRF Validation

**Location:** `notebooks/NB_ObsAlerts.py:39`, `notebooks/NB_ObsAlerts.py:458-459`

**Description:** The Teams webhook URL is read from `spark.conf` and used directly in an HTTP POST request without any URL validation:

```python
TEAMS_WEBHOOK_URL = spark.conf.get("spark.obs.teamsWebhook", "")
# ...
resp = requests.post(TEAMS_WEBHOOK_URL, json=card, timeout=10)
```

If an attacker can control the `spark.obs.teamsWebhook` configuration, they could redirect webhook calls to an internal network endpoint (SSRF).

**Impact:** Server-Side Request Forgery -- the notebook could be used to probe internal network endpoints.

**Remediation:**
1. Validate that the webhook URL matches the expected Microsoft Teams webhook pattern: `https://*.webhook.office.com/webhookb2/*`.
2. Block requests to internal/private IP ranges (`10.*`, `172.16-31.*`, `192.168.*`, `127.*`, `169.254.*`).
3. Use an allowlist of accepted webhook domains.

---

### MEDIUM-7: No Rate Limiting on KQL Query Execution (Frontend)

**Location:** `workload/app/services/kqlQueryService.ts`

**Description:** The `KqlQueryService` executes KQL queries on behalf of the frontend user with no rate limiting or query throttling. The `getDashboardData()` method fires 5 parallel KQL queries per invocation, and the React hooks auto-refresh every 60 seconds.

**Impact:** A user with the dashboard open across multiple tabs, or an automated tool hitting the service, could generate excessive query load on the Eventhouse.

**Remediation:**
1. Add client-side rate limiting (debounce multiple rapid requests).
2. Cache results with a short TTL (30-60 seconds) to prevent duplicate queries.
3. Implement a request queue that serializes or limits concurrent queries.
4. Add server-side rate limiting when the backend workload API is implemented.

---

### MEDIUM-8: Bare `except:` Clauses in Python Notebooks

**Location:** `notebooks/NB_ObsIngestion.py:143-144`

**Description:** Several bare `except` clauses silently swallow all exceptions:

```python
try:
    s = datetime.fromisoformat(start.rstrip("Z"))
    e = datetime.fromisoformat(end.rstrip("Z"))
    duration = (e - s).total_seconds()
except:
    pass
```

This catches everything including `KeyboardInterrupt`, `SystemExit`, `MemoryError`, and security-relevant exceptions, making it impossible to detect certain failure modes.

**Impact:** Security-relevant errors (authentication failures, permission denials, data corruption) are silently ignored.

**Remediation:**
1. Replace bare `except:` with specific exception types: `except (ValueError, TypeError):`.
2. Log caught exceptions at minimum: `except Exception as e: print(f"Warning: {e}")`.
3. Never catch `BaseException` implicitly.

---

### LOW-1: npm Dependencies Not Pinned to Exact Versions

**Location:** `package.json`

**Description:** All dependencies use caret (`^`) version ranges:
```json
"chalk": "^5.4.1",
"cli-table3": "^0.6.5",
"tsx": "^4.19.2",
"typescript": "^5.7.3"
```

**Impact:** `npm install` could pull in a newer minor/patch version that contains a vulnerability or supply-chain compromise.

**Remediation:**
1. Pin exact versions in `package.json` or rely on `package-lock.json` with `npm ci` in CI.
2. Use `npm audit` regularly and integrate it into CI.

---

### LOW-2: No `package-lock.json` Integrity Verification in CI

**Location:** `.github/workflows/ci.yml:31`

**Description:** The CI pipeline uses `npm ci` (good), but there is no step to verify the integrity of `package-lock.json` or run `npm audit`.

**Remediation:** Add `npm audit --audit-level=high` as a CI step that fails the build on high-severity vulnerabilities.

---

### LOW-3: Missing Input Validation on CLI `--mode` Argument

**Location:** `src/index.ts:30-41`

**Description:** While the `parseMode()` function validates against a known list of modes, invalid input silently defaults to `"full"` with only a warning. This is acceptable but could be stricter.

**Remediation:** In production builds, reject unknown modes with a non-zero exit code.

---

### LOW-4: No Audit Logging of Authentication Events

**Location:** `src/auth.ts`, `src/kql-client.ts`

**Description:** Token acquisition, refresh, and failure events are not logged in a structured format suitable for security audit trails. There is no record of when tokens were acquired, for what scopes, or when authentication failed.

**Remediation:** Add structured audit logging for all authentication events (token acquired, refreshed, failed, expired).

---

### LOW-5: `continuationUri` Used Without Origin Validation

**Location:** `src/fabric-client.ts:314-316`

**Description:** The `getPaginated()` method follows `continuationUri` from API responses, stripping the base URL:

```typescript
if (data.continuationUri) {
  currentPath = data.continuationUri.replace(this.baseUrl, "");
}
```

If a compromised or malicious API response provides a `continuationUri` pointing to a different host, the `replace()` would not strip it (since `this.baseUrl` would not match), and the code would construct a URL with the attacker's continuation path appended to `this.baseUrl`. While the risk is mitigated because the Fabric API is trusted, this pattern should validate the origin.

**Remediation:** Validate that `continuationUri` starts with `this.baseUrl` before following it. If it does not match, throw an error.

---

### LOW-6: `validate-notebooks.mjs` Not Part of Security CI

**Location:** `.github/workflows/ci.yml`

**Description:** The `validate-notebooks` script is included in CI but only checks notebook structure and column counts. It also runs `checkAdditionalPatterns()` which looks for hardcoded credentials, but this is limited to basic regex patterns.

**Remediation:** Consider extending the notebook validation with more comprehensive security checks, or include the notebooks in the SAST scan.

---

## Priority Remediation Plan

### Phase 1: Pre-Public-Launch (Must Fix -- Week 1)

1. **Fix KQL injection** (CRITICAL-1): Switch to structured ingestion APIs or implement comprehensive escaping. This is the highest-risk vulnerability.
2. **Fix command injection in `getEnvVar()`** (CRITICAL-2): Add input validation or use safe alternatives.
3. **Remove hardcoded infrastructure IDs** (HIGH-1): Move all cluster URLs and workspace IDs to environment variables.
4. **Fix GitHub PAT handling** (HIGH-2): Remove the `git remote set-url` pattern; use credential manager.
5. **Sanitize error messages** (HIGH-3): Strip sensitive data from error messages and stack traces.
6. **Add CI security scanning** (MEDIUM-1): Add Semgrep, Trivy, and Gitleaks to the CI pipeline.

### Phase 2: Before GA (Fix Before General Availability -- Weeks 2-4)

7. **Implement proper KQL escaping** (MEDIUM-4): Full character escaping for inline ingestion.
8. **Add file permission controls** (MEDIUM-5): Set restrictive permissions on data files.
9. **Add pagination limits** (MEDIUM-3): Prevent unbounded resource consumption.
10. **Add Teams webhook URL validation** (MEDIUM-6): SSRF prevention.
11. **Fix bare except clauses** (MEDIUM-8): Proper exception handling in notebooks.
12. **Add security headers to landing page** (MEDIUM-2): CSP and standard headers.

### Phase 3: Ongoing Hardening (Address in Normal Sprints)

13. **Pin npm dependencies** (LOW-1): Exact version pinning.
14. **Add npm audit to CI** (LOW-2): Automated dependency scanning.
15. **Add authentication audit logging** (LOW-4): Structured security logs.
16. **Add continuationUri validation** (LOW-5): Origin verification.
17. **Add KQL query rate limiting** (MEDIUM-7): Client-side throttling.
18. **Implement token cleanup on shutdown** (HIGH-4): Clear cached tokens.

---

## Security Architecture Recommendations

### 1. Migrate from Client Credentials to Managed Identity

The current Service Principal + client secret pattern works for MVP but is not production-grade:

- **Current risk:** The client secret has a fixed lifetime and must be manually rotated. If compromised, it grants access until rotated.
- **Recommendation:** When deploying as a Fabric workload, use Managed Identity authentication. This eliminates persistent credentials entirely.
- **For the CLI tool:** Continue with Service Principal but implement certificate-based authentication instead of client secrets.

### 2. Implement Defense-in-Depth for KQL Queries

The KQL query surface is the primary attack vector in this application:

1. **Input layer:** Validate and sanitize all data before constructing KQL commands.
2. **Query layer:** Use parameterized queries where possible. For inline ingestion, switch to the Kusto SDK streaming ingestion client.
3. **Permission layer:** The Service Principal should have the minimum required permissions on the Eventhouse (Viewer + Ingestor roles, not Admin).
4. **Monitoring layer:** Enable Kusto audit logs to detect anomalous queries.

### 3. Implement Secure Configuration Management

Replace the current configuration approach with a layered system:

1. **Level 1 (secrets):** Azure Key Vault for all credentials (Service Principal secret, webhook URLs, PATs).
2. **Level 2 (environment):** Environment variables for infrastructure URLs and feature flags.
3. **Level 3 (code):** Only non-sensitive defaults in code (poll intervals, batch sizes, SLO thresholds).

### 4. Add Network Security Controls

Before production deployment:

1. **Eventhouse:** Configure Eventhouse network policies to restrict inbound access to known IP ranges.
2. **Workload Backend:** When the .NET backend is implemented, add API authentication (validate Fabric JWT tokens).
3. **Webhooks:** Use webhook signing (HMAC) for outbound notifications to prevent spoofing.

### 5. Implement Data Classification and Retention

The system ingests operational metadata that could include PII (user names in activity logs, workspace names with team identifiers):

1. **Classify fields:** Identify which ingested fields could contain PII.
2. **Retention policies:** Configure Eventhouse retention policies to auto-delete data beyond the defined retention window.
3. **Data masking:** Consider masking user-identifying fields in the stored data.
4. **GDPR compliance:** Implement a data subject access request (DSAR) process for any PII stored in the Eventhouse.

---

## Appendix: Files Reviewed

### Core Source (`products/observability-workbench/src/`)
- `auth.ts` -- OAuth2 client credentials flow
- `config.ts` -- Configuration loading from environment
- `fabric-client.ts` -- Fabric REST API client
- `kql-client.ts` -- KQL Eventhouse client with inline ingestion
- `collector.ts` -- Data collection orchestrator
- `store.ts` -- Local JSON file persistence
- `alerts.ts` -- Alert evaluation engine
- `scheduler.ts` -- Polling loop scheduler
- `dashboard.ts` -- CLI dashboard renderer
- `waste-score.ts` -- CU waste score calculator
- `index.ts` -- Main entry point

### Workload Frontend (`workload/app/`)
- `services/kqlQueryService.ts` -- KQL query service with OBO auth
- `hooks/useObservabilityData.ts` -- Dashboard data hook
- `hooks/useSloData.ts` -- SLO data hook
- `hooks/useAlertData.ts` -- Alert data hook
- `clients/FabricAuthenticationService.ts` -- Auth service

### Notebooks (`notebooks/`)
- `NB_ObsIngestion.py` -- Event ingestion notebook
- `NB_ObsCorrelation.py` -- Cross-item correlation notebook
- `NB_ObsAlerts.py` -- Alert evaluation notebook

### Scripts (`scripts/`)
- `fabric-health-check.sh` -- Health check tool
- `upload-notebooks.mjs` -- Notebook upload utility
- `check-eventhouse-schema.mjs` -- Schema verification
- `fix-slo-targets.mjs` -- SLO data correction
- `verify-data-quality.mjs` -- Data quality verification
- `validate-notebooks.mjs` -- Notebook static analysis
- `github-presence-setup.sh` -- GitHub repo setup
- `collect.sh` -- One-shot collection wrapper
- `monitor.sh` -- Continuous monitoring wrapper
- `diagnose-alerts.ps1` -- Alert diagnostics
- `check-schema.ps1` -- Schema diagnostics

### CI/CD
- `.github/workflows/ci.yml` -- Build and test pipeline
- `.github/workflows/pages.yml` -- Landing page deployment

### Configuration
- `.gitignore` -- Version control exclusions
- `workload/.env` -- Workload environment (excluded from git)
- `workload/.env.dev.example` -- Example environment template
- `package.json` -- npm dependency manifest
