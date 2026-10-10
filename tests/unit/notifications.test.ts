import { describe, expect, it } from "vitest";
import { isUndeliverableEmail } from "@/lib/notifications/channels";

describe("isUndeliverableEmail", () => {
  it("skips reserved test domains used by sample accounts", () => {
    expect(isUndeliverableEmail("test-buyer@sample.workido.test")).toBe(true);
    expect(isUndeliverableEmail("someone@e2e.workido.test")).toBe(true);
    expect(isUndeliverableEmail("a@example.com")).toBe(true);
    expect(isUndeliverableEmail("a@mail.example.org")).toBe(true);
    expect(isUndeliverableEmail("a@demo.invalid")).toBe(true);
    expect(isUndeliverableEmail("A@Sample.Workido.TEST ")).toBe(true);
  });

  it("allows real domains", () => {
    expect(isUndeliverableEmail("person@gmail.com")).toBe(false);
    expect(isUndeliverableEmail("team@workido.in")).toBe(false);
    expect(isUndeliverableEmail("a@notexample.com")).toBe(false);
    expect(isUndeliverableEmail("a@testing.com")).toBe(false);
  });
});
