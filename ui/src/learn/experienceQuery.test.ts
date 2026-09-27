import { describe, expect, test } from "vitest";

import { buildExperienceQuery, EMPTY_EXPERIENCE_FILTERS } from "./experienceQuery";

describe("buildExperienceQuery", () => {
  test("sends only the exact fingerprint when filters are empty", () => {
    expect(buildExperienceQuery("sha256:abc", EMPTY_EXPERIENCE_FILTERS)).toEqual({
      structure_fingerprint: "sha256:abc",
    });
  });

  test("maps each ExperienceQuery field 1:1 and omits blanks", () => {
    expect(
      buildExperienceQuery("sha256:abc", {
        status: "failed",
        decision: "replan",
        selected_strategy: "fast",
        action: "retry",
        failure_category: "timeout",
        had_pause: "true",
        terminal_cancelled: "false",
        max_age_seconds: "30",
        limit: "7",
      }),
    ).toEqual({
      structure_fingerprint: "sha256:abc",
      status: "failed",
      decision: "replan",
      selected_strategy: "fast",
      action: "retry",
      failure_category: "timeout",
      had_pause: true,
      terminal_cancelled: false,
      max_age_seconds: 30,
      limit: 7,
    });
  });

  test("rejects an invalid status before a query body is usable", () => {
    expect(() =>
      buildExperienceQuery("sha256:abc", { ...EMPTY_EXPERIENCE_FILTERS, status: "running" }),
    ).toThrow(/invalid status/);
  });
});
