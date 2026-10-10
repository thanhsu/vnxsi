# OPEN-TEMPLATES-SET — source-curation handoff

## Authorization

Owner/user instruction on 2026-10-07 authorizes a source-first review and adaptation of an Open Templates set. The target is 25 candidates: 10 from `prompts.chat`, 10 from Fabric everyday patterns, and five from Fabric developer patterns. This is preparation only. It does not authorize product code, publication, licence acceptance, affiliate activation, public-repository creation, external links in the app, or deployment.

The target is not a quota. A source-based entry must be omitted when its quality, rights evidence, safety, or adaptation value is insufficient. Do not replace a shortfall with self-authored filler.

## Branch and archived drafts

- Branch: `content/open-templates-set`
- Worktree: `D:\DOCS\SUPHAM\GIT\vnxsi-open-templates-set`
- Base: merged `main` at `c169530`
- Prior self-authored directories were moved out of the catalogue to `D:\DOCS\SUPHAM\GIT\vnxsi-open-templates-scratch-20261007\content\open-templates\{professional,sme,research,developer}`.
- Archived drafts must not be counted, distributed, packed, or treated as source-reviewed entries.
- Preserve the root M7 checkout, merged-main worktree, scratch archive, and all other worktrees.

## Source ownership

Source writers deliver only these new directories:

| Directory | Target | Source basis |
|---|---:|---|
| `content/open-templates/prompts-chat/` | 10 | `f/prompts.chat` at `7d3f248962d1dca209d59e033524bcb86c2b26b8`; prompt/data mapping CC0-1.0, with source/code MIT scope checked per file. |
| `content/open-templates/fabric-everyday/` | 10 | `danielmiessler/Fabric` at `c11e9b6cc065b5a2fad66c85ebbaa89ce9e99d38`; selected `data/patterns` files, upstream MIT notice. |
| `content/open-templates/fabric-developer/` | 5 | `danielmiessler/Fabric` at `c11e9b6cc065b5a2fad66c85ebbaa89ce9e99d38`; selected developer pattern files, upstream MIT notice. |

No writer should recreate the archived `professional/`, `sme/`, `research/`, or `developer/` catalogue directories. Each entry must retain source provenance, a full pinned `source_commit`, verified `upstream_license`, source-specific licence evidence, attribution requirements, and a concise adaptation summary. `license: null` remains the draft value for pending VNX editorial additions; `source_revision` is reserved for generated VNX release metadata. The internal `SOURCE-AUDIT.md` is the coordination record; its evidence is not a public app outbound-link exception.

## Coordination ownership

This branch owns the source-curation README, source audit, licence notices, exact catalogue index, deterministic portable pack, and `.ai/tasks/OPEN-TEMPLATES-SET-report.md`. Root has confirmed that all three source writers are done and the accepted draft inventory is available, so the coordinator may generate the index and pack for review. The index must count only source-reviewed candidates; the pack must contain only accepted entries and must exclude affiliate tags, commission data, and ranking signals.

## Rights and licence boundary

The upstream source term controls each adapted entry. Do not assume that a repository-level licence applies to every prompt or pattern without evidence. CC BY 4.0 is only a proposed licence for original VNX editorial additions, pending explicit Owner acceptance; it is not a blanket licence for upstream-derived text. The separate `LICENSE-NOTICES.md` records this boundary and unresolved snapshots.

## Conditional publish/deploy recommendations

An entry may describe a possible next step only when its output type warrants it and the recommendation is neutral:

- Private notes, a local file, or internal tool output: no publish/deploy recommendation.
- Public text/document export: optional editorial publishing after rights and review.
- Static documentation/site: Cloudflare Pages as a nonaffiliate candidate, with GitHub Pages as an eligible nonaffiliate alternative after usage constraints are checked.
- Audio/video script: optional ElevenLabs text-to-speech production only when relevant; it is not hosting or distribution.

Do not embed affiliate URLs or tags in source metadata, templates, upstream prompts, or packs. Public official documentation links or registered `/go` mappings require the ADR-007 path. Provider rationale and output-type distinctions live in `content/open-templates/DELIVERY-MATRIX.md`; recommendations remain separate from monetization resolution. Avoid near-duplicate newsletter or summary entries unless their inputs, outputs, and decisions are materially distinct. ElevenLabs remains a draft registry record with missing terms; no affiliate CTA or URL is active until backend configuration is active.

## Review and reporting

Require synthetic or rights-cleared examples, explicit missing-input questions, pasted-data-as-data boundaries, user review before external actions, no URL fetching, no secrets/PII, and no fabricated compatibility or trial claims. Later publication requires the companion spec’s real model/tool trial and output-check rubric. Report source checks, link checks, `git diff --check`, unresolved rights, and inventory shortfall. Product typecheck/test commands are not required and must be recorded as not run.

No commit, merge, push, deployment, external repository creation, route work, locale work, or MCP work is authorized by this handoff.
