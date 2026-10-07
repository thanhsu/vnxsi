# VNX.SI — Global Marketplace, Pulse, Build Kits, SEO & Affiliate Execution Plan

**Version:** 1.2
**Date:** 2026-10-07
**Status:** Product direction approved; this roadmap is updated for staged preparation. Per-feature specs, ADRs where needed, task handoffs, and explicit implementation gates are still required; this document grants no blanket implementation authorization.
**Primary objective:** Turn VNX.SI from an early marketplace landing page into a global discovery, build, hire and monetization platform for AI-built software.

**Authority and sequencing:** This is a directional product roadmap. Accepted ADRs, approved specs, the product charter/blueprint, and explicit Owner decisions take precedence over it. If an aspirational route, data shape, or marketing idea below conflicts with an accepted artifact, the accepted artifact wins; examples here do not authorize a route or schema. Before code, each feature needs its own reviewed spec, ADR when required, handoff, and implementation gate. The Open Templates companion spec is [here](superpowers/specs/2026-10-07-vnxsi-open-templates-design.md).

---

# 1. Executive direction

VNX.SI should not behave like a simple directory and should not depend on an empty marketplace.

The product should become a connected ecosystem with four primary user journeys:

1. **Discover** working software.
2. **Buy / Customize** an existing product.
3. **Build** something using guided Build Kits.
4. **Hire** the builder who can implement or adapt it.
5. **Use** a practical AI template for a recurring task, then continue to a Build Kit, product, or builder when the work becomes repeatable software.

The global positioning should be:

> # Don't build from zero.
> Find software that already works. Buy it, customize it, or hire the person who built it.

The core marketplace object is:

> **Working software + evidence + builder + customization path**

AI is the supply-side acceleration mechanism, not the buyer's primary reason to use VNX.SI.

---

# 2. Product architecture

VNX.SI should be organized around three core product surfaces and one acquisition/distribution layer:

```text
                        VNX.SI

       ┌──────────────────┼───────────────────┐
       │                  │                   │
       ▼                  ▼                   ▼

  MARKETPLACE          VNX PULSE          BUILD KITS

 Discover software    Discover trends    Build your own
 Find builders        Models/tools       Prompts/stacks
 Buy/customize        Topics/rankings    Deploy guides
 Hire builders        AI ecosystem       Affiliate stack

       └──────────────────┼───────────────────┘
                          ▼

                       REQUESTS

             Post what you need
             Match to existing product
             Match to builder
```

Marketplace answers:

> "What already exists?"

Pulse answers:

> "What is hot right now?"

Build Kits answer:

> "How do I build this?"

Requests answer:

> "Can somebody solve this for me?"

Open Templates answers:

> "How can I do this recurring task with AI, and what should I do when a template is not enough?"

Open Templates is a content and distribution layer, not a new marketplace object. A template is a task-level starting point that a visitor can discover, read, copy, or download without an account. A Build Kit is a product-level blueprint for building software; the marketplace is for working products and builders; Pulse is for current, evidence-backed AI topics. Templates may connect those surfaces, but they do not enter product ranking or replace marketplace supply work.

---

# 3. Homepage redesign

The current homepage has large unused desktop side areas and a buyer/seller hierarchy that is too builder-heavy.

The recommended desktop layout is a three-column experience.

```text
┌──────────────────┬────────────────────────────────────┬──────────────────┐
│ LEFT RAIL        │ MAIN                               │ RIGHT RAIL       │
│                  │                                    │                  │
│ VNX Pulse        │ Marketplace discovery              │ Build something  │
│ Trending AI      │ Search                             │ Build Kits       │
│ VNX Picks        │ Products                           │ Stack recs       │
│ Open requests    │ Categories                         │ Partner offers   │
│ Recent verified │ Verification                       │ Affiliate tools  │
│ Newsletter       │ Builders                           │                  │
└──────────────────┴────────────────────────────────────┴──────────────────┘
```

## 3.1 Main hero

Replace:

> Have an idea? Find a product, customize one, or build your own.

With:

> # DON'T BUILD FROM ZERO.
> Find software that already solves your problem.

Supporting copy:

> Buy it. Customize it. Or hire the person who built it.

Primary CTA:

**Explore products**

Secondary CTA:

**Post what you need**

Tertiary CTA:

