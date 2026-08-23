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
  const { runPrenaDryRun } = await import('../src/lib/dry-run-prena');

  const report = await runPrenaDryRun();
  console.log('Arena           ', report.arenaSlug);
  console.log('Steps           ', report.steps.join(' → '));
  console.log(
    'Quote           ',
    `$${report.quote.usd.toFixed(2)} after ${report.quote.discountPercent}% → ${report.quote.tokens} PRENA`,
  );
  console.log('Payment         ', report.payment.status, `(entry ${report.payment.entryStatus})`);
  console.log('Balance         ', `${report.balanceBefore} → ${report.balanceAfter} PRENA`);
  console.log('Score unchanged ', report.scoreUnchanged && report.rankUnchanged ? 'yes' : 'NO');
  for (const allocation of report.allocations) {
    console.log(
      `  reward #${allocation.rank ?? '—'} ${allocation.project}  ${allocation.amount} PRENA  ${allocation.status}`,
    );
  }
  console.log('Claim           ', report.claimed ? `${report.claimed.amount} PRENA claimed once` : 'none');

  if (!report.scoreUnchanged || !report.rankUnchanged) {
    console.error('FAIL: token spend altered Arena scoring.');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
