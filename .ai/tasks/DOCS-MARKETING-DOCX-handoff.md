# DOCS-MARKETING-DOCX Handoff

## Approved scope

Create `docs/MARKETING.docx`, a polished professional English marketing brochure for VNX.SI based on `docs/MARKETING.md` and `docs/legal/media-kit.md`. Use the supplied brand assets and a bespoke editorial layout with substantive illustrations throughout. Keep the current product scope and factual claims; do not invent products, customers, metrics, testimonials, or partner logos.

Target six A4 portrait pages (five to seven acceptable if the content flow requires it), with an opening brand and marketplace hero, illustrated Buy / Customize / Hire / Build Similar paths, a discovery-to-conversation journey, builder value, evidence-based trust badges, a clearly marked future roadmap, and a concise contact CTA. Use the media-kit palette: ink `#0D1526`, accent blue `#1D4ED8`, background `#F4F5F7`. Use Space Grotesk for headings when available and Be Vietnam Pro or a compatible clean sans serif for body text. Keep title and heading text black per document skill guidance.

## Source material read

- `docs/MARKETING.md` — source of current English marketing meaning and scope.
- `docs/legal/media-kit.md` — approved audience, factual brand rules, palette, typography, logo usage, and contact.
- `apps/web/public/assets/brand/vnxsi-mark.svg`, `vnxsi-mark-dark.svg`, `vnxsi-icon.svg` — approved brand assets.
- `.ai/context/CURRENT-STATUS.md` — project status and current scope.
- `C:/Users/User/.codex/plugins/cache/openai-primary-runtime/documents/26.904.11930/skills/documents/SKILL.md` and linked create, verify, figures, and accessibility guidance.

## Planned deliverables

- `docs/MARKETING.docx` — final user-facing DOCX.
- `docs/marketing/build_marketing_docx.py` — reproducible authoring script using bundled Python and `python-docx`.
- `docs/marketing/assets/` — task-local reusable vector/raster assets generated for this brochure.
- `.ai/tasks/DOCS-MARKETING-DOCX-report.md` — implementation and verification report.

## Runtime and QA constraints

The workspace runtime is `C:/Users/User/.cache/codex-runtimes/codex-primary-runtime`; its bundled Python is `dependencies/python/python.exe` and includes `python-docx` 1.2.0. The runtime manifest reports `libreOfficeVersion: null`, and no `load_workspace_dependencies` tool is exposed in this session. Do not use the user desktop LibreOffice. Attempt the packaged `render_docx.py` with the supported runtime and document any renderer limitation. Keep QA PNG/PDF intermediates under a task-local temporary directory. Run image/a11y audits, inspect every rendered page, and run `npm run typecheck -w apps/web` plus `npm test` once sequentially as required by `AGENTS.md`.

## Design decisions

- Use inline PNG illustrations generated from editable SVG sources for stable Word and LibreOffice placement; set meaningful alt text in OOXML.
- Use white space, typography, and blue linework as the visual system; avoid unsupported claims and decorative stock imagery.
- Preserve body content as editable Word text. Keep diagrams and conceptual cards labeled when they are illustrative.
- Run `mark_artifact_operation_started.mjs --operation-kind create --expected-output-count 1 --output-format docx` exactly once immediately before the first DOCX authoring command.