**List what you built**

## 3.2 Search

Hero search should accept buyer-language queries:

- WhatsApp booking system for my salon
- AI support for Shopify
- Invoice parser into Excel
- Internal knowledge base
- AI receptionist for a clinic
- Website for my restaurant

Search should route to:
- existing products,
- Build Kits,
- builders,
- open requests,
- relevant Pulse topics.

---

# 4. Left rail — VNX Pulse

The left rail should become a recurring information product rather than unused whitespace.

Title:

> **VNX PULSE**

Purpose:
- create daily/weekly reason to return,
- create SEO landing pages,
- build authority,
- create high-intent affiliate opportunities,
- expose marketplace products through trending topics.

Recommended blocks:

## AI Models — Trending this week

Example:

```text
AI MODELS — THIS WEEK

1  Claude ...            ↑3
2  GPT ...               →
3  Gemini ...            ↑2
4  Grok ...              ↑1
5  DeepSeek ...          ↓2

View ranking →
```

## AI Coding — Trending

```text
1  Claude Code
2  Codex
3  Cursor
4  Gemini CLI
5  Windsurf
6  Replit
7  Lovable
```

## Trending topics

```text
🔥 MCP
🔥 Coding agents
↑  Computer use
↑  Local models
↑  Vibe coding
→  RAG
```

## VNX Picks

Editorial curation:

```text
VNX PICKS

AI Receptionist
Invoice Parser
GitHub Agent
WhatsApp CRM
```

## Open requests

```text
$800
Salon booking system

$2k
Legal document search
```

---

# 5. VNX Pulse product

Create:

`/pulse`

Positioning:

> **What's happening in AI right now?**

Sections:

- Models
- AI Coding
- Agents
- MCP
- Open Source
- Developer Tools
- AI Products
- Research
- Trending Topics

## 5.1 Ranking methodology

Never present rankings as an unexplained truth.

Use a branded metric:

> **VNX Momentum Score**

Potential inputs:

```text
Search interest             25%
Developer discussion        20%
GitHub activity             20%
Product launches            15%
News/social velocity        10%
VNX engagement              10%
```

Exact weights may be adjusted later.

Always show:

**How ranking works**

Important:

- sponsored revenue must not change organic rank,
- affiliate relationships must not change organic rank,
- raw score should be auditable internally,
- only use data the team has rights to collect/use.

Use wording:

> #1 VNX Trending — AI Models this week

Do not claim:

> #1 AI model in the world

unless the data actually supports such a claim.

---

# 6. Pulse entity pages

Do not send users directly from a ranking to an affiliate URL.

Every model/tool should have a first-party VNX page.

Examples:

```text
/pulse/models/claude
/pulse/models/gpt
/pulse/models/gemini

/coding/codex
/coding/claude-code
/coding/cursor

/topics/mcp
/topics/ai-agents
```

Example page:

```text
Claude

#1 VNX Trending this week
↑ 3 positions

WHY IT'S TRENDING
- New release
- Developer discussion increased
- New integrations
- Strong coding usage

BEST FOR
Coding
Writing
Long context
Agents

COMPARE
Claude vs GPT
Claude vs Gemini

BUILD WITH CLAUDE
AI Support Agent
Research Agent
Internal Search

PRODUCTS BUILT WITH CLAUDE
[Marketplace listings]

TRY CLAUDE
Official website →
Affiliate disclosure where applicable
```

This structure provides:
- SEO value,
- contextual affiliate conversion,
- marketplace discovery,
- Build Kit discovery,
- authority.

---

# 7. Right rail — Build & Monetization

The right rail should not be traditional banner advertising.

It should focus on high-intent contextual actions.

Example:

```text
BUILD SOMETHING

🛒 Online Store
🌐 Business Website
🤖 AI Agent
📊 Admin Dashboard
💬 Support Bot
📅 Booking System
💰 SaaS
📱 Mobile App

Browse Build Kits →
```

Below:

```text
RECOMMENDED FOR THIS BUILD

Hosting
Cloudflare / Vercel

Database
Supabase

Domain
Cloudflare Registrar / Hostinger

AI model
OpenAI / Anthropic / Google

Affiliate disclosure
```

Rule:

Every monetized placement should belong to one of:

1. **Discover**
2. **Build**
3. **Monetize**

