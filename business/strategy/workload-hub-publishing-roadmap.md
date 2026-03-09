# Fabric Workload Hub Publishing Roadmap
## Observability Workbench

**Document version**: 1.0
**Date**: 2026-03-09
**Status**: Planning
**Target Preview listing**: 2026-07-01
**Target GA listing**: 2026-10-01

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Assessment](#2-current-state-assessment)
3. [Gap Analysis](#3-gap-analysis)
4. [Phase 1: Preview Readiness](#4-phase-1-preview-readiness)
5. [Phase 2: GA Readiness](#5-phase-2-ga-readiness)
6. [Compliance Checklist](#6-compliance-checklist)
7. [Technical Checklist](#7-technical-checklist)
8. [Timeline](#8-timeline)
9. [Risk Register](#9-risk-register)
10. [Reference Links](#10-reference-links)

---

## 1. Executive Summary

Microsoft's Fabric Workload Hub is the primary distribution channel for third-party workloads inside Microsoft Fabric. Publishing our Observability Workbench to the Workload Hub places our product directly inside the Fabric portal where data engineers and IT admins already work -- eliminating friction from external tool adoption and enabling organic discovery by every Fabric tenant worldwide.

This document maps our current product state against Microsoft's published validation requirements, identifies every gap that must be closed, and provides a phased execution plan to achieve Preview listing by Q3 2026 and General Availability by Q4 2026.

**Key publication milestones:**
- Workload registration submitted to Microsoft
- Manifest passes Extensibility Toolkit Validator CLI with zero errors
- Azure Marketplace SaaS offer published
- Attestation document hosted at public HTTPS URL
- Frontend meets Fabric UX System design standards
- Preview listing live in Workload Hub
- GA listing live in Workload Hub

---

## 2. Current State Assessment

### 2.1 What We Have Built

| Component | Status | Details |
|---|---|---|
| **Workload ID / Name** | Scaffolded | Product.json exists with `ObservabilityWorkbench` naming; publisher set to "AI Agency" |
| **Item types (3)** | Scaffolded | WorkbenchDashboard, SLODefinition, AlertRule -- manifest JSON files exist for all three |
| **Frontend (React/TS)** | Scaffolded | Extensibility Toolkit-based micro-frontend with App.tsx, Ribbon, ItemEditor components, Dialog, OneLakeView, Wizard components |
| **Controllers** | Scaffolded | Authentication, ItemCRUD, Navigation, Settings, DataHub, Notification, Error Handling, Configuration, Theme controllers |
| **Manifest (Product.json)** | Partial | Product manifest with productDetail, supportLink, learningMaterials, createExperience cards; missing `certification` URL in supportLink |
| **Item manifests** | Partial | All 3 items have manifests with editor paths, icons, activeIcons, editorTab config, createItemDialogConfig. `supportedInMonitoringHub: true` set for WorkbenchDashboard. Context menus and quickActions empty. |
| **Job types** | Defined | `evaluateSLOs` and `runAlertChecks` declared in Product.json `itemJobTypes` |
| **Backend data layer** | Live | Eventhouse (EH_Observability) with 6 KQL tables, live data flowing, 40+ events, 145 inventory records |
| **Fabric notebooks** | Live | NB_ObsIngestion, NB_ObsCorrelation, NB_ObsAlerts deployed in Fabric |
| **CLI tool (Node.js)** | Working | Auth, collector, store, dashboard, alerts, scheduler, KQL client, Fabric client modules -- 5,418 lines |
| **Landing page** | Built | Static HTML landing page at landing-page/index.html |
| **GitHub repo** | Public | https://github.com/tenfingerseddy/FabricWorkloads (MIT license) |
| **CI/CD** | Basic | GitHub Actions workflow at .github/workflows/ci.yml |

### 2.2 What We Do Not Have

| Requirement | Status |
|---|---|
| Verified custom domain in Entra tenant | Not started |
| Multitenant Entra app registration (for cross-tenant) | Not done -- current SP is single-tenant |
| Fabric.Extend scope dependency | Not configured |
| Workload registration with Microsoft (https://aka.ms/fabric_workload_registration) | Not submitted |
| Azure Marketplace SaaS offer | Not created |
| Terms of service at public HTTPS URL | Not hosted |
| Privacy policy at public HTTPS URL | Not hosted |
| Attestation document at public HTTPS URL | Not created |
| Documentation site at public HTTPS URL | Not hosted |
| Professional icon set (all required sizes/states) | Placeholder images only |
| Banner image (1920x240) | Placeholder only |
| Slide media / gallery images | Placeholder only |
| OneLake integration for item storage | Not implemented -- data stored in Eventhouse only |
| Frontend deployed to production HTTPS endpoint | Local dev only |
| Validator CLI clean pass | Not run |
| Security review / assessment | Not performed |
| Privacy review / assessment | Not performed |
| Service health dashboard | Not built |
| BCDR plan | Not documented |
| Performance testing documentation | Not performed |
| Regional presence documentation | Not defined |

---

## 3. Gap Analysis

### 3.1 Business Requirements Gaps

| Req ID | Requirement | Preview | GA | Our Status | Gap |
|---|---|---|---|---|---|
| 1.1 | Value to customers articulated | Required | Required | Partially done (README, business plan) | Need customer-facing value proposition page |
| 1.2.1 | Terms of use link (HTTPS) | Required | Required | Not hosted | Must create and host terms of service |
| 1.2.2 | Privacy policy link (HTTPS) | Required | Required | Not hosted | Must create and host privacy policy |
| 1.3.1 | Marketplace offer published | Required | Required | Not started | Must create SaaS offer in Partner Center |
| 1.3.2 | Marketplace offer link correct | Required | Required | Not started | Depends on 1.3.1 |
| 1.3.3 | Publisher name clear | Required | Required | Done | "AI Agency" is set in manifest |
| 1.3.4 | Publisher name aligned with marketplace | Required | Required | Not verifiable | Must match once marketplace offer exists |
| 1.4.1 | Attestation link correct | Required | Required | Not created | Must create vendor attestation document |
| 1.4.2 | Getting started material | Required | Required | Partially done | Need hosted documentation site |
| 1.4.3 | At a glance images/video | Required | Required | Placeholder only | Need product screenshots and/or demo video |
| 1.4.4 | Learning material on static pages | Required | Required | Not hosted | Need documentation site |
| 1.4.5 | Documentation link correct | Required | Required | Link points to aka.ms redirect (not live) | Need live documentation URL |

### 3.2 Technical Requirements Gaps

| Req ID | Requirement | Preview | GA | Our Status | Gap |
|---|---|---|---|---|---|
| 2.1.1 | Verified Entra App ID | Required | Required | SP exists but domain not verified | Verify custom domain, reconfigure app registration |
| 2.1.2 | Fabric.Extend scope dependency | Required | Required | Not configured | Add static dependency on Fabric.Extend scope |
| 2.1.3 | Entra redirect URL correct | Required | Required | Not configured for production | Must return minimal HTML with `window.close()` |
| 2.1.4 | Entra scopes minimal | Optional | Optional | Not reviewed | Audit scope requests |
| 2.2 | OneLake integration | Required | Required | Data is in Eventhouse, not OneLake | Must store item definitions/metadata in OneLake |
| 2.3 | Conditional Access support | Required | Required | Not tested | Must test and attest |
| 2.4 | Customer-facing monitoring | Required | Required | CLI dashboard exists | Need in-product monitoring, minimum 30-day telemetry retention |
| 2.5 | B2B cross-tenant | Optional | Optional | Not implemented | Future consideration |
| 2.6 | BCDR plan | Optional | Optional | Not documented | Should document for credibility |
| 2.7 | Performance testing | Required | Required | Not performed | Must benchmark and document |
| 2.8 | Regional presence | Required | Required | Backend in Australia East only | Document supported regions and data residency commitments |
| 2.9 | Accessibility compliance | Required | Required | Not audited | Must audit against Fabric UX System guidelines |
| 2.10 | World readiness (English default) | Required | Required | English only | Compliant; attest in document |

### 3.3 Design/UX Requirements Gaps

| Req ID | Requirement | Preview | GA | Our Status | Gap |
|---|---|---|---|---|---|
| 3.1.1 | Clear workload name | Required | Required | "Observability Workbench" -- good | None |
| 3.1.2 | Professional icons/images | Required | Required | Placeholder PNGs | Need designer to create full icon set |
| 3.1.2.1 | Product icon 240x240 | Required | Required | Not verified | Need proper branded icon |
| 3.1.2.2 | Favicon | Required | Required | Placeholder | Need branded favicon at correct sizes |
| 3.1.2.3-7 | All icon variants (actions, create, tabs, active) | Required | Required | Using same placeholder for all | Need full icon set at 16/20/24/32/40/48/64px |
| 3.1.3 | Clear subtitle/slogan | Required | Required | Localization key exists, content TBD | Write compelling slogan |
| 3.1.4 | Clear description | Required | Required | Localization key exists, content TBD | Write product description |
| 3.1.4.1 | Hub card description | Required | Required | Localization key exists, content TBD | Write concise card description |
| 3.1.5 | Banner image 1920x240 | Required | Required | Placeholder | Design professional banner |
| 3.1.6 | No ads in gallery videos | Required | Required | No videos yet | Ensure compliance when created |
| Item 3.1-3.10 | Ribbon follows Fabric UX | Required | Required | Ribbon scaffolded with components | Must audit against Fabric UX System for typography, color, spacing, elevation, border radius |
| Item 4.1-4.8 | Canvas follows Fabric UX | Required | Required | ItemEditor exists with views | Must audit and align with Fabric UX guidelines |
| Item 6.1-6.6 | Dialogs follow Fabric UX | Required | Required | Dialog component exists | Must audit styling compliance |

### 3.4 Security and Compliance Gaps

| Req ID | Requirement | Preview | GA | Our Status | Gap |
|---|---|---|---|---|---|
| 4.1 | Security review completed | Required | Required | Not done | Must perform security assessment |
| 4.1.1 | Entra tokens via Fabric host | Required | Required | AuthenticationController exists | Must verify implementation is compliant |
| 4.1.2 | Tokens only via Fabric Client SDK | Required | Required | Not fully verified | Must audit all token acquisition paths |
| 4.1.3 | No third-party cookies | Required | Required | Not audited | Must audit and attest |
| 4.1.4 | Entra app name aligned | Required | Required | Not configured | Rename app to match workload |
| 4.2 | Privacy review completed | Required | Required | Not done | Must perform privacy assessment |
| 4.2.1 | Essential HTTP-only cookies only | Required | Required | Not audited | Must audit |
| 4.2.2 | No third-party cookies | Required | Required | Not audited | Must audit |

---

## 4. Phase 1: Preview Readiness

**Target date: 2026-07-01**
**Duration: ~16 weeks from today**

Phase 1 delivers a validated, functional workload that passes Microsoft's Preview requirements and is listed in the Workload Hub with the Preview badge.

### Sprint 1: Infrastructure and Registration (Weeks 1-2, Mar 10-23)

**Milestone: Entra and Registration Foundation**

- [ ] **Register custom domain** in Entra tenant (e.g., `kaneai.com` or `observability-workbench.com`)
  - Purchase domain if needed
  - Complete DNS verification in Entra admin center
  - Document: verified domain name and tenant association

- [ ] **Create multitenant Entra app registration**
  - App type: Web application
  - Supported account types: Accounts in any organizational directory (multitenant)
  - Set Application ID URI using verified domain format
  - Configure redirect URI: `https://fe.{domain}/close`
  - Add required API permissions: Microsoft Fabric APIs
  - Add static dependency on `Fabric.Extend` scope
  - Set app display name to "Observability Workbench" (aligned with workload name)
  - Set publisher information to match "AI Agency"

- [ ] **Submit workload registration** at https://aka.ms/fabric_workload_registration
  - Workload ID: `AIAgency.ObservabilityWorkbench` (Publisher.Workload format, max 32 chars for workload portion)
  - Publishing tenant defined
  - Wait for registration approval

- [ ] **Provision production hosting infrastructure**
  - Azure App Service or Azure Static Web Apps for frontend
  - HTTPS with valid SSL certificates on custom domain
  - Configure CORS for `*.powerbi.com` and `*.fabric.microsoft.com`
  - Configure CSP frame-ancestors for Fabric domains
  - Target: frontend available at `https://fe.{domain}`

### Sprint 2: OneLake Integration and Core Functionality (Weeks 3-5, Mar 24 - Apr 13)

**Milestone: Items Store Data in OneLake**

- [ ] **Implement OneLake storage for item definitions**
  - WorkbenchDashboard: store dashboard configuration as JSON in OneLake
  - SLODefinition: store SLO configuration as JSON/Parquet in OneLake
  - AlertRule: store alert rule configuration as JSON in OneLake
  - Use Fabric platform APIs (OneLake ADLS Gen2 endpoint) for read/write
  - Keep Eventhouse as the analytics/query layer (computed data, not item definitions)

- [ ] **Implement item CRUD lifecycle end-to-end**
  - Create: items appear in workspace immediately upon creation
  - Read: items load their definition from OneLake when opened
  - Update: save/autosave writes definition back to OneLake
  - Delete: clean up OneLake files when item is deleted
  - Verify items appear in workspace list, recent items, and multitasking menu

- [ ] **Implement redirect URI close page**
  - Create minimal HTML page at `{frontend-url}/close` that only executes `window.close()`
  - No other content, scripts, or styles

- [ ] **Verify Fabric.Extend token flow**
  - Tokens obtained exclusively through Fabric host SDK
  - No custom token acquisition paths
  - Test consent flow for new users

### Sprint 3: UX Compliance and Item Editors (Weeks 6-8, Apr 14 - May 4)

**Milestone: All 3 Item Editors Pass UX Guidelines**

- [ ] **Audit and fix Ribbon implementation** against Fabric UX System (https://aka.ms/fabricux)
  - "Home" tab is first tab and is named "Home"
  - Ribbon is sticky on top above canvas
  - Buttons use Fabric button component in subtle state
  - Max height 32px for non-button components
  - Correct typography (Fabric-approved fonts, sizes, weights)
  - Correct color tokens and theme support
  - Correct elevation/shadow
  - Correct border radius
  - Correct spacing (0px between adjacent buttons, 4px around separators/droplines)
  - Tooltips follow Fabric guidelines

- [ ] **Audit and fix Canvas/Editor** against Fabric UX System
  - Canvas border styling compliant
  - Empty states follow guidelines (helpful messaging, clear CTAs)
  - Left drawer panel styling (if used)
  - Tab components follow guidelines
  - Switch controls follow guidelines (if used)

- [ ] **Audit and fix Dialog styling** against Fabric UX System
  - Modal behavior, backdrop, dismissal patterns
  - Typography, color, elevation, border radius, spacing all compliant

- [ ] **Implement Save/AutoSave** for item editors
  - Either explicit save button (icon only in ribbon) or autosave functionality

- [ ] **Verify item creation works on both domains**
  - Test item creation on `*.powerbi.com`
  - Test item creation on `*.fabric.microsoft.com`

- [ ] **Verify workspace actions work**
  - Rename, delete, share (standard workspace actions)
  - Test all defined context menu items and quick actions

### Sprint 4: Branding, Icons, and Content (Weeks 9-10, May 5-18)

**Milestone: Professional Visual Identity Complete**

- [ ] **Commission/create professional icon set**
  - Product icon: PNG at sizes 16x16, 20x20, 24x24, 32x32, 40x40, 48x48, 64x64
  - Per-item icons (WorkbenchDashboard, SLODefinition, AlertRule): same sizes
  - Active state variants for all item icons
  - Create experience icons + small variants
  - Tab icons + active variants
  - Custom action icons (if any)
  - Favicon in multiple sizes
  - All icons must follow Fabric filetype icon guidelines (container + Fluent interior icon)
  - All must be PNG, JPEG, or SVG; optimized for web

- [ ] **Create banner image** at exactly 1920x240 pixels
  - Professional, on-brand, represents workload value

- [ ] **Create gallery/slide media**
  - Product screenshots showing real functionality
  - Optional: short demo video (no ads, product-focused only)

- [ ] **Write all localization strings**
  - `ObservabilityWorkbench_Display_Name`: "Observability Workbench"
  - `ObservabilityWorkbench_Full_Display_Name`: "Observability Workbench by AI Agency"
  - `ObservabilityWorkbench_Description`: Full product description (features, capabilities, use cases)
  - `ObservabilityWorkbench_Hub_Slogan`: Concise value subtitle (e.g., "Full-stack observability for Microsoft Fabric")
  - `ObservabilityWorkbench_Hub_Description`: Detailed Hub description
  - Hub card description (concise for card format)
  - Item display names, plurals, subtitles for all 3 item types

- [ ] **Create and host documentation site**
  - Getting started guide
  - Item type documentation (WorkbenchDashboard, SLODefinition, AlertRule)
  - Architecture overview
  - FAQ
  - Host at `https://docs.{domain}` or GitHub Pages equivalent
  - All learning material links must land on static pages (not dynamic/temporary)

### Sprint 5: Legal, Compliance, and Marketplace (Weeks 11-13, May 19 - Jun 8)

**Milestone: All Legal Documents Hosted; Marketplace Offer Published**

- [ ] **Draft and host Terms of Service**
  - Cover workload usage, data handling, liability, SLAs
  - Host at public HTTPS URL (e.g., `https://{domain}/terms`)
  - URL must return HTTP 200-399

- [ ] **Draft and host Privacy Policy**
  - Cover what data is collected, how it is stored, retention, user rights
  - Host at public HTTPS URL (e.g., `https://{domain}/privacy`)
  - URL must return HTTP 200-399

- [ ] **Perform security assessment**
  - Audit all authentication paths (Entra tokens via Fabric SDK only)
  - Audit cookie usage (no third-party cookies; essential HTTP-only cookies only, post-authentication)
  - Audit data encryption (in transit and at rest)
  - Audit input validation and sanitization
  - Audit security headers
  - Document findings and remediation

- [ ] **Perform privacy assessment**
  - Document what customer data is accessed
  - Document what data is stored and where
  - Document data retention policies
  - Document data residency commitments
  - Document user rights and data deletion procedures

- [ ] **Create Azure Marketplace SaaS offer**
  - Register as Microsoft partner in Partner Center (if not already)
  - Create SaaS offer with:
    - Free tier: 1 workspace, 7-day retention, 5 SLOs
    - Professional tier: $499/month per capacity
    - Enterprise tier: $1,499/month per capacity
  - Ensure publisher name matches manifest exactly ("AI Agency")
  - Submit for marketplace certification
  - Once published, update `product.productDetail.supportLink.license.url` in manifest with marketplace URL

- [ ] **Create vendor attestation document** following Microsoft template
  - Section I: ISV information (company name, website, address, primary contact)
  - Section II: Formal attestation statement
  - Section III: Detailed checklist covering:
    - Business requirements (value proposition, trial, monetization)
    - Technical requirements (Entra access, OneLake, conditional access, monitoring, performance, presence)
    - Design/UX requirements (common UX, item creation, monitoring hub, accessibility, world readiness)
    - Security/compliance (security review, privacy review, data residency, compliance standards)
    - Support (live site contacts, supportability, service health)
    - Fabric features (ALM, CI/CD, item portability, private links, data hub, lineage, sensitivity labels)
  - Host at public HTTPS URL (e.g., `https://{domain}/attestation`)
  - Update `product.productDetail.supportLink.certification.url` in manifest

- [ ] **Update all manifest supportLink URLs** to point to live, reachable HTTPS endpoints
  - `documentation.url` -> live docs site
  - `help.url` -> live support page
  - `privacy.url` -> live privacy policy
  - `terms.url` -> live terms of service
  - `license.url` -> Azure Marketplace offer URL
  - `certification.url` -> attestation document URL

### Sprint 6: Validation, Testing, and Submission (Weeks 14-16, Jun 9-29)

**Milestone: Validator CLI Clean Pass; Publishing Request Submitted**

- [ ] **Run Extensibility Toolkit Validator CLI**
  - Install validator: follow https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/tutorial-validate-workload
  - Run against packaged manifest
  - Fix all errors and warnings
  - Iterate until clean pass

- [ ] **End-to-end functional testing**
  - Item creation via Creation Hub, workspace menu, and home
  - Item CRUD operations across all 3 item types
  - Item favoriting in "new" menu
  - Multitasking menu behavior
  - Cross-domain testing (powerbi.com and fabric.microsoft.com)
  - Workspace actions (rename, delete, share)
  - OneLake data persistence verification
  - Monitoring Hub job surfacing
  - Authentication consent flow for new users in new tenants

- [ ] **Performance testing**
  - Page load time < 3 seconds
  - Item editor load time benchmarking
  - Document results for attestation

- [ ] **Accessibility audit**
  - Keyboard navigation
  - Screen reader compatibility
  - Color contrast compliance
  - Document compliance level

- [ ] **Deploy to production infrastructure**
  - Frontend deployed to production HTTPS endpoint
  - All manifest URLs live and returning 200
  - CORS and CSP headers configured

- [ ] **Submit publishing request** via https://aka.ms/fabric_workload_publishing
  - Include all required materials
  - Expect Microsoft review and feedback cycle

- [ ] **Address validation feedback** from Microsoft
  - Work iteratively with Microsoft team
  - Fix any flagged issues
  - Resubmit as needed

**OUTCOME: Preview listing in Workload Hub**

---

## 5. Phase 2: GA Readiness

**Target date: 2026-10-01**
**Duration: ~12 weeks after Preview**

Phase 2 hardens the product, addresses customer feedback from Preview usage, and closes all "Optional" requirements that strengthen the offering for enterprise adoption.

### Sprint 7-8: Customer Feedback and Hardening (Weeks 17-20, Jul 1 - Jul 27)

- [ ] **Monitor Preview adoption metrics**
  - Track installs, item creations, daily active users
  - Collect user feedback through support channels
  - Identify and prioritize top issues

- [ ] **Implement B2B cross-tenant support** (optional but recommended for enterprise)
  - Allow guest users to access workload items per Fabric B2B model
  - Test cross-tenant access scenarios

- [ ] **Implement trial experience**
  - Preconfigured sample items that demonstrate value in < 5 seconds
  - No waiting time for trial activation
  - Time-limited or feature-limited per Microsoft guidelines

- [ ] **Implement monetization experience**
  - In-product upgrade prompts aligned with Fabric design guidelines
  - Marketplace integration for license management
  - BYOL fallback if needed

- [ ] **Build service health dashboard**
  - Publicly accessible page showing service status
  - Include uptime, incident history, planned maintenance
  - Host at `https://{domain}/status` or equivalent

### Sprint 9-10: Enterprise Readiness (Weeks 21-24, Jul 28 - Aug 24)

- [ ] **Document and test BCDR plan**
  - Define RPO (Recovery Point Objective) and RTO (Recovery Time Objective)
  - Document backup procedures for customer data
  - Test disaster recovery procedures
  - Update attestation document

- [ ] **Expand regional presence**
  - Evaluate deployment to additional Azure regions beyond Australia East
  - Document data residency commitments per region
  - Update attestation document with supported regions

- [ ] **Implement CI/CD support** via Fabric CI/CD manifest section
  - Item definitions exportable and importable
  - Item definition portability across workspaces
  - Document CI/CD integration guide

- [ ] **Evaluate and implement Data Hub integration**
  - If storing data items, ensure they appear in OneLake Data Hub
  - Surface item lineage information

- [ ] **Evaluate sensitivity labels support**
  - Microsoft Purview Information Protection integration
  - Document export behavior with labeled data

- [ ] **Implement custom actions** for items
  - Context menu actions (e.g., "Run SLO Evaluation", "Test Alert")
  - Workspace-level actions
  - Verify all defined actions function correctly

- [ ] **Implement item settings panel**
  - Per-item configuration following Fabric patterns
  - Settings accessible from ribbon

### Sprint 11-12: GA Submission (Weeks 25-28, Aug 25 - Sep 21)

- [ ] **Update attestation document** with all GA-level attestations
  - Complete all Section III checklist items
  - Document all supported Fabric features (ALM, CI/CD, data hub, lineage, etc.)
  - Re-host updated document

- [ ] **Final security review**
  - Re-audit after all Preview-phase changes
  - Document updated security posture

- [ ] **Final privacy review**
  - Re-audit after all Preview-phase changes
  - Document updated privacy posture

- [ ] **Performance benchmarking** (final)
  - Benchmark under realistic load
  - Document SLA commitments

- [ ] **Run Validator CLI** (final clean pass)

- [ ] **Submit GA publishing request** via https://aka.ms/fabric_workload_publishing
  - Include updated materials
  - Note: this removes the Preview badge from listing

**OUTCOME: GA listing in Workload Hub**

---

## 6. Compliance Checklist

### 6.1 Privacy and Data Protection

| # | Requirement | Status | Target | Notes |
|---|---|---|---|---|
| 1 | Privacy policy published at HTTPS URL | Not done | Sprint 5 | Must cover data collection, storage, retention, user rights |
| 2 | Privacy assessment completed | Not done | Sprint 5 | Formal review of data handling practices |
| 3 | No third-party cookies | Not audited | Sprint 5 | Must audit frontend for any third-party cookie usage |
| 4 | Only essential HTTP-only cookies after auth | Not audited | Sprint 5 | Must audit all cookie usage patterns |
| 5 | Entra tokens acquired only via Fabric SDK | Not verified | Sprint 2 | Must verify AuthenticationController compliance |
| 6 | Data residency commitments documented | Not done | Sprint 5 | Must define what data stays in which region |
| 7 | Customer data deletion procedures defined | Not done | Sprint 5 | Must document how customers can request data deletion |
| 8 | Data encryption in transit (HTTPS) | Partially done | Sprint 1 | Production hosting must use valid SSL |
| 9 | Data encryption at rest | Partially done | Sprint 2 | Eventhouse/OneLake provide encryption at rest natively |

### 6.2 Security

| # | Requirement | Status | Target | Notes |
|---|---|---|---|---|
| 1 | Security assessment completed | Not done | Sprint 5 | Full security review of workload |
| 2 | Conditional Access support tested | Not done | Sprint 5 | Must test workload under CA-enabled tenants |
| 3 | Entra app name matches workload name | Not configured | Sprint 1 | Rename SP to "Observability Workbench" |
| 4 | Entra app publisher matches manifest | Not configured | Sprint 1 | Set publisher domain in app registration |
| 5 | Minimum Entra scopes requested | Not audited | Sprint 2 | Audit and minimize scope requests |
| 6 | Input validation and sanitization | Not audited | Sprint 5 | Audit all user inputs |
| 7 | Security headers implemented | Not done | Sprint 1 | Configure on production hosting |
| 8 | CSP headers configured | Not done | Sprint 1 | Allow Fabric domains, restrict others |

### 6.3 Legal and Business

| # | Requirement | Status | Target | Notes |
|---|---|---|---|---|
| 1 | Terms of service published at HTTPS URL | Not done | Sprint 5 | Must cover usage, liability, SLAs |
| 2 | Azure Marketplace SaaS offer published | Not done | Sprint 5 | Required for license URL validation |
| 3 | Publisher name consistent across manifest + marketplace | Not verifiable yet | Sprint 5 | Must be "AI Agency" everywhere |
| 4 | Attestation document hosted at HTTPS URL | Not done | Sprint 5 | Must follow Microsoft template exactly |
| 5 | Support information published | Not done | Sprint 5 | Contact methods, SLA, self-service portal |
| 6 | Service health dashboard available | Not done | GA phase | Publicly accessible status page |

---

## 7. Technical Checklist

### 7.1 Entra and Authentication

| # | Item | Status | Blocking? |
|---|---|---|---|
| 1 | Custom domain verified in Entra tenant | Not done | YES -- blocks everything |
| 2 | Multitenant Entra app registration created | Not done | YES -- blocks cross-tenant |
| 3 | Application ID URI uses verified domain | Not done | YES |
| 4 | Redirect URI set to `{frontend-url}/close` | Not done | YES |
| 5 | Close page returns minimal HTML with `window.close()` | Not done | YES |
| 6 | Fabric.Extend scope added as static dependency | Not done | YES |
| 7 | Consent flow tested end-to-end | Not done | YES |
| 8 | On-behalf-of (OBO) flow working if needed | Not done | NO |

### 7.2 Manifest Validation

| # | Item | Status | Blocking? |
|---|---|---|---|
| 1 | `product.productDetail.supportLink.terms.url` -- live HTTPS | Not live | YES |
| 2 | `product.productDetail.supportLink.privacy.url` -- live HTTPS | Not live | YES |
| 3 | `product.productDetail.supportLink.license.url` -- marketplace domain | Not set | YES |
| 4 | `product.productDetail.supportLink.certification.url` -- live HTTPS | Not in manifest | YES |
| 5 | `product.productDetail.supportLink.documentation.url` -- live HTTPS | Not live | YES |
| 6 | Product icon exists and is proper PNG/JPEG/SVG at correct sizes | Placeholder | YES |
| 7 | Favicon exists at correct sizes | Placeholder | YES |
| 8 | Banner image is 1920x240 PNG/JPEG | Placeholder | YES |
| 9 | All item icons exist in required sizes with active variants | Placeholder | YES |
| 10 | Create experience icons and small variants exist | Placeholder | YES |
| 11 | Tab icons and active variants exist | Placeholder | YES |
| 12 | Slide media images/videos exist and are product-focused | Placeholder | YES |
| 13 | All localization strings populated (not keys) | Keys only | YES |
| 14 | Workload ID matches registered ID | Not registered | YES |
| 15 | Validator CLI returns zero errors | Not run | YES |

### 7.3 Frontend Requirements

| # | Item | Status | Blocking? |
|---|---|---|---|
| 1 | Frontend deployed at HTTPS on custom domain subdomain | Not deployed | YES |
| 2 | CORS allows `*.powerbi.com` and `*.fabric.microsoft.com` | Not configured | YES |
| 3 | CSP frame-ancestors allows Fabric domains | Not configured | YES |
| 4 | Page load time < 3 seconds | Not benchmarked | YES |
| 5 | Ribbon has "Home" tab as first tab | Needs verification | YES |
| 6 | Ribbon is sticky above canvas | Needs verification | YES |
| 7 | All UX components use Fabric UX System components | Needs audit | YES |
| 8 | Item creation works via Creation Hub, workspace menu, home | Scaffolded | YES |
| 9 | Items persist in workspace immediately | Scaffolded | YES |
| 10 | Items appear in multitasking menu | Scaffolded | YES |
| 11 | Item creation works on both *.powerbi.com and *.fabric.microsoft.com | Not tested | YES |
| 12 | Item favoriting works in "new" menu | Needs verification | YES |
| 13 | Empty states follow Fabric guidelines | Exists, needs audit | YES |
| 14 | Dialogs follow Fabric UX guidelines | Exists, needs audit | YES |

### 7.4 Data Layer Requirements

| # | Item | Status | Blocking? |
|---|---|---|---|
| 1 | Item definitions stored in OneLake | Not implemented | YES |
| 2 | Eventhouse used for analytics (computed data) | Implemented | OK |
| 3 | Customer-facing telemetry retained minimum 30 days | Implemented (Eventhouse) | OK |
| 4 | Activity IDs stored for support purposes | Needs verification | YES |

### 7.5 Infrastructure Requirements

| # | Item | Status | Blocking? |
|---|---|---|---|
| 1 | Production HTTPS hosting with valid SSL | Not done | YES |
| 2 | Minimum 99.9% uptime SLA | Not committed | YES for GA |
| 3 | CORS configured | Not done | YES |
| 4 | CSP configured | Not done | YES |
| 5 | Security headers implemented | Not done | YES |

---

## 8. Timeline

### Visual Roadmap

```
2026 Mar        Apr           May           Jun           Jul     Aug     Sep     Oct
 |--- Sprint 1 ---|--- Sprint 2 ---|--- Sprint 3 --|-- Sprint 4 --|-- Sprint 5 --|-- Sprint 6 --|
 |  Infra/Reg     |  OneLake/CRUD  |  UX Compliance | Branding    | Legal/Mktpl  | Validate     |
 |                |                |                |             |              |  & Submit    |
 |                                                                               |
 |                                                                          PREVIEW LISTED
 |
 |                                                                Jul     Aug     Sep     Oct
 |                                                                |-- S7-8 --|-- S9-10 -|-- S11-12 -|
 |                                                                | Feedback | Enterprise| GA Submit |
 |                                                                | Harden   | Readiness |           |
 |                                                                                              |
 |                                                                                         GA LISTED
```

### Key Milestones

| Date | Milestone |
|---|---|
| 2026-03-15 | Custom domain purchased and DNS verification initiated |
| 2026-03-23 | Workload registration submitted to Microsoft |
| 2026-04-13 | OneLake integration complete; item CRUD working end-to-end |
| 2026-05-04 | All 3 item editors pass Fabric UX audit |
| 2026-05-18 | Professional icon set and all visual assets complete |
| 2026-06-08 | Terms, privacy policy, attestation document, and marketplace offer all live |
| 2026-06-15 | Validator CLI clean pass achieved |
| 2026-06-29 | Publishing request submitted to Microsoft |
| 2026-07-01 | Target: Preview listing live (subject to Microsoft review timeline) |
| 2026-08-24 | Enterprise features (BCDR, multi-region, CI/CD) complete |
| 2026-09-21 | GA publishing request submitted |
| 2026-10-01 | Target: GA listing live |

### Effort Estimates

| Sprint | Duration | Primary Focus | Est. Hours |
|---|---|---|---|
| Sprint 1 | 2 weeks | Infrastructure, Entra, Registration | 60 |
| Sprint 2 | 3 weeks | OneLake integration, Item CRUD, Auth flow | 100 |
| Sprint 3 | 3 weeks | UX compliance, Editor polish | 100 |
| Sprint 4 | 2 weeks | Branding, icons, content, documentation | 60 |
| Sprint 5 | 3 weeks | Legal, compliance, marketplace, attestation | 80 |
| Sprint 6 | 3 weeks | Validation, testing, deployment, submission | 80 |
| **Phase 1 Total** | **16 weeks** | | **480 hours** |
| Sprint 7-8 | 4 weeks | Customer feedback, trial, monetization | 120 |
| Sprint 9-10 | 4 weeks | Enterprise features, CI/CD, data hub | 120 |
| Sprint 11-12 | 4 weeks | Final audits, GA submission | 80 |
| **Phase 2 Total** | **12 weeks** | | **320 hours** |
| **Grand Total** | **28 weeks** | | **800 hours** |

---

## 9. Risk Register

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| 1 | **Workload registration delayed by Microsoft** | Blocks entire timeline | Medium | Submit early (Sprint 1); follow up weekly; have alternative Workload ID ready |
| 2 | **Marketplace SaaS offer certification rejected** | Blocks Preview submission | Medium | Start Partner Center enrollment early; follow Microsoft SaaS certification policies closely |
| 3 | **OneLake integration more complex than estimated** | Delays Sprint 2 by 2-4 weeks | Medium | Prototype early; use Extensibility Toolkit samples as reference |
| 4 | **Fabric UX audit reveals major redesign needed** | Delays Sprint 3 by 2-4 weeks | High | Use Fabric UX System components from day one; review Fabric Templates (https://aka.ms/fabrictemplates) early |
| 5 | **Microsoft validation feedback requires significant rework** | Delays Preview by 4-8 weeks | Medium | Run Validator CLI early and often; address all warnings, not just errors |
| 6 | **Custom domain verification fails** | Blocks Entra app configuration | Low | Have backup domain ready; start process immediately |
| 7 | **Security review reveals vulnerabilities** | Delays submission until remediated | Medium | Build with security-first patterns; audit continuously, not just at the end |
| 8 | **Insufficient capacity for icon/design work** | Delays Sprint 4 | Medium | Engage designer early; consider Fiverr/99designs as backup; use Fabric visuals kit as starting point |
| 9 | **Entra Conditional Access breaks workload** | Blocks compliance attestation | Low | Test early against CA-enabled tenant |
| 10 | **Microsoft changes requirements during our build** | Rework needed | Low | Monitor docs for updates (last updated 2026-03-04); subscribe to Fabric blog |

---

## 10. Reference Links

### Microsoft Documentation (Publishing)

| Resource | URL |
|---|---|
| Publishing overview | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/publishing-overview |
| General publishing requirements | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/publishing-requirements-general |
| Workload validation requirements | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/publishing-requirements-workload |
| Item validation requirements | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/publishing-requirements-item |
| Vendor attestation template | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/publishing-vendor-attestation-template |
| Validation tutorial | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/tutorial-validate-workload |
| Publish workload flow | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/publish-workload-flow |

### Microsoft Documentation (Technical)

| Resource | URL |
|---|---|
| Manifest overview | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/manifest-overview |
| Product manifest | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/manifest-product |
| Item manifest | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/manifest-item |
| Workload manifest | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/manifest-workload |
| Authentication overview | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/authentication-overview |
| Authentication guidelines | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/authentication-guidelines |
| OneLake data storage | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/how-to-store-data-in-onelake |
| Item creation | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/how-to-create-item |
| Custom actions | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/how-to-add-custom-item-actions |
| Jobs integration | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/how-to-add-jobs-to-be-done |
| Trial experience | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/how-to-add-trial-experience |
| Monetization | https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/how-to-monetize-workload |

### Microsoft Design

| Resource | URL |
|---|---|
| Fabric UX System | https://aka.ms/fabricux |
| Fabric visuals kit | https://aka.ms/fabricvisualskit |
| Fabric UI kit | https://aka.ms/fabricuikit |
| Fabric templates | https://aka.ms/fabrictemplates |

### Registration and Submission

| Resource | URL |
|---|---|
| Workload registration form | https://aka.ms/fabric_workload_registration |
| Publishing request form | https://aka.ms/fabric_workload_publishing |
| Partner Center | https://partner.microsoft.com |
| SaaS offer creation guide | https://learn.microsoft.com/en-us/partner-center/marketplace-offers/plan-saas-offer |
| Marketplace certification policies | https://learn.microsoft.com/en-us/marketplace/certification-policies#1000-software-as-a-service-saas |

### Our Resources

| Resource | URL |
|---|---|
| GitHub repository | https://github.com/tenfingerseddy/FabricWorkloads |
| Business plan | business/strategy/business-plan.md |
| Product specification | products/observability-workbench/specs/product-spec.md |
| Pricing analysis | business/strategy/pricing-analysis.md |
| Content calendar | business/strategy/content-calendar.md |
| Competitive analysis | business/market-research/competitive-analysis.md |

---

## Appendix A: Manifest Field Checklist

Fields in `Product.json` that must be populated with real values (not placeholders) before submission:

```
product.name                                          -> Registered Workload ID
product.version                                       -> Semantic version
product.displayName                                   -> Localized display name
product.fullDisplayName                               -> Localized full display name
product.description                                   -> Localized description
product.favicon                                       -> Real favicon asset
product.icon.name                                     -> Real product icon asset
product.productDetail.publisher                       -> "AI Agency" (must match marketplace)
product.productDetail.slogan                          -> Localized slogan string
product.productDetail.description                     -> Localized Hub description
product.productDetail.image.source                    -> Real banner (1920x240)
product.productDetail.slideMedia[].source             -> Real product screenshots
product.productDetail.supportLink.documentation.url   -> Live HTTPS URL
product.productDetail.supportLink.help.url            -> Live HTTPS URL
product.productDetail.supportLink.privacy.url         -> Live HTTPS URL
product.productDetail.supportLink.terms.url           -> Live HTTPS URL
product.productDetail.supportLink.license.url         -> Marketplace URL (azuremarketplace/appsource)
product.productDetail.supportLink.certification.url   -> Live attestation doc HTTPS URL
product.homePage.learningMaterials[].link              -> Live HTTPS URL to static docs
```

## Appendix B: Attestation Document Structure

The attestation document must follow Microsoft's template with these sections:

**Section I** (submitted to Microsoft only):
- Company name, website, address, city, state, postal code, country, phone
- Primary contact: name, title, email

**Section II** (submitted to Microsoft only):
- Formal attestation statement signed by authorized representative

**Section III** (hosted publicly for customers):
- Workload version, name, release date
- Business requirements: value proposition, trial, monetization
- Technical requirements: Entra access, OneLake, Conditional Access, Admin REST API, monitoring (30-day min), B2B, BCDR, performance, presence, public APIs
- Design/UX: common UX, item creation, monitoring hub, trial, monetization, accessibility, world readiness, item settings, samples, custom actions, workspace settings, global search
- Security/compliance: security review, privacy review, cookie policy, data residency, compliance standards
- Support: live site contact info, supportability, service health dashboard
- Fabric features: ALM, CI/CD, item portability, private links, data hub, lineage, sensitivity labels
- Extra notes and consolidated references
