# Open Templates Fabric developer source review

## Review scope

This report covers the five draft developer entries in `content/open-templates/fabric-developer/`. It records the upstream source, pinned revision, licence evidence, adaptations, and publication/deployment risks. It does not grant a licence, publish a template, create an external repository, add product code, or claim a model/client trial.

## Upstream pin and licence evidence

- Repository: `danielmiessler/Fabric`
- Branch checked: `main`
- Pin obtained with `git ls-remote https://github.com/danielmiessler/Fabric.git HEAD` on 2026-10-07: `c11e9b6cc065b5a2fad66c85ebbaa89ce9e99d38`
- Local source check: shallow filtered clone detached at the same full SHA; `git rev-parse HEAD` matched the remote result.
- Commit subject: `chore(release): Update version to v1.4.515`
- Commit timestamp: `2026-10-05T22:48:18Z`
- Licence file: `LICENSE` at the pinned commit states the MIT License and requires the copyright and permission notices in copies or substantial portions.
- VNX.SI entry licence fields remain `license: null`. The upstream MIT notice is provenance, not a blanket CC BY grant for the adapted entries. The sibling writer owns the preserved `fabric-MIT.txt` notice.

The coordinator/root must confirm that the SME writer uses this same Fabric SHA before any shared commit or merge. A different pin would require regenerating the provenance fields and this report.

## Source-to-entry map

All source links below are immutable GitHub permalinks to the same full SHA. The source item names are the upstream pattern directories; the entries are original adaptations and do not copy the upstream files wholesale.

| Draft entry | Upstream source path | Source structure used | Adaptation boundary |
|---|---|---|---|
| `ot-explain-code` | `data/patterns/explain_code/system.md` | Branches for code, configuration, supplied security output, and a direct question; sectioned explanation output. | Kept explanation branches and evidence-led answers. Removed persona claims and unsupported security certainty; added input redaction, no execution/fetching, uncertainty labels, and delivery classification. |
| `ot-review-code` | `data/patterns/review_code/system.md` | Context first; correctness, security, performance, maintainability, error handling, edge cases; prioritized findings and detailed feedback. | Kept review dimensions and finding structure. Removed copied example material, exploit execution, persona claims, and automatic approval language; added evidence/confidence, safe fixes, test boundaries, and human decision gates. |
| `ot-plan-code-change` | `data/patterns/create_coding_feature/system.md` | Project snapshot, change instructions, file-impact output, and validation workflow. | Kept snapshot-to-change planning. Removed direct file-management payloads, deletion/overwrite behavior, command execution, path operations, and auto-apply assumptions; added a review-only implementation plan and pending checks. |
| `ot-write-technical-design` | `data/patterns/create_design_document/system.md` | Business/security posture, design, risk assessment, and questions/assumptions. | Kept posture, architecture, risk, and assumption sections. Removed artificial reasoning-time instructions, mandatory diagrams, unsupported expert authority, and deployment claims; added evidence labels, trust-boundary limits, and neutral alternatives. |
| `ot-write-pull-request-description` | `data/patterns/write_pull-request/system.md` | Summary, files, code changes, reason, impact, test plan, and notes from a supplied diff. | Kept the reviewer-oriented description structure. Removed copied diff examples, repository inspection, posting/merge assumptions, and invented test claims; added redaction, literal validation status, risk visibility, and private-review delivery. |

## Source links

