# DOCS-MARKETING-DOCX Report

## Result

Created `docs/MARKETING.docx`, a six-page A4 portrait English marketing brochure for VNX.SI. The brochure contains editable Word text, the approved VNX.SI connected-nodes logo, six substantive conceptual illustrations, a discovery and conversation journey, builder positioning, evidence-based trust badges, organic-ranking and partner separation language, the current product scope, a staged roadmap, and contact links.

## Files changed

- `docs/MARKETING.docx`
- `docs/marketing/build_marketing_docx.py`
- `docs/marketing/render_word_fallback.ps1`
- `docs/marketing/assets/hero.svg`, `routes.svg`, `journey.svg`, `builder.svg`, `trust.svg`, `roadmap.svg`
- `docs/marketing/assets/hero.png`, `routes.png`, `journey.png`, `builder.png`, `trust.png`, `roadmap.png`, `vnxsi-mark.svg`, `vnxsi-mark.png`
- `docs/marketing/qa/.gitignore`
- `.ai/tasks/DOCS-MARKETING-DOCX-handoff.md`

The source `docs/MARKETING.md` was preserved. No application source, locale, or test files were changed.

## Authoring and runtime

- Workspace Python runtime: `C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`
- `python-docx` version: `1.2.0`
- Workspace Node runtime used for the artifact marker: `C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`
- `mark_artifact_operation_started.mjs --operation-kind create --expected-output-count 1 --output-format docx` ran successfully exactly once before DOCX authoring.
- The workspace runtime manifest reports `libreOfficeVersion: null`, and the packaged `render_docx.py` attempt stopped with `FileNotFoundError: LibreOffice soffice.exe was not found on PATH`. The user desktop LibreOffice was not used.
- Isolated rendering fallback: Microsoft Word automation at `C:/Program Files/Microsoft Office/Root/Office16/WINWORD.EXE`, driven by `docs/marketing/render_word_fallback.ps1`; rasterization used the bundled Poppler `C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe`.

## Verification

- Final render PDF: `docs/marketing/qa/word-fallback-final2/MARKETING.pdf`
- Final render PNGs: `docs/marketing/qa/word-fallback-final2/page-1.png` through `page-6.png`
- Rendered page count: 6
- Page size: A4 (`595.44 x 841.68 pt`)
- All six final page PNGs were opened and visually inspected at full resolution. No clipping, overlap, broken tables, missing glyphs, or footer placement defects were found.
- Image audit: 7 inline images (1 approved logo plus 6 substantive illustrations); all are inline placements.
- Accessibility audit: `high: 0`, `medium: 0`, `low: 0`; all images have meaningful alt text and table header rows are marked.
- `npm run typecheck -w apps/web`: passed, exit code 0. Wrangler generated worker types; it emitted the existing informational prompt to install `@types/node` for Node compatibility.
- `npm test`: passed, exit code 0; 134 test files and 1,458 tests passed.

## Decisions and limitations

- Illustrations are generated from task-local editable SVG companions and rendered to high-resolution PNGs for reliable inline Word placement.
- The approved brand palette and logo are used. The authoring script retains Space Grotesk and Be Vietnam Pro as the brand design references, but the DOCX emits installed `Segoe UI` as an Office-safe fallback because those fonts are not installed in the current Windows runtime; this avoids serif substitution in the final render.
- The brochure clearly labels conceptual illustrations and distinguishes the current product scope from roadmap directions. No invented customers, metrics, testimonials, products, or partner logos were added.

## Open questions

None. The document is ready for review as `docs/MARKETING.docx`.

## Ghi nhận

- The packaged LibreOffice renderer could not run in this Windows workspace because no bundled LibreOffice binary is provided. The isolated Word plus bundled Poppler fallback was used and documented above.
- QA intermediates stay under `docs/marketing/qa/` and are excluded by the task-local `.gitignore`.
