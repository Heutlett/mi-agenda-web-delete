import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("returns null/missing next as the admin default", () => {
    expect(safeNextPath(null)).toBe("/admin");
  });

  it("accepts an internal /admin-prefixed path", () => {
    expect(safeNextPath("/admin/employees")).toBe("/admin/employees");
  });

  it("rejects an absolute URL to another origin", () => {
    expect(safeNextPath("https://evil.example/phish")).toBe("/admin");
  });

  it("rejects a protocol-relative URL, which browsers treat as external", () => {
    expect(safeNextPath("//evil.example")).toBe("/admin");
  });

  it("rejects a path outside /admin", () => {
    expect(safeNextPath("/acme-barbershop")).toBe("/admin");
  });
});
