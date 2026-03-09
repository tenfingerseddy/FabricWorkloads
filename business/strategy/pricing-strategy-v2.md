# Pricing Strategy v2: Observability Workbench
# Revised for March 2026 Market Conditions

> **Version:** 2.0
> **Date:** March 9, 2026
> **Previous version:** pricing-analysis.md (v1)
> **Status:** Active -- incorporates FabCon 2026 intelligence, CU Waste Score differentiator, and Workload Hub distribution model

---

## Executive Summary

This document revises the Observability Workbench pricing strategy based on three key developments since v1:

1. **CU Waste Score** has emerged as our strongest premium differentiator. The ROI math is simple: if the Waste Score saves a customer even 5% on their Fabric capacity bill, our subscription pays for itself on day one. This changes the pricing conversation from "cost of observability" to "net savings tool."

2. **Fabric Workload Hub distribution** is now a viable near-term channel (Q2 2026 target). Azure Marketplace SaaS billing changes how we collect revenue, adds Microsoft's billing infrastructure, and enables consumption-based models.

3. **March 23 tenant setting change** will auto-enable workspace admins to activate monitoring, driving a wave of users who will immediately hit the 30-day retention wall. This is our demand-generation event.

**Key pricing changes from v1:**
- Renamed tiers: Free / Professional / Enterprise (dropped "Team" and "Business" to simplify)
- Professional tier reduced from $1,499 to $499/mo (per capacity) to capture mid-market aggressively
- Enterprise tier set at $1,499/mo (per capacity) with volume discounts
- CU Waste Score positioned as the ROI anchor across all paid tiers
- Annual billing discount increased from 17% to 20% (effectively 2.4 months free)
- Added Azure Marketplace transact considerations

---

## 1. CU Waste Score as Premium Differentiator

### What It Is

The CU Waste Score is a composite metric that analyzes a customer's Fabric capacity utilization and identifies specific categories of waste:

| Waste Category | Detection Method | Typical Waste Range |
|---|---|---|
| Failed pipeline retries consuming CUs | Retry pattern analysis | 3-8% of CU spend |
| Over-provisioned capacity during off-hours | Utilization pattern analysis | 10-25% of CU spend |
| Redundant semantic model refreshes | Refresh overlap detection | 3-7% of CU spend |
| Inefficient Spark configurations | Resource utilization metrics | 5-12% of CU spend |
| Idle capacity not paused | Activity gap detection | 5-30% of CU spend |
| Unnecessary parallel execution | Concurrency analysis | 2-5% of CU spend |

**Combined waste potential: 15-40% of total Fabric capacity spend.**

### ROI Math by SKU

| Fabric SKU | Monthly Capacity Cost (PAYG) | Conservative Waste (15%) | Our Monthly Price | Net Monthly Savings | ROI Multiple |
|---|---|---|---|---|---|
| F8 | $1,051 | $158 | $0 (Free) | $158 | Infinite |
| F16 | $2,102 | $315 | $499 | -$184 | 0.63x (Free tier better) |
| F32 | $4,205 | $631 | $499 | $132 | 1.26x |
| F64 | $8,410 | $1,262 | $499 | $763 | 2.53x |
| F128 | $16,819 | $2,523 | $1,499 | $1,024 | 1.68x |
| F256 | $33,638 | $5,046 | $1,499 | $3,547 | 3.37x |
| F512 | $67,277 | $10,092 | $2,499 (vol.) | $7,593 | 4.04x |

**Key insight:** At F32 and above, the CU Waste Score alone pays for the Professional subscription. At F128 and above, Enterprise pays for itself. This is the central selling proposition.

### Positioning the CU Waste Score

**For data engineers:** "See exactly which pipelines, notebooks, and refreshes are burning capacity units for no reason. Automated recommendations, not just alerts."

**For IT admins / FinOps:** "The Waste Score shows you how much of your Fabric capacity bill is going to failed retries, idle time, and redundant refreshes. Typical customers recover 15-30% of their capacity spend."

**For procurement:** "This tool has negative net cost. The capacity savings exceed the subscription price. Approving this purchase saves the organization money."

### Free Tier Waste Score Strategy

The free tier shows the **aggregate CU Waste Score** (a single number, e.g., "Your CU Waste Score: 23%") but does not break down individual waste categories or provide specific recommendations. This serves two purposes:

1. It creates an immediate, quantified pain point: "You are wasting 23% of your Fabric spend."
2. It creates a clear upgrade trigger: "Upgrade to Professional to see exactly where that waste is and how to fix it."

---

## 2. Revised Pricing Tiers

### Tier Structure

| | **Free** | **Professional** | **Enterprise** |
|---|---|---|---|
| **Monthly Price** | $0 | $499 / capacity | $1,499 / capacity |
| **Annual Price** | $0 | $4,790 / capacity (save 20%) | $14,390 / capacity (save 20%) |
| **Target Customer** | Individual engineers, small teams (F2-F16) | Production data teams (F32-F128) | Platform teams, multi-capacity orgs (F128+) |
| **Workspaces** | 1 | 5 | Unlimited |
| **Data Retention** | 7 days | 90 days | 365 days |
| **SLO Definitions** | 5 | Unlimited | Unlimited |
| **CU Waste Score** | Aggregate score only | Full breakdown + recommendations | Full breakdown + recommendations + trend analysis |
| **Cross-Item Correlation** | Basic (parent-child only) | Full correlation engine | Full + custom correlation rules |
| **Alerting** | Email only (10/day) | Email, Teams, Slack (unlimited) | All channels + PagerDuty, ServiceNow, webhooks |
| **Anomaly Detection** | Rule-based (3 rules) | Rule-based + ML anomaly detection | Full ML + custom model tuning |
| **Incident Management** | View only | Create, assign, resolve | Full workflow + SLAs + postmortem generation |
| **Search** | Last 7 days | Full-text, 90 days | Full-text, 365 days + regex |
| **Users** | 3 | 10 | Unlimited |
| **API Access** | None | Read-only | Full read/write + bulk export |
| **SSO / SCIM** | No | No | Yes |
| **Audit Logging** | No | No | Yes (+ SIEM integration) |
| **Support** | Community | Email (48hr SLA) | Dedicated CSM + 4hr SLA |
| **SLA** | None | 99.5% | 99.9% |

### Pricing Rationale

**Free tier ($0):**
- Cost to serve: $3-8/user/month (lightweight API polling, minimal storage)
- Purpose: Lead generation and community growth
- Conversion trigger: 7-day retention wall, aggregate Waste Score without breakdown, limited SLOs
- Must be genuinely useful for individual engineers to build word-of-mouth

**Professional tier ($499/mo per capacity):**
- Anchored at roughly 6% of F64 monthly spend ($8,410) or 12% of F32 monthly spend ($4,205)
- The CU Waste Score at F32+ typically saves more than the subscription costs
- This is the high-volume tier; most revenue will come from here
- Per-capacity pricing aligns with how Fabric teams think about costs

**Enterprise tier ($1,499/mo per capacity):**
- Anchored at roughly 9% of F128 monthly spend ($16,819) or 4.5% of F256 spend ($33,638)
- Enterprise features (SSO, audit, SLA, dedicated support) justify the 3x premium
- Volume discounts for multi-capacity deployments (see section below)
- Custom pricing available above 5 capacities

### Volume Discounts (Enterprise Tier)

| Capacities | Per-Capacity Monthly | Effective Discount |
|---|---|---|
| 1 | $1,499 | -- |
| 2-4 | $1,349 | 10% |
| 5-9 | $1,199 | 20% |
| 10-19 | $1,049 | 30% |
| 20+ | Custom | 35%+ |

---

## 3. Free Tier Optimization

### Conversion-Driving Feature Gates

The free tier must accomplish two objectives simultaneously: (a) provide enough value that users adopt and recommend the product, and (b) create enough friction that growing teams naturally hit upgrade triggers.

| Feature | Free Tier Limit | Upgrade Trigger Message | Expected Trigger Rate |
|---|---|---|---|
| Workspaces | 1 | "Monitor all your workspaces. Upgrade to Professional." | High (most teams have 2+ workspaces) |
| Retention | 7 days | "Your data from 8 days ago is gone. Upgrade for 90-day retention." | Very High (recurring trigger) |
| SLO definitions | 5 | "Define unlimited SLOs for your data platform. Upgrade to Professional." | Medium (power users hit this) |
| CU Waste Score | Aggregate only | "See exactly where you're wasting CUs. Upgrade for the full breakdown." | Very High (every admin wants details) |
| Alerting | Email, 10/day | "Never miss a critical alert. Upgrade for Teams/Slack and unlimited alerts." | Medium |
| Anomaly detection | 3 rules | "Let ML catch the anomalies you can't predict. Upgrade for ML-powered detection." | Low-Medium |
| Users | 3 | "Add your full team. Upgrade for 10 users." | Medium |

