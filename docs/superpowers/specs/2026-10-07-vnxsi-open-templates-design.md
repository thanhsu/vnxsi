# VNX.SI Open Templates — Design Spec

- **Date:** 2026-10-07
- **Status:** Product direction and preparation of the full plan authorized by Owner 2026-10-07; product implementation is not authorized. Written-spec approval remains required before implementation planning.
- **Scope:** A small, English-first, open catalogue of practical AI templates on the VNX.SI site, with account-free browsing, copying, and downloading. The catalogue may later expose a read-only MCP endpoint.
- **Does not authorize:** product code, migrations, an external repository, MCP deployment, a public submission system, or a launch. This document is a design contract for a later plan.
- **Related:** [Product Charter](../../blueprint/01-PRODUCT-CHARTER.md), [Architecture](../../architecture/ARCHITECTURE.md), [ADR-003](../../adr/ADR-003-i18n.md), [ADR-006](../../adr/ADR-006-knowledge-packages.md), [ADR-007](../../adr/ADR-007-monetization.md).

## 1. Decision summary

Open Templates is approved as a bounded acquisition and repeat-use pilot. It is a content surface connected to the marketplace, not a second marketplace and not a general prompt dump.

| Decision | MVP contract |
|---|---|
| Audience | Everyday professionals, SME operators, and freelancers first; a smaller developer section. |
| Catalogue | 20–30 curated templates, approximately 80% everyday/professional/SME work and 20% developer work. |
| Language | English template content; localized site interface in EN, VI, Simplified Chinese, and Traditional Chinese. Each page identifies English content. |
| Access | Public GET pages, copy actions, and downloads without an account. No login wall. |
| Source | Versioned, structured Markdown is the single source for pages, search, the portable pack, and any later adapter or MCP response. |
| Delivery | Main-site `/templates` surface on the existing Worker. MVP needs no D1 migration and no runtime dependency on a separate repository. |
| Packs | One portable Markdown pack. At most two tool-specific adapters, and only after actual client/version verification. |
| MCP | Phase B only, after the catalogue demonstrates usefulness: stateless Streamable HTTP with `search_templates` and `get_template`. |
| Monetization | Contextual internal marketplace links may help a user continue to `/products`, `/builders`, or `/request`. No paid ranking. External or monetized links follow ADR-007. |

The differentiator is practical, reviewable work with inputs, examples, limitations, and evidence of what was tested. “Works with every model” and “compatible with all AI harnesses” are not product claims.

## 2. Product fit and intended outcome

VNX.SI’s charter connects people who need software with products and builders. Templates give a visitor a useful first action before they have a software brief: copy a tested starting point, understand the task, and decide whether a repeatable tool or builder would help. A template remains useful even when no marketplace action follows.

The acquisition hypothesis is that task-specific pages can attract people with recurring work. The repeat-use hypothesis is that a person returns for a known workflow or retrieves the same catalogue through an AI client. The marketplace hypothesis is separate: useful templates may create qualified visits to a product, builder, or request flow. The pilot must measure these hypotheses separately.

The library will prefer concrete jobs such as turning rough meeting notes into a client follow-up, comparing supplier quotes, preparing a clear software brief, or checking a draft for missing requirements. Generic role-play prompts, unsupported model claims, and large collections of near-duplicates do not meet the bar.

The developer section supports builders and technical visitors without changing the primary audience. It may cover issue briefs, debugging investigation, test planning, documentation, and code-review preparation. It does not turn the MVP into a developer-tool directory.

High-stakes medical, legal, financial, employment, safety, or identity decisions; autonomous external actions; secret handling; impersonation; and templates that instruct a model to fetch arbitrary URLs are outside the MVP. A later, qualified review may define a narrow exception for drafting or summarization with explicit human verification.

## 3. MVP catalogue

### 3.1 Content mix

The initial inventory is a target range, not a requirement to publish filler.

| Segment | Approximate share | Example areas |
|---|---:|---|
| Everyday professional | 30% | Notes to actions, email clarity, agendas, summaries, decision records. |
| SME and freelancer operations | 30% | Quote comparison, client intake, service brief, process checklist, customer replies. |
| Research and content work | 20% | Structured comparison, outline, audience adaptation, source-checking checklist. |
| Developer workflows | 20% | Issue brief, debugging plan, test plan, code-review context, technical handoff. |

