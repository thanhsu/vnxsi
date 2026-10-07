# OPEN-TEMPLATES-DESIGN — Implementer report

## Status

Draft design spec completed. The product direction is approved; the written spec remains explicitly pending Owner approval. No product code, migration, external repository, MCP endpoint, deployment, or `CURRENT-STATUS.md` update was made.

## Files changed

- `docs/superpowers/specs/2026-10-07-vnxsi-open-templates-design.md`
- `.ai/tasks/OPEN-TEMPLATES-DESIGN-report.md`

The unrelated untracked `docs/VNXSI_EXECUTION_PLAN_APPROVED.md` was preserved and not staged.

## What the spec covers

- A 20–30 item pilot with an approximately 80/20 everyday-to-developer content mix.
- English template content with the existing four-locale UI contract and account-free browse, copy, and download flows.
- A Git-versioned structured Markdown source that generates pages, search, packs, adapters, and later MCP responses.
- A practical pinned-release model for a possible future public content repository without a runtime fetch dependency.
- A proposed read-only D1 exception for MVP content and an explicit ADR-007 decision point for external repository, licence, tool, and partner links.
- A portable Markdown pack, at most two verified adapters, and no unverified compatibility claims.
- MCP as Phase B: stateless Streamable HTTP, bounded `search_templates`/`get_template`, no sessions, execution, arbitrary URL fetches, or all-harness support promise.
- M7-compatible aggregate measurement, explicit denominator/cohort rules, and the limitation that daily rotating hashes cannot measure person-level 30-day retention.
- Suggested pilot signals, editorial budget assumption, launch acceptance criteria, deferred scope, open decisions, and risks.

## Verification

- Relative Markdown links: passed; all six related repository documents resolve.
- Spec length: 280 lines.
- Reserved-marker scan: passed; no unfinished-work markers remain in either assigned file.
- `git diff HEAD^ HEAD --check`: passed with no output after the commit.
- `npm run typecheck -w apps/web`: not run; documentation-only task.
- `npm test`: not run; documentation-only task.

## Decisions and open questions

- CC BY 4.0 is the recommendation for template content, pending Owner acceptance.
- The MVP source stays repository-controlled; a separate public repo is only an eventual distribution option and must use a pinned, reproducible release.
- External URLs must either use the controlled `/go/` path or wait for a narrowly scoped ADR-007 editorial-link decision.
- Tool-specific adapters and MCP client support remain gated on actual versioned QA.
- A voluntary panel or separately approved persistent measurement is needed before claiming 30-day retention.
- The remaining open decisions are listed in §13 of the spec.

## Ghi nhận

- No product implementation plan was created because the handoff authorized only a design draft and report.
- No code, tests, locale files, migrations, routes, legal text, or `CURRENT-STATUS.md` were changed.
- No compatibility test result, model output, usage number, or repository link was fabricated.

## Commit

The two assigned files are committed after the final staged diff check. The commit hash is reported in the parent handoff. No push or merge is performed.