- [explain_code source](https://github.com/danielmiessler/Fabric/blob/c11e9b6cc065b5a2fad66c85ebbaa89ce9e99d38/data/patterns/explain_code/system.md)
- [review_code source](https://github.com/danielmiessler/Fabric/blob/c11e9b6cc065b5a2fad66c85ebbaa89ce9e99d38/data/patterns/review_code/system.md)
- [create_coding_feature source](https://github.com/danielmiessler/Fabric/blob/c11e9b6cc065b5a2fad66c85ebbaa89ce9e99d38/data/patterns/create_coding_feature/system.md)
- [create_design_document source](https://github.com/danielmiessler/Fabric/blob/c11e9b6cc065b5a2fad66c85ebbaa89ce9e99d38/data/patterns/create_design_document/system.md)
- [write_pull-request source](https://github.com/danielmiessler/Fabric/blob/c11e9b6cc065b5a2fad66c85ebbaa89ce9e99d38/data/patterns/write_pull-request/system.md)

These links are internal provenance for review. They are not instructions for the runtime catalogue to fetch upstream content. A future public website must route any external editorial link through the approved `/go/` treatment before rendering.

## Conditional nonaffiliate candidates

The following official documentation pages were checked on 2026-10-07 only to bound optional delivery recommendations. They are internal provenance, not live template instructions or an authorization to deploy:

- [Cloudflare Pages static HTML guide](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/) supports a static HTML delivery path. It is a neutral candidate for a static documentation/site output; this review makes no pricing, limit, or suitability claim.
- [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) describes repository-backed website hosting. It is a neutral alternative for documentation output; this review makes no plan, usage, or availability claim beyond the official page.
- [ElevenLabs text-to-speech documentation](https://elevenlabs.io/docs/overview/capabilities/text-to-speech) is relevant only to an audio or video script workflow. It is not a host or distribution recommendation. The affiliate registry's ElevenLabs terms remain draft and unverified, so no affiliate CTA or tag is present.

The entries do not recommend a provider from memory. Any future user-visible external link requires the approved `/go/` registration; web hosts are not affiliate targets, and affiliate status must come from an active database program rather than template metadata or ordering.

## Safety and adaptation findings

The upstream patterns are useful as structural references, but several source instructions are unsafe or too broad for an account-free public catalogue. The draft adaptations apply these fixes:

- Pasted code, comments, diff text, logs, configuration, and issue text are treated as data; embedded instructions are ignored.
- No draft asks for URL fetching, browsing, command execution, exploit execution, repository mutation, dependency installation, file deletion, commits, pushes, approvals, or deployment.
- Inputs require redaction of secrets and unnecessary PII. Outputs do not repeat sensitive material.
- Missing context produces focused questions or an explicit evidence gap. The drafts do not turn absent evidence into a false claim or a passing test.
- Security concerns are framed as observations, inferences, or questions with confidence; no draft promises that code is safe or secure.
- Illustrative examples are synthetic and labelled as not observed. They are not upstream examples and are not trial evidence.
- Review, design, planning, and pull-request outputs are human work products. Code or infrastructure suggestions are separate from deployment.

## Publish / Deploy policy check

Every entry has a `Publish / Deploy` section. The conditional rule is:

- Explanation, review, design, plan, and pull-request outputs are documentation or review artifacts, not deployable applications. They may be exported to a private repository, pull request, or internal document after a human checks them.
- Any code or infrastructure proposed by an artifact needs the owning project's tests, build, security review, and deployment approval. The templates do not perform those steps.
- External recommendations are allowed only when official links are already supplied and verified in the internal provenance context. No entry invents provider documentation, pricing, limits, or compatibility claims.
- VNX.SI site rendering must use registered `/go/` destinations for external links. The source permalinks above are review evidence, not runtime fetch targets.
- Recommendations remain neutral and non-affiliate by default. Do not add affiliate tags to hosts or providers, and do not infer a partner program from a name.
- The affiliate registry's ElevenLabs terms remain draft and unverified; these entries do not reference them. A future affiliate resolver must use active database programs and must not derive ordering or affiliate status from template metadata.

## Validation and unresolved risks

The five entries are draft content only. Structural checks should confirm front matter, full source SHA, source paths, required sections, fenced prompts, named placeholders, synthetic labels, validation fixtures, absence of executable instructions, and whitespace. A later reviewer should additionally check that each adaptation remains materially distinct from the upstream text and that the MIT notice is shipped through the sibling-owned notice file before any public release.

Unresolved gates:

1. Root/coordinator confirmation that the SME writer uses `c11e9b6cc065b5a2fad66c85ebbaa89ce9e99d38`.
2. Owner decision on the VNX.SI content licence; these entries remain `draft` with `license: null`.
3. A real model/tool trial for any future publication; `tested_tools: []` records that none has occurred.
4. The future website's `/go/` registration and external-link policy before any source or documentation link is rendered publicly.
5. No product tests were run because this task adds documentation/content only; application code and dependencies were untouched.
