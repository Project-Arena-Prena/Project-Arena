-- The Founding Arena runs across 24–25 September 2026 in Western Indonesia
-- Time (UTC+7): 2026-09-23 17:00Z through 2026-09-25 17:00Z.
do $$
begin
  update public.arenas
  set name = 'The Founding Arena',
      number = 1,
      description = 'The first public field. Projects compete for verified attention, discovery, and a permanent place in Arena history.',
      category = 'Open',
      status = 'registration',
      lifecycle_phase = 'open',
      visibility = 'public',
      starts_at = '2026-09-23 17:00:00+00'::timestamptz,
      ends_at = '2026-09-25 17:00:00+00'::timestamptz,
      registration_opens_at = least(now(), '2026-09-20 00:00:00+00'::timestamptz),
      registration_closes_at = '2026-09-23 17:00:00+00'::timestamptz,
      max_entries = 24,
      entry_price = 2900,
      prena_payment_enabled = false,
      eligibility_text = 'Any live internet Project with a public URL. One entry per Project. Submissions are reviewed before acceptance.',
      updated_at = now()
  where slug = 'founding'
    and status in ('draft', 'registration', 'full');

  if not found and not exists (select 1 from public.arenas where slug = 'founding') then
    insert into public.arenas (
      name, slug, number, description, category, status, lifecycle_phase,
      visibility, starts_at, ends_at, registration_opens_at,
      registration_closes_at, max_entries, entry_price, prena_payment_enabled,
      eligibility_text
    ) values (
      'The Founding Arena',
      'founding',
      1,
      'The first public field. Projects compete for verified attention, discovery, and a permanent place in Arena history.',
      'Open',
      'registration',
      'open',
      'public',
      '2026-09-23 17:00:00+00'::timestamptz,
      '2026-09-25 17:00:00+00'::timestamptz,
      least(now(), '2026-09-20 00:00:00+00'::timestamptz),
      '2026-09-23 17:00:00+00'::timestamptz,
      24,
      2900,
      false,
      'Any live internet Project with a public URL. One entry per Project. Submissions are reviewed before acceptance.'
    );
  end if;
end $$;
