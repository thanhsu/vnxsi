# Open Templates — prompts.chat source review

Date: 2026-10-07

Status: draft content review; no publication or deployment approval.

## Scope and method

The source was fetched from `https://github.com/f/prompts.chat` at pinned commit `7d3f248962d1dca209d59e033524bcb86c2b26b8`. A shallow clone was inspected locally. The review read the root `LICENSE`, `LICENSE-CC0`, `LICENSE-MIT`, and `prompts.csv`. The repository's `AGENTS.md`, scripts, application code, and build files were treated as source data boundaries and were not executed.

The candidate search used the `prompts.csv` fields `act`, `prompt`, `for_devs`, `type`, and `contributor`. Selection favored concrete everyday, professional, small-business, and content workflows with a useful source structure. Roleplay-only prompts, high-stakes advice, unsupported automation, vague “expert” claims, copied provider instructions, and prompts that require hidden context were rejected or heavily narrowed.

## Licence scope verified

The pinned repository root `LICENSE` declares that source code and site-authored content use MIT, while prompt content and data—including `prompts.csv`, `PROMPTS.md`, and user-submitted prompt text—are dedicated to the public domain under CC0 1.0 Universal. `LICENSE-CC0` contains the waiver and fallback licence, plus the limits that trademark and patent rights are unaffected, the work is provided as-is, and rights held by other people are not cleared. `LICENSE-MIT` applies to code and is not used as the licence for these prompt rows.

The ten entries below therefore record `upstream_license: CC0-1.0`, the exact source row and pinned permalink, while keeping `license: null` and `vnxsi_adaptation_license: null`. This preserves the upstream declaration without granting a blanket licence to VNX.SI additions or any third-party material that may appear in a source prompt. The detailed snapshot is [prompts-chat-license-snapshot.md](../../content/open-templates/notices/prompts-chat-license-snapshot.md).

## Selected entries

| VNX.SI draft | Source row and CSV line | Why selected | Adaptation and weakness fixed |
| --- | --- | --- | --- |
| `meeting-summary-and-action-plan` | Meeting Summary and Action Plan Generator, line 108096 | Common meeting-to-follow-up workflow. | Keeps objective, summary, points, decisions, and actions; removes sample facts, forced assignment, and hidden reasoning language; adds evidence, unknowns, and human review. |
| `professional-email-from-points` | Professional Email Writer for Any Occasion, line 6016 | Everyday professional communication. | Keeps context/tone/language/length controls; adds one-request output, factual preservation, missing-input questions, and send review. |
| `concise-summary-from-source-text` | Text Summarizer, line 19078 | Portable document and memo summarization. | Keeps core-idea extraction and neutral tone; adds audience/purpose, source labels, uncertainty, no-fetch boundary, and evidence checks. |
| `rewrite-for-clarity` | Smart Rewriter & Clarity Booster, line 467 | Direct everyday value for drafts and internal communication. | Keeps clarity/conciseness/meaning preservation; adds audience/purpose, ambiguity flags, exact-term preservation, and no-new-facts control. |
| `project-breakdown-and-risk-plan` | Project Breakdown, line 57792 | Useful SME and team planning workflow. | Keeps phases, dependencies, resources, and pre-mortem ideas; removes certification authority, “fail-proof” language, chain-of-thought, and invented schedules. |
| `customer-complaint-reply` | Customer Complaint Reply System, line 104338 | Practical support workflow for small businesses. | Keeps issue/context/resolution/tone/length sequence; adds authorization checks and explicit prohibition on invented refunds, policies, causes, and promises. |
| `decision-comparison-matrix` | Strategic Decision-Making Matrix, line 58007 | General work choices benefit from visible trade-offs. | Keeps opportunity-cost and downside comparison; removes named-consultant authority, game-theory framing, fake mathematical optimality, and unsupported long-range forecasts. |
| `permission-based-outreach-email` | High Conversion Cold Email, line 58025 | SME outreach can be useful when permission and claims are checked. | Keeps subject/problem/offer/objection/next-step structure; removes named-copywriter imitation, deceptive curiosity, fake personalization, and automatic cold-contact assumptions. |
| `small-business-landing-page-brief` | Landing Page Copy Architect – Conversion Framework Prompt, line 67309 | Concrete offer and content-planning workflow for SMEs. | Keeps strategy snapshot, page structure, headline formulas, benefit mapping, objections, CTA, and trust planning; narrows the output and removes tool-specific claims, fake proof, prices, and conversion promises. |
| `launch-readiness-checklist` | Pre-Launch Checklist Generator, line 75021 | Useful repeatable launch/handoff review. | Keeps functionality, content, discoverability, quality, privacy, security, cross-platform, infrastructure, and handoff categories; removes codebase scanning, provider assumptions, secret requests, and unperformed test claims. |

