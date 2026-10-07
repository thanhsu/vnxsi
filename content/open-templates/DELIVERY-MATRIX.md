# Open Templates delivery matrix

**Status:** Editorial planning guidance. It does not publish, deploy, create external links, activate affiliates, or force a provider choice.

Recommendations are selected from the output type and the user's actual goal. They remain separate from monetization or partner resolution in VNX's existing registry/database. Template source metadata, prompts, catalogue records, and portable packs contain no affiliate URL, tag, commission value, paid ranking signal, or provider-only instruction.

| Output type | Default recommendation | Rationale | Candidate or boundary |
|---|---|---|---|
| Private notes, local files, internal tool output | No publish or deploy step | The output is useful inside the user's existing workflow; publication can expose private or sensitive material without adding value. | Keep local or use the user's approved internal system. |
| Public text or document export | Optional editorial publishing after rights and review | A reviewed public artifact can make a reusable result discoverable, but audience, attribution, removal ownership, and privacy must be known first. | VNX page or user-selected document channel; no automatic upload. |
| Static documentation or site | Conditional static hosting recommendation | A repository-built static artifact is a good fit when the user wants a public page without server execution. | Cloudflare Pages is a nonaffiliate candidate; GitHub Pages is an eligible nonaffiliate alternative after usage/commercial constraints are checked. Official docs stay in internal provenance until the ADR-007 `/go` decision. |
| Audio or video script | Optional voice-production step only when relevant | Text-to-speech adds value when the intended output is a narrated asset; it does not host, distribute, or publish the result. | ElevenLabs text-to-speech may be considered for a genuinely audio/video-oriented script. Do not attach it to unrelated notes, summaries, or developer workflows. |

## Provider and affiliate boundary

Cloudflare Pages is recommended only as a neutral static-hosting candidate because it fits pre-rendered site output. GitHub Pages is a nonaffiliate alternative, subject to checking its usage constraints before any commercial recommendation. ElevenLabs is a production tool for text-to-voice, not a distribution service; the registry records its terms as a draft with missing details, so this set emits no affiliate URL or CTA. Any runtime activation would require later backend configuration and validation.

Public official documentation links or registered `/go` destinations require ADR-007 treatment. Monetization resolution occurs outside the content source. The portable pack and any upstream-adapted prompt must remain portable when affiliate configuration is absent or disabled.

## Curation deduplication

Do not create near-identical newsletter or summary entries merely to fill a source target. A summary entry and a creation/follow-up entry may both be retained only when their inputs, output contract, and user decision are materially different and the source audit explains the distinction.
