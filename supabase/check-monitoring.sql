-- Diagnostika: monitoring ishlayaptimi?
-- Supabase → SQL Editor → New query → shu faylni yopishtab Run.
-- Natija 3 ta jadval/boolean qaytaradi: ularni tekshirib ko'ring va yuboring.

-- 1) Monitoring sxemasi bazaqa tushirilganmi?
select
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'trips' and column_name = 'monitoring_status')  as trips_monitoring_column,
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'transactions' and column_name = 'monitoring_status') as transactions_monitoring_column,
  to_regprocedure('public.set_trip_monitoring(uuid, boolean, text)')   is not null as trip_rpc,
  to_regprocedure('public.set_expense_monitoring(uuid, boolean, text)') is not null as expense_rpc;

-- 2) Realtime kanalga ulanganmi? (INSERT bo'lmasa Monitoring boshqa oynada yangilanmaydi)
select relname as table_name, relreplident
from pg_class
where relname in ('trips', 'transactions') and relkind = 'r';

select
  case when exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trips')
    then 'trips — ulangan' else 'trips — ULANMAGAN' end as trips_realtime,
  case when exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transactions')
    then 'transactions — ulangan' else 'transactions — ULANMAGAN' end as transactions_realtime;

-- 3) Oxirgi 8 ta reys: monitoring_status "pending" bo'lishi kerak.
--    NULL yoki 'approved' bo'lsa, sxema eskirgan yoki trigger ishlamayapti.
select id, created_at, sale_type, weight_tons, monitoring_status, monitored_at, driver_id, created_by
from public.trips
order by created_at desc
limit 8;

-- 4) Kutilayotgan reyslar (Monitoring sahifasi shuni ko'rsatadi)
select count(*) filter (where monitoring_status = 'pending') as pending_trips,
       count(*) filter (where monitoring_status = 'approved') as approved_trips,
       count(*) filter (where monitoring_status is null) as null_status
from public.trips;