Every template has one primary task and an explicit intended user. A template may have tags for several workflows, but tags do not replace a clear purpose.

### 3.2 Required template content

Each published entry contains:

- a stable `template_key` and slug; no VNX task or issue number is assigned;
- title, one-sentence purpose, intended user, category, tags, difficulty, and content language;
- the copyable template with named input tokens and input instructions;
- a synthetic or rights-cleared example input and output, clearly labelled as illustrative;
- a short “check the result” section and known limitations;
- version, last-reviewed date, licence identifier, source revision, and publication status;
- tool/model information only when a real verification run has been recorded.

Examples in a draft are illustrative. They must not be described as observed output or test evidence until the actual QA checklist has been completed. Empty verification fields mean “not verified,” not “verified by default.”

### 3.3 Content lifecycle

`draft` entries are private to the review process. `reviewed` entries have passed schema, safety, rights, editorial, and real-trial checks. `published` entries may appear on the site, in the portable pack, and in MCP responses. A material change to the template, examples, output contract, or supported adapter creates a new content version and returns the entry to review.

Contributions may be accepted as proposals, but nothing is published automatically. The MVP has editorial approval and a removal path for copied, unsafe, private, or misleading content.

An unverified draft may remain in the review queue, but it cannot become a published, quality-checked entry until it meets the real-trial requirement in §6.

## 4. User experience and routes

### 4.1 Public surface

The canonical English page is `/templates`. The existing locale convention applies to the UI: `/templates`, `/vi/templates`, `/zh-hans/templates`, and `/zh-hant/templates`, with corresponding detail paths. The template body remains English in the MVP and displays a localized “English content” label.

| Method and path | Purpose | Access and indexing |
|---|---|---|
| `GET /templates` | Browse and search published entries. | Public; indexable when the catalogue page has useful content. |
| `GET /templates/:slug` | Read one published entry, copy it, and see usage guidance. | Public; indexable when the entry passes the publication gate. |
| `GET /templates/packs/portable.md` | Download the generated portable pack. | Public; attachment/noindex; generated from the same source. |
| `GET /templates/:slug.md` | Optional individual Markdown download if retained by the implementation plan. | Public; attachment/noindex; same source as the page. |

Search is keyword/tag search over the generated index. Query length, result count, and response size are bounded. Search does not execute template text or call an AI provider. A copy action returns the same reviewed text rendered for copying; it does not mutate an account or require a session.

The interface uses `t()` for every UI string and adds keys to all four locale files. Template content is not machine-translated in the MVP. Localized pages use the existing `localizedPath`, canonical, and alternate-link conventions once the route exists. A non-English shell does not imply translated template content.

### 4.2 Navigation and conversion

`/templates` may be linked from the main site, the homepage, relevant tool pages, and editorial pages when the link is useful. A template detail page may offer an internal contextual action such as “Need this as a repeatable app? Post a request.” It may also link to relevant products or builders using ordinary internal localized paths.

Templates do not enter the organic `/products` ranking and do not receive sponsored placement. A marketplace link is a next step, not evidence that the template or the linked product is better.

### 4.3 SEO and crawl behavior

Only published entries with a complete purpose, usable body, example, limitation, and review metadata are indexable. Drafts, pack endpoints, individual downloads, and MCP responses carry noindex semantics where appropriate and do not enter the sitemap. The sitemap must list only pages that the content-indexing policy allows.

## 5. Source format and release model

### 5.1 Single source

For preparation and implementation, the catalogue is a Git-managed directory such as `content/open-templates/` in the VNX.SI repository. The exact path is an implementation-plan decision, but there must be one authoritative set of structured Markdown files. Pages, search data, the portable pack, adapters, and later MCP responses are generated from that set; no generated artifact is edited as a second source.

Opening a separate public content repository is a required Phase A prelaunch deliverable if VNX.SI promises an open-source public library. Creating that external repository is a separate authorized execution task; this documentation task does not create it. Until it is open and its first reviewed release is selected, the work may remain internal preparation but must not be marketed as the public open-source library. The public repository must not become a runtime dependency:

1. A reviewed release or commit is selected as the catalogue revision.
2. The VNX.SI build consumes that pinned revision and validates it before deployment.
3. The Worker bundles the resulting content/index snapshot; requests never fetch the repository, Git hosting, or a raw URL.
4. The site release records the source revision so a page, pack, and MCP response can be reproduced.
5. One repository is authoritative after the public release decision. The other side is a pinned release input or archival mirror, never a second place to edit content.

