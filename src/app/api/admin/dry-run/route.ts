import { NextResponse } from 'next/server';
import { getBuilder, userIsAdmin } from '@/lib/auth';
import { assertClock, runClock } from '@/lib/arena-clock';
import { runDatabaseArenaClock } from '@/lib/dry-run-arena';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const ctx = await getBuilder();
  if (!ctx || !(await userIsAdmin(ctx.userId, ctx.email))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const clock = runClock();
  try {
    assertClock(clock);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'clock_failed' }, { status: 500 });
  }

  if (!createAdminClient()) {
    return NextResponse.json({
      ok: true,
      database: false,
      clock: {
        phases: clock.phases,
        champion: clock.champion.project,
        field: clock.results,
      },
      hint: 'In-process clock passed. Configure Supabase and apply schema.sql to run the live database clock.',
    });
  }

  try {
    const report = await runDatabaseArenaClock();
    return NextResponse.json({ ok: true, database: true, clock: { phases: clock.phases, champion: clock.champion.project }, arena: report });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: true,
        clock: { phases: clock.phases, champion: clock.champion.project },
        error: error instanceof Error ? error.message : 'dry_run_failed',
      },
      { status: 500 },
    );
  }
}
