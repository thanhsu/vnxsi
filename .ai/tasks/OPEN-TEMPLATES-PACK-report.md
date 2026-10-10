# OPEN-TEMPLATES-PACK — report

Date: 2026-10-07

Status: generated draft artifacts; no publication, deployment, commit, or push.

## Scope completed

Generated only the two coordinator-authorized aggregate artifacts:

- `content/open-templates/catalogue.json`
- `content/open-templates/packs/open-templates-starter.md`

The index and pack use the current source directories only:

- 10 `prompts-chat` entries;
- 10 `fabric-everyday` entries;
- 5 `fabric-developer` entries.

Archived or stale self-authored directories are not counted or included.

## Catalogue decisions

`catalogue.json` is a JSON array of 25 records sorted by `template_key`. Each record includes the standard draft metadata plus `source_collection`, `source_repository`, `source_commit`, `source_path`, `source_item`, `source_url`, `upstream_license`, `source_license_evidence`, and `adaptation_summary`.

`source_commit` is normalized from the source front matter's `source_commit` field, or from `source_revision` when that is the upstream field. Every indexed value is a full 40-hexadecimal SHA. Draft fields remain `status: draft`, `license: null`, `reviewed_at: null`, and `tested_tools: []`.

## Pack contract

The portable pack has a fixed `2026-10-07` snapshot header stating that it contains 25 English-first draft entries, with a 20 everyday/professional and 5 developer mix, and that no model/tool trials are recorded. It contains conditional `Publish` and `Deploy` sections, no runtime or compatibility claim, no affiliate/tracking tag, and a relative reference to `../notices/prompts-chat-license-snapshot.md`.

The 25 source entries are sorted by `template_key` and included with their source front matter, body, and provenance metadata. The untouched content of `content/open-templates/notices/fabric-MIT.txt` is appended at the end after a pack heading. The pack is an internal review artifact; it does not publish entries or deploy a route.

## Verification

The final aggregate validation passed with these checks:

- catalogue count is 25 and keys are unique and sorted;
- source collection counts are 10, 10, and 5;
- every source commit is a full 40-hexadecimal SHA;
- required provenance fields are present for every record;
- every source file has the required template sections;
- pack entry count is 25 and its template-key order matches the catalogue;
- every normalized source file is present exactly in the pack;
- the relative prompts.chat licence snapshot path is present;
- no affiliate/tracking tags are present;
- the normalized Fabric MIT notice is the exact pack suffix.

Product typecheck, application tests, model/tool trials, and deployment were not run because this was a deterministic documentation/content aggregation task.
