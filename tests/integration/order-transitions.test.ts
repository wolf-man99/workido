import { describe, expect, it } from "vitest";
import { ORDER_TRANSITIONS } from "@/lib/domain/orders/state-machine";
import { service } from "../support/supabase";

/**
 * The order state machine exists twice: in TypeScript (UI + unit tests) and
 * in the database (enforcement). This test fails if they ever drift.
 */
describe("order transition parity", () => {
  it("matches the database transition table exactly", async () => {
    const { data, error } = await service.from("order_transitions").select("from_status, action, actor, to_status");
    expect(error).toBeNull();
    const db = (data ?? []).map((t) => `${t.from_status}|${t.action}|${t.actor}|${t.to_status}`).sort();
    const ts = ORDER_TRANSITIONS.map((t) => `${t.from}|${t.action}|${t.actor}|${t.to}`).sort();
    expect(db).toEqual(ts);
  });
});
