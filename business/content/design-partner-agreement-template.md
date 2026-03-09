# Design Partner Agreement

> Observability Workbench for Microsoft Fabric
> Effective Date: [Date]

---

## Parties

**Product Team** ("we", "us", "our"): The Observability Workbench development team.

**Design Partner** ("you", "your"): [Organization Name], represented by [Contact Name], [Title], [Email].

---

## What This Agreement Is

This is a lightweight partnership agreement between a product team and an early adopter. It is not a vendor contract, a service-level agreement, or a procurement document. Its purpose is to set clear expectations so both sides get value from the relationship.

If your legal team needs a formal MSA or DPA, we are happy to work through that separately. This document covers the operational commitments.

---

## Program Duration

**Start date**: [Date]
**End date**: 12 weeks from start date, approximately [Date]

Either party can end the partnership early at any time with 7 days written notice (email is sufficient). No penalty, no hard feelings.

The program may be extended by mutual written agreement if both parties see value in continuing.

---

## What We Commit To

### Product Access

- Full Professional-tier features ($499/month value) at zero cost for the duration of the program
- Scope: up to 5 monitored workspaces, 90-day data retention, unlimited SLO definitions, full alerting and correlation features
- Access begins on the program start date and continues through the program end date

### Support

- A private support channel (Discord or Microsoft Teams, your preference) with the engineering team
- Target response time: 4 hours during business hours (Australian Eastern Standard Time / UTC+10, Monday through Friday)
- This is a best-effort target, not a contractual SLA. We are a small team and there will be occasional delays. We will always communicate expected response times if we are running behind.

### Transparency

- Bi-weekly release notes summarizing what changed, what was fixed, and what is planned
- Advance notice (minimum 48 hours) before any breaking changes to APIs, KQL schemas, or configuration
- Honest communication about product limitations, known issues, and things that are not yet built

### Roadmap Influence

- Design partners participate in sprint prioritization: we share the candidate feature list and partners vote on what matters most
- Partner-reported bugs are triaged within 24 hours and prioritized above general backlog items
- We will not guarantee that every requested feature gets built, but we guarantee every request gets an honest response with reasoning

### Early Access

- New features delivered to design partners at least 2 weeks before general availability release

### Post-Program Transition

At the end of the 12-week program, you choose one of three paths:

1. **Continue on Free tier**: 1 workspace, 7-day retention, 5 SLOs. No cost. No obligation.
2. **Convert to Professional tier at 50% discount**: $249.50/month per capacity for 3 months, then standard $499/month pricing.
3. **End participation**: No penalty. Data already stored in your Eventhouse remains yours. We ask only for a brief exit survey (15 minutes).

---

## What We Ask From You

### Installation and Usage

- Install and configure the tool against a real Fabric environment within the first week of the program
- Non-production environments are acceptable, but the workloads being monitored should be real (not synthetic test data) -- the tool needs realistic job volumes and failure patterns to be properly evaluated
- Use the tool for monitoring during the program so that feedback is based on hands-on experience, not theoretical impressions

### Feedback

- Attend a bi-weekly feedback session: 30 minutes, every 2 weeks, for a total of 6 sessions over the 12-week program
- Sessions can be conducted via video call (Zoom, Teams, or Google Meet) or asynchronously via Loom recording if scheduling is difficult
- Feedback should be honest and specific. "It does not work well" is less useful than "the correlation engine missed a dependency between my pipeline X and notebook Y because Z."
- File bugs and feature requests on the GitHub repository as you encounter them

### End-of-Program Assessment

- Complete a structured survey in Week 11 covering: satisfaction, feature gaps, willingness to continue, and willingness to recommend
- Estimated time: 15 minutes

### Metrics and Attribution

- Grant permission for us to use anonymized, aggregate metrics from the design partner program in marketing materials
  - Example of what we would publish: "Design partners detected an average of X unmonitored failures per week"
  - Example of what we would NOT publish without separate written permission: "[Organization Name] reduced their MTTR by X%"
- We will never share organization-specific data, environment details, or identifiable information without your explicit written consent (email confirmation is sufficient)

### Optional (Appreciated, Not Required)