### Free Tier Features That Stay Free (No Gating)

These features must remain ungated because they drive adoption and word-of-mouth:

- Basic event collection and storage (7-day window)
- Monitoring hub event ingestion
- Workspace item inventory
- Basic correlation (parent-child relationships)
- Single-workspace dashboard
- Aggregate CU Waste Score
- Community forum access

### Expected Conversion Funnel

```
Free signup                                    100%
  |
  v
Active user (used in last 7 days)               60%    (40% drop-off typical for dev tools)
  |
  v
Hit a feature gate (retention, workspaces, etc.) 45%    (75% of actives hit a gate within 30 days)
  |
  v
View pricing page                                25%    (55% of gate-hitters consider upgrading)
  |
  v
Start trial (14-day Professional trial)          12%    (48% of pricing viewers start trial)
  |
  v
Convert to paid                                   8%    (67% trial-to-paid conversion)
```

**Target: 8% free-to-paid conversion rate** (industry benchmark for developer tools: 2-5%; we target higher due to the ROI anchor of CU Waste Score).

---

## 4. Trial-to-Paid Conversion Strategy

### 14-Day Professional Trial

Every free user can activate a 14-day Professional trial (no credit card required). The trial includes:

- All Professional features unlocked
- 5-workspace monitoring
- Full CU Waste Score breakdown with recommendations
- ML anomaly detection
- Unlimited alerting
- 90-day retention (backfills from any data already collected)

### Trial Conversion Tactics

**Day 0 (Activation):**
- Welcome email with 3 quick-start actions (add a workspace, create an SLO, review your Waste Score)
- In-product guided onboarding tour

**Day 3:**
- Email: "Your CU Waste Score breakdown is ready. Here's what we found." (Include summary metrics.)
- In-product: Highlight the top 3 waste categories with estimated savings

**Day 7 (Midpoint):**
- Email: "You've been using Professional for a week. Here's what you'd lose if you downgrade."
- Show specific metrics: "X alerts sent, Y SLOs tracked, $Z in waste identified"
- Offer: "Subscribe now and get your first month at 50% off"

**Day 10:**
- Email: "4 days left on your trial. Here's your full ROI summary."
- Show: Total CU waste identified, incidents caught, SLO breaches prevented
- In-product: Persistent banner with upgrade CTA

**Day 13:**
- Email: "Your trial expires tomorrow. Lock in your savings."
- Final offer: Annual billing at 20% discount
- Urgency: "Your 90-day retention data will be reduced to 7 days after trial ends"

**Day 14 (Expiry):**
- Graceful downgrade to Free (no data loss, but retention window shrinks)
- Email: "You're back on Free. Here's what you're missing." (Monthly digest of features they used during trial)

### Trial Success Metrics

| Metric | Target | Action if Below Target |
|---|---|---|
| Trial activation rate (from free) | 20% | Improve gate messaging, add in-product prompts |
| Trial-to-paid conversion | 67% | Improve trial onboarding, add more value demonstrations |
| Time to first "aha" moment | < 2 hours | Simplify setup, improve auto-discovery |
| Waste Score viewed during trial | 90% | Make Waste Score more prominent in trial experience |

---

## 5. Annual vs. Monthly Pricing

### Annual Billing Incentives

| Tier | Monthly | Annual (per month) | Annual Total | Savings |
|---|---|---|---|---|
| Professional | $499 | $399 | $4,790 | 20% ($1,198/year) |
| Enterprise | $1,499 | $1,199 | $14,390 | 20% ($3,598/year) |

### Why 20% Annual Discount

- **Industry benchmark:** SaaS annual discounts typically range 15-25%
- **Churn reduction:** Annual contracts dramatically reduce monthly churn (industry data: annual churn ~5-8% vs. monthly churn ~3-5% per month = 30-45% annual equivalent)
- **Cash flow:** Upfront annual payments improve cash flow and reduce collection friction
- **Fabric alignment:** Most Fabric capacity purchases are annual reserved instances (40% discount); our customers already think in annual terms

