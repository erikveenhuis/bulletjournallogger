-- Baseline capture: run this BEFORE applying 0021_add_performance_indexes
-- to record current DB state. Run in Supabase SQL Editor or: supabase db execute -f supabase/scripts/baseline_capture.sql
-- (To save output to file: run in SQL Editor and export, or use psql with \o baseline_YYYYMMDD.txt)

-- 1) Indexes on public tables (name, table, columns, definition)
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- 2) Table row counts (estimated from pg_stat_user_tables for speed; use count(*) for exact)
select
  schemaname,
  relname as table_name,
  n_live_tup as estimated_row_count,
  n_dead_tup as dead_tuples,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
from pg_stat_user_tables
where schemaname = 'public'
order by relname;

-- 3) Table sizes (bytes)
select
  c.relname as table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  pg_size_pretty(pg_relation_size(c.oid)) as table_size,
  pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) as indexes_size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by pg_total_relation_size(c.oid) desc;

-- 4) RLS status per table
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;
