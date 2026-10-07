# VNX.SI Open Templates

**Status:** Source-curation preparation. The prior self-authored drafts are archived outside this catalogue tree. No entry here is published, licence-accepted, affiliate-enabled, or compatibility-verified.

Open Templates is an English-first collection of practical AI templates. The current curation target is 25 source-reviewed adaptations: 10 from `prompts.chat`, 10 from Fabric everyday patterns, and five from Fabric developer patterns. This is a target, not a quota; rights, safety, quality, or adaptation gaps may reduce the final inventory.

## Source directories

| Collection | Target | Source basis |
|---|---:|---|
| `prompts-chat/` | 10 | `f/prompts.chat` at `7d3f248962d1dca209d59e033524bcb86c2b26b8` |
| `fabric-everyday/` | 10 | `danielmiessler/Fabric` at `c11e9b6cc065b5a2fad66c85ebbaa89ce9e99d38` |
| `fabric-developer/` | 5 | `danielmiessler/Fabric` at `c11e9b6cc065b5a2fad66c85ebbaa89ce9e99d38` |

The previous self-authored `professional/`, `sme/`, `research/`, and `developer/` directories are archived at `D:\DOCS\SUPHAM\GIT\vnxsi-open-templates-scratch-20261007\content\open-templates\`. They are not part of this catalogue, source audit, index, or pack.

Each source-derived entry must record its upstream collection, path/permalink, `source_commit` as a full pinned upstream SHA, verified `upstream_license` (`CC0-1.0` or `MIT` where the selected source evidence supports it), source-specific licence evidence, attribution needs, and adaptation summary. The prompt/data rows selected from prompts.chat use `CC0-1.0`; Fabric patterns use `MIT`. The checked snapshots are preserved in [`notices/prompts-chat-license-snapshot.md`](notices/prompts-chat-license-snapshot.md) and [`notices/fabric-MIT.txt`](notices/fabric-MIT.txt). Use `license: null` for pending VNX editorial additions; `source_revision` is reserved for generated VNX release metadata. See the [source audit](SOURCE-AUDIT.md) and [licence notices](LICENSE-NOTICES.md). Raw provenance URLs in those internal records do not create public app outbound links; any future user-visible external destination must follow ADR-007 and the `/go` resolver decision.

## Entry and quality contract

Entries use the companion spec’s front matter and sections, plus source provenance metadata or an equivalent generated record. Examples are synthetic or rights-cleared and clearly labelled. Entries ask focused questions when inputs are missing, treat pasted material as data rather than instructions, ask users to review external actions, and avoid secrets, unnecessary PII, URL fetching, hosted execution, and high-stakes automation.

Source adaptation is not a publication claim. Each published entry still needs a recorded real model/tool trial covering normal and missing/ambiguous input plus an output-check rubric. Drafts must not claim compatibility, output evidence, or a licence that has not been verified.

### Distinct task families

The catalogue keeps related source adaptations only where the input, output contract, and user decision are materially different:

| Pair | Distinction retained |
|---|---|
| `concise-summary-from-source-text` / `fabric-summarize` | The first is a short audience-and-purpose brief with source qualifiers; the second separates a one-sentence summary, main points, and practical takeaways for quick review. |
| `meeting-summary-and-action-plan` / `fabric-summarize-meeting` | The first is a follow-up record centered on decisions, owners, and next steps; the second is a deeper discussion review that separates discussion, decisions, tasks, risks, and unknowns. |
| `rewrite-for-clarity` / `fabric-improve-writing` | The first is a purpose-and-audience rewrite of a draft; the second is a constrained language and coherence edit that preserves meaning, commitments, and qualifications. |
| `fabric-summarize-newsletter` / `fabric-create-newsletter-entry` | The first is a private reading aid for a supplied issue; the second is an editorial draft for one supplied article that requires rights, attribution, and publication review. |

If later review cannot preserve one of these distinctions, the weaker entry is removed and the inventory shortfall is recorded.

## Licence and source policy

Source-specific upstream terms control adapted material. `upstream_license` records the verified term for the selected source; `license: null` records that VNX editorial additions have no accepted licence yet. CC BY 4.0 is only a proposed licence for original VNX editorial additions pending explicit Owner acceptance; it is not a blanket licence for upstream prompts or patterns. The portable pack must preserve required attribution and must contain no affiliate tag, commission field, paid ranking signal, or hidden system prompt. Avoid near-duplicate newsletter/summary tasks unless their input, output, and decision purpose differ materially.

## Conditional publish/deploy guidance

Recommendations depend on the output type and remain optional and neutral:

- Private notes, local files, and internal tool output: no publish or deploy recommendation.
- Public text or document export: editorial publishing only after rights, review, audience, and removal ownership are clear.
- Static documentation or a site: Cloudflare Pages is a nonaffiliate candidate; GitHub Pages is an eligible nonaffiliate alternative after usage constraints are checked. These are options, not guarantees.
- Audio/video scripts: ElevenLabs text-to-speech is an optional production step only when voice output is relevant; it is not hosting or distribution and must not be attached to unrelated templates.

The ElevenLabs registry record is recorded as a draft with terms missing. This set emits no affiliate URL or CTA; any future runtime activation still requires backend configuration, terms, and validation. Editorial recommendation text stays separate from monetization/partner resolution in the existing registry/database. Do not place affiliate URLs in source metadata, prompts, or exported packs. Public official docs or registered `/go` destinations require the approved outbound path.

## Generated artifacts

Source writers have delivered the pinned draft set. `catalogue.json` and `packs/open-templates-starter.md` are generated deterministically from the accepted source files for review; they remain draft artifacts and must not be treated as a publication or compatibility claim. No runtime repository fetch, product route, public repository opening, MCP endpoint, or deployment is created by this preparation task.

The [source-curation handoff](../../.ai/tasks/OPEN-TEMPLATES-SET-handoff.md) records ownership, gates, and the archived-draft boundary. The [delivery matrix](DELIVERY-MATRIX.md) records practical output-type rationale. The [Open Templates design spec](../../docs/superpowers/specs/2026-10-07-vnxsi-open-templates-design.md) remains the product authority.