### Annual-First Positioning

On the pricing page, display annual pricing as the default with monthly as the toggle option. This anchors on the lower number and makes annual feel like the "normal" choice.

```
Toggle:  [Annual (save 20%)] | Monthly

Professional
$399/mo               <-- displayed prominently
billed annually at $4,790

$499/mo billed monthly  <-- shown as alternative
```

---

## 6. Revenue Projections

### Assumptions

| Parameter | Conservative | Moderate | Aggressive |
|---|---|---|---|
| Free signups (Month 1-6) | 100/month | 200/month | 400/month |
| Free signups (Month 7-12) | 200/month | 400/month | 800/month |
| Free signups (Month 13-18) | 300/month | 600/month | 1,000/month |
| Free-to-paid conversion | 5% | 8% | 12% |
| Average paid ARPU (monthly) | $550 | $650 | $800 |
| Monthly paid churn | 4% | 3% | 2% |
| Annual billing adoption | 40% | 50% | 60% |
| Enterprise deal rate (% of new paid) | 10% | 15% | 20% |
| Average enterprise deal (annual) | $25,000 | $35,000 | $50,000 |

### 6-Month Projections

| Metric | Conservative | Moderate | Aggressive |
|---|---|---|---|
| Cumulative free users | 600 | 1,200 | 2,400 |
| New paid customers (Month 6) | 30 | 96 | 288 |
| Total paid (with churn) | 24 | 82 | 258 |
| Enterprise deals closed | 2 | 6 | 15 |
| MRR (subscriptions) | $13,200 | $53,300 | $206,400 |
| Enterprise ARR contribution | $50,000 | $210,000 | $750,000 |
| **Total MRR (blended)** | **$17,367** | **$70,800** | **$268,900** |
| **ARR run-rate** | **$208,400** | **$849,600** | **$3,226,800** |

### 12-Month Projections

| Metric | Conservative | Moderate | Aggressive |
|---|---|---|---|
| Cumulative free users | 1,800 | 3,600 | 7,200 |
| Total paid (with churn) | 68 | 245 | 820 |
| Enterprise deals closed (cumulative) | 6 | 18 | 45 |
| MRR (subscriptions) | $37,400 | $159,250 | $656,000 |
| Enterprise ARR contribution | $150,000 | $630,000 | $2,250,000 |
| **Total MRR (blended)** | **$49,900** | **$211,750** | **$843,500** |
| **ARR run-rate** | **$598,800** | **$2,541,000** | **$10,122,000** |

### 18-Month Projections

| Metric | Conservative | Moderate | Aggressive |
|---|---|---|---|
| Cumulative free users | 3,600 | 7,200 | 13,200 |
| Total paid (with churn) | 132 | 502 | 1,680 |
| Enterprise deals closed (cumulative) | 12 | 36 | 80 |
| MRR (subscriptions) | $72,600 | $326,300 | $1,344,000 |
| Enterprise ARR contribution | $300,000 | $1,260,000 | $4,000,000 |
| **Total MRR (blended)** | **$97,600** | **$431,300** | **$1,677,333** |
| **ARR run-rate** | **$1,171,200** | **$5,175,600** | **$20,128,000** |

### Revenue Milestones

| Milestone | Conservative | Moderate | Aggressive |
|---|---|---|---|
| First $50K ARR | Month 5 | Month 3 | Month 2 |
| First $500K ARR | Month 11 | Month 7 | Month 4 |
| First $1M ARR | Month 16 | Month 10 | Month 6 |
| First $5M ARR | Beyond 18mo | Month 16 | Month 10 |

---

## 7. Competitive Comparison Matrix

### Pricing Comparison

| | **Observability Workbench** | **Monte Carlo** | **Atlan** | **Soda** | **Elementary** | **Microsoft Native** |
|---|---|---|---|---|---|---|
| **Entry Price** | $0 (free tier) | ~$80K/year | ~$198K/year | $0 (free tier) | $0 (OSS) | $0 (included) |
| **Mid-Market Price** | $499/mo ($6K/yr) | $120-200K/yr | $198-400K/yr | ~$5-15K/yr | Custom | Purview license |
| **Enterprise Price** | $1,499/mo ($18K/yr) | $200-500K+/yr | $400K+/yr | Custom | Custom | Purview license |
| **Pricing Model** | Per-capacity, flat tiers | Credit-based | Custom enterprise | Per-dataset | Custom | Included/Purview |
| **Free Tier** | Yes (genuinely useful) | No | No | Yes (limited) | Yes (OSS) | Yes (fragmented) |
| **Self-Serve Purchase** | Yes | No | No | Yes | No (cloud) | N/A |
| **Azure Marketplace** | Yes (planned Q2) | Yes (SaaS) | No | No | No | N/A |
| **Price Transparency** | Full (published) | Opaque (credit-based) | Hidden (custom only) | Published | Hidden (cloud) | N/A |

