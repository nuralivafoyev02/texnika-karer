-- ── Row-level security ────────────────────────────────────────────────────
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.materials enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_categories enable row level security;
alter table public.maintenance_reports enable row level security;

-- Role catalog is visible to signed-in staff so the UI can resolve their own permissions.
drop policy if exists roles_read_authenticated on public.roles;
create policy roles_read_authenticated on public.roles for select to authenticated using (true);
-- To'liq huquqga ega (superadmin) xodim lavozim va ruxsatlarni boshqaradi. Boshqa hech kim,
-- roli qanchalik kuchli bo'lmasin — chunki is_superadmin() aynan "barcha ruxsatlarga ega" holatni tekshiradi.
drop policy if exists roles_insert_manage on public.roles;
create policy roles_insert_manage on public.roles for insert to authenticated with check (public.is_superadmin() and is_system = false);
drop policy if exists roles_update_manage on public.roles;
create policy roles_update_manage on public.roles for update to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists roles_delete_custom on public.roles;
create policy roles_delete_custom on public.roles for delete to authenticated using (public.is_superadmin() and is_system = false);

drop policy if exists permissions_read_authenticated on public.permissions;
create policy permissions_read_authenticated on public.permissions for select to authenticated using (true);
drop policy if exists role_permissions_read_authenticated on public.role_permissions;
create policy role_permissions_read_authenticated on public.role_permissions for select to authenticated using (true);
-- Writes go exclusively through save_role_permissions(), which applies the subset rule atomically.
drop policy if exists role_permissions_manage on public.role_permissions;

drop policy if exists users_read_self_or_staff on public.users;
create policy users_read_self_or_staff on public.users for select to authenticated using (id = auth.uid() or public.has_permission('staff.view') or public.is_superadmin());
-- Staff accounts are created only in the server-side create-staff Edge Function (it owns the
-- auth credential), and profile edits belong to the superadmin.
drop policy if exists users_update_staff on public.users;
create policy users_update_staff on public.users for update to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

-- A scale operator also needs customer and truck names to create a trip.
drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients for select to authenticated using (public.has_permission('clients.view') or public.has_permission('clients.manage') or public.has_permission('trips.create') or public.has_permission('dashboard.view'));
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated with check (public.has_permission('clients.manage'));
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated using (public.has_permission('clients.manage')) with check (public.has_permission('clients.manage'));

drop policy if exists materials_read on public.materials;
create policy materials_read on public.materials for select to authenticated using (true);
drop policy if exists materials_update on public.materials;
create policy materials_update on public.materials for update to authenticated using (public.has_permission('materials.manage')) with check (public.has_permission('materials.manage'));
-- Mahsulot qo'shish — alohida materials.create ruxsati bilan. Superadmin yoki boshqaruvchi
-- kabi to'liq manage huquqiga egalar ham shu siyosat orqali qo'sha oladi.
drop policy if exists materials_insert_manage on public.materials;
create policy materials_insert_manage on public.materials for insert to authenticated
  with check (public.has_permission('materials.manage') or public.has_permission('materials.create'));
-- Mahsulotni o'chirish faqat undan foydalanilmagan bo'lsa mumkin: trips.material_id
-- "on delete restrict" bilan bog'langan, shuning uchun DB ham bloklaydi.
drop policy if exists materials_delete_manage on public.materials;
create policy materials_delete_manage on public.materials for delete to authenticated using (public.has_permission('materials.manage'));

drop policy if exists transaction_categories_read on public.transaction_categories;
create policy transaction_categories_read on public.transaction_categories for select to authenticated using (
  public.has_permission('finance.view') or public.has_permission('finance.manage') or
  public.has_permission('finance.categories.create') or
  public.has_permission('finance.payments.create') or
  public.has_permission('finance.expenses.create') or public.has_permission('dashboard.view')
);
-- Tahrirlash va o'chirish faqat finance.manage egalarida. Yangi tur yaratish esa
-- finance.categories.create ruxsati bilan ham mumkin — shu bilan "faqat kiritish" vazifasi
-- berilgan xodim superadminga murojaat qilmasdan o'z turini yarata oladi.
drop policy if exists transaction_categories_manage on public.transaction_categories;
create policy transaction_categories_manage on public.transaction_categories for all to authenticated
  using (public.has_permission('finance.manage')) with check (public.has_permission('finance.manage'));
drop policy if exists transaction_categories_insert on public.transaction_categories;
create policy transaction_categories_insert on public.transaction_categories for insert to authenticated
  with check (public.has_permission('finance.manage') or public.has_permission('finance.categories.create'));