Avoid unrelated random ads.

---

# 8. VNX Build Kits

Create:

`/build`

This should become a major acquisition and affiliate engine.

A Build Kit is not a blog article.

It is an interactive project blueprint.

Examples:

```text
/build/online-store
/build/saas
/build/ai-agent
/build/booking-system
/build/customer-support
/build/business-website
/build/mobile-app
/build/admin-dashboard
/build/internal-tool
```

Each Build Kit should answer:

1. What are you building?
2. What requirements matter?
3. What stack should you use?
4. Which AI model/tool fits?
5. What master prompt should you give the coding agent?
6. How do you deploy?
7. Where should you buy a domain?
8. Where should you host it?
9. Which database/auth/payment providers fit?
10. Can VNX match you to a builder instead?

---

# 8A. Open Templates — practical AI template library

Open Templates is an approved acquisition and repeat-use pilot that sits beside the marketplace and Build Kits. Its companion design is [VNX.SI Open Templates — Design Spec](superpowers/specs/2026-10-07-vnxsi-open-templates-design.md). Product direction and preparation of the full plan are authorized; product implementation is not. Every phase below still needs the accepted spec, any required ADR, a task handoff, and an implementation gate.

## Product job and audience

The primary audience is everyday professionals, SME operators, and freelancers. Developers and builders are a smaller secondary audience. Phase A targets 20–30 curated entries with an approximate 80/20 split: everyday/professional/SME workflows first, developer workflows second.

The intended journey is:

1. Discover a task-specific template through the site, search, distribution, or a later AI client connection.
2. Read the purpose, inputs, illustrative example, limitations, and human check.
3. Copy the template or download the portable pack without an account.
4. Use it in the visitor’s own AI product; VNX.SI does not run inference for each retrieval.
5. Return for a recurring task, or continue to a relevant marketplace product, builder, request, or Build Kit.

The boundaries are deliberate:

- Templates describe a task; Build Kits describe how to build a product; marketplace pages describe working software and builders; Pulse describes current, evidence-backed topics.
- A template CTA may link internally to `/products`, `/builders`, `/p/:slug`, `/b/:handle`, or `/request` where those are the accepted canonical routes. An aspirational `/build` or legacy route in this plan is not implementation authority until its own spec establishes it.
- Template content is English-first. The UI uses the existing four-locale contract: `/templates`, `/vi/templates`, `/zh-hans/templates`, and `/zh-hant/templates`; localized UI labels must use `t()`, while the body is labelled English content until translations pass a separate quality gate.
- High-stakes decisions, secrets, private data, autonomous external actions, impersonation, and prompts that fetch arbitrary URLs are outside the pilot.

## Phase A — web pilot and open-source release

Phase A is a lean web distribution pilot. It is dependent on the marketplace/M7 foundations and does not displace marketplace supply, product verification, or request liquidity work.

Required preparation and deliverables:

- Approve the companion spec and accept the architecture decisions for the Git catalogue exception to D1, the ADR-007 treatment of external links, the four-locale route/content boundary, and the privacy measurement boundary.
- Curate 20–30 entries with one clear task, named inputs, an illustrative example, limitations, and a human output-check rubric. Every published entry needs one recorded real model/tool trial with normal and missing/ambiguous-input cases; a full cross-model evaluation is not required.
- Serve account-free browse, search, copy, and download on `/templates` with a generated portable Markdown pack. At most two tool-specific adapters may ship, only after actual client/version verification.
- Keep one Git-versioned structured Markdown source for pages, search, packs, adapters, and later MCP output. The proposed MVP exception to the D1 sole-source rule is read-only and must be recorded before code.
- **Open the public content repository before the Phase A public prelaunch.** Creating that external repository is a separate authorized execution task; this documentation work does not create it. If the repository is not open, the work may remain internal preparation but must not be marketed as an open-source public library.
- Select one authoritative repository and publish a pinned release. The Worker consumes the pinned snapshot at build time and never fetches the public repository at request time. No two editable sources are permitted.
- Resolve the content licence before public launch. CC BY 4.0 is the recommendation for template text, pending Owner acceptance; code/tooling licence decisions remain separate. Include attribution in entries and packs.
- Keep marketplace links contextual and neutral. Paid organic ranking is prohibited. External repository, licence, tool, or partner links use `/go/` or an explicitly accepted ADR-007 editorial-link exception; monetized links carry disclosure.

