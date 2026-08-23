-- Removes an earlier, superseded draft of the Phase 3 $PRENA schema.
--
-- ONLY run this if you applied a pre-release Phase 3 draft. A fresh project
-- must skip straight to 004_phase3_prena.sql.
--
-- It refuses to run if any of the draft tables hold rows, so it can never
-- destroy real payment or reward history.

do $$
declare
  v_table text;
  v_rows bigint;
begin
  foreach v_table in array array[
    'builder_wallets', 'wallet_nonces', 'prena_quotes', 'token_payments',
    'arena_reward_pools', 'arena_reward_tiers', 'reward_allocations'
  ] loop
    if to_regclass('public.' || v_table) is null then continue; end if;
    execute format('select count(*) from public.%I', v_table) into v_rows;
    if v_rows > 0 then
      raise exception 'refusing to reset: public.% holds % rows', v_table, v_rows;
    end if;
  end loop;
end $$;

drop function if exists public.allocate_arena_rewards(uuid) cascade;
drop function if exists public.approve_reward_allocations(uuid) cascade;
drop function if exists public.claim_reward_allocation(uuid, uuid, text, text) cascade;
drop function if exists public.confirm_prena_payment(uuid, text) cascade;
drop function if exists public.consume_wallet_nonce(uuid, text) cascade;
drop function if exists public.create_wallet_nonce(uuid, text, text, integer, uuid) cascade;
drop function if exists public.fail_prena_payment(uuid, text) cascade;
drop function if exists public.link_builder_wallet(uuid, text, integer) cascade;
drop function if exists public.unlink_builder_wallet(uuid, uuid) cascade;
drop function if exists public.start_prena_entry(uuid, uuid, uuid, uuid, text) cascade;

drop view if exists public.prena_activity;

alter table if exists public.arena_entries drop column if exists token_payment_id;

drop table if exists public.reward_allocations cascade;
drop table if exists public.arena_reward_tiers cascade;
drop table if exists public.arena_reward_pools cascade;
drop table if exists public.token_payments cascade;
drop table if exists public.prena_quotes cascade;
drop table if exists public.wallet_nonces cascade;
drop table if exists public.builder_wallets cascade;
drop function if exists public.create_wallet_nonce(uuid);
