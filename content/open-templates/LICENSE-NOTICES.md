# Open Templates licence notices

**Status:** Upstream rights evidence collected for the 25 draft candidates. No VNX.SI licence is accepted, granted, or represented as final by this file. Publication, real trials, and public outbound-link decisions remain open.

## Source-specific rule

Every adapted entry inherits the obligations of its selected upstream source. A repository-level licence is not automatically proof that every prompt, pattern, example, or asset has the same terms. The source writer must record the exact full `source_commit`, selected path, `upstream_license`, licence evidence, attribution requirement, and adaptation boundary in `SOURCE-AUDIT.md` before the entry can be counted. The selected prompt/data rows use canonical `CC0-1.0`; the selected Fabric patterns use `MIT`. `source_revision` is reserved for the generated VNX release snapshot.

## Candidate collections

### `prompts-chat`

The selected source records `upstream_license: CC0-1.0` for prompt content/data when the selected file is covered by that mapping, or `upstream_license: MIT` for source code/site-authored content. The upstream repository states: **MIT License — Copyright (c) 2022-present Fatih Kadir Akin and contributors** for code/site-authored content; **CC0 1.0 Universal** for prompt content/data. If file scope is unclear, the repository says MIT applies by default. The checked prompt/data snapshot is [`notices/prompts-chat-license-snapshot.md`](notices/prompts-chat-license-snapshot.md). Preserve the applicable notice and verify the full `source_commit`; do not label an adapted entry CC BY or redistribute an upstream prompt until that evidence is attached.

### `fabric-everyday` and `fabric-developer`

The selected source records `upstream_license: MIT` after the exact paths and pinned commit were checked against the repository `LICENSE`. Preserve the upstream notice: **MIT License — Copyright (c) 2012-2024 Scott Chacon and others** from [`notices/fabric-MIT.txt`](notices/fabric-MIT.txt). Do not infer rights from a repository name alone.

## VNX editorial additions

CC BY 4.0 remains a proposed licence recommendation for original VNX editorial text only, pending explicit Owner acceptance. Until then, `license: null` is the correct VNX metadata value. It cannot override upstream terms and must not be applied to a mixed-source entry unless the rights record supports that scope. Synthetic examples should be original or rights-cleared; copied vendor prompts, secrets, private client data, and unnecessary PII are prohibited.

## Generated pack and public release

The draft catalogue index and review pack preserve required source attribution. A public catalogue or release must exclude entries with unresolved rights. Neither artifact may contain affiliate URLs, commission data, paid-ranking signals, hidden system instructions, or claims of source compatibility. Public repository creation and licence publication require separate authorization and a pinned release. All current entries remain `status: draft`, `license: null`, `reviewed_at: null`, and `tested_tools: []`; those fields are not evidence of a completed trial or accepted VNX licence.

## Unresolved decisions

- Any path-specific rights question not resolved by the two pinned upstream snapshots.
- Final attribution wording and notice placement in the public release, including Owner review of the mixed-source boundary.
- Owner acceptance or replacement of the CC BY 4.0 recommendation for original VNX additions.
- Public repository licence and release policy.
- One recorded real model/tool trial, including normal and missing/ambiguous-input cases, for each entry before publication.
- ADR-007 treatment for any public source, provider, or licence links.
