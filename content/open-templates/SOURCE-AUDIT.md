# Open Templates source audit

**Status:** Internal preparation record. Source evidence for the 25 draft candidates is collected at the pinned revisions below. This document is not a public catalogue page and its raw provenance URLs do not bypass ADR-007.

## Curation target

The current target is 25 source-reviewed adaptations: 10 from `f/prompts.chat`, 10 everyday patterns from `danielmiessler/Fabric`, and five developer patterns from the same Fabric source. The count may be reduced when a selected source lacks clear rights evidence, useful adaptation value, safety fit, or a later quality trial. No archived self-authored draft is counted toward the target.

## Required record per entry

Before an entry can enter the draft catalogue index, record:

- local `template_key` and slug;
- upstream collection and owner;
- exact upstream path or permalink;
- `source_commit`: the full 40-hex SHA for the selected upstream commit;
- `upstream_license`: the verified source-specific term for the selected path (`CC0-1.0` or `MIT` where supported by evidence);
- licence evidence at that commit and any attribution requirement;
- whether the selected text is copied, transformed, or used only as inspiration;
- concise adaptation/change summary;
- safety/privacy edits and removed claims;
- reviewer and unresolved question.

The release process later adds generated `source_revision` metadata for the VNX snapshot. It must not be confused with the upstream revision and must not be a self-referential hash in the source file.

## Candidate source records

| Collection | Provenance reference | Current status | Required next evidence |
|---|---|---|---|
| `prompts-chat` | `f/prompts.chat` repository at `7d3f248962d1dca209d59e033524bcb86c2b26b8`; internal source URLs are pinned per entry | Prompt content/data is CC0 1.0 Universal; source code/site-authored content is MIT, with the repository defaulting to MIT when file scope is unclear. The ten selected prompt rows use `CC0-1.0` and the repo-relative snapshot `content/open-templates/notices/prompts-chat-license-snapshot.md`. | Evidence is collected for all ten entries; the Owner still must decide the VNX additions licence and publication boundary. |
| `fabric-everyday` | `danielmiessler/Fabric` at `c11e9b6cc065b5a2fad66c85ebbaa89ce9e99d38`; selected pattern paths | Repository `LICENSE` is MIT. The ten selected patterns use `MIT` and preserve the repo-relative notice `content/open-templates/notices/fabric-MIT.txt` with `Copyright (c) 2012-2024 Scott Chacon and others`. | Evidence is collected for all ten entries; the Owner still must decide the VNX additions licence and publication boundary. |
| `fabric-developer` | `danielmiessler/Fabric` at `c11e9b6cc065b5a2fad66c85ebbaa89ce9e99d38`; selected developer pattern paths | Same MIT evidence and repo-relative notice `content/open-templates/notices/fabric-MIT.txt` as Fabric everyday. | Evidence is collected for all five entries; the Owner still must decide the VNX additions licence and publication boundary. |

The `dair-ai` Guide is context-only because it is a general guide rather than the selected prompt collection, and its individual source/licence boundaries were not part of this curation pass. Anthropic tutorial/skills material is also context-only because it is provider guidance and examples, not a selected source library for these entries; no exact adapted file and licence snapshot is recorded here. Neither candidate is part of the target count or a licence claim.

## Duplicate-family review

The source set retains the following related pairs because their inputs, output contracts, and user decisions differ. These distinctions are also recorded in the generated catalogue metadata:

| Pair | Evidence for retaining both |
|---|---|
| `concise-summary-from-source-text` / `fabric-summarize` | The prompts.chat adaptation asks for a concise, audience-and-purpose summary with qualifiers; the Fabric adaptation produces a quick-review structure with a one-sentence summary, main points, and takeaways. |
| `meeting-summary-and-action-plan` / `fabric-summarize-meeting` | The prompts.chat adaptation is a follow-up record centered on decisions, owners, and next steps; the Fabric adaptation separates discussion, decisions, tasks, risks, and unknowns for deeper review. |
| `rewrite-for-clarity` / `fabric-improve-writing` | The prompts.chat adaptation rewrites for a stated audience and purpose; the Fabric adaptation edits language and coherence while preserving meaning, commitments, and qualifications. |
| `fabric-summarize-newsletter` / `fabric-create-newsletter-entry` | The summary is a private reading aid for a supplied issue; the creation entry is an editorial draft for one supplied article and requires rights, attribution, and publication review. |

If a later editorial trial shows that a pair no longer has a useful distinction, remove one record rather than preserve the target count.

## Provider references for conditional recommendations

These references support internal planning only; they do not authorize a public outbound link or affiliate CTA:

- Cloudflare Pages static HTML guidance: `https://developers.cloudflare.com/pages/framework-guides/deploy-anything/`
- GitHub Pages overview: `https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages`
- ElevenLabs text-to-speech capabilities: `https://elevenlabs.io/docs/overview/capabilities/text-to-speech`

Cloudflare Pages is a nonaffiliate candidate for static documentation/site output because it fits a pre-rendered, repository-built artifact. GitHub Pages is an eligible nonaffiliate alternative after usage constraints are checked because it can serve a static repository output without requiring a partner conversion. ElevenLabs is an optional text-to-voice production step only for genuinely relevant audio/video scripts because its value is voice production, not hosting or distribution. The registry records ElevenLabs as a draft with missing terms; this set emits no affiliate URL or CTA, and any runtime activation requires later configuration and validation. See `DELIVERY-MATRIX.md` for the decision boundary.

## Public-link boundary

Source provenance and provider references stay in internal audit/spec material. A future user-visible external documentation or partner link must be public official documentation or a registered `/go` mapping after the ADR-007 decision. No affiliate tag, commission field, or paid ranking signal belongs in source metadata, an upstream prompt, a generated catalogue, or the portable pack.
