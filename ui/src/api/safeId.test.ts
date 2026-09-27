import { describe, expect, test } from "vitest";

import { isSafeRunId } from "./safeId";

describe("isSafeRunId", () => {
  test("accepts typical run ids", () => {
    expect(isSafeRunId("run_a")).toBe(true);
    expect(isSafeRunId("run.1-2")).toBe(true);
  });

  test("rejects unsafe ids", () => {
    expect(isSafeRunId("")).toBe(false);
    expect(isSafeRunId(".")).toBe(false);
    expect(isSafeRunId("..")).toBe(false);
    expect(isSafeRunId("../x")).toBe(false);
    expect(isSafeRunId("a/b")).toBe(false);
    expect(isSafeRunId("a".repeat(201))).toBe(false);
  });
});
