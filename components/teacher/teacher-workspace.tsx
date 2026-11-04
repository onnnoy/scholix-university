"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpen, Check, GraduationCap, LoaderCircle, RefreshCw, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "@/components/auth/sign-out-button";

type MarkStatus = "pending" | "present" | "absent" | "excused";
type MarkDraft = { marksObtained: string; status: MarkStatus };
type AssessmentMark = {
  assessment_id: string;
  assessment_name: string;
  category_label: string;
  weight: number | string;
  max_marks: number | string;
  marks_obtained: number | string | null;
  status: MarkStatus;
};
type RosterRow = {
  enrollment_id: string;
  student_number: string;
  student_name: string;
  locked: boolean;
  result_status: string | null;
  marks: AssessmentMark[];
};
type Offering = {
  id: string;
  course_code: string;
  course_title: string;
  term_name: string;
  session_name: string;
  section: string;
  assessments: AssessmentMark[];
  roster: RosterRow[];
};
type WorkspaceData = {
  teacher: { full_name: string; teacher_number: string } | null;
  offerings: Offering[];
  legacyOfferings: Array<{ course_code: string; title: string; session_name: string }>;
};

export function TeacherWorkspace() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<WorkspaceData>({ teacher: null, offerings: [], legacyOfferings: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, MarkDraft>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await supabase.functions.invoke("scholix-admin-data", { body: { action: "teacherWorkspace" } });
    if (response.error) {
      setError(response.error.message);
    } else if (response.data?.error) {
      setError(response.data.error);
    } else {
      const next = (response.data?.data ?? { teacher: null, offerings: [], legacyOfferings: [] }) as WorkspaceData;
      setData(next);
      setSelectedOfferingId((current) => current || next.offerings[0]?.id || "");
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const selectedOffering = data.offerings.find((offering) => offering.id === selectedOfferingId);
  const draftKey = (enrollmentId: string, assessmentId: string) => enrollmentId + ":" + assessmentId;
  const getDraft = (row: RosterRow, mark: AssessmentMark): MarkDraft => {
    const key = draftKey(row.enrollment_id, mark.assessment_id);
    return drafts[key] ?? {
      marksObtained: mark.marks_obtained == null ? "" : String(mark.marks_obtained),
      status: mark.status ?? "pending",
    };
  };

  const updateDraft = (key: string, update: Partial<MarkDraft>) => {
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { marksObtained: "", status: "pending" }), ...update },
    }));
  };

  const saveMark = async (row: RosterRow, mark: AssessmentMark) => {
    const key = draftKey(row.enrollment_id, mark.assessment_id);
    const draft = getDraft(row, mark);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await supabase.functions.invoke("scholix-admin-data", {
        body: {
          action: "teacherSaveMark",
          enrollmentId: row.enrollment_id,
          assessmentId: mark.assessment_id,
          marksObtained: draft.marksObtained,
          status: draft.status,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setNotice("Marks saved for " + row.student_name + " — " + mark.assessment_name + ".");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save marks.");
    } finally {
      setSaving(false);
    }
  };

  const processOffering = async () => {
    if (!selectedOffering) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await supabase.functions.invoke("scholix-admin-data", {
        body: { action: "teacherProcessOffering", offeringId: selectedOffering.id },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      const processed = Number(response.data?.processed_count ?? 0);
      const skipped = Number(response.data?.skipped_count ?? 0);
      setNotice("Submitted " + processed + " course result(s) for examination review. " + skipped + " already-submitted or finalized result(s) were left unchanged.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not process course results.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f7f6] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">
              <GraduationCap size={26} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.15em] text-emerald-700">Scholix faculty portal</p>
              <h1 className="text-3xl font-bold tracking-tight">My teaching</h1>
            </div>
          </div>
          <SignOutButton />
        </header>

        {error && <div role="alert" className="mb-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle size={18} aria-hidden="true" />{error}</div>}
        {notice && <div role="status" aria-live="polite" className="mb-5 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><Check size={18} aria-hidden="true" />{notice}</div>}

        {loading ? (
          <div role="status" aria-live="polite" className="grid min-h-52 place-items-center">
            <span className="sr-only">Loading assigned courses and student rosters</span>
            <LoaderCircle size={26} aria-hidden="true" className="animate-spin" />
          </div>
        ) : !data.teacher ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8">
            <h2 className="text-lg font-bold">Teacher record not linked</h2>
            <p className="mt-2 text-sm text-slate-600">Ask administration to link your active teacher account.</p>
          </section>
        ) : (
          <>
            <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6">
              <div>
                <p className="text-sm text-slate-500">Welcome</p>
                <h2 className="mt-1 text-2xl font-bold">{data.teacher.full_name}</h2>
                <p className="mt-1 text-sm text-slate-600">{data.teacher.teacher_number}</p>
              </div>
              <button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <RefreshCw size={16} aria-hidden="true" />Refresh
              </button>
            </section>

            <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
              <label htmlFor="teacher-offering" className="mb-2 block text-sm font-semibold text-slate-800">Select an assigned course</label>
              <select id="teacher-offering" value={selectedOfferingId} onChange={(event) => { setSelectedOfferingId(event.target.value); setDrafts({}); setNotice(""); setError(""); }} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm sm:max-w-2xl">
                <option value="">Choose a course</option>
                {data.offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {offering.course_code} — {offering.course_title} · {offering.term_name} · Section {offering.section}
                  </option>
                ))}
              </select>
              {!data.offerings.length && <p className="mt-3 text-sm text-slate-600">No active course offerings are assigned to this teacher.</p>}
            </section>

            {selectedOffering && (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-700">
                      <BookOpen size={18} aria-hidden="true" />
                      <span className="text-xs font-bold uppercase tracking-wide">Assigned course</span>
                    </div>
                    <h2 className="mt-2 text-xl font-bold">{selectedOffering.course_code} — {selectedOffering.course_title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{selectedOffering.term_name} · {selectedOffering.session_name} · Section {selectedOffering.section}</p>
                  </div>
                  <button type="button" onClick={() => void processOffering()} disabled={saving || !selectedOffering.roster.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                    {saving ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                    Calculate & submit for review
                  </button>
                </div>

                <div className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-900">
                  Enter each assessment mark separately. The system uses the course offering&apos;s configured assessment weights and grading scale. Pending, absent, or excused required assessments prevent result calculation until resolved under an approved academic policy.
                </div>

                {selectedOffering.roster.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-600">There are no active student enrollments in this course offering.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1050px] text-left">
                      <thead className="bg-slate-50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Student</th>
                          {selectedOffering.assessments.map((assessment) => (
                            <th scope="col" key={assessment.assessment_id} className="min-w-52 px-4 py-3 text-xs font-bold uppercase text-slate-500">
                              <span className="block">{assessment.category_label}</span>
                              <span className="mt-1 block normal-case font-medium text-slate-500">{assessment.assessment_name} · {assessment.weight}% · out of {assessment.max_marks}</span>
                            </th>
                          ))}
                          <th scope="col" className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Result status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOffering.roster.map((student) => (
                          <tr key={student.enrollment_id} className="border-t border-slate-100 align-top">
                            <th scope="row" className="min-w-48 px-4 py-4 text-sm">
                              <span className="block font-semibold text-slate-900">{student.student_name}</span>
                              <span className="mt-1 block font-normal text-slate-500">{student.student_number}</span>
                              {student.is_repeat && <span className="mt-1 inline-block text-xs font-semibold text-amber-700">Repeat attempt {student.attempt_no}</span>}
                            </th>
                            {student.marks.map((mark) => {
                              const key = draftKey(student.enrollment_id, mark.assessment_id);
                              const draft = getDraft(student, mark);
                              return (
                                <td key={mark.assessment_id} className="px-4 py-3">
                                  <div className="space-y-2">
                                    <label className="block text-xs font-medium text-slate-600" htmlFor={"mark-status-" + key}>Assessment status</label>
                                    <select id={"mark-status-" + key} value={draft.status} disabled={saving || student.locked} onChange={(event) => updateDraft(key, { status: event.target.value as MarkStatus, ...(event.target.value === "present" ? {} : { marksObtained: "" }) })} className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-100">
                                      <option value="pending">Pending</option>
                                      <option value="present">Present</option>
                                      <option value="absent">Absent</option>
                                      <option value="excused">Excused</option>
                                    </select>
                                    <label className="block text-xs font-medium text-slate-600" htmlFor={"mark-value-" + key}>Marks obtained (0–{mark.max_marks})</label>
                                    <input id={"mark-value-" + key} aria-label={"Marks for " + student.student_name + ", " + mark.assessment_name} type="number" min="0" max={Number(mark.max_marks)} step="0.001" value={draft.marksObtained} disabled={saving || student.locked || draft.status !== "present"} onChange={(event) => updateDraft(key, { marksObtained: event.target.value })} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
                                    <button type="button" onClick={() => void saveMark(student, mark)} disabled={saving || student.locked || (draft.status === "present" && (!draft.marksObtained || !Number.isFinite(Number(draft.marksObtained)) || Number(draft.marksObtained) < 0 || Number(draft.marksObtained) > Number(mark.max_marks)))} className="min-h-9 w-full rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
                                      Save mark
                                    </button>
                                  </div>
                                </td>
                              );
                            })}
                            <td className="px-4 py-4 text-sm">
                              {student.locked ? (
                                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-800">{String(student.result_status).replaceAll("_", " ")}</span>
                              ) : (
                                <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Draft marks</span>
                              )}
                              {student.locked && <p className="mt-2 max-w-32 text-xs text-slate-500">Marks are read-only after submission.</p>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {data.legacyOfferings?.length > 0 && (
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold">Legacy assigned courses</h2>
                <p className="mt-1 text-sm text-slate-500">Historical RPS records are displayed for reference and are not editable through the new grading workflow.</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {data.legacyOfferings.map((course, index) => <li key={course.course_code + "-" + index}>{course.course_code} — {course.title} · {course.session_name}</li>)}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