Phase A launch gates and signals:

- All published entries pass the quality and rights gate; examples remain illustrative and no compatibility or output evidence is fabricated.
- The source revision reproduces the web pages, index, pack, and metadata. UI strings have four-locale parity and English content is visible as such.
- Privacy review confirms no raw search queries, PII, secrets, third-party tracker, or account-bound session is introduced. The existing M7 consent/GPC/go-live boundary is respected.
- Editorial maintenance is budgeted at approximately 2–4 hours per week; freeze additions or remove stale entries if the budget is exceeded.
- Suggested pilot signals are hypotheses, not forecasts: 100 successful copy/download activation events, copy and pack rates with stated denominators, and qualified internal marketplace referrals. The current daily-rotating visitor hash cannot prove person-level 30-day retention; do not use it for that claim. A voluntary panel or separately approved persistent measurement is required for a later retention cohort.

## Phase B — bounded read-only MCP

Start Phase B only after Phase A shows useful web/pack behavior and the protocol/client review is complete. Expose a stateless Streamable HTTP endpoint at a non-localized `/mcp` boundary with only bounded read-only `search_templates` and `get_template` tools. Do not require VNX cookies, sessions, Turnstile, or browser challenges. Validate Origin in a protocol-aware boundary rather than weakening the site-wide origin check.

MCP returns curated published content and metadata only. It does not execute prompts, call a model, follow arbitrary URLs, read private repository content, or promise support for every AI harness. Advertise only named client/runtime versions that have been tested. Query length, result count, response bytes, and rate are bounded; raw queries are not retained.

## Phase C — evidence-driven expansion

Expand only when Phase A and/or B shows repeat utility and the editorial budget remains viable. Candidate work includes reviewed community proposals, more templates, verified adapters, and human-reviewed translations. Translation is not automatic and should start only for a locale with evidence of useful demand and an owner for native review. Semantic search, personalization, accounts, ratings, hosted execution, and broad tool-pack support remain separate decisions.

Open Templates is a distribution layer for the marketplace and Build Kits, not a paid listing channel. Its success is judged by useful task completion and qualified next actions, while organic product/builder ranking remains independent of templates, partner revenue, and sponsored placement.

# 9. Build Kit example — Online Store

URL:

`/build/online-store`

## Step 1 — Requirements wizard

What are you selling?

```text
What are you selling?

○ Physical products
○ Digital products
○ Services
○ Subscription
```

Then:

```text
Expected scale?

○ Small: <100 products
○ Medium
○ Large
```

Then:

```text
Required features

□ Checkout
□ Inventory
□ Coupon
□ Customer account
□ Order tracking
□ Email notifications
□ Product search
□ Reviews
□ Multi-language
□ AI support
□ AI product descriptions
```

Then:

```text
How technical are you?

○ I want AI to build everything
○ I can edit code
○ I have a developer
○ I want to hire someone
```

## Step 2 — Build recommendation

Example:

```text
YOUR BUILD PLAN

Frontend
Next.js

Commerce
Shopify Headless
or
Medusa for open-source control

Database
PostgreSQL / Supabase

Authentication
Clerk / Supabase Auth

Payments
Stripe where available

Hosting
Cloudflare / Vercel

Email
Resend

Analytics
VNX internal aggregate events; any external provider requires a later accepted ADR and privacy review

AI coding
Codex / Claude Code

AI API if needed
OpenAI / Anthropic / Gemini
```

Each recommendation must include:

- why it is recommended,
- ideal user type,
- trade-offs,
- alternative,
- free/paid,
- partner/affiliate label if relevant.

## Step 3 — Master prompt

Provide:

**Copy full prompt**

The prompt should include:

```text
Role
Project goal
User stories
Pages
Features
Data model
Auth
Payments
Admin
SEO
Security
Accessibility
Responsive requirements
Analytics
Environment variables
Testing
Deployment
Definition of done
```

## Step 4 — Deployment guide

Example:

```text
1. Create GitHub repository.
2. Generate the app using Codex/Claude Code.
3. Create Supabase project.
4. Set environment variables.
5. Deploy to Cloudflare or Vercel.
6. Configure domain.
7. Configure DNS.
8. Enable HTTPS.
9. Configure analytics.
10. Test checkout.
11. Set up monitoring.
```