The Phase A gate includes an explicit Owner-authorized repository-opening task and a recorded licence/attribution decision. No external repository is created by this spec.

### 5.2 Proposed Markdown contract

The front matter is deliberately tool-neutral. Field names may be refined by the implementation plan, but published records must preserve these semantics:

```yaml
template_key: ot-meeting-follow-up
slug: meeting-notes-to-follow-up
title: Turn meeting notes into a follow-up
purpose: Create a clear follow-up with decisions, owners, and next steps.
audience: professional
category: communication
tags: [meetings, follow-up, operations]
content_locale: en
version: 1.0.0
status: published
license: CC-BY-4.0
reviewed_at: 2026-10-07
tested_tools: []
source_revision: generated-at-release
```

The body sections are `Use this when`, `Inputs`, `Template`, `Illustrative example`, `Check the result`, `Limitations`, and `Change log`. `tested_tools` remains empty until a real test is recorded. `source_revision` is generated release metadata attached to the rendered record or pack from the selected source revision; it is not a self-referential hash committed inside the source file, and the source file does not need its own final Git SHA.

### 5.3 Licence and rights

The recommended content licence is **CC BY 4.0**, pending explicit Owner acceptance. The final licence must be shown in each entry and pack, with attribution guidance. Contributors must confirm that their text, examples, and adaptations are original or available under compatible terms. Synthetic examples are preferred; real client data, secrets, and copied vendor prompts are prohibited.

The licence for any future build tooling is a separate repository decision. A licence URL is an outbound link and must follow the ADR-007 decision described in §7.3.

## 6. Quality and compatibility bar

Before publication, editorial review checks:

1. Front matter parses, required fields are present, the slug and `template_key` are unique, and the version is valid.
2. The task is specific enough to explain inputs, output expectations, and a human check.
3. The text contains no secret, personal, confidential, copied, or unsafe example and does not ask the model to take an unreviewed external action.
4. The illustrative example is clearly labelled and uses synthetic or rights-cleared data.
5. Limitations include likely failure modes, ambiguity, and when a user should not trust the output.
6. The template is readable in portable Markdown and does not depend on hidden system prompts, a private account, or an undocumented tool feature.
7. Every published template has at least one recorded real model/tool trial covering both a normal representative input and a missing or ambiguous-input case. The record names the model/tool, client or runtime version, date, source revision, output-check rubric, and observed result. This is the minimum quality trial; a full cross-model evaluation is not required.
8. Illustrative examples remain labelled as illustrative. Client compatibility claims or badges are limited to adapters with actual client/version verification; no unverified draft is published as quality-checked.
9. Copy, download, localization, accessibility, canonical, and noindex behavior pass the later implementation checks.

The quality bar is evidence-based. A review date is not a claim that output is correct for every future model. Major model or client changes trigger re-review of affected entries and adapters.

## 7. Architecture and integration

### 7.1 Existing Worker

The existing Hono/Cloudflare Worker can serve a bounded, read-only catalogue. The design should add a content-facing module that parses/loads reviewed records and a route/view boundary that prepares data before rendering. Domain code remains free of Hono and D1; views do not query the database. Search uses the generated in-memory/indexed snapshot for the MVP.

The current architecture says D1 is the sole source of truth. Open Templates proposes an explicit, read-only exception for versioned public content: Git is the source for the catalogue, and D1 is not required to publish or search it. This exception must be recorded in the implementation decision/ADR before code is merged. A later editorial CMS or user-submission workflow would require a new data decision rather than silently adding tables.

No D1 migration is needed for the MVP. No inference service, vector database, queue, or third-party analytics service is required to retrieve a template.

### 7.2 Privacy-compatible measurement

The existing M7 measurement contract has a privacy notice, GPC handling, a daily-rotating visitor hash, and no raw IP in click records. Any template measurement must use the same approved privacy boundary and central event conventions. It must not add third-party tracking, store raw search queries, or put template text or PII into logs.

MVP measurement may remain aggregate and operational. A persistent event table or new identifier is a later design decision and cannot be inferred from this spec. In particular, a daily-rotating hash cannot establish that the same person returned after 30 days.

### 7.3 External and marketplace links

