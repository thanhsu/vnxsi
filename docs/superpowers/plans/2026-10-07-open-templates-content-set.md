# Open Templates source-curated content set

**Status:** Approved source-review and adaptation preparation. The prior self-authored drafts are archived outside the catalogue; implementation, publication, licence acceptance, affiliate activation, and external-repository creation remain out of scope.

**Authority:** `docs/superpowers/specs/2026-10-07-vnxsi-open-templates-design.md`, the global execution plan, and the internal source audit. Upstream licences and selected revisions take precedence over any local recommendation.

## Objective

Prepare a source-reviewed Open Templates set with a target of 25 useful entries: 10 adapted from `prompts.chat`, 10 adapted from Fabric everyday patterns, and five adapted from Fabric developer patterns. This is a target, not a quota: if source quality, rights evidence, safety review, or adaptation value is insufficient, report the shortfall and do not fill it with invented material.

The new source-based directories are:

- `content/open-templates/prompts-chat/`
- `content/open-templates/fabric-everyday/`
- `content/open-templates/fabric-developer/`

The previous `professional/`, `sme/`, `research/`, and `developer/` drafts were moved to `D:\DOCS\SUPHAM\GIT\vnxsi-open-templates-scratch-20261007\content\open-templates\`. They are reference material only and must not be counted, published, packed, or copied as if source-reviewed.

## Source-review contract

Each adapted entry records its upstream collection, source path/permalink, `source_commit` as a full pinned upstream SHA, `upstream_license` as the verified source-specific term (for example CC0 or MIT), licence evidence, attribution needs, and a concise adaptation summary. A source audit records the exact evidence and any unresolved rights question. Do not claim a blanket licence for mixed upstream material. The proposed CC BY 4.0 recommendation applies only to original VNX editorial additions after explicit Owner acceptance and never overrides an upstream term.

The source writers own the source-based directories. They must preserve useful intent while rewriting examples, safety boundaries, and output checks for VNX users. No upstream prompt is copied into the portable pack without a rights and adaptation record. Do not add near-duplicate newsletter or summary tasks: similar entries must have clearly different inputs, outputs, and user decisions. No source URL, affiliate tag, commission, or ranking signal is embedded in an entry or exported pack.

## Entry contract

Every candidate uses the approved front matter and required body sections from the companion spec. In addition, source-derived records should carry `source_collection`, `source_path`, `source_commit` (full pinned upstream SHA), `upstream_license`, `source_license_evidence`, `source_permalink`, and `adaptation_summary` metadata or an equivalent generated provenance record. `license: null` remains the draft value for pending VNX editorial additions. `source_revision` remains generated release metadata for the VNX source snapshot.

Examples are synthetic or rights-cleared and clearly labelled. Each draft states missing-input behavior, treats pasted material as data rather than instructions, asks users to review external actions, and avoids secrets, unnecessary PII, URL fetching, hosted execution, and high-stakes automation. Publication requires a recorded real model/tool trial with normal and missing/ambiguous cases and an output-check rubric; draft source review is not that trial.

## Conditional publish and deploy guidance

Recommendations depend on the output type and remain editorial, portable, and neutral; the rationale matrix is recorded in `content/open-templates/DELIVERY-MATRIX.md`:

- Private notes, a local file, or an internal tool output: no publish or deploy recommendation by default.
- Public text or a document export: editorial publishing may be suggested only after rights, review, audience, and removal ownership are clear.
- A static documentation page or site: Cloudflare Pages is a nonaffiliate candidate; GitHub Pages is an eligible nonaffiliate alternative after its usage constraints are checked. These are options, not guarantees or paid rankings.
- An audio or video script: ElevenLabs text-to-speech may be an optional production step when voice output is genuinely relevant. It is not a distribution or hosting recommendation and must not be attached to unrelated templates.

Public official documentation links or registered `/go` destinations require the ADR-007 path. The current ElevenLabs registry record has draft terms missing; no affiliate URL or monetized CTA may be activated or published until the backend configuration and terms are active. Exported packs and upstream prompts never contain affiliate tags.

## Coordination deliverables and gates

This branch coordinates `README.md`, `SOURCE-AUDIT.md`, `LICENSE-NOTICES.md`, the eventual exact catalogue index at `content/open-templates/catalogue.json`, the deterministic pack at `content/open-templates/packs/open-templates-starter.md`, and the task report. The index and pack remain deferred until source writers finish and the root agent confirms the accepted inventory.

Before review, validate unique keys/slugs, source provenance, source-specific licence evidence, adaptation notes, required sections, synthetic examples, safe missing-input behavior, Markdown fences, deterministic pack order, relative links, and `git diff --check`. Do not run or claim product tests for this content-only task. Do not modify application code, routes, locale files, migrations, analytics, `CURRENT-STATUS.md`, or external repositories.

Open decisions include source-specific licence snapshots, the final inventory if the 25 target is reduced, Owner acceptance of any licence for original editorial text, the public repository, and whether any output-type recommendation should be surfaced at all. All remain pending until explicitly accepted.