### Value Comparison

| Capability | **Observability Workbench** | **Monte Carlo** | **Atlan** | **Soda** | **Elementary** | **MS Native** |
|---|---|---|---|---|---|---|
| Fabric-native workload | Yes | No | No | No | No | Yes (fragmented) |
| CU Waste Score / cost correlation | Yes (unique) | No | No | No | No | Separate app |
| Cross-item correlation | Yes | Partial | No | No | No (dbt only) | No |
| SLO framework | Yes | Partial | No | Partial | Partial | No |
| Long-term retention | 7-365 days | Varies | N/A | Varies | Varies | 30 days |
| ML anomaly detection | Yes (Pro+) | Yes | Limited | Yes | Yes | No |
| Incident management | Yes | Yes | Limited | Limited | Limited | No |
| Full-text search | Yes | Yes | Yes (catalog) | No | No | Limited |
| Data stays in tenant | Yes | No (SaaS) | No (SaaS) | Partial | Partial | Yes |

### Cost Per Value Unit

For a mid-market team (F64, 8 data engineers, 10 workspaces):

| Tool | Annual Cost | Fabric-Native | CU Cost Savings | Net Annual Cost |
|---|---|---|---|---|
| **Observability Workbench (Pro)** | $5,988 | Yes | ~$10,000-$25,000 | **-$4,012 to -$19,012** (net savings) |
| Monte Carlo | $120,000 | No | $0 | $120,000 |
| Atlan | $198,000 | No | $0 | $198,000 |
| Soda (est. 50 datasets) | $4,800 | No | $0 | $4,800 |
| Elementary Cloud | ~$15,000 (est.) | No (dbt only) | $0 | $15,000 |
| Microsoft Native | $0 | Yes (fragmented) | $0 | $0 (but gaps remain) |

**The only tool that pays for itself through capacity savings.**

---

## 8. Fabric Workload Hub and Azure Marketplace Considerations

### Distribution Through Azure Marketplace

Publishing to the Azure Marketplace / Fabric Workload Hub changes the billing model:

| Aspect | Direct Website | Azure Marketplace |
|---|---|---|
| Billing | Stripe/PayPal | Azure billing (invoice, EA, CSP) |
| Revenue share | 0% | 3% (standard Marketplace fee) |
| Procurement | Requires new vendor approval | Draws from existing Azure commitment (MACC) |
| Discovery | SEO, content marketing, referrals | Marketplace search, Fabric Workload Hub |
| Enterprise buying | Requires procurement process | Can use Azure committed spend |
| Co-sell | Not available | Eligible for Microsoft co-sell motions |

### MACC Burn-Down Advantage

Many enterprise customers have Microsoft Azure Consumption Commitment (MACC) agreements with pre-committed Azure spend. Marketplace purchases count toward MACC burn-down. This means:

- Our subscription becomes "free" from the customer's perspective (already committed spend)
- Procurement friction drops dramatically (no new vendor, no new PO)
- Decision authority shifts from procurement to the technical team
- This is especially powerful for Enterprise tier deals

### Marketplace Pricing Strategy

| Tier | Marketplace Price | Marketplace Billing |
|---|---|---|
| Free | $0 | No charge |
| Professional | $499/mo or $4,790/yr | SaaS subscription (per-capacity) |
| Enterprise | $1,499/mo or $14,390/yr | SaaS subscription (per-capacity) |
| Enterprise (5+ capacities) | Custom | Private offer |

**Private Offers:** For Enterprise deals above 5 capacities, use Azure Marketplace Private Offers to provide custom pricing with volume discounts. Private offers still count toward MACC and co-sell eligibility.

### Workload Hub Listing Strategy

Target listing as the **first observability workload** in the Fabric Workload Hub (currently only 3 workloads published: 2TEST, Informatica, SQL2Fabric-Mirroring). Being first establishes category ownership.