ADR-007 requires outbound links to pass through `/go/`. This applies to affiliate links and also affects a future external content repository, licence page, tool documentation, or other external reference. The implementation plan must choose one of these explicitly before shipping such links:

- register the destination in the existing controlled outbound system, including a non-monetized/manual destination where appropriate; or
- propose and obtain an ADR-007 policy decision that defines a narrowly scoped, reviewed editorial-link exception.

The MVP must not add direct external anchors that silently bypass this rule. Internal VNX.SI links can use localized paths. Any monetized destination requires the existing disclosure, allowlist, no-open-redirect, and neutral-ranking rules; templates never receive paid ordering.

## 8. Portable packs and adapters

The portable pack is the MVP distribution artifact: UTF-8 Markdown, stable headings, template keys, version/licence metadata, and no client-specific syntax. It is generated from published entries and reproducible from a source revision.

At most two tool-specific adapters may ship in the pilot. The adapter set and exact client versions are deliberately deferred until a QA run confirms import/copy behavior. Claude and Codex are candidate targets because they are named use cases, not a promise that either format is already verified. Do not publish a tool-specific pack, compatibility badge, or installation claim based only on documentation assumptions.

Adapters must preserve the portable text and metadata, identify their target version, and be regenerated when the source version changes. An unverified or stale adapter is omitted or labelled unavailable. Hosted execution, account synchronization, private prompt injection, and automatic model calls are deferred.

## 9. MCP Phase B

MCP is a second phase, gated on evidence that the catalogue is useful through the web/pack surface. It is not part of the initial launch gate.

### 9.1 Contract

Expose only two read-only tools:

| Tool | Input | Output |
|---|---|---|
| `search_templates` | Bounded keyword query, optional allowlisted tags/category, bounded limit. | Stable key, title, purpose, tags, content language, version, and canonical VNX.SI URL for each result. |
| `get_template` | One validated `template_key` or slug. | Full reviewed template, inputs, usage guidance, example, checks, limitations, version, licence, source revision, and canonical URL. |

The server is stateless for catalogue retrieval. It does not persist MCP sessions, cookies, user accounts, prompts, or raw query strings. Responses are bounded by query length, result count, template size, and total response bytes. Rate limiting and structured error responses are required.

### 9.2 Transport and trust boundary

Use Streamable HTTP at a canonical non-localized endpoint such as `/mcp`. The existing same-origin middleware currently expects a browser-style Origin for state-changing POST requests; MCP needs a protocol-aware boundary rather than a global weakening of that middleware. Phase B must validate Origin according to the MCP transport contract, reject disallowed origins where required, and avoid depending on a browser cookie, VNX.SI session, Turnstile, or a browser challenge.

The endpoint returns only curated published content. It never executes a template, calls an AI model, follows arbitrary URLs, reads private repository content, or evaluates instructions received from a caller. Compatibility is advertised only for named client/runtime versions that have been tested. “Compatible with MCP” does not mean compatible with every AI harness.

SDK/runtime choice, protocol conformance tests, rate limits, and the exact client compatibility matrix are Phase B decisions.

## 10. Operating cost and editorial model

Retrieval is text delivery. The Worker does not pay for an inference call per copy, download, or MCP retrieval; the user runs the template in their chosen AI product. Expected technical cost is the existing Worker, static/bundled content, cache, and bounded request handling. The pilot introduces no required paid search, vector, or analytics service.

The material cost is editorial maintenance. The operating assumption for approval is 2–4 hours per week for selection, review, contribution triage, and retesting. If the catalogue cannot be kept within that budget, freeze additions or reduce scope rather than publish stale compatibility claims.

## 11. Pilot metrics and cohort rules

Targets below are suggested decision thresholds, not forecasts or public claims. Every report must state its period, UTC boundary, bot filtering, consent/privacy gate, and denominator.