## Step 5 — Conversion choices

Always show:

```text
[Copy Build Prompt]

[Build with AI]

[Find a similar product]

[Hire a builder]
```

This connects Build Kits back to the marketplace.

## Open Templates relationship

Open Templates can provide a task prompt used inside a Build Kit, but it does not replace the Build Kit’s requirements, stack, deployment, or hiring decisions. A template page should link to a Build Kit only after that Build Kit has its own reviewed route and content contract.

---

# 10. Build Kit funnel

```text
Google / Pulse / Homepage

        ↓

"Build an online store"

        ↓

Build Kit

        ↓

Wizard

        ↓

Personalized Build Plan

        ↓
┌─────────────┬─────────────┬──────────────┐
│             │             │              │
▼             ▼             ▼              ▼

Affiliate     Marketplace   Builder        AI tool
stack         products      lead           referral
```

Build Kits should be one of VNX's highest-intent monetization surfaces.

---

# 11. Build Kit SEO

Create useful pages such as:

```text
/build/online-store
/build/ai-agent
/build/booking-system
/build/customer-support
/build/saas

/guides/buy-domain
/guides/deploy-nextjs
/guides/deploy-cloudflare
/guides/choose-ai-model

/compare/codex-vs-claude-code
/compare/vercel-vs-cloudflare
/compare/openai-vs-anthropic
```

Do not create thin template spam.

Every page must include actual decision support.

---

# 12. Affiliate architecture

Do not embed partner URLs directly across hundreds of pages.

Create a redirect service.

Examples:

```text
/go/cloudflare
/go/vercel
/go/supabase
/go/hostinger
/go/shopify
/go/cursor
```

Request:

```text
GET /go/:partner
```

Backend:

```text
1. Validate partner
2. Record source page
3. Record placement
4. Record campaign
5. Record timestamp
6. 302 redirect to destination
```

Example tracking data:

```text
partner: hostinger
source_page: /build/online-store
placement: domain_provider
campaign: build-kit-v1
language: en
```

Advantages:
- change affiliate URL without editing content,
- track CTR,
- compare placements,
- measure partner performance,
- localize destinations,
- rotate offers,
- disable expired programs.

---

# 13. Affiliate disclosure policy

VNX's trust model requires transparency.

For affiliate recommendations display:

> **Affiliate**
> VNX.SI may earn a commission if you purchase through this link, at no extra cost to you.

For sponsored placement:

> **Sponsored**

Organic rank must remain independent.

Never label paid placement as:
- Recommended #1
- Best
- Trending

unless it also earns that position based on transparent organic criteria.

---

# 14. Partner data model

Create:

```text
Partner
- id
- slug
- name
- category
- website
- affiliate_url
- direct_url
- disclosure_required
- supported_regions[]
- status
- priority
```

Placement:

```text
PartnerPlacement
- partner_id
- page_type
- context
- placement
- locale
- active
```

Click:

```text
PartnerClick
- partner_id
- source_page
- placement
- campaign
- locale
- visitor_hash (optional daily rotation; never an account session)
- created_at
```

Optional conversion imports later:

```text
PartnerConversion
- partner_id
- click_id
- amount
- commission
- currency
- converted_at
```

---

# 15. Marketplace product strategy

The marketplace must be populated before major marketing.

Use four origin states:

```text
BUILDER_SUBMITTED
COMMUNITY_SUBMITTED
VNX_CURATED
VNX_LABS
```

Every listing must publicly show its source/origin status.

## VNX Labs

Allowed:
- real working demos,
- concept apps,
- internal experiments.

Label:

> **VNX LABS · Concept demo**

Do not claim fake:
- customers,
- sales,
- users,
- production status.

## Curated external

Label:

> **CURATED BY VNX**
> Builder not yet claimed

Provide:
- source link,
- claim listing CTA.

## Builder submitted

Label:

> **BUILDER LISTING**

Verification status separately displayed.

---

# 16. Marketplace trust

Keep current trust direction.

Verification levels:

## Listed
Listing details and destination links reviewed.

## Demo verified
VNX opened and tested a specified demo workflow.

## In production
VNX reviewed evidence of actual real-world usage.

Display:

```text
DEMO VERIFIED
Checked 4 Oct 2026

What VNX checked →
```

Do not expose confidential customer data.

---

# 17. Homepage data density

The homepage should no longer have large blank zones on desktop.

Recommended left/right rail widths:

- main: ~58–64%
- left: ~17–20%
- right: ~17–20%

Exact responsive breakpoint can vary.

Large screens:
three columns.

Laptop:
narrower rails.

Tablet:
rails collapse into horizontal sections.

Mobile:
all modules become inline cards.

---

# 18. Mobile content order

Recommended mobile order:

1. Hero
2. Search
3. Trending products
4. Build something
5. VNX Pulse
6. Categories
7. Open requests
8. Verification
9. Builders
10. Recommended providers
11. Newsletter

Do not try to preserve sidebars on mobile.

---

# 19. Product detail right rail

On product pages:

```text
BUILD SOMETHING SIMILAR

AI Receptionist Build Kit

Stack:
Next.js
Supabase
Twilio
Claude

[Open Build Kit]

──────────────

NEED CUSTOMIZATION?

3 relevant builders

[Find builder]

──────────────

RECOMMENDED STACK

Hosting
Database
AI API

Affiliate disclosure
```

This gives every product page multiple monetization and conversion paths.

---

# 20. Product detail left rail

Use for navigation rather than advertising:

```text
ON THIS PAGE

Overview
Demo
Pricing
Features
Builder
Verification
Alternatives
```

Also:

```text
Related
AI Agents
Customer Support
Built with Claude
```

---

# 21. Product card requirements

Every important marketplace card must be visual.

Required:

- screenshot/video preview,
- title,
- one-line buyer outcome,
- origin status,
- verification,
- price/delivery if available,
- builder,
- demo/details CTA.

Avoid generic illustrative artwork as primary proof.

---

# 22. Requests

Create:

`/requests`

Example:

```text
$500–$1,000

WhatsApp booking for dental clinic

Malaysia

Need:
WhatsApp
Calendar
Reminders

[View request]
```

Request flow should allow builder to:

- attach an existing product,
- propose customization,
- submit new-build proposal.

This is a crucial liquidity mechanism.

---

# 23. SEO architecture

The paths in this directional section are candidates, not route authorization. Accepted route specs and the current application win. In particular, use `/p/:slug`, `/b/:handle`, and `/request` where those are the established marketplace routes; do not implement aspirational `/products/{slug}`, `/builders/{handle}`, or `/requests` aliases without an approved route decision.

Indexable surfaces:

```text
/products/
/products/{slug}

/builders/
/builders/{handle}

/requests/
/requests/{slug}

/categories/{category}

/use-cases/{use-case}

/built-with/{tool}

/pulse/
/pulse/models/{model}
/coding/{tool}
/topics/{topic}

/build/
/build/{project-type}

/guides/{guide}

/compare/{comparison}
```

This creates multiple acquisition loops while keeping content connected to actual utility.

---

# 24. Structured data

Homepage:
- Organization
- WebSite

Product:
- SoftwareApplication where appropriate
- Product
- Offer
- BreadcrumbList

Builder:
- ProfilePage
- Person / Organization

Build Kit:
- Article / HowTo only when it truthfully matches visible content.

Never emit fake:
- Review
- AggregateRating

---

# 25. International SEO

Use the accepted ADR-003 prefixes `/`, `/vi/`, `/zh-hans/`, and `/zh-hant/`. The `/zh-cn/` and `/zh-tw/` examples below are legacy aspirations and require an explicit route decision before use.

Use explicit locale routes:

```text
/
 /vi/
 /zh-cn/
 /zh-tw/
```

Requirements:
- canonical,
- reciprocal hreflang,
- localized title/meta,
- translated taxonomy,
- quality review of commercial copy,
- avoid automatic low-quality mass translation.

---

# 26. VNX Picks vs Trending

At low traffic, do not fabricate a trending ranking.

Use:

> **VNX PICKS**

This is editorial.

Once enough first-party engagement exists, introduce:

- Trending this week
- Most viewed
- Most demoed
- Most saved
- Most contacted

All based on actual events.

---

# 27. Social distribution

Create repeatable content formats.

## Daily/regular

> **What people built with AI today**

Show:
- screenshot,
- builder,
- stack,
- what problem it solves,
- verification level.

