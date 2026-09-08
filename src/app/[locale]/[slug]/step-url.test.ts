import { describe, expect, it } from "vitest";
import { stepUrl } from "./step-url";

describe("stepUrl", () => {
  it("returns just the slug path when no params are given", () => {
    expect(stepUrl("acme", {})).toBe("/acme");
  });

  it("includes only the given, defined params", () => {
    expect(stepUrl("acme", { service: "s1", date: "2026-09-10" })).toBe(
      "/acme?service=s1&date=2026-09-10",
    );
  });

  it("omits undefined params rather than including an empty value", () => {
    expect(stepUrl("acme", { service: "s1", employee: undefined })).toBe(
      "/acme?service=s1",
    );
  });

  it("orders params consistently regardless of input order", () => {
    const a = stepUrl("acme", { time: "t1", service: "s1", employee: "e1" });
    const b = stepUrl("acme", { employee: "e1", time: "t1", service: "s1" });
    expect(a).toBe(b);
  });
});
