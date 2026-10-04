/** randomToken(16) → 22 base64url characters. */
export const INVITE_CODE_RE = /^[A-Za-z0-9_-]{22}$/;

export interface Invite {
  codeHash: string;
  createdBy: string;
  maxUses: number;
  uses: number;
  expiresAt: string;
  note: string | null;
  createdAt: string;
}

export type InviteState = "active" | "expired" | "used_up";

export function inviteState(invite: Pick<Invite, "uses" | "maxUses" | "expiresAt">, now: Date): InviteState {
  if (invite.uses >= invite.maxUses) return "used_up";
  if (invite.expiresAt <= now.toISOString()) return "expired";
  return "active";
}
