import { describe, expect, it } from "vitest";
import { clientBoardActions, PUBLICATION_STATUSES } from "../../src/domain/request-board.ts";
import { REQUEST_STATUSES } from "../../src/domain/request.ts";

/** VNX-2703b: the one rule for what a client may do with the board on /me/requests/:id (addendum 4.3, 7.1, Q2, Q5, Q6). */
describe("clientBoardActions", () => {
  it("offers opt-in only on an open request, with the gate on, and only when there is no publication yet", () => {
    expect(clientBoardActions(null, "submitted", true)).toEqual(["opt_in"]);
    expect(clientBoardActions(null, "matching", true)).toEqual(["opt_in"]);
    expect(clientBoardActions(null, "submitted", false)).toEqual([]);
    for (const s of REQUEST_STATUSES.filter((x) => x !== "submitted" && x !== "matching")) expect(clientBoardActions(null, s, true), s).toEqual([]);
  });

  it("offers opt-in again after a withdrawal only on an open request with the gate on; rejected and unpublished are final", () => {
    expect(clientBoardActions("withdrawn", "submitted", true)).toEqual(["re_opt_in"]);
    expect(clientBoardActions("withdrawn", "matching", true)).toEqual(["re_opt_in"]);
    expect(clientBoardActions("withdrawn", "submitted", false)).toEqual([]);
    expect(clientBoardActions("withdrawn", "closed", true)).toEqual([]);
    for (const s of REQUEST_STATUSES) {
      expect(clientBoardActions("rejected", s, true), `rejected/${s}`).toEqual([]);
      expect(clientBoardActions("unpublished", s, true), `unpublished/${s}`).toEqual([]);
    }
  });

  it("offers withdraw for pending_review and published in every request status and with the gate off", () => {
    for (const p of PUBLICATION_STATUSES.filter((x) => x === "pending_review" || x === "published")) {
      for (const s of REQUEST_STATUSES) for (const gate of [true, false]) expect(clientBoardActions(p, s, gate), `${p}/${s}/${gate}`).toEqual(["withdraw"]);
    }
  });
});
