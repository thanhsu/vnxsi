import { createBuilder, setBuilderStatus } from "../src/db/builders.ts";
import { createUser, findUserByEmail, type UserRow } from "../src/db/users.ts";
import type { Builder, BuilderProfile, BuilderStatus } from "../src/domain/builder.ts";
import { parseBuilderProfile, type BuilderFormValues } from "../src/domain/builder-input.ts";
import { testEnv } from "./helpers.ts";

export function profileValues(overrides: Partial<BuilderFormValues> = {}): BuilderFormValues {
  return {
    handle: "lan-dev",
    name: "Lan Nguyen",
    kind: "individual",
    headline: "I build booking apps with AI",
    bio: "Ten years of web work.\n\n- Booking\n- CRM",
    country: "VN",
    websiteUrl: "https://lan.dev",
    skills: "Next.js, Supabase",
    aiTools: "Claude Code",
    workLanguages: ["en", "vi"],
    availability: "open",
    hourlyRate: "45",
    ...overrides,
  };
}

export function profileOf(overrides: Partial<BuilderFormValues> = {}): BuilderProfile {
  const result = parseBuilderProfile(profileValues(overrides));
  if (!result.ok) throw new Error(`invalid fixture: ${JSON.stringify(result.errors)}`);
  return result.profile;
}

export async function ensureUser(email: string, locale = "en"): Promise<UserRow> {
  return (await findUserByEmail(testEnv.DB, email)) ?? (await createUser(testEnv.DB, { email, locale, now: new Date().toISOString() }));
}

/** Creates a builder (no invite) and moves it to `status` directly in the DB. */
export async function makeBuilder(email: string, handle: string, status: BuilderStatus = "pending", overrides: Partial<BuilderFormValues> = {}): Promise<Builder> {
  const user = await ensureUser(email);
  const now = new Date().toISOString();
  const created = await createBuilder(testEnv.DB, { userId: user.id, profile: profileOf({ handle, ...overrides }), inviteCodeHash: null, now });
  if (!created.ok) throw new Error(created.reason);
  if (status === "pending") return created.builder;
  const moved = await setBuilderStatus(testEnv.DB, { userId: user.id, from: "pending", to: status, reviewNote: status === "rejected" ? "Add a portfolio" : null, now });
  if (!moved) throw new Error("status change failed");
  return moved;
}