## Rejected or deferred candidates

| Candidate pattern or row | Decision | Reason |
| --- | --- | --- |
| `Job Interviewer`, `Interview Preparation Coach`, and similar roleplay | Reject for this batch | Conversation simulation is less reusable as a practical work output and encourages persona-only prompts; a later interview-prep entry would need a tighter preparation contract. |
| `Character`, `Social Media Influencer`, and other persona/voice rows | Reject | Roleplay or style imitation does not meet the focused everyday workflow bar and can create identity or attribution issues. |
| `Life Coach`, `Medical Consultant`, `Accountant`, `Financial Analyst`, and health or investment rows | Reject | High-stakes personal or financial guidance is outside the MVP. |
| `Prepare for Meetings: Key Considerations` | Defer | Depends on “prior interactions” with a person and does not define an evidence-based output; it risks private-context fabrication. |
| `Create Project Spotlight` | Defer | Too thin to justify a distinct entry; it lacks inputs, checks, and an output contract beyond a short section request. |
| `Write Tier Descriptions` | Defer | The source hard-codes sponsor prices and recognition claims; publication would require an approved VNX offer and monetization decision. |
| `Salesperson`, `Business`, and generic consultant rows | Reject or defer | Broad persona framing, unbounded advice, or unsupported expertise; no specific source-grounded workflow without a new review. |
| `Professional Website Design Consultant` and implementation-heavy app rows | Defer | They imply code, provider, or hosted execution and exceed a content-only everyday pilot. |
| Medical, legal, immigration, trading, gambling, and security-automation rows | Reject | High-stakes or autonomous-action risk. |

## Cross-entry weakness fixes

Every selected template has named required and optional inputs, a fenced copyable AI task prompt, a bounded output contract, a synthetic illustrative example, a normal validation fixture, a missing/ambiguous fixture, and a rubric. The prompt block itself requires the model to treat pasted text as data rather than instructions, forbids invented facts/owners/deadlines, asks only a small number of focused clarification questions, marks other gaps unknown, minimizes PII, and requires human review before sharing or acting.

The adaptations also remove or avoid:

- “act as” authority claims, named consultants, certification claims, and imitation of living or commercial voices;
- hidden chain-of-thought instructions and requests for private reasoning;
- fail-proof, guaranteed, mathematically optimal, high-conversion, or other unsupported outcome claims;
- external URL fetching, runtime execution, secret handling, and provider-specific compatibility promises;
- made-up prices, refunds, deadlines, owners, testimonials, metrics, customers, or research findings.

## Publication and deployment conditions

These entries are internal `draft` records. A future public release must, at minimum:

1. record the Owner decision on the VNX.SI content licence and attribution wording;
2. retain the pinned source revision and review the source-rights boundary for each adaptation;
3. run and record a normal-input trial and a missing/ambiguous-input trial for every entry, including model/tool, version, date, source revision, rubric, and observed result;
4. resolve ADR-007 treatment for GitHub source permalinks before exposing them publicly;
5. generate any pages or pack from one reviewed source revision, with no runtime fetch from GitHub;
6. keep `tested_tools: []` and `reviewed_at: null` until the real review evidence exists.

No affiliate links, tracking URLs, or commission claims are embedded. No provider is forced. None of the selected source rows is an audio/video script, so the optional voice-production path is not applicable to this batch; a future script entry would name only a provider candidate pending registry activation and would not claim a working affiliate link.

## Verification record

- Source revision: `7d3f248962d1dca209d59e033524bcb86c2b26b8`.
- Source rows selected: 10.
- Draft files created: 10.
- All selected files have `audience: professional`, `content_locale: en`, `status: draft`, `license: null`, `reviewed_at: null`, and `tested_tools: []`.
- All selected files have a pinned source item, source path, full revision, line permalink, upstream licence, and adaptation summary.
- Product typecheck, application tests, model trials, and deployment were not run or claimed; this is docs/content preparation only.