drop policy if exists vehicles_read on public.vehicles;
create policy vehicles_read on public.vehicles for select to authenticated using (
  public.has_permission('fleet.view') or public.has_permission('trips.create') or
  (public.has_permission('driver.self') and driver_id = auth.uid()) or public.has_permission('dashboard.view')
);
drop policy if exists vehicles_update_status on public.vehicles;
create policy vehicles_update_status on public.vehicles for update to authenticated using (public.has_permission('fleet.manage')) with check (public.has_permission('fleet.manage'));
-- Texnika qo'shish: faqat boshqaruvchi roli. Haydovchi maydoni users jadvaliga FK bilan
-- bog'langan, shuning uchun RLS allaqachon mavjud xodimni tekshiradi.
drop policy if exists vehicles_insert_manage on public.vehicles;
create policy vehicles_insert_manage on public.vehicles for insert to authenticated with check (public.has_permission('fleet.manage'));

-- Managers see operational data; drivers see only their assigned trip rows.
-- monitoring.view / monitoring.approve egalari reyslarni Monitoring bo'limida
-- ko'rish (va tasdiqlash) uchun kirishadi.
drop policy if exists trips_read on public.trips;
create policy trips_read on public.trips for select to authenticated using (
  public.has_permission('trips.view') or public.has_permission('clients.view') or public.has_permission('dashboard.view') or
  public.has_permission('monitoring.view') or public.has_permission('monitoring.approve') or
  (public.has_permission('trips.create') and created_by = auth.uid()) or
  (public.has_permission('driver.self') and (driver_id = auth.uid() or created_by = auth.uid()))
);
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips for insert to authenticated with check (
  public.has_permission('trips.create') and created_by = auth.uid() and
  exists (select 1 from public.vehicles v where v.id = vehicle_id and v.driver_id = driver_id and v.status = 'active')
);
-- Only the photo path may be changed after the initial insert (the app uploads after creating the trip row).
-- Monitoring holati esa faqat set_trip_monitoring() orqali o'zgaradi — bu policy
-- monitoring_status ustuniga grant yo'qligi bilan ham himoyalangan.
drop policy if exists trips_attach_photo on public.trips;
create policy trips_attach_photo on public.trips for update to authenticated
  using (public.has_permission('trips.create') and created_by = auth.uid())
  with check (public.has_permission('trips.create') and created_by = auth.uid());

-- Cashier users cannot create arbitrary income/expense categories.
-- monitoring.view / monitoring.approve egalari Monitoring bo'limi uchun chiqimlarni
-- ko'ra (va tasdiqla) oladi.
drop policy if exists transactions_read on public.transactions;
create policy transactions_read on public.transactions for select to authenticated using (
  public.has_permission('finance.view') or public.has_permission('dashboard.view') or
  public.has_permission('monitoring.view') or public.has_permission('monitoring.approve') or
  (public.has_permission('clients.view') and category = 'customer_payment' and client_id is not null) or
  ((public.has_permission('finance.payments.create') or public.has_permission('finance.expenses.create')) and created_by = auth.uid()) or
  (public.has_permission('driver.self') and (driver_id = auth.uid() or created_by = auth.uid()))
);
-- Faqat faol va yo‘nalishiga mos turlar kiritiladi. Yangi daromat/xarajat turlari
-- Sozlamalar → Moliya bo‘limida yaratilgach shu yerda avtomatik qo‘llanadi;
-- tizim ichidagi “Naqd savdo” esa trigger orqali yozilgani uchun qo‘lda kiritilmaydi.
drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions for insert to authenticated with check (
  created_by = auth.uid() and (
    (direction = 'in' and public.has_permission('finance.payments.create') and exists (
      select 1 from public.transaction_categories tc
      where tc.key = category and tc.direction = 'in' and tc.is_active
        and (tc.key = 'customer_payment' or not tc.is_system)
        and (not tc.needs_client or client_id is not null)
    )) or
    (direction = 'out' and public.has_permission('finance.expenses.create') and exists (
      select 1 from public.transaction_categories tc
      where tc.key = category and tc.direction = 'out' and tc.is_active
        and (not tc.needs_driver or driver_id is not null)
    ))
  )
);

-- Drivers can submit only their own alert; managers/buxgalter can review and close reports.
drop policy if exists maintenance_reports_read on public.maintenance_reports;
create policy maintenance_reports_read on public.maintenance_reports for select to authenticated using (
  public.has_permission('dashboard.view') or public.has_permission('finance.view') or public.has_permission('fleet.manage') or
  (public.has_permission('driver.self') and driver_id = auth.uid())
);
drop policy if exists maintenance_reports_insert_driver on public.maintenance_reports;
create policy maintenance_reports_insert_driver on public.maintenance_reports for insert to authenticated with check (
  public.has_permission('maintenance.report') and public.has_permission('driver.self') and driver_id = auth.uid() and status = 'open' and
  exists (select 1 from public.vehicles v where v.id = vehicle_id and v.driver_id = auth.uid())
);
drop policy if exists maintenance_reports_update_manager on public.maintenance_reports;
create policy maintenance_reports_update_manager on public.maintenance_reports for update to authenticated using (public.has_permission('fleet.manage')) with check (public.has_permission('fleet.manage'));