**Listing metadata to optimize:**
- Category: "Monitoring and Diagnostics" or "Observability"
- Keywords: observability, monitoring, SLO, retention, correlation, CU waste, Fabric monitoring
- Screenshots: Dashboard view, Waste Score breakdown, SLO tracking, correlation timeline
- Ratings/reviews: Seed with beta customer reviews before GA

### Revenue Share Impact

Azure Marketplace takes a 3% fee on transacted revenue. Impact on our margins:

| Tier | Monthly Revenue | Marketplace Fee (3%) | Net Revenue |
|---|---|---|---|
| Professional | $499 | $14.97 | $484.03 |
| Enterprise | $1,499 | $44.97 | $1,454.03 |

The 3% fee is easily justified by reduced procurement friction, MACC eligibility, and Microsoft co-sell access.

---

## 9. Pricing Page ROI Calculator Specification

### Calculator Inputs

| Input | Type | Default | Options |
|---|---|---|---|
| Fabric SKU | Dropdown | F64 | F2 through F2048 |
| Number of capacities | Number | 1 | 1-50 |
| Billing model | Toggle | PAYG | PAYG / Reserved |
| Number of data engineers | Number | 5 | 1-100 |
| Average incidents per month | Number | 6 | 1-30 |
| Current monitoring tool spend | Currency | $0 | $0-$500K |

### Calculator Outputs

| Output | Calculation | Display |
|---|---|---|
| Monthly Fabric spend | SKU cost * capacities * billing factor | "$8,410/mo" |
| Estimated CU waste (15-30%) | Fabric spend * waste factor | "$1,262-$2,523/mo" |
| Estimated waste recovery (60%) | CU waste * 0.6 | "$757-$1,514/mo" |
| Engineering time saved | Engineers * 15hrs/mo * $85/hr | "$6,375/mo" |
| Incident cost reduction | Incidents * $337 * 0.7 | "$1,415/mo" |
| **Total monthly value** | Sum of above | "$8,547-$9,304/mo" |
| Our monthly cost | Tier price * capacities | "$499/mo" |
| **Net monthly savings** | Total value - our cost | "$8,048-$8,805/mo" |
| **Annual ROI** | (Annual savings / annual cost) * 100 | "1,612%-1,764% ROI" |

### Calculator Display Logic

The calculator should display a summary card:

```
YOUR ESTIMATED ROI
------------------
Monthly Fabric Spend:        $8,410
Estimated CU Waste:          $1,890  (22.5% -- typical for F64)
Recoverable Waste:           $1,134  (60% recovery rate)
Engineering Time Saved:      $6,375  (15 hrs/mo * 5 engineers * $85/hr)
Incident Cost Reduction:     $1,415  (6 incidents * 70% reduction)

TOTAL MONTHLY VALUE:         $8,924
Observability Workbench:    -$499   (Professional tier)
-------------------------------------
NET MONTHLY SAVINGS:         $8,425

ANNUAL ROI: 1,688%  |  PAYBACK PERIOD: < 1 month
```

---

## 10. Pricing Experiments and Iteration Plan

### Launch Pricing (Q2 2026)

Launch with the three-tier model as defined. All pricing published on website and Marketplace.

### Experiment 1: Starter Tier (Month 3-4)

**Hypothesis:** There is a segment of F8-F16 teams willing to pay $199-$249/month but not $499/month.

**Test:** Offer a "Starter" tier at $249/month to free users who hit workspace or retention gates, via targeted in-product messaging. Measure conversion rate vs. Professional tier.

**Success criteria:** If Starter tier converts 3x more users than Professional at the same gate, keep it. If not, remove it.

### Experiment 2: Usage-Based Pricing Component (Month 6-8)

**Hypothesis:** Adding a usage-based component (per monitored item beyond tier limits) could capture more value from large deployments without requiring Enterprise.

**Test:** Offer Professional tier users the option to add monitored items at $2/item/month beyond the base 150 items.

**Success criteria:** If 20%+ of Professional users adopt overage pricing and average overage exceeds $100/month, formalize it.

### Experiment 3: Annual-Only Enterprise (Month 4-6)

**Hypothesis:** Offering Enterprise only on annual contracts reduces churn and improves deal quality.

**Test:** Remove monthly Enterprise option. All Enterprise deals require annual commitment (with monthly payment option on annual contract).

