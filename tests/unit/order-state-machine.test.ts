import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  TERMINAL_STATUSES,
  availableActions,
  canRequestRevision,
  canTransition,
  nextStatus,
  revisionsRemaining,
  type OrderAction,
  type OrderActor,
} from "@/lib/domain/orders/state-machine";

describe("order state machine", () => {
  it("follows the happy path for a predefined gig", () => {
    let status = nextStatus("pending_payment", "mark_paid", "system");
    expect(status).toBe("paid");
    status = nextStatus(status!, "accept", "specialist");
    expect(status).toBe("in_progress");
    status = nextStatus(status!, "submit", "specialist");
    expect(status).toBe("submitted");
    status = nextStatus(status!, "request_revision", "buyer");
    expect(status).toBe("revision_requested");
    status = nextStatus(status!, "submit", "specialist");
    expect(status).toBe("submitted");
    status = nextStatus(status!, "approve", "buyer");
    expect(status).toBe("completed");
  });

  it("only lets the system mark an order paid", () => {
    expect(canTransition("pending_payment", "mark_paid", "buyer")).toBe(false);
    expect(canTransition("pending_payment", "mark_paid", "specialist")).toBe(false);
    expect(canTransition("pending_payment", "mark_paid", "admin")).toBe(false);
    expect(canTransition("pending_payment", "mark_paid", "system")).toBe(true);
  });

  it("does not let work start before payment", () => {
    expect(canTransition("pending_payment", "accept", "specialist")).toBe(false);
    expect(canTransition("pending_payment", "submit", "specialist")).toBe(false);
  });

  it("only lets the buyer approve or request revisions", () => {
    expect(canTransition("submitted", "approve", "specialist")).toBe(false);
    expect(canTransition("submitted", "request_revision", "specialist")).toBe(false);
    expect(canTransition("submitted", "approve", "buyer")).toBe(true);
  });

  it("refunds instead of silently cancelling once paid", () => {
    expect(nextStatus("paid", "cancel", "buyer")).toBe("refund_pending");
    expect(nextStatus("paid", "decline", "specialist")).toBe("refund_pending");
    expect(canTransition("in_progress", "cancel", "buyer")).toBe(false);
  });

  it("allows nothing user-driven from terminal states", () => {
    const actors: OrderActor[] = ["buyer", "specialist", "admin"];
    for (const status of TERMINAL_STATUSES) {
      for (const actor of actors) {
        expect(availableActions(status, actor)).toEqual([]);
      }
    }
  });

  it("resolves disputes only by admins", () => {
    expect(availableActions("disputed", "buyer")).toEqual([]);
    expect(availableActions("disputed", "specialist")).toEqual([]);
    expect(availableActions("disputed", "admin").sort()).toEqual(["resolve_complete", "resolve_refund", "resolve_resume"]);
  });

  it("rejects arbitrary transitions", () => {
    const actions: OrderAction[] = ["approve", "submit", "accept", "mark_refunded"];
    expect(actions.some((action) => canTransition("completed", action, "buyer"))).toBe(false);
    expect(nextStatus("cancelled", "approve", "buyer")).toBeNull();
  });

  it("has no duplicate (from, action, actor) definitions", () => {
    const keys = ORDER_TRANSITIONS.map((t) => `${t.from}|${t.action}|${t.actor}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only references known statuses", () => {
    for (const t of ORDER_TRANSITIONS) {
      expect(ORDER_STATUSES).toContain(t.from);
      expect(ORDER_STATUSES).toContain(t.to);
    }
  });
});

describe("revision policy", () => {
  it("limits revisions to the agreed number", () => {
    expect(revisionsRemaining({ revisionsIncluded: 2, revisionsUsed: 0 })).toBe(2);
    expect(revisionsRemaining({ revisionsIncluded: 2, revisionsUsed: 2 })).toBe(0);
    expect(canRequestRevision("submitted", { revisionsIncluded: 1, revisionsUsed: 0 })).toBe(true);
    expect(canRequestRevision("submitted", { revisionsIncluded: 1, revisionsUsed: 1 })).toBe(false);
    expect(canRequestRevision("submitted", { revisionsIncluded: 0, revisionsUsed: 0 })).toBe(false);
    expect(canRequestRevision("in_progress", { revisionsIncluded: 3, revisionsUsed: 0 })).toBe(false);
  });
});