| Metric | Definition and denominator | Suggested pilot signal |
|---|---|---|
| Published utility | Published entries with complete QA metadata and no unresolved content blocker divided by entries intended for launch. | 100% before launch. |
| Activation | Successful copy or portable-pack download events from published content, with bot/error responses excluded. Report total events and, when available, daily unique activation hashes separately; do not call daily hashes people across dates. | At least 100 activation events during the pilot is a proposed signal, not a forecast. |
| Copy rate | Successful copy events divided by eligible detail-page views in the same period; show both counts because repeated actions can exceed a person-level rate. | Track trend by template; no universal quality claim from one ratio. |
| Pack adoption | Successful pack downloads divided by pack page/CTA views, with attachment responses and errors separated. | Track trend; use for distribution decisions. |
| Marketplace referral | Internal product/builder/request CTA clicks divided by eligible template detail-page views. | Any qualified referrals are evidence to inspect; no revenue is inferred. |
| MCP usage (Phase B) | Successful tool calls and rate-limited/error calls by day and tool; no raw query retention. | Launch only after web usefulness evidence and protocol QA. |
| Editorial cost | Hours spent per week on review, support, and retesting. | Keep within the 2–4 hour/week assumption or reduce scope. |

The original 30-day return idea is a research target, not an automatic launch gate. Existing daily visitor hashes rotate and cannot measure a person-level 30-day cohort. A future retention metric requires either a voluntary user panel/self-report or an explicitly privacy-approved persistent measurement design. If implemented, define the cohort as activated users whose first qualifying copy/download falls in the first 14 days, and define retention as at least one qualifying action on a later date through day 30; publish numerator and denominator and do not infer identity from anonymous downloads.

## 12. Product phases and dependencies

The roadmap is sequential: preparation, the web/open-source pilot, bounded MCP, then evidence-driven expansion. These are product gates, not blanket implementation authorization. Marketplace supply, product verification, requests, and the M7 foundations remain the core dependency; Open Templates adds a distribution layer and does not replace them.

### Phase 0 — preparation

This is the current documentation phase. It delivers an Owner-approved written spec, accepted architecture decisions for the Git catalogue exception to D1, ADR-007 external-link treatment, the four-locale route/content boundary, and privacy measurement, plus a later implementation plan and task handoffs. It does not create product code, a public repository, or a deployed route. An unresolved architecture decision blocks the next phase.

### Phase A — web pilot and open-source release

Dependencies: Phase 0 approval, an Owner-accepted content licence, an editor and 2–4 hour/week maintenance budget, and a separately authorized task to open the public content repository before public prelaunch.

Deliverables are 20–30 curated entries with an approximately 80/20 everyday-to-developer mix; English content behind the four-locale UI contract; account-free browse/search/copy/download; one portable Markdown pack; zero to two verified adapters; and a pinned, reproducible source release. Every published template requires one recorded real model/tool trial with normal and missing/ambiguous-input cases plus an output-check rubric. A full cross-model evaluation is not required. Marketplace/Build Kit links remain contextual, neutral, and subject to their own reviewed routes.

The public repository opening is part of the Phase A prelaunch gate so the open-source promise cannot be silently deferred. Its creation is not authorized by this document. The Worker consumes a pinned release at build time and never fetches the repository at runtime; one repository is authoritative after the release decision.

Phase A signals are hypotheses, not forecasts: activation events, pack adoption, qualified internal marketplace referrals, and editorial hours with explicit denominators. The daily-rotating M7 hash cannot prove person-level 30-day retention; use a voluntary panel or separately approved persistent measurement before defining that cohort.

### Phase B — bounded read-only MCP

Dependencies: Phase A evidence that the web/pack surface is useful, plus protocol and named-client/runtime verification. Deliver only stateless Streamable HTTP tools `search_templates` and `get_template` with bounded responses, protocol-aware Origin handling, no cookie/session/Turnstile dependency, no execution or arbitrary URL fetch, and no promise of all-harness compatibility.

### Phase C — evidence-driven expansion

Start only if Phase A/B shows repeat utility and the editorial budget remains viable. Candidate deliverables are reviewed community proposals, more templates, verified adapters, and human-reviewed translations for locales with demonstrated demand. Do not make translations, semantic search, accounts, ratings, personalization, or hosted execution automatic commitments.

## 13. Implementation-planning and public-launch gates

This spec has two gates. The first allows a later implementation plan to be written; the second applies before the public pilot launches. The implementation-planning gate does not require the final catalogue, generated artifacts, or a running route to exist.

### 13.1 Implementation-planning gate

A later implementation plan may start when all of these are true:

1. The written spec has Owner approval.
2. The architecture decisions required to implement the MVP have an accepted decision record; an unresolved architecture question blocks this gate. The required decisions cover the Git catalogue exception to D1, the ADR-007 treatment of external links, the four-locale route/content boundary, and the privacy measurement boundary.
3. The plan names the source/release contract, the editorial owner, the §6 real-trial record, and the verification work needed before launch.
4. The remaining product choices are bounded without pretending they are verified: candidate inventory, exact source directory, adapter targets, and MCP client support may be decided during implementation under the gates in this spec.

No 20–30 published entries, generated page/search/pack artifacts, tested adapter, or deployed route is required at this gate.

### 13.2 Public-launch gate

The public pilot is ready only when all of these are true:

1. The catalogue contains 20–30 genuinely useful candidates, with the 80/20 audience mix and no filler; every published candidate passes §6, including the recorded normal and missing/ambiguous-input trials and output-check rubric.
2. The public content repository has been opened through a separately authorized execution task, its first reviewed release is pinned, and one authoritative source is recorded. The Worker has no runtime repository dependency.
3. The source format generates the page, search index, portable pack, and metadata from one pinned revision; no generated file is hand-maintained.
4. Account-free browse, copy, and portable download flows are implemented, accessible, and verified. All UI keys have four-locale parity, and English content is labelled.
5. The recommended content licence is accepted or replaced by a recorded Owner decision. Rights and attribution rules are ready for contributors.
6. The D1 exception, external-link treatment under ADR-007, and marketplace-link disclosure behavior are recorded before any code or external URL is published.
7. Privacy review confirms that the event definitions do not retain raw queries, PII, secrets, or a false person-level retention claim. M7’s consent/GPC/go-live rules are respected.
8. A named editor accepts the 2–4 hour/week operating budget. A stale-content and removal process exists.
9. Portable Markdown is ready. There are zero to two adapters, each backed by actual client/version QA; no unverified format is advertised.
10. MCP is explicitly out of the initial launch unless Phase B evidence, protocol review, and compatibility QA are separately approved.

## 14. Deferred scope and open decisions

| Decision | Owner decision required |
|---|---|
| Written design | Approve this draft as the basis for a later implementation plan. Product direction is already approved. |
| Content licence | Accept CC BY 4.0 or name a replacement; decide whether examples need an additional attribution rule. |
| Repository | Open the public repository before Phase A prelaunch through a separately authorized task; record the canonical source and pinned release without adding a runtime dependency. |
| External links | Register repository/licence/tool URLs through `/go/`, or approve a narrow ADR-007 editorial-link exception before exposing them. |
| Initial inventory | Select the final 20–30 entries, editor, review cadence, and removal owner. |
| Adapters | Select zero to two target clients and exact versions only after real QA; do not infer compatibility from brand names. |
| Measurement | Approve aggregate event fields and decide whether a voluntary panel is sufficient for repeat-use research. Persistent retention measurement needs a separate privacy decision. |
| MCP | Approve Phase B only after usefulness evidence; select SDK/runtime, conformance tests, and support matrix then. |

Deferred from this pilot: accounts, favorites/sync, ratings, comments, public auto-publishing, CMS editing, semantic/vector search, hosted prompt execution, model inference, personalized recommendations, automatic translation, broad tool packs, paid placement, sponsored templates, and a template marketplace listing.

## 15. Principal risks and mitigations

| Risk | Mitigation in this design |
|---|---|
| Catalogue feels like a generic prompt directory. | Curate a small set of concrete workflows with examples, checks, limitations, and review metadata. |
| Compatibility claims age quickly. | Version/date every test; omit unverified adapters; re-review after material client/model changes. |
| Content creates safety, rights, or privacy exposure. | Synthetic examples, editorial gate, no secrets/PII, no autonomous or high-stakes decision templates, removal path. |
| A separate repository drifts from the site. | Pinned release input, bundled snapshot, recorded source revision, one authoritative repository. |
| External links bypass monetization/security policy. | Resolve ADR-007 treatment before shipping any repository, licence, tool, or partner URL. |
| MCP expands support burden or becomes an execution surface. | Phase B gate, two read-only tools, stateless bounded responses, no execution/fetching, named client matrix. |
| Traffic does not lead to marketplace demand. | Treat referrals as a separate hypothesis; keep templates valuable without a conversion and use pilot data before expanding. |
| Maintenance exceeds one-person capacity. | 20–30 item cap, 2–4 hour/week budget, freeze or remove stale entries instead of lowering the bar. |
