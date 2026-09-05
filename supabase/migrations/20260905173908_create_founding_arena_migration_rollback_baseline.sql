-- Minimal rollback baseline for the existing tables changed by the Founding
-- Arena migration. This is deliberately isolated from all web-facing roles.

create schema if not exists launch_backup_20260905;
revoke all on schema launch_backup_20260905
from public, anon, authenticated, service_role;

create table launch_backup_20260905.arenas
  as table public.arenas with data;
create table launch_backup_20260905.arena_entries
  as table public.arena_entries with data;
create table launch_backup_20260905.analytics_events
  as table public.analytics_events with data;
create table launch_backup_20260905.outbound_visits
  as table public.outbound_visits with data;

create table launch_backup_20260905.manifest (
  table_name text primary key,
  source_rows bigint not null,
  backup_rows bigint not null,
  source_hash text not null,
  backup_hash text not null,
  captured_at timestamptz not null default now(),
  check (source_rows = backup_rows),
  check (source_hash = backup_hash)
);

insert into launch_backup_20260905.manifest
  (table_name, source_rows, backup_rows, source_hash, backup_hash)
values
  ('arenas',
   (select count(*) from public.arenas),
   (select count(*) from launch_backup_20260905.arenas),
   (select md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by md5(to_jsonb(t)::text)), '')) from public.arenas t),
   (select md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by md5(to_jsonb(t)::text)), '')) from launch_backup_20260905.arenas t)),
  ('arena_entries',
   (select count(*) from public.arena_entries),
   (select count(*) from launch_backup_20260905.arena_entries),
   (select md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by md5(to_jsonb(t)::text)), '')) from public.arena_entries t),
   (select md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by md5(to_jsonb(t)::text)), '')) from launch_backup_20260905.arena_entries t)),
  ('analytics_events',
   (select count(*) from public.analytics_events),
   (select count(*) from launch_backup_20260905.analytics_events),
   (select md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by md5(to_jsonb(t)::text)), '')) from public.analytics_events t),
   (select md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by md5(to_jsonb(t)::text)), '')) from launch_backup_20260905.analytics_events t)),
  ('outbound_visits',
   (select count(*) from public.outbound_visits),
   (select count(*) from launch_backup_20260905.outbound_visits),
   (select md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by md5(to_jsonb(t)::text)), '')) from public.outbound_visits t),
   (select md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by md5(to_jsonb(t)::text)), '')) from launch_backup_20260905.outbound_visits t));

revoke all on all tables in schema launch_backup_20260905
from public, anon, authenticated, service_role;

