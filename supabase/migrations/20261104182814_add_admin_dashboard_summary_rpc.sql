create or replace function public.get_dashboard_summary()
returns jsonb language plpgsql stable security invoker
set search_path = pg_catalog, public
as $function$
declare v_summary jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.user_roles ur where ur.user_id=auth.uid() and ur.is_active and ur.role::text in ('super_admin','department_admin','exam_controller')) then
    raise exception 'Not authorized to read the administration dashboard.' using errcode='42501';
  end if;
  select jsonb_build_object(
    'students',(select count(*) from public.students where account_status::text='active'),
    'programs',(select count(*) from public.programs where status::text='active'),
    'activeTerms',(select count(*) from public.academic_terms where status::text='active'),
    'pendingApprovals',(select count(*) from public.semester_results where status::text in ('submitted','under_review')),
    'courses',(select count(*) from public.courses where status::text='active'),
    'teachers',(select count(*) from public.teachers where account_status::text='active'),
    'marksToSubmit',(select count(*) from public.student_marks where status::text='pending'),
    'publishedResults',(select count(*) from public.semester_results where status::text in ('published','locked'))
  ) into v_summary;
  return v_summary;
end;
$function$;
revoke all on function public.get_dashboard_summary() from public,anon,authenticated;
grant execute on function public.get_dashboard_summary() to authenticated;
notify pgrst,'reload schema';