## Weekly

> **VNX Picks — Week XX**

## Pulse

> AI models trending this week

## Build

> How to build an AI receptionist in 2026

Each format should link to first-party VNX pages, not directly to affiliate destinations.

---

# 28. Newsletter

Create:

> **What People Built With AI This Week**

Include:

1. 5 products
2. 3 open requests
3. 1 builder
4. VNX Pulse snapshot
5. 1 Build Kit
6. 1 partner recommendation if relevant and clearly disclosed

Newsletter can support both buyer and builder retention.

---

# 29. Analytics events

Marketplace:

```text
homepage_search
product_impression
product_view
demo_click
save_product
share_product
contact_builder
request_customization
post_request
```

Pulse:

```text
pulse_view
ranking_click
topic_click
compare_click
tool_outbound_click
```

Build:

```text
buildkit_view
wizard_start
wizard_complete
prompt_copy
deploy_guide_view
provider_click
hire_builder_from_buildkit
marketplace_click_from_buildkit
```

Open Templates:

```text
templates_index_view
template_view
template_search (count only; no raw query retention)
template_copy
template_pack_download
template_marketplace_click
mcp_template_search (Phase B; aggregate by day and tool)
mcp_template_get (Phase B; aggregate by day and tool)
```

Template events must use the approved privacy boundary and stated denominators. Do not use an account-bound `user_session`, third-party tracker, or a daily rotating hash to claim person-level 30-day retention.

Affiliate:

```text
affiliate_click
partner
placement
source_page
campaign
```

---

# 30. North-star metrics

Primary:

> **Qualified buyer–builder connections per week**

Secondary:

Marketplace:
- product view → demo
- product view → contact
- request → response

Build:
- wizard completion
- prompt copies
- provider CTR
- build kit → builder lead

Open Templates:
- published entries with a completed quality gate
- copy/download activation events with explicit denominators
- pack adoption
- template → marketplace or Build Kit qualified action
- Phase B MCP calls by tool and day

Pulse:
- weekly returning users
- ranking → entity page CTR
- Pulse → marketplace click
- Pulse → affiliate click

SEO:
- indexed useful pages
- non-brand clicks
- commercial-intent traffic
- landing → action rate

Open Templates does not add a person-level 30-day retention target until a privacy-approved persistent cohort or voluntary panel exists. The M7 daily-rotating hash supports daily aggregates only. All numeric pilot targets are hypotheses for decision-making, never market-size or traction claims.

---

# 31. Data seeding rules

Allowed:

- VNX Labs demos
- curated real products
- community submissions
- unclaimed listings
- editorial Pulse rankings based on real data
- example/mock UI clearly marked as example
- reviewed Open Templates with synthetic examples and recorded real trials
- a pinned public Open Templates repository release after its authorized Phase A opening

Never fabricate:

- builder identities
- headshots as real people
- customer logos
- sales
- installs
- reviews
- ratings
- response counts
- traffic
- "in production" evidence
- marketplace transactions
- fake trending numbers
- template compatibility, model output, activation, repeat-use, or community numbers

The principle:

> **Seed inventory, not trust.**

---

# 32. 90-day execution roadmap

## P0 — Days 1–14

### Homepage
- redesign hero
- add left Pulse rail
- add right Build rail
- remove empty-marketplace appearance
- add real seeded product cards

### Marketplace
- product card V2
- product detail V2
- origin-state model
- claim state
- 10+ VNX Labs demos
- 20+ curated external products

### Build
- `/build`
- first 3 Build Kits:
  - Online Store
  - AI Agent
  - Business Website
- prompt generator
- deployment guide

### Affiliate
- `/go/:partner`
- click logging
- disclosure component

### SEO
- metadata
- canonical
- sitemap
- robots
- Search Console
- Bing
- OG
- structured data

### Open Templates — preparation only
- approve the companion spec and the required D1, ADR-007, i18n, and privacy decisions
- define the 20–30 entry inventory, editor, licence decision, and real-trial record
- prepare the authorized public-repository opening task; do not claim a public open-source launch yet
- no Open Templates product code is authorized by this roadmap alone

---

## P1 — Days 15–30

### Pulse
- `/pulse`
- first ranking pages
- models
- coding tools
- trending topics
- methodology page

