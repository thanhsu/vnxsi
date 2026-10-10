# Open Templates Fabric everyday source review

## Review scope

This review covers a shallow, read-only inspection of `danielmiessler/Fabric` at the pinned commit below. The upstream checkout was used only to inspect source text, paths, metadata, and licence files; no upstream build, script, tool, or prompt was executed.

- Repository: `danielmiessler/Fabric`
- Pinned commit: `c11e9b6cc065b5a2fad66c85ebbaa89ce9e99d38`
- Commit subject: `chore(release): Update version to v1.4.515`
- Commit date: `2026-10-05T22:48:18Z`
- Source checkout: shallow clone outside this repository, clean after inspection
- Scope inspected: `data/patterns/**`, root `LICENSE`, and candidate source paths

The ten adapted entries live under `content/open-templates/fabric-everyday/`. Each entry records the same full commit, immutable blob URL, source item, source path, upstream licence, and an adaptation summary in front matter and in a provenance section.

## Licence and notice findings

The inspected checkout contains one root `LICENSE` file and no nested `LICENSE*`, `COPYING*`, or `NOTICE*` file under the inspected tree. The root file is the MIT License and names “Scott Chacon and others” with copyright years 2012–2024. Its notice and permission text is preserved verbatim in [`notices/fabric-MIT.txt`](../../content/open-templates/notices/fabric-MIT.txt).

The root MIT text permits copying and modification subject to retaining the copyright and permission notice, and provides the software without warranty. No pattern-level exception or alternate licence was found in this scan. This is an evidence record rather than legal advice; the Owner should confirm that the intended catalogue use is covered before publication.

The adapted entries keep `license: null`. The upstream MIT attribution is recorded separately as `upstream_license: MIT`; that does not grant or select a VNX.SI catalogue licence. The pending CC BY recommendation in the broader product documents is not applied to these entries.

## Selected candidates

All selected source files existed at the pinned commit. The source path and immutable permalink below are the exact provenance used by the corresponding draft.

| Draft | Upstream item | Source path | Why selected | Adaptation/fix applied |
|---|---|---|---|---|
| `fabric-summarize.md` | `summarize` | `data/patterns/summarize/system.md` | General-purpose reading aid for reports, articles, transcripts, and notes. | Named inputs; source traceability; explicit inference, privacy, rights, and private/draft delivery checks. |
| `fabric-summarize-meeting.md` | `summarize_meeting` | `data/patterns/summarize_meeting/system.md` | Recurring professional need to separate discussion, decisions, tasks, risks, and next steps. | Removed brittle fixed word counts; disallowed invented owners/deadlines and external task/calendar actions. |
| `fabric-create-newsletter-entry.md` | `create_newsletter_entry` | `data/patterns/create_newsletter_entry/system.md` | Useful content workflow for a short article-based newsletter item. | Generalized source-specific newsletter style; added attribution, source-rights, privacy, and public-review gates; no links/provider claims. |
| `fabric-summarize-newsletter.md` | `summarize_newsletter` | `data/patterns/summarize_newsletter/system.md` | Practical reading aid for busy readers processing newsletter issues. | Removed URL/X-link fetching, sponsorship/affiliate behavior, and provider recommendations; preserved named-entity extraction with no invented links. |
| `fabric-extract-insights.md` | `extract_insights` | `data/patterns/extract_insights/system.md` | Helps readers move from summary to useful, discussable implications. | Replaced unsupported novelty/persona framing with source-supported observations, labelled inference, and evidence questions. |
| `fabric-extract-main-idea.md` | `extract_main_idea` | `data/patterns/extract_main_idea/system.md` | Fast comprehension aid for articles, talks, proposals, and memos. | Added explicit “no recommendation” path and prevents implied recommendations becoming commands. |
| `fabric-extract-questions.md` | `extract_questions` | `data/patterns/extract_questions/system.md` | Useful for interview preparation, research coding, and transcript review. | Removed unsupported intelligence claims and repeated-thinking instructions; preserves wording and marks speaker ambiguity. |
| `fabric-improve-writing.md` | `improve_writing` | `data/patterns/improve_writing/system.md` | Common everyday editing task with a clear output boundary. | Preserves facts, language, qualifications, and commitments; adds ambiguity/privacy checks and human approval before use. |
| `fabric-analyze-paper-simple.md` | `analyze_paper_simple` | `data/patterns/analyze_paper_simple/system.md` | Research utility with a concrete evidence and methods review contract. | Never fabricates absent statistics; avoids unsupported grades and high-stakes conclusions; reports unknowns explicitly. |
| `fabric-youtube-summary.md` | `youtube_summary` | `data/patterns/youtube_summary/system.md` | Useful transcript workflow for navigable video summaries. | Accepts transcript only; normalizes supplied timecodes; flags missing/malformed timestamps instead of inventing them; adds rights/privacy review. |

Immutable source URL pattern for each item:

`https://github.com/danielmiessler/Fabric/blob/c11e9b6cc065b5a2fad66c85ebbaa89ce9e99d38/data/patterns/<item>/system.md`

The literal item-specific URL is stored in each draft. The URL is provenance metadata, not a runtime fetch instruction.

## Candidate rejections and reasons

These existing upstream patterns were considered but excluded from the everyday set. They remain available for a future review; their exclusion is a scope and safety decision, not a claim that the upstream files are defective.

| Candidate | Decision | Reason |
|---|---|---|
| `extract_affiliate_products` | Reject | Conflicts with the no-affiliate/no-commission-ranking boundary and could turn content extraction into commercial promotion. |
| `extract_sponsors` | Reject | Encourages sponsor/commerce extraction that would require rights, attribution, and current offer verification. |
| `extract_video_commerce_entities` | Reject | Commerce-focused output is outside the everyday utility slice and risks unsupported product or provider claims. |
| `analyze_monetization_opportunities` | Reject | Strategic commercial analysis is outside the first everyday/research/content set and needs a different evidence contract. |
| `create_hormozi_offer` | Reject | Sales persuasion and offer construction are not required for the approved utility set and can create unsupported promises. |
| `analyze_malware` | Reject | Security-sensitive analysis is outside this everyday slice and requires a separate safety review. |
| `write_hackerone_report` | Reject | Security disclosure workflow belongs with the developer/security track, not everyday professional content. |
| `create_coding_project` | Reject | Developer implementation workflow belongs to the separate developer set. |
| `write_pull-request` | Reject | Developer workflow; excluded to keep this set distinct from source-adapted everyday utility. |
| `create_logo` | Reject | Image/brand generation is outside the text-template MVP and needs rights and asset review. |

## Review issues before publication

1. Confirm with the Owner that the root MIT notice is sufficient for the selected pattern files and that no contributor-specific rights information is required.
2. Keep `license: null` and `status: draft` until VNX.SI accepts a catalogue licence and completes the independent editorial and rights gates.
3. Do not claim model, client, MCP, or tool compatibility from these source adaptations. Every `tested_tools` field is intentionally empty.
4. If an entry is later intended for public newsletter, video, or research use, add a real source-rights/privacy/factual review record; the illustrative examples in the drafts are not trials.
5. Do not add affiliate links, provider rankings, or current product recommendations without a separate registry and verified terms. No such link or claim is present in this batch.
6. Keep the pinned commit and source paths immutable for this batch. A future upstream update requires a new source review and adaptation record.

## Outcome

The ten selected patterns are suitable draft sources for a narrow everyday professional, research, and content utility slice after the listed adaptation fixes. The source review does not authorize publication, public repository creation, a VNX.SI licence, model/tool compatibility claims, or deployment.
