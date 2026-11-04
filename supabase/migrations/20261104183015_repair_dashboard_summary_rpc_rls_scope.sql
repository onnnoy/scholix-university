create or replace function private.get_dashboard_summary_internal()
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare v_user_id uuid:=auth.uid();v_is_global_admin boolean:=false;v_department_ids uuid[]:=array[]::uuid[];v_summary jsonb;
begin
 if v_user_id is null then raise exception 'Not authorized to read the administration dashboard.' using errcode='42501'; end if;
 select exists(select 1 from public.user_roles ur where ur.user_id=v_user_id and ur.is_active and ur.role::text in ('super_admin','exam_controller')) into v_is_global_admin;
 select coalesce(array_agg(ur.department_id),array[]::uuid[]) into v_department_ids from public.user_roles ur where ur.user_id=v_user_id and ur.is_active and ur.role::text='department_admin' and ur.department_id is not null;
 if not v_is_global_admin and cardinality(v_department_ids)=0 then raise exception 'Not authorized to read the administration dashboard.' using errcode='42501'; end if;
 select jsonb_build_object(
 'students',(select count(*) from public.students s where s.account_status::text='active' and (v_is_global_admin or s.department_id=any(v_department_ids))),
 'programs',(select count(*) from public.programs p where p.status::text='active' and (v_is_global_admin or p.department_id=any(v_department_ids))),
 'activeTerms',(select count(*) from public.academic_terms t join public.programs p on p.id=t.program_id where t.status::text='active' and (v_is_global_admin or p.department_id=any(v_department_ids))),
 'pendingApprovals',(select count(*) from public.semester_results sr join public.students s on s.id=sr.student_id where sr.status::text in ('submitted','under_review') and (v_is_global_admin or s.department_id=any(v_department_ids))),
 'courses',(select count(*) from public.courses c join public.programs p on p.id=c.program_id where c.status::text='active' and (v_is_global_admin or p.department_id=any(v_department_ids))),
 'teachers',(select count(*) from public.teachers t where t.account_status::text='active' and (v_is_global_admin or t.department_id=any(v_department_ids))),
 'marksToSubmit',(select count(*) from public.assessments a join public.course_offerings o on o.id=a.course_offering_id join public.course_enrollments ce on ce.course_offering_id=a.course_offering_id and ce.enrollment_status='active' left join public.student_marks sm on sm.assessment_id=a.id and sm.enrollment_id=ce.id where a.status::text='active' and (sm.id is null or sm.status::text='pending') and (v_is_global_admin or o.department_id=any(v_department_ids))),
 'publishedResults',(select count(*) from public.semester_results sr join public.students s on s.id=sr.student_id where sr.status::text in ('published','locked') and (v_is_global_admin or s.department_id=any(v_department_ids)))
 ) into v_summary;
 return v_summary;
end;$function$;
revoke all on function private.get_dashboard_summary_internal() from public,anon,authenticated;
grant execute on function private.get_dashboard_summary_internal() to authenticated;
create or replace function public.get_dashboard_summary() returns jsonb language sql stable security invoker set search_path='' as $function$ select private.get_dashboard_summary_internal(); $function$;
revoke all on function public.get_dashboard_summary() from public,anon,authenticated;
grant execute on function public.get_dashboard_summary() to authenticated;
notify pgrst,'reload schema';