### Marketplace
- `/requests`
- builder claim flow
- richer builder profile
- verification workflow

### Data
Target directionally:
- ~60–100 useful product pages
- 15–20 claimed builders
- 10 demo-verified
- real requests

Never falsify numbers to hit targets.

### Open Templates — Phase A web pilot
- open the public content repository in a separate authorized execution task before public prelaunch
- publish the pinned source/release model, 20–30 curated entries, account-free pages, copy/download flow, and portable pack
- ship zero to two tool adapters only after actual client/version QA
- measure activation, pack adoption, and qualified internal referrals with explicit denominators
- treat all thresholds as hypotheses; do not claim 30-day retention from M7 daily hashes

---

## P1 — Days 31–60

### SEO
- use-case pages
- built-with pages
- compare pages
- Build Kit SEO
- Pulse entity pages

### Distribution
- X
- LinkedIn
- Indie Hackers
- Product Hunt maker community
- selective Reddit
- builder communities

### Content
- VNX Picks
- newsletter
- What people built with AI
- builder stories
- Pulse weekly ranking

### Open Templates — Phase B only if Phase A is useful
- verify the MCP transport and named client/runtime versions
- expose bounded, read-only `search_templates` and `get_template` through stateless Streamable HTTP
- no cookie/session/Turnstile dependency, prompt execution, arbitrary URL fetching, or all-harness support promise

---

## P2 — Days 61–90

Prepare global launch only when the site has visible liquidity.

### Open Templates — Phase C only if evidence supports expansion
- review community proposals and moderation capacity
- add translations, more adapters, or more templates only where repeat utility and editorial budget justify them
- do not make translation, semantic search, accounts, ratings, or hosted execution automatic roadmap commitments

Launch channels:
- Product Hunt
- Show HN when appropriate
- AI newsletters
- micro-influencers
- builder cross-promotion
- founder-led content
- Vietnam tech community
- English SEA/global
- Traditional Chinese campaigns

Launch positioning:

> # Don't build software from zero.
> Discover software that already works. Buy it, customize it, or hire its builder.

---

# 33. Implementation priority

This list is directional only. Marketplace supply, verification, requests, and the M7 foundations remain the core dependency; adding Open Templates does not displace them. Each item still needs its own accepted spec/ADR/handoff before code.

If engineering starts after those gates:

1. Product origin/claim model.
2. Product card V2.
3. Product detail page.
4. Seed initial products.
5. Homepage three-column redesign.
6. VNX Pulse rail.
7. Build Kit rail.
8. `/build` and first Build Kit.
9. Affiliate redirect service.
10. `/requests`.
11. Builder profiles.
12. SEO foundations.
13. `/pulse`.
14. Ranking methodology.
15. Analytics instrumentation.
16. Outreach and claim flow.
17. Expand SEO surfaces.
18. Global launch.
19. Open Templates Phase A preparation and web pilot, including the authorized public-repository opening before its public prelaunch.
20. Open Templates Phase B MCP only after Phase A evidence and protocol/client QA.
21. Open Templates Phase C community/translations/adapters only after a separate usefulness and capacity decision.

---

# 34. Definition of success

A first-time visitor should understand within 30 seconds:

1. what VNX is,
2. what software is available,
3. what has been verified,
4. how to try/buy/customize,
5. who built it,
6. how to build something similar,
7. where to hire help,
8. what is currently trending in AI,
9. where to find a practical template for a recurring task.

VNX should become:

> **Marketplace in the center**
>
> **Pulse on the left**
>
> **Build ecosystem on the right**
>
> **Open Templates as the practical entry and distribution layer**

This creates four monetization paths without sacrificing user trust:

- software transactions/leads,
- builder leads,
- affiliate stack recommendations,
- future sponsorships clearly separated from rankings.

The key principle remains:

> **Trust is more valuable than any single affiliate commission.**

Open Templates is successful when people can complete a useful task, return for a recurring workflow, or take a qualified next step to a product, builder, request, or Build Kit. Report copy/download activation and referrals with explicit denominators and a stated editorial budget. Suggested thresholds are pilot hypotheses, not forecasts or public market data. The M7 daily-rotating visitor hash cannot establish person-level 30-day retention; that metric waits for a voluntary panel or separately approved persistent cohort measurement.
