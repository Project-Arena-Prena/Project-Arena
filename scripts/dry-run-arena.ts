import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv() {
  const path = join(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnv();
  const { runDatabaseArenaClock } = await import('../src/lib/dry-run-arena');
  const { assertClock, runClock } = await import('../src/lib/arena-clock');

  const clock = runClock();
  assertClock(clock);
  console.log('In-process clock passed:', clock.phases.join(' → '), 'Champion', clock.champion.project);

  try {
    const report = await runDatabaseArenaClock();
    console.log('Database clock passed:', report.phases.join(' → '));
    console.log('Arena', report.arenaSlug, 'Champion', report.champion);
    for (const row of report.field) {
      console.log(
        `  #${String(row.rank).padStart(2, '0')} ${row.name}  ${row.score} pts  ${row.ratingChange ?? 0}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Database clock skipped or failed:', message);
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
