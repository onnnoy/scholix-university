-- Run manually in the Supabase SQL editor AFTER creating the first account
-- through Supabase Auth. Replace the UUID below with that auth.users.id.
-- This is intentionally not part of an automated migration or seed.

insert into public.user_roles (user_id, role, department_id, is_active)
values ('REPLACE_WITH_AUTH_USER_UUID'::uuid, 'super_admin', null, true)
on conflict do nothing;
