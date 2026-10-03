import type { Availability, BuilderKind, WorkLanguage } from "../domain/builder.ts";
import type { MessageKey } from "../i18n/messages/en.ts";

export const KIND_KEY: Record<BuilderKind, MessageKey> = {
  individual: "builder.kind.individual",
  team: "builder.kind.team",
  company: "builder.kind.company",
};

export const AVAILABILITY_KEY: Record<Availability, MessageKey> = {
  open: "builder.availability.open",
  limited: "builder.availability.limited",
  closed: "builder.availability.closed",
};

export const LANGUAGE_KEY: Record<WorkLanguage, MessageKey> = {
  en: "builder.lang.en",
  vi: "builder.lang.vi",
  zh: "builder.lang.zh",
};
