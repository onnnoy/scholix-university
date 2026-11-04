insert into public.programs (department_id,code,name,duration_years,total_semesters,status)
values ('966cd015-008f-49ab-92ba-59ae4f2bfee3','BSC-ECE','B.Sc. in Electronics & Communication Engineering',4,8,'active'),('4e8e6651-ea90-420b-8faf-d74bc8d4ecc8','BSC-AI','B.Sc. in Artificial Intelligence',4,8,'active')
on conflict(code) do update set department_id=excluded.department_id,name=excluded.name,duration_years=excluded.duration_years,total_semesters=excluded.total_semesters,updated_at=now();
insert into public.semester_definitions(program_id,name,sequence_no,status)
select p.id,case gs.n when 1 then '1st Semester' when 2 then '2nd Semester' when 3 then '3rd Semester' when 4 then '4th Semester' when 5 then '5th Semester' when 6 then '6th Semester' when 7 then '7th Semester' else '8th Semester' end,gs.n,'active'
from public.programs p cross join generate_series(1,8) gs(n) where p.code in ('BSC-CSE','BSC-ECE','BSC-AI')
on conflict(program_id,sequence_no) do nothing;
insert into public.students(user_id,student_number,full_name,email,department_id,program_id,intake_session_id,enrollment_date,academic_status,account_status)
select rs.user_id,rs.student_number,rs.full_name,rs.email,rs.department_id,p.id,rs.intake_session_id,current_date,'active','active'
from public.rps_students rs join public.programs p on p.department_id=rs.department_id
where rs.user_id is not null and not exists(select 1 from public.students s where s.user_id=rs.user_id)
on conflict(user_id) do nothing;
insert into public.teachers(user_id,teacher_number,full_name,email,department_id,account_status)
select rt.user_id,rt.teacher_number,rt.full_name,rt.email,rt.department_id,'active'
from public.rps_teachers rt where rt.user_id is not null and not exists(select 1 from public.teachers t where t.user_id=rt.user_id)
on conflict(user_id) do nothing;
