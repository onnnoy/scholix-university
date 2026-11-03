import { z } from "zod";

export const dashboardSummarySchema = z.object({
  students: z.number().int().nonnegative(),
  programs: z.number().int().nonnegative(),
  activeTerms: z.number().int().nonnegative(),
  pendingApprovals: z.number().int().nonnegative(),
  courses: z.number().int().nonnegative(),
  teachers: z.number().int().nonnegative(),
  marksToSubmit: z.number().int().nonnegative(),
  publishedResults: z.number().int().nonnegative(),
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

export function formatDashboardSummary(summary: DashboardSummary) {
  return {
    students: String(summary.students),
    programs: String(summary.programs),
    activeTerms: String(summary.activeTerms),
    pendingApprovals: String(summary.pendingApprovals),
    courses: String(summary.courses),
    teachers: String(summary.teachers),
    marksToSubmit: String(summary.marksToSubmit),
    publishedResults: String(summary.publishedResults),
  };
}
