import { describe, expect, it } from "vitest";
import { dashboardSummarySchema, formatDashboardSummary } from "../../features/dashboard/schema";

const validSummary = {
  students: 125,
  programs: 4,
  activeTerms: 2,
  pendingApprovals: 3,
  courses: 42,
  teachers: 18,
  marksToSubmit: 36,
  publishedResults: 9,
};

describe("dashboard summary validation", () => {
  it("accepts valid non-negative database counts", () => {
    expect(dashboardSummarySchema.safeParse(validSummary).success).toBe(true);
  });

  it("rejects negative or non-integer counts", () => {
    expect(dashboardSummarySchema.safeParse({ ...validSummary, students: -1 }).success).toBe(false);
    expect(dashboardSummarySchema.safeParse({ ...validSummary, programs: 1.5 }).success).toBe(false);
  });

  it("converts validated counts to the dashboard's string model", () => {
    expect(formatDashboardSummary(validSummary)).toMatchObject({ students: "125", programs: "4", publishedResults: "9" });
  });
});