These are entirely voluntary. Declining any of these has no impact on your participation or the support you receive.

- Testimonial quote for marketing (you review and approve exact wording before publication)
- Case study co-authored with you (you review and approve all content before publication)
- Public recommendation: LinkedIn post, Fabric Community forum endorsement, or conference mention
- Logo usage on the Observability Workbench website as a "Design Partner"
- Referral to other teams or organizations that might benefit

For any of the optional items: we will send a specific request with proposed content, you approve or decline, and we only proceed with explicit written approval.

---

## Confidentiality

### What We Keep Confidential

- Your organization's Fabric environment details (workspace names, item names, capacity SKUs, error messages, job volumes)
- Feedback session content and recordings
- Any proprietary information you share during the partnership
- Bug reports that contain environment-specific details

### What Is Not Confidential

- The fact that a design partner program exists (we may publicly reference "we are working with 10 design partner organizations" without naming you, unless you opt in to public recognition)
- General product features and capabilities
- Aggregated, anonymized statistics (as described in the Metrics and Attribution section above)
- The open-source codebase (MIT licensed, publicly available)

### Your Confidentiality

- We may share product roadmap items, unreleased features, and strategic plans during feedback sessions
- We ask that you treat these as confidential and do not share them publicly until we announce them
- This is a courtesy request, not a legal NDA. If your organization requires a formal NDA, we are happy to execute one separately.

---

## Data and Security

### What the Tool Accesses

- Fabric REST APIs (monitoring hub data, job instances, workspace inventory) using a service principal with Contributor-level access to monitored workspaces
- The tool reads monitoring metadata only. It does not access your actual data (lakehouse files, warehouse tables, semantic model data, report content).

### Where Data Is Stored

- All monitoring data is stored in your Fabric tenant: your Eventhouse and your Lakehouse, in your Azure region
- No data is transmitted to our infrastructure or any third-party service
- You retain full ownership and control of all data collected by the tool

### What Happens to Data After the Program

- Data stored in your Eventhouse and Lakehouse is yours. It remains in your environment regardless of whether you continue using the tool.
- If you choose to stop using the tool, you can delete the ObservabilityWorkbench workspace and all associated data at your discretion.
- We do not retain copies of your monitoring data.

---

## Intellectual Property

- The Observability Workbench codebase is MIT licensed. Your use of the software is governed by that license.
- Feature ideas and feedback you provide during the program may be incorporated into the product. By participating, you agree that feedback provided becomes input to the product roadmap without IP encumbrance.
- If you build custom extensions, KQL queries, or integrations on top of the tool, those are yours.

---

## Limitation of Liability

This is a free program for early-stage software. The tool is provided "as is" without warranty. We are not liable for:

- Downtime or data loss in the Observability Workbench components
- Capacity consumption costs incurred by the tool's notebooks running on your Fabric capacity
- Any indirect impact on your Fabric environment (though the tool is designed to be read-only and non-destructive)

If something goes wrong, our commitment is to be transparent about the cause and fix it as fast as we can.

---

## How to End the Partnership Early

Either party can end the partnership at any time. The process:

1. Send an email to the other party stating the intent to end the partnership
2. We will schedule a brief (15-minute) exit conversation to understand what led to the decision -- this is for our learning, not to convince you to stay
3. Your Professional-tier access continues for 7 days after the notice to allow for transition
4. After 7 days, your access reverts to the Free tier (or you can delete the workspace entirely)

No penalty, no hard feelings, no awkward follow-up emails. If the product is not useful to you, we would rather know that early than have you silently disengage.

---

## Signatures

This agreement is effective when both parties confirm via email. A reply email from each party stating "I agree to the terms in the Design Partner Agreement dated [Date]" is sufficient. No physical signatures required.

**Product Team**

Name: _________________________
Title: _________________________
Email: _________________________
Date: _________________________

**Design Partner**

Name: _________________________
Title: _________________________
Organization: _________________________
Email: _________________________
Date: _________________________

---

*This agreement is intended to be practical and founder-friendly. If any clause does not work for your organization, tell us and we will adjust. The goal is a productive partnership, not a legal exercise.*