**Success criteria:** If Enterprise deal volume stays within 80% of monthly option and churn drops below 5% annual, keep annual-only.

---

## 11. Key Metrics to Track

### Pricing Health Metrics

| Metric | Target | Red Flag |
|---|---|---|
| Free-to-paid conversion rate | 8% | Below 3% |
| Trial-to-paid conversion rate | 67% | Below 40% |
| Average Revenue Per Account (ARPA) | $650/mo | Below $450/mo |
| Annual billing adoption | 50%+ | Below 30% |
| Enterprise deal close rate | 25% of qualified | Below 15% |
| Net Revenue Retention (NRR) | 120%+ | Below 100% |
| Monthly paid churn | Below 3% | Above 5% |
| LTV:CAC ratio | 3:1+ | Below 2:1 |
| Time to first paid conversion | 21 days from signup | Above 45 days |

### Pricing Change Triggers

| Signal | Action |
|---|---|
| Free-to-paid conversion below 3% for 2 consecutive months | Reassess feature gates, consider lowering Professional price |
| NRR below 100% for 2 consecutive quarters | Assess churn reasons, consider adding retention features to lower tiers |
| Enterprise deal volume below 1/month after month 6 | Reassess Enterprise pricing, consider lowering floor |
| More than 30% of free users churning in first 14 days | Free tier provides too little value; expand features |
| Professional tier has bimodal usage (many light + many heavy) | Split into Starter and Professional |

---

## 12. Implementation Timeline

| Week | Action |
|---|---|
| Week 1-2 | Finalize pricing page design and copy. Build ROI calculator. |
| Week 3-4 | Implement billing infrastructure (Stripe for direct, prepare Marketplace listing). |
| Week 5-6 | Build in-product upgrade prompts, trial activation flow, and feature gates. |
| Week 7-8 | Soft-launch pricing to beta users. Collect feedback on perceived value. |
| Week 9-10 | Iterate based on feedback. Adjust feature gates if conversion is below target. |
| Week 11-12 | GA pricing launch. Enable self-serve purchase on website. |
| Week 13-16 | Submit Azure Marketplace listing. Prepare Workload Hub submission. |
| Week 17-20 | Marketplace listing live. Begin co-sell motions with Microsoft. |

---

## Appendix A: Fabric Capacity SKU Reference

| SKU | CUs | Monthly PAYG | Monthly Reserved (est.) | Includes Power BI Premium |
|---|---|---|---|---|
| F2 | 2 | $263 | $158 | No |
| F4 | 4 | $526 | $316 | No |
| F8 | 8 | $1,051 | $631 | No |
| F16 | 16 | $2,102 | $1,261 | No |
| F32 | 32 | $4,205 | $2,523 | No |
| F64 | 64 | $8,410 | $5,046 | Yes |
| F128 | 128 | $16,819 | $10,092 | Yes |
| F256 | 256 | $33,638 | $20,183 | Yes |
| F512 | 512 | $67,277 | $40,366 | Yes |
| F1024 | 1024 | $134,554 | $80,732 | Yes |
| F2048 | 2048 | $269,107 | $161,464 | Yes |

## Appendix B: Competitor Pricing Detail

### Monte Carlo
- Credit-based model: Scale ($0.25/credit), Enterprise ($0.45/credit), Enterprise+ ($0.50/credit)
- Typical enterprise contracts: $80K-$300K+/year
- Up to 10 users included in base; additional users extra
- No free tier; no self-serve purchase
- Available on Azure Marketplace as SaaS

### Atlan
- Custom enterprise pricing only
- Typical contracts start ~$198K/year
- No free tier; no self-serve
- Not on Azure Marketplace

### Soda
- Freemium: Free tier for individuals
- Team: $8/dataset/month (scales to $5-15K/year for mid-market)
- Enterprise: Custom
- Soda Core (OSS) remains free

### Elementary
- OSS package: Free (dbt-native)
- Elementary Cloud: Custom pricing (reportedly higher than dbt Cloud)
- No published pricing for cloud tier

### Datafold
- Free: Limited features
- Cloud: Starting $799/month (billed annually)
- Enterprise: Custom

---

*This document should be reviewed and updated quarterly, or whenever a significant market event occurs (competitor pricing change, Microsoft platform update, or internal conversion data reveals pricing issues).*
