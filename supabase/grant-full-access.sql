-- ═══════════════════════════════════════════════════════════════════════════
--  To'liq huquq (SUPER_ADMIN) berish — "qul qilish" dan chiqish
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Nima uchun kerak?
--  Tizimda maxfiy kalit-sir yo'q: to'liq huquq — bu lavozimning `grants_all`
--  belgisi (bazadagi `role_has_full_access()` shuni tekshiradi). Shu sabab:
--
--    * `is_superadmin` = lavozimda barcha kalitlar bor.
--    * `roles_insert_manage` va `save_role_permissions()` shu belgini talab qiladi,
--      ya'ni lavozim yaratish faqat to'liq huquqli xodimga ochiq.
--    * Berilayotgan kalitlar "sizda bor" bo'lishi kerak (subset qoidasi) — ya'ni
--      o'ziga o'zi yetishmaydigan kalitni o'ziga o'zi bera olmaydi.
--
--  Nima uchun `grants_all` kerak? Eski qoida "barcha kalitni qo'lda belgilash" edi:
--  monitoring yoki trips.auto_approve kabi yangi kalit qo'shilsa, o'sha profil
--  superadminligini yo'qotardi va o'ziga o'zi tiklashga qurbon bo'lardi.
--  `grants_all` esa kelgusi barcha kalitlarni avtomatik oladi.
--
--  Ishga tushirish: Supabase → SQL Editor → shu faylni to'liq yopishtiring.
--  DIAGNOSTIKA blokini birinchi bo'lib alohida ishga tushirib, kimga
--  SUPER_ADMIN kerakligini aniqlang, keyin quyidagi `target_login` ni
--  o'zgartiring.
--
--  Skript xavfsiz: mavjud ma'lumotni o'chirmaydi, takrorlanadi (idempotent).


-- ── 1. DIAGNOSTIKA: har bir xodimning ruxsat holati ────────────────────────
select
  u.login,
  u.full_name,
  r.name as role,
  u.is_superadmin,
  u.is_active,
  (select count(*) from public.permissions) as katalogdagi_ruxsatlar,
  (select count(*) from public.role_permissions rp where rp.role_id = u.role_id) as berilgan_ruxsatlar,
  (select count(*) from public.permissions p
     where not exists (select 1 from public.role_permissions rp
                        where rp.role_id = u.role_id and rp.permission_id = p.id)) as yetishmaydigan,
  (select string_agg(p.key, ', ' order by p.key) from public.permissions p
     where not exists (select 1 from public.role_permissions rp
                        where rp.role_id = u.role_id and rp.permission_id = p.id)) as yetishmaydigan_kalitlar
from public.users u
join public.roles r on r.id = u.role_id
order by u.is_superadmin desc, u.created_at;


-- ── 2. SUPER_ADMIN roli yaratish va uni kerakli profilga biriktirish ───────
-- Quyidagi qatorni o'zgartiring: superadmin bo'lishi kerak bo'lgan xodimning LOGINI.
do $$
declare
  target_login text := 'karersuperadmin';  -- ← SHU QATORNI O'ZgartIRING
  admin_role   public.roles%rowtype;
  target_user  public.users%rowtype;
  missing      text[];
begin
  -- Kiritilgan login bormi?
  select * into target_user from public.users where login = target_login;
  if not found then
    raise exception 'Login "%" topilmadi. Yuqoridagi DIAGNOSTIKA natijasidan loginni to''g''ri yozing.',
      target_login;
  end if;
  if not target_user.is_active then
    raise exception '"%" profili bloklangan (is_active = false) — avval uni faollashtiring.', target_login;
  end if;

  -- 2.1. SUPER_ADMIN roli (yo'q bo'lsa yaratiladi).
  select * into admin_role from public.roles where name = 'SUPER_ADMIN';
  if not found then
    insert into public.roles (name, description, is_system, grants_all)
    values ('SUPER_ADMIN', 'Tizim to‘liq huquqlari — barcha ruxsatlar avtomatik', true, true)
    returning * into admin_role;
    raise notice 'SUPER_ADMIN roli yaratildi (%).', admin_role.id;
    update public.roles set grants_all = true where id = admin_role.id;
    raise notice 'SUPER_ADMIN roliga grants_all belgisi qo‘shildi.';
  end if;

  -- 2.2. Katalogdagi BARCHA kalitlarni berish (trigger ham qiladi, bu kafolat). — to'liq huquqning yagona
  --      ta'rifi, shuning uchun "maxfiy" qismi ham yo'q.
  insert into public.role_permissions (role_id, permission_id)
  select admin_role.id, p.id from public.permissions p
  on conflict (role_id, permission_id) do nothing;

  -- 2.3. Profilni shu rolega o'tkazish.
  update public.users set role_id = admin_role.id where id = target_user.id;

  -- 2.4. To'liq huquq belgisini aniq qayta hisoblash
  --      (triggerlar ham qiladi, bu qator esa kafolat beradi).
  update public.users u
     set is_superadmin = public.role_has_full_access(u.role_id)
   where u.is_superadmin is distinct from public.role_has_full_access(u.role_id);

  -- 2.5. Natija.
  select array_agg(p.key order by p.key) into missing
  from public.permissions p
  where not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = admin_role.id and rp.permission_id = p.id
  );

  raise notice '─────────────────────────────────────────────';
  raise notice 'Xodim: % (%)', target_user.full_name, target_login;
  raise notice 'Lavozim: %', admin_role.name;
  raise notice 'To‘liq huquq: %', public.role_has_full_access(admin_role.id);
  if missing is null then
    raise notice 'Barcha ruxsatlar berildi va grants_all yoqilgan — kelgusi yangi ruxsatlar ham avtomatik oladi.';
  else
    raise warning 'Yetishmagan kalitlar: %', missing;
  end if;
  raise notice 'Endi ilovada chiqish → qayta kiring (F5).';
  raise notice '─────────────────────────────────────────────';
end $$;


-- ── 3. NATIJANI TEKSHIRISH ────────────────────────────────────────────────
select
  u.login,
  r.name as role,
  u.is_superadmin as toliq_huquq,
  (select count(*) from public.permissions) as katalogdagi_ruxsatlar,
  (select count(*) from public.role_permissions rp where rp.role_id = u.role_id) as berilgan
from public.users u
join public.roles r on r.id = u.role_id
where u.login = 'karersuperadmin';   -- ← 2-qadamdagi login bilan bir xil


-- ── Ixtiyoriy: 'Boshliq' lavozimini ham to'liq huquqli qilish ──────────────
-- Kerak bo'lsa quyidagini oching va alohida ishga tushiring. Bu schema.sql
-- dagi seed bilan bir xil natija beradi (barcha kalitlarni qo'shadi):
--
--   update public.roles set grants_all = true where name = 'Boshliq';
--   insert into public.role_permissions (role_id, permission_id)
--   select r.id, p.id from public.roles r cross join public.permissions p
--   where r.name = 'Boshliq'
--   on conflict do nothing;