-- ── Storage: profile avatars ──────────────────────────────────────────────
-- Har bir xodimning rasmi aniq o'z papkasida saqlanadi: avatars/<user_id>/<fayl>.
-- Bu shart siyosatlarda ham, `update_my_profile` RPC'sida ham tekshiriladi — shuning uchun
-- bir xodim boshqasining rasmini o'z profiliga bog'lab ololmaydi.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

-- ── Storage: private trip photos ──────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-photos', 'trip-photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists trip_photos_read on storage.objects;
create policy trip_photos_read on storage.objects for select to authenticated using (
  bucket_id = 'trip-photos' and (
    public.has_permission('trips.view') or public.has_permission('clients.view') or public.has_permission('dashboard.view') or
    exists (select 1 from public.trips t where t.id::text = (storage.foldername(name))[1] and (t.driver_id = auth.uid() or t.created_by = auth.uid()))
  )
);
drop policy if exists trip_photos_insert on storage.objects;
create policy trip_photos_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'trip-photos' and public.has_permission('trips.create') and
  exists (select 1 from public.trips t where t.id::text = (storage.foldername(name))[1] and t.created_by = auth.uid())
);

-- The browser uses only the Supabase anon/publishable key. RLS remains the security boundary.
grant usage on schema public to authenticated;
grant select on public.roles, public.permissions, public.role_permissions to authenticated;
grant insert, update, delete on public.roles to authenticated;
revoke insert, update, delete on public.role_permissions from authenticated;
grant select on public.users to authenticated;
-- Profil tahrirlash (ism, telefon, bo'lim, lavozim, holat) faqat users_update_staff siyosati
-- orqali — ya'ni to'liq huquqli xodim uchun. Ustun darajasida berish butun jadvalni
-- ochmasligimiz uchun kerak: is_superadmin va driver_rate_per_trip o'zga tegishli RPC/tablalar orqali.
grant update (full_name, phone, title, role_id, is_active) on public.users to authenticated;
-- avatar_path ustuniga faqat `update_my_profile` RPC yozadi (security definer), shuning uchun
-- authenticated roliga alohida grant berilmaydi.
grant select, insert, update on public.clients to authenticated;
grant select on public.materials to authenticated;
grant insert on public.materials to authenticated;
grant update (unit_price, is_active) on public.materials to authenticated;
grant delete on public.materials to authenticated;
grant select on public.vehicles to authenticated;
grant update (plate, model, year, status, driver_id) on public.vehicles to authenticated;
grant select on public.trips to authenticated;
-- trips insert — USTUN darajasida. unit_price va total_amount serverda trigger
-- hisoblaydi, monitoring_status esa monitoringdan tasdiqlanadi: shu uchun bu
-- ustunlarga grant berilmaydi va brauzer ularni yubora olmaydi.
revoke insert on public.trips from authenticated;
grant insert (id, vehicle_id, driver_id, client_id, material_id, weight_tons, sale_type, hours_worked, note, created_by) on public.trips to authenticated;
grant update (photo_path) on public.trips to authenticated;
grant select on public.transactions to authenticated;
-- Xuddi shu sabab: monitoring_status, monitored_by, monitored_at va monitoring_note
-- faqat set_expense_monitoring() RPC'si orqali o'zgaradi.
revoke insert on public.transactions from authenticated;
grant insert (direction, category, amount, payment_method, client_id, vehicle_id, driver_id, note) on public.transactions to authenticated;
grant select, insert, update, delete on public.transaction_categories to authenticated;
grant select on public.client_balances, public.financial_balances to authenticated;
grant select, insert on public.maintenance_reports to authenticated;
grant update (status, resolved_at) on public.maintenance_reports to authenticated;

-- ── Full-dostub belgisini qayta hisoblash ───────────────────────────────────
-- Triggerlar faqat keyingi o'zgarishlarda ishlaydi; shuning uchun mavjud xodimlar uchun
-- bir marta to'liq qayta hisoblaymiz. Shu bilan eng muhimi: yangi ruxsat kaliti qo'shilsa
-- yoki "Boshliq"ga biror ruxsat berilsa, o'sha lavozimdagi xodimlar superadmin bo'lib qoladi.
-- ESDA: monitoring.* va materials.prices.view kalitlari faqat "Boshliq"ga beriladi
-- (yuqoridagi cross join shuni avtomatik qiladi). Agar boshqa bir lavozim oldindan
-- BARCHA kalitlarga ega bo'lgan bo'lsa, u endi to'liq dostub hisoblanmaydi — bu kutilgan
-- xatti-harakat: monitoring huquqi qo'lda berilishi kerak.
update public.users u
set is_superadmin = public.role_has_full_access(u.role_id)
where u.is_superadmin is distinct from public.role_has_full_access(u.role_id);

-- Add the operational tables to Realtime when the standard Supabase publication exists.
-- RLS still filters the rows/events received by each user.
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['maintenance_reports','trips','transactions','vehicles'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;
