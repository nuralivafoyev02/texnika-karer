-- Texnika ERP · dastlabki superadmin hisobini yaratish
-- Supabase SQL Editor’da BIR MARTA ishga tushiring (idempotent: qayta ishga tushirilsa ham xato bermaydi).
--
--   login:    karersuperadmin
--   parol:    karersuperadmin
--
-- Bu skript Auth hisobini ham, ERP profilini ham yaratadi. Parol `crypt(..., gen_salt('bf'))`
-- orqali bcrypt hash'iga aylantiriladi — boshqa hech qaerda ochiq parol saqlanmaydi.
-- Eslatma: ishga tushirgandan keyin bu parolni darhol o'zgartiring (Xodimlar → o'z parolini yangilang).
--
-- DIQQAT: bu skript faqat dastlabki hisobni yaratadi. Keyinchalik to‘liq huquqli (superadmin)
-- xodimlar cheklanmaydi: Xodimlar → "Xodim qo‘shish" orqali "Boshliq" lavozimini berish yetarli,
-- chunki to‘liq dostub = superadmin (bazadagi role_has_full_access va users_sync_superadmin
-- triggeri shuni avtomatik belgilaydi).

-- ── 1. Auth foydalanuvchisi (agar `karersuperadmin@karer.erp` yo'q bo'lsa) ─────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'karersuperadmin@karer.erp', crypt('karersuperadmin', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Superadmin","login":"karersuperadmin"}'::jsonb,
  now(), now(), '', '', '', ''
where not exists (select 1 from auth.users where lower(email) = 'karersuperadmin@karer.erp');

-- Auth identifikatsiyasi (kirish uchun shart): email provider yozuvi.
insert into auth.identities (id, user_id, provider, identity_data, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  u.id::text, now(), now(), now()
from auth.users u
where lower(u.email) = 'karersuperadmin@karer.erp'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

-- ── 2. ERP profili: Boshliq lavozimi + to'liq huquq ─────────────────────────
-- 'Boshliq' roli `grants_all = true` bilan seed qilinadi, shuning uchun yangi
-- ruxsat kalitlari qo'shilsa ham bu profil superadminligini yo'qotmaydi.
insert into public.users (id, full_name, email, login, title, role_id, is_superadmin, is_active, driver_rate_per_trip, password_changed_at)
select u.id, 'Superadmin', u.email, 'karersuperadmin', 'Boshliq', r.id, true, true, 0, now()
from auth.users u
cross join public.roles r
where lower(u.email) = 'karersuperadmin@karer.erp' and r.name = 'Boshliq'
on conflict (id) do update
  set is_superadmin = true, is_active = true, role_id = excluded.role_id, login = excluded.login;

-- Eski bazalarda 'Boshliq' grants_all=false bo'lishi mumkin — kafolat beramiz.
update public.roles set grants_all = true where name = 'Boshliq';
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p where r.name = 'Boshliq'
on conflict do nothing;

-- ── 3. Tekshiruv ───────────────────────────────────────────────────────────
select u.login, u.full_name, u.email, u.is_active, u.is_superadmin, r.name as lavozim
from public.users u
left join public.roles r on r.id = u.role_id
where u.is_superadmin;

-- ── Parolni tiklash (unitgan bo'lsangiz) ───────────────────────────────────
-- Parolni faqat hash ko'rinishida yozish mumkin; boshqa qism o'zgarmaydi.
-- update auth.users
--    set encrypted_password = crypt('YANGI_PAROL', gen_salt('bf')), updated_at = now()
--  where lower(email) = 'karersuperadmin@karer.erp';
--
-- ── Agar bu skript xato bersa (Supabase versiyasi auth.identities sxemasini o'zgartirgan bo'lsa) ──
-- 1) Dashboard → Authentication → Users → Add user:
--      email: karersuperadmin@karer.erp, password: karersuperadmin, "Auto Confirm User" yoqilgan.
-- 2) Yuqoridagi 2-qadamni (profil) alohida ishga tushiring.
